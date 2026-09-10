// Must be the first import: loads .env before anything reads env vars.
import { config } from "dotenv";
import { fileURLToPath } from "node:url";

config(); // apps/worker/.env (optional)
config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) }); // monorepo root
