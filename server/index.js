import pg from "pg";
import { databaseUrl } from "./config.js";
import { createApp, poolOptions } from "./app.js";

const pool = new pg.Pool(poolOptions(databaseUrl));
pool.on("error", (error) =>
  console.error("Database connection error:", error.code),
);
const port = Number(process.env.PORT || 3017);
const server = createApp(pool).listen(port, "127.0.0.1", (error) => {
  if (error) {
    console.error(`Cannot start API on port ${port}: ${error.code}`);
    process.exitCode = 1;
    return;
  }
  console.log(`CaneFlow API: http://127.0.0.1:${port}`);
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  });
