import multer from "multer";

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed =
    file.mimetype.startsWith("image/") || file.mimetype === "application/pdf";

  if (allowed) cb(null, true);
  else cb(new Error("Only images and PDFs are allowed"), false);
};

export const uploadDocuments = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
}).array("documents", 10);
