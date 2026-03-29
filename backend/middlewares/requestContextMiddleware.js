import { randomUUID } from "crypto";

const requestContextMiddleware = (req, res, next) => {
  req.requestId = randomUUID();
  req.requestStartTime = Date.now();

  res.setHeader("X-Request-Id", req.requestId);

  next();
};

export default requestContextMiddleware;
