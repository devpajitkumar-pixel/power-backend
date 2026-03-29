import Report from "../../../modals/report.js";
import Facility from "../../../modals/facility.js";
import UtilityAccount from "../../../modals/utilityAccount.js";

import logger from "../../../config/logger.js";
import buildWorkerLogMeta from "../../../utils/buildWorkerLogMeta.js";

import { buildReportData } from "../buildReportData.js";
import { generateReportFiles } from "../generateReportFiles.js";
import { uploadReportFiles } from "../uploadReportFiles.js";

import { createRecentActivity } from "../../../helpers/createRecentActivity.js";
import { buildActivityMessage } from "../../../helpers/buildActivityMessage.js";

export const processReportJob = async ({ job }) => {
  const { reportId, requestedBy, action } = job.data;

  const baseMeta = buildWorkerLogMeta(job, {
    reportId,
    requestedBy,
    action,
  });

  logger.info("Report job started", baseMeta);

  const report = await Report.findById(reportId);

  if (!report) {
    logger.error("Report not found", baseMeta);
    throw new Error("Report not found");
  }

  report.status = "processing";
  report.error_message = "";
  await report.save();

  try {
    await job.updateProgress(10);

    logger.info(
      "Report loaded and marked processing",
      buildWorkerLogMeta(job, {
        reportId: String(report._id),
        title: report.title,
        scope: report.report_scope,
        type: report.report_type,
      }),
    );

    const facility = await Facility.findById(report.facility_id);

    if (!facility) {
      throw new Error("Facility not found");
    }

    logger.info(
      "Facility loaded",
      buildWorkerLogMeta(job, {
        facilityId: String(facility._id),
        facilityName: facility.name,
      }),
    );

    let utilityAccount = null;

    if (report.utility_account_id) {
      utilityAccount = await UtilityAccount.findById(report.utility_account_id);

      if (!utilityAccount) {
        throw new Error("Utility account not found");
      }

      if (String(utilityAccount.facility_id) !== String(facility._id)) {
        throw new Error("Utility account does not belong to facility");
      }

      logger.info(
        "Utility account loaded",
        buildWorkerLogMeta(job, {
          utilityAccountId: String(utilityAccount._id),
          accountNumber: utilityAccount.account_number,
        }),
      );
    }

    await job.updateProgress(25);

    logger.info(
      "Starting buildReportData",
      buildWorkerLogMeta(job, { reportId }),
    );

    const reportData = await buildReportData({
      report,
      facility,
      utilityAccount,
    });

    await job.updateProgress(55);

    logger.info(
      "buildReportData completed",
      buildWorkerLogMeta(job, {
        hasReportData: Boolean(reportData),
        sectionsCount: Array.isArray(reportData?.sections)
          ? reportData.sections.length
          : 0,
      }),
    );

    logger.info(
      "Starting generateReportFiles",
      buildWorkerLogMeta(job, { reportId }),
    );

    const generatedFiles = await generateReportFiles({
      report,
      reportData,
    });

    await job.updateProgress(80);

    logger.info(
      "generateReportFiles completed",
      buildWorkerLogMeta(job, {
        generatedKeys: generatedFiles ? Object.keys(generatedFiles) : [],
      }),
    );

    logger.info(
      "Starting uploadReportFiles",
      buildWorkerLogMeta(job, { reportId }),
    );

    const uploadedFiles = await uploadReportFiles({
      report,
      generatedFiles,
    });

    logger.info(
      "uploadReportFiles completed",
      buildWorkerLogMeta(job, {
        uploadedKeys: uploadedFiles ? Object.keys(uploadedFiles) : [],
      }),
    );

    if (uploadedFiles?.excel_file) {
      report.excel_file = uploadedFiles.excel_file;
    }

    if (uploadedFiles?.pdf_file) {
      report.pdf_file = uploadedFiles.pdf_file;
    }

    report.status = "completed";
    report.generated_at = new Date();
    report.error_message = "";
    await report.save();

    await job.updateProgress(100);

    logger.info(
      "Report marked completed",
      buildWorkerLogMeta(job, {
        excelUrl: report.excel_file?.fileUrl || null,
        pdfUrl: report.pdf_file?.fileUrl || null,
      }),
    );

    await createRecentActivity({
      actor: requestedBy ? { _id: requestedBy, name: "User" } : null,
      action: action === "regenerate" ? "regenerated" : "generated",
      entity_type: "report",
      entity_id: report._id,
      entity_name: report.title || "Report",
      facility_id: report.facility_id,
      utility_account_id: report.utility_account_id,
      message: buildActivityMessage({
        actorName: "User",
        action: action === "regenerate" ? "regenerated" : "generated",
        entityLabel: "report",
        entityName: report.title || "",
      }),
      meta: {
        report_scope: report.report_scope,
        report_type: report.report_type,
        status: report.status,
      },
    });

    logger.info(
      "Activity created for report",
      buildWorkerLogMeta(job, { reportId }),
    );

    return {
      success: true,
      reportId: String(report._id),
      status: report.status,
    };
  } catch (error) {
    logger.error(
      "Report job failed",
      buildWorkerLogMeta(job, {
        reportId,
        error: error?.message,
        stack: error?.stack,
      }),
    );

    report.status = "failed";
    report.generated_at = new Date();
    report.error_message = error?.message || "Report generation failed";

    await report.save();

    throw error;
  }
};
