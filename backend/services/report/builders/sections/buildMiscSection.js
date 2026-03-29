import MiscLoadAuditRecord from "../../../../modals/miscLoadAuditRecord.js";

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

/* ===============================
   🔥 CORE CALCULATIONS
================================ */

const buildConnectedLoadKW = (row) => {
  const ratedPower = normalizeNumber(row?.rated_power_kW);
  const quantity = normalizeNumber(row?.quantity);

  if (ratedPower !== null && quantity !== null) {
    return Number((ratedPower * quantity).toFixed(2));
  }

  return null; // ❌ removed wrong fallback
};

const buildEstimatedAnnualEnergy = (row) => {
  const connectedLoadKW = buildConnectedLoadKW(row);
  const operatingHours = normalizeNumber(row?.average_operating_hours_per_day);
  const operatingDays = normalizeNumber(row?.operating_days_per_year);

  let loadFactor = normalizeNumber(row?.load_factor_percent);

  // ✅ sanitize load factor
  if (loadFactor !== null) {
    loadFactor = Math.min(Math.max(loadFactor, 0), 100);
  }

  if (
    connectedLoadKW !== null &&
    operatingHours !== null &&
    operatingDays !== null &&
    loadFactor !== null
  ) {
    return Number(
      (
        connectedLoadKW *
        operatingHours *
        operatingDays *
        (loadFactor / 100)
      ).toFixed(2),
    );
  }

  return null;
};

const buildEnergyPerKW = (energy, connectedLoad) => {
  if (energy !== null && connectedLoad > 0) {
    return Number((energy / connectedLoad).toFixed(2));
  }
  return null;
};

/* ===============================
   🔥 NORMALIZER
================================ */

const normalizeMiscRecord = (row, index) => {
  const quantity = normalizeNumber(row?.quantity);
  const ratedPowerKW = normalizeNumber(row?.rated_power_kW);

  const operatingHours = normalizeNumber(row?.average_operating_hours_per_day);
  const operatingDays = normalizeNumber(row?.operating_days_per_year);

  let loadFactorPercent = normalizeNumber(row?.load_factor_percent);
  if (loadFactorPercent !== null) {
    loadFactorPercent = Math.min(Math.max(loadFactorPercent, 0), 100);
  }

  const connectedLoadKW = buildConnectedLoadKW(row);
  const estimatedAnnualEnergyKWh = buildEstimatedAnnualEnergy(row);

  const energyPerKW = buildEnergyPerKW(
    estimatedAnnualEnergyKWh,
    connectedLoadKW,
  );

  return {
    id: String(row?._id || ""),
    sr_no: index + 1,

    audit_date: row?.audit_date || null,
    audit_date_label: formatDate(row?.audit_date),

    equipment_name: normalizeText(row?.equipment_name),
    category: normalizeText(row?.category),
    location_department: normalizeText(row?.location_department),

    quantity,
    rated_power_kW: ratedPowerKW,
    connected_load_kW: connectedLoadKW,

    average_operating_hours_per_day: operatingHours,
    operating_days_per_year: operatingDays,
    load_factor_percent: loadFactorPercent,

    estimated_annual_energy_kWh: estimatedAnnualEnergyKWh,
    energy_per_kW: energyPerKW, // ⭐ NEW KPI

    remarks: normalizeText(row?.remarks),

    created_at: row?.createdAt || row?.created_at || null,
    updated_at: row?.updatedAt || row?.updated_at || null,
  };
};

/* ===============================
   🔥 MAIN BUILDER
================================ */

export const buildMiscSection = async ({
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

  const rows = await MiscLoadAuditRecord.find(query)
    .sort({ audit_date: -1, created_at: -1 })
    .lean();

  const items = (rows || []).map((row, index) =>
    normalizeMiscRecord(row, index),
  );

  /* ===============================
     🔥 SUMMARY
  ================================ */

  const totalConnectedLoadKW = items.reduce(
    (sum, item) => sum + (item.connected_load_kW || 0),
    0,
  );

  const totalEnergy = items.reduce(
    (sum, item) => sum + (item.estimated_annual_energy_kWh || 0),
    0,
  );

  const totalQuantity = items.reduce(
    (sum, item) => sum + (item.quantity || 0),
    0,
  );

  const summary = {
    total_records: items.length,
    total_quantity: totalQuantity,
    total_connected_load_kW: Number(totalConnectedLoadKW.toFixed(2)),
    total_estimated_annual_energy_kWh: Number(totalEnergy.toFixed(2)),

    energy_per_kW:
      totalConnectedLoadKW > 0
        ? Number((totalEnergy / totalConnectedLoadKW).toFixed(2))
        : null,

    latest_audit_date:
      items
        .map((item) => item.audit_date)
        .filter(Boolean)
        .sort((a, b) => new Date(b) - new Date(a))[0] || null,
  };

  return {
    title: "Misc Load Audit",
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
        heading: "Misc Load Details",
        columns: [
          "sr_no",
          "equipment_name",
          "quantity",
          "rated_power_kW",
          "connected_load_kW",
          "estimated_annual_energy_kWh",
        ],
        rows: items.map((item) => ({
          sr_no: item.sr_no,
          equipment_name: item.equipment_name,
          quantity: formatNumber(item.quantity, 0),
          rated_power_kW: formatNumber(item.rated_power_kW),
          connected_load_kW: formatNumber(item.connected_load_kW),
          estimated_annual_energy_kWh: formatNumber(
            item.estimated_annual_energy_kWh,
          ),
        })),
      },

      {
        heading: "Summary",
        columns: ["metric", "value"],
        rows: [
          { metric: "Total Records", value: summary.total_records },
          { metric: "Total Quantity", value: summary.total_quantity },
          {
            metric: "Total Connected Load (kW)",
            value: formatNumber(summary.total_connected_load_kW),
          },
          {
            metric: "Total Annual Energy (kWh)",
            value: formatNumber(summary.total_estimated_annual_energy_kWh),
          },
          {
            metric: "Energy per kW",
            value:
              summary.energy_per_kW !== null
                ? formatNumber(summary.energy_per_kW)
                : "",
          },
        ],
      },
    ],

    table_columns: [
      { key: "sr_no", label: "Sr No" },
      { key: "equipment_name", label: "Equipment" },
      { key: "quantity", label: "Qty" },
      { key: "connected_load_kW", label: "Load (kW)" },
      { key: "estimated_annual_energy_kWh", label: "Energy (kWh)" },
    ],

    table_rows: items.map((item) => ({
      sr_no: item.sr_no,
      equipment_name: item.equipment_name,
      quantity: formatNumber(item.quantity, 0),
      connected_load_kW: formatNumber(item.connected_load_kW),
      estimated_annual_energy_kWh: formatNumber(
        item.estimated_annual_energy_kWh,
      ),
    })),
  };
};

export default buildMiscSection;
