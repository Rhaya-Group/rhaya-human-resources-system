import express from "express";
import { getApplicant, listApplicants } from "../controllers/hrApplicant.controller.js";

const router = express.Router();

router.get("/", listApplicants);
router.get("/:id", getApplicant);

export default router;
