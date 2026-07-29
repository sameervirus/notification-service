import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  LOG_PRETTY: z.coerce.boolean().default(false),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),

  SMTP_HOST: z.string(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string(),

  TWILIO_ACCOUNT_SID: z.string(),
  TWILIO_AUTH_TOKEN: z.string(),
  TWILIO_FROM_NUMBER: z.string(),

  JWT_PUBLIC_KEY: z.string().transform((val, ctx) => {
    let key = val.trim();

    // Recommended path: base64-encoded PEM. No newlines/quotes/backslashes to
    // survive, so it's immune to how a given platform's env var UI stores values.
    if (!key.startsWith("-----BEGIN") && !key.startsWith('"') && !key.startsWith("'")) {
      const decoded = Buffer.from(key, "base64").toString("utf8").trim();
      if (decoded.startsWith("-----BEGIN")) {
        return decoded;
      }
    }

    // Legacy path: raw or \n-escaped PEM, optionally wrapped in quotes.
    if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
      key = key.slice(1, -1);
    }
    key = key.replace(/\\n/g, "\n").trim();

    if (!key.includes("-----BEGIN") || !key.includes("-----END")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "JWT_PUBLIC_KEY must be a PEM public key (with matching BEGIN/END lines) or its " +
          `base64 encoding. Got ${key.length} chars, starting "${key.slice(0, 30)}" — this ` +
          "usually means a single-line env var field truncated a multi-line paste at the " +
          "first line break. Use the base64 form instead (npm run dev:keys prints one).",
      });
      return z.NEVER;
    }

    return key;
  }),
  JWT_ISSUER: z.string(),
  JWT_AUDIENCE: z.string(),

  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
