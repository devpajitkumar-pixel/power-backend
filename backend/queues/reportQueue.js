import { Queue } from "bullmq";
import { redisConnection } from "../config/redis.js";

export const REPORT_QUEUE_NAME = "report-generation";

export const reportQueue = new Queue(REPORT_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});
