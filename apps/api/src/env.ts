// Must be the first import in the entrypoint: loads .env before any module
// that reads environment variables at import time (e.g. @attune/db/client).
import { config } from "dotenv";
import { fileURLToPath } from "node:url";

config(); // apps/api/.env (optional)
config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) }); // monorepo root
