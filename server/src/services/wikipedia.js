import { TtlCache } from "../lib/cache.js";
import { fetchJson } from "../lib/http.js";

const USER_AGENT =
  "CogniFetch/1.0 (https://github.com/rahuljuluru92/CogniFetch-Information_Retrieval_System)";
const cache = new TtlCache({ max: 1000, ttlMs: 24 * 60 * 60 * 1000 });

export const clearWikipediaCache = () => cache.clear();

/**
 * Returns a short Wikipedia summary for a concept, or null.
 * Failures are swallowed on purpose: the article is a nice-to-have next to the video.
 */
export async function findSummary({ concept, subject }, env, logger) {
  const query = [concept, subject].filter(Boolean).join(" ");
  const cacheKey = query.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  const headers = { "user-agent": USER_AGENT, "api-user-agent": USER_AGENT };
  try {
    const searchUrl = new URL("https://en.wikipedia.org/w/api.php");
    searchUrl.search = new URLSearchParams({
      action: "query",
      list: "search",
      srsearch: query,
      srlimit: "1",
      format: "json",
      origin: "*",
    }).toString();

    const search = await fetchJson(searchUrl, { headers, timeoutMs: env.HTTP_TIMEOUT_MS, service: "Wikipedia" });
    const title = search?.query?.search?.[0]?.title;
    if (!title) {
      cache.set(cacheKey, null);
      return null;
    }

    const page = await fetchJson(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`,
      { headers, timeoutMs: env.HTTP_TIMEOUT_MS, service: "Wikipedia" },
    );

    const summary = page?.extract
      ? {
          title: page.title ?? title,
          extract: page.extract,
          url: page.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
        }
      : null;
    cache.set(cacheKey, summary);
    return summary;
  } catch (err) {
    logger?.warn({ err: err.message }, "Wikipedia lookup failed");
    return null;
  }
}
