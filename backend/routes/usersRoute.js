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

const router = express.Router();

// 🔐 Auth
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout", protect, userLogout);

// 👤 Profile
router.get("/profile", protect, getUserProfile);

// 👥 Users
router.get("/auditors", protect, getAuditors);

// ✏️ Edit + Delete (NEW)
router.route("/:id").put(protect, updateUser).delete(protect, deleteUser);

export default router;
