-- CreateEnum
CREATE TYPE "AuthEventType" AS ENUM ('LOGIN_SUCCESS', 'LOGIN_FAIL', 'LOGOUT');

-- CreateEnum
CREATE TYPE "AuthFailReason" AS ENUM ('BAD_PASSWORD', 'UNKNOWN_EMAIL', 'DISABLED', 'NOT_ACTIVE', 'NO_PASSWORD', 'MULTI_COMPANY_CHALLENGE', 'CHALLENGE_INVALID');

-- CreateTable
CREATE TABLE "AuthEvent" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" INTEGER,
    "actorId" INTEGER,
    "actorType" "ActorType",
    "actorName" TEXT,
    "type" "AuthEventType" NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "emailHash" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "reason" "AuthFailReason",
    "meta" JSONB,

    CONSTRAINT "AuthEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuthEvent_createdAt_idx" ON "AuthEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AuthEvent_companyId_createdAt_idx" ON "AuthEvent"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "AuthEvent_emailHash_windowStart_idx" ON "AuthEvent"("emailHash", "windowStart");

-- CreateIndex
CREATE INDEX "AuthEvent_ipHash_windowStart_idx" ON "AuthEvent"("ipHash", "windowStart");

-- CreateIndex
CREATE INDEX "AuthEvent_type_windowStart_idx" ON "AuthEvent"("type", "windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "AuthEvent_type_companyId_emailHash_ipHash_windowStart_reaso_key" ON "AuthEvent"("type", "companyId", "emailHash", "ipHash", "windowStart", "reason");

-- AddForeignKey
ALTER TABLE "AuthEvent" ADD CONSTRAINT "AuthEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
