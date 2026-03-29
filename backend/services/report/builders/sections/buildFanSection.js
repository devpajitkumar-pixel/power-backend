import FanAuditRecord from "../../../../modals/fanAuditRecord.js";

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

const buildLoadingFactorPercent = (row) => {
  const existing =
    normalizeNumber(row?.loading_factor_percent) ??
    normalizeNumber(row?.loading_factor);

  if (existing !== null) return existing;

  const ratedPower = normalizeNumber(row?.rated_power_W);
  const measuredPower = normalizeNumber(row?.measured_power_W);

  if (ratedPower !== null && measuredPower !== null && ratedPower > 0) {
    return Number(((measuredPower / ratedPower) * 100).toFixed(2));
  }

  return null;
};

const buildConnectedLoadKW = (row) => {
  const existing = normalizeNumber(row?.connected_load_kW);
  if (existing !== null) return existing;

  const ratedPower = normalizeNumber(row?.rated_power_W);
  const quantity = normalizeNumber(row?.quantity_nos);

  if (ratedPower !== null && quantity !== null) {
    return Number(((ratedPower * quantity) / 1000).toFixed(2));
  }

  return null;
};

const buildAnnualEnergyConsumption = (row) => {
  const existing = normalizeNumber(row?.annual_energy_consumption_kWh);
  if (existing !== null) return existing;

  const measuredPower = normalizeNumber(row?.measured_power_W);
  const quantity = normalizeNumber(row?.quantity_nos);
  const operatingHours =
    normalizeNumber(row?.operating_hours_per_day) ??
    normalizeNumber(row?.operating_hrs_per_day);
  const operatingDays = normalizeNumber(row?.operating_days_per_year);

  if (
    measuredPower !== null &&
    quantity !== null &&
    operatingHours !== null &&
    operatingDays !== null
  ) {
    return Number(
      (
        ((measuredPower * quantity) / 1000) *
        operatingHours *
        operatingDays
      ).toFixed(2),
    );
  }

  return null;
};

const normalizeFanRecord = (row, index) => {
  const ratedPower = normalizeNumber(row?.rated_power_W);
  const measuredPower = normalizeNumber(row?.measured_power_W);
  const quantity = normalizeNumber(row?.quantity_nos);
  const operatingHours =
    normalizeNumber(row?.operating_hours_per_day) ??
    normalizeNumber(row?.operating_hrs_per_day);
  const operatingDays = normalizeNumber(row?.operating_days_per_year);

  const loadingFactorPercent = buildLoadingFactorPercent(row);
  const connectedLoadKW = buildConnectedLoadKW(row);
  const annualEnergyConsumptionKWh = buildAnnualEnergyConsumption(row);

  return {
    id: getId(row),
    sr_no: index + 1,

    facility_id: getId(row?.facility_id),
    utility_account_id: getId(row?.utility_account_id),

    building_block: normalizeText(row?.building_block),
    area_location: normalizeText(row?.area_location),
    fan_type: normalizeText(row?.fan_type),
    make_model: normalizeText(row?.make_model),

    rated_power_W: ratedPower,
    measured_power_W: measuredPower,
    quantity_nos: quantity,

    speed_control_type: normalizeText(row?.speed_control_type),
    operating_hours_per_day: operatingHours,
    operating_days_per_year: operatingDays,

    loading_factor_percent: loadingFactorPercent,
    connected_load_kW: connectedLoadKW,
    annual_energy_consumption_kWh: annualEnergyConsumptionKWh,

    condition: normalizeText(row?.condition),
    remarks: normalizeText(row?.remarks),

    audit_date: row?.audit_date || null,
    audit_date_label: formatDate(row?.audit_date),

    created_at: row?.created_at || row?.createdAt || null,
    updated_at: row?.updated_at || row?.updatedAt || null,
  };
};

const buildSummary = (items = []) => {
  const totalRatedPower = items.reduce(
    (sum, item) => sum + (normalizeNumber(item.rated_power_W) || 0),
    0,
  );

  const totalMeasuredPower = items.reduce(
    (sum, item) => sum + (normalizeNumber(item.measured_power_W) || 0),
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
    (sum, item) =>
      sum + (normalizeNumber(item.annual_energy_consumption_kWh) || 0),
    0,
  );

  const loadingFactorValues = items
    .map((item) => normalizeNumber(item.loading_factor_percent))
    .filter((value) => value !== null);

  return {
    total_fan_audit_records: items.length,
    total_quantity_nos: totalQuantity,
    total_connected_load_kW: Number(totalConnectedLoad.toFixed(2)),
    total_annual_energy_consumption_kWh: Number(totalAnnualEnergy.toFixed(2)),

    average_rated_power_W:
      items.length > 0
        ? Number((totalRatedPower / items.length).toFixed(2))
        : null,

    average_measured_power_W:
      items.length > 0
        ? Number((totalMeasuredPower / items.length).toFixed(2))
        : null,

    average_loading_factor_percent:
      loadingFactorValues.length > 0
        ? Number(
            (
              loadingFactorValues.reduce((sum, value) => sum + value, 0) /
              loadingFactorValues.length
            ).toFixed(2),
          )
        : null,
  };
};

export const buildFanSection = async ({
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

  const rows = await FanAuditRecord.find(query)
    .sort({ audit_date: -1, created_at: -1, createdAt: -1 })
    .lean();

  const items = (rows || []).map((row, index) =>
    normalizeFanRecord(row, index),
  );

  const summary = buildSummary(items);

  return {
    title: "Fan Audit Records",
    scope,
    facility_id: getId(facility),
    utility_account_id: getId(utilityAccount),
    total_records: items.length,
    items,
    summary,

    sections: [
      {
        heading: "Fan Basic Details",
        columns: [
          "sr_no",
          "audit_date_label",
          "building_block",
          "area_location",
          "fan_type",
          "make_model",
          "condition",
          "remarks",
        ],
        rows: items.map((item) => ({
          sr_no: item.sr_no,
          audit_date_label: item.audit_date_label,
          building_block: item.building_block,
          area_location: item.area_location,
          fan_type: item.fan_type,
          make_model: item.make_model,
          condition: item.condition,
          remarks: item.remarks,
        })),
      },

      {
        heading: "Electrical Details",
        columns: [
          "sr_no",
          "fan_type",
          "rated_power_W",
          "measured_power_W",
          "quantity_nos",
          "speed_control_type",
        ],
        rows: items.map((item) => ({
          sr_no: item.sr_no,
          fan_type: item.fan_type,
          rated_power_W:
            item.rated_power_W !== null ? formatNumber(item.rated_power_W) : "",
          measured_power_W:
            item.measured_power_W !== null
              ? formatNumber(item.measured_power_W)
              : "",
          quantity_nos:
            item.quantity_nos !== null
              ? formatNumber(item.quantity_nos, 0)
              : "",
          speed_control_type: item.speed_control_type,
        })),
      },

      {
        heading: "Operating Pattern",
        columns: [
          "sr_no",
          "fan_type",
          "operating_hours_per_day",
          "operating_days_per_year",
        ],
        rows: items.map((item) => ({
          sr_no: item.sr_no,
          fan_type: item.fan_type,
          operating_hours_per_day:
            item.operating_hours_per_day !== null
              ? formatNumber(item.operating_hours_per_day)
              : "",
          operating_days_per_year:
            item.operating_days_per_year !== null
              ? formatNumber(item.operating_days_per_year)
              : "",
        })),
      },

      {
        heading: "Performance & Calculations",
        columns: [
          "sr_no",
          "fan_type",
          "loading_factor_percent",
          "connected_load_kW",
          "annual_energy_consumption_kWh",
        ],
        rows: items.map((item) => ({
          sr_no: item.sr_no,
          fan_type: item.fan_type,
          loading_factor_percent:
            item.loading_factor_percent !== null
              ? formatNumber(item.loading_factor_percent)
              : "",
          connected_load_kW:
            item.connected_load_kW !== null
              ? formatNumber(item.connected_load_kW)
              : "",
          annual_energy_consumption_kWh:
            item.annual_energy_consumption_kWh !== null
              ? formatNumber(item.annual_energy_consumption_kWh)
              : "",
        })),
      },

      {
        heading: "Fan Audit Summary",
        columns: ["metric", "value"],
        rows: [
          {
            metric: "Total Fan Audit Records",
            value: summary.total_fan_audit_records ?? "",
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
            metric: "Total Annual Energy Consumption (kWh)",
            value:
              summary.total_annual_energy_consumption_kWh !== null
                ? formatNumber(summary.total_annual_energy_consumption_kWh)
                : "",
          },
          {
            metric: "Average Rated Power (W)",
            value:
              summary.average_rated_power_W !== null
                ? formatNumber(summary.average_rated_power_W)
                : "",
          },
          {
            metric: "Average Measured Power (W)",
            value:
              summary.average_measured_power_W !== null
                ? formatNumber(summary.average_measured_power_W)
                : "",
          },
          {
            metric: "Average Loading Factor (%)",
            value:
              summary.average_loading_factor_percent !== null
                ? formatNumber(summary.average_loading_factor_percent)
                : "",
          },
        ],
      },
    ],

    table_columns: [
      { key: "sr_no", label: "Sr No" },
      { key: "audit_date_label", label: "Audit Date" },
      { key: "area_location", label: "Area / Location" },
      { key: "fan_type", label: "Fan Type" },
      { key: "rated_power_W", label: "Rated Power (W)" },
      { key: "measured_power_W", label: "Measured Power (W)" },
      { key: "quantity_nos", label: "Quantity (Nos)" },
      { key: "loading_factor_percent", label: "Loading Factor (%)" },
      { key: "connected_load_kW", label: "Connected Load (kW)" },
      {
        key: "annual_energy_consumption_kWh",
        label: "Annual Energy Consumption (kWh)",
      },
    ],

    table_rows: items.map((item) => ({
      sr_no: item.sr_no,
      audit_date_label: item.audit_date_label,
      area_location: item.area_location,
      fan_type: item.fan_type,
      rated_power_W:
        item.rated_power_W !== null ? formatNumber(item.rated_power_W) : "",
      measured_power_W:
        item.measured_power_W !== null
          ? formatNumber(item.measured_power_W)
          : "",
      quantity_nos:
        item.quantity_nos !== null ? formatNumber(item.quantity_nos, 0) : "",
      loading_factor_percent:
        item.loading_factor_percent !== null
          ? formatNumber(item.loading_factor_percent)
          : "",
      connected_load_kW:
        item.connected_load_kW !== null
          ? formatNumber(item.connected_load_kW)
          : "",
      annual_energy_consumption_kWh:
        item.annual_energy_consumption_kWh !== null
          ? formatNumber(item.annual_energy_consumption_kWh)
          : "",
    })),
  };
};

export default buildFanSection;
