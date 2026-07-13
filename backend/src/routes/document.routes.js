// backend/src/routes/document.routes.js
import express from "express";
import {
  authenticate,
  authorizeAdmin,
  requireRole,
} from "../middleware/auth.js";
import { uploadDocument as multerUpload } from "../config/upload.js";
import {
  uploadDocument,
  getUserDocuments,
  getDocumentById,
  downloadDocument,
  updateDocument,
  deleteDocument,
} from "../controllers/document.controller.js";

const router = express.Router({ mergeParams: true });

// All routes require authentication
router.use(authenticate);

// Get all documents for a user with optional type filter
// GET /api/users/:userId/documents?type=PKWT
router.get("/", getUserDocuments);

// Get single document
router.get("/:documentId", getDocumentById);

// Download document (generates signed URL)
router.get("/:documentId/download", downloadDocument);

// Upload document — HR (any type/employee) or an employee self-uploading their
// own personal-ID documents (KTP/NPWP/BPJS/SIM/KK). Access enforced in the
// controller since it needs the parsed documentType from the multipart body.
router.post(
  "/upload",
  multerUpload.single("file"),
  uploadDocument,
);

// Update document metadata (admin only)
router.put("/:documentId", requireRole([1, 2]), updateDocument);

// Delete document (admin only)
router.delete("/:documentId", requireRole([1, 2]), deleteDocument);

export default router;
