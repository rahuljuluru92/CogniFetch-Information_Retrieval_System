import { describe, expect, it, vi } from "vitest";
import { TtlCache } from "../src/lib/cache.js";
import { fetchJson } from "../src/lib/http.js";
import { detectImageType } from "../src/middleware/upload.js";
import { History } from "../src/models/History.js";
import { User } from "../src/models/User.js";
import { PNG } from "./helpers.js";

describe("detectImageType", () => {
  it("recognises images by magic bytes, not by name", () => {
    expect(detectImageType(PNG)).toBe("image/png");
    expect(detectImageType(Buffer.from("ffd8ffe000104a4649460001", "hex"))).toBe("image/jpeg");
    expect(detectImageType(Buffer.from("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(detectImageType(Buffer.from("<script>alert(1)</script>"))).toBeNull();
    expect(detectImageType(Buffer.alloc(3))).toBeNull();
  });
});

describe("TtlCache", () => {
  it("evicts least recently used and expired entries", () => {
    vi.useFakeTimers();
    const cache = new TtlCache({ max: 2, ttlMs: 1000 });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.get("a");
    cache.set("c", 3);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe(1);
    vi.advanceTimersByTime(1001);
    expect(cache.get("a")).toBeUndefined();
    vi.useRealTimers();
  });
});

describe("fetchJson", () => {
  it("wraps HTTP errors without leaking the URL", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 403 }));
    const err = await fetchJson("https://x.test/?key=SECRET", { service: "Thing" }).catch((e) => e);
    expect(err.status).toBe(502);
    expect(err.message).toBe("Thing returned HTTP 403");
    expect(err.message).not.toContain("SECRET");
    spy.mockRestore();
  });
});

describe("models (no database needed)", () => {
  it("never serialises password hashes and derives lookup keys", async () => {
    const user = new User({ username: "Alice", email: "ALICE@Example.com", passwordHash: "hash" });
    await user.validate();
    expect(user.usernameKey).toBe("alice");
    expect(user.email).toBe("alice@example.com");
    const json = user.toJSON();
    expect(json).toMatchObject({ username: "Alice", email: "alice@example.com" });
    expect(json).not.toHaveProperty("passwordHash");
    expect(json).not.toHaveProperty("usernameKey");
    expect(json.id).toMatch(/^[a-f0-9]{24}$/);
  });

  it("hashes passwords with bcrypt", async () => {
    const hash = await User.hashPassword("correct horse");
    const user = new User({ username: "bob", email: "b@b.co", passwordHash: hash });
    expect(hash).not.toContain("correct horse");
    expect(await user.verifyPassword("correct horse")).toBe(true);
    expect(await user.verifyPassword("wrong")).toBe(false);
  });

  it("requires at least one concept in a history entry", async () => {
    const entry = new History({ user: new User()._id, subject: "OS", subjectKey: "os", concepts: [] });
    await expect(entry.validate()).rejects.toThrow(/concepts/);
  });
});
