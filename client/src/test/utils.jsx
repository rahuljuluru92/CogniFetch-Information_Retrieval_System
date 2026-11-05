import { render } from "@testing-library/react";
import { vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { AuthProvider } from "../context/AuthContext";

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Routes fetch calls by "METHOD /path" to handlers; unmatched calls fail the test loudly. */
export function mockApi(routes) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init = {}) => {
    const path = new URL(String(url), "http://localhost").pathname.replace(/^\/api/, "");
    const key = `${init.method ?? "GET"} ${path}`;
    const handler = routes[key];
    if (!handler) throw new Error(`Unexpected request: ${key}`);
    return typeof handler === "function" ? handler(init) : handler.clone();
  });
}

export function renderAt(path, element, { routePath = path, extraRoutes = null } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path={routePath} element={element} />
          {extraRoutes}
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}
