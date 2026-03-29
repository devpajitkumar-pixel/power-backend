import express from "express";
import {
  createReport,
  generateReport,
  regenerateReport,
  getReports,
  getReportById,
  updateReport,
  deleteReport,
  downloadExcelReport,
} from "../controllers/reportController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.route("/").post(protect, createReport).get(protect, getReports);

router.post("/generate", protect, generateReport);
router.post("/:id/regenerate", protect, regenerateReport);
router.get("/:id/excel/download", protect, downloadExcelReport);

router
  .route("/:id")
  .get(protect, getReportById)
  .put(protect, updateReport)
  .delete(protect, deleteReport);

export default router;
