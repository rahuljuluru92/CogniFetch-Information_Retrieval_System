import { afterEach, describe, expect, it, vi } from "vitest";
import { extractConcepts, heuristicConcepts, normalizeConcepts } from "../src/services/concepts.js";
import { testEnv } from "./helpers.js";

const SYLLABUS = `Unit I - Operating System Overview, Process Management
Process Management: Process concepts, Threads, Scheduling algorithms (FCFS, SJF, Priority).
Unit II — Synchronization, Deadlocks`;

afterEach(() => vi.restoreAllMocks());

describe("normalizeConcepts", () => {
  it("trims bullets/numbering, de-duplicates case-insensitively and drops junk", () => {
    expect(normalizeConcepts(["1. Paging", "• paging", "  Threads.", "42", "", null, "a"])).toEqual([
      "Paging",
      "Threads",
    ]);
  });

  it("caps the list length and item length", () => {
    const many = Array.from({ length: 100 }, (_, i) => `Topic ${i} ${"x".repeat(300)}`);
    const result = normalizeConcepts(many);
    expect(result).toHaveLength(60);
    expect(result[0].length).toBeLessThanOrEqual(120);
  });
});

describe("heuristicConcepts", () => {
  it("splits a syllabus into searchable topics without unit headings", () => {
    const result = heuristicConcepts(SYLLABUS);
    expect(result).toEqual(
      expect.arrayContaining(["Operating System Overview", "Threads", "FCFS", "SJF", "Deadlocks"]),
    );
    expect(result.some((c) => /^unit/i.test(c))).toBe(false);
  });
});

describe("extractConcepts", () => {
  it("uses the heuristic when Gemini is not configured", async () => {
    const result = await extractConcepts(SYLLABUS, testEnv());
    expect(result.source).toBe("heuristic");
  });

  it("uses Gemini output when available", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: '["Process concepts","Threads","threads"]' }] } }],
        }),
      ),
    );
    const result = await extractConcepts(SYLLABUS, testEnv({ GEMINI_API_KEY: "g" }));
    expect(result).toEqual({ concepts: ["Process concepts", "Threads"], source: "gemini" });
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toContain("gemini-2.5-flash:generateContent");
    expect(init.headers["x-goog-api-key"]).toBe("g");
  });

  it("falls back to the heuristic when Gemini fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 500 }));
    const warn = vi.fn();
    const result = await extractConcepts(SYLLABUS, testEnv({ GEMINI_API_KEY: "g" }), { warn });
    expect(result.source).toBe("heuristic");
    expect(warn).toHaveBeenCalled();
  });
});
