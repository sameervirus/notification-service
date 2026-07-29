import { Queue } from "bullmq";
import { redisConnection } from "./connection.js";

export interface NotificationJobData {
  notificationId: string;
}

export const NOTIFICATION_QUEUE_NAME = "notifications";

export const notificationQueue = new Queue<NotificationJobData>(NOTIFICATION_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: { age: 60 * 60 * 24 * 7 },
    removeOnFail: false,
  },
});
