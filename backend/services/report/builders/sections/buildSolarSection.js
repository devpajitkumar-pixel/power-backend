import SolarGenerationRecord from "../../../../modals/solarGenerationRecord.js";
import SolarPlant from "../../../../modals/solarPlant.js";

const getId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value?._id) return String(value._id);
  return String(value);
};

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

const formatDateRange = (start, end) => {
  const startLabel = formatDate(start);
  const endLabel = formatDate(end);
  if (startLabel && endLabel) return `${startLabel} - ${endLabel}`;
  return startLabel || endLabel || "";
};

const fetchRecords = async ({ facility, utilityAccount, scope }) => {
  const query = {};

  if (scope === "utility_account") {
    if (!utilityAccount) return [];
    query.utility_account_id = getId(utilityAccount);
  } else {
    query.facility_id = getId(facility);
  }

  return SolarGenerationRecord.find(query)
    .sort({
      solar_plant_id: 1,
      billing_period_end: -1,
      billing_period_start: -1,
      created_at: -1,
      createdAt: -1,
    })
    .lean();
};

const fetchSolarPlants = async ({ facility, utilityAccount, scope }) => {
  const query = {};

  if (scope === "utility_account") {
    if (!utilityAccount) return [];
    query.utility_account_id = getId(utilityAccount);
  } else {
    query.facility_id = getId(facility);
  }

  return SolarPlant.find(query)
    .sort({ plant_name: 1, created_at: 1, createdAt: 1 })
    .lean();
};

const calculateBillingDays = (row) => {
  const existing = normalizeNumber(row?.billing_days);
  if (existing !== null) return existing;

  const start = row?.billing_period_start
    ? new Date(row.billing_period_start)
    : null;
  const end = row?.billing_period_end ? new Date(row.billing_period_end) : null;

  if (
    start &&
    end &&
    !Number.isNaN(start.getTime()) &&
    !Number.isNaN(end.getTime()) &&
    end >= start
  ) {
    const diffMs = end.getTime() - start.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  }

  return null;
};

const calculateNetValue = (importValue, exportValue, existingNet) => {
  const net = normalizeNumber(existingNet);
  if (net !== null) return net;

  const imp = normalizeNumber(importValue);
  const exp = normalizeNumber(exportValue);

  if (imp !== null && exp !== null) {
    return Number((imp - exp).toFixed(2));
  }

  return null;
};

const calculateAverageGenerationPerDay = (generation, billingDays) => {
  const gen = normalizeNumber(generation);
  const days = normalizeNumber(billingDays);

  if (gen !== null && days !== null && days > 0) {
    return Number((gen / days).toFixed(2));
  }

  return null;
};

const calculateSpecificGeneration = (generation, ratingKwp) => {
  const gen = normalizeNumber(generation);
  const cap = normalizeNumber(ratingKwp);

  if (gen !== null && cap !== null && cap > 0) {
    return Number((gen / cap).toFixed(2));
  }

  return null;
};

const calculateExportPercent = (exportKwh, generationKwh) => {
  const exp = normalizeNumber(exportKwh);
  const gen = normalizeNumber(generationKwh);

  if (exp !== null && gen !== null && gen > 0) {
    return Number(((exp / gen) * 100).toFixed(2));
  }

  return null;
};

const calculateImportOffsetPercent = (importKwh, generationKwh) => {
  const imp = normalizeNumber(importKwh);
  const gen = normalizeNumber(generationKwh);

  if (imp !== null && gen !== null && imp > 0) {
    return Number(((gen / imp) * 100).toFixed(2));
  }

  return null;
};

const normalizePlant = (plant, index = 0) => ({
  id: getId(plant),
  sr_no: index + 1,
  plant_name: normalizeText(plant?.plant_name),
  rating_kWp: normalizeNumber(plant?.rating_kWp),
  panel_rating_watt: normalizeNumber(plant?.panel_rating_watt),
  no_of_panels: normalizeNumber(plant?.no_of_panels),
  inverter_make: normalizeText(plant?.inverter_make),
  inverter_rating_kW: normalizeNumber(plant?.inverter_rating_kW),
  audit_date: plant?.audit_date || null,
  audit_date_label: formatDate(plant?.audit_date),
  utility_account_id: getId(plant?.utility_account_id),
  facility_id: getId(plant?.facility_id),
});

const normalizeRecord = (record, plant, index = 0) => {
  const billing_days = calculateBillingDays(record);

  const import_kWh = normalizeNumber(record?.import_kWh);
  const export_kWh = normalizeNumber(record?.export_kWh);
  const net_kWh = calculateNetValue(
    record?.import_kWh,
    record?.export_kWh,
    record?.net_kWh,
  );

  const import_kVAh = normalizeNumber(record?.import_kVAh);
  const export_kVAh = normalizeNumber(record?.export_kVAh);
  const net_kVAh = calculateNetValue(
    record?.import_kVAh,
    record?.export_kVAh,
    record?.net_kVAh,
  );

  const import_kVA = normalizeNumber(record?.import_kVA);
  const export_kVA = normalizeNumber(record?.export_kVA);
  const net_kVA = calculateNetValue(
    record?.import_kVA,
    record?.export_kVA,
    record?.net_kVA,
  );

  const solar_generation_kWh = normalizeNumber(record?.solar_generation_kWh);
  const solar_generation_kVAh = normalizeNumber(record?.solar_generation_kVAh);
  const solar_generation_kVA = normalizeNumber(record?.solar_generation_kVA);

  const average_generation_per_day_kWh = calculateAverageGenerationPerDay(
    solar_generation_kWh,
    billing_days,
  );

  const specific_generation_kWh_per_kWp = calculateSpecificGeneration(
    solar_generation_kWh,
    plant?.rating_kWp,
  );

  const export_percent = calculateExportPercent(
    export_kWh,
    solar_generation_kWh,
  );
  const import_offset_percent = calculateImportOffsetPercent(
    import_kWh,
    solar_generation_kWh,
  );

  return {
    id: getId(record),
    sr_no: index + 1,

    solar_plant_id: getId(record?.solar_plant_id),
    plant_name: plant?.plant_name || "",
    rating_kWp: plant?.rating_kWp ?? null,
    panel_rating_watt: plant?.panel_rating_watt ?? null,
    no_of_panels: plant?.no_of_panels ?? null,
    inverter_make: plant?.inverter_make || "",
    inverter_rating_kW: plant?.inverter_rating_kW ?? null,

    utility_account_id: getId(record?.utility_account_id),
    facility_id: getId(record?.facility_id),

    bill_no: normalizeText(record?.bill_no),
    billing_period_start: record?.billing_period_start || null,
    billing_period_end: record?.billing_period_end || null,
    billing_period_label: formatDateRange(
      record?.billing_period_start,
      record?.billing_period_end,
    ),
    billing_days,

    import_kWh,
    import_kVAh,
    import_kVA,

    export_kWh,
    export_kVAh,
    export_kVA,

    net_kWh,
    net_kVAh,
    net_kVA,

    solar_generation_kWh,
    solar_generation_kVAh,
    solar_generation_kVA,

    average_generation_per_day_kWh,
    specific_generation_kWh_per_kWp,
    export_percent,
    import_offset_percent,

    audit_date: record?.audit_date || null,
    audit_date_label: formatDate(record?.audit_date),
    auditor_id: getId(record?.auditor_id),

    created_at: record?.createdAt || record?.created_at || null,
    updated_at: record?.updatedAt || record?.updated_at || null,
  };
};

const buildPlantGroups = ({ plants = [], records = [] }) => {
  const groups = new Map();

  plants.forEach((plant, index) => {
    const normalizedPlant = normalizePlant(plant, index);
    groups.set(normalizedPlant.id, {
      plant: normalizedPlant,
      records: [],
      summary: null,
    });
  });

  records.forEach((record) => {
    const plantId = getId(record?.solar_plant_id);

    if (!groups.has(plantId)) {
      groups.set(plantId, {
        plant: {
          id: plantId,
          sr_no: groups.size + 1,
          plant_name:
            normalizeText(record?.solar_plant_id?.plant_name) ||
            "Unnamed Plant",
          rating_kWp: normalizeNumber(record?.solar_plant_id?.rating_kWp),
          panel_rating_watt: normalizeNumber(
            record?.solar_plant_id?.panel_rating_watt,
          ),
          no_of_panels: normalizeNumber(record?.solar_plant_id?.no_of_panels),
          inverter_make: normalizeText(record?.solar_plant_id?.inverter_make),
          inverter_rating_kW: normalizeNumber(
            record?.solar_plant_id?.inverter_rating_kW,
          ),
          audit_date: null,
          audit_date_label: "",
        },
        records: [],
        summary: null,
      });
    }

    const bucket = groups.get(plantId);
    const normalizedRecord = normalizeRecord(
      record,
      bucket.plant,
      bucket.records.length,
    );
    bucket.records.push(normalizedRecord);
  });

  return Array.from(groups.values()).map((group) => ({
    ...group,
    summary: buildRecordSummary(group.records),
  }));
};

const buildRecordSummary = (records = []) => {
  const total_import_kWh = records.reduce(
    (sum, row) => sum + (row.import_kWh || 0),
    0,
  );
  const total_export_kWh = records.reduce(
    (sum, row) => sum + (row.export_kWh || 0),
    0,
  );
  const total_net_kWh = records.reduce(
    (sum, row) => sum + (row.net_kWh || 0),
    0,
  );
  const total_solar_generation_kWh = records.reduce(
    (sum, row) => sum + (row.solar_generation_kWh || 0),
    0,
  );

  const avgGenDaySum = records.reduce(
    (sum, row) => sum + (row.average_generation_per_day_kWh || 0),
    0,
  );

  const specGenSum = records.reduce(
    (sum, row) => sum + (row.specific_generation_kWh_per_kWp || 0),
    0,
  );

  const exportPercentSum = records.reduce(
    (sum, row) => sum + (row.export_percent || 0),
    0,
  );

  const importOffsetPercentSum = records.reduce(
    (sum, row) => sum + (row.import_offset_percent || 0),
    0,
  );

  return {
    total_records: records.length,
    total_import_kWh: Number(total_import_kWh.toFixed(2)),
    total_export_kWh: Number(total_export_kWh.toFixed(2)),
    total_net_kWh: Number(total_net_kWh.toFixed(2)),
    total_solar_generation_kWh: Number(total_solar_generation_kWh.toFixed(2)),
    average_generation_per_day_kWh:
      records.length > 0
        ? Number((avgGenDaySum / records.length).toFixed(2))
        : null,
    average_specific_generation_kWh_per_kWp:
      records.length > 0
        ? Number((specGenSum / records.length).toFixed(2))
        : null,
    average_export_percent:
      records.length > 0
        ? Number((exportPercentSum / records.length).toFixed(2))
        : null,
    average_import_offset_percent:
      records.length > 0
        ? Number((importOffsetPercentSum / records.length).toFixed(2))
        : null,
  };
};

const buildOverallSummary = (plantGroups = []) => {
  const allRecords = plantGroups.flatMap((group) => group.records);

  return {
    total_plants: plantGroups.length,
    ...buildRecordSummary(allRecords),
  };
};

export const buildSolarSection = async ({
  report,
  facility,
  utilityAccount = null,
  scope = "facility",
}) => {
  if (!report || !facility) {
    const error = new Error(
      "report and facility are required in buildSolarSection",
    );
    error.statusCode = 500;
    throw error;
  }

  const [plants, records] = await Promise.all([
    fetchSolarPlants({ facility, utilityAccount, scope }),
    fetchRecords({ facility, utilityAccount, scope }),
  ]);

  const plantGroups = buildPlantGroups({ plants, records });
  const overallSummary = buildOverallSummary(plantGroups);

  // backward-compatible flat rows for existing renderers
  const flatItems = plantGroups.flatMap((group) => group.records);

  const sections = [];

  sections.push({
    heading: "Solar Plants Summary",
    columns: [
      "sr_no",
      "plant_name",
      "rating_kWp",
      "panel_rating_watt",
      "no_of_panels",
      "inverter_make",
      "inverter_rating_kW",
      "total_records",
      "total_solar_generation_kWh",
      "average_specific_generation_kWh_per_kWp",
    ],
    rows: plantGroups.map((group) => ({
      sr_no: group.plant.sr_no,
      plant_name: group.plant.plant_name,
      rating_kWp:
        group.plant.rating_kWp !== null
          ? formatNumber(group.plant.rating_kWp)
          : "",
      panel_rating_watt:
        group.plant.panel_rating_watt !== null
          ? formatNumber(group.plant.panel_rating_watt)
          : "",
      no_of_panels:
        group.plant.no_of_panels !== null
          ? formatNumber(group.plant.no_of_panels, 0)
          : "",
      inverter_make: group.plant.inverter_make,
      inverter_rating_kW:
        group.plant.inverter_rating_kW !== null
          ? formatNumber(group.plant.inverter_rating_kW)
          : "",
      total_records: group.summary.total_records,
      total_solar_generation_kWh: formatNumber(
        group.summary.total_solar_generation_kWh,
      ),
      average_specific_generation_kWh_per_kWp:
        group.summary.average_specific_generation_kWh_per_kWp !== null
          ? formatNumber(group.summary.average_specific_generation_kWh_per_kWp)
          : "",
    })),
  });

  plantGroups.forEach((group) => {
    sections.push({
      heading: `${group.plant.plant_name || "Solar Plant"} - Details`,
      columns: ["field", "value"],
      rows: [
        { field: "Plant Name", value: group.plant.plant_name || "" },
        {
          field: "Rating (kWp)",
          value:
            group.plant.rating_kWp !== null
              ? formatNumber(group.plant.rating_kWp)
              : "",
        },
        {
          field: "Panel Rating (Watt)",
          value:
            group.plant.panel_rating_watt !== null
              ? formatNumber(group.plant.panel_rating_watt)
              : "",
        },
        {
          field: "No. of Panels",
          value:
            group.plant.no_of_panels !== null
              ? formatNumber(group.plant.no_of_panels, 0)
              : "",
        },
        { field: "Inverter Make", value: group.plant.inverter_make || "" },
        {
          field: "Inverter Rating (kW)",
          value:
            group.plant.inverter_rating_kW !== null
              ? formatNumber(group.plant.inverter_rating_kW)
              : "",
        },
      ],
    });

    sections.push({
      heading: `${group.plant.plant_name || "Solar Plant"} - Generation Records`,
      columns: [
        "sr_no",
        "bill_no",
        "billing_period_label",
        "billing_days",
        "import_kWh",
        "export_kWh",
        "net_kWh",
        "solar_generation_kWh",
        "average_generation_per_day_kWh",
        "specific_generation_kWh_per_kWp",
      ],
      rows: group.records.map((record) => ({
        sr_no: record.sr_no,
        bill_no: record.bill_no,
        billing_period_label: record.billing_period_label,
        billing_days:
          record.billing_days !== null
            ? formatNumber(record.billing_days, 0)
            : "",
        import_kWh:
          record.import_kWh !== null ? formatNumber(record.import_kWh) : "",
        export_kWh:
          record.export_kWh !== null ? formatNumber(record.export_kWh) : "",
        net_kWh: record.net_kWh !== null ? formatNumber(record.net_kWh) : "",
        solar_generation_kWh:
          record.solar_generation_kWh !== null
            ? formatNumber(record.solar_generation_kWh)
            : "",
        average_generation_per_day_kWh:
          record.average_generation_per_day_kWh !== null
            ? formatNumber(record.average_generation_per_day_kWh)
            : "",
        specific_generation_kWh_per_kWp:
          record.specific_generation_kWh_per_kWp !== null
            ? formatNumber(record.specific_generation_kWh_per_kWp)
            : "",
      })),
    });

    sections.push({
      heading: `${group.plant.plant_name || "Solar Plant"} - Summary`,
      columns: ["metric", "value"],
      rows: [
        { metric: "Total Records", value: group.summary.total_records },
        {
          metric: "Total Import (kWh)",
          value: formatNumber(group.summary.total_import_kWh),
        },
        {
          metric: "Total Export (kWh)",
          value: formatNumber(group.summary.total_export_kWh),
        },
        {
          metric: "Total Net (kWh)",
          value: formatNumber(group.summary.total_net_kWh),
        },
        {
          metric: "Total Solar Generation (kWh)",
          value: formatNumber(group.summary.total_solar_generation_kWh),
        },
        {
          metric: "Average Generation / Day (kWh)",
          value:
            group.summary.average_generation_per_day_kWh !== null
              ? formatNumber(group.summary.average_generation_per_day_kWh)
              : "",
        },
        {
          metric: "Average Specific Generation (kWh/kWp)",
          value:
            group.summary.average_specific_generation_kWh_per_kWp !== null
              ? formatNumber(
                  group.summary.average_specific_generation_kWh_per_kWp,
                )
              : "",
        },
      ],
    });
  });

  sections.push({
    heading: "Overall Solar Summary",
    columns: ["metric", "value"],
    rows: [
      { metric: "Total Plants", value: overallSummary.total_plants },
      { metric: "Total Records", value: overallSummary.total_records },
      {
        metric: "Total Import (kWh)",
        value: formatNumber(overallSummary.total_import_kWh),
      },
      {
        metric: "Total Export (kWh)",
        value: formatNumber(overallSummary.total_export_kWh),
      },
      {
        metric: "Total Net (kWh)",
        value: formatNumber(overallSummary.total_net_kWh),
      },
      {
        metric: "Total Solar Generation (kWh)",
        value: formatNumber(overallSummary.total_solar_generation_kWh),
      },
      {
        metric: "Average Generation / Day (kWh)",
        value:
          overallSummary.average_generation_per_day_kWh !== null
            ? formatNumber(overallSummary.average_generation_per_day_kWh)
            : "",
      },
      {
        metric: "Average Specific Generation (kWh/kWp)",
        value:
          overallSummary.average_specific_generation_kWh_per_kWp !== null
            ? formatNumber(
                overallSummary.average_specific_generation_kWh_per_kWp,
              )
            : "",
      },
    ],
  });

  return {
    title: "Solar Systems",
    scope,

    // new grouped structure
    plant_groups: plantGroups,

    // old renderer compatibility
    items: flatItems,
    summary: overallSummary,

    sections,

    table_columns: [
      { key: "sr_no", label: "Sr No" },
      { key: "plant_name", label: "Plant Name" },
      { key: "billing_period_label", label: "Billing Period" },
      { key: "import_kWh", label: "Import (kWh)" },
      { key: "export_kWh", label: "Export (kWh)" },
      { key: "net_kWh", label: "Net (kWh)" },
      { key: "solar_generation_kWh", label: "Solar Generation (kWh)" },
      {
        key: "specific_generation_kWh_per_kWp",
        label: "Specific Generation (kWh/kWp)",
      },
    ],

    table_rows: flatItems.map((item) => ({
      sr_no: item.sr_no,
      plant_name: item.plant_name,
      billing_period_label: item.billing_period_label,
      import_kWh: item.import_kWh !== null ? formatNumber(item.import_kWh) : "",
      export_kWh: item.export_kWh !== null ? formatNumber(item.export_kWh) : "",
      net_kWh: item.net_kWh !== null ? formatNumber(item.net_kWh) : "",
      solar_generation_kWh:
        item.solar_generation_kWh !== null
          ? formatNumber(item.solar_generation_kWh)
          : "",
      specific_generation_kWh_per_kWp:
        item.specific_generation_kWh_per_kWp !== null
          ? formatNumber(item.specific_generation_kWh_per_kWp)
          : "",
    })),
  };
};

export default buildSolarSection;
