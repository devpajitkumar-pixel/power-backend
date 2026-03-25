import express from "express";
import {
  createSolarPlant,
  getSolarPlants,
  getSolarPlantById,
  updateSolarPlant,
  deleteSolarPlant,
} from "../controllers/solarPlantController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { uploadDocuments } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router
  .route("/")
  .post(protect, uploadDocuments, createSolarPlant)
  .get(protect, getSolarPlants);

router
  .route("/:id")
  .get(protect, getSolarPlantById)
  .put(protect, uploadDocuments, updateSolarPlant)
  .delete(protect, deleteSolarPlant);

export default router;
