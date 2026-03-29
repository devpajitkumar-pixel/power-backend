import PresenceLog from "../modals/presenceLog.js";
import redisClient from "../lib/redisClient.js";
import User from "../modals/user.js";
import logger from "../config/logger.js";

const onlineUsers = new Map();

const buildSocketLogMeta = (socket, extra = {}) => {
  const userId = socket?.handshake?.auth?.userId || null;
  const forwardedFor = socket?.handshake?.headers?.["x-forwarded-for"];

  let ip = null;

  if (Array.isArray(forwardedFor)) {
    ip = forwardedFor[0];
  } else if (typeof forwardedFor === "string") {
    ip = forwardedFor.split(",")[0].trim();
  } else {
    ip = socket?.handshake?.address || null;
  }

  return {
    socketId: socket?.id || null,
    userId,
    ip,
    userAgent: socket?.handshake?.headers?.["user-agent"] || null,
    transport: socket?.conn?.transport?.name || null,
    ...extra,
  };
};

const setPresenceStatus = async ({ userId, status, ttl = null }) => {
  const key = `presence:${userId}`;

  if (ttl) {
    await redisClient.set(key, status, { EX: ttl });
  } else {
    await redisClient.set(key, status);
  }
};

const createPresenceLog = async ({ userId, status }) => {
  await PresenceLog.create({
    userId,
    status,
  });
};

const socketServer = (io) => {
  io.on("connection", async (socket) => {
    const userId = socket.handshake.auth.userId;

    if (!userId) {
      logger.logSecurity({
        message: "Socket connection rejected: missing userId",
        type: "socket_auth_invalid",
        ip:
          socket.handshake.headers["x-forwarded-for"] ||
          socket.handshake.address ||
          null,
        meta: {
          socketId: socket.id,
          userAgent: socket.handshake.headers["user-agent"] || null,
        },
      });

      socket.disconnect();
      return;
    }

    try {
      logger.info(
        "Socket user connected",
        buildSocketLogMeta(socket, { event: "connection" }),
      );

      onlineUsers.set(userId, socket.id);

      await setPresenceStatus({
        userId,
        status: "online",
        ttl: 30,
      });

      await createPresenceLog({
        userId,
        status: "online",
      });

      io.emit("user-online", { userId });

      logger.info(
        "User marked online",
        buildSocketLogMeta(socket, { status: "online" }),
      );

      const users = await User.find({}, "_id").lean();

      const entries = await Promise.all(
        users.map(async (user) => {
          const id = user._id.toString();
          const status = (await redisClient.get(`presence:${id}`)) || "offline";

          return [id, status];
        }),
      );

      socket.emit("presence-snapshot", Object.fromEntries(entries));

      logger.info(
        "Presence snapshot sent",
        buildSocketLogMeta(socket, {
          usersCount: users.length,
          event: "presence-snapshot",
        }),
      );
    } catch (error) {
      logger.error(
        "Failed during socket connection setup",
        buildSocketLogMeta(socket, {
          error: error?.message,
          stack: error?.stack,
        }),
      );
    }

    socket.on("heartbeat", async () => {
      try {
        const currentStatus = await redisClient.get(`presence:${userId}`);

        const statusToKeep =
          currentStatus === "away" || currentStatus === "online"
            ? currentStatus
            : "online";

        await setPresenceStatus({
          userId,
          status: statusToKeep,
          ttl: 30,
        });

        logger.info(
          "Heartbeat received",
          buildSocketLogMeta(socket, {
            event: "heartbeat",
            status: statusToKeep,
          }),
        );
      } catch (error) {
        logger.error(
          "Heartbeat handling failed",
          buildSocketLogMeta(socket, {
            event: "heartbeat",
            error: error?.message,
            stack: error?.stack,
          }),
        );
      }
    });

    socket.on("user-online", async () => {
      try {
        await setPresenceStatus({
          userId,
          status: "online",
          ttl: 30,
        });

        await createPresenceLog({
          userId,
          status: "online",
        });

        io.emit("user-online", { userId });

        logger.info(
          "User status changed to online",
          buildSocketLogMeta(socket, {
            event: "user-online",
            status: "online",
          }),
        );
      } catch (error) {
        logger.error(
          "Failed to set user online",
          buildSocketLogMeta(socket, {
            event: "user-online",
            error: error?.message,
            stack: error?.stack,
          }),
        );
      }
    });

    socket.on("user-away", async () => {
      try {
        await setPresenceStatus({
          userId,
          status: "away",
          ttl: 30,
        });

        await createPresenceLog({
          userId,
          status: "away",
        });

        io.emit("user-away", { userId });

        logger.info(
          "User status changed to away",
          buildSocketLogMeta(socket, {
            event: "user-away",
            status: "away",
          }),
        );
      } catch (error) {
        logger.error(
          "Failed to set user away",
          buildSocketLogMeta(socket, {
            event: "user-away",
            error: error?.message,
            stack: error?.stack,
          }),
        );
      }
    });

    socket.on("user-offline", async () => {
      try {
        onlineUsers.delete(userId);

        await setPresenceStatus({
          userId,
          status: "offline",
        });

        await createPresenceLog({
          userId,
          status: "offline",
        });

        io.emit("user-offline", { userId });

        logger.info(
          "User status changed to offline",
          buildSocketLogMeta(socket, {
            event: "user-offline",
            status: "offline",
          }),
        );
      } catch (error) {
        logger.error(
          "Failed to set user offline",
          buildSocketLogMeta(socket, {
            event: "user-offline",
            error: error?.message,
            stack: error?.stack,
          }),
        );
      }
    });

    socket.on("disconnect", async (reason) => {
      try {
        onlineUsers.delete(userId);

        await setPresenceStatus({
          userId,
          status: "offline",
        });

        await createPresenceLog({
          userId,
          status: "offline",
        });

        io.emit("user-offline", { userId });

        logger.info(
          "Socket disconnected and user marked offline",
          buildSocketLogMeta(socket, {
            event: "disconnect",
            status: "offline",
            reason,
          }),
        );
      } catch (error) {
        logger.error(
          "Disconnect handling failed",
          buildSocketLogMeta(socket, {
            event: "disconnect",
            reason,
            error: error?.message,
            stack: error?.stack,
          }),
        );
      }
    });
  });
};

export default socketServer;
