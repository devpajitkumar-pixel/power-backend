import express from "express";
import { newLeads } from "../controllers/emailController.js";

const router = express.Router();
router.post("/leads", newLeads);

export default router;
