import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
  createUtilityTariff,
  getUtilityTariffs,
  getUtilityTariffById,
  updateUtilityTariff,
  deleteUtilityTariff,
} from "../controllers/utilityTarrifController.js";
import { uploadDocuments } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router
  .route("/")
  .post(protect, uploadDocuments, createUtilityTariff)
  .get(protect, getUtilityTariffs);

router
  .route("/:id")
  .get(protect, getUtilityTariffById)
  .put(protect, uploadDocuments, updateUtilityTariff)
  .delete(protect, deleteUtilityTariff);

export default router;
