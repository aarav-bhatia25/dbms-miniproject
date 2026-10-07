import "dotenv/config";

// A separate database leaves the previous version's data untouched.
export const databaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres_dev@127.0.0.1:55432/caneflow_simple";
