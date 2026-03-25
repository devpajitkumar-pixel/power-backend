import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
  createFacility,
  getFacilities,
  getFacilityById,
  updateFacility,
  deleteFacility,
} from "../controllers/facilityController.js";
import { uploadDocuments } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router
  .route("/")
  .post(protect, uploadDocuments, createFacility)
  .get(protect, getFacilities);

router
  .route("/:id")
  .get(protect, getFacilityById)
  .put(protect, uploadDocuments, updateFacility)
  .delete(protect, deleteFacility);

export default router;
