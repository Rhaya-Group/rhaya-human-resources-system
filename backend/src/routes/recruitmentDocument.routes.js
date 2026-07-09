import { Router } from "express";
import { issueDocument, listDocuments, deleteDocument } from "../controllers/recruitmentDocument.controller.js";
import { uploadSingle } from "../middleware/uploadMiddleware.js";

const router = Router();

// HR: manage documents
router.get("/", listDocuments);
router.post("/", uploadSingle, issueDocument);
router.delete("/:id", deleteDocument);

export default router;
