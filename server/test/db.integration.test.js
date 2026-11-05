import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { History } from "../src/models/History.js";
import { User } from "../src/models/User.js";
import { testApp } from "./helpers.js";

/**
 * End-to-end tests against a real MongoDB.
 * Set MONGODB_TEST_URI (CI starts a mongo service container) — skipped otherwise.
 */
const uri = process.env.MONGODB_TEST_URI;

describe.skipIf(!uri)("with a real database", () => {
  let app;

  beforeAll(async () => {
    await mongoose.connect(uri);
    await mongoose.connection.dropDatabase();
    await Promise.all([User.syncIndexes(), History.syncIndexes()]);
    ({ app } = testApp());
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), History.deleteMany({})]);
  });

  const register = (agent, overrides = {}) =>
    agent.post("/api/auth/register").send({
      username: "Alice",
      email: "alice@example.com",
      password: "correct horse battery",
      ...overrides,
    });

  it("reports healthy", async () => {
    await request(app).get("/api/health").expect(200, { status: "ok", db: "up" });
  });

  it("registers, keeps a session, logs out and logs back in", async () => {
    const agent = request.agent(app);
    const created = await register(agent).expect(201);
    expect(created.body.user).toMatchObject({ username: "Alice", email: "alice@example.com" });
    expect(created.headers["set-cookie"][0]).toMatch(/HttpOnly/);

    const stored = await User.findOne({ email: "alice@example.com" }).select("+passwordHash").lean();
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$12\$/);

    await agent.get("/api/auth/me").expect(200);
    await agent.post("/api/auth/logout").expect(204);
    await agent.get("/api/auth/me").expect(401);

    await agent
      .post("/api/auth/login")
      .send({ email: "ALICE@example.com", password: "correct horse battery" })
      .expect(200);
    await agent.get("/api/auth/me").expect(200);
  });

  it("rejects duplicate emails and case-insensitive duplicate usernames", async () => {
    await register(request(app)).expect(201);
    const sameEmail = await register(request(app), { username: "other" }).expect(409);
    expect(sameEmail.body.error.message).toMatch(/email/);
    const sameName = await register(request(app), { username: "ALICE", email: "x@example.com" }).expect(409);
    expect(sameName.body.error.message).toMatch(/username/);
  });

  it("gives the same error for unknown email and wrong password", async () => {
    await register(request(app)).expect(201);
    const wrong = await request(app)
      .post("/api/auth/login")
      .send({ email: "alice@example.com", password: "nope-nope" })
      .expect(401);
    const unknown = await request(app)
      .post("/api/auth/login")
      .send({ email: "bob@example.com", password: "nope-nope" })
      .expect(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it("saves, updates, lists and deletes history scoped to the user", async () => {
    const alice = request.agent(app);
    const bob = request.agent(app);
    await register(alice).expect(201);
    await register(bob, { username: "bob", email: "bob@example.com" }).expect(201);

    const first = await alice
      .put("/api/history")
      .send({ subject: "Operating Systems", concepts: ["Paging", "paging", "Threads"] })
      .expect(200);
    expect(first.body.item.concepts).toEqual(["Paging", "Threads"]);

    const updated = await alice
      .put("/api/history")
      .send({ subject: "operating systems", concepts: ["Deadlocks"] })
      .expect(200);
    expect(updated.body.item.id).toBe(first.body.item.id);

    const list = await alice.get("/api/history").expect(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({ subject: "operating systems", concepts: ["Deadlocks"] });

    expect((await bob.get("/api/history").expect(200)).body.items).toEqual([]);
    await bob.delete(`/api/history/${first.body.item.id}`).expect(404);
    await alice.delete(`/api/history/${first.body.item.id}`).expect(204);
    await alice.delete("/api/history/not-an-id").expect(404);
  });

  it("deletes the account and its data only with the right password", async () => {
    const agent = request.agent(app);
    await register(agent).expect(201);
    await agent.put("/api/history").send({ subject: "DS", concepts: ["Trees"] }).expect(200);

    await agent.delete("/api/auth/me").send({ password: "wrong-password" }).expect(401);
    await agent.delete("/api/auth/me").send({ password: "correct horse battery" }).expect(204);

    expect(await User.countDocuments()).toBe(0);
    expect(await History.countDocuments()).toBe(0);
    await agent.get("/api/auth/me").expect(401);
  });
});
