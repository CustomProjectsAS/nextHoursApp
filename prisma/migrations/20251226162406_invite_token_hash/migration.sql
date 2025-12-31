/*
  Warnings:

  - A unique constraint covering the columns `[inviteTokenHash]` on the table `Employee` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "inviteTokenHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Employee_inviteTokenHash_key" ON "Employee"("inviteTokenHash");
