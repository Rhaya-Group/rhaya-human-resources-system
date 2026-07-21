// backend/src/routes/applicantPortal.routes.js
// Candidate's own application tracking. Mounted with applicantAuthenticate in index.js.
import express from "express";
import { listMine, withdraw } from "../controllers/jobApplication.controller.js";
import {
  getProfile,
  updateProfile,
  listProfileQuestions,
  updateProfileAnswers,
} from "../controllers/applicantProfile.controller.js";

const router = express.Router();

router.get("/profile", getProfile);
router.put("/profile", updateProfile);
router.get("/profile-questions", listProfileQuestions);
router.put("/profile-answers", updateProfileAnswers);
router.get("/applications", listMine);
router.delete("/applications/:id", withdraw);

export default router;
