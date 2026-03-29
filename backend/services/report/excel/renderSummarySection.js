const toLabel = (key) =>
  String(key || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const formatValue = (value) => {
  if (value === null || value === undefined) return "";

  if (typeof value === "number") {
    return Number.isInteger(value) ? value : value.toFixed(2);
  }

  if (value instanceof Date) {
    return value.toLocaleDateString("en-GB");
  }

  return String(value);
};

/**
 * Render summary section (Text / PDF friendly)
 *
 * @param {Object} summary
 * @param {String} title
 * @param {Object} options
 * @returns {String}
 */
export const renderSummarySection = (
  summary = {},
  title = "Summary",
  options = {},
) => {
  if (!summary || typeof summary !== "object") return "";

  const { showTitle = true, uppercaseTitle = true, separator = ": " } = options;

  const lines = [];

  // Title
  if (showTitle) {
    lines.push(uppercaseTitle ? String(title).toUpperCase() : String(title));
  }

  // Key-value pairs
  Object.entries(summary).forEach(([key, value]) => {
    const label = toLabel(key);
    const formattedValue = formatValue(value);

    lines.push(`${label}${separator}${formattedValue}`);
  });

  return lines.join("\n");
};

export default renderSummarySection;
