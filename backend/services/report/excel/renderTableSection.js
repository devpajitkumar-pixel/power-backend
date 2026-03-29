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

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
};

const getColumnWidths = (columns, rows) => {
  const widths = {};

  columns.forEach((col) => {
    const key = col.key;
    const label = col.label || toLabel(key);

    let maxLength = label.length;

    rows.forEach((row) => {
      const value = formatValue(row?.[key]);
      if (value.length > maxLength) {
        maxLength = value.length;
      }
    });

    widths[key] = maxLength + 2; // padding
  });

  return widths;
};

const pad = (text, length) => {
  return String(text).padEnd(length, " ");
};

/**
 * Render table section (aligned text table)
 */
export const renderTableSection = (title, columns = [], rows = []) => {
  if (!columns.length) return "";

  if (!rows || rows.length === 0) {
    return `${title}\nNo data available\n`;
  }

  const normalizedColumns = columns.map((col) =>
    typeof col === "string"
      ? { key: col, label: toLabel(col) }
      : { key: col.key, label: col.label || toLabel(col.key) },
  );

  const widths = getColumnWidths(normalizedColumns, rows);

  // Header
  const header = normalizedColumns
    .map((col) => pad(col.label, widths[col.key]))
    .join(" | ");

  const divider = normalizedColumns
    .map((col) => "-".repeat(widths[col.key]))
    .join("-|-");

  // Body
  const body = rows.map((row) =>
    normalizedColumns
      .map((col) => pad(formatValue(row?.[col.key]), widths[col.key]))
      .join(" | "),
  );

  return [
    title,
    header,
    divider,
    ...body,
    "", // spacing
  ].join("\n");
};

export default renderTableSection;
