import { test, expect } from "@playwright/test";
import pg from "pg";
import { databaseUrl } from "../../server/config.js";
import { createApp, poolOptions } from "../../server/app.js";
import { installDatabase } from "../../scripts/setup-db.js";

let admin, pool, server, base;
const database = `caneflow_browser_${process.pid}`;
test.beforeAll(async () => {
  const url = new URL(databaseUrl);
  url.pathname = "/postgres";
  admin = new pg.Client({ connectionString: url.toString() });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${database}`);
  url.pathname = `/${database}`;
  await installDatabase(url.toString());
  pool = new pg.Pool(poolOptions(url.toString()));
  server = createApp(pool).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.on("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (pool) await pool.end();
  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    await admin.end();
  }
});

test("allocate sample requests and inspect a simple SQL report", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await expect(
    page.getByRole("heading", { name: "Water allocation", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("navigation").getByRole("link")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Allocate water", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "1,00,000 litres allocated",
  );
  await expect(
    page.getByRole("row").filter({ hasText: "Vikram Shinde" }),
  ).toContainText("25,000 L");
  await expect(
    page.getByRole("row").filter({ hasText: "Vikram Shinde" }),
  ).toContainText("Partial");
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Allocation by farmer" }),
  ).toBeVisible();
  await page.getByText("Show SQL query", { exact: true }).first().click();
  await expect(page.locator("pre").first()).toContainText("GROUP BY");
  expect(errors).toEqual([]);
});

test("add farmer and plot, create next-day budget and request; mobile remains usable", async ({
  page,
}) => {
  await page.goto(`${base}/farmers`);
  await page.getByRole("button", { name: "Add farmer", exact: true }).click();
  await page.getByLabel("Farmer name").fill("Test Farmer");
  await page.getByLabel("Village", { exact: true }).fill("Walwa");
  await page.getByRole("button", { name: "Save farmer" }).click();
  await expect(page.getByRole("status")).toHaveText("Farmer added.");
  await page.getByRole("button", { name: "Add plot", exact: true }).click();
  await page
    .getByLabel("Farmer", { exact: true })
    .selectOption({ label: "Test Farmer" });
  await page.getByLabel("Plot name").fill("Test Field");
  await page.getByLabel("Area (hectares)").fill("1.5");
  await page.getByRole("button", { name: "Save plot" }).click();
  await expect(page.getByRole("status")).toHaveText("Plot added.");
  await page
    .getByRole("link", { name: "Water allocation", exact: true })
    .click();
  const date = new Date(
    `${await page.getByLabel("Selected date").inputValue()}T12:00:00Z`,
  );
  date.setUTCDate(date.getUTCDate() + 1);
  await page.getByLabel("Selected date").fill(date.toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Set daily budget" }).click();
  await page.getByLabel("Water available (litres)").fill("20000");
  await page.getByRole("button", { name: "Save budget" }).click();
  await expect(page.getByRole("status")).toHaveText("Daily budget saved.");
  await page.getByRole("button", { name: "Add request", exact: true }).click();
  await page.getByLabel("Soil moisture (%)").fill("20");
  await page.getByLabel("Water needed (litres)").fill("25000");
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByRole("status")).toContainText("Request added");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Allocate water", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "20,000 litres allocated",
  );
});
