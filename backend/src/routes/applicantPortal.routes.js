// backend/src/routes/applicantPortal.routes.js
// Candidate's own application tracking. Mounted with applicantAuthenticate in index.js.
import express from "express";
import { listMine, withdraw } from "../controllers/jobApplication.controller.js";

const router = express.Router();

router.get("/applications", listMine);
router.delete("/applications/:id", withdraw);

export default router;
