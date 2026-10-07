import pg from "pg";
import { databaseUrl } from "./config.js";
import { createApp, poolOptions } from "./app.js";

const pool = new pg.Pool(poolOptions(databaseUrl));
pool.on("error", (error) =>
  console.error("Database connection error:", error.code),
);
const port = Number(process.env.PORT || 3017);
const host = process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1";
const server = createApp(pool).listen(port, host, (error) => {
  if (error) {
    console.error(`Cannot start API on port ${port}: ${error.code}`);
    process.exitCode = 1;
    return;
  }
  console.log(`CaneFlow is listening on ${host}:${port}`);
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  });
