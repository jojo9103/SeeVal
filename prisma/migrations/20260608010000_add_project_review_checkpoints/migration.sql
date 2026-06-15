CREATE TABLE "ProjectReviewCheckpoint" (
  "id" TEXT NOT NULL,
  "label" TEXT,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "projectId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,

  CONSTRAINT "ProjectReviewCheckpoint_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectReviewCheckpoint_projectId_createdAt_idx" ON "ProjectReviewCheckpoint"("projectId", "createdAt");
CREATE INDEX "ProjectReviewCheckpoint_createdById_idx" ON "ProjectReviewCheckpoint"("createdById");

ALTER TABLE "ProjectReviewCheckpoint"
ADD CONSTRAINT "ProjectReviewCheckpoint_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectReviewCheckpoint"
ADD CONSTRAINT "ProjectReviewCheckpoint_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
