import LuxMeasurement from "../../../../modals/luxMeasurement.js";

const getMongoId = (value) => value?._id || value || null;
const getId = (value) => (value?._id ? String(value._id) : String(value || ""));

const normalizeText = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const normalizeNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
};

const formatNumber = (value, decimals = 2) => {
  const num = normalizeNumber(value);
  if (num === null) return "";
  return num.toFixed(decimals);
};

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB");
};

const complianceLabel = (value) => {
  if (value === true) return "Compliant";
  if (value === false) return "Non-Compliant";
  return "";
};

const buildAverageLux = (row) => {
  const existingAverage = normalizeNumber(row?.average_lux);
  if (existingAverage !== null) return existingAverage;

  const p1 = normalizeNumber(row?.measured_lux_point_1);
  const p2 = normalizeNumber(row?.measured_lux_point_2);
  const p3 = normalizeNumber(row?.measured_lux_point_3);

  const points = [p1, p2, p3].filter((value) => value !== null);

  if (!points.length) return null;

  return Number(
    (points.reduce((sum, value) => sum + value, 0) / points.length).toFixed(2),
  );
};

const buildLuxGap = (requiredLux, averageLux, row) => {
  const existing = normalizeNumber(row?.lux_gap);
  if (existing !== null) return existing;

  if (requiredLux !== null && averageLux !== null) {
    // positive = deficiency, negative = surplus
    return Number((requiredLux - averageLux).toFixed(2));
  }

  return null;
};

const buildCompliance = (requiredLux, averageLux, row) => {
  if (requiredLux !== null && averageLux !== null) {
    return averageLux >= requiredLux;
  }

  if (row?.compliance === true) return true;
  if (row?.compliance === false) return false;

  return null;
};

const buildCompliancePercent = (items = []) => {
  if (!items.length) return null;
  const compliantCount = items.filter(
    (item) => item.compliance === true,
  ).length;
  return Number(((compliantCount / items.length) * 100).toFixed(2));
};

const normalizeLuxRecord = (row, index) => {
  const requiredLux = normalizeNumber(row?.required_lux);
  const measuredLuxPoint1 = normalizeNumber(row?.measured_lux_point_1);
  const measuredLuxPoint2 = normalizeNumber(row?.measured_lux_point_2);
  const measuredLuxPoint3 = normalizeNumber(row?.measured_lux_point_3);

  const averageLux = buildAverageLux(row);
  const luxGap = buildLuxGap(requiredLux, averageLux, row);
  const compliance = buildCompliance(requiredLux, averageLux, row);

  return {
    id: String(row?._id || ""),
    sr_no: index + 1,

    audit_date: row?.audit_date || null,
    audit_date_label: formatDate(row?.audit_date),

    area_location: normalizeText(row?.area_location),
    room_type: normalizeText(row?.room_type),

    required_lux: requiredLux,
    measured_lux_point_1: measuredLuxPoint1,
    measured_lux_point_2: measuredLuxPoint2,
    measured_lux_point_3: measuredLuxPoint3,
    average_lux: averageLux,
    lux_gap: luxGap,

    compliance,
    compliance_label: complianceLabel(compliance),

    remarks: normalizeText(row?.remarks),

    created_at: row?.createdAt || row?.created_at || null,
    updated_at: row?.updatedAt || row?.updated_at || null,
  };
};

export const buildLuxSection = async ({
  report,
  meta,
  facility,
  utilityAccount = null,
  utilityAccounts = [],
  scope = "facility",
}) => {
  const facilityId = getMongoId(facility);

  const resolvedUtilityAccountId =
    getMongoId(utilityAccount) ||
    getMongoId(meta?.utility_account_id) ||
    getMongoId(report?.utility_account_id) ||
    getMongoId(utilityAccounts?.[0]) ||
    null;

  const query =
    scope === "utility_account"
      ? {
          facility_id: facilityId,
          utility_account_id: resolvedUtilityAccountId,
        }
      : {
          facility_id: facilityId,
        };

  const rows = await LuxMeasurement.find(query)
    .sort({ audit_date: -1, created_at: -1, createdAt: -1 })
    .lean();

  const items = (rows || []).map((row, index) =>
    normalizeLuxRecord(row, index),
  );

  const compliantCount = items.filter(
    (item) => item.compliance === true,
  ).length;

  const nonCompliantCount = items.filter(
    (item) => item.compliance === false,
  ).length;

  const totalRequiredLux = items.reduce(
    (sum, item) => sum + (normalizeNumber(item.required_lux) || 0),
    0,
  );

  const totalAverageLux = items.reduce(
    (sum, item) => sum + (normalizeNumber(item.average_lux) || 0),
    0,
  );

  const averageLuxGap =
    items.length > 0
      ? Number(
          (
            items.reduce(
              (sum, item) => sum + (normalizeNumber(item.lux_gap) || 0),
              0,
            ) / items.length
          ).toFixed(2),
        )
      : null;

  const summary = {
    total_records: items.length,
    compliant_count: compliantCount,
    non_compliant_count: nonCompliantCount,
    compliance_percent: buildCompliancePercent(items),

    average_required_lux:
      items.length > 0
        ? Number((totalRequiredLux / items.length).toFixed(2))
        : null,

    average_measured_lux:
      items.length > 0
        ? Number((totalAverageLux / items.length).toFixed(2))
        : null,

    average_lux_gap: averageLuxGap,

    latest_audit_date:
      items
        .map((item) => item.audit_date)
        .filter(Boolean)
        .sort((a, b) => new Date(b) - new Date(a))[0] || null,
  };

  return {
    title: "Lux Measurements",
    scope,
    facility_id: getId(facility),
    utility_account_id: String(resolvedUtilityAccountId || ""),
    report_type: report?.report_type || meta?.report_type || "",
    total_records: items.length,
    items,

    summary: {
      ...summary,
      latest_audit_date_label: formatDate(summary.latest_audit_date),
    },

    sections: [
      {
        heading: "Lux Measurement Details",
        columns: [
          "sr_no",
          "audit_date_label",
          "area_location",
          "room_type",
          "required_lux",
          "measured_lux_point_1",
          "measured_lux_point_2",
          "measured_lux_point_3",
          "average_lux",
          "lux_gap",
          "compliance_label",
          "remarks",
        ],
        rows: items.map((item) => ({
          sr_no: item.sr_no,
          audit_date_label: item.audit_date_label,
          area_location: item.area_location,
          room_type: item.room_type,
          required_lux:
            item.required_lux !== null ? formatNumber(item.required_lux) : "",
          measured_lux_point_1:
            item.measured_lux_point_1 !== null
              ? formatNumber(item.measured_lux_point_1)
              : "",
          measured_lux_point_2:
            item.measured_lux_point_2 !== null
              ? formatNumber(item.measured_lux_point_2)
              : "",
          measured_lux_point_3:
            item.measured_lux_point_3 !== null
              ? formatNumber(item.measured_lux_point_3)
              : "",
          average_lux:
            item.average_lux !== null ? formatNumber(item.average_lux) : "",
          lux_gap: item.lux_gap !== null ? formatNumber(item.lux_gap) : "",
          compliance_label: item.compliance_label,
          remarks: item.remarks,
        })),
      },

      {
        heading: "Compliance Summary",
        columns: ["metric", "value"],
        rows: [
          {
            metric: "Total Lux Measurement Records",
            value: summary.total_records ?? "",
          },
          {
            metric: "Compliant Count",
            value: summary.compliant_count ?? "",
          },
          {
            metric: "Non-Compliant Count",
            value: summary.non_compliant_count ?? "",
          },
          {
            metric: "Compliance Percentage (%)",
            value:
              summary.compliance_percent !== null
                ? formatNumber(summary.compliance_percent)
                : "",
          },
          {
            metric: "Average Required Lux",
            value:
              summary.average_required_lux !== null
                ? formatNumber(summary.average_required_lux)
                : "",
          },
          {
            metric: "Average Measured Lux",
            value:
              summary.average_measured_lux !== null
                ? formatNumber(summary.average_measured_lux)
                : "",
          },
          {
            metric: "Average Lux Gap",
            value:
              summary.average_lux_gap !== null
                ? formatNumber(summary.average_lux_gap)
                : "",
          },
          {
            metric: "Latest Audit Date",
            value: summary.latest_audit_date_label || "",
          },
        ],
      },
    ],

    table_columns: [
      { key: "sr_no", label: "Sr No" },
      { key: "audit_date_label", label: "Audit Date" },
      { key: "area_location", label: "Area / Location" },
      { key: "room_type", label: "Room Type" },
      { key: "required_lux", label: "Required Lux" },
      { key: "measured_lux_point_1", label: "Point 1" },
      { key: "measured_lux_point_2", label: "Point 2" },
      { key: "measured_lux_point_3", label: "Point 3" },
      { key: "average_lux", label: "Average Lux" },
      { key: "lux_gap", label: "Lux Gap" },
      { key: "compliance_label", label: "Compliance" },
    ],

    table_rows: items.map((item) => ({
      sr_no: item.sr_no,
      audit_date_label: item.audit_date_label,
      area_location: item.area_location,
      room_type: item.room_type,
      required_lux:
        item.required_lux !== null ? formatNumber(item.required_lux) : "",
      measured_lux_point_1:
        item.measured_lux_point_1 !== null
          ? formatNumber(item.measured_lux_point_1)
          : "",
      measured_lux_point_2:
        item.measured_lux_point_2 !== null
          ? formatNumber(item.measured_lux_point_2)
          : "",
      measured_lux_point_3:
        item.measured_lux_point_3 !== null
          ? formatNumber(item.measured_lux_point_3)
          : "",
      average_lux:
        item.average_lux !== null ? formatNumber(item.average_lux) : "",
      lux_gap: item.lux_gap !== null ? formatNumber(item.lux_gap) : "",
      compliance_label: item.compliance_label,
    })),
  };
};

export default buildLuxSection;
