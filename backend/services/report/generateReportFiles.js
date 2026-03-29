import { generateExcelReport } from "./excel/generateExcelReport.js";
import { generatePdfReport } from "./pdf/generatePdfReport.js";

const throwError = (message, statusCode = 500) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

const normalizeName = (value, fallback = "report") => {
  if (!value) return fallback;

  return (
    String(value)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || fallback
  );
};

export const generateReportFiles = async ({ report, reportData }) => {
  if (!report) throwError("report is required in generateReportFiles");
  if (!reportData) throwError("reportData is required in generateReportFiles");

  const baseName = `${normalizeName(reportData?.meta?.title, "report")}_${Date.now()}`;

  const [excelBuffer, pdfBuffer] = await Promise.all([
    generateExcelReport({ report, reportData }),
    generatePdfReport({ report, reportData }),
  ]);

  return {
    excel: {
      fileName: `${baseName}.xlsx`,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: excelBuffer,
    },
    pdf: {
      fileName: `${baseName}.pdf`,
      mimeType: "application/pdf",
      buffer: pdfBuffer,
    },
  };
};

export default generateReportFiles;
