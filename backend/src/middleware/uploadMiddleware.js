import multer from "multer";

const ALLOWED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "application/x-zip-compressed",
];

const storage = multer.memoryStorage();

export const uploadSingle = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME.includes(file.mimetype)) cb(null, true);
    else cb(Object.assign(new Error("Only PDF, DOCX, ZIP allowed"), { status: 415 }));
  },
}).single("file");
