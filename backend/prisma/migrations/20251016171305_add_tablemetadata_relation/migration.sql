-- CreateTable
CREATE TABLE "TableMetadata" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TableMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColumnMetadata" (
    "id" TEXT NOT NULL,
    "tableMetadataId" TEXT NOT NULL,
    "columnName" TEXT NOT NULL,
    "description" TEXT,
    "example" TEXT,
    "importance" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ColumnMetadata_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TableMetadata" ADD CONSTRAINT "TableMetadata_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColumnMetadata" ADD CONSTRAINT "ColumnMetadata_tableMetadataId_fkey" FOREIGN KEY ("tableMetadataId") REFERENCES "TableMetadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;
