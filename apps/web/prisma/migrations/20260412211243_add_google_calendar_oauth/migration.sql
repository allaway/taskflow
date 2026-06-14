/*
  Warnings:

  - You are about to drop the column `calendarFeeds` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "calendarFeeds",
ADD COLUMN     "googleAccessToken" TEXT,
ADD COLUMN     "googleEmail" TEXT,
ADD COLUMN     "googleRefreshToken" TEXT,
ADD COLUMN     "googleTokenExpiry" TIMESTAMP(3);
