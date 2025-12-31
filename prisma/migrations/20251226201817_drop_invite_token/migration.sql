/*
  Warnings:

  - You are about to drop the column `inviteToken` on the `Employee` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Employee_inviteToken_key";

-- AlterTable
ALTER TABLE "Employee" DROP COLUMN "inviteToken";
