-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT,
    "action" TEXT NOT NULL,
    "tableName" TEXT,
    "columnName" TEXT,
    "query" TEXT,
    "redacted" BOOLEAN,
    "performedBy" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
