/*
  Warnings:

  - A unique constraint covering the columns `[connectionId,tableName]` on the table `TableMetadata` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "TableMetadata_connectionId_tableName_key" ON "TableMetadata"("connectionId", "tableName");
