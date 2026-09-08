-- ============================================================
-- Full-text search vector on issues
-- ============================================================
ALTER TABLE "issues" ADD COLUMN "search_vector" tsvector;

UPDATE "issues"
SET "search_vector" = to_tsvector('english',
  coalesce("title", '') || ' ' || coalesce("description", ''));

CREATE INDEX "issues_search_idx" ON "issues" USING GIN ("search_vector");

CREATE OR REPLACE FUNCTION issues_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.title, '') || ' ' || coalesce(NEW.description, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER issues_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, description
  ON "issues"
  FOR EACH ROW EXECUTE FUNCTION issues_search_vector_update();

-- ============================================================
-- GitHub PR URL on issues
-- ============================================================
ALTER TABLE "issues" ADD COLUMN "pr_url" text;

-- ============================================================
-- Issue link kind enum
-- ============================================================
CREATE TYPE "public"."issue_link_kind" AS ENUM('blocks', 'duplicates', 'relates_to');

-- ============================================================
-- Issue dependency links
-- ============================================================
CREATE TABLE "issue_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_id" uuid NOT NULL REFERENCES "issues"("id") ON DELETE CASCADE,
  "target_id" uuid NOT NULL REFERENCES "issues"("id") ON DELETE CASCADE,
  "kind" "issue_link_kind" NOT NULL DEFAULT 'relates_to',
  "created_by_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "issue_links_uniq" ON "issue_links" ("source_id", "target_id", "kind");
CREATE INDEX "issue_links_source_idx" ON "issue_links" ("source_id");
CREATE INDEX "issue_links_target_idx" ON "issue_links" ("target_id");

-- ============================================================
-- Issue templates per project
-- ============================================================
CREATE TABLE "issue_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "name" varchar(120) NOT NULL,
  "description" text,
  "type" "issue_type" NOT NULL DEFAULT 'task',
  "priority" "issue_priority" NOT NULL DEFAULT 'medium',
  "labels" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "body" text,
  "created_by_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "issue_templates_project_idx" ON "issue_templates" ("project_id");
