import asyncHandler from "../middlewares/asyncHandler.js";
import Report from "../modals/report.js";
import Facility from "../modals/facility.js";
import UtilityAccount from "../modals/utilityAccount.js";
import FacilityAuditor from "../modals/facilityAuditor.js";

import { buildReportData } from "../services/report/buildReportData.js";
import { generateExcelReport } from "../services/report/excel/generateExcelReport.js";

import { createRecentActivity } from "../helpers/createRecentActivity.js";
import { buildActivityMessage } from "../helpers/buildActivityMessage.js";
import { addReportJob } from "../queues/addReportJob.js";

const REPORT_SCOPES = ["facility", "utility_account"];

const REPORT_TYPES = [
  "full_audit_report",
  "executive_summary",
  "solar_report",
  "dg_report",
  "transformer_report",
  "pump_report",
  "hvac_report",
  "ac_report",
  "fan_report",
  "lighting_report",
  "lux_report",
  "misc_report",
];

const isAdmin = (user) => user?.role === "admin";

const throwError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

const normalizeReportScope = (scope) => {
  if (!scope) return "facility";

  if (!REPORT_SCOPES.includes(scope)) {
    throwError("Invalid report_scope", 400);
  }

  return scope;
};

const normalizeReportType = (type) => {
  if (!type) return "full_audit_report";

  if (!REPORT_TYPES.includes(type)) {
    throwError("Invalid report_type", 400);
  }

  return type;
};

const buildDefaultTitle = ({ facility, utilityAccount, reportType }) => {
  const safeType = reportType.replaceAll("_", " ");
  const date = new Date().toLocaleDateString("en-GB");

  if (utilityAccount?.account_number) {
    return `${facility.name} - ${utilityAccount.account_number} - ${safeType} - ${date}`;
  }

  return `${facility.name} - ${safeType} - ${date}`;
};

const buildSnapshotMeta = ({
  facility,
  utilityAccount,
  snapshot_meta = {},
}) => ({
  facility_name: snapshot_meta.facility_name || facility?.name || "",
  facility_city: snapshot_meta.facility_city || facility?.city || "",
  utility_account_number:
    snapshot_meta.utility_account_number ||
    utilityAccount?.account_number ||
    "",
  report_period_from: snapshot_meta.report_period_from || null,
  report_period_to: snapshot_meta.report_period_to || null,
});

const validateGeneratePayload = ({
  facility_id,
  utility_account_id,
  report_scope,
  report_type,
}) => {
  if (!facility_id) {
    throwError("facility_id is required", 400);
  }

  const normalizedScope = normalizeReportScope(report_scope);
  const normalizedType = normalizeReportType(report_type);

  if (normalizedScope === "utility_account" && !utility_account_id) {
    throwError(
      "utility_account_id is required when report_scope is utility_account",
      400,
    );
  }

  return {
    report_scope: normalizedScope,
    report_type: normalizedType,
  };
};

const getAccessibleFacility = async (user, facilityId) => {
  const facility = await Facility.findById(facilityId);

  if (!facility) return null;
  if (isAdmin(user)) return facility;

  const assigned = await FacilityAuditor.exists({
    facility_id: facility._id,
    user_id: user._id,
  });

  if (facility.owner_user_id?.toString() === user._id?.toString() || assigned) {
    return facility;
  }

  return null;
};

const getAccessibleUtilityAccount = async (user, utilityAccountId) => {
  const utilityAccount = await UtilityAccount.findById(utilityAccountId);

  if (!utilityAccount) return null;
  if (isAdmin(user)) return utilityAccount;

  const facility = await Facility.findById(utilityAccount.facility_id);
  if (!facility) return null;

  const assigned = await FacilityAuditor.exists({
    facility_id: facility._id,
    user_id: user._id,
  });

  if (facility.owner_user_id?.toString() === user._id?.toString() || assigned) {
    return utilityAccount;
  }

  return null;
};

const resolveReportContext = async ({
  user,
  facility_id,
  utility_account_id,
  report_scope,
}) => {
  const facility = await getAccessibleFacility(user, facility_id);

  if (!facility) {
    throwError("Access denied for facility", 403);
  }

  let utilityAccount = null;

  if (report_scope === "utility_account" || utility_account_id) {
    utilityAccount = await getAccessibleUtilityAccount(
      user,
      utility_account_id,
    );

    if (!utilityAccount) {
      throwError("Access denied for utility account", 403);
    }

    if (utilityAccount.facility_id.toString() !== facility._id.toString()) {
      throwError(
        "utility_account_id does not belong to the given facility",
        400,
      );
    }
  }

  return { facility, utilityAccount };
};

const populateReportById = async (reportId) => {
  return Report.findById(reportId)
    .populate("facility_id", "name city address")
    .populate("utility_account_id", "account_number connection_type category")
    .populate("created_by", "name email role");
};

const createProcessingReport = async ({
  facility,
  utilityAccount,
  report_scope,
  report_type,
  title,
  snapshot_meta,
  user,
}) => {
  const report = await Report.create({
    facility_id: facility._id,
    utility_account_id: utilityAccount?._id || null,
    report_scope,
    report_type,
    title:
      title ||
      buildDefaultTitle({
        facility,
        utilityAccount,
        reportType: report_type,
      }),
    status: "processing",
    snapshot_meta: buildSnapshotMeta({
      facility,
      utilityAccount,
      snapshot_meta,
    }),
    created_by: user._id,
  });

  return report;
};

/**
 * @desc    Generate a new report
 * @route   POST /api/v1/reports/generate
 * @access  Private
 */
const generateReport = asyncHandler(async (req, res) => {
  const {
    facility_id,
    utility_account_id,
    report_scope,
    report_type,
    title,
    snapshot_meta,
  } = req.body;

  const validated = validateGeneratePayload({
    facility_id,
    utility_account_id,
    report_scope,
    report_type,
  });

  const { facility, utilityAccount } = await resolveReportContext({
    user: req.user,
    facility_id,
    utility_account_id,
    report_scope: validated.report_scope,
  });

  const report = await createProcessingReport({
    facility,
    utilityAccount,
    report_scope: validated.report_scope,
    report_type: validated.report_type,
    title,
    snapshot_meta,
    user: req.user,
  });

  await addReportJob({
    reportId: String(report._id),
    requestedBy: String(req.user._id),
    action: "generate",
  });

  const populatedReport = await populateReportById(report._id);

  res.status(202).json({
    success: true,
    message: "Report generation queued successfully",
    data: populatedReport,
  });
});

/**
 * @desc    Regenerate an existing report
 * @route   POST /api/v1/reports/:id/regenerate
 * @access  Private
 */
const regenerateReport = asyncHandler(async (req, res) => {
  const report = await Report.findById(req.params.id);

  if (!report) {
    throwError("Report not found", 404);
  }

  await resolveReportContext({
    user: req.user,
    facility_id: report.facility_id,
    utility_account_id: report.utility_account_id,
    report_scope: report.report_scope,
  });

  report.status = "processing";
  report.error_message = "";
  await report.save();

  await addReportJob({
    reportId: String(report._id),
    requestedBy: String(req.user._id),
    action: "regenerate",
  });

  const populatedReport = await populateReportById(report._id);

  res.status(202).json({
    success: true,
    message: "Report regeneration queued successfully",
    data: populatedReport,
  });
});

/**
 * @desc    Create report row only, without generating files
 * @route   POST /api/v1/reports
 * @access  Private
 */
const createReport = asyncHandler(async (req, res) => {
  const {
    facility_id,
    utility_account_id,
    report_scope,
    report_type,
    title,
    snapshot_meta,
  } = req.body;

  const validated = validateGeneratePayload({
    facility_id,
    utility_account_id,
    report_scope,
    report_type,
  });

  const { facility, utilityAccount } = await resolveReportContext({
    user: req.user,
    facility_id,
    utility_account_id,
    report_scope: validated.report_scope,
  });

  const report = await Report.create({
    facility_id: facility._id,
    utility_account_id: utilityAccount?._id || null,
    report_scope: validated.report_scope,
    report_type: validated.report_type,
    title:
      title ||
      buildDefaultTitle({
        facility,
        utilityAccount,
        reportType: validated.report_type,
      }),
    status: "processing",
    snapshot_meta: buildSnapshotMeta({
      facility,
      utilityAccount,
      snapshot_meta,
    }),
    created_by: req.user._id,
  });

  await createRecentActivity({
    actor: req.user,
    action: "created",
    entity_type: "report",
    entity_id: report._id,
    entity_name: report.title || "Report",
    facility_id: report.facility_id,
    utility_account_id: report.utility_account_id,
    message: buildActivityMessage({
      actorName: req.user?.name || "User",
      action: "created",
      entityLabel: "report",
      entityName: report.title || "",
    }),
    meta: {
      report_scope: report.report_scope,
      report_type: report.report_type,
      status: report.status,
    },
  });

  const populatedReport = await populateReportById(report._id);

  res.status(201).json({
    success: true,
    message: "Report created successfully",
    data: populatedReport,
  });
});

/**
 * @desc    Get all reports
 * @route   GET /api/v1/reports
 * @access  Private
 */
const getReports = asyncHandler(async (req, res) => {
  const { facility_id, utility_account_id, report_scope, report_type, status } =
    req.query;

  const query = {};

  if (facility_id) query.facility_id = facility_id;
  if (utility_account_id) query.utility_account_id = utility_account_id;
  if (report_scope) query.report_scope = report_scope;
  if (report_type) query.report_type = report_type;
  if (status) query.status = status;

  if (!isAdmin(req.user)) {
    const assignedFacilities = await FacilityAuditor.find({
      user_id: req.user._id,
    }).select("facility_id");

    const ownedFacilities = await Facility.find({
      owner_user_id: req.user._id,
    }).select("_id");

    const accessibleFacilityIds = [
      ...new Set([
        ...assignedFacilities.map((item) => String(item.facility_id)),
        ...ownedFacilities.map((item) => String(item._id)),
      ]),
    ];

    if (!accessibleFacilityIds.length) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
    }

    if (query.facility_id) {
      if (!accessibleFacilityIds.includes(String(query.facility_id))) {
        return res.status(200).json({
          success: true,
          count: 0,
          data: [],
        });
      }
    } else {
      query.facility_id = { $in: accessibleFacilityIds };
    }
  }

  const reports = await Report.find(query)
    .populate("facility_id", "name city")
    .populate("utility_account_id", "account_number connection_type category")
    .populate("created_by", "name email role")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: reports.length,
    data: reports,
  });
});

/**
 * @desc    Get report by id
 * @route   GET /api/v1/reports/:id
 * @access  Private
 */
const getReportById = asyncHandler(async (req, res) => {
  const report = await populateReportById(req.params.id);

  if (!report) {
    throwError("Report not found", 404);
  }

  const facility = await getAccessibleFacility(
    req.user,
    report.facility_id?._id || report.facility_id,
  );

  if (!facility) {
    throwError("Access denied", 403);
  }

  res.status(200).json({
    success: true,
    data: report,
  });
});

/**
 * @desc    Update report metadata only
 * @route   PUT /api/v1/reports/:id
 * @access  Private
 */
const updateReport = asyncHandler(async (req, res) => {
  const report = await Report.findById(req.params.id);

  if (!report) {
    throwError("Report not found", 404);
  }

  const facility = await getAccessibleFacility(req.user, report.facility_id);

  if (!facility) {
    throwError("Access denied", 403);
  }

  const allowedFields = ["title", "snapshot_meta"];
  const updatedFields = [];

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      report[field] = req.body[field];
      updatedFields.push(field);
    }
  });

  await report.save();

  await createRecentActivity({
    actor: req.user,
    action: "updated",
    entity_type: "report",
    entity_id: report._id,
    entity_name: report.title || "Report",
    facility_id: report.facility_id,
    utility_account_id: report.utility_account_id,
    message: buildActivityMessage({
      actorName: req.user?.name || "User",
      action: "updated",
      entityLabel: "report",
      entityName: report.title || "",
    }),
    meta: {
      updated_fields: [...new Set(updatedFields)],
      report_scope: report.report_scope,
      report_type: report.report_type,
      status: report.status,
    },
  });

  const populatedReport = await populateReportById(report._id);

  res.status(200).json({
    success: true,
    message: "Report updated successfully",
    data: populatedReport,
  });
});

/**
 * @desc    Delete report
 * @route   DELETE /api/v1/reports/:id
 * @access  Private
 */
const deleteReport = asyncHandler(async (req, res) => {
  const report = await Report.findById(req.params.id);

  if (!report) {
    throwError("Report not found", 404);
  }

  const facility = await getAccessibleFacility(req.user, report.facility_id);

  if (!facility) {
    throwError("Access denied", 403);
  }

  const entityName = report.title || "Report";
  const facilityId = report.facility_id;
  const utilityId = report.utility_account_id;
  const reportScope = report.report_scope;
  const reportType = report.report_type;
  const reportStatus = report.status;

  await report.deleteOne();

  await createRecentActivity({
    actor: req.user,
    action: "deleted",
    entity_type: "report",
    entity_id: report._id,
    entity_name: entityName,
    facility_id: facilityId,
    utility_account_id: utilityId,
    message: buildActivityMessage({
      actorName: req.user?.name || "User",
      action: "deleted",
      entityLabel: "report",
      entityName,
    }),
    meta: {
      report_scope: reportScope,
      report_type: reportType,
      status: reportStatus,
    },
  });

  res.status(200).json({
    success: true,
    message: "Report deleted successfully",
  });
});

const downloadExcelReport = asyncHandler(async (req, res) => {
  const report = await Report.findById(req.params.id);

  if (!report) {
    throwError("Report not found", 404);
  }

  const { facility, utilityAccount } = await resolveReportContext({
    user: req.user,
    facility_id: report.facility_id,
    utility_account_id: report.utility_account_id,
    report_scope: report.report_scope,
  });

  const reportData = await buildReportData({
    report,
    facility,
    utilityAccount,
  });

  const buffer = await generateExcelReport({ reportData });

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );

  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${report.title || "report"}.xlsx`,
  );

  res.setHeader("Content-Length", buffer.length);

  res.end(buffer);
});

export {
  createReport,
  generateReport,
  regenerateReport,
  getReports,
  getReportById,
  updateReport,
  deleteReport,
  downloadExcelReport,
};
