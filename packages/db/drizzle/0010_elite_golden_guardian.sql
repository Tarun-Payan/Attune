CREATE TABLE "admin_role_permissions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"role_id" varchar NOT NULL,
	"feature" varchar(32) NOT NULL,
	"action" varchar(16) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_roles" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "admin_role_id" varchar;--> statement-breakpoint
ALTER TABLE "admin_role_permissions" ADD CONSTRAINT "admin_role_permissions_role_id_admin_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."admin_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_role_permissions_role_feature_action_unique" ON "admin_role_permissions" USING btree ("role_id","feature","action");--> statement-breakpoint
CREATE INDEX "admin_role_permissions_role_idx" ON "admin_role_permissions" USING btree ("role_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_admin_role_id_admin_roles_id_fk" FOREIGN KEY ("admin_role_id") REFERENCES "public"."admin_roles"("id") ON DELETE set null ON UPDATE no action;