import mongoose from "mongoose";
import ACAuditRecord from "../../../../modals/acAuditRecord.js";

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

const isValidObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(String(value));

const getId = (value) => {
  if (!value) return "";

  if (typeof value === "string") {
    const cleaned = value.trim();
    if (!cleaned || cleaned === "[object Object]") return "";
    return cleaned;
  }

  if (value instanceof mongoose.Types.ObjectId) {
    return String(value);
  }

  if (value?._id) {
    const nestedId =
      typeof value._id === "object" ? getId(value._id) : String(value._id);
    return nestedId === "[object Object]" ? "" : nestedId;
  }

  if (value?.id) {
    const nestedId =
      typeof value.id === "object" ? getId(value.id) : String(value.id);
    return nestedId === "[object Object]" ? "" : nestedId;
  }

  if (value?.utility_account_id?._id) {
    return getId(value.utility_account_id._id);
  }

  if (value?.utility_account_id?.id) {
    return getId(value.utility_account_id.id);
  }

  if (
    value?.utility_account_id &&
    typeof value.utility_account_id === "string" &&
    value.utility_account_id !== "[object Object]"
  ) {
    return value.utility_account_id.trim();
  }

  if (value?.facility_id?._id) {
    return getId(value.facility_id._id);
  }

  if (value?.facility_id?.id) {
    return getId(value.facility_id.id);
  }

  if (
    value?.facility_id &&
    typeof value.facility_id === "string" &&
    value.facility_id !== "[object Object]"
  ) {
    return value.facility_id.trim();
  }

  if (value?.toString && typeof value.toString === "function") {
    const str = String(value.toString()).trim();
    return str === "[object Object]" ? "" : str;
  }

  return "";
};

const normalizeACRecord = (row, index = 0) => {
  const coolingCapacity = normalizeNumber(row?.cooling_capacity_TR);
  const ratedInputPower = normalizeNumber(row?.rated_input_power_kW);
  const voltage = normalizeNumber(row?.voltage_V);
  const current = normalizeNumber(row?.current_A);
  const powerFactor = normalizeNumber(row?.power_factor);
  const measuredPower = normalizeNumber(row?.measured_power_kW);
  const returnAirTemp = normalizeNumber(row?.return_air_temp_C);
  const supplyAirTemp = normalizeNumber(row?.supply_air_temp_C);
  const ambientTemp = normalizeNumber(row?.ambient_temp_C);
  const thermostatSetTemp = normalizeNumber(row?.thermostat_set_temp_C);
  const operatingHours = normalizeNumber(row?.operating_hours_per_day);
  const operatingDays = normalizeNumber(row?.operating_days_per_year);
  const airsideDeltaT = normalizeNumber(row?.airside_delta_T);
  const loadingFactor = normalizeNumber(row?.loading_factor_percent);
  const connectedLoad = normalizeNumber(row?.connected_load_kW);
  const annualEnergy = normalizeNumber(row?.annual_energy_consumption_kWh);
  const specificPower = normalizeNumber(row?.specific_power_kW_per_TR);
  const yearOfInstallation = normalizeNumber(row?.year_of_installation);
  const quantityNos = normalizeNumber(row?.quantity_nos);

  return {
    id: getId(row),
    sr_no: index + 1,

    facility_id: getId(row?.facility_id),
    utility_account_id: getId(row?.utility_account_id),
    auditor_id: getId(row?.auditor_id),

    unit_id: normalizeText(row?.unit_id),
    building_block: normalizeText(row?.building_block),
    area_location: normalizeText(row?.area_location),
    ac_type: normalizeText(row?.ac_type),
    make: normalizeText(row?.make),
    model: normalizeText(row?.model),
    bee_star_rating: normalizeText(row?.bee_star_rating),
    condition: normalizeText(row?.condition),

    cooling_capacity_TR: coolingCapacity,
    cooling_capacity_TR_label:
      coolingCapacity !== null ? formatNumber(coolingCapacity) : "",

    rated_input_power_kW: ratedInputPower,
    rated_input_power_kW_label:
      ratedInputPower !== null ? formatNumber(ratedInputPower) : "",

    year_of_installation: yearOfInstallation,
    year_of_installation_label:
      yearOfInstallation !== null ? String(yearOfInstallation) : "",

    quantity_nos: quantityNos,
    quantity_nos_label: quantityNos !== null ? String(quantityNos) : "",

    voltage_V: voltage,
    voltage_V_label: voltage !== null ? formatNumber(voltage) : "",

    current_A: current,
    current_A_label: current !== null ? formatNumber(current) : "",

    power_factor: powerFactor,
    power_factor_label:
      powerFactor !== null ? Number(powerFactor).toFixed(4) : "",

    measured_power_kW: measuredPower,
    measured_power_kW_label:
      measuredPower !== null ? formatNumber(measuredPower) : "",

    return_air_temp_C: returnAirTemp,
    return_air_temp_C_label:
      returnAirTemp !== null ? formatNumber(returnAirTemp) : "",

    supply_air_temp_C: supplyAirTemp,
    supply_air_temp_C_label:
      supplyAirTemp !== null ? formatNumber(supplyAirTemp) : "",

    ambient_temp_C: ambientTemp,
    ambient_temp_C_label: ambientTemp !== null ? formatNumber(ambientTemp) : "",

    thermostat_set_temp_C: thermostatSetTemp,
    thermostat_set_temp_C_label:
      thermostatSetTemp !== null ? formatNumber(thermostatSetTemp) : "",

    operating_hours_per_day: operatingHours,
    operating_hours_per_day_label:
      operatingHours !== null ? formatNumber(operatingHours) : "",

    operating_days_per_year: operatingDays,
    operating_days_per_year_label:
      operatingDays !== null ? formatNumber(operatingDays) : "",

    airside_delta_T: airsideDeltaT,
    airside_delta_T_label:
      airsideDeltaT !== null ? formatNumber(airsideDeltaT) : "",

    loading_factor_percent: loadingFactor,
    loading_factor_percent_label:
      loadingFactor !== null ? formatNumber(loadingFactor) : "",

    connected_load_kW: connectedLoad,
    connected_load_kW_label:
      connectedLoad !== null ? formatNumber(connectedLoad) : "",

    annual_energy_consumption_kWh: annualEnergy,
    annual_energy_consumption_kWh_label:
      annualEnergy !== null ? formatNumber(annualEnergy) : "",

    specific_power_kW_per_TR: specificPower,
    specific_power_kW_per_TR_label:
      specificPower !== null ? formatNumber(specificPower) : "",

    om_flag: normalizeText(row?.om_flag),
    replacement_flag: normalizeText(row?.replacement_flag),
    control_flag: normalizeText(row?.control_flag),
    overall_ecm_suggestion: normalizeText(row?.overall_ecm_suggestion),
    priority: normalizeText(row?.priority),
    remarks: normalizeText(row?.remarks),

    created_at: row?.createdAt || row?.created_at || null,
    updated_at: row?.updatedAt || row?.updated_at || null,
  };
};

export const buildACSection = async ({
  report,
  meta,
  facility,
  utilityAccount = null,
  scope = "facility",
}) => {
  if (!facility) {
    const error = new Error("facility is required in buildACSection");
    error.statusCode = 500;
    throw error;
  }

  const facilityId = getId(facility);
  const utilityAccountId =
    getId(utilityAccount) || getId(meta?.utility_account_id);

  let query = {};

  if (scope === "utility_account") {
    if (!utilityAccountId || !isValidObjectId(utilityAccountId)) {
      return {
        title: "AC Audit",
        key: "ac_records",
        scope,
        facility_id: facilityId || "",
        utility_account_id: utilityAccountId || "",
        report_type: report?.report_type || meta?.report_type || "",
        total_ac_records: 0,
        items: [],
        sections: [],
        table_columns: [],
        table_rows: [],
      };
    }

    query = {
      utility_account_id: new mongoose.Types.ObjectId(utilityAccountId),
    };
  } else {
    if (!facilityId || !isValidObjectId(facilityId)) {
      return {
        title: "AC Audit",
        key: "ac_records",
        scope,
        facility_id: facilityId || "",
        utility_account_id: "",
        report_type: report?.report_type || meta?.report_type || "",
        total_ac_records: 0,
        items: [],
        sections: [],
        table_columns: [],
        table_rows: [],
      };
    }

    query = {
      facility_id: new mongoose.Types.ObjectId(facilityId),
    };
  }

  const rows = await ACAuditRecord.find(query)
    .sort({ createdAt: -1, created_at: -1 })
    .lean();

  const items = (rows || []).map((row, index) => normalizeACRecord(row, index));

  const sections = [
    {
      heading: "Basic Details",
      columns: [
        "sr_no",
        "unit_id",
        "building_block",
        "area_location",
        "ac_type",
        "make",
        "model",
        "cooling_capacity_TR_label",
        "rated_input_power_kW_label",
        "bee_star_rating",
        "year_of_installation_label",
        "quantity_nos_label",
        "condition",
      ],
      rows: items.map((item) => ({
        sr_no: item.sr_no,
        unit_id: item.unit_id,
        building_block: item.building_block,
        area_location: item.area_location,
        ac_type: item.ac_type,
        make: item.make,
        model: item.model,
        cooling_capacity_TR_label: item.cooling_capacity_TR_label,
        rated_input_power_kW_label: item.rated_input_power_kW_label,
        bee_star_rating: item.bee_star_rating,
        year_of_installation_label: item.year_of_installation_label,
        quantity_nos_label: item.quantity_nos_label,
        condition: item.condition,
      })),
    },
    {
      heading: "Measurement Section",
      columns: [
        "sr_no",
        "voltage_V_label",
        "current_A_label",
        "power_factor_label",
        "measured_power_kW_label",
        "return_air_temp_C_label",
        "supply_air_temp_C_label",
        "ambient_temp_C_label",
        "thermostat_set_temp_C_label",
        "operating_hours_per_day_label",
        "operating_days_per_year_label",
      ],
      rows: items.map((item) => ({
        sr_no: item.sr_no,
        voltage_V_label: item.voltage_V_label,
        current_A_label: item.current_A_label,
        power_factor_label: item.power_factor_label,
        measured_power_kW_label: item.measured_power_kW_label,
        return_air_temp_C_label: item.return_air_temp_C_label,
        supply_air_temp_C_label: item.supply_air_temp_C_label,
        ambient_temp_C_label: item.ambient_temp_C_label,
        thermostat_set_temp_C_label: item.thermostat_set_temp_C_label,
        operating_hours_per_day_label: item.operating_hours_per_day_label,
        operating_days_per_year_label: item.operating_days_per_year_label,
      })),
    },
    {
      heading: "Performance & Calculations",
      columns: [
        "sr_no",
        "airside_delta_T_label",
        "loading_factor_percent_label",
        "connected_load_kW_label",
        "annual_energy_consumption_kWh_label",
        "specific_power_kW_per_TR_label",
      ],
      rows: items.map((item) => ({
        sr_no: item.sr_no,
        airside_delta_T_label: item.airside_delta_T_label,
        loading_factor_percent_label: item.loading_factor_percent_label,
        connected_load_kW_label: item.connected_load_kW_label,
        annual_energy_consumption_kWh_label:
          item.annual_energy_consumption_kWh_label,
        specific_power_kW_per_TR_label: item.specific_power_kW_per_TR_label,
      })),
    },
    {
      heading: "Observations & Recommendations",
      columns: [
        "sr_no",
        "om_flag",
        "replacement_flag",
        "control_flag",
        "overall_ecm_suggestion",
        "priority",
        "remarks",
      ],
      rows: items.map((item) => ({
        sr_no: item.sr_no,
        om_flag: item.om_flag,
        replacement_flag: item.replacement_flag,
        control_flag: item.control_flag,
        overall_ecm_suggestion: item.overall_ecm_suggestion,
        priority: item.priority,
        remarks: item.remarks,
      })),
    },
  ];

  return {
    title: "AC Audit",
    key: "ac_records",
    scope,
    facility_id: facilityId || "",
    utility_account_id:
      scope === "utility_account" ? utilityAccountId || "" : "",
    report_type: report?.report_type || meta?.report_type || "",
    total_ac_records: items.length,

    items,

    sections,

    table_columns: [
      { key: "sr_no", label: "Sr No" },
      { key: "unit_id", label: "Unit ID" },
      { key: "area_location", label: "Area / Location" },
      { key: "ac_type", label: "AC Type" },
      { key: "make", label: "Make" },
      { key: "model", label: "Model" },
      { key: "cooling_capacity_TR_label", label: "Cooling Capacity (TR)" },
      { key: "measured_power_kW_label", label: "Measured Power (kW)" },
      {
        key: "annual_energy_consumption_kWh_label",
        label: "Annual Energy (kWh)",
      },
      { key: "priority", label: "Priority" },
      { key: "remarks", label: "Remarks" },
    ],

    table_rows: items.map((item) => ({
      sr_no: item.sr_no,
      unit_id: item.unit_id,
      area_location: item.area_location,
      ac_type: item.ac_type,
      make: item.make,
      model: item.model,
      cooling_capacity_TR_label: item.cooling_capacity_TR_label,
      measured_power_kW_label: item.measured_power_kW_label,
      annual_energy_consumption_kWh_label:
        item.annual_energy_consumption_kWh_label,
      priority: item.priority,
      remarks: item.remarks,
    })),
  };
};

export default buildACSection;
