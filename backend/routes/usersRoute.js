import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
  loginUser,
  registerUser,
  getUserProfile,
  userLogout,
  getAuditors,
  updateUser,
  deleteUser,
} from "../controllers/usersController.js";
import { authRateLimiter } from "../middlewares/rateLimitLoggerMiddleware.js";

const router = express.Router();

// 🔐 Auth
router.post("/register", authRateLimiter, registerUser);
router.post("/login", authRateLimiter, loginUser);
router.post("/logout", protect, userLogout);

// 👤 Profile
router.get("/profile", protect, getUserProfile);

// 👥 Users
router.get("/auditors", protect, getAuditors);

// ✏️ Edit + Delete (NEW)
router.route("/:id").put(protect, updateUser).delete(protect, deleteUser);

export default router;
