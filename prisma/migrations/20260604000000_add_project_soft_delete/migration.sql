ALTER TABLE "Project" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "Project_deletedAt_idx" ON "Project"("deletedAt");
