import express from "express";
import {
  createPump,
  getPumps,
  getPumpById,
  updatePump,
  deletePump,
} from "../controllers/pumpController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { uploadDocuments } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router
  .route("/")
  .post(protect, uploadDocuments, createPump)
  .get(protect, getPumps);

router
  .route("/:id")
  .get(protect, getPumpById)
  .put(protect, uploadDocuments, updatePump)
  .delete(protect, deletePump);

export default router;
