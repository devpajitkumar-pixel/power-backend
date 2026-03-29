import fs from "fs";
import path from "path";
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logsDir = path.join(__dirname, "..", "logs");

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const isProduction = process.env.NODE_ENV === "production";

const sensitiveKeys = [
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "authorization",
  "cookie",
  "set-cookie",
  "jwt",
  "otp",
  "secret",
  "client_secret",
];

const deepSanitize = (value) => {
  if (Array.isArray(value)) {
    return value.map(deepSanitize);
  }

  if (value && typeof value === "object") {
    const clone = {};

    for (const key of Object.keys(value)) {
      if (sensitiveKeys.includes(String(key).toLowerCase())) {
        clone[key] = "[REDACTED]";
      } else {
        clone[key] = deepSanitize(value[key]);
      }
    }

    return clone;
  }

  return value;
};

const redactSensitive = winston.format((info) => deepSanitize(info));

const addDefaultMeta = winston.format((info) => {
  info.service = "power-audit-api";
  info.env = process.env.NODE_ENV || "development";
  return info;
});

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  addDefaultMeta(),
  redactSensitive(),
  winston.format.json(),
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  addDefaultMeta(),
  redactSensitive(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaString = Object.keys(meta).length
      ? ` ${JSON.stringify(meta)}`
      : "";
    return `${timestamp} [${level}] ${message}${metaString}`;
  }),
);

const createRotateTransport = ({
  filename,
  level,
  maxSize = "20m",
  maxFiles = "14d",
}) =>
  new DailyRotateFile({
    dirname: logsDir,
    filename,
    datePattern: "YYYY-MM-DD",
    zippedArchive: true,
    maxSize,
    maxFiles,
    level,
    format: jsonFormat,
  });

const logger = winston.createLogger({
  level: isProduction ? "info" : "debug",
  levels: winston.config.npm.levels,
  format: jsonFormat,
  exitOnError: false,
  transports: [
    createRotateTransport({
      filename: "application-%DATE%.log",
      level: "info",
      maxSize: "20m",
      maxFiles: "14d",
    }),
    createRotateTransport({
      filename: "error-%DATE%.log",
      level: "error",
      maxSize: "20m",
      maxFiles: "30d",
    }),
    createRotateTransport({
      filename: "slow-api-%DATE%.log",
      level: "warn",
      maxSize: "20m",
      maxFiles: "14d",
    }),
    createRotateTransport({
      filename: "security-%DATE%.log",
      level: "warn",
      maxSize: "20m",
      maxFiles: "30d",
    }),
  ],
  exceptionHandlers: [
    createRotateTransport({
      filename: "exceptions-%DATE%.log",
      level: "error",
      maxSize: "20m",
      maxFiles: "30d",
    }),
  ],
  rejectionHandlers: [
    createRotateTransport({
      filename: "rejections-%DATE%.log",
      level: "error",
      maxSize: "20m",
      maxFiles: "30d",
    }),
  ],
});

if (!isProduction) {
  logger.add(
    new winston.transports.Console({
      level: "debug",
      format: consoleFormat,
      handleExceptions: true,
    }),
  );
}

export default logger;
