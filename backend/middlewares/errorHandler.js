import logger from "../config/logger.js";
import buildLogMeta from "../utils/buildLogMeta.js";

const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);

  // 🔹 Log 404 as warn (not error)
  logger.warn(
    "Route not found",
    buildLogMeta(req, {
      statusCode: 404,
      path: req.originalUrl,
    }),
  );

  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  // 🔹 Mongoose ObjectId error
  if (err.name === "CastError" && err.kind === "ObjectId") {
    statusCode = 404;
    message = "Resource not found";
  }

  // 🔹 Decide log level based on status
  const level =
    statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";

  logger.log(level, "Request error", {
    ...buildLogMeta(req, {
      statusCode,
      errorName: err.name,
      errorMessage: err.message,
    }),

    // 🔥 Only include stack in non-production
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });

  res.status(statusCode).json({
    message,
    requestId: req.requestId || null,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
};

export { notFound, errorHandler };
