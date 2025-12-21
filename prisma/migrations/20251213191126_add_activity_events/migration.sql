-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('EMPLOYEE', 'ADMIN', 'OWNER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('HOUR_ENTRY', 'EMPLOYEE', 'PROJECT', 'COMPANY', 'AUTH');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('HOUR_CREATED', 'HOUR_EDITED', 'HOUR_SUBMITTED', 'HOUR_APPROVED', 'HOUR_REJECTED', 'HOUR_REOPENED', 'HOUR_SUPERSEDED', 'LOGIN', 'LOGOUT', 'EMPLOYEE_INVITED', 'EMPLOYEE_ACTIVATED', 'EMPLOYEE_DISABLED', 'PROJECT_CREATED', 'PROJECT_UPDATED', 'PROJECT_DISABLED');

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorType" "ActorType" NOT NULL,
    "actorId" INTEGER,
    "actorName" TEXT,
    "entityType" "EntityType" NOT NULL,
    "entityId" INTEGER,
    "eventType" "EventType" NOT NULL,
    "summary" TEXT,
    "meta" JSONB,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityEvent_companyId_createdAt_idx" ON "ActivityEvent"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_companyId_eventType_createdAt_idx" ON "ActivityEvent"("companyId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_companyId_actorType_actorId_createdAt_idx" ON "ActivityEvent"("companyId", "actorType", "actorId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_companyId_entityType_entityId_createdAt_idx" ON "ActivityEvent"("companyId", "entityType", "entityId", "createdAt");

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
