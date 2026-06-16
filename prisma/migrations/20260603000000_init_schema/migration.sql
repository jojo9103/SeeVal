CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'APPROVED', 'ACTIVE', 'REJECTED', 'DISABLED');
CREATE TYPE "TokenType" AS ENUM ('SET_PASSWORD', 'RESET_PASSWORD');
CREATE TYPE "RequestStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED');
CREATE TYPE "ProjectFileKind" AS ENUM ('CLINICAL_TEXT', 'MODEL_PREDICTION', 'IMAGE');
CREATE TYPE "ProjectShareStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "organization" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'USER',
  "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
  "passwordHash" TEXT,
  "approvedAt" TIMESTAMP(3),
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthToken" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "type" "TokenType" NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT NOT NULL,

  CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceRequest" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "details" TEXT NOT NULL,
  "status" "RequestStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "userId" TEXT NOT NULL,

  CONSTRAINT "WorkspaceRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Project" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "editablePredictionColumns" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "ownerId" TEXT NOT NULL,

  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectFile" (
  "id" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "relativePath" TEXT,
  "storagePath" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "kind" "ProjectFileKind" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "projectId" TEXT NOT NULL,

  CONSTRAINT "ProjectFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectCase" (
  "id" TEXT NOT NULL,
  "registrationNumber" TEXT NOT NULL,
  "imageId" TEXT,
  "imageFolder" TEXT,
  "clinicalData" JSONB NOT NULL,
  "predictionData" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "projectId" TEXT NOT NULL,
  "imageFileId" TEXT,

  CONSTRAINT "ProjectCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectCaseAnnotation" (
  "id" TEXT NOT NULL,
  "annotations" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "caseId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,

  CONSTRAINT "ProjectCaseAnnotation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectCasePredictionEdit" (
  "id" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "caseId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,

  CONSTRAINT "ProjectCasePredictionEdit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectShare" (
  "id" TEXT NOT NULL,
  "status" "ProjectShareStatus" NOT NULL DEFAULT 'PENDING',
  "message" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  "projectId" TEXT NOT NULL,
  "sharedWithId" TEXT NOT NULL,

  CONSTRAINT "ProjectShare_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminNotice" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "authorId" TEXT NOT NULL,

  CONSTRAINT "AdminNotice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_status_idx" ON "User"("status");
CREATE INDEX "User_organization_idx" ON "User"("organization");

CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");
CREATE INDEX "AuthToken_userId_type_idx" ON "AuthToken"("userId", "type");
CREATE INDEX "AuthToken_expiresAt_idx" ON "AuthToken"("expiresAt");

CREATE INDEX "WorkspaceRequest_userId_createdAt_idx" ON "WorkspaceRequest"("userId", "createdAt");
CREATE INDEX "WorkspaceRequest_status_idx" ON "WorkspaceRequest"("status");

CREATE INDEX "Project_ownerId_createdAt_idx" ON "Project"("ownerId", "createdAt");

CREATE INDEX "ProjectFile_projectId_idx" ON "ProjectFile"("projectId");
CREATE INDEX "ProjectFile_kind_idx" ON "ProjectFile"("kind");

CREATE INDEX "ProjectCase_projectId_idx" ON "ProjectCase"("projectId");
CREATE INDEX "ProjectCase_registrationNumber_idx" ON "ProjectCase"("registrationNumber");
CREATE INDEX "ProjectCase_imageId_imageFolder_idx" ON "ProjectCase"("imageId", "imageFolder");

CREATE UNIQUE INDEX "ProjectCaseAnnotation_caseId_userId_key" ON "ProjectCaseAnnotation"("caseId", "userId");
CREATE INDEX "ProjectCaseAnnotation_userId_idx" ON "ProjectCaseAnnotation"("userId");

CREATE UNIQUE INDEX "ProjectCasePredictionEdit_caseId_userId_key" ON "ProjectCasePredictionEdit"("caseId", "userId");
CREATE INDEX "ProjectCasePredictionEdit_userId_idx" ON "ProjectCasePredictionEdit"("userId");

CREATE UNIQUE INDEX "ProjectShare_projectId_sharedWithId_key" ON "ProjectShare"("projectId", "sharedWithId");
CREATE INDEX "ProjectShare_sharedWithId_status_idx" ON "ProjectShare"("sharedWithId", "status");
CREATE INDEX "ProjectShare_projectId_idx" ON "ProjectShare"("projectId");

CREATE INDEX "AdminNotice_createdAt_idx" ON "AdminNotice"("createdAt");
CREATE INDEX "AdminNotice_authorId_idx" ON "AdminNotice"("authorId");

ALTER TABLE "AuthToken"
ADD CONSTRAINT "AuthToken_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceRequest"
ADD CONSTRAINT "WorkspaceRequest_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Project"
ADD CONSTRAINT "Project_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectFile"
ADD CONSTRAINT "ProjectFile_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectCase"
ADD CONSTRAINT "ProjectCase_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectCase"
ADD CONSTRAINT "ProjectCase_imageFileId_fkey"
FOREIGN KEY ("imageFileId") REFERENCES "ProjectFile"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjectCaseAnnotation"
ADD CONSTRAINT "ProjectCaseAnnotation_caseId_fkey"
FOREIGN KEY ("caseId") REFERENCES "ProjectCase"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectCaseAnnotation"
ADD CONSTRAINT "ProjectCaseAnnotation_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectCasePredictionEdit"
ADD CONSTRAINT "ProjectCasePredictionEdit_caseId_fkey"
FOREIGN KEY ("caseId") REFERENCES "ProjectCase"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectCasePredictionEdit"
ADD CONSTRAINT "ProjectCasePredictionEdit_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectShare"
ADD CONSTRAINT "ProjectShare_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectShare"
ADD CONSTRAINT "ProjectShare_sharedWithId_fkey"
FOREIGN KEY ("sharedWithId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdminNotice"
ADD CONSTRAINT "AdminNotice_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
