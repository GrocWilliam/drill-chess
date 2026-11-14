CREATE TABLE "analyses" (
	"game_id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"depth" integer NOT NULL,
	"evals" jsonb NOT NULL,
	"best" jsonb NOT NULL,
	"marks" jsonb NOT NULL,
	"phases" jsonb NOT NULL,
	"accuracy_white" real NOT NULL,
	"accuracy_black" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analyses_depth_check" CHECK ("analyses"."depth" between 1 and 30)
);
--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analyses_user_id_idx" ON "analyses" USING btree ("user_id");