import { sql } from "drizzle-orm";
import { db } from "@attune/db/client";

/**
 * Executes a lightweight liveness check query against PostgreSQL.
 */
export async function pingDatabase(): Promise<boolean> {
  await db.execute(sql`SELECT 1`);
  return true;
}
