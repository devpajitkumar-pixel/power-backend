import express from "express";
import {
  createHVACAudit,
  getHVACAudits,
  getHVACAuditById,
  updateHVACAudit,
  deleteHVACAudit,
} from "../controllers/hvacAuditController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { uploadDocuments } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router
  .route("/")
  .post(protect, uploadDocuments, createHVACAudit)
  .get(protect, getHVACAudits);

router
  .route("/:id")
  .get(protect, getHVACAuditById)
  .put(protect, uploadDocuments, updateHVACAudit)
  .delete(protect, deleteHVACAudit);

export default router;
