import PDFDocument from "pdfkit";

const toLabel = (key) =>
  String(key || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const formatValue = (value) => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === "object" ? JSON.stringify(item) : String(item),
      )
      .join(", ");
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const writeMeta = (doc, reportData) => {
  doc.fontSize(18).text(reportData?.meta?.title || "Report");
  doc.moveDown(0.5);
  doc
    .fontSize(11)
    .text(`Scope: ${formatValue(reportData?.meta?.report_scope)}`);
  doc.fontSize(11).text(`Type: ${formatValue(reportData?.meta?.report_type)}`);
  doc
    .fontSize(11)
    .text(
      `Generated: ${
        reportData?.meta?.generated_at
          ? new Date(reportData.meta.generated_at).toISOString()
          : new Date().toISOString()
      }`,
    );
};

const writeSummary = (doc, summary = {}) => {
  const entries = Object.entries(summary || {});
  if (!entries.length) return;

  doc.moveDown();
  doc.fontSize(13).text("Summary");
  doc.moveDown(0.3);

  entries.forEach(([key, value]) => {
    doc.fontSize(10).text(`${toLabel(key)}: ${formatValue(value)}`);
  });
};

const writeSection = (doc, title, items = []) => {
  if (!Array.isArray(items) || !items.length) return;

  doc.addPage();
  doc.fontSize(14).text(title);
  doc.moveDown(0.5);

  items.forEach((item, index) => {
    doc.fontSize(11).text(`${title} #${index + 1}`);
    doc.moveDown(0.2);

    const entries = Object.entries(item || {});

    entries.slice(0, 20).forEach(([key, value]) => {
      doc.fontSize(9).text(`- ${toLabel(key)}: ${formatValue(value)}`);
    });

    doc.moveDown(0.5);
  });
};

const toPdfBuffer = (doc) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });

export const generatePdfReport = async ({ reportData }) => {
  const doc = new PDFDocument({ margin: 40, size: "A4" });

  writeMeta(doc, reportData);
  writeSummary(doc, reportData?.summary || {});

  writeSection(doc, "Utility Accounts", reportData?.utility_accounts || []);
  writeSection(doc, "Tariffs", reportData?.tariffs || []);
  writeSection(doc, "Billing Records", reportData?.billing_records || []);
  writeSection(doc, "Solar Records", reportData?.solar_systems || []);
  writeSection(doc, "DG Records", reportData?.dg_sets || []);
  writeSection(doc, "Transformer Records", reportData?.transformers || []);
  writeSection(doc, "Pump Records", reportData?.pumps || []);

  return toPdfBuffer(doc);
};

export default generatePdfReport;
