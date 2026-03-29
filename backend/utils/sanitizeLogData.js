const SENSITIVE_KEYS = [
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "authorization",
  "cookie",
  "set-cookie",
  "jwt",
  "otp",
  "secret",
  "client_secret",
];

const sanitizeLogData = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogData(item));
  }

  if (value && typeof value === "object") {
    const clone = {};

    for (const key of Object.keys(value)) {
      if (SENSITIVE_KEYS.includes(String(key).toLowerCase())) {
        clone[key] = "[REDACTED]";
      } else {
        clone[key] = sanitizeLogData(value[key]);
      }
    }

    return clone;
  }

  return value;
};

export default sanitizeLogData;
