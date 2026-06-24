CREATE TYPE "CaseReviewStatus" AS ENUM (
  'NOT_REVIEWED',
  'IN_PROGRESS',
  'NEEDS_FIX',
  'CONSENSUS_DONE',
  'MODEL_ERROR'
);

CREATE TYPE "ModelRunKind" AS ENUM (
  'PREDICTION_TABLE',
  'ANNOTATION_IMPORT',
  'EXTERNAL_RESULT'
);

CREATE TABLE "ProjectAnnotationVersion" (
  "id" TEXT NOT NULL,
  "annotations" JSONB NOT NULL,
  "summary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "caseId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,

  CONSTRAINT "ProjectAnnotationVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectCaseReviewState" (
  "id" TEXT NOT NULL,
  "status" "CaseReviewStatus" NOT NULL DEFAULT 'NOT_REVIEWED',
  "tags" JSONB NOT NULL DEFAULT '[]',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "projectId" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,

  CONSTRAINT "ProjectCaseReviewState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectModelRun" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" "ModelRunKind" NOT NULL DEFAULT 'EXTERNAL_RESULT',
  "modelName" TEXT,
  "modelVersion" TEXT,
  "threshold" DOUBLE PRECISION,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "projectId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,

  CONSTRAINT "ProjectModelRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectAnnotationVersion_caseId_userId_createdAt_idx" ON "ProjectAnnotationVersion"("caseId", "userId", "createdAt");
CREATE INDEX "ProjectAnnotationVersion_userId_createdAt_idx" ON "ProjectAnnotationVersion"("userId", "createdAt");

CREATE UNIQUE INDEX "ProjectCaseReviewState_caseId_userId_key" ON "ProjectCaseReviewState"("caseId", "userId");
CREATE INDEX "ProjectCaseReviewState_projectId_status_idx" ON "ProjectCaseReviewState"("projectId", "status");
CREATE INDEX "ProjectCaseReviewState_userId_status_idx" ON "ProjectCaseReviewState"("userId", "status");

CREATE INDEX "ProjectModelRun_projectId_createdAt_idx" ON "ProjectModelRun"("projectId", "createdAt");
CREATE INDEX "ProjectModelRun_createdById_createdAt_idx" ON "ProjectModelRun"("createdById", "createdAt");

ALTER TABLE "ProjectAnnotationVersion"
  ADD CONSTRAINT "ProjectAnnotationVersion_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "ProjectCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectAnnotationVersion"
  ADD CONSTRAINT "ProjectAnnotationVersion_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectCaseReviewState"
  ADD CONSTRAINT "ProjectCaseReviewState_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectCaseReviewState"
  ADD CONSTRAINT "ProjectCaseReviewState_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "ProjectCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectCaseReviewState"
  ADD CONSTRAINT "ProjectCaseReviewState_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectModelRun"
  ADD CONSTRAINT "ProjectModelRun_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectModelRun"
  ADD CONSTRAINT "ProjectModelRun_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
