CREATE EXTENSION IF NOT EXISTS "pg_trgm";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_title_trgm_idx" ON "items" USING gin ("title" gin_trgm_ops);
