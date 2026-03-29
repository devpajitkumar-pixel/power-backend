import PumpAuditRecord from "../../../../modals/pumpAuditRecord.js";
import Pump from "../../../../modals/pump.js";

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

const formatBoolean = (value) => {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "";
};

const buildPumpMap = (pumps = []) => {
  return new Map(pumps.filter(Boolean).map((pump) => [getId(pump), pump]));
};

const normalizePumpMini = (pump) => {
  if (!pump) return null;

  return {
    id: getId(pump),
    pump_tag_number: normalizeText(pump?.pump_tag_number),
    make_model: normalizeText(pump?.make_model),
    rated_power_kW_or_HP: normalizeNumber(pump?.rated_power_kW_or_HP),
    rated_flow_m3_per_hr: normalizeNumber(pump?.rated_flow_m3_per_hr),
    rated_head_m: normalizeNumber(pump?.rated_head_m),
    rated_speed_RPM: normalizeNumber(pump?.rated_speed_RPM),
    number_of_stages: normalizeNumber(pump?.number_of_stages),
    year_of_installation: normalizeNumber(pump?.year_of_installation),
  };
};

const fetchFacilityPumps = async (facilityId, utilityAccountId = null) => {
  if (!facilityId) return [];

  const query = { facility_id: facilityId };
  if (utilityAccountId) query.utility_account_id = utilityAccountId;

  const pumps = await Pump.find(query).lean();
  return Array.isArray(pumps) ? pumps : [];
};

const calculateActualFlow = (row) => {
  const existing = normalizeNumber(row?.actual_flow_m3_per_hr);
  if (existing !== null) return existing;

  const tankCapacity = normalizeNumber(row?.tank_or_sump_capacity);
  const fillTimeMinutes = normalizeNumber(row?.time_to_fill_tank_minutes);

  if (
    tankCapacity !== null &&
    fillTimeMinutes !== null &&
    fillTimeMinutes > 0
  ) {
    return Number(((tankCapacity * 60) / fillTimeMinutes).toFixed(2));
  }

  return null;
};

const calculateTotalDynamicHead = (row) => {
  const existing = normalizeNumber(row?.total_dynamic_head_m);
  if (existing !== null) return existing;

  const suctionHead = normalizeNumber(row?.suction_head_m);
  const dischargeHead = normalizeNumber(row?.discharge_static_head_m);

  if (suctionHead !== null && dischargeHead !== null) {
    return Number((suctionHead + dischargeHead).toFixed(2));
  }

  return null;
};

const calculateInputPower = (row) => {
  const existing = normalizeNumber(row?.input_power_kW);
  if (existing !== null) return existing;

  const voltage = normalizeNumber(row?.voltage_V);
  const current = normalizeNumber(row?.current_A);
  const powerFactor = normalizeNumber(row?.power_factor);

  if (
    voltage !== null &&
    current !== null &&
    powerFactor !== null &&
    powerFactor >= 0
  ) {
    return Number(
      ((Math.sqrt(3) * voltage * current * powerFactor) / 1000).toFixed(2),
    );
  }

  return null;
};

const calculateHydraulicOutputPower = (row) => {
  const existing = normalizeNumber(row?.hydraulic_output_power_kW);
  if (existing !== null) return existing;

  const actualFlow = calculateActualFlow(row);
  const totalDynamicHead = calculateTotalDynamicHead(row);

  if (actualFlow !== null && totalDynamicHead !== null) {
    return Number(
      ((actualFlow * totalDynamicHead * 1000 * 9.81) / 3600000).toFixed(2),
    );
  }

  return null;
};

const calculateOverallEfficiency = (row) => {
  const existing = normalizeNumber(row?.overall_pump_set_efficiency_percent);
  if (existing !== null) return existing;

  const hydraulicOutputPower = calculateHydraulicOutputPower(row);
  const inputPower = calculateInputPower(row);

  if (hydraulicOutputPower !== null && inputPower !== null && inputPower > 0) {
    return Number(((hydraulicOutputPower / inputPower) * 100).toFixed(2));
  }

  return null;
};

const calculateDailyEnergy = (row) => {
  const existing = normalizeNumber(row?.daily_energy_consumption_kWh);
  if (existing !== null) return existing;

  const inputPower = calculateInputPower(row);
  const operatingHours = normalizeNumber(row?.operating_hours_per_day);

  if (inputPower !== null && operatingHours !== null) {
    return Number((inputPower * operatingHours).toFixed(2));
  }

  return null;
};

const calculateAnnualEnergy = (row) => {
  const existing = normalizeNumber(row?.annual_energy_consumption_kWh);
  if (existing !== null) return existing;

  const dailyEnergy = calculateDailyEnergy(row);
  if (dailyEnergy !== null) {
    return Number((dailyEnergy * 365).toFixed(2));
  }

  return null;
};

const calculateSpecificEnergy = (row) => {
  const existing = normalizeNumber(row?.specific_energy_consumption_kWh_per_m3);
  if (existing !== null) return existing;

  const inputPower = calculateInputPower(row);
  const actualFlow = calculateActualFlow(row);

  if (inputPower !== null && actualFlow !== null && actualFlow > 0) {
    return Number((inputPower / actualFlow).toFixed(3));
  }

  return null;
};

const calculateMotorLoading = (row, pump) => {
  const existing = normalizeNumber(row?.motor_loading_percent);
  if (existing !== null) return existing;

  const inputPower = calculateInputPower(row);
  const ratedPower = normalizeNumber(pump?.rated_power_kW_or_HP);

  if (inputPower !== null && ratedPower !== null && ratedPower > 0) {
    return Number(((inputPower / ratedPower) * 100).toFixed(2));
  }

  return null;
};

const normalizePumpAuditRecord = (row, index, pumpMap) => {
  const linkedPump = pumpMap.get(getId(row?.pump_id)) || row?.pump_id || null;
  const pump = normalizePumpMini(linkedPump);

  const actualFlow = calculateActualFlow(row);
  const inputPower = calculateInputPower(row);
  const totalDynamicHead = calculateTotalDynamicHead(row);
  const hydraulicOutputPower = calculateHydraulicOutputPower(row);
  const overallEfficiency = calculateOverallEfficiency(row);
  const dailyEnergy = calculateDailyEnergy(row);
  const annualEnergy = calculateAnnualEnergy(row);
  const specificEnergy = calculateSpecificEnergy(row);
  const motorLoading = calculateMotorLoading(row, pump);

  return {
    id: getId(row),
    sr_no: index + 1,

    pump_id: getId(row?.pump_id),
    pump,

    audit_date: row?.audit_date || null,
    audit_date_label: formatDate(row?.audit_date),

    pump_tag_number: pump?.pump_tag_number || "",
    make_model: pump?.make_model || "",
    rated_power_kW_or_HP: pump?.rated_power_kW_or_HP ?? null,
    rated_flow_m3_per_hr: pump?.rated_flow_m3_per_hr ?? null,
    rated_head_m: pump?.rated_head_m ?? null,
    rated_speed_RPM: pump?.rated_speed_RPM ?? null,
    number_of_stages: pump?.number_of_stages ?? null,
    year_of_installation: pump?.year_of_installation ?? null,

    suction_head_m: normalizeNumber(row?.suction_head_m),
    discharge_static_head_m: normalizeNumber(row?.discharge_static_head_m),
    delivery_pipe_diameter_inches: normalizeNumber(
      row?.delivery_pipe_diameter_inches,
    ),

    tank_or_sump_capacity: normalizeNumber(row?.tank_or_sump_capacity),
    time_to_fill_tank_minutes: normalizeNumber(row?.time_to_fill_tank_minutes),
    actual_flow_m3_per_hr: actualFlow,

    voltage_V: normalizeNumber(row?.voltage_V),
    current_A: normalizeNumber(row?.current_A),
    power_factor: normalizeNumber(row?.power_factor),
    input_power_kW: inputPower,
    operating_hours_per_day: normalizeNumber(row?.operating_hours_per_day),
    daily_energy_consumption_kWh: dailyEnergy,

    total_dynamic_head_m: totalDynamicHead,
    hydraulic_output_power_kW: hydraulicOutputPower,
    overall_pump_set_efficiency_percent: overallEfficiency,
    motor_loading_percent: motorLoading,
    specific_energy_consumption_kWh_per_m3: specificEnergy,
    annual_energy_consumption_kWh: annualEnergy,

    control_valve_throttling:
      typeof row?.control_valve_throttling === "boolean"
        ? row.control_valve_throttling
        : null,
    vfd_installed:
      typeof row?.vfd_installed === "boolean" ? row.vfd_installed : null,
    pump_condition: normalizeText(row?.pump_condition),
    leakages_observed:
      typeof row?.leakages_observed === "boolean"
        ? row.leakages_observed
        : null,

    recommendations: normalizeText(row?.recommendations),

    created_at: row?.createdAt || row?.created_at || null,
    updated_at: row?.updatedAt || row?.updated_at || null,
  };
};

const buildSummary = (items = []) => {
  const totalAnnualEnergy = items.reduce(
    (sum, item) =>
      sum + (normalizeNumber(item.annual_energy_consumption_kWh) || 0),
    0,
  );

  const totalDailyEnergy = items.reduce(
    (sum, item) =>
      sum + (normalizeNumber(item.daily_energy_consumption_kWh) || 0),
    0,
  );

  const totalInputPower = items.reduce(
    (sum, item) => sum + (normalizeNumber(item.input_power_kW) || 0),
    0,
  );

  const totalEfficiency = items.reduce(
    (sum, item) =>
      sum + (normalizeNumber(item.overall_pump_set_efficiency_percent) || 0),
    0,
  );

  const totalSpecificEnergy = items.reduce(
    (sum, item) =>
      sum + (normalizeNumber(item.specific_energy_consumption_kWh_per_m3) || 0),
    0,
  );

  const totalFlow = items.reduce(
    (sum, item) => sum + (normalizeNumber(item.actual_flow_m3_per_hr) || 0),
    0,
  );

  const totalMotorLoading = items.reduce(
    (sum, item) => sum + (normalizeNumber(item.motor_loading_percent) || 0),
    0,
  );

  const vfdInstalledCount = items.filter(
    (item) => item.vfd_installed === true,
  ).length;
  const throttlingCount = items.filter(
    (item) => item.control_valve_throttling === true,
  ).length;
  const leakageCount = items.filter(
    (item) => item.leakages_observed === true,
  ).length;

  const latestAuditDate =
    items
      .map((item) => item.audit_date)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0] || null;

  return {
    total_pump_audit_records: items.length,
    total_annual_energy_consumption_kWh: Number(totalAnnualEnergy.toFixed(2)),
    total_daily_energy_consumption_kWh: Number(totalDailyEnergy.toFixed(2)),
    average_input_power_kW:
      items.length > 0
        ? Number((totalInputPower / items.length).toFixed(2))
        : null,
    average_efficiency_percent:
      items.length > 0
        ? Number((totalEfficiency / items.length).toFixed(2))
        : null,
    average_specific_energy_kWh_per_m3:
      items.length > 0
        ? Number((totalSpecificEnergy / items.length).toFixed(3))
        : null,
    average_actual_flow_m3_per_hr:
      items.length > 0 ? Number((totalFlow / items.length).toFixed(2)) : null,
    average_motor_loading_percent:
      items.length > 0
        ? Number((totalMotorLoading / items.length).toFixed(2))
        : null,
    vfd_installed_count: vfdInstalledCount,
    throttling_observed_count: throttlingCount,
    leakages_observed_count: leakageCount,
    latest_audit_date: latestAuditDate,
    latest_audit_date_label: formatDate(latestAuditDate),
  };
};

export const buildPumpSection = async ({
  facility,
  utilityAccount = null,
  scope = "facility",
}) => {
  const query =
    scope === "utility_account"
      ? { utility_account_id: getId(utilityAccount) }
      : { facility_id: getId(facility) };

  const rows = await PumpAuditRecord.find(query)
    .sort({ audit_date: -1, created_at: -1, createdAt: -1 })
    .lean();

  const pumps = await fetchFacilityPumps(
    getId(facility),
    scope === "utility_account" ? getId(utilityAccount) : null,
  );

  const pumpMap = buildPumpMap(pumps);

  const items = (rows || []).map((row, index) =>
    normalizePumpAuditRecord(row, index, pumpMap),
  );

  const summary = buildSummary(items);

  return {
    title: "Pump Audit Records",
    scope,
    items,
    summary,

    sections: [
      {
        heading: "Pump Basic Details",
        columns: [
          "sr_no",
          "pump_tag_number",
          "make_model",
          "rated_power_kW_or_HP",
          "rated_flow_m3_per_hr",
          "rated_head_m",
          "rated_speed_RPM",
          "number_of_stages",
          "year_of_installation",
          "audit_date_label",
        ],
        rows: items.map((item) => ({
          sr_no: item.sr_no,
          pump_tag_number: item.pump_tag_number,
          make_model: item.make_model,
          rated_power_kW_or_HP:
            item.rated_power_kW_or_HP !== null
              ? formatNumber(item.rated_power_kW_or_HP)
              : "",
          rated_flow_m3_per_hr:
            item.rated_flow_m3_per_hr !== null
              ? formatNumber(item.rated_flow_m3_per_hr)
              : "",
          rated_head_m:
            item.rated_head_m !== null ? formatNumber(item.rated_head_m) : "",
          rated_speed_RPM:
            item.rated_speed_RPM !== null
              ? formatNumber(item.rated_speed_RPM, 0)
              : "",
          number_of_stages:
            item.number_of_stages !== null
              ? formatNumber(item.number_of_stages, 0)
              : "",
          year_of_installation:
            item.year_of_installation !== null ? item.year_of_installation : "",
          audit_date_label: item.audit_date_label,
        })),
      },

      {
        heading: "Hydraulic Measurements",
        columns: [
          "sr_no",
          "pump_tag_number",
          "suction_head_m",
          "discharge_static_head_m",
          "total_dynamic_head_m",
          "delivery_pipe_diameter_inches",
          "tank_or_sump_capacity",
          "time_to_fill_tank_minutes",
          "actual_flow_m3_per_hr",
        ],
        rows: items.map((item) => ({
          sr_no: item.sr_no,
          pump_tag_number: item.pump_tag_number,
          suction_head_m:
            item.suction_head_m !== null
              ? formatNumber(item.suction_head_m)
              : "",
          discharge_static_head_m:
            item.discharge_static_head_m !== null
              ? formatNumber(item.discharge_static_head_m)
              : "",
          total_dynamic_head_m:
            item.total_dynamic_head_m !== null
              ? formatNumber(item.total_dynamic_head_m)
              : "",
          delivery_pipe_diameter_inches:
            item.delivery_pipe_diameter_inches !== null
              ? formatNumber(item.delivery_pipe_diameter_inches)
              : "",
          tank_or_sump_capacity:
            item.tank_or_sump_capacity !== null
              ? formatNumber(item.tank_or_sump_capacity)
              : "",
          time_to_fill_tank_minutes:
            item.time_to_fill_tank_minutes !== null
              ? formatNumber(item.time_to_fill_tank_minutes)
              : "",
          actual_flow_m3_per_hr:
            item.actual_flow_m3_per_hr !== null
              ? formatNumber(item.actual_flow_m3_per_hr)
              : "",
        })),
      },

      {
        heading: "Electrical Measurements",
        columns: [
          "sr_no",
          "pump_tag_number",
          "voltage_V",
          "current_A",
          "power_factor",
          "input_power_kW",
          "operating_hours_per_day",
          "daily_energy_consumption_kWh",
        ],
        rows: items.map((item) => ({
          sr_no: item.sr_no,
          pump_tag_number: item.pump_tag_number,
          voltage_V:
            item.voltage_V !== null ? formatNumber(item.voltage_V) : "",
          current_A:
            item.current_A !== null ? formatNumber(item.current_A) : "",
          power_factor:
            item.power_factor !== null
              ? formatNumber(item.power_factor, 3)
              : "",
          input_power_kW:
            item.input_power_kW !== null
              ? formatNumber(item.input_power_kW)
              : "",
          operating_hours_per_day:
            item.operating_hours_per_day !== null
              ? formatNumber(item.operating_hours_per_day)
              : "",
          daily_energy_consumption_kWh:
            item.daily_energy_consumption_kWh !== null
              ? formatNumber(item.daily_energy_consumption_kWh)
              : "",
        })),
      },

      {
        heading: "Performance & Energy Analysis",
        columns: [
          "sr_no",
          "pump_tag_number",
          "hydraulic_output_power_kW",
          "overall_pump_set_efficiency_percent",
          "motor_loading_percent",
          "specific_energy_consumption_kWh_per_m3",
          "annual_energy_consumption_kWh",
        ],
        rows: items.map((item) => ({
          sr_no: item.sr_no,
          pump_tag_number: item.pump_tag_number,
          hydraulic_output_power_kW:
            item.hydraulic_output_power_kW !== null
              ? formatNumber(item.hydraulic_output_power_kW)
              : "",
          overall_pump_set_efficiency_percent:
            item.overall_pump_set_efficiency_percent !== null
              ? formatNumber(item.overall_pump_set_efficiency_percent)
              : "",
          motor_loading_percent:
            item.motor_loading_percent !== null
              ? formatNumber(item.motor_loading_percent)
              : "",
          specific_energy_consumption_kWh_per_m3:
            item.specific_energy_consumption_kWh_per_m3 !== null
              ? formatNumber(item.specific_energy_consumption_kWh_per_m3, 3)
              : "",
          annual_energy_consumption_kWh:
            item.annual_energy_consumption_kWh !== null
              ? formatNumber(item.annual_energy_consumption_kWh)
              : "",
        })),
      },

      {
        heading: "Operational Observations",
        columns: [
          "sr_no",
          "pump_tag_number",
          "control_valve_throttling",
          "vfd_installed",
          "pump_condition",
          "leakages_observed",
          "recommendations",
        ],
        rows: items.map((item) => ({
          sr_no: item.sr_no,
          pump_tag_number: item.pump_tag_number,
          control_valve_throttling: formatBoolean(
            item.control_valve_throttling,
          ),
          vfd_installed: formatBoolean(item.vfd_installed),
          pump_condition: item.pump_condition,
          leakages_observed: formatBoolean(item.leakages_observed),
          recommendations: item.recommendations,
        })),
      },

      {
        heading: "Pump Audit Summary",
        columns: ["metric", "value"],
        rows: [
          {
            metric: "Total Pump Audit Records",
            value: summary.total_pump_audit_records ?? "",
          },
          {
            metric: "Total Daily Energy Consumption (kWh)",
            value:
              summary.total_daily_energy_consumption_kWh !== null
                ? formatNumber(summary.total_daily_energy_consumption_kWh)
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
            metric: "Average Input Power (kW)",
            value:
              summary.average_input_power_kW !== null
                ? formatNumber(summary.average_input_power_kW)
                : "",
          },
          {
            metric: "Average Efficiency (%)",
            value:
              summary.average_efficiency_percent !== null
                ? formatNumber(summary.average_efficiency_percent)
                : "",
          },
          {
            metric: "Average Motor Loading (%)",
            value:
              summary.average_motor_loading_percent !== null
                ? formatNumber(summary.average_motor_loading_percent)
                : "",
          },
          {
            metric: "Average Specific Energy (kWh/m3)",
            value:
              summary.average_specific_energy_kWh_per_m3 !== null
                ? formatNumber(summary.average_specific_energy_kWh_per_m3, 3)
                : "",
          },
          {
            metric: "Average Actual Flow (m3/hr)",
            value:
              summary.average_actual_flow_m3_per_hr !== null
                ? formatNumber(summary.average_actual_flow_m3_per_hr)
                : "",
          },
          {
            metric: "Pumps with VFD Installed",
            value: summary.vfd_installed_count ?? "",
          },
          {
            metric: "Cases with Valve Throttling",
            value: summary.throttling_observed_count ?? "",
          },
          {
            metric: "Cases with Leakages Observed",
            value: summary.leakages_observed_count ?? "",
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
      { key: "pump_tag_number", label: "Pump Tag" },
      { key: "audit_date_label", label: "Audit Date" },
      { key: "actual_flow_m3_per_hr", label: "Actual Flow (m3/hr)" },
      { key: "input_power_kW", label: "Input Power (kW)" },
      {
        key: "overall_pump_set_efficiency_percent",
        label: "Efficiency (%)",
      },
      {
        key: "motor_loading_percent",
        label: "Motor Loading (%)",
      },
      {
        key: "annual_energy_consumption_kWh",
        label: "Annual Energy (kWh)",
      },
      {
        key: "specific_energy_consumption_kWh_per_m3",
        label: "Specific Energy (kWh/m3)",
      },
      { key: "pump_condition", label: "Condition" },
    ],

    table_rows: items.map((item) => ({
      sr_no: item.sr_no,
      pump_tag_number: item.pump_tag_number,
      audit_date_label: item.audit_date_label,
      actual_flow_m3_per_hr:
        item.actual_flow_m3_per_hr !== null
          ? formatNumber(item.actual_flow_m3_per_hr)
          : "",
      input_power_kW:
        item.input_power_kW !== null ? formatNumber(item.input_power_kW) : "",
      overall_pump_set_efficiency_percent:
        item.overall_pump_set_efficiency_percent !== null
          ? formatNumber(item.overall_pump_set_efficiency_percent)
          : "",
      motor_loading_percent:
        item.motor_loading_percent !== null
          ? formatNumber(item.motor_loading_percent)
          : "",
      annual_energy_consumption_kWh:
        item.annual_energy_consumption_kWh !== null
          ? formatNumber(item.annual_energy_consumption_kWh)
          : "",
      specific_energy_consumption_kWh_per_m3:
        item.specific_energy_consumption_kWh_per_m3 !== null
          ? formatNumber(item.specific_energy_consumption_kWh_per_m3, 3)
          : "",
      pump_condition: item.pump_condition || "",
    })),
  };
};

export default buildPumpSection;
