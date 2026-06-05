CREATE TABLE "AdminNoticeReceipt" (
  "id" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "noticeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,

  CONSTRAINT "AdminNoticeReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminNoticeReceipt_noticeId_userId_key" ON "AdminNoticeReceipt"("noticeId", "userId");
CREATE INDEX "AdminNoticeReceipt_userId_dismissedAt_idx" ON "AdminNoticeReceipt"("userId", "dismissedAt");
CREATE INDEX "AdminNoticeReceipt_noticeId_idx" ON "AdminNoticeReceipt"("noticeId");
CREATE INDEX "AdminNoticeReceipt_readAt_idx" ON "AdminNoticeReceipt"("readAt");

ALTER TABLE "AdminNoticeReceipt"
ADD CONSTRAINT "AdminNoticeReceipt_noticeId_fkey"
FOREIGN KEY ("noticeId") REFERENCES "AdminNotice"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdminNoticeReceipt"
ADD CONSTRAINT "AdminNoticeReceipt_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
