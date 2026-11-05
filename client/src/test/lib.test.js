import { describe, expect, it, vi } from "vitest";
import { ApiError, api, onUnauthorized } from "../lib/api";
import { validateImage } from "../lib/image";
import { loadStudy, saveStudy } from "../lib/study";
import { json } from "./utils";

describe("api client", () => {
  it("sends JSON with credentials and parses the response", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ user: { username: "a" } }));
    await expect(api.login({ email: "a@b.co", password: "pw" })).resolves.toEqual({ user: { username: "a" } });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/auth/login");
    expect(init).toMatchObject({ method: "POST", credentials: "include" });
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ email: "a@b.co", password: "pw" });
  });

  it("turns error envelopes into ApiError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({ error: { code: "BAD_REQUEST", message: "Nope", details: [{ field: "email", message: "bad" }] } }, 400),
    );
    const err = await api.register({}).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, message: "Nope", code: "BAD_REQUEST" });
    expect(err.details[0].field).toBe("email");
  });

  it("reports network failures in plain language", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(api.history()).rejects.toMatchObject({ status: 0, message: expect.stringMatching(/reach the server/) });
  });

  it("notifies the auth layer on 401, except for the session probe", async () => {
    const handler = vi.fn();
    onUnauthorized(handler);
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => json({ error: { message: "x" } }, 401));
    await api.me().catch(() => {});
    expect(handler).not.toHaveBeenCalled();
    await api.history().catch(() => {});
    expect(handler).toHaveBeenCalledTimes(1);
    onUnauthorized(null);
  });

  it("uploads images as multipart form data", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ concepts: [] }));
    const file = new File(["x"], "a.png", { type: "image/png" });
    await api.extract(file);
    const { body, headers } = fetchSpy.mock.calls[0][1];
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("image")).toBeInstanceOf(File);
    expect(headers["Content-Type"]).toBeUndefined();
  });
});

describe("validateImage", () => {
  it("accepts supported images within the size limit", () => {
    expect(validateImage(new File(["x"], "a.jpg", { type: "image/jpeg" }))).toBeNull();
  });
  it("rejects missing, wrong-type and oversized files", () => {
    expect(validateImage(null)).toMatch(/Choose/);
    expect(validateImage(new File(["x"], "a.gif", { type: "image/gif" }))).toMatch(/JPEG/);
    const big = new File([new Uint8Array(2 * 1024 * 1024)], "a.png", { type: "image/png" });
    expect(validateImage(big, 1)).toMatch(/1 MB/);
  });
});

describe("study storage", () => {
  it("round-trips the current subject through sessionStorage", () => {
    saveStudy({ subject: "  OS ", concepts: ["Paging", "Threads"] });
    const study = loadStudy();
    expect(study.subject).toBe("OS");
    expect(study.concepts.map((c) => c.text)).toEqual(["Paging", "Threads"]);
    expect(new Set(study.concepts.map((c) => c.id)).size).toBe(2);
  });

  it("ignores corrupt data", () => {
    sessionStorage.setItem("cognifetch.study", "{not json");
    expect(loadStudy()).toBeNull();
  });
});
