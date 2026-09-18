DO $$ BEGIN
 CREATE TYPE "public"."issue_link_kind" AS ENUM('blocks', 'duplicates', 'relates_to');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "issue_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"kind" "issue_link_kind" DEFAULT 'relates_to' NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "issue_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"type" "issue_type" DEFAULT 'task' NOT NULL,
	"priority" "issue_priority" DEFAULT 'medium' NOT NULL,
	"labels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"body" text,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_tokens" ADD COLUMN IF NOT EXISTS "project_id" uuid;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN IF NOT EXISTS "pr_url" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN IF NOT EXISTS "search_vector" "tsvector";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "issue_links" ADD CONSTRAINT "issue_links_source_id_issues_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "issue_links" ADD CONSTRAINT "issue_links_target_id_issues_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "issue_links" ADD CONSTRAINT "issue_links_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "issue_templates" ADD CONSTRAINT "issue_templates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "issue_templates" ADD CONSTRAINT "issue_templates_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "issue_links_uniq" ON "issue_links" USING btree ("source_id","target_id","kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "issue_links_source_idx" ON "issue_links" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "issue_links_target_idx" ON "issue_links" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "issue_templates_project_idx" ON "issue_templates" USING btree ("project_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_tokens_project_idx" ON "api_tokens" USING btree ("project_id");