import express from "express";
import {
  createTransformerAuditRecord,
  getTransformerAuditRecords,
  getTransformerAuditRecordById,
  updateTransformerAuditRecord,
  deleteTransformerAuditRecord,
} from "../controllers/transformerAuditRecordController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { uploadDocuments } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router
  .route("/")
  .post(protect, uploadDocuments, createTransformerAuditRecord)
  .get(protect, getTransformerAuditRecords);

router
  .route("/:id")
  .get(protect, getTransformerAuditRecordById)
  .put(protect, uploadDocuments, updateTransformerAuditRecord)
  .delete(protect, deleteTransformerAuditRecord);

export default router;
