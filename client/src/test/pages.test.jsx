import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Route } from "react-router";
import RequireAuth from "../components/RequireAuth";
import Login from "../pages/Login";
import Register from "../pages/Register";
import Profile from "../pages/Profile";
import Results from "../pages/Results";
import Scan from "../pages/Scan";
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
    const frame = await screen.findByTitle("Paging & you");
    expect(frame).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/abc123");
    expect(screen.getByText("Paging & you · OS Guy")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Read more on Wikipedia/ })).toHaveAttribute("rel", "noopener noreferrer");

    await user.click(screen.getByRole("button", { name: /Save/ }));
    await waitFor(() =>
      expect(saved).toEqual({ subject: "Operating Systems", concepts: ["Segmentation", "Paging"], completed: [] }),
    );
  });
});

describe("Results: progress, alternatives and quiz", () => {
  it("syncs progress for saved subjects and rolls back on failure", async () => {
    saveStudy({ subject: "OS", concepts: ["Paging", "Threads"], completed: [], historyId: "h1" });
    const progress = [];
    mockApi({
      "GET /auth/me": me,
      "PATCH /history/h1/progress": (init) => {
        progress.push(JSON.parse(init.body));
        return progress.length === 1 ? json({ item: {} }) : json({ error: { message: "Server down" } }, 500);
      },
    });
    renderAt("/results", <Results />);
    const user = userEvent.setup();

    const paging = await screen.findByRole("checkbox", { name: "Mark Paging as done" });
    await user.click(paging);
    expect(await screen.findByText(/1 of 2 topics done/)).toBeInTheDocument();
    expect(progress[0]).toEqual({ concept: "Paging", done: true });

    await user.click(screen.getByRole("checkbox", { name: "Mark Threads as done" }));
    await waitFor(() => expect(screen.getByText(/1 of 2 topics done/)).toBeInTheDocument());
    expect(screen.getByRole("checkbox", { name: "Mark Threads as done" })).toHaveAttribute("aria-checked", "false");
  });

  it("lets the user switch to an alternative video", async () => {
    saveStudy({ subject: "OS", concepts: ["Paging"] });
    const videos = [
      { videoId: "v1", title: "First", channelTitle: "A", thumbnail: "https://i.ytimg.com/1.jpg" },
      { videoId: "v2", title: "Second", channelTitle: "B", thumbnail: "https://i.ytimg.com/2.jpg" },
    ];
    mockApi({ "GET /auth/me": me, "POST /videos/search": json({ video: videos[0], videos, article: null }) });
    renderAt("/results", <Results />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Play Paging" }));
    expect(await screen.findByTitle("First")).toHaveAttribute("src", expect.stringContaining("/embed/v1"));
    await user.click(screen.getByRole("button", { name: "Watch Second" }));
    expect(screen.getByTitle("Second")).toHaveAttribute("src", expect.stringContaining("/embed/v2"));
  });

  it("runs a quiz and shows the score", async () => {
    saveStudy({ subject: "OS", concepts: ["Paging"] });
    const q = (question, answerIndex) => ({ question, options: ["A1", "B1", "C1", "D1"], answerIndex, explanation: `Why ${question}` });
    mockApi({ "GET /auth/me": me, "POST /quiz": json({ questions: [q("Q one", 0), q("Q two", 2)] }) });
    renderAt("/results", <Results />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Quiz me on Paging" }));

    const quiz = await screen.findByRole("region", { name: "Quiz on Paging" });
    const [first, second] = within(quiz).getAllByRole("listitem");
    await user.click(within(first).getByRole("button", { name: /A1/ }));
    expect(within(first).getByText("Why Q one")).toBeInTheDocument();
    await user.click(within(second).getByRole("button", { name: /A1/ }));
    expect(screen.getByRole("status")).toHaveTextContent("You scored 1 out of 2");
  });
});

describe("Scan", () => {
  it("extracts topics from pasted text", async () => {
    let sent;
    mockApi({
      "GET /auth/me": me,
      "POST /extract/text": (init) => {
        sent = JSON.parse(init.body);
        return json({ concepts: ["Trees", "Graphs"], source: "heuristic" });
      },
    });
    renderAt("/scan", <Scan />, { extraRoutes: <Route path="/results" element={<p>results page</p>} /> });
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Subject"), "DS");
    await user.click(screen.getByRole("tab", { name: /Paste text/ }));
    await user.type(screen.getByLabelText("Syllabus text"), "Trees, Graphs");
    await user.click(screen.getByRole("button", { name: /Find topics/ }));
    expect(await screen.findByText("results page")).toBeInTheDocument();
    expect(sent).toEqual({ text: "Trees, Graphs" });
    expect(JSON.parse(sessionStorage.getItem("cognifetch.study")).concepts).toEqual(["Trees", "Graphs"]);
  });

  it("accepts several pages and rejects unsupported files", async () => {
    mockApi({ "GET /auth/me": me });
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
    renderAt("/scan", <Scan />);
    const user = userEvent.setup({ applyAccept: false });
    const input = await screen.findByLabelText("Syllabus images");
    await user.upload(input, [
      new File(["a"], "p1.png", { type: "image/png" }),
      new File(["b"], "p2.jpg", { type: "image/jpeg" }),
      new File(["c"], "notes.pdf", { type: "application/pdf" }),
    ]);
    expect(screen.getByAltText("Page 1")).toBeInTheDocument();
    expect(screen.getByAltText("Page 2")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("notes.pdf");
    await user.click(screen.getByRole("button", { name: "Remove page 1" }));
    expect(screen.queryByAltText("Page 2")).not.toBeInTheDocument();
  });
});

describe("Profile: change password", () => {
  it("validates the confirmation and submits the change", async () => {
    let body;
    mockApi({
      "GET /auth/me": me,
      "GET /history": json({ items: [] }),
      "PATCH /auth/password": (init) => {
        body = JSON.parse(init.body);
        return new Response(null, { status: 204 });
      },
    });
    renderAt("/profile", <Profile />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Change password" }));
    await user.type(screen.getByLabelText("Current password"), "old-password");
    await user.type(screen.getByLabelText("New password"), "new-password-1");
    await user.type(screen.getByLabelText("Confirm new password"), "new-password-2");
    await user.click(screen.getByRole("button", { name: "Change password" }));
    expect(await screen.findByText("Passwords don't match")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Confirm new password"));
    await user.type(screen.getByLabelText("Confirm new password"), "new-password-1");
    await user.click(screen.getByRole("button", { name: "Change password" }));
    await waitFor(() => expect(body).toEqual({ currentPassword: "old-password", newPassword: "new-password-1" }));
  });
});
