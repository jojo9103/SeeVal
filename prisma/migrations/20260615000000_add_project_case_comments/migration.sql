CREATE TABLE "ProjectCaseComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "caseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ProjectCaseComment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectCaseComment_caseId_userId_key" ON "ProjectCaseComment"("caseId", "userId");

CREATE INDEX "ProjectCaseComment_userId_idx" ON "ProjectCaseComment"("userId");

ALTER TABLE "ProjectCaseComment" ADD CONSTRAINT "ProjectCaseComment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ProjectCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectCaseComment" ADD CONSTRAINT "ProjectCaseComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
