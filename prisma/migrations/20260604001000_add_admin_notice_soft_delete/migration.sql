ALTER TABLE "AdminNotice" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "AdminNotice_deletedAt_idx" ON "AdminNotice"("deletedAt");
