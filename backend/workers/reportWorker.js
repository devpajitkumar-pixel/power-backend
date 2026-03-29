import dotenv from "dotenv";
import { Worker } from "bullmq";
import connectDB from "../config/db.js";
import { redisConnection } from "../config/redis.js";
import logger from "../config/logger.js";
import buildWorkerLogMeta from "../utils/buildWorkerLogMeta.js";
import { processReportJob } from "../services/report/orchestrators/processReportJob.js";

dotenv.config();

const REPORT_QUEUE_NAME = "report-generation";

const startWorker = async () => {
  try {
    await connectDB();

    logger.info("Worker MongoDB connected", {
      service: "report-worker",
      queue: REPORT_QUEUE_NAME,
    });

    const worker = new Worker(
      REPORT_QUEUE_NAME,
      async (job) => {
        logger.info(
          "Worker picked report generation job",
          buildWorkerLogMeta(job),
        );

        try {
          const result = await processReportJob({ job });

          logger.info(
            "Report generation job processed successfully",
            buildWorkerLogMeta(job, {
              resultStatus: "success",
            }),
          );

          return result;
        } catch (error) {
          logger.error(
            "Report generation job processing failed",
            buildWorkerLogMeta(job, {
              error: error?.message,
              stack: error?.stack,
            }),
          );
          throw error;
        }
      },
      {
        connection: redisConnection,
        concurrency: 1,
      },
    );

    worker.on("ready", () => {
      logger.info("Worker ready", {
        service: "report-worker",
        queue: REPORT_QUEUE_NAME,
      });
    });

    worker.on("active", (job) => {
      logger.info(
        "Processing report generation job",
        buildWorkerLogMeta(job, { event: "active" }),
      );
    });

    worker.on("completed", (job, result) => {
      logger.info(
        "Report generation job completed",
        buildWorkerLogMeta(job, {
          event: "completed",
          result: result || null,
        }),
      );
    });

    worker.on("failed", (job, err) => {
      logger.error(
        "Report generation job failed",
        buildWorkerLogMeta(job, {
          event: "failed",
          error: err?.message,
          stack: err?.stack,
        }),
      );
    });

    worker.on("error", (err) => {
      logger.error("Worker error", {
        service: "report-worker",
        queue: REPORT_QUEUE_NAME,
        error: err?.message,
        stack: err?.stack,
      });
    });
  } catch (error) {
    logger.error("Failed to start worker", {
      service: "report-worker",
      queue: REPORT_QUEUE_NAME,
      error: error?.message,
      stack: error?.stack,
    });
    process.exit(1);
  }
};

startWorker();
