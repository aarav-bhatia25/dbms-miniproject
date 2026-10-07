import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { databaseUrl } from "../server/config.js";

export async function installDatabase(url, seed = true) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("SET timezone = 'Asia/Kolkata'");
    await client.query("BEGIN");
    for (const file of [
      "001_schema.sql",
      "002_functions.sql",
      "003_views.sql",
    ]) {
      await client.query(
        await readFile(new URL(`../db/${file}`, import.meta.url), "utf8"),
      );
    }
    const result = await client.query("SELECT COUNT(*) FROM farmers");
    if (seed && Number(result.rows[0].count) === 0) {
      await client.query(
        await readFile(new URL("../db/004_seed.sql", import.meta.url), "utf8"),
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    // Hosted providers create the database for us; only install our tables there.
    if (!process.argv.includes("--existing")) {
      const target = new URL(databaseUrl);
      const database = decodeURIComponent(target.pathname.slice(1));
      const connection = new URL(databaseUrl);
      connection.pathname = "/postgres";
      const admin = new pg.Client({ connectionString: connection.toString() });
      await admin.connect();
      try {
        const exists = await admin.query(
          "SELECT 1 FROM pg_database WHERE datname = $1",
          [database],
        );
        if (!exists.rowCount)
          await admin.query(
            `CREATE DATABASE "${database.replaceAll('"', '""')}"`,
          );
      } finally {
        await admin.end();
      }
    }
    await installDatabase(databaseUrl);
    console.log("Database ready: six tables and sample irrigation requests.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
