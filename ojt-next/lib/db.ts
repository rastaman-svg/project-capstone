import { Pool, types } from "pg";

// DATE (OID 1082) has no timezone attached. pg's default parser turns it
// into a JS Date at local midnight, which then silently shifts a day
// when .toISOString() (or JSON.stringify, which calls the same thing)
// converts it to UTC — anywhere the server's timezone is ahead of UTC,
// e.g. the Philippines (UTC+8). Keeping DATE as the raw "YYYY-MM-DD"
// string sidesteps the whole bug class; every date field in this app
// is a plain string end to end, never a Date object.
types.setTypeParser(1082, (val: string) => val);

// A single pooled connection reused across serverless invocations
// (Vercel keeps warm functions alive between requests) and across
// Next.js dev-mode hot reloads (the global cache below prevents
// spawning a new pool on every file save).
declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

export const pool =
  global._pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    // Vercel Postgres / Neon / Supabase all require TLS; this accepts
    // their managed certs without needing a local CA bundle.
    ssl: process.env.DATABASE_URL?.includes("localhost") || process.env.DATABASE_URL?.includes("127.0.0.1")
      ? false
      : { rejectUnauthorized: false },
  });

if (process.env.NODE_ENV !== "production") {
  global._pgPool = pool;
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
