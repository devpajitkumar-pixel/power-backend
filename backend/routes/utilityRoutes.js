import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
  createUtilityAccount,
  getUtilityAccounts,
  getUtilityAccountById,
  updateUtilityAccount,
  deleteUtilityAccount,
} from "../controllers/utilityController.js";
import { uploadDocuments } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router
  .route("/")
  .post(protect, uploadDocuments, createUtilityAccount)
  .get(protect, getUtilityAccounts);

router
  .route("/:id")
  .get(protect, getUtilityAccountById)
  .put(protect, uploadDocuments, updateUtilityAccount)
  .delete(protect, deleteUtilityAccount);

export default router;
