const buildLogMeta = (req, extra = {}) => {
  const forwardedFor = req.headers["x-forwarded-for"];

  return {
    requestId: req.requestId || null,
    method: req.method,
    path: req.originalUrl,
    ip: Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor || req.ip || null,
    userId: req.user?._id?.toString?.() || req.user?._id || null,
    role: req.user?.role || null,
    ...extra,
  };
};

export default buildLogMeta;
