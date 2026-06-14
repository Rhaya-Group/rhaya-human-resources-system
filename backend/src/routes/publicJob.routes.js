// backend/src/routes/publicJob.routes.js
// Public recruitment endpoints. Job browsing needs no auth; applying needs an applicant token.
import express from "express";
import { listPublic, getPublic } from "../controllers/jobPosting.controller.js";
import { apply } from "../controllers/jobApplication.controller.js";
import { applicantAuthenticate } from "../middleware/applicantAuth.js";

const router = express.Router();

router.get("/jobs", listPublic);
router.get("/jobs/:id", getPublic);
router.post("/jobs/:id/apply", applicantAuthenticate, apply);

export default router;
