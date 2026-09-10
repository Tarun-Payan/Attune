import { config } from "dotenv";
import { fileURLToPath } from "node:url";

config();
config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://attune:attune@localhost:5432/attune",
  },
});
