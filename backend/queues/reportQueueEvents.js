import { QueueEvents } from "bullmq";
import { redisConnection } from "../config/redis.js";
import { REPORT_QUEUE_NAME } from "./reportQueue.js";

export const reportQueueEvents = new QueueEvents(REPORT_QUEUE_NAME, {
  connection: redisConnection,
});

reportQueueEvents.on("completed", ({ jobId }) => {
  console.log(`Queue job completed: ${jobId}`);
});

reportQueueEvents.on("failed", ({ jobId, failedReason }) => {
  console.error(`Queue job failed: ${jobId} - ${failedReason}`);
});
