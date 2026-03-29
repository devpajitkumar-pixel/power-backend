import express from "express";
import {
  getDashboardStats,
  getDashboardRecentActivities,
  getDashboardUserAppearance,
  getDashboardOverview,
} from "../controllers/dashboardController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/overview", protect, getDashboardOverview);
router.get("/stats", protect, getDashboardStats);
router.get("/recent-activities", protect, getDashboardRecentActivities);
router.get("/user-appearance", protect, getDashboardUserAppearance);

export default router;
