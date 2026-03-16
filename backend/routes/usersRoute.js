import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
  loginUser,
  registerUser,
  getUserProfile,
  userLogout,
} from "../controllers/usersController.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/profile", protect, getUserProfile);
router.post("/logout", protect, userLogout);

export default router;
