CREATE TABLE "login_failures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_lower" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_resets" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"lang" text DEFAULT 'en' NOT NULL,
	"theme" text DEFAULT 'system' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_lang_check" CHECK ("users"."lang" in ('en', 'fr')),
	CONSTRAINT "users_theme_check" CHECK ("users"."theme" in ('system', 'light', 'dark'))
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"site" text NOT NULL,
	"site_game_id" text NOT NULL,
	"url" text NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"time_class" text NOT NULL,
	"clock" text NOT NULL,
	"colour" text NOT NULL,
	"result" text NOT NULL,
	"white_name" text NOT NULL,
	"black_name" text NOT NULL,
	"white_rating" integer,
	"black_rating" integer,
	"eco" text,
	"opening" text,
	"pgn" text NOT NULL,
	"plies" integer NOT NULL,
	CONSTRAINT "games_user_id_site_site_game_id_unique" UNIQUE("user_id","site","site_game_id"),
	CONSTRAINT "games_site_check" CHECK ("games"."site" in ('chesscom', 'lichess')),
	CONSTRAINT "games_time_class_check" CHECK ("games"."time_class" in ('bullet', 'blitz', 'rapid', 'classical', 'daily')),
	CONSTRAINT "games_colour_check" CHECK ("games"."colour" in ('white', 'black')),
	CONSTRAINT "games_result_check" CHECK ("games"."result" in ('win', 'draw', 'loss'))
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"site" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"imported" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "import_jobs_site_check" CHECK ("import_jobs"."site" in ('chesscom', 'lichess')),
	CONSTRAINT "import_jobs_status_check" CHECK ("import_jobs"."status" in ('queued', 'running', 'done', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "linked_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"site" text NOT NULL,
	"username" text NOT NULL,
	"last_synced_at" timestamp with time zone,
	CONSTRAINT "linked_accounts_user_id_site_unique" UNIQUE("user_id","site"),
	CONSTRAINT "linked_accounts_site_check" CHECK ("linked_accounts"."site" in ('chesscom', 'lichess'))
);
--> statement-breakpoint
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linked_accounts" ADD CONSTRAINT "linked_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "login_failures_email_lower_at_idx" ON "login_failures" USING btree ("email_lower","at");--> statement-breakpoint
CREATE INDEX "password_resets_user_id_idx" ON "password_resets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_idx" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "games_user_id_ended_at_idx" ON "games" USING btree ("user_id","ended_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "import_jobs_one_active_per_user_idx" ON "import_jobs" USING btree ("user_id") WHERE "import_jobs"."status" in ('queued', 'running');--> statement-breakpoint
CREATE INDEX "import_jobs_user_id_idx" ON "import_jobs" USING btree ("user_id");