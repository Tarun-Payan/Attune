CREATE INDEX "devices_user_idx" ON "devices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "items_source_idx" ON "items" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "notification_logs_user_sent_idx" ON "notification_logs" USING btree ("user_id","sent_at");