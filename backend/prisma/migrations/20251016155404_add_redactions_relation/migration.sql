-- CreateTable
CREATE TABLE "RedactionRule" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "columnName" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "replacement" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RedactionRule_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RedactionRule" ADD CONSTRAINT "RedactionRule_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
