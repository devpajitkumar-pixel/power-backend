import express from "express";
import {
  createDGAuditRecord,
  getDGAuditRecords,
  getDGAuditRecordById,
  updateDGAuditRecord,
  deleteDGAuditRecord,
} from "../controllers/dgAuditRecordController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { uploadDocuments } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router
  .route("/")
  .post(protect, uploadDocuments, createDGAuditRecord)
  .get(protect, getDGAuditRecords);

router
  .route("/:id")
  .get(protect, getDGAuditRecordById)
  .put(protect, uploadDocuments, updateDGAuditRecord)
  .delete(protect, deleteDGAuditRecord);

export default router;
