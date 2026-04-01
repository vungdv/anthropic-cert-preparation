import pg from "pg";

const pool = new pg.Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME || "support",
  user: process.env.DB_USER || "support",
  password: process.env.DB_PASSWORD || "support",
});

export async function query(text, params) {
  return pool.query(text, params);
}

export async function waitForDb(retries = 20, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query("SELECT 1");
      console.log("Database connected");
      return;
    } catch {
      console.log(`Waiting for database... (${i + 1}/${retries})`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("Could not connect to database");
}
