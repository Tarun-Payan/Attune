import { config } from "dotenv";
import { fileURLToPath } from "node:url";

// Load the app's own .env first (if present), then the monorepo root .env as fallback.
config();
config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set (check .env at the repo root)");
}

export const client = postgres(connectionString, { max: 10 });
export const db = drizzle(client, { schema });
