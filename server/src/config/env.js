import { z } from "zod";

const csv = z
  .string()
  .default("")
  .transform((value) =>
    value
      .split(",")
      .map((item) => item.trim().replace(/\/+$/, ""))
      .filter(Boolean),
  );

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3500),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),

  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),

  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
  COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),

  CORS_ORIGINS: csv,
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  SERVE_CLIENT: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  CLIENT_DIST: z.string().default("../client/dist"),

  OCR_API_KEY: z.string().default(""),
  OCR_API_URL: z.url().default("https://api.ocr.space/parse/image"),
  GEMINI_API_KEY: z.string().default(""),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  YOUTUBE_API_KEY: z.string().default(""),

  MAX_UPLOAD_MB: z.coerce.number().positive().max(20).default(1),
  HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(20000),
});

export function loadEnv(source = process.env) {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  const env = parsed.data;
  return {
    ...env,
    isProduction: env.NODE_ENV === "production",
    isTest: env.NODE_ENV === "test",
    // Secure cookies by default in production; SameSite=None always requires Secure.
    cookieSecure:
      env.COOKIE_SAMESITE === "none" ? true : (env.COOKIE_SECURE ?? env.NODE_ENV === "production"),
  };
}
