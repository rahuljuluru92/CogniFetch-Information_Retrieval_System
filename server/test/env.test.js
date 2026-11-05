import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/config/env.js";

const base = { MONGODB_URI: "mongodb://localhost/x", JWT_SECRET: "x".repeat(32) };

describe("loadEnv", () => {
  it("applies defaults", () => {
    const env = loadEnv(base);
    expect(env.PORT).toBe(3500);
    expect(env.MAX_UPLOAD_MB).toBe(1);
    expect(env.cookieSecure).toBe(false);
    expect(env.SERVE_CLIENT).toBe(false);
  });

  it("rejects weak JWT secrets and missing database URI", () => {
    expect(() => loadEnv({ JWT_SECRET: "short" })).toThrow(/MONGODB_URI[\s\S]*JWT_SECRET/);
  });

  it("parses CORS origins and strips trailing slashes", () => {
    const env = loadEnv({ ...base, CORS_ORIGINS: "http://localhost:5173/, https://app.example.com " });
    expect(env.CORS_ORIGINS).toEqual(["http://localhost:5173", "https://app.example.com"]);
  });

  it("forces secure cookies in production and with SameSite=None", () => {
    expect(loadEnv({ ...base, NODE_ENV: "production" }).cookieSecure).toBe(true);
    expect(loadEnv({ ...base, COOKIE_SAMESITE: "none", COOKIE_SECURE: "false" }).cookieSecure).toBe(true);
  });
});
