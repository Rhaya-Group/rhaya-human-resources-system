// backend/src/controllers/document.controller.js
import prisma from "../config/database.js";
import { deleteFromR2 } from "../config/storage.js";

// Personal-ID document types an employee may self-upload (contracts stay HR-only)
const SELF_UPLOADABLE_TYPES = ["KTP", "NPWP", "BPJS_Kesehatan", "BPJS_TK", "SIM", "KK"];

// Contract document types that define the employee's current contract period.
// Uploading one of these syncs User.contractStartDate/contractEndDate so the
// contract-expiry widget/reminders reflect the latest renewal automatically —
// LoA/Internship are excluded since they don't represent an ongoing period.
const CONTRACT_PERIOD_TYPES = ["PKWT", "PKWTT", "Amendment"];

/**
 * Upload employee document
 * POST /api/users/:userId/documents/upload
 * HR (Level 1-2): any document type, any employee.
 * Employee: only their own personal-ID documents (KTP/NPWP/BPJS/SIM/KK).
 */
export const uploadDocument = async (req, res) => {
  try {
    const { userId } = req.params;
    const { documentType, documentNumber, startDate, endDate, notes } = req.body;
    const uploadedById = req.user.id;
    const isAdmin = req.user.accessLevel <= 2;
    const isSelf = req.user.id === userId;

    // Validate file
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Validate required fields
    if (!documentType) {
      return res.status(400).json({ error: "Document type is required" });
    }

    if (CONTRACT_PERIOD_TYPES.includes(documentType) && (!startDate || !endDate)) {
      return res.status(400).json({
        error: "Start date and end date are required for contract documents (PKWT/PKWTT/Amendment)",
      });
    }

    // Access control: HR can upload anything for anyone; employees can only
    // self-upload their own personal-ID documents.
    if (!isAdmin) {
      if (!isSelf) {
        return res.status(403).json({ error: "Access denied" });
      }
      if (!SELF_UPLOADABLE_TYPES.includes(documentType)) {
        return res.status(403).json({
          error: "You can only upload personal identification documents (KTP, NPWP, BPJS, SIM, KK)",
        });
      }
    }

    // Check if user exists
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userExists) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check for duplicate filename and add version if needed
    const baseFileName = req.file.originalname;
    const lastDotIndex = baseFileName.lastIndexOf(".");
    const fileNameWithoutExt =
      lastDotIndex > 0 ? baseFileName.substring(0, lastDotIndex) : baseFileName;
    const fileExt =
      lastDotIndex > 0 ? baseFileName.substring(lastDotIndex) : "";

    const existingDocs = await prisma.employeeDocument.findMany({
      where: {
        userId,
        documentType,
        fileName: {
          startsWith: fileNameWithoutExt,
        },
      },
      select: { fileName: true },
    });

    let finalFileName = baseFileName;
    if (existingDocs.length > 0) {
      // Check if exact match exists
      const exactMatch = existingDocs.find(
        (doc) => doc.fileName === baseFileName,
      );
      if (exactMatch) {
        // Add version number
        finalFileName = `${fileNameWithoutExt} (v${existingDocs.length + 1})${fileExt}`;
      }
    }

    // Upload to R2 using a custom key that preserves filename
    // Format: documents/{documentType}/{timestamp}_{finalFileName}
    const timestamp = Date.now();
    const sanitizedFilename = finalFileName.replace(/[^a-zA-Z0-9._()-]/g, "_");
    const r2Key = `documents/${documentType.toLowerCase()}/${timestamp}_${sanitizedFilename}`;

    // Import uploadToR2 from storage
    const { uploadToR2 } = await import("../config/storage.js");

    await uploadToR2(req.file.buffer, r2Key, req.file.mimetype, {
      employeeId: userId,
      documentType,
      originalFilename: finalFileName,
      uploadDate: new Date().toISOString(),
    });

    // Store the R2 key as fileUrl (we'll generate signed URLs on download)
    const fileUrl = r2Key;

    // Save to database
    const document = await prisma.employeeDocument.create({
      data: {
        userId,
        fileName: finalFileName,
        fileUrl,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        documentType,
        documentNumber: documentNumber || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        notes,
        uploadedById,
        status: "active",
      },
      include: {
        users_EmployeeDocument_uploadedByIdTousers: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    console.log(`Document uploaded: ${document.fileName} for user ${userId}`);

    // Sync the employee's contract period from this document — the newest
    // PKWT/PKWTT/Amendment upload is treated as the current contract, so a
    // renewal automatically clears the employee off the expiry widget
    // instead of relying on someone remembering to edit the date field.
    if (CONTRACT_PERIOD_TYPES.includes(documentType)) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          contractStartDate: new Date(startDate),
          contractEndDate: new Date(endDate),
        },
      });
      console.log(`Contract period synced for user ${userId}: ${startDate} -> ${endDate}`);
    }

    // Format response
    const formattedDocument = {
      ...document,
      uploadedBy: document.users_EmployeeDocument_uploadedByIdTousers,
    };

    return res.status(201).json({
      success: true,
      message: "Document uploaded successfully",
      data: formattedDocument,
    });
  } catch (error) {
    console.error("Upload document error:", error);
    return res.status(500).json({
      error: "Failed to upload document",
      message: error.message,
    });
  }
};

/**
 * Get all documents for a user with optional type filter
 * GET /api/users/:userId/documents?type=PKWT
 * Admin or user themselves
 */
export const getUserDocuments = async (req, res) => {
  try {
    const { userId } = req.params;
    const { type } = req.query;
    const requestingUserId = req.user.id;
    const isAdmin = req.user.accessLevel <= 2;

    // Check access: admin or user themselves
    if (!isAdmin && requestingUserId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const whereClause = { userId };
    if (type) {
      whereClause.documentType = type;
    }

    const documents = await prisma.employeeDocument.findMany({
      where: whereClause,
      include: {
        users_EmployeeDocument_uploadedByIdTousers: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { uploadedAt: "desc" },
    });

    // Map the response to use friendlier field names
    const formattedDocuments = documents.map((doc) => ({
      ...doc,
      uploadedBy: doc.users_EmployeeDocument_uploadedByIdTousers,
    }));

    return res.json({
      success: true,
      data: formattedDocuments,
    });
  } catch (error) {
    console.error("Get documents error:", error);
    return res.status(500).json({
      error: "Failed to fetch documents",
      message: error.message,
    });
  }
};

/**
 * Get single document details
 * GET /api/users/:userId/documents/:documentId
 * Admin or user themselves
 */
export const getDocumentById = async (req, res) => {
  try {
    const { userId, documentId } = req.params;
    const requestingUserId = req.user.id;
    const isAdmin = req.user.accessLevel <= 2;

    // Check access
    if (!isAdmin && requestingUserId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const document = await prisma.employeeDocument.findFirst({
      where: {
        id: documentId,
        userId,
      },
      include: {
        users_EmployeeDocument_uploadedByIdTousers: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Format response
    const formattedDocument = {
      ...document,
      uploadedBy: document.users_EmployeeDocument_uploadedByIdTousers,
    };

    return res.json({
      success: true,
      data: formattedDocument,
    });
  } catch (error) {
    console.error("Get document error:", error);
    return res.status(500).json({
      error: "Failed to fetch document",
      message: error.message,
    });
  }
};

/**
 * Download document (generates signed URL)
 * GET /api/users/:userId/documents/:documentId/download
 * Admin or user themselves
 */
export const downloadDocument = async (req, res) => {
  try {
    const { userId, documentId } = req.params;
    const requestingUserId = req.user.id;
    const isAdmin = req.user.accessLevel <= 2;

    // Check access
    if (!isAdmin && requestingUserId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const document = await prisma.employeeDocument.findFirst({
      where: {
        id: documentId,
        userId,
      },
    });

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Import getR2DownloadUrl from storage
    const { getR2DownloadUrl } = await import("../config/storage.js");

    // Generate signed download URL (expires in 1 hour)
    const downloadUrl = await getR2DownloadUrl(document.fileUrl, 3600);

    return res.json({
      success: true,
      data: {
        downloadUrl,
        fileName: document.fileName,
        expiresIn: 3600, // seconds
      },
    });
  } catch (error) {
    console.error("Download document error:", error);
    return res.status(500).json({
      error: "Failed to generate download link",
      message: error.message,
    });
  }
};

/**
 * Update document metadata
 * PUT /api/users/:userId/documents/:documentId
 * Admin only
 */
export const updateDocument = async (req, res) => {
  try {
    const { userId, documentId } = req.params;
    const { fileName, documentType, documentNumber, startDate, endDate, status, notes } =
      req.body;

    const document = await prisma.employeeDocument.findFirst({
      where: {
        id: documentId,
        userId,
      },
    });

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    const updated = await prisma.employeeDocument.update({
      where: { id: documentId },
      data: {
        ...(fileName && { fileName }),
        ...(documentType && { documentType }),
        ...(documentNumber !== undefined && { documentNumber: documentNumber || null }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(status && { status }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        users_EmployeeDocument_uploadedByIdTousers: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    console.log(`✅ Document updated: ${updated.id}`);

    // Format response
    const formattedUpdated = {
      ...updated,
      uploadedBy: updated.users_EmployeeDocument_uploadedByIdTousers,
    };

    return res.json({
      success: true,
      message: "Document updated successfully",
      data: formattedUpdated,
    });
  } catch (error) {
    console.error("Update document error:", error);
    return res.status(500).json({
      error: "Failed to update document",
      message: error.message,
    });
  }
};

/**
 * Delete document
 * DELETE /api/users/:userId/documents/:documentId
 * Admin only
 */
export const deleteDocument = async (req, res) => {
  try {
    const { userId, documentId } = req.params;

    const document = await prisma.employeeDocument.findFirst({
      where: {
        id: documentId,
        userId,
      },
    });

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Delete from R2 (fileUrl is the R2 key)
    await deleteFromR2(document.fileUrl);

    // Delete from database
    await prisma.employeeDocument.delete({
      where: { id: documentId },
    });

    console.log(`✅ Document deleted: ${document.fileName}`);

    return res.json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    console.error("Delete document error:", error);
    return res.status(500).json({
      error: "Failed to delete document",
      message: error.message,
    });
  }
};
