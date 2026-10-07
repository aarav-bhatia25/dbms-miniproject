import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { databaseUrl } from "../server/config.js";
import { createApp, poolOptions } from "../server/app.js";
import { installDatabase } from "../scripts/setup-db.js";

const database = `caneflow_test_${process.pid}`;
let admin, pool, today, server, base;
before(async () => {
  const url = new URL(databaseUrl);
  url.pathname = "/postgres";
  admin = new pg.Client({ connectionString: url.toString() });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${database}`);
  url.pathname = `/${database}`;
  await installDatabase(url.toString(), false);
  pool = new pg.Pool(poolOptions(url.toString()));
  today = (await pool.query("SELECT CURRENT_DATE AS day")).rows[0].day;
  server = createApp(pool).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.on("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
beforeEach(async () => {
  await pool.query(
    "TRUNCATE allocations, irrigation_requests, plots, farmers, irrigation_rules, daily_budgets RESTART IDENTITY CASCADE",
  );
  await pool.query(
    await readFile(new URL("../db/004_seed.sql", import.meta.url), "utf8"),
  );
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (pool) await pool.end();
  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    await admin.end();
  }
});
const allocate = () =>
  pool.query("SELECT allocate_water($1) AS litres", [today]);

test("six tables, with priorities assigned by the insert trigger", async () => {
  const tables = await pool.query(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
  );
  assert.equal(tables.rows[0].n, 6);
  const requests = await pool.query(
    "SELECT priority FROM irrigation_requests ORDER BY request_id",
  );
  assert.deepEqual(
    requests.rows.map((r) => r.priority),
    ["High", "High", "Medium", "Low"],
  );
});

test("allocation respects priority, supports a partial request and never double-allocates", async () => {
  assert.equal((await allocate()).rows[0].litres, 100000);
  const result = await pool.query(
    "SELECT allocated_litres, status FROM request_summary ORDER BY request_id",
  );
  assert.deepEqual(
    result.rows.map((r) => r.allocated_litres),
    [40000, 35000, 25000, 0],
  );
  assert.deepEqual(
    result.rows.map((r) => r.status),
    ["Allocated", "Allocated", "Partial", "Waiting"],
  );
  assert.equal((await allocate()).rows[0].litres, 0);
});

test("two simultaneous calls share the same limited budget safely", async () => {
  const results = await Promise.all([allocate(), allocate()]);
  assert.equal(
    results.reduce((sum, r) => sum + r.rows[0].litres, 0),
    100000,
  );
  assert.equal(
    (await pool.query("SELECT SUM(allocated_litres) AS total FROM allocations"))
      .rows[0].total,
    100000,
  );
});

test("rolling back allocation also removes its allocation rows", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT allocate_water($1)", [today]);
    await client.query("ROLLBACK");
  } finally {
    client.release();
  }
  assert.equal(
    (await pool.query("SELECT COUNT(*) AS n FROM allocations")).rows[0].n,
    0,
  );
});

test("database constraints reject invalid quantities and duplicate requests", async () => {
  await assert.rejects(
    pool.query(
      "INSERT INTO daily_budgets(budget_date,total_litres) VALUES (CURRENT_DATE+1,-1)",
    ),
    { code: "23514" },
  );
  await assert.rejects(
    pool.query(
      "INSERT INTO irrigation_requests(plot_id,budget_id,moisture_pct,requested_litres) VALUES (1,1,20,100)",
    ),
    { code: "23505" },
  );
});

test("API supports records and reports, and fixes the budget after allocation", async () => {
  const send = (path, body, method = "POST") =>
    fetch(`${base}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  assert.equal(
    (await send("/farmers", { name: "New Farmer", village: "New Village" }))
      .status,
    201,
  );
  assert.equal(
    (
      await send("/plots", {
        farmer_id: 5,
        plot_name: "New Field",
        area_ha: 1.5,
        rule_id: 1,
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await send("/requests", {
        date: today,
        plot_id: 5,
        moisture_pct: 20,
        requested_litres: 2000,
      })
    ).status,
    201,
  );
  assert.equal((await send("/requests/5", {}, "DELETE")).status, 200);
  assert.equal(
    (await send("/budget", { date: today, total_litres: 120000 })).status,
    200,
  );
  assert.equal((await send("/allocate", { date: today })).status, 200);
  assert.equal(
    (await send("/budget", { date: today, total_litres: 50000 })).status,
    409,
  );
  assert.equal((await send("/requests/1", {}, "DELETE")).status, 409);
  const data = await (await fetch(`${base}/data?date=${today}`)).json();
  assert.equal(data.budget.remaining_litres, 0);
  assert.equal(data.reports.days[0].allocated_litres, 120000);
  assert.equal(data.reports.farmers.length, 5);
});
