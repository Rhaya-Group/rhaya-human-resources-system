import express from "express";
import {
  listMyDocuments,
  submitDocument,
  viewMyDocument,
} from "../controllers/recruitmentDocument.controller.js";
import { uploadSingle } from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.get("/", listMyDocuments);
router.post("/", uploadSingle, submitDocument);
router.get("/:id/view", viewMyDocument);

export default router;
