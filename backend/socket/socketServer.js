import PresenceLog from "../modals/presenceLog.js";
import redisClient from "../config/redis.js";

const onlineUsers = new Map();

const socketServer = (io) => {
  io.on("connection", async (socket) => {
    const userId = socket.handshake.auth.userId;

    console.log("User connected:", userId);

    onlineUsers.set(userId, socket.id);

    await redisClient.set(`presence:${userId}`, "online");

    await PresenceLog.create({
      userId,
      status: "online",
    });

    io.emit("user-online", { userId });

    socket.on("heartbeat", async () => {
      await redisClient.set(`presence:${userId}`, "online", {
        EX: 30,
      });
    });

    socket.on("user-away", async () => {
      await redisClient.set(`presence:${userId}`, "away");

      await PresenceLog.create({
        userId,
        status: "away",
      });

      io.emit("user-away", { userId });
    });

    socket.on("disconnect", async () => {
      console.log("User disconnected:", userId);

      onlineUsers.delete(userId);

      await redisClient.set(`presence:${userId}`, "offline");

      await PresenceLog.create({
        userId,
        status: "offline",
      });

      io.emit("user-offline", { userId });
    });
  });
};

export default socketServer;
