import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
  createUtilityBillingRecord,
  getUtilityBillingRecords,
  getUtilityBillingRecordById,
  updateUtilityBillingRecord,
  deleteUtilityBillingRecord,
} from "../controllers/utilityBillingRecordController.js";
import { uploadDocuments } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router
  .route("/")
  .post(protect, uploadDocuments, createUtilityBillingRecord)
  .get(protect, getUtilityBillingRecords);

router
  .route("/:id")
  .get(protect, getUtilityBillingRecordById)
  .put(protect, uploadDocuments, updateUtilityBillingRecord)
  .delete(protect, deleteUtilityBillingRecord);

export default router;
