import jwt from "jsonwebtoken";
import User from "../modals/user.js";
import logger from "../config/logger.js";
import buildLogMeta from "../utils/buildLogMeta.js";

// 🔐 Protect routes
const protect = async (req, res, next) => {
  const token = req.cookies.jwt;

  if (!token) {
    logger.warn("Authentication failed: token missing", buildLogMeta(req));

    res.status(401);
    throw new Error("Not authorized");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      logger.warn("Authentication failed: user not found", buildLogMeta(req));

      res.status(401);
      throw new Error("Not authorized");
    }

    req.user = user;

    // 🔹 keep this as debug (not info to avoid noise)
    logger.debug(
      "Authentication success",
      buildLogMeta(req, {
        authenticatedUserId: user._id,
      }),
    );

    next();
  } catch (err) {
    logger.warn(
      "Authentication failed: invalid token",
      buildLogMeta(req, {
        errorMessage: err.message,
      }),
    );

    res.status(401);
    throw new Error("Token failed");
  }
};

// 🔐 Admin check
const admin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    return next();
  }

  logger.warn(
    "Authorization failed: admin access denied",
    buildLogMeta(req, {
      userId: req.user?._id || null,
      role: req.user?.role || null,
    }),
  );

  res.status(403).json({ message: "Not authorized as an admin." });
};

export { protect, admin };
