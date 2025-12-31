/*
  Warnings:

  - Made the column `companyId` on table `HourEntry` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "HourEntry" DROP CONSTRAINT "HourEntry_companyId_fkey";

-- AlterTable
ALTER TABLE "HourEntry" ALTER COLUMN "companyId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "HourEntry" ADD CONSTRAINT "HourEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
