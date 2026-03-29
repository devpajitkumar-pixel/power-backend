import express from "express";
import {
  createFanAuditRecord,
  getFanAuditRecords,
  getFanAuditRecordById,
  updateFanAuditRecord,
  deleteFanAuditRecord,
} from "../controllers/fanAuditRecordController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { uploadDocuments } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router
  .route("/")
  .post(protect, uploadDocuments, createFanAuditRecord)
  .get(protect, getFanAuditRecords);

router
  .route("/:id")
  .get(protect, getFanAuditRecordById)
  .put(protect, uploadDocuments, updateFanAuditRecord)
  .delete(protect, deleteFanAuditRecord);

export default router;
