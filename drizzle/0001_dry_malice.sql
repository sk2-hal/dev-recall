CREATE TABLE "entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"types" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entries_title_not_blank" CHECK ("entries"."title" ~ '[^[:space:]　]'),
	CONSTRAINT "entries_body_not_blank" CHECK ("entries"."body" ~ '[^[:space:]　]'),
	CONSTRAINT "entries_types_valid" CHECK (array_ndims("entries"."types") = 1
    AND cardinality("entries"."types") BETWEEN 1 AND 5
    AND "entries"."types" <@ ARRAY['decision', 'problem', 'solution', 'learning', 'note']::text[]
    AND array_position("entries"."types", NULL) IS NULL
    AND cardinality(array_positions("entries"."types", 'decision')) <= 1
    AND cardinality(array_positions("entries"."types", 'problem')) <= 1
    AND cardinality(array_positions("entries"."types", 'solution')) <= 1
    AND cardinality(array_positions("entries"."types", 'learning')) <= 1
    AND cardinality(array_positions("entries"."types", 'note')) <= 1)
);
--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;