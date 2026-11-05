import { createApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { createLogger } from "../src/lib/logger.js";

export function testEnv(overrides = {}) {
  return loadEnv({
    NODE_ENV: "test",
    MONGODB_URI: process.env.MONGODB_TEST_URI ?? "mongodb://127.0.0.1:1/unused",
    JWT_SECRET: "test-secret-that-is-definitely-long-enough",
    CORS_ORIGINS: "http://localhost:5173",
    OCR_API_KEY: "ocr-test-key",
    GEMINI_API_KEY: "",
    YOUTUBE_API_KEY: "yt-test-key",
    ...overrides,
  });
}

export function testApp(overrides) {
  const env = testEnv(overrides);
  return { env, app: createApp(env, createLogger(env)) };
}

export const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010806000000" + "1f15c4890000000d49444154789c6300010000050001" + "0d0a2db40000000049454e44ae426082",
  "hex",
);
