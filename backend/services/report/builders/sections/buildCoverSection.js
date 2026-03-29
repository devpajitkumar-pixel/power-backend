const REPORT_TYPE_LABELS = {
  full_audit_report: "Full Audit Report",
  executive_summary: "Executive Summary",
  solar_report: "Solar Report",
  dg_report: "DG Report",
  transformer_report: "Transformer Report",
  pump_report: "Pump Report",
  hvac_report: "HVAC Report",
  ac_report: "AC Report",
  fan_report: "Fan Report",
  lighting_report: "Lighting Report",
  lux_report: "Lux Report",
  misc_report: "Misc Report",
};

const SCOPE_LABELS = {
  facility: "Facility Level",
  utility_account: "Utility Account Level",
};

const throwError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB");
};

const getReportTypeLabel = (reportType) => {
  return REPORT_TYPE_LABELS[reportType] || "Report";
};

const getScopeLabel = (scope) => {
  return SCOPE_LABELS[scope] || "Report Scope";
};

const buildReportPeriodLabel = (from, to) => {
  const fromText = formatDate(from);
  const toText = formatDate(to);

  if (fromText && toText) return `${fromText} - ${toText}`;
  if (fromText) return `From ${fromText}`;
  if (toText) return `Up to ${toText}`;
  return "";
};

const buildSubtitle = ({ facility, utilityAccount, scope, snapshotMeta }) => {
  const facilityName = snapshotMeta?.facility_name || facility?.name || "";
  const facilityCity = snapshotMeta?.facility_city || facility?.city || "";
  const accountNumber =
    snapshotMeta?.utility_account_number ||
    utilityAccount?.account_number ||
    "";

  if (scope === "utility_account") {
    if (facilityName && accountNumber) {
      return `${facilityName} | Account No: ${accountNumber}`;
    }
    if (facilityName) return facilityName;
    if (accountNumber) return `Account No: ${accountNumber}`;
    return "";
  }

  if (facilityName && facilityCity) {
    return `${facilityName} | ${facilityCity}`;
  }

  return facilityName || facilityCity || "";
};

const buildIdentifiers = ({ report, facility, utilityAccount, scope }) => {
  return {
    report_id: report?._id?.toString?.() || "",
    facility_id:
      facility?._id?.toString?.() || report?.facility_id?.toString?.() || "",
    utility_account_id:
      scope === "utility_account"
        ? utilityAccount?._id?.toString?.() ||
          report?.utility_account_id?.toString?.() ||
          ""
        : "",
  };
};

const buildPreparedFor = ({
  facility,
  utilityAccount,
  scope,
  snapshotMeta,
}) => {
  const facilityName = snapshotMeta?.facility_name || facility?.name || "";
  const facilityCity = snapshotMeta?.facility_city || facility?.city || "";
  const utilityAccountNumber =
    snapshotMeta?.utility_account_number ||
    utilityAccount?.account_number ||
    "";

  return {
    facility_name: facilityName,
    facility_city: facilityCity,
    utility_account_number:
      scope === "utility_account" ? utilityAccountNumber : "",
  };
};

const buildPreparedBy = ({ report }) => {
  const creator =
    typeof report?.created_by === "object" && report?.created_by !== null
      ? report.created_by
      : null;

  return {
    user_id:
      creator?._id?.toString?.() || report?.created_by?.toString?.() || "",
    name: creator?.name || "",
    email: creator?.email || "",
    role: creator?.role || "",
  };
};

export const buildCoverSection = async ({
  report,
  meta,
  facility,
  utilityAccount = null,
  scope = "facility",
}) => {
  if (!report) {
    throwError("report is required in buildCoverSection", 500);
  }

  if (!facility) {
    throwError("facility is required in buildCoverSection", 500);
  }

  const snapshotMeta = meta?.snapshot_meta || report?.snapshot_meta || {};
  const reportType =
    report?.report_type || meta?.report_type || "full_audit_report";
  const reportScope =
    scope || meta?.report_scope || report?.report_scope || "facility";

  const periodLabel = buildReportPeriodLabel(
    snapshotMeta?.report_period_from,
    snapshotMeta?.report_period_to,
  );

  const generatedAt = meta?.generated_at || report?.generated_at || new Date();

  const title = report?.title || meta?.title || getReportTypeLabel(reportType);
  const subtitle = buildSubtitle({
    facility,
    utilityAccount,
    scope: reportScope,
    snapshotMeta,
  });

  const preparedFor = buildPreparedFor({
    facility,
    utilityAccount,
    scope: reportScope,
    snapshotMeta,
  });

  const preparedBy = buildPreparedBy({ report });

  const identifiers = buildIdentifiers({
    report,
    facility,
    utilityAccount,
    scope: reportScope,
  });

  const dates = {
    created_at: report?.createdAt || meta?.created_at || null,
    generated_at: generatedAt,
    created_at_label: formatDate(report?.createdAt || meta?.created_at),
    generated_at_label: formatDate(generatedAt),
  };

  return {
    title,
    report_type: reportType,
    report_type_label: getReportTypeLabel(reportType),

    report_scope: reportScope,
    report_scope_label: getScopeLabel(reportScope),

    subtitle,

    report_period: {
      from: snapshotMeta?.report_period_from || null,
      to: snapshotMeta?.report_period_to || null,
      label: periodLabel,
    },

    prepared_for: preparedFor,
    prepared_by: preparedBy,
    identifiers,
    dates,

    branding: {
      company_name: "Shakti Power Solutions",
      logo_url: "",
      logo_public_id: "",
    },

    metadata: {
      facility_name: snapshotMeta?.facility_name || facility?.name || "",
      facility_city: snapshotMeta?.facility_city || facility?.city || "",
      utility_account_number:
        snapshotMeta?.utility_account_number ||
        utilityAccount?.account_number ||
        "",
    },

    sections: [
      {
        heading: "Report Overview",
        columns: ["label", "value"],
        rows: [
          { label: "Title", value: title },
          { label: "Report Type", value: getReportTypeLabel(reportType) },
          { label: "Scope", value: getScopeLabel(reportScope) },
          { label: "Subtitle", value: subtitle },
        ].filter((row) => row.value !== ""),
      },

      {
        heading: "Report Period",
        columns: ["label", "value"],
        rows: [
          {
            label: "From",
            value: formatDate(snapshotMeta?.report_period_from),
          },
          {
            label: "To",
            value: formatDate(snapshotMeta?.report_period_to),
          },
          {
            label: "Period",
            value: periodLabel,
          },
        ].filter((row) => row.value !== ""),
      },

      {
        heading: "Prepared For",
        columns: ["label", "value"],
        rows: [
          {
            label: "Facility Name",
            value: preparedFor.facility_name,
          },
          {
            label: "Facility City",
            value: preparedFor.facility_city,
          },
          ...(reportScope === "utility_account"
            ? [
                {
                  label: "Utility Account Number",
                  value: preparedFor.utility_account_number,
                },
              ]
            : []),
        ].filter((row) => row.value !== ""),
      },

      {
        heading: "Prepared By",
        columns: ["label", "value"],
        rows: [
          {
            label: "Name",
            value: preparedBy.name,
          },
          {
            label: "Email",
            value: preparedBy.email,
          },
          {
            label: "Role",
            value: preparedBy.role,
          },
        ].filter((row) => row.value !== ""),
      },

      {
        heading: "Identifiers",
        columns: ["label", "value"],
        rows: [
          {
            label: "Report ID",
            value: identifiers.report_id,
          },
          {
            label: "Facility ID",
            value: identifiers.facility_id,
          },
          ...(reportScope === "utility_account"
            ? [
                {
                  label: "Utility Account ID",
                  value: identifiers.utility_account_id,
                },
              ]
            : []),
        ].filter((row) => row.value !== ""),
      },

      {
        heading: "Dates",
        columns: ["label", "value"],
        rows: [
          {
            label: "Created At",
            value: dates.created_at_label,
          },
          {
            label: "Generated At",
            value: dates.generated_at_label,
          },
        ].filter((row) => row.value !== ""),
      },
    ],

    display_rows: [
      { label: "Title", value: title },
      { label: "Report Type", value: getReportTypeLabel(reportType) },
      { label: "Scope", value: getScopeLabel(reportScope) },
      { label: "Subtitle", value: subtitle },
      { label: "Report Period", value: periodLabel },
      { label: "Prepared For - Facility", value: preparedFor.facility_name },
      { label: "Prepared For - City", value: preparedFor.facility_city },
      ...(reportScope === "utility_account"
        ? [
            {
              label: "Prepared For - Utility Account",
              value: preparedFor.utility_account_number,
            },
          ]
        : []),
      { label: "Prepared By - Name", value: preparedBy.name },
      { label: "Prepared By - Email", value: preparedBy.email },
      { label: "Prepared By - Role", value: preparedBy.role },
      { label: "Created At", value: dates.created_at_label },
      { label: "Generated At", value: dates.generated_at_label },
    ].filter((row) => row.value !== ""),

    summary_cards: [
      {
        key: "report_type",
        label: "Report Type",
        value: getReportTypeLabel(reportType) || "-",
      },
      {
        key: "scope",
        label: "Scope",
        value: getScopeLabel(reportScope) || "-",
      },
      {
        key: "facility_name",
        label: "Facility",
        value: preparedFor.facility_name || "-",
      },
      ...(reportScope === "utility_account"
        ? [
            {
              key: "utility_account_number",
              label: "Account Number",
              value: preparedFor.utility_account_number || "-",
            },
          ]
        : []),
    ],
  };
};

export default buildCoverSection;
