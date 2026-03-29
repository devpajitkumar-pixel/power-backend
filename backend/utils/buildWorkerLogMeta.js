const buildWorkerLogMeta = (job, extra = {}) => {
  return {
    queue: job?.queueName || "unknown",
    jobId: job?.id || null,
    jobName: job?.name || null,
    attempt: job?.attemptsMade ?? 0,
    timestamp: job?.timestamp || null,
    reportId: job?.data?.reportId || null,
    facilityId: job?.data?.facilityId || null,
    utilityAccountId: job?.data?.utilityAccountId || null,
    requestedBy: job?.data?.requestedBy || null,
    ...extra,
  };
};

export default buildWorkerLogMeta;
