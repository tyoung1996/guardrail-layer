/*
  Warnings:

  - A unique constraint covering the columns `[tableMetadataId,columnName]` on the table `ColumnMetadata` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."Connection" DROP CONSTRAINT "Connection_userId_fkey";

-- AlterTable
ALTER TABLE "Connection" ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ColumnMetadata_tableMetadataId_columnName_key" ON "ColumnMetadata"("tableMetadataId", "columnName");
