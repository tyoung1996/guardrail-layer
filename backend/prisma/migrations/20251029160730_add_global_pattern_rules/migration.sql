-- CreateTable
CREATE TABLE "GlobalPatternRule" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT,
    "name" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "replacement" TEXT DEFAULT '***REDACTED***',
    "role" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalPatternRule_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "GlobalPatternRule" ADD CONSTRAINT "GlobalPatternRule_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
