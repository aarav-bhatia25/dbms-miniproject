import express from "express";
import pg from "pg";
import { z, ZodError } from "zod";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { farmerReport, dailyReport } from "./queries.js";

pg.types.setTypeParser(1082, (value) => value);
pg.types.setTypeParser(1700, Number);
pg.types.setTypeParser(20, Number);
export const poolOptions = (connectionString) => ({
  connectionString,
  options: "-c timezone=Asia/Kolkata",
});
const date = z.iso.date();
const id = z.coerce.number().int().positive();
const litres = z.number().int().min(1).max(1000000000);
const name = z.string().trim().min(2).max(80);

export function createApp(pool) {
  const app = express();
  app.use(express.json({ limit: "20kb" }));
  app.use("/api", (req, res, next) => {
    const origin = req.get("origin");
    const allowed = [
      `http://${req.get("host")}`,
      `https://${req.get("host")}`,
      ...(process.env.NODE_ENV === "production"
        ? []
        : ["http://127.0.0.1:5173", "http://localhost:5173"]),
    ];
    if (req.method !== "GET" && origin && !allowed.includes(origin)) {
      return res
        .status(403)
        .json({ error: "Use this application's website to make changes." });
    }
    next();
  });

  app.get("/api/health", async (_req, res) => {
    await pool.query("SELECT 1 FROM daily_budgets LIMIT 1");
    res.json({ status: "ok" });
  });

  app.get("/api/data", async (req, res) => {
    const today = (await pool.query("SELECT CURRENT_DATE AS today")).rows[0]
      .today;
    const selectedDate = req.query.date ? date.parse(req.query.date) : today;
    const params = [selectedDate];
    const budget = await pool.query(
      `
      SELECT b.*, COALESCE(SUM(r.requested_litres), 0) AS requested_litres,
        COALESCE(SUM(a.allocated_litres), 0) AS allocated_litres,
        b.total_litres - COALESCE(SUM(a.allocated_litres), 0) AS remaining_litres
      FROM daily_budgets b
      LEFT JOIN irrigation_requests r ON b.budget_id = r.budget_id
      LEFT JOIN allocations a ON r.request_id = a.request_id
      WHERE b.budget_date = $1 GROUP BY b.budget_id`,
      params,
    );
    const requests = await pool.query(
      `SELECT * FROM request_summary WHERE budget_date = $1
      ORDER BY CASE priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END, request_id`,
      params,
    );
    const farmers = await pool.query("SELECT * FROM farmers ORDER BY name");
    const rules = await pool.query(
      "SELECT * FROM irrigation_rules ORDER BY rule_id",
    );
    const plots =
      await pool.query(`SELECT p.*, f.name AS farmer_name, rules.crop_stage
      FROM plots p JOIN farmers f ON p.farmer_id = f.farmer_id
      JOIN irrigation_rules rules ON p.rule_id = rules.rule_id ORDER BY p.plot_id`);
    const farmerRows = await pool.query(farmerReport, params);
    const dayRows = await pool.query(dailyReport);
    res.json({
      today,
      date: selectedDate,
      budget: budget.rows[0] || null,
      requests: requests.rows,
      farmers: farmers.rows,
      plots: plots.rows,
      rules: rules.rows,
      reports: { farmers: farmerRows.rows, days: dayRows.rows },
      reportSql: { farmers: farmerReport, days: dailyReport },
    });
  });

  // A budget can be edited before allocation. Afterwards it stays fixed.
  app.post("/api/budget", async (req, res) => {
    const input = z.object({ date, total_litres: litres }).parse(req.body);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO daily_budgets(budget_date, total_litres)
        VALUES ($1, $2) ON CONFLICT (budget_date) DO NOTHING`,
        [input.date, input.total_litres],
      );
      const budget = (
        await client.query(
          "SELECT * FROM daily_budgets WHERE budget_date = $1 FOR UPDATE",
          [input.date],
        )
      ).rows[0];
      const assigned = await client.query(
        `SELECT 1 FROM allocations a JOIN irrigation_requests r
        ON a.request_id = r.request_id WHERE r.budget_id = $1 LIMIT 1`,
        [budget.budget_id],
      );
      if (assigned.rowCount && budget.total_litres !== input.total_litres) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error:
            "This budget has already been allocated. Choose a new date for another budget.",
        });
      }
      await client.query(
        "UPDATE daily_budgets SET total_litres = $1 WHERE budget_id = $2",
        [input.total_litres, budget.budget_id],
      );
      await client.query("COMMIT");
      res.json({ message: "Daily budget saved." });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  app.post("/api/requests", async (req, res) => {
    const input = z
      .object({
        date,
        plot_id: id,
        requested_litres: litres,
        moisture_pct: z.number().min(0).max(100),
      })
      .parse(req.body);
    const result = await pool.query(
      `INSERT INTO irrigation_requests(plot_id, budget_id, moisture_pct, requested_litres)
      SELECT $1, budget_id, $2, $3 FROM daily_budgets WHERE budget_date = $4 RETURNING request_id`,
      [input.plot_id, input.moisture_pct, input.requested_litres, input.date],
    );
    if (!result.rowCount)
      return res.status(409).json({ error: "Set the daily budget first." });
    res
      .status(201)
      .json({ message: "Request added. The database assigned its priority." });
  });

  app.delete("/api/requests/:id", async (req, res) => {
    const result = await pool.query(
      `DELETE FROM irrigation_requests r WHERE request_id = $1
      AND NOT EXISTS (SELECT 1 FROM allocations a WHERE a.request_id = r.request_id) RETURNING request_id`,
      [id.parse(req.params.id)],
    );
    if (!result.rowCount)
      return res
        .status(409)
        .json({ error: "Only a request with no allocation can be removed." });
    res.json({ message: "Request removed." });
  });

  app.post("/api/allocate", async (req, res) => {
    const selectedDate = date.parse(req.body.date);
    const result = await pool.query(
      "SELECT allocate_water($1) AS litres_added",
      [selectedDate],
    );
    res.json(result.rows[0]);
  });

  app.post("/api/farmers", async (req, res) => {
    const input = z.object({ name, village: name }).parse(req.body);
    await pool.query("INSERT INTO farmers(name, village) VALUES ($1, $2)", [
      input.name,
      input.village,
    ]);
    res.status(201).json({ message: "Farmer added." });
  });

  app.post("/api/plots", async (req, res) => {
    const input = z
      .object({
        farmer_id: id,
        plot_name: name,
        area_ha: z.number().min(0.01).max(9999),
        rule_id: id,
      })
      .parse(req.body);
    await pool.query(
      "INSERT INTO plots(farmer_id, plot_name, area_ha, rule_id) VALUES ($1, $2, $3, $4)",
      [input.farmer_id, input.plot_name, input.area_ha, input.rule_id],
    );
    res.status(201).json({ message: "Plot added." });
  });

  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Endpoint not found." }),
  );
  if (existsSync(resolve("dist/index.html"))) {
    app.use(express.static(resolve("dist")));
    app.get("/{*path}", (_req, res) =>
      res.sendFile(resolve("dist/index.html")),
    );
  }
  app.use((error, _req, res, _next) => {
    if (error instanceof ZodError)
      return res.status(400).json({ error: "Please check the form values." });
    if (error.code === "23505")
      return res
        .status(409)
        .json({ error: "This plot already has a request for this date." });
    if (error.code === "P0001")
      return res.status(409).json({ error: error.message });
    if (
      ["23514", "23503", "23502", "22003", "22007", "22008"].includes(
        error.code,
      )
    )
      return res
        .status(400)
        .json({ error: "Invalid quantity, date or reference." });
    if (error.type === "entity.parse.failed")
      return res.status(400).json({ error: "Invalid JSON." });
    console.error(error.message);
    res.status(500).json({
      error:
        "Could not access the database. Check PostgreSQL and run npm run db:setup.",
    });
  });
  return app;
}
