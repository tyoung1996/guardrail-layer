-- CreateTable
CREATE TABLE "RoleRedaction" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "rules" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleRedaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRedaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "rules" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRedaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoleRedaction_roleId_connectionId_key" ON "RoleRedaction"("roleId", "connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRedaction_userId_connectionId_key" ON "UserRedaction"("userId", "connectionId");

-- AddForeignKey
ALTER TABLE "RoleRedaction" ADD CONSTRAINT "RoleRedaction_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleRedaction" ADD CONSTRAINT "RoleRedaction_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRedaction" ADD CONSTRAINT "UserRedaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRedaction" ADD CONSTRAINT "UserRedaction_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
