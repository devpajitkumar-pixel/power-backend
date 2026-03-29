export const renderTableSection = (title, columns = [], rows = []) => {
  const header = columns.map((col) => col.label || col.key).join(" | ");
  const body = rows.map((row) =>
    columns.map((col) => row?.[col.key] ?? "").join(" | "),
  );
  return [title, header, ...body].join("\n");
};

export default renderTableSection;
