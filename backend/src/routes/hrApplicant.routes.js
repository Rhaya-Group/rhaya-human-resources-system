import express from "express";
import { getApplicant, listApplicants, viewApplicantCv } from "../controllers/hrApplicant.controller.js";

const router = express.Router();

router.get("/", listApplicants);
router.get("/:id/cv", viewApplicantCv);
router.get("/:id", getApplicant);

export default router;
