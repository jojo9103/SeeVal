CREATE TYPE "ColumnDataType" AS ENUM ('int', 'float', 'string', 'category', 'bool');

CREATE TABLE "ProjectColumnMetadata" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "dataType" "ColumnDataType" NOT NULL DEFAULT 'string',
  "minValue" DOUBLE PRECISION,
  "maxValue" DOUBLE PRECISION,
  "nullable" BOOLEAN NOT NULL DEFAULT true,
  "unit" TEXT,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "projectId" TEXT NOT NULL,

  CONSTRAINT "ProjectColumnMetadata_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectColumnMetadata_projectId_name_key" ON "ProjectColumnMetadata"("projectId", "name");
CREATE INDEX "ProjectColumnMetadata_projectId_idx" ON "ProjectColumnMetadata"("projectId");
CREATE INDEX "ProjectColumnMetadata_dataType_idx" ON "ProjectColumnMetadata"("dataType");

ALTER TABLE "ProjectColumnMetadata"
ADD CONSTRAINT "ProjectColumnMetadata_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
