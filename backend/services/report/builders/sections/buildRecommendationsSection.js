const pushIf = (arr, condition, title, priority = "medium") => {
  if (!condition) return;
  arr.push({ title, priority });
};

const PRIORITY_ORDER = {
  high: 1,
  medium: 2,
  low: 3,
};

const toLabel = (key) =>
  String(key || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

export const buildRecommendationsSection = async ({
  tariffs = [],
  billing_records = [],
  solar_systems = [],
  dg_sets = [],
  transformers = [],
  pumps = [],
  hvac_records = [],
  ac_records = [],
  fan_records = [],
  lighting_records = [],
  lux_records = [],
  misc_records = [],
}) => {
  const recommendations = [];

  // 🔴 High Priority
  pushIf(
    recommendations,
    !billing_records.length,
    "Capture utility billing history",
    "high",
  );

  pushIf(
    recommendations,
    !tariffs.length,
    "Add latest utility tariff information",
    "high",
  );

  pushIf(
    recommendations,
    hvac_records.length > 0,
    "Benchmark HVAC kW/TR against target values",
    "high",
  );

  // 🟡 Medium Priority
  pushIf(
    recommendations,
    solar_systems.length > 0,
    "Review solar performance trends monthly",
    "medium",
  );

  pushIf(
    recommendations,
    dg_sets.length > 0,
    "Compare DG generation cost against grid cost",
    "medium",
  );

  pushIf(
    recommendations,
    transformers.length > 0,
    "Schedule transformer loss analysis",
    "medium",
  );

  pushIf(
    recommendations,
    pumps.length > 0,
    "Audit pump throttling and VFD opportunities",
    "medium",
  );

  pushIf(
    recommendations,
    ac_records.length > 0,
    "Identify inefficient AC units for retrofit",
    "medium",
  );

  pushIf(
    recommendations,
    lighting_records.length > 0,
    "Optimize lighting controls and schedules",
    "medium",
  );

  // 🟢 Low Priority
  pushIf(
    recommendations,
    fan_records.length > 0,
    "Replace inefficient fan motors with BLDC options",
    "low",
  );

  pushIf(
    recommendations,
    lux_records.length > 0,
    "Balance lux levels to standard requirements",
    "low",
  );

  pushIf(
    recommendations,
    misc_records.length > 0,
    "Track miscellaneous loads by category",
    "low",
  );

  // Add IDs + sort
  const items = recommendations
    .map((item, index) => ({
      id: String(index + 1),
      sr_no: index + 1,
      recommendation: item.title,
      priority: item.priority,
    }))
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  const summary = {
    total_recommendations: items.length,
    high_priority: items.filter((i) => i.priority === "high").length,
    medium_priority: items.filter((i) => i.priority === "medium").length,
    low_priority: items.filter((i) => i.priority === "low").length,
  };

  return {
    title: "Recommendations",
    items,
    summary,

    // ✅ MAIN TABLE
    sections: [
      {
        heading: "All Recommendations",
        columns: [
          { key: "sr_no", label: "Sr No" },
          { key: "recommendation", label: "Recommendation" },
          { key: "priority", label: "Priority" },
        ],
        rows: items,
      },

      // 🔴 High
      {
        heading: "High Priority Actions",
        columns: ["sr_no", "recommendation"],
        rows: items.filter((i) => i.priority === "high"),
      },

      // 🟡 Medium
      {
        heading: "Medium Priority Actions",
        columns: ["sr_no", "recommendation"],
        rows: items.filter((i) => i.priority === "medium"),
      },

      // 🟢 Low
      {
        heading: "Low Priority Actions",
        columns: ["sr_no", "recommendation"],
        rows: items.filter((i) => i.priority === "low"),
      },

      // 📊 Summary
      {
        heading: "Recommendations Summary",
        columns: ["label", "value"],
        rows: [
          {
            label: "Total Recommendations",
            value: summary.total_recommendations,
          },
          {
            label: "High Priority",
            value: summary.high_priority,
          },
          {
            label: "Medium Priority",
            value: summary.medium_priority,
          },
          {
            label: "Low Priority",
            value: summary.low_priority,
          },
        ],
      },
    ],

    // fallback
    table_columns: [
      { key: "sr_no", label: "Sr No" },
      { key: "recommendation", label: "Recommendation" },
      { key: "priority", label: "Priority" },
    ],

    table_rows: items,
  };
};

export default buildRecommendationsSection;
