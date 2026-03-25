import express from "express";
import {
  createLuxMeasurement,
  getLuxMeasurements,
  getLuxMeasurementById,
  updateLuxMeasurement,
  deleteLuxMeasurement,
} from "../controllers/luxMeasurementController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { uploadDocuments } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router
  .route("/")
  .post(protect, uploadDocuments, createLuxMeasurement)
  .get(protect, getLuxMeasurements);

router
  .route("/:id")
  .get(protect, getLuxMeasurementById)
  .put(protect, uploadDocuments, updateLuxMeasurement)
  .delete(protect, deleteLuxMeasurement);

export default router;
