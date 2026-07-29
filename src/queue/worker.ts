import { Worker } from "bullmq";
import { prisma } from "../db/prisma.js";
import { logger } from "../logging/logger.js";
import { dispatchNotification } from "../providers/dispatch.js";
import { auditLog } from "../logging/audit.js";
import { redisConnection } from "./connection.js";
import { NOTIFICATION_QUEUE_NAME, type NotificationJobData } from "./notificationQueue.js";

export const notificationWorker = new Worker<NotificationJobData>(
  NOTIFICATION_QUEUE_NAME,
  async (job) => {
    const notification = await prisma.notification.findUniqueOrThrow({
      where: { id: job.data.notificationId },
    });

    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: "SENDING", attempts: { increment: 1 } },
    });

    try {
      const result = await dispatchNotification(
        notification.channel,
        notification.recipient,
        notification.payload
      );

      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: "SENT", providerUsed: result.providerUsed, lastError: null },
      });

      auditLog({
        eventType: "SEND_RESULT",
        notificationId: notification.id,
        detail: { outcome: "sent", providerMessageId: result.providerMessageId },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";

      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: "FAILED", lastError: message },
      });

      auditLog({
        eventType: "SEND_RESULT",
        notificationId: notification.id,
        detail: { outcome: "failed", error: message, attempt: job.attemptsMade + 1 },
      });

      throw err;
    }
  },
  { connection: redisConnection }
);

notificationWorker.on("failed", async (job, err) => {
  if (!job) return;

  const isFinalAttempt = job.attemptsMade >= (job.opts.attempts ?? 1);
  if (!isFinalAttempt) return;

  await prisma.notification.update({
    where: { id: job.data.notificationId },
    data: { status: "FAILED_PERMANENT" },
  });

  auditLog({
    eventType: "SEND_RESULT",
    notificationId: job.data.notificationId,
    detail: { outcome: "failed_permanent", error: err.message },
  });

  logger.error({ notificationId: job.data.notificationId, err }, "Notification permanently failed");
});
