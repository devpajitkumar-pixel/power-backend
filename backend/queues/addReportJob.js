import { reportQueue } from "./reportQueue.js";

export const addReportJob = async ({ reportId, requestedBy, action }) => {
  return reportQueue.add(
    action === "regenerate" ? "regenerate-report" : "generate-report",
    {
      reportId,
      requestedBy,
      action,
    },
    {
      jobId: `${action}-${reportId}`,
    },
  );
};
