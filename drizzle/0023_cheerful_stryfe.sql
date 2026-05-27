CREATE TYPE "public"."productSoftware" AS ENUM('PTERODACTYL', 'CALAGOPUS');--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "software" "productSoftware" DEFAULT 'PTERODACTYL' NOT NULL;--> statement-breakpoint
CREATE INDEX "products_software_idx" ON "products" USING btree ("software");