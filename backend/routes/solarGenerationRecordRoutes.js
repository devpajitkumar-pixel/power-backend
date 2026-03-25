import express from "express";
import {
  createSolarGenerationRecord,
  getSolarGenerationRecords,
  getSolarGenerationRecordById,
  updateSolarGenerationRecord,
  deleteSolarGenerationRecord,
} from "../controllers/solarGenerationRecordController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { uploadDocuments } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router
  .route("/")
  .post(protect, uploadDocuments, createSolarGenerationRecord)
  .get(protect, getSolarGenerationRecords);

router
  .route("/:id")
  .get(protect, getSolarGenerationRecordById)
  .put(protect, uploadDocuments, updateSolarGenerationRecord)
  .delete(protect, deleteSolarGenerationRecord);

export default router;
