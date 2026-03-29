export const renderSummarySection = (summary = {}, title = "Summary") => {
  const lines = [`${title}`];
  Object.entries(summary || {}).forEach(([key, value]) => {
    lines.push(`- ${key}: ${value ?? ""}`);
  });
  return lines.join("\n");
};

export default renderSummarySection;
