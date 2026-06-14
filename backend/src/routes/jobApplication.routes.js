// backend/src/routes/jobApplication.routes.js
// HR pipeline management. Mounted with authenticate + authorizeHR in index.js.
import express from "express";
import {
  listForHr, getForHr, updateStage, addNote,
} from "../controllers/jobApplication.controller.js";

const router = express.Router();

router.get("/", listForHr);            // ?postingId=...&stage=...
router.get("/:id", getForHr);
router.patch("/:id/stage", updateStage);
router.post("/:id/notes", addNote);

export default router;
