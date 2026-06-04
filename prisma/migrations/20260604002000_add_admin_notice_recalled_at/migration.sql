ALTER TABLE "AdminNotice" ADD COLUMN "recalledAt" TIMESTAMP(3);

CREATE INDEX "AdminNotice_recalledAt_idx" ON "AdminNotice"("recalledAt");
