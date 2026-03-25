import express from "express";
import {
  createDGSet,
  getDGSets,
  getDGSetById,
  updateDGSet,
  deleteDGSet,
} from "../controllers/dgSetController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { uploadDocuments } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router
  .route("/")
  .post(protect, uploadDocuments, createDGSet)
  .get(protect, getDGSets);

router
  .route("/:id")
  .get(protect, getDGSetById)
  .put(protect, uploadDocuments, updateDGSet)
  .delete(protect, deleteDGSet);

export default router;
