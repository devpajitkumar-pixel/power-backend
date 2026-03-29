import { buildFacilityReportData } from "./builders/buildFacilityReportData.js";
import { buildUtilityAccountReportData } from "./builders/buildUtilityAccountReportData.js";

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

const throwError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

const normalizeReportScope = (scope) => {
  if (!scope) return "facility";
  if (!REPORT_SCOPES.includes(scope)) {
    throwError(`Invalid report scope: ${scope}`, 400);
  }
  return scope;
};

const normalizeReportType = (type) => {
  if (!type) return "full_audit_report";
  if (!REPORT_TYPES.includes(type)) {
    throwError(`Invalid report type: ${type}`, 400);
  }
  return type;
};

const buildMeta = ({ report, facility, utilityAccount }) => {
  return {
    report_id: report?._id?.toString?.() || null,
    title: report?.title || "",
    report_scope: normalizeReportScope(report?.report_scope),
    report_type: normalizeReportType(report?.report_type),

    facility_id:
      facility?._id?.toString?.() || report?.facility_id?.toString?.() || null,
    utility_account_id:
      utilityAccount?._id?.toString?.() ||
      report?.utility_account_id?.toString?.() ||
      null,

    created_at: report?.createdAt || new Date(),
    generated_at: new Date(),

    snapshot_meta: {
      facility_name:
        report?.snapshot_meta?.facility_name || facility?.name || "",
      facility_city:
        report?.snapshot_meta?.facility_city || facility?.city || "",
      utility_account_number:
        report?.snapshot_meta?.utility_account_number ||
        utilityAccount?.account_number ||
        "",
      report_period_from: report?.snapshot_meta?.report_period_from || null,
      report_period_to: report?.snapshot_meta?.report_period_to || null,
    },
  };
};

const buildEmptySections = () => {
  return {
    cover: null,
    facility_info: null,
    utility_accounts: [],
    tariffs: [],
    billing_records: [],
    solar_systems: [],
    dg_sets: [],
    transformers: [],
    pumps: [],
    hvac_records: [],
    ac_records: [],
    fan_records: [],
    lighting_records: [],
    lux_records: [],
    misc_records: [],
    recommendations: [],
    summary: null,
  };
};

const mergeWithDefaults = (meta, builtData = {}) => {
  const defaults = buildEmptySections();

  return {
    meta,
    ...defaults,
    ...builtData,
    cover: builtData?.cover ?? defaults.cover,
    facility_info: builtData?.facility_info ?? defaults.facility_info,
    utility_accounts: builtData?.utility_accounts ?? defaults.utility_accounts,
    tariffs: builtData?.tariffs ?? defaults.tariffs,
    billing_records: builtData?.billing_records ?? defaults.billing_records,
    solar_systems: builtData?.solar_systems ?? defaults.solar_systems,
    dg_sets: builtData?.dg_sets ?? defaults.dg_sets,
    transformers: builtData?.transformers ?? defaults.transformers,
    pumps: builtData?.pumps ?? defaults.pumps,
    hvac_records: builtData?.hvac_records ?? defaults.hvac_records,
    ac_records: builtData?.ac_records ?? defaults.ac_records,
    fan_records: builtData?.fan_records ?? defaults.fan_records,
    lighting_records: builtData?.lighting_records ?? defaults.lighting_records,
    lux_records: builtData?.lux_records ?? defaults.lux_records,
    misc_records: builtData?.misc_records ?? defaults.misc_records,
    recommendations: builtData?.recommendations ?? defaults.recommendations,
    summary: builtData?.summary ?? defaults.summary,
  };
};

/**
 * Main entry point for building normalized report data
 *
 * Expected usage from controller:
 *   const reportData = await buildReportData({
 *     report,
 *     facility,
 *     utilityAccount,
 *   });
 */
export const buildReportData = async ({ report, facility, utilityAccount }) => {
  if (!report) {
    throwError("report is required in buildReportData", 500);
  }

  if (!facility) {
    throwError("facility is required in buildReportData", 500);
  }

  const reportScope = normalizeReportScope(report.report_scope);
  const meta = buildMeta({ report, facility, utilityAccount });

  let builtData;

  if (reportScope === "facility") {
    builtData = await buildFacilityReportData({
      report,
      facility,
      meta,
    });
  } else if (reportScope === "utility_account") {
    if (!utilityAccount) {
      throwError(
        "utilityAccount is required for utility_account scope report",
        500,
      );
    }

    builtData = await buildUtilityAccountReportData({
      report,
      facility,
      utilityAccount,
      meta,
    });
  } else {
    throwError(`Unsupported report scope: ${reportScope}`, 400);
  }

  return mergeWithDefaults(meta, builtData);
};

export default buildReportData;
