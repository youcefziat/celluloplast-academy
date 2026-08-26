ALTER TABLE "organizationmember" ADD COLUMN IF NOT EXISTS "first_name" text;
--> statement-breakpoint
ALTER TABLE "organizationmember" ADD COLUMN IF NOT EXISTS "last_name" text;
--> statement-breakpoint
ALTER TABLE "organizationmember" ADD COLUMN IF NOT EXISTS "job_title" text;
--> statement-breakpoint
ALTER TABLE "organizationmember" ADD COLUMN IF NOT EXISTS "department" text;
--> statement-breakpoint
ALTER TABLE "organizationmember" ADD COLUMN IF NOT EXISTS "manager_member_id" bigint;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organizationmember" ADD CONSTRAINT "organizationmember_manager_member_id_fkey" FOREIGN KEY ("manager_member_id") REFERENCES "public"."organizationmember"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_organizationmember_manager_member_id" ON "organizationmember" USING btree ("manager_member_id");
