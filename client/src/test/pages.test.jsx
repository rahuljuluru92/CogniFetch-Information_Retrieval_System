import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Route } from "react-router";
import RequireAuth from "../components/RequireAuth";
import Login from "../pages/Login";
import Register from "../pages/Register";
import Results from "../pages/Results";
import { saveStudy } from "../lib/study";
import { json, mockApi, renderAt } from "./utils";

const anonymous = () => json({ error: { message: "Authentication required" } }, 401);
const me = json({ user: { id: "1", username: "alice", email: "a@example.com" } });

describe("auth guard", () => {
  it("redirects anonymous visitors to the login page", async () => {
    mockApi({ "GET /auth/me": anonymous });
    renderAt("/scan", <RequireAuth />, {
      routePath: "/scan",
      extraRoutes: <Route path="/login" element={<p>login page</p>} />,
    });
    expect(await screen.findByText("login page")).toBeInTheDocument();
  });
});

describe("Login", () => {
  it("shows the server's error message on failure", async () => {
    mockApi({
      "GET /auth/me": anonymous,
      "POST /auth/login": () => json({ error: { message: "Incorrect email or password" } }, 401),
    });
    renderAt("/login", <Login />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Email"), "a@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password");
  });

  it("logs in and continues to the scan page", async () => {
    const calls = mockApi({ "GET /auth/me": anonymous, "POST /auth/login": me });
    renderAt("/login", <Login />, { extraRoutes: <Route path="/scan" element={<p>scan page</p>} /> });
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Email"), "a@example.com");
    await user.type(screen.getByLabelText("Password"), "correct-horse");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("scan page")).toBeInTheDocument();
    const loginCall = calls.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(loginCall[1].body)).toEqual({ email: "a@example.com", password: "correct-horse" });
  });
});

describe("Register", () => {
  it("checks the password confirmation before calling the API", async () => {
    const calls = mockApi({ "GET /auth/me": anonymous });
    renderAt("/register", <Register />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Email"), "a@example.com");
    await user.type(screen.getByLabelText("Password"), "password-1");
    await user.type(screen.getByLabelText("Confirm password"), "password-2");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Passwords don't match")).toBeInTheDocument();
    expect(calls).toHaveBeenCalledTimes(1); // only the session probe
  });

  it("shows field errors returned by the API", async () => {
    mockApi({
      "GET /auth/me": anonymous,
      "POST /auth/register": () =>
        json({ error: { message: "x", details: [{ field: "username", message: "That username is taken" }] } }, 400),
    });
    renderAt("/register", <Register />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Email"), "a@example.com");
    await user.type(screen.getByLabelText("Password"), "password-1");
    await user.type(screen.getByLabelText("Confirm password"), "password-1");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("That username is taken")).toBeInTheDocument();
  });
});

describe("Results", () => {
  it("explains what to do when there is nothing to show", async () => {
    mockApi({ "GET /auth/me": me });
    renderAt("/results", <Results />);
    expect(await screen.findByText("Nothing to show yet")).toBeInTheDocument();
  });

  it("lets the user edit, play and save topics", async () => {
    saveStudy({ subject: "Operating Systems", concepts: ["Paging", "Threads"] });
    let saved;
    mockApi({
      "GET /auth/me": me,
      "POST /videos/search": json({
        video: { videoId: "abc123", title: "Paging &amp; you", channelTitle: "OS Guy" },
        article: { title: "Memory paging", extract: "Paging is…", url: "https://en.wikipedia.org/wiki/Memory_paging" },
      }),
      "PUT /history": (init) => {
        saved = JSON.parse(init.body);
        return json({ item: { id: "h1", ...saved } });
      },
    });
    renderAt("/results", <Results />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Remove Threads" }));
    await user.type(screen.getByLabelText("Add a topic"), "Segmentation");
    await user.click(screen.getByRole("button", { name: "Add topic" }));
    expect(screen.getByText("2 of 2 topics")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Play Paging" }));
    const frame = await screen.findByTitle("Paging &amp; you");
    expect(frame).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/abc123");
    expect(screen.getByText("Paging & you · OS Guy")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Read more on Wikipedia/ })).toHaveAttribute("rel", "noopener noreferrer");

    await user.click(screen.getByRole("button", { name: /Save/ }));
    await waitFor(() => expect(saved).toEqual({ subject: "Operating Systems", concepts: ["Segmentation", "Paging"] }));
  });
});
