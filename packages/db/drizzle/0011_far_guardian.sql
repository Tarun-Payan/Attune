CREATE TABLE "verification_codes" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"email" varchar NOT NULL,
	"code" varchar(6) NOT NULL,
	"type" varchar(32) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "verification_codes" ADD CONSTRAINT "verification_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "verification_codes_email_type_idx" ON "verification_codes" USING btree ("email","type");--> statement-breakpoint
CREATE INDEX "verification_codes_user_type_idx" ON "verification_codes" USING btree ("user_id","type");