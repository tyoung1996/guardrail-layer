-- AlterTable
ALTER TABLE "Connection" ADD COLUMN     "database" TEXT,
ADD COLUMN     "extras" JSONB,
ADD COLUMN     "host" TEXT,
ADD COLUMN     "password" TEXT,
ADD COLUMN     "port" INTEGER,
ADD COLUMN     "ssl" BOOLEAN,
ADD COLUMN     "username" TEXT;
