import express from "express";
import {
  createACAuditRecord,
  getACAuditRecords,
  getACAuditRecordById,
  updateACAuditRecord,
  deleteACAuditRecord,
} from "../controllers/acAuditRecordController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { uploadDocuments } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router
  .route("/")
  .post(protect, uploadDocuments, createACAuditRecord)
  .get(protect, getACAuditRecords);

router
  .route("/:id")
  .get(protect, getACAuditRecordById)
  .put(protect, uploadDocuments, updateACAuditRecord)
  .delete(protect, deleteACAuditRecord);

export default router;
