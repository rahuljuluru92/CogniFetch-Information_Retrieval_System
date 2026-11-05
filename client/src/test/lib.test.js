import { describe, expect, it, vi } from "vitest";
import { ApiError, api, onUnauthorized } from "../lib/api";
import { validateImage } from "../lib/image";
import { loadStudy, persistStudy, saveStudy, slugify, toMarkdown } from "../lib/study";
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
    const files = [new File(["x"], "a.png", { type: "image/png" }), new File(["y"], "b.png", { type: "image/png" })];
    await api.extract(files);
    const { body, headers } = fetchSpy.mock.calls[0][1];
    expect(body).toBeInstanceOf(FormData);
    expect(body.getAll("images").map((f) => f.name)).toEqual(["a.png", "b.png"]);
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

describe("study progress & export", () => {
  it("keeps done flags and the saved id across reloads", () => {
    const study = saveStudy({ subject: "OS", concepts: ["Paging", "Threads"], completed: ["paging"], historyId: "h1" });
    expect(study.concepts.map((c) => c.done)).toEqual([true, false]);
    persistStudy({ ...study, concepts: study.concepts.map((c) => ({ ...c, done: true })) });
    const reloaded = loadStudy();
    expect(reloaded.historyId).toBe("h1");
    expect(reloaded.concepts.every((c) => c.done)).toBe(true);
  });

  it("exports a Markdown checklist", () => {
    const study = saveStudy({ subject: "Data Structures", concepts: ["Trees", "Graphs"], completed: ["Graphs"] });
    const md = toMarkdown(study);
    expect(md).toContain("# Data Structures");
    expect(md).toContain("Progress: 1/2 topics done");
    expect(md).toContain("- [ ] Trees\n- [x] Graphs");
    expect(slugify("Data Structures & Algorithms!")).toBe("data-structures-algorithms");
  });
});
