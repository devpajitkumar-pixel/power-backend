import TransformerAuditRecord from "../../../../modals/transformerAuditRecord.js";
import Transformer from "../../../../modals/transformer.js";

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

const buildTransformerMap = (transformers = []) => {
  return new Map(
    transformers
      .filter(Boolean)
      .map((transformer) => [getId(transformer), transformer]),
  );
};

const normalizeTransformerMini = (transformer) => {
  if (!transformer) return null;

  return {
    id: getId(transformer),
    transformer_tag: normalizeText(transformer?.transformer_tag),
    rated_capacity_kVA: normalizeNumber(transformer?.rated_capacity_kVA),
    type_of_cooling: normalizeText(transformer?.type_of_cooling),
    rated_HV_kV: normalizeNumber(transformer?.rated_HV_kV),
    rated_LV_V: normalizeNumber(transformer?.rated_LV_V),
    rated_HV_current_A: normalizeNumber(transformer?.rated_HV_current_A),
    rated_LV_current_A: normalizeNumber(transformer?.rated_LV_current_A),
    no_load_loss_kW: normalizeNumber(transformer?.no_load_loss_kW),
    full_load_loss_kW: normalizeNumber(transformer?.full_load_loss_kW),
    nameplate_efficiency_percent: normalizeNumber(
      transformer?.nameplate_efficiency_percent,
    ),
  };
};

const fetchFacilityTransformers = async (
  facilityId,
  utilityAccountId = null,
) => {
  if (!facilityId) return [];

  const query = { facility_id: facilityId };
  if (utilityAccountId) query.utility_account_id = utilityAccountId;

  const transformers = await Transformer.find(query).lean();
  return Array.isArray(transformers) ? transformers : [];
};

const calculatePercentLoading = (row, transformer) => {
  const existing = normalizeNumber(row?.percent_loading);
  if (existing !== null) return existing;

  const avgLoad = normalizeNumber(row?.average_load_kVA);
  const ratedCapacity =
    normalizeNumber(row?.rated_capacity_kVA) ??
    normalizeNumber(transformer?.rated_capacity_kVA);

  if (avgLoad !== null && ratedCapacity !== null && ratedCapacity > 0) {
    return Number(((avgLoad / ratedCapacity) * 100).toFixed(2));
  }

  return null;
};

const calculateTotalLossesKW = (row, transformer) => {
  const existing = normalizeNumber(row?.total_losses_kW);
  if (existing !== null) return existing;

  const noLoadLoss =
    normalizeNumber(row?.no_load_loss_kW) ??
    normalizeNumber(transformer?.no_load_loss_kW);

  const fullLoadLoss =
    normalizeNumber(row?.full_load_loss_kW) ??
    normalizeNumber(transformer?.full_load_loss_kW);

  const percentLoading = calculatePercentLoading(row, transformer);

  if (noLoadLoss !== null && fullLoadLoss !== null && percentLoading !== null) {
    return Number(
      (noLoadLoss + fullLoadLoss * (percentLoading / 100)).toFixed(2),
    );
  }

  return null;
};

const calculateAnnualEnergyLosses = (row, transformer) => {
  const existing = normalizeNumber(row?.annual_energy_losses_kWh);
  if (existing !== null) return existing;

  const totalLossesKW = calculateTotalLossesKW(row, transformer);
  const operatingHoursPerYear = normalizeNumber(row?.operating_hours_per_year);

  if (totalLossesKW !== null && operatingHoursPerYear !== null) {
    return Number((totalLossesKW * operatingHoursPerYear).toFixed(2));
  }

  return null;
};

const calculateCostOfLosses = (row, transformer) => {
  const existing = normalizeNumber(row?.cost_of_losses_rs);
  if (existing !== null) return existing;

  const annualLosses = calculateAnnualEnergyLosses(row, transformer);
  const perUnitCost = normalizeNumber(row?.per_unit_cost_rs);

  if (annualLosses !== null && perUnitCost !== null) {
    return Number((annualLosses * perUnitCost).toFixed(2));
  }

  return null;
};

const calculateLoadFactor = (row) => {
  const existing = normalizeNumber(row?.load_factor_percent);
  if (existing !== null) return existing;

  const averageLoad = normalizeNumber(row?.average_load_kVA);
  const maximumLoad = normalizeNumber(row?.max_load_kVA);

  if (averageLoad !== null && maximumLoad !== null && maximumLoad > 0) {
    return Number(((averageLoad / maximumLoad) * 100).toFixed(2));
  }

  return null;
};

const normalizeTransformerAuditRecord = (row, index, transformerMap) => {
  const linkedTransformer =
    transformerMap.get(getId(row?.transformer_id)) ||
    row?.transformer_id ||
    null;

  const transformer = normalizeTransformerMini(linkedTransformer);

  const percentLoading = calculatePercentLoading(row, transformer);
  const totalLossesKW = calculateTotalLossesKW(row, transformer);
  const annualEnergyLosses = calculateAnnualEnergyLosses(row, transformer);
  const costOfLosses = calculateCostOfLosses(row, transformer);
  const loadFactorPercent = calculateLoadFactor(row);

  return {
    id: getId(row),
    sr_no: index + 1,

    transformer_id: getId(row?.transformer_id),
    transformer,

    audit_date: row?.audit_date || null,
    audit_date_label: formatDate(row?.audit_date),

    transformer_tag: transformer?.transformer_tag || "",
    rated_capacity_kVA: transformer?.rated_capacity_kVA ?? null,
    type_of_cooling: transformer?.type_of_cooling || "",
    rated_HV_kV: transformer?.rated_HV_kV ?? null,
    rated_LV_V: transformer?.rated_LV_V ?? null,
    rated_HV_current_A: transformer?.rated_HV_current_A ?? null,
    rated_LV_current_A: transformer?.rated_LV_current_A ?? null,
    no_load_loss_kW: transformer?.no_load_loss_kW ?? null,
    full_load_loss_kW: transformer?.full_load_loss_kW ?? null,
    nameplate_efficiency_percent:
      transformer?.nameplate_efficiency_percent ?? null,

    average_load_kVA: normalizeNumber(row?.average_load_kVA),
    max_load_kVA: normalizeNumber(row?.max_load_kVA),
    percent_loading: percentLoading,
    load_factor_percent: loadFactorPercent,

    operating_hours_per_year: normalizeNumber(row?.operating_hours_per_year),
    annual_energy_supplied_kWh: normalizeNumber(
      row?.annual_energy_supplied_kWh,
    ),
    annual_energy_losses_kWh: annualEnergyLosses,
    total_losses_kW: totalLossesKW,

    per_unit_cost_rs: normalizeNumber(row?.per_unit_cost_rs),
    cost_of_losses_rs: costOfLosses,

    power_factor_LT: normalizeNumber(row?.power_factor_LT),
    harmonics_THD_percent: normalizeNumber(row?.harmonics_THD_percent),

    neutral_earth_resistance_ohms: normalizeNumber(
      row?.neutral_earth_resistance_ohms,
    ),
    body_to_earth_resistance_ohms: normalizeNumber(
      row?.body_to_earth_resistance_ohms,
    ),

    silica_gel_cobalt_type: normalizeText(row?.silica_gel_cobalt_type),
    silica_gel_non_cobalt_type: normalizeText(row?.silica_gel_non_cobalt_type),
    oil_level: normalizeText(row?.oil_level),

    line_voltage_Vr: normalizeNumber(row?.line_voltage_Vr),
    line_voltage_Vy: normalizeNumber(row?.line_voltage_Vy),
    line_voltage_Vb: normalizeNumber(row?.line_voltage_Vb),

    phase_voltage_Vr_n: normalizeNumber(row?.phase_voltage_Vr_n),
    phase_voltage_Vy_n: normalizeNumber(row?.phase_voltage_Vy_n),
    phase_voltage_Vb_n: normalizeNumber(row?.phase_voltage_Vb_n),

    line_current_Ir: normalizeNumber(row?.line_current_Ir),
    line_current_Iy: normalizeNumber(row?.line_current_Iy),
    line_current_Ib: normalizeNumber(row?.line_current_Ib),

    // not present in current schema, keep safe fallbacks
    observation: normalizeText(row?.observation),
    recommendation: normalizeText(row?.recommendation),
    remarks: normalizeText(row?.remarks),

    created_at: row?.createdAt || row?.created_at || null,
    updated_at: row?.updatedAt || row?.updated_at || null,
  };
};

const buildSummary = (items = []) => {
  const totalEnergyLosses = items.reduce(
    (sum, item) => sum + (normalizeNumber(item.annual_energy_losses_kWh) || 0),
    0,
  );

  const totalEnergySupplied = items.reduce(
    (sum, item) =>
      sum + (normalizeNumber(item.annual_energy_supplied_kWh) || 0),
    0,
  );

  const totalCostOfLosses = items.reduce(
    (sum, item) => sum + (normalizeNumber(item.cost_of_losses_rs) || 0),
    0,
  );

  const validLoadingItems = items.filter(
    (item) => normalizeNumber(item.percent_loading) !== null,
  );

  const validPfItems = items.filter(
    (item) => normalizeNumber(item.power_factor_LT) !== null,
  );

  const validLoadFactorItems = items.filter(
    (item) => normalizeNumber(item.load_factor_percent) !== null,
  );

  const latestAuditDate =
    items
      .map((item) => item.audit_date)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0] || null;

  return {
    total_transformer_audit_records: items.length,
    total_annual_energy_supplied_kWh: Number(totalEnergySupplied.toFixed(2)),
    total_annual_energy_losses_kWh: Number(totalEnergyLosses.toFixed(2)),
    total_cost_of_losses_rs: Number(totalCostOfLosses.toFixed(2)),

    average_percent_loading:
      validLoadingItems.length > 0
        ? Number(
            (
              validLoadingItems.reduce(
                (sum, item) =>
                  sum + (normalizeNumber(item.percent_loading) || 0),
                0,
              ) / validLoadingItems.length
            ).toFixed(2),
          )
        : null,

    average_power_factor_LT:
      validPfItems.length > 0
        ? Number(
            (
              validPfItems.reduce(
                (sum, item) =>
                  sum + (normalizeNumber(item.power_factor_LT) || 0),
                0,
              ) / validPfItems.length
            ).toFixed(3),
          )
        : null,

    average_load_factor_percent:
      validLoadFactorItems.length > 0
        ? Number(
            (
              validLoadFactorItems.reduce(
                (sum, item) =>
                  sum + (normalizeNumber(item.load_factor_percent) || 0),
                0,
              ) / validLoadFactorItems.length
            ).toFixed(2),
          )
        : null,

    latest_audit_date: latestAuditDate,
    latest_audit_date_label: formatDate(latestAuditDate),
  };
};

export const buildTransformerSection = async ({
  facility,
  utilityAccount = null,
  scope = "facility",
}) => {
  const query =
    scope === "utility_account"
      ? { utility_account_id: getId(utilityAccount) }
      : { facility_id: getId(facility) };

  const rows = await TransformerAuditRecord.find(query)
    .populate("transformer_id")
    .sort({ audit_date: -1, created_at: -1, createdAt: -1 })
    .lean();

  const transformers = await fetchFacilityTransformers(
    getId(facility),
    scope === "utility_account" ? getId(utilityAccount) : null,
  );

  const transformerMap = buildTransformerMap(transformers);

  const items = (rows || []).map((row, index) =>
    normalizeTransformerAuditRecord(row, index, transformerMap),
  );

  const summary = buildSummary(items);

  return {
    title: "Transformer Audit Records",
    scope,
    items,
    summary,

    sections: [
      {
        heading: "Transformer Basic Details",
        columns: [
          "sr_no",
          "transformer_tag",
          "rated_capacity_kVA",
          "type_of_cooling",
          "rated_HV_kV",
          "rated_LV_V",
          "no_load_loss_kW",
          "full_load_loss_kW",
          "audit_date_label",
        ],
        rows: items.map((item) => ({
          sr_no: item.sr_no,
          transformer_tag: item.transformer_tag,
          rated_capacity_kVA:
            item.rated_capacity_kVA !== null
              ? formatNumber(item.rated_capacity_kVA)
              : "",
          type_of_cooling: item.type_of_cooling,
          rated_HV_kV:
            item.rated_HV_kV !== null ? formatNumber(item.rated_HV_kV) : "",
          rated_LV_V:
            item.rated_LV_V !== null ? formatNumber(item.rated_LV_V) : "",
          no_load_loss_kW:
            item.no_load_loss_kW !== null
              ? formatNumber(item.no_load_loss_kW)
              : "",
          full_load_loss_kW:
            item.full_load_loss_kW !== null
              ? formatNumber(item.full_load_loss_kW)
              : "",
          audit_date_label: item.audit_date_label,
        })),
      },

      {
        heading: "Load & Electrical Measurements",
        columns: [
          "sr_no",
          "transformer_tag",
          "average_load_kVA",
          "max_load_kVA",
          "percent_loading",
          "load_factor_percent",
          "power_factor_LT",
          "harmonics_THD_percent",
        ],
        rows: items.map((item) => ({
          sr_no: item.sr_no,
          transformer_tag: item.transformer_tag,
          average_load_kVA:
            item.average_load_kVA !== null
              ? formatNumber(item.average_load_kVA)
              : "",
          max_load_kVA:
            item.max_load_kVA !== null ? formatNumber(item.max_load_kVA) : "",
          percent_loading:
            item.percent_loading !== null
              ? formatNumber(item.percent_loading)
              : "",
          load_factor_percent:
            item.load_factor_percent !== null
              ? formatNumber(item.load_factor_percent)
              : "",
          power_factor_LT:
            item.power_factor_LT !== null
              ? formatNumber(item.power_factor_LT, 3)
              : "",
          harmonics_THD_percent:
            item.harmonics_THD_percent !== null
              ? formatNumber(item.harmonics_THD_percent)
              : "",
        })),
      },

      {
        heading: "Voltage & Current Measurements",
        columns: [
          "sr_no",
          "transformer_tag",
          "line_voltage_Vr",
          "line_voltage_Vy",
          "line_voltage_Vb",
          "phase_voltage_Vr_n",
          "phase_voltage_Vy_n",
          "phase_voltage_Vb_n",
          "line_current_Ir",
          "line_current_Iy",
          "line_current_Ib",
        ],
        rows: items.map((item) => ({
          sr_no: item.sr_no,
          transformer_tag: item.transformer_tag,
          line_voltage_Vr:
            item.line_voltage_Vr !== null
              ? formatNumber(item.line_voltage_Vr)
              : "",
          line_voltage_Vy:
            item.line_voltage_Vy !== null
              ? formatNumber(item.line_voltage_Vy)
              : "",
          line_voltage_Vb:
            item.line_voltage_Vb !== null
              ? formatNumber(item.line_voltage_Vb)
              : "",
          phase_voltage_Vr_n:
            item.phase_voltage_Vr_n !== null
              ? formatNumber(item.phase_voltage_Vr_n)
              : "",
          phase_voltage_Vy_n:
            item.phase_voltage_Vy_n !== null
              ? formatNumber(item.phase_voltage_Vy_n)
              : "",
          phase_voltage_Vb_n:
            item.phase_voltage_Vb_n !== null
              ? formatNumber(item.phase_voltage_Vb_n)
              : "",
          line_current_Ir:
            item.line_current_Ir !== null
              ? formatNumber(item.line_current_Ir)
              : "",
          line_current_Iy:
            item.line_current_Iy !== null
              ? formatNumber(item.line_current_Iy)
              : "",
          line_current_Ib:
            item.line_current_Ib !== null
              ? formatNumber(item.line_current_Ib)
              : "",
        })),
      },

      {
        heading: "Losses & Energy Analysis",
        columns: [
          "sr_no",
          "transformer_tag",
          "annual_energy_supplied_kWh",
          "total_losses_kW",
          "annual_energy_losses_kWh",
          "per_unit_cost_rs",
          "cost_of_losses_rs",
          "operating_hours_per_year",
        ],
        rows: items.map((item) => ({
          sr_no: item.sr_no,
          transformer_tag: item.transformer_tag,
          annual_energy_supplied_kWh:
            item.annual_energy_supplied_kWh !== null
              ? formatNumber(item.annual_energy_supplied_kWh)
              : "",
          total_losses_kW:
            item.total_losses_kW !== null
              ? formatNumber(item.total_losses_kW)
              : "",
          annual_energy_losses_kWh:
            item.annual_energy_losses_kWh !== null
              ? formatNumber(item.annual_energy_losses_kWh)
              : "",
          per_unit_cost_rs:
            item.per_unit_cost_rs !== null
              ? formatNumber(item.per_unit_cost_rs)
              : "",
          cost_of_losses_rs:
            item.cost_of_losses_rs !== null
              ? formatNumber(item.cost_of_losses_rs)
              : "",
          operating_hours_per_year:
            item.operating_hours_per_year !== null
              ? formatNumber(item.operating_hours_per_year)
              : "",
        })),
      },

      {
        heading: "Maintenance & Safety",
        columns: [
          "sr_no",
          "transformer_tag",
          "silica_gel_cobalt_type",
          "silica_gel_non_cobalt_type",
          "oil_level",
          "neutral_earth_resistance_ohms",
          "body_to_earth_resistance_ohms",
        ],
        rows: items.map((item) => ({
          sr_no: item.sr_no,
          transformer_tag: item.transformer_tag,
          silica_gel_cobalt_type: item.silica_gel_cobalt_type,
          silica_gel_non_cobalt_type: item.silica_gel_non_cobalt_type,
          oil_level: item.oil_level,
          neutral_earth_resistance_ohms:
            item.neutral_earth_resistance_ohms !== null
              ? formatNumber(item.neutral_earth_resistance_ohms)
              : "",
          body_to_earth_resistance_ohms:
            item.body_to_earth_resistance_ohms !== null
              ? formatNumber(item.body_to_earth_resistance_ohms)
              : "",
        })),
      },

      {
        heading: "Observations & Recommendations",
        columns: [
          "sr_no",
          "transformer_tag",
          "observation",
          "recommendation",
          "remarks",
        ],
        rows: items.map((item) => ({
          sr_no: item.sr_no,
          transformer_tag: item.transformer_tag,
          observation: item.observation,
          recommendation: item.recommendation,
          remarks: item.remarks,
        })),
      },

      {
        heading: "Transformer Audit Summary",
        columns: ["metric", "value"],
        rows: [
          {
            metric: "Total Transformer Audit Records",
            value: summary.total_transformer_audit_records ?? "",
          },
          {
            metric: "Total Annual Energy Supplied (kWh)",
            value:
              summary.total_annual_energy_supplied_kWh !== null
                ? formatNumber(summary.total_annual_energy_supplied_kWh)
                : "",
          },
          {
            metric: "Total Annual Energy Losses (kWh)",
            value:
              summary.total_annual_energy_losses_kWh !== null
                ? formatNumber(summary.total_annual_energy_losses_kWh)
                : "",
          },
          {
            metric: "Total Cost of Losses (Rs)",
            value:
              summary.total_cost_of_losses_rs !== null
                ? formatNumber(summary.total_cost_of_losses_rs)
                : "",
          },
          {
            metric: "Average Percent Loading (%)",
            value:
              summary.average_percent_loading !== null
                ? formatNumber(summary.average_percent_loading)
                : "",
          },
          {
            metric: "Average Power Factor LT",
            value:
              summary.average_power_factor_LT !== null
                ? formatNumber(summary.average_power_factor_LT, 3)
                : "",
          },
          {
            metric: "Average Load Factor (%)",
            value:
              summary.average_load_factor_percent !== null
                ? formatNumber(summary.average_load_factor_percent)
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
      { key: "transformer_tag", label: "Transformer Tag" },
      { key: "audit_date_label", label: "Audit Date" },
      { key: "average_load_kVA", label: "Average Load (kVA)" },
      { key: "percent_loading", label: "% Loading" },
      {
        key: "annual_energy_supplied_kWh",
        label: "Annual Energy Supplied (kWh)",
      },
      { key: "annual_energy_losses_kWh", label: "Annual Energy Losses (kWh)" },
      { key: "cost_of_losses_rs", label: "Cost of Losses (Rs)" },
      { key: "power_factor_LT", label: "PF LT" },
    ],

    table_rows: items.map((item) => ({
      sr_no: item.sr_no,
      transformer_tag: item.transformer_tag,
      audit_date_label: item.audit_date_label,
      average_load_kVA:
        item.average_load_kVA !== null
          ? formatNumber(item.average_load_kVA)
          : "",
      percent_loading:
        item.percent_loading !== null ? formatNumber(item.percent_loading) : "",
      annual_energy_supplied_kWh:
        item.annual_energy_supplied_kWh !== null
          ? formatNumber(item.annual_energy_supplied_kWh)
          : "",
      annual_energy_losses_kWh:
        item.annual_energy_losses_kWh !== null
          ? formatNumber(item.annual_energy_losses_kWh)
          : "",
      cost_of_losses_rs:
        item.cost_of_losses_rs !== null
          ? formatNumber(item.cost_of_losses_rs)
          : "",
      power_factor_LT:
        item.power_factor_LT !== null
          ? formatNumber(item.power_factor_LT, 3)
          : "",
    })),
  };
};

export default buildTransformerSection;
