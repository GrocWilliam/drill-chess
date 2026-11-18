CREATE TABLE "endgame_progress" (
	"user_id" uuid NOT NULL,
	"position_id" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"passes" integer DEFAULT 0 NOT NULL,
	"streak" integer DEFAULT 0 NOT NULL,
	"mastered_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "endgame_progress_user_id_position_id_pk" PRIMARY KEY("user_id","position_id")
);
--> statement-breakpoint
CREATE TABLE "tablebase_cache" (
	"fen" text PRIMARY KEY NOT NULL,
	"response" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "endgame_progress" ADD CONSTRAINT "endgame_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;