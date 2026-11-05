import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE, signSession } from "../src/middleware/auth.js";
import { User } from "../src/models/User.js";
import { clearWikipediaCache } from "../src/services/wikipedia.js";
import { clearQuizCache } from "../src/services/quiz.js";
import { clearYoutubeCache } from "../src/services/youtube.js";
import { jsonResponse, PNG, testApp } from "./helpers.js";

/** API behaviour that doesn't need a database: the user lookup is stubbed. */
let app;
let env;
let cookie;
const fakeUser = new User({ username: "tester", email: "t@example.com", passwordHash: "x" });

beforeEach(() => {
  ({ app, env } = testApp());
  cookie = `${SESSION_COOKIE}=${signSession(fakeUser.id, env)}`;
  // Behaves like a Mongoose query: awaitable and chainable with .select().
  vi.spyOn(User, "findById").mockImplementation((id) => {
    const query = Promise.resolve(String(id) === fakeUser.id ? fakeUser : null);
    query.select = () => query;
    return query;
  });
  clearYoutubeCache();
  clearWikipediaCache();
  clearQuizCache();
});

afterEach(() => vi.restoreAllMocks());

describe("platform", () => {
  it("reports degraded health when the database is down", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: "degraded", db: "down" });
  });

  it("sets security headers and hides the framework", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("returns JSON 404s for unknown API routes", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("only allows configured CORS origins", async () => {
    const ok = await request(app).get("/api/health").set("Origin", "http://localhost:5173");
    expect(ok.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(ok.headers["access-control-allow-credentials"]).toBe("true");

    const self = await request(app).post("/api/auth/logout").set("Host", "app.example").set("Origin", "http://app.example");
    expect(self.status).toBe(204);

    const blocked = await request(app).get("/api/health").set("Origin", "https://evil.example");
    expect(blocked.status).toBe(403);
    expect(blocked.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("rejects malformed JSON cleanly", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("content-type", "application/json")
      .send("{bad json");
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe("Malformed JSON body");
  });
});

describe("auth guards & validation", () => {
  it.each([
    ["get", "/api/auth/me"],
    ["get", "/api/history"],
    ["post", "/api/extract"],
    ["post", "/api/videos/search"],
  ])("%s %s requires a session", async (method, url) => {
    const res = await request(app)[method](url);
    expect(res.status).toBe(401);
  });

  it("rejects tampered or foreign tokens", async () => {
    const res = await request(app).get("/api/auth/me").set("Cookie", `${SESSION_COOKIE}=${cookie.split("=")[1]}x`);
    expect(res.status).toBe(401);
  });

  it("accepts a valid session cookie or bearer token", async () => {
    const viaCookie = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(viaCookie.status).toBe(200);
    expect(viaCookie.body.user).toMatchObject({ username: "tester", email: "t@example.com" });
    expect(viaCookie.body.user.passwordHash).toBeUndefined();

    const viaBearer = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${signSession(fakeUser.id, env)}`);
    expect(viaBearer.status).toBe(200);
  });

  it("validates registration input before touching the database", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ username: "a b", email: "not-an-email", password: "short" });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field).sort()).toEqual(["email", "password", "username"]);
  });

  it("clears the cookie on logout", async () => {
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(204);
    expect(res.headers["set-cookie"][0]).toMatch(new RegExp(`^${SESSION_COOKIE}=;.*HttpOnly`));
  });
});

describe("POST /api/extract", () => {
  it("runs OCR then concept extraction", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ ParsedResults: [{ ParsedText: "Paging, Segmentation\nVirtual memory" }] }),
    );
    const res = await request(app).post("/api/extract").set("Cookie", cookie).attach("image", PNG, "notes.png");

    expect(res.status).toBe(200);
    expect(res.body.concepts).toEqual(["Paging", "Segmentation", "Virtual memory"]);
    expect(res.body.source).toBe("heuristic");
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toBe(env.OCR_API_URL);
    expect(init.headers.apikey).toBe("ocr-test-key");
  });

  it("rejects files that are not really images", async () => {
    const res = await request(app)
      .post("/api/extract")
      .set("Cookie", cookie)
      .attach("image", Buffer.from("#!/bin/sh\nrm -rf /\n"), "evil.png");
    expect(res.status).toBe(415);
  });

  it("enforces the upload size limit", async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(1.5 * 1024 * 1024)]);
    const res = await request(app).post("/api/extract").set("Cookie", cookie).attach("image", big, "big.png");
    expect(res.status).toBe(413);
  });

  it("reports images without text as 422", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ ParsedResults: [{ ParsedText: "  " }] }));
    const res = await request(app).post("/api/extract").set("Cookie", cookie).attach("image", PNG, "blank.png");
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("NO_TEXT_FOUND");
  });

  it("surfaces OCR provider errors as 502", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ IsErroredOnProcessing: true, ErrorMessage: ["File too large"] }),
    );
    const res = await request(app).post("/api/extract").set("Cookie", cookie).attach("image", PNG, "x.png");
    expect(res.status).toBe(502);
    expect(res.body.error.message).toBe("OCR failed: File too large");
  });

  it("returns 503 when OCR is not configured", async () => {
    ({ app } = testApp({ OCR_API_KEY: "" }));
    const res = await request(app).post("/api/extract").set("Cookie", cookie).attach("image", PNG, "x.png");
    expect(res.status).toBe(503);
  });
});

describe("POST /api/videos/search", () => {
  function mockUpstreams({ channelId } = {}) {
    return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.hostname === "www.googleapis.com" && url.searchParams.get("type") === "channel") {
        return jsonResponse({ items: channelId ? [{ id: { channelId } }] : [] });
      }
      if (url.hostname === "www.googleapis.com") {
        return jsonResponse({
          items: [
            { id: { videoId: "abc123" }, snippet: { title: "Paging explained", channelTitle: "OS Guy" } },
            { id: { videoId: "def456" }, snippet: { title: "Paging part 2", channelTitle: "OS Gal" } },
          ],
        });
      }
      if (url.pathname === "/w/api.php") return jsonResponse({ query: { search: [{ title: "Memory paging" }] } });
      if (url.pathname.startsWith("/api/rest_v1/page/summary/")) {
        return jsonResponse({
          title: "Memory paging",
          extract: "Paging is a memory management scheme.",
          content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Memory_paging" } },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
  }

  it("returns a video and a Wikipedia summary", async () => {
    mockUpstreams();
    const res = await request(app)
      .post("/api/videos/search")
      .set("Cookie", cookie)
      .send({ concept: "Paging", subject: "Operating Systems", popular: true });

    expect(res.status).toBe(200);
    expect(res.body.video).toMatchObject({ videoId: "abc123", title: "Paging explained" });
    expect(res.body.videos).toHaveLength(2);
    expect(res.body.videos[1].videoId).toBe("def456");
    expect(res.body.article).toEqual({
      title: "Memory paging",
      extract: "Paging is a memory management scheme.",
      url: "https://en.wikipedia.org/wiki/Memory_paging",
    });
    const yt = new URL(String(fetch.mock.calls.find(([u]) => String(u).includes("youtube"))[0]));
    expect(yt.searchParams.get("order")).toBe("viewCount");
    expect(yt.searchParams.get("q")).toBe("Paging Operating Systems");
    expect(yt.searchParams.get("maxResults")).toBe("3");
  });

  it("restricts to a channel when one is given and caches results", async () => {
    mockUpstreams({ channelId: "UC123" });
    const body = { concept: "Paging", channel: "Neso Academy" };
    await request(app).post("/api/videos/search").set("Cookie", cookie).send(body).expect(200);
    const calls = fetch.mock.calls.length;
    const videoCall = fetch.mock.calls
      .map(([u]) => new URL(String(u)))
      .find((u) => u.searchParams.get("type") === "video");
    expect(videoCall.searchParams.get("channelId")).toBe("UC123");

    await request(app).post("/api/videos/search").set("Cookie", cookie).send(body).expect(200);
    expect(fetch.mock.calls.length).toBe(calls); // served from cache
  });

  it("still returns the video when Wikipedia is down", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      String(input).includes("googleapis")
        ? jsonResponse({ items: [{ id: { videoId: "v1" }, snippet: {} }] })
        : new Response("down", { status: 503 }),
    );
    const res = await request(app).post("/api/videos/search").set("Cookie", cookie).send({ concept: "Paging" });
    expect(res.status).toBe(200);
    expect(res.body.video.videoId).toBe("v1");
    expect(res.body.article).toBeNull();
  });

  it("validates the request body", async () => {
    const res = await request(app).post("/api/videos/search").set("Cookie", cookie).send({ concept: "" });
    expect(res.status).toBe(400);
  });
});

describe("multi-page and text extraction", () => {
  it("OCRs every uploaded page in order and merges the topics", async () => {
    const pages = ["Paging, Segmentation", "Deadlocks"];
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      jsonResponse({ ParsedResults: [{ ParsedText: pages.shift() }] }),
    );
    const res = await request(app)
      .post("/api/extract")
      .set("Cookie", cookie)
      .attach("images", PNG, "p1.png")
      .attach("images", PNG, "p2.png");
    expect(res.status).toBe(200);
    expect(res.body.concepts).toEqual(["Paging", "Segmentation", "Deadlocks"]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("rejects more than 5 images", async () => {
    let req = request(app).post("/api/extract").set("Cookie", cookie);
    for (let i = 0; i < 6; i++) req = req.attach("images", PNG, `p${i}.png`);
    const res = await req;
    expect(res.status).toBe(400);
  });

  it("extracts topics from pasted text without OCR", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const res = await request(app)
      .post("/api/extract/text")
      .set("Cookie", cookie)
      .send({ text: "Unit I - Trees, Graphs\nHashing" });
    expect(res.status).toBe(200);
    expect(res.body.concepts).toEqual(["Trees", "Graphs", "Hashing"]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("validates pasted text", async () => {
    await request(app).post("/api/extract/text").set("Cookie", cookie).send({ text: "" }).expect(400);
    await request(app).post("/api/extract/text").send({ text: "Trees" }).expect(401);
  });
});

describe("POST /api/quiz", () => {
  const question = (q, answerIndex = 1) => ({
    question: q,
    options: ["A", "B", "C", "D"],
    answerIndex,
    explanation: "Because.",
  });

  it("returns 503 when Gemini is not configured", async () => {
    const res = await request(app).post("/api/quiz").set("Cookie", cookie).send({ concept: "Paging" });
    expect(res.status).toBe(503);
  });

  it("generates, sanitises and caches quizzes", async () => {
    ({ app } = testApp({ GEMINI_API_KEY: "g" }));
    const generated = [question("Q1"), question("Q2", 7), { question: "bad" }, question("Q3", 0)];
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ candidates: [{ content: { parts: [{ text: JSON.stringify(generated) }] } }] }),
    );
    const body = { concept: "Paging", subject: "OS", count: 3 };
    const res = await request(app).post("/api/quiz").set("Cookie", cookie).send(body);
    expect(res.status).toBe(200);
    expect(res.body.questions.map((q) => q.question)).toEqual(["Q1", "Q3"]);
    expect(JSON.parse(fetch.mock.calls[0][1].body).contents[0].parts[0].text).toContain('Topic: "Paging"');

    await request(app).post("/api/quiz").set("Cookie", cookie).send(body).expect(200);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("validates the question count", async () => {
    await request(app).post("/api/quiz").set("Cookie", cookie).send({ concept: "x", count: 50 }).expect(400);
  });
});

describe("password change sessions", () => {
  it("rejects sessions issued before the password changed", async () => {
    fakeUser.passwordChangedAt = new Date(Date.now() + 5000);
    const res = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/password was changed/);
    fakeUser.passwordChangedAt = undefined;
  });

  it("validates the new password", async () => {
    const res = await request(app)
      .patch("/api/auth/password")
      .set("Cookie", cookie)
      .send({ currentPassword: "x", newPassword: "short" });
    expect(res.status).toBe(400);
  });
});
