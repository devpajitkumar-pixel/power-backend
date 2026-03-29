import LightingAuditRecord from "../../../../modals/lightingAuditRecord.js";

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

const buildConnectedLoadKW = (row) => {
  const existing = normalizeNumber(row?.connected_load_kW);
  if (existing !== null) return existing;

  const wattage = normalizeNumber(row?.wattage_W);
  const quantity = normalizeNumber(row?.quantity_nos);

  if (wattage !== null && quantity !== null) {
    return Number(((wattage * quantity) / 1000).toFixed(2));
  }

  return null;
};

const buildAnnualEnergy = (row) => {
  const existing = normalizeNumber(row?.annual_energy_kWh);
  if (existing !== null) return existing;

  const wattage = normalizeNumber(row?.wattage_W);
  const quantity = normalizeNumber(row?.quantity_nos);
  const workingHours =
    normalizeNumber(row?.working_hours_per_day) ??
    normalizeNumber(row?.operating_hrs_per_day);
  const workingDays =
    normalizeNumber(row?.working_days_per_year) ??
    normalizeNumber(row?.operating_days_per_year);

  if (
    wattage !== null &&
    quantity !== null &&
    workingHours !== null &&
    workingDays !== null
  ) {
    return Number(
      (((wattage * quantity) / 1000) * workingHours * workingDays).toFixed(2),
    );
  }

  return null;
};

const normalizeLightingRecord = (row, index) => {
  const wattage = normalizeNumber(row?.wattage_W);
  const quantity = normalizeNumber(row?.quantity_nos);
  const workingHours =
    normalizeNumber(row?.working_hours_per_day) ??
    normalizeNumber(row?.operating_hrs_per_day);
  const workingDays =
    normalizeNumber(row?.working_days_per_year) ??
    normalizeNumber(row?.operating_days_per_year);

  const connectedLoadKW = buildConnectedLoadKW(row);
  const annualEnergyKWh = buildAnnualEnergy(row);

  return {
    id: getId(row),
    sr_no: index + 1,

    facility_id: getId(row?.facility_id),
    utility_account_id: getId(row?.utility_account_id),

    area_location: normalizeText(row?.area_location),
    fixture_type: normalizeText(row?.fixture_type),
    lamp_type: normalizeText(row?.lamp_type),

    wattage_W: wattage,
    quantity_nos: quantity,
    working_hours_per_day: workingHours,
    working_days_per_year: workingDays,

    control_type: normalizeText(row?.control_type),

    connected_load_kW: connectedLoadKW,
    annual_energy_kWh: annualEnergyKWh,

    remarks: normalizeText(row?.remarks),

    audit_date: row?.audit_date || null,
    audit_date_label: formatDate(row?.audit_date),

    created_at: row?.created_at || row?.createdAt || null,
    updated_at: row?.updated_at || row?.updatedAt || null,
  };
};

const buildSummary = (items = []) => {
  const totalWattage = items.reduce(
    (sum, item) => sum + (normalizeNumber(item.wattage_W) || 0),
    0,
  );

  const totalQuantity = items.reduce(
    (sum, item) => sum + (normalizeNumber(item.quantity_nos) || 0),
    0,
  );

  const totalConnectedLoad = items.reduce(
    (sum, item) => sum + (normalizeNumber(item.connected_load_kW) || 0),
    0,
  );

  const totalAnnualEnergy = items.reduce(
    (sum, item) => sum + (normalizeNumber(item.annual_energy_kWh) || 0),
    0,
  );

  return {
    total_lighting_audit_records: items.length,
    total_quantity_nos: totalQuantity,
    total_connected_load_kW: Number(totalConnectedLoad.toFixed(2)),
    total_annual_energy_kWh: Number(totalAnnualEnergy.toFixed(2)),
    average_wattage_W:
      items.length > 0
        ? Number((totalWattage / items.length).toFixed(2))
        : null,
  };
};

export const buildLightingSection = async ({
  facility,
  utilityAccount = null,
  scope = "facility",
}) => {
  const facilityId = getMongoId(facility);
  const utilityAccountId = getMongoId(utilityAccount);

  const query =
    scope === "utility_account"
      ? {
          facility_id: facilityId,
          utility_account_id: utilityAccountId,
        }
      : {
          facility_id: facilityId,
        };

  const rows = await LightingAuditRecord.find(query)
    .sort({ audit_date: -1, created_at: -1, createdAt: -1 })
    .lean();

  const items = (rows || []).map((row, index) =>
    normalizeLightingRecord(row, index),
  );

  const summary = buildSummary(items);

  return {
    title: "Lighting Audit Records",
    scope,
    facility_id: getId(facility),
    utility_account_id: getId(utilityAccount),
    total_records: items.length,
    items,
    summary,

    sections: [
      {
        heading: "Lighting Basic Details",
        columns: [
          "sr_no",
          "audit_date_label",
          "area_location",
          "fixture_type",
          "lamp_type",
          "control_type",
          "remarks",
        ],
        rows: items.map((item) => ({
          sr_no: item.sr_no,
          audit_date_label: item.audit_date_label,
          area_location: item.area_location,
          fixture_type: item.fixture_type,
          lamp_type: item.lamp_type,
          control_type: item.control_type,
          remarks: item.remarks,
        })),
      },

      {
        heading: "Electrical & Operating Details",
        columns: [
          "sr_no",
          "fixture_type",
          "lamp_type",
          "wattage_W",
          "quantity_nos",
          "working_hours_per_day",
          "working_days_per_year",
          "control_type",
        ],
        rows: items.map((item) => ({
          sr_no: item.sr_no,
          fixture_type: item.fixture_type,
          lamp_type: item.lamp_type,
          wattage_W:
            item.wattage_W !== null ? formatNumber(item.wattage_W) : "",
          quantity_nos:
            item.quantity_nos !== null
              ? formatNumber(item.quantity_nos, 0)
              : "",
          working_hours_per_day:
            item.working_hours_per_day !== null
              ? formatNumber(item.working_hours_per_day)
              : "",
          working_days_per_year:
            item.working_days_per_year !== null
              ? formatNumber(item.working_days_per_year)
              : "",
          control_type: item.control_type,
        })),
      },

      {
        heading: "Lighting Performance & Calculations",
        columns: [
          "sr_no",
          "fixture_type",
          "lamp_type",
          "connected_load_kW",
          "annual_energy_kWh",
        ],
        rows: items.map((item) => ({
          sr_no: item.sr_no,
          fixture_type: item.fixture_type,
          lamp_type: item.lamp_type,
          connected_load_kW:
            item.connected_load_kW !== null
              ? formatNumber(item.connected_load_kW)
              : "",
          annual_energy_kWh:
            item.annual_energy_kWh !== null
              ? formatNumber(item.annual_energy_kWh)
              : "",
        })),
      },

      {
        heading: "Lighting Audit Summary",
        columns: ["metric", "value"],
        rows: [
          {
            metric: "Total Lighting Audit Records",
            value: summary.total_lighting_audit_records ?? "",
          },
          {
            metric: "Total Quantity (Nos)",
            value: summary.total_quantity_nos ?? "",
          },
          {
            metric: "Total Connected Load (kW)",
            value:
              summary.total_connected_load_kW !== null
                ? formatNumber(summary.total_connected_load_kW)
                : "",
          },
          {
            metric: "Total Annual Energy (kWh)",
            value:
              summary.total_annual_energy_kWh !== null
                ? formatNumber(summary.total_annual_energy_kWh)
                : "",
          },
          {
            metric: "Average Wattage (W)",
            value:
              summary.average_wattage_W !== null
                ? formatNumber(summary.average_wattage_W)
                : "",
          },
        ],
      },
    ],

    table_columns: [
      { key: "sr_no", label: "Sr No" },
      { key: "audit_date_label", label: "Audit Date" },
      { key: "area_location", label: "Area / Location" },
      { key: "fixture_type", label: "Fixture Type" },
      { key: "lamp_type", label: "Lamp Type" },
      { key: "wattage_W", label: "Wattage (W)" },
      { key: "quantity_nos", label: "Quantity (Nos)" },
      { key: "connected_load_kW", label: "Connected Load (kW)" },
      { key: "annual_energy_kWh", label: "Annual Energy (kWh)" },
    ],

    table_rows: items.map((item) => ({
      sr_no: item.sr_no,
      audit_date_label: item.audit_date_label,
      area_location: item.area_location,
      fixture_type: item.fixture_type,
      lamp_type: item.lamp_type,
      wattage_W: item.wattage_W !== null ? formatNumber(item.wattage_W) : "",
      quantity_nos:
        item.quantity_nos !== null ? formatNumber(item.quantity_nos, 0) : "",
      connected_load_kW:
        item.connected_load_kW !== null
          ? formatNumber(item.connected_load_kW)
          : "",
      annual_energy_kWh:
        item.annual_energy_kWh !== null
          ? formatNumber(item.annual_energy_kWh)
          : "",
    })),
  };
};

export default buildLightingSection;
