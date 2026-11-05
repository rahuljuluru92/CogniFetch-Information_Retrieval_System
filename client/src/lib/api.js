const BASE = `${(import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "")}/api`;

export class ApiError extends Error {
  constructor(status, message, { code, details } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let unauthorizedHandler = null;
/** Lets the auth layer react when any request reveals the session has expired. */
export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

export async function request(path, { method = "GET", body, signal, silent401 = false } = {}) {
  const init = { method, signal, credentials: "include", headers: { Accept: "application/json" } };
  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${BASE}${path}`, init);
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }

  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && !silent401) unauthorizedHandler?.();
    throw new ApiError(response.status, data?.error?.message ?? `Request failed (${response.status})`, {
      code: data?.error?.code,
      details: data?.error?.details,
    });
  }
  return data;
}

export const api = {
  me: () => request("/auth/me", { silent401: true }),
  login: (credentials) => request("/auth/login", { method: "POST", body: credentials, silent401: true }),
  register: (details) => request("/auth/register", { method: "POST", body: details }),
  logout: () => request("/auth/logout", { method: "POST" }),
  deleteAccount: (password) => request("/auth/me", { method: "DELETE", body: { password } }),

  extract: (file, { signal } = {}) => {
    const form = new FormData();
    form.append("image", file);
    return request("/extract", { method: "POST", body: form, signal });
  },
  searchVideo: (params, { signal } = {}) => request("/videos/search", { method: "POST", body: params, signal }),

  history: () => request("/history"),
  saveHistory: (subject, concepts) => request("/history", { method: "PUT", body: { subject, concepts } }),
  deleteHistory: (id) => request(`/history/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
