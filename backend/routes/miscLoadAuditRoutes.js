import express from "express";
import {
  createMiscLoadAuditRecord,
  getMiscLoadAuditRecords,
  getMiscLoadAuditRecordById,
  updateMiscLoadAuditRecord,
  deleteMiscLoadAuditRecord,
} from "../controllers/miscLoadAuditController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { uploadDocuments } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router
  .route("/")
  .post(protect, uploadDocuments, createMiscLoadAuditRecord)
  .get(protect, getMiscLoadAuditRecords);

router
  .route("/:id")
  .get(protect, getMiscLoadAuditRecordById)
  .put(protect, uploadDocuments, updateMiscLoadAuditRecord)
  .delete(protect, deleteMiscLoadAuditRecord);

export default router;
