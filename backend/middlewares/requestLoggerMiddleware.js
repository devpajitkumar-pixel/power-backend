import logger from "../config/logger.js";
import buildLogMeta from "../utils/buildLogMeta.js";
import sanitizeLogData from "../utils/sanitizeLogData.js";

const SLOW_API_THRESHOLD_MS = 1000;

const requestLoggerMiddleware = (req, res, next) => {
  const startTime = req.requestStartTime || Date.now();

  const requestMeta = buildLogMeta(req, {
    userAgent: req.get("user-agent"),
  });

  if (process.env.NODE_ENV !== "production") {
    requestMeta.query = sanitizeLogData(req.query || {});
    requestMeta.params = sanitizeLogData(req.params || {});
    requestMeta.body = sanitizeLogData(req.body || {});
  }

  logger.info("Incoming request", requestMeta);

  res.on("finish", () => {
    const durationMs = Date.now() - startTime;

    const completionMeta = buildLogMeta(req, {
      statusCode: res.statusCode,
      durationMs,
      contentLength: res.getHeader("content-length") || null,
    });

    const level =
      res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

    logger.log(level, "Request completed", completionMeta);

    if (durationMs > SLOW_API_THRESHOLD_MS) {
      logger.warn("Slow API detected", {
        ...completionMeta,
        slowApi: true,
        thresholdMs: SLOW_API_THRESHOLD_MS,
        logCategory: "slow-api",
      });
    }
  });

  next();
};

export default requestLoggerMiddleware;
