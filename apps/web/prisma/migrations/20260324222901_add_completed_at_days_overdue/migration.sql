-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "daysOverdue" INTEGER NOT NULL DEFAULT 0;
