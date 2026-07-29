import pino from "pino";
import { env } from "../config/env.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: ["req.headers.authorization", "payload.recipient", "payload.body", "*.password", "*.token"],
    censor: "[REDACTED]",
  },
  transport: env.LOG_PRETTY ? { target: "pino-pretty", options: { colorize: true } } : undefined,
});
