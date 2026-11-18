CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"repertoire_move_id" uuid NOT NULL,
	"ease" real DEFAULT 2.5 NOT NULL,
	"interval_days" integer DEFAULT 0 NOT NULL,
	"reps" integer DEFAULT 0 NOT NULL,
	"due_on" date NOT NULL,
	CONSTRAINT "cards_repertoire_move_id_unique" UNIQUE("repertoire_move_id")
);
--> statement-breakpoint
CREATE TABLE "repertoire_moves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"repertoire_id" uuid NOT NULL,
	"from_fen" text NOT NULL,
	"to_fen" text NOT NULL,
	"san" text NOT NULL,
	"uci" text NOT NULL,
	"by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "repertoire_moves_from_uci_unique" UNIQUE("repertoire_id","from_fen","uci"),
	CONSTRAINT "repertoire_moves_by_check" CHECK ("repertoire_moves"."by" in ('player', 'opponent'))
);
--> statement-breakpoint
CREATE TABLE "repertoires" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"colour" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "repertoires_user_colour_unique" UNIQUE("user_id","colour"),
	CONSTRAINT "repertoires_colour_check" CHECK ("repertoires"."colour" in ('white', 'black'))
);
--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_repertoire_move_id_repertoire_moves_id_fk" FOREIGN KEY ("repertoire_move_id") REFERENCES "public"."repertoire_moves"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repertoire_moves" ADD CONSTRAINT "repertoire_moves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repertoire_moves" ADD CONSTRAINT "repertoire_moves_repertoire_id_repertoires_id_fk" FOREIGN KEY ("repertoire_id") REFERENCES "public"."repertoires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repertoires" ADD CONSTRAINT "repertoires_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cards_user_due_idx" ON "cards" USING btree ("user_id","due_on");--> statement-breakpoint
CREATE UNIQUE INDEX "repertoire_moves_player_unique" ON "repertoire_moves" USING btree ("repertoire_id","from_fen") WHERE "repertoire_moves"."by" = 'player';--> statement-breakpoint
CREATE INDEX "repertoire_moves_to_fen_idx" ON "repertoire_moves" USING btree ("repertoire_id","to_fen");