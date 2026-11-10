-- AlterTable
ALTER TABLE "User" ADD COLUMN     "calendarSyncedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CachedCalendarEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "calendarName" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "description" TEXT,
    "location" TEXT,
    "meetLink" TEXT,

    CONSTRAINT "CachedCalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CachedCalendarEvent_userId_start_idx" ON "CachedCalendarEvent"("userId", "start");

-- AddForeignKey
ALTER TABLE "CachedCalendarEvent" ADD CONSTRAINT "CachedCalendarEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
