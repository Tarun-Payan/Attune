ALTER TABLE "sync_runs" ADD COLUMN "job_id" varchar;--> statement-breakpoint
CREATE INDEX "sync_runs_job_id_idx" ON "sync_runs" USING btree ("job_id");