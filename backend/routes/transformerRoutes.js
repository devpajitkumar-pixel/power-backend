import express from "express";
import {
  createTransformer,
  getTransformers,
  getTransformerById,
  updateTransformer,
  deleteTransformer,
} from "../controllers/transformerController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { uploadDocuments } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router
  .route("/")
  .post(protect, uploadDocuments, createTransformer)
  .get(protect, getTransformers);

router
  .route("/:id")
  .get(protect, getTransformerById)
  .put(protect, uploadDocuments, updateTransformer)
  .delete(protect, deleteTransformer);

export default router;
