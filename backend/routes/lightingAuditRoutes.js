import express from "express";
import {
  createLightingAuditRecord,
  getLightingAuditRecords,
  getLightingAuditRecordById,
  updateLightingAuditRecord,
  deleteLightingAuditRecord,
} from "../controllers/lightingAuditController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { uploadDocuments } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router
  .route("/")
  .post(protect, uploadDocuments, createLightingAuditRecord)
  .get(protect, getLightingAuditRecords);

router
  .route("/:id")
  .get(protect, getLightingAuditRecordById)
  .put(protect, uploadDocuments, updateLightingAuditRecord)
  .delete(protect, deleteLightingAuditRecord);

export default router;
