import PresenceLog from "../modals/presenceLog.js";
import redisClient from "../config/redis.js";
import User from "../modals/user.js";

const onlineUsers = new Map();

const socketServer = (io) => {
  io.on("connection", async (socket) => {
    const userId = socket.handshake.auth.userId;

    if (!userId) {
      socket.disconnect();
      return;
    }

    console.log("User connected:", userId);

    onlineUsers.set(userId, socket.id);

    await redisClient.set(`presence:${userId}`, "online", { EX: 30 });

    await PresenceLog.create({
      userId,
      status: "online",
    });

    io.emit("user-online", { userId });

    try {
      const users = await User.find({}, "_id");
      const entries = await Promise.all(
        users.map(async (user) => {
          const status =
            (await redisClient.get(`presence:${user._id.toString()}`)) ||
            "offline";

          return [user._id.toString(), status];
        }),
      );

      socket.emit("presence-snapshot", Object.fromEntries(entries));
    } catch (error) {
      console.error("Error sending presence snapshot:", error);
    }

    socket.on("heartbeat", async () => {
      const currentStatus = await redisClient.get(`presence:${userId}`);

      const statusToKeep =
        currentStatus === "away" || currentStatus === "online"
          ? currentStatus
          : "online";

      await redisClient.set(`presence:${userId}`, statusToKeep, { EX: 30 });
    });

    socket.on("user-online", async () => {
      await redisClient.set(`presence:${userId}`, "online", { EX: 30 });

      await PresenceLog.create({
        userId,
        status: "online",
      });

      io.emit("user-online", { userId });
    });

    socket.on("user-away", async () => {
      await redisClient.set(`presence:${userId}`, "away", { EX: 30 });

      await PresenceLog.create({
        userId,
        status: "away",
      });

      io.emit("user-away", { userId });
    });

    socket.on("user-offline", async () => {
      await redisClient.set(`presence:${userId}`, "offline");

      await PresenceLog.create({
        userId,
        status: "offline",
      });

      io.emit("user-offline", { userId });
    });

    // socket.on("disconnect", async () => {
    //   console.log("User disconnected:", userId);

    //   onlineUsers.delete(userId);

    //   await redisClient.set(`presence:${userId}`, "offline");

    //   await PresenceLog.create({
    //     userId,
    //     status: "offline",
    //   });

    //   io.emit("user-offline", { userId });
    // });
    socket.on("user-offline", async () => {
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
