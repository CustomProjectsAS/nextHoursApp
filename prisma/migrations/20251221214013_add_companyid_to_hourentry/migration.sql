-- AlterTable
ALTER TABLE "HourEntry" ADD COLUMN     "companyId" INTEGER;

-- CreateIndex
CREATE INDEX "HourEntry_companyId_workDate_idx" ON "HourEntry"("companyId", "workDate");

-- CreateIndex
CREATE INDEX "HourEntry_companyId_employeeId_workDate_idx" ON "HourEntry"("companyId", "employeeId", "workDate");

-- AddForeignKey
ALTER TABLE "HourEntry" ADD CONSTRAINT "HourEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
