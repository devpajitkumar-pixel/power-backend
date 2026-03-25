import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";

import http from "http";
import { Server } from "socket.io";

import connectDB from "./config/db.js";
import { notFound, errorHandler } from "./middlewares/errorHandler.js";

import usersRoute from "./routes/usersRoute.js";
import facilityRoute from "./routes/facilityRoute.js";
import utilityRoutes from "./routes/utilityRoutes.js";
import utilityTarrifRoutes from "./routes/utilityTarrifRoutes.js";
import utilityBillingRecordRoutes from "./routes/utilityBillingRecordRoutes.js";
import solarPlantRoutes from "./routes/solarPlantRoutes.js";
import dgSetRoutes from "./routes/dgSetRoutes.js";
import transformerRoutes from "./routes/transformerRoutes.js";
import pumpRoutes from "./routes/pumpRoutes.js";
import hvacAuditRoutes from "./routes/hvacAuditRoutes.js";
import lightingAuditRoutes from "./routes/lightingAuditRoutes.js";
import luxMeasurementRoutes from "./routes/luxMeasurementRoutes.js";
import miscLoadAuditRoutes from "./routes/miscLoadAuditRoutes.js";
import solarGenerationRecordRoutes from "./routes/solarGenerationRecordRoutes.js";
import dgAuditRecordRoutes from "./routes/dgAuditRecordRoutes.js";
import transformerAuditRecordRoutes from "./routes/transformerAuditRecordRoutes.js";
import pumpAuditRecordRoutes from "./routes/pumpAuditRecordRoutes.js";

import adminRoutes from "./routes/adminRoutes.js";
import emailRoutes from "./routes/emailRoutes.js";

import socketServer from "./socket/socketServer.js";

dotenv.config();

connectDB();

const app = express();

/* ---------------- MIDDLEWARE ---------------- */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://power-frontend-production.up.railway.app",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-csrf-token"],
  }),
);

app.options(/.*/, cors());

/* ---------------- ROUTES ---------------- */

app.get("/", (req, res) => {
  res.send("Welcome to Power DB Server.");
});

app.use("/api/v1/email", emailRoutes);

app.use("/api/v1/users", usersRoute);
app.use("/api/v1/facilities", facilityRoute);
app.use("/api/v1/utilities", utilityRoutes);
app.use("/api/v1/utility-tariffs", utilityTarrifRoutes);
app.use("/api/v1/utility-billing-records", utilityBillingRecordRoutes);
app.use("/api/v1/solar-plants", solarPlantRoutes);
app.use("/api/v1/dg-sets", dgSetRoutes);
app.use("/api/v1/transformers", transformerRoutes);
app.use("/api/v1/pumps", pumpRoutes);
app.use("/api/v1/hvac-audits", hvacAuditRoutes);
app.use("/api/v1/lighting-audits", lightingAuditRoutes);
app.use("/api/v1/lux-measurements", luxMeasurementRoutes);
app.use("/api/v1/misc-load-audits", miscLoadAuditRoutes);
app.use("/api/v1/solar-generation-records", solarGenerationRecordRoutes);
app.use("/api/v1/dg-audit-records", dgAuditRecordRoutes);
app.use("/api/v1/transformer-audit-records", transformerAuditRecordRoutes);
app.use("/api/v1/pump-audit-records", pumpAuditRecordRoutes);

app.use("/api/v1/admin/users", adminRoutes);

/* ---------------- ERROR HANDLER ---------------- */

app.use(notFound);
app.use(errorHandler);

/* ---------------- SOCKET SERVER ---------------- */

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://power-frontend-production.up.railway.app",
    ],
    credentials: true,
  },
});

/* Initialize Socket Logic */

socketServer(io);

/* ---------------- START SERVER ---------------- */

const PORT = process.env.PORT || 5000;
const MODE = process.env.NODE_ENV;

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} in ${MODE} mode`);
});
