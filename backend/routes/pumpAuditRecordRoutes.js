import express from "express";
import {
  createPumpAuditRecord,
  getPumpAuditRecords,
  getPumpAuditRecordById,
  updatePumpAuditRecord,
  deletePumpAuditRecord,
} from "../controllers/pumpAuditRecordController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { uploadDocuments } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router
  .route("/")
  .post(protect, uploadDocuments, createPumpAuditRecord)
  .get(protect, getPumpAuditRecords);

router
  .route("/:id")
  .get(protect, getPumpAuditRecordById)
  .put(protect, uploadDocuments, updatePumpAuditRecord)
  .delete(protect, deletePumpAuditRecord);

export default router;
