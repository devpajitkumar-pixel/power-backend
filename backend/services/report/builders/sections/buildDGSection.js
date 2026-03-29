import mongoose from "mongoose";
import DGAuditRecord from "../../../../modals/dgAuditRecord.js";
import DGSet from "../../../../modals/dgSet.js";

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
    return getId(value._id);
  }

  if (value?.id) {
    return getId(value.id);
  }

  if (typeof value?.toString === "function") {
    const str = String(value.toString()).trim();
    if (str && str !== "[object Object]") return str;
  }

  return "";
};

const buildDGSetMap = (dgSets = []) =>
  new Map(
    dgSets
      .filter(Boolean)
      .map((item) => [getId(item), item])
      .filter(([id]) => Boolean(id)),
  );

const normalizeDGSetMini = (dgSet) => {
  if (!dgSet) return null;

  return {
    id: getId(dgSet),
    _id: getId(dgSet),
    dg_number: normalizeText(dgSet.dg_number),
    make_model: normalizeText(dgSet.make_model),
    rated_capacity_kVA: normalizeNumber(dgSet.rated_capacity_kVA),
    rated_active_power_kW: normalizeNumber(dgSet.rated_active_power_kW),
    rated_voltage_V: normalizeNumber(dgSet.rated_voltage_V),
    rated_speed_RPM: normalizeNumber(dgSet.rated_speed_RPM),
    fuel_type: normalizeText(dgSet.fuel_type),
    year_of_installation: normalizeNumber(dgSet.year_of_installation),
    utility_account_id: getId(dgSet.utility_account_id),
    facility_id: getId(dgSet.facility_id),
    audit_date: dgSet.audit_date || null,
    auditor_id: getId(dgSet.auditor_id),
    documents: Array.isArray(dgSet.documents) ? dgSet.documents : [],
    created_at: dgSet.created_at || dgSet.createdAt || null,
    updated_at: dgSet.updated_at || dgSet.updatedAt || null,
  };
};

const fetchFacilityDGSets = async (facilityId, utilityAccountId = null) => {
  const resolvedFacilityId = getId(facilityId);
  const resolvedUtilityAccountId = getId(utilityAccountId);

  if (!resolvedFacilityId || !isValidObjectId(resolvedFacilityId)) return [];

  const query = {
    facility_id: new mongoose.Types.ObjectId(resolvedFacilityId),
  };

  if (resolvedUtilityAccountId && isValidObjectId(resolvedUtilityAccountId)) {
    query.utility_account_id = new mongoose.Types.ObjectId(
      resolvedUtilityAccountId,
    );
  }

  const dgSets = await DGSet.find(query)
    .sort({ created_at: 1, createdAt: 1 })
    .lean();

  return Array.isArray(dgSets) ? dgSets : [];
};

const calculateAverageLoadingPercent = (record, dgSet) => {
  const existing = normalizeNumber(record?.average_loading_percent);
  if (existing !== null) return existing;

  const measuredKVA = normalizeNumber(record?.measured_kVA_output);
  const ratedKVA =
    normalizeNumber(record?.rated_capacity_kVA) ??
    normalizeNumber(dgSet?.rated_capacity_kVA);

  if (measuredKVA !== null && ratedKVA !== null && ratedKVA > 0) {
    return Number(((measuredKVA / ratedKVA) * 100).toFixed(2));
  }

  return null;
};

const calculateUnitsGeneratedPerHour = (record) => {
  const existing = normalizeNumber(record?.units_generated_per_hour_kWh);
  if (existing !== null) return existing;

  const annualUnits = normalizeNumber(record?.units_generated_per_year_kWh);
  const annualHours = normalizeNumber(record?.total_working_hours_per_year);

  if (annualUnits !== null && annualHours !== null && annualHours > 0) {
    return Number((annualUnits / annualHours).toFixed(4));
  }

  return null;
};

const calculateFuelConsumptionPerHour = (record) => {
  const existing = normalizeNumber(record?.fuel_consumption_per_hour_liters);
  if (existing !== null) return existing;

  const annualFuel = normalizeNumber(record?.annual_fuel_consumption_liters);
  const annualHours = normalizeNumber(record?.total_working_hours_per_year);

  if (annualFuel !== null && annualHours !== null && annualHours > 0) {
    return Number((annualFuel / annualHours).toFixed(4));
  }

  return null;
};

const calculateSpecificFuelConsumption = (record) => {
  const existing = normalizeNumber(record?.specific_fuel_consumption_l_per_kWh);
  if (existing !== null) return existing;

  const fuelPerHour =
    normalizeNumber(record?.fuel_consumption_per_hour_liters) ??
    normalizeNumber(record?.fuel_consumption_during_test_lph);

  const unitsPerHour =
    normalizeNumber(record?.units_generated_per_hour_kWh) ??
    normalizeNumber(record?.units_generated_during_test_kWh);

  if (fuelPerHour !== null && unitsPerHour !== null && unitsPerHour > 0) {
    return Number((fuelPerHour / unitsPerHour).toFixed(4));
  }

  return null;
};

const calculateAnnualFuelCost = (record) => {
  const existing = normalizeNumber(record?.annual_fuel_cost_rs);
  if (existing !== null) return existing;

  const annualFuel = normalizeNumber(record?.annual_fuel_consumption_liters);
  const fuelRate = normalizeNumber(record?.fuel_cost_rs_per_liter);

  if (annualFuel !== null && fuelRate !== null) {
    return Number((annualFuel * fuelRate).toFixed(2));
  }

  return null;
};

const calculateDGCostPerKWh = (record) => {
  const existing = normalizeNumber(record?.dg_cost_per_kWh_rs);
  if (existing !== null) return existing;

  const annualFuelCost =
    normalizeNumber(record?.annual_fuel_cost_rs) ??
    calculateAnnualFuelCost(record);
  const annualUnits = normalizeNumber(record?.units_generated_per_year_kWh);

  if (annualFuelCost !== null && annualUnits !== null && annualUnits > 0) {
    return Number((annualFuelCost / annualUnits).toFixed(4));
  }

  return null;
};

const calculateCostDifference = (record) => {
  const dgCost =
    normalizeNumber(record?.dg_cost_per_kWh_rs) ??
    calculateDGCostPerKWh(record);
  const gridCost = normalizeNumber(record?.grid_cost_per_kWh_rs);

  if (dgCost !== null && gridCost !== null) {
    return Number((dgCost - gridCost).toFixed(2));
  }

  return null;
};

const normalizeDGAuditRecord = (row, index, dgSetMap) => {
  const linkedDGSetId = getId(row?.dg_set_id);
  const linkedDGSetRaw = dgSetMap.get(linkedDGSetId) || row?.dg_set_id || null;
  const dgSet = normalizeDGSetMini(linkedDGSetRaw);

  const annualFuelCost = calculateAnnualFuelCost(row);
  const dgCostPerKWh = calculateDGCostPerKWh(row);
  const averageLoadingPercent = calculateAverageLoadingPercent(row, dgSet);
  const unitsGeneratedPerHour = calculateUnitsGeneratedPerHour(row);
  const fuelConsumptionPerHour = calculateFuelConsumptionPerHour(row);
  const specificFuelConsumption = calculateSpecificFuelConsumption({
    ...row,
    units_generated_per_hour_kWh: unitsGeneratedPerHour,
    fuel_consumption_per_hour_liters: fuelConsumptionPerHour,
  });
  const costDifference = calculateCostDifference({
    ...row,
    dg_cost_per_kWh_rs: dgCostPerKWh,
  });

  return {
    id: getId(row),
    _id: getId(row),
    sr_no: index + 1,

    dg_set_id: linkedDGSetId,
    dg_set: dgSet,

    audit_date: row?.audit_date || null,
    audit_date_label: formatDate(row?.audit_date),

    dg_name: dgSet?.dg_number || "",
    dg_make_model: dgSet?.make_model || "",
    rated_capacity_kVA: dgSet?.rated_capacity_kVA ?? null,
    rated_active_power_kW: dgSet?.rated_active_power_kW ?? null,
    rated_voltage_V: dgSet?.rated_voltage_V ?? null,
    rated_speed_RPM: dgSet?.rated_speed_RPM ?? null,
    fuel_type: dgSet?.fuel_type || "",
    year_of_installation: dgSet?.year_of_installation ?? null,

    measured_voltage_LL: normalizeNumber(row?.measured_voltage_LL),
    measured_current_avg: normalizeNumber(row?.measured_current_avg),
    measured_kW_output: normalizeNumber(row?.measured_kW_output),
    measured_kVA_output: normalizeNumber(row?.measured_kVA_output),
    power_factor: normalizeNumber(row?.power_factor),
    frequency_Hz: normalizeNumber(row?.frequency_Hz),

    max_load_observed_kW: normalizeNumber(row?.max_load_observed_kW),
    min_load_observed_kW: normalizeNumber(row?.min_load_observed_kW),
    average_loading_percent: averageLoadingPercent,
    load_factor_percent: normalizeNumber(row?.load_factor_percent),

    idle_running_observed: row?.idle_running_observed ?? null,
    parallel_operation: row?.parallel_operation ?? null,

    annual_fuel_consumption_liters: normalizeNumber(
      row?.annual_fuel_consumption_liters,
    ),
    units_generated_per_year_kWh: normalizeNumber(
      row?.units_generated_per_year_kWh,
    ),
    total_working_hours_per_year: normalizeNumber(
      row?.total_working_hours_per_year,
    ),
    units_generated_per_hour_kWh: unitsGeneratedPerHour,
    fuel_consumption_per_hour_liters: fuelConsumptionPerHour,

    fuel_consumption_during_test_lph: normalizeNumber(
      row?.fuel_consumption_during_test_lph,
    ),
    units_generated_during_test_kWh: normalizeNumber(
      row?.units_generated_during_test_kWh,
    ),

    specific_fuel_consumption_l_per_kWh: specificFuelConsumption,
    manufacturer_sfc_l_per_kWh: normalizeNumber(
      row?.manufacturer_sfc_l_per_kWh,
    ),
    sfc_deviation_percent: normalizeNumber(row?.sfc_deviation_percent),

    fuel_cost_rs_per_liter: normalizeNumber(row?.fuel_cost_rs_per_liter),
    annual_fuel_cost_rs: annualFuelCost,
    dg_cost_per_kWh_rs: dgCostPerKWh,
    grid_cost_per_kWh_rs: normalizeNumber(row?.grid_cost_per_kWh_rs),
    cost_difference_rs_per_kWh: costDifference,

    calculated_efficiency_percent: normalizeNumber(
      row?.calculated_efficiency_percent,
    ),
    manufacturer_efficiency_percent: normalizeNumber(
      row?.manufacturer_efficiency_percent,
    ),
    efficiency_deviation_percent: normalizeNumber(
      row?.efficiency_deviation_percent,
    ),

    exhaust_temperature_C: normalizeNumber(row?.exhaust_temperature_C),
    cooling_water_temperature_C: normalizeNumber(
      row?.cooling_water_temperature_C,
    ),
    lube_oil_pressure_bar: normalizeNumber(row?.lube_oil_pressure_bar),
    lube_oil_consumption_liters_per_year: normalizeNumber(
      row?.lube_oil_consumption_liters_per_year,
    ),

    total_operating_hours: normalizeNumber(row?.total_operating_hours),
    hours_since_last_overhaul: normalizeNumber(row?.hours_since_last_overhaul),

    air_fuel_filter_condition: normalizeText(row?.air_fuel_filter_condition),
    visible_smoke_or_abnormal_vibration:
      row?.visible_smoke_or_abnormal_vibration ?? null,

    created_at: row?.created_at || row?.createdAt || null,
    updated_at: row?.updated_at || row?.updatedAt || null,
  };
};

const buildSummary = (items = []) => {
  const avg = (key, decimals = 2) => {
    const valid = items
      .map((item) => normalizeNumber(item[key]))
      .filter((value) => value !== null);

    if (!valid.length) return null;

    const sum = valid.reduce((acc, value) => acc + value, 0);
    return Number((sum / valid.length).toFixed(decimals));
  };

  const latestAuditDate =
    items
      .map((item) => item.audit_date)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0] || null;

  return {
    total_dg_audit_records: items.length,
    average_measured_kW_output: avg("measured_kW_output"),
    average_measured_kVA_output: avg("measured_kVA_output"),
    average_power_factor: avg("power_factor", 4),
    average_dg_cost_per_kWh_rs: avg("dg_cost_per_kWh_rs", 4),
    average_grid_cost_per_kWh_rs: avg("grid_cost_per_kWh_rs", 4),
    average_loading_percent: avg("average_loading_percent"),
    average_specific_fuel_consumption_l_per_kWh: avg(
      "specific_fuel_consumption_l_per_kWh",
      4,
    ),
    average_efficiency_percent: avg("calculated_efficiency_percent"),
    latest_audit_date: latestAuditDate,
    latest_audit_date_label: formatDate(latestAuditDate),
  };
};

export const buildDGSection = async ({
  facility,
  utilityAccount = null,
  scope = "facility",
}) => {
  const facilityId = getId(facility);
  const utilityAccountId = getId(utilityAccount);

  const query =
    scope === "utility_account"
      ? { utility_account_id: utilityAccountId }
      : { facility_id: facilityId };

  const rows = await DGAuditRecord.find(query)
    .populate("dg_set_id")
    .sort({ audit_date: -1, created_at: -1, createdAt: -1 })
    .lean();

  const dgSets = await fetchFacilityDGSets(
    facilityId,
    scope === "utility_account" ? utilityAccountId : null,
  );

  const dgSetMap = buildDGSetMap(dgSets);

  const mergedRows = (rows || []).map((row) => {
    const dgSetId = getId(row?.dg_set_id);
    if (dgSetId && dgSetMap.has(dgSetId)) {
      return {
        ...row,
        dg_set_id: {
          ...dgSetMap.get(dgSetId),
          ...(row.dg_set_id || {}),
        },
      };
    }
    return row;
  });

  const items = mergedRows.map((row, index) =>
    normalizeDGAuditRecord(row, index, dgSetMap),
  );

  const summary = buildSummary(items);

  return {
    title: "DG Audit Records",
    key: "dg_audit_records",
    scope,
    items,
    summary,

    sections: [
      {
        heading: "DG Basic Details",
        columns: [
          "sr_no",
          "dg_name",
          "dg_make_model",
          "fuel_type",
          "rated_capacity_kVA",
          "rated_active_power_kW",
          "year_of_installation",
          "audit_date_label",
        ],
        rows: items.map((item) => ({
          sr_no: item.sr_no,
          dg_name: item.dg_name,
          dg_make_model: item.dg_make_model,
          fuel_type: item.fuel_type,
          rated_capacity_kVA:
            item.rated_capacity_kVA !== null
              ? formatNumber(item.rated_capacity_kVA)
              : "",
          rated_active_power_kW:
            item.rated_active_power_kW !== null
              ? formatNumber(item.rated_active_power_kW)
              : "",
          year_of_installation:
            item.year_of_installation !== null ? item.year_of_installation : "",
          audit_date_label: item.audit_date_label,
        })),
      },

      {
        heading: "Electrical Measurements",
        columns: [
          "sr_no",
          "dg_name",
          "measured_voltage_LL",
          "measured_current_avg",
          "frequency_Hz",
          "measured_kW_output",
          "measured_kVA_output",
          "power_factor",
        ],
        rows: items.map((item) => ({
          sr_no: item.sr_no,
          dg_name: item.dg_name,
          measured_voltage_LL:
            item.measured_voltage_LL !== null
              ? formatNumber(item.measured_voltage_LL)
              : "",
          measured_current_avg:
            item.measured_current_avg !== null
              ? formatNumber(item.measured_current_avg)
              : "",
          frequency_Hz:
            item.frequency_Hz !== null ? formatNumber(item.frequency_Hz) : "",
          measured_kW_output:
            item.measured_kW_output !== null
              ? formatNumber(item.measured_kW_output)
              : "",
          measured_kVA_output:
            item.measured_kVA_output !== null
              ? formatNumber(item.measured_kVA_output)
              : "",
          power_factor:
            item.power_factor !== null
              ? formatNumber(item.power_factor, 4)
              : "",
        })),
      },

      {
        heading: "Load Analysis",
        columns: [
          "sr_no",
          "dg_name",
          "max_load_observed_kW",
          "min_load_observed_kW",
          "average_loading_percent",
          "load_factor_percent",
          "idle_running_observed",
          "parallel_operation",
        ],
        rows: items.map((item) => ({
          sr_no: item.sr_no,
          dg_name: item.dg_name,
          max_load_observed_kW:
            item.max_load_observed_kW !== null
              ? formatNumber(item.max_load_observed_kW)
              : "",
          min_load_observed_kW:
            item.min_load_observed_kW !== null
              ? formatNumber(item.min_load_observed_kW)
              : "",
          average_loading_percent:
            item.average_loading_percent !== null
              ? formatNumber(item.average_loading_percent)
              : "",
          load_factor_percent:
            item.load_factor_percent !== null
              ? formatNumber(item.load_factor_percent)
              : "",
          idle_running_observed:
            item.idle_running_observed === null
              ? ""
              : item.idle_running_observed
                ? "Yes"
                : "No",
          parallel_operation:
            item.parallel_operation === null
              ? ""
              : item.parallel_operation
                ? "Yes"
                : "No",
        })),
      },

      {
        heading: "Fuel & Generation",
        columns: [
          "sr_no",
          "dg_name",
          "annual_fuel_consumption_liters",
          "units_generated_per_year_kWh",
          "total_working_hours_per_year",
          "fuel_consumption_per_hour_liters",
          "units_generated_per_hour_kWh",
          "specific_fuel_consumption_l_per_kWh",
        ],
        rows: items.map((item) => ({
          sr_no: item.sr_no,
          dg_name: item.dg_name,
          annual_fuel_consumption_liters:
            item.annual_fuel_consumption_liters !== null
              ? formatNumber(item.annual_fuel_consumption_liters)
              : "",
          units_generated_per_year_kWh:
            item.units_generated_per_year_kWh !== null
              ? formatNumber(item.units_generated_per_year_kWh)
              : "",
          total_working_hours_per_year:
            item.total_working_hours_per_year !== null
              ? formatNumber(item.total_working_hours_per_year)
              : "",
          fuel_consumption_per_hour_liters:
            item.fuel_consumption_per_hour_liters !== null
              ? formatNumber(item.fuel_consumption_per_hour_liters, 4)
              : "",
          units_generated_per_hour_kWh:
            item.units_generated_per_hour_kWh !== null
              ? formatNumber(item.units_generated_per_hour_kWh, 4)
              : "",
          specific_fuel_consumption_l_per_kWh:
            item.specific_fuel_consumption_l_per_kWh !== null
              ? formatNumber(item.specific_fuel_consumption_l_per_kWh, 4)
              : "",
        })),
      },

      {
        heading: "Cost Analysis",
        columns: [
          "sr_no",
          "dg_name",
          "fuel_cost_rs_per_liter",
          "annual_fuel_cost_rs",
          "dg_cost_per_kWh_rs",
          "grid_cost_per_kWh_rs",
          "cost_difference_rs_per_kWh",
        ],
        rows: items.map((item) => ({
          sr_no: item.sr_no,
          dg_name: item.dg_name,
          fuel_cost_rs_per_liter:
            item.fuel_cost_rs_per_liter !== null
              ? formatNumber(item.fuel_cost_rs_per_liter)
              : "",
          annual_fuel_cost_rs:
            item.annual_fuel_cost_rs !== null
              ? formatNumber(item.annual_fuel_cost_rs)
              : "",
          dg_cost_per_kWh_rs:
            item.dg_cost_per_kWh_rs !== null
              ? formatNumber(item.dg_cost_per_kWh_rs, 4)
              : "",
          grid_cost_per_kWh_rs:
            item.grid_cost_per_kWh_rs !== null
              ? formatNumber(item.grid_cost_per_kWh_rs, 4)
              : "",
          cost_difference_rs_per_kWh:
            item.cost_difference_rs_per_kWh !== null
              ? formatNumber(item.cost_difference_rs_per_kWh)
              : "",
        })),
      },

      {
        heading: "Efficiency & Operating Conditions",
        columns: [
          "sr_no",
          "dg_name",
          "calculated_efficiency_percent",
          "manufacturer_efficiency_percent",
          "efficiency_deviation_percent",
          "exhaust_temperature_C",
          "cooling_water_temperature_C",
          "lube_oil_pressure_bar",
        ],
        rows: items.map((item) => ({
          sr_no: item.sr_no,
          dg_name: item.dg_name,
          calculated_efficiency_percent:
            item.calculated_efficiency_percent !== null
              ? formatNumber(item.calculated_efficiency_percent)
              : "",
          manufacturer_efficiency_percent:
            item.manufacturer_efficiency_percent !== null
              ? formatNumber(item.manufacturer_efficiency_percent)
              : "",
          efficiency_deviation_percent:
            item.efficiency_deviation_percent !== null
              ? formatNumber(item.efficiency_deviation_percent)
              : "",
          exhaust_temperature_C:
            item.exhaust_temperature_C !== null
              ? formatNumber(item.exhaust_temperature_C)
              : "",
          cooling_water_temperature_C:
            item.cooling_water_temperature_C !== null
              ? formatNumber(item.cooling_water_temperature_C)
              : "",
          lube_oil_pressure_bar:
            item.lube_oil_pressure_bar !== null
              ? formatNumber(item.lube_oil_pressure_bar)
              : "",
        })),
      },

      {
        heading: "Maintenance & Condition",
        columns: [
          "sr_no",
          "dg_name",
          "total_operating_hours",
          "hours_since_last_overhaul",
          "air_fuel_filter_condition",
          "visible_smoke_or_abnormal_vibration",
        ],
        rows: items.map((item) => ({
          sr_no: item.sr_no,
          dg_name: item.dg_name,
          total_operating_hours:
            item.total_operating_hours !== null
              ? formatNumber(item.total_operating_hours)
              : "",
          hours_since_last_overhaul:
            item.hours_since_last_overhaul !== null
              ? formatNumber(item.hours_since_last_overhaul)
              : "",
          air_fuel_filter_condition: item.air_fuel_filter_condition,
          visible_smoke_or_abnormal_vibration:
            item.visible_smoke_or_abnormal_vibration === null
              ? ""
              : item.visible_smoke_or_abnormal_vibration
                ? "Yes"
                : "No",
        })),
      },

      {
        heading: "DG Audit Summary",
        columns: ["metric", "value"],
        rows: [
          {
            metric: "Total DG Audit Records",
            value: summary.total_dg_audit_records ?? "",
          },
          {
            metric: "Average Measured kW Output",
            value:
              summary.average_measured_kW_output !== null
                ? formatNumber(summary.average_measured_kW_output)
                : "",
          },
          {
            metric: "Average Measured kVA Output",
            value:
              summary.average_measured_kVA_output !== null
                ? formatNumber(summary.average_measured_kVA_output)
                : "",
          },
          {
            metric: "Average Power Factor",
            value:
              summary.average_power_factor !== null
                ? formatNumber(summary.average_power_factor, 4)
                : "",
          },
          {
            metric: "Average DG Cost per kWh (Rs)",
            value:
              summary.average_dg_cost_per_kWh_rs !== null
                ? formatNumber(summary.average_dg_cost_per_kWh_rs, 4)
                : "",
          },
          {
            metric: "Average Grid Cost per kWh (Rs)",
            value:
              summary.average_grid_cost_per_kWh_rs !== null
                ? formatNumber(summary.average_grid_cost_per_kWh_rs, 4)
                : "",
          },
          {
            metric: "Average Loading (%)",
            value:
              summary.average_loading_percent !== null
                ? formatNumber(summary.average_loading_percent)
                : "",
          },
          {
            metric: "Average Specific Fuel Consumption (L/kWh)",
            value:
              summary.average_specific_fuel_consumption_l_per_kWh !== null
                ? formatNumber(
                    summary.average_specific_fuel_consumption_l_per_kWh,
                    4,
                  )
                : "",
          },
          {
            metric: "Average Calculated Efficiency (%)",
            value:
              summary.average_efficiency_percent !== null
                ? formatNumber(summary.average_efficiency_percent)
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
      { key: "dg_name", label: "DG Name" },
      { key: "audit_date_label", label: "Audit Date" },
      { key: "measured_kW_output", label: "Measured kW" },
      { key: "measured_kVA_output", label: "Measured kVA" },
      { key: "power_factor", label: "Power Factor" },
      { key: "dg_cost_per_kWh_rs", label: "DG Cost/kWh (Rs)" },
      { key: "grid_cost_per_kWh_rs", label: "Grid Cost/kWh (Rs)" },
      { key: "average_loading_percent", label: "Loading (%)" },
    ],

    table_rows: items.map((item) => ({
      sr_no: item.sr_no,
      dg_name: item.dg_name,
      audit_date_label: item.audit_date_label,
      measured_kW_output:
        item.measured_kW_output !== null
          ? formatNumber(item.measured_kW_output)
          : "",
      measured_kVA_output:
        item.measured_kVA_output !== null
          ? formatNumber(item.measured_kVA_output)
          : "",
      power_factor:
        item.power_factor !== null ? formatNumber(item.power_factor, 4) : "",
      dg_cost_per_kWh_rs:
        item.dg_cost_per_kWh_rs !== null
          ? formatNumber(item.dg_cost_per_kWh_rs, 4)
          : "",
      grid_cost_per_kWh_rs:
        item.grid_cost_per_kWh_rs !== null
          ? formatNumber(item.grid_cost_per_kWh_rs, 4)
          : "",
      average_loading_percent:
        item.average_loading_percent !== null
          ? formatNumber(item.average_loading_percent)
          : "",
    })),
  };
};

export default buildDGSection;
