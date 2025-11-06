-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM('online', 'idle', 'dnd', 'invisible');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'online';
