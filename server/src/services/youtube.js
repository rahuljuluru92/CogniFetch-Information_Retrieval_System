import { TtlCache } from "../lib/cache.js";
import { notFound, unavailable } from "../lib/errors.js";
import { fetchJson } from "../lib/http.js";

const API = "https://www.googleapis.com/youtube/v3/search";
const cache = new TtlCache({ max: 1000, ttlMs: 6 * 60 * 60 * 1000 });

export const clearYoutubeCache = () => cache.clear();

async function search(params, env) {
  const url = new URL(API);
  for (const [key, value] of Object.entries({ ...params, key: env.YOUTUBE_API_KEY })) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  return fetchJson(url, { timeoutMs: env.HTTP_TIMEOUT_MS, service: "YouTube" });
}

async function resolveChannelId(channel, env) {
  const data = await search({ part: "snippet", type: "channel", maxResults: 1, q: channel }, env);
  return data?.items?.[0]?.id?.channelId;
}

const MAX_VIDEOS = 3;

const toVideo = (item) => ({
  videoId: item.id.videoId,
  title: item.snippet?.title ?? "",
  channelTitle: item.snippet?.channelTitle ?? "",
  thumbnail: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? null,
});

/** Finds the best embeddable videos for a concept (same quota cost as fetching just one). */
export async function findVideos({ concept, subject, channel, popular }, env) {
  if (!env.YOUTUBE_API_KEY) throw unavailable("Video search is not configured on this server");

  const query = [concept, subject].filter(Boolean).join(" ");
  const cacheKey = JSON.stringify([query.toLowerCase(), channel?.toLowerCase() ?? "", !!popular]);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const channelId = channel ? await resolveChannelId(channel, env) : undefined;

  const data = await search(
    {
      part: "snippet",
      type: "video",
      maxResults: MAX_VIDEOS,
      q: query,
      videoEmbeddable: "true",
      safeSearch: "strict",
      order: popular ? "viewCount" : "relevance",
      channelId,
    },
    env,
  );

  const videos = (data?.items ?? []).filter((item) => item?.id?.videoId).map(toVideo);
  if (videos.length === 0) throw notFound("No video found for this topic");

  const result = { videos, query, channelMatched: channel ? Boolean(channelId) : undefined };
  cache.set(cacheKey, result);
  return result;
}
