CREATE INDEX IF NOT EXISTS "ProjectFile_projectId_kind_idx"
  ON "ProjectFile"("projectId", "kind");

CREATE INDEX IF NOT EXISTS "ProjectFile_projectId_createdAt_idx"
  ON "ProjectFile"("projectId", "createdAt");

CREATE INDEX IF NOT EXISTS "ProjectCase_projectId_createdAt_idx"
  ON "ProjectCase"("projectId", "createdAt");

CREATE INDEX IF NOT EXISTS "ProjectCase_projectId_imageId_idx"
  ON "ProjectCase"("projectId", "imageId");

CREATE INDEX IF NOT EXISTS "ProjectCase_projectId_registrationNumber_idx"
  ON "ProjectCase"("projectId", "registrationNumber");

CREATE INDEX IF NOT EXISTS "ProjectCaseAnnotation_caseId_userId_idx"
  ON "ProjectCaseAnnotation"("caseId", "userId");

CREATE INDEX IF NOT EXISTS "ProjectCaseComment_caseId_userId_idx"
  ON "ProjectCaseComment"("caseId", "userId");

CREATE INDEX IF NOT EXISTS "ProjectCasePredictionEdit_caseId_userId_idx"
  ON "ProjectCasePredictionEdit"("caseId", "userId");
