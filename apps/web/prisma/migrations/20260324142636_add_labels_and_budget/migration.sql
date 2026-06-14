-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "labels" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dailyBudgetHours" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN     "labelPalette" TEXT;
