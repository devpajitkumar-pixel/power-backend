import { uploadBufferToCloudinary } from "../../utils/cloudinaryUploadStream.js";

const throwError = (message, statusCode = 500) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

const createUploadFile = (generatedFile) => ({
  originalname: generatedFile.fileName,
  mimetype: generatedFile.mimeType,
  buffer: generatedFile.buffer,
});

const mapCloudinaryFile = (result, fallbackFileName, fileType) => ({
  fileUrl: result?.secure_url || "",
  fileName: fallbackFileName,
  fileType,
  publicId: result?.public_id || "",
  uploadedAt: new Date(),
});

export const uploadReportFiles = async ({ report, generatedFiles }) => {
  if (!report) throwError("report is required in uploadReportFiles");
  if (!generatedFiles) {
    throwError("generatedFiles is required in uploadReportFiles");
  }

  const uploads = {};

  if (generatedFiles.excel?.buffer) {
    const excelUpload = await uploadBufferToCloudinary(
      createUploadFile(generatedFiles.excel),
      "reports/excel",
      "raw",
    );
    uploads.excel_file = mapCloudinaryFile(
      excelUpload,
      generatedFiles.excel.fileName,
      "xlsx",
    );
  }

  if (generatedFiles.pdf?.buffer) {
    const pdfUpload = await uploadBufferToCloudinary(
      createUploadFile(generatedFiles.pdf),
      "reports/pdf",
      "raw",
    );
    uploads.pdf_file = mapCloudinaryFile(
      pdfUpload,
      generatedFiles.pdf.fileName,
      "pdf",
    );
  }

  return uploads;
};

export default uploadReportFiles;
