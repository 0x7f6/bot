ALTER TABLE "send_messages" ADD COLUMN "sticky" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "send_messages" ADD COLUMN "updated" timestamp DEFAULT now() NOT NULL;