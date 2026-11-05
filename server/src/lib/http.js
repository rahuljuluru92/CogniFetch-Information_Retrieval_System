import { upstream } from "./errors.js";

/**
 * fetch() with a hard timeout and consistent upstream error handling.
 * Never includes the request URL in error messages, because URLs may carry API keys.
 */
export async function fetchJson(url, { timeoutMs = 20000, service = "upstream", ...init } = {}) {
  let response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    const reason = err?.name === "TimeoutError" ? "timed out" : "is unreachable";
    throw upstream(`${service} ${reason}`, err);
  }

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (!response.ok) {
    const error = upstream(`${service} returned HTTP ${response.status}`);
    error.upstreamStatus = response.status;
    error.upstreamBody = body;
    throw error;
  }
  return body;
}
