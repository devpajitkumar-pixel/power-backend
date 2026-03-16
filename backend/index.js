import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";

import http from "http";
import { Server } from "socket.io";

import connectDB from "./config/db.js";
import { notFound, errorHandler } from "./middlewares/errorHandler.js";

import usersRoute from "./routes/usersRoute.js";
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
    origin: "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-csrf-token"],
  }),
);

/* ---------------- ROUTES ---------------- */

app.get("/", (req, res) => {
  res.send("Welcome to Power DB Server.");
});

app.use("/api/v1/email", emailRoutes);

app.use("/api/v1/users", usersRoute);

app.use("/api/v1/admin/users", adminRoutes);

/* ---------------- ERROR HANDLER ---------------- */

app.use(notFound);
app.use(errorHandler);

/* ---------------- SOCKET SERVER ---------------- */

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
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
