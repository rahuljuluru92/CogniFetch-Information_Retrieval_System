import { unavailable } from "./errors.js";
import { fetchJson } from "./http.js";

/** Calls Gemini and returns the parsed JSON response, constrained by an OpenAPI-style schema. */
export async function generateJson(prompt, responseSchema, env, { temperature = 0, maxOutputTokens = 2048 } = {}) {
  if (!env.GEMINI_API_KEY) throw unavailable("AI features are not configured on this server");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    env.GEMINI_MODEL,
  )}:generateContent`;

  const data = await fetchJson(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature, maxOutputTokens, responseMimeType: "application/json", responseSchema },
    }),
    timeoutMs: Math.max(env.HTTP_TIMEOUT_MS, 30000),
    service: "Gemini",
  });

  const output = (data?.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? "").join("");
  return JSON.parse(output);
}
