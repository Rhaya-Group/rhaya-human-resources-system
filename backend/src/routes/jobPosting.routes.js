// backend/src/routes/jobPosting.routes.js
// HR job-posting CRUD. Mounted with authenticate + authorizeHR in index.js.
import express from "express";
import {
  listJobs, getJob, createJob, updateJob, deleteJob,
} from "../controllers/jobPosting.controller.js";

const router = express.Router();

router.get("/", listJobs);
router.post("/", createJob);
router.get("/:id", getJob);
router.put("/:id", updateJob);
router.delete("/:id", deleteJob);

export default router;
