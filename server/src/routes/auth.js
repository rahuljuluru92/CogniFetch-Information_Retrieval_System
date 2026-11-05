import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { badRequest, conflict, unauthorized } from "../lib/errors.js";
import {
  clearSessionCookie,
  requireAuth,
  setSessionCookie,
  signSession,
} from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { History } from "../models/History.js";
import { User } from "../models/User.js";

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password must be at most 72 bytes");

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(32, "Username must be at most 32 characters")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Username may only contain letters, numbers, dot, dash and underscore"),
  email: z.email("Enter a valid email address").trim().toLowerCase().max(254),
  password,
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "Email is required"),
  password: z.string().min(1, "Password is required").max(200),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: password,
});

const deleteSchema = z.object({ password: z.string().min(1, "Confirm with your password") });

// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
let dummyHash;
const getDummyHash = () => (dummyHash ??= User.hashPassword("not-a-real-password"));

export function authRouter(env, limiters) {
  const router = Router();
  const auth = requireAuth(env);

  router.post("/register", limiters.auth, validate(registerSchema), async (req, res) => {
    const { username, email, password: plain } = req.valid.body;

    const existing = await User.findOne({
      $or: [{ email }, { usernameKey: username.toLowerCase() }],
    })
      .select("+usernameKey")
      .lean();
    if (existing) {
      throw conflict(existing.email === email ? "That email is already registered" : "That username is taken");
    }

    const user = await User.create({
      username,
      email,
      passwordHash: await User.hashPassword(plain),
    });

    setSessionCookie(res, signSession(user.id, env), env);
    res.status(201).json({ user });
  });

  router.post("/login", limiters.auth, validate(loginSchema), async (req, res) => {
    const { email, password: plain } = req.valid.body;
    const user = await User.findOne({ email }).select("+passwordHash");

    const valid = user
      ? await user.verifyPassword(plain)
      : await bcrypt.compare(plain, await getDummyHash()).then(() => false);
    if (!user || !valid) throw unauthorized("Incorrect email or password");

    setSessionCookie(res, signSession(user.id, env), env);
    res.json({ user });
  });

  router.post("/logout", (_req, res) => {
    clearSessionCookie(res, env);
    res.status(204).end();
  });

  router.get("/me", auth, (req, res) => {
    res.json({ user: req.user });
  });

  // Changing the password signs out every other session; this one gets a fresh cookie.
  router.patch("/password", limiters.auth, auth, validate(changePasswordSchema), async (req, res) => {
    const { currentPassword, newPassword } = req.valid.body;
    const user = await User.findById(req.user.id).select("+passwordHash");
    if (!(await user.verifyPassword(currentPassword))) {
      throw unauthorized("Current password is incorrect");
    }
    if (await user.verifyPassword(newPassword)) {
      throw badRequest("New password must be different from the current one", [
        { field: "newPassword", message: "New password must be different from the current one" },
      ]);
    }
    user.passwordHash = await User.hashPassword(newPassword);
    // Whole seconds, so a token issued right after this (same second) is still valid.
    user.passwordChangedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
    await user.save();

    setSessionCookie(res, signSession(user.id, env), env);
    res.status(204).end();
  });

  router.delete("/me", auth, validate(deleteSchema), async (req, res) => {
    const user = await User.findById(req.user.id).select("+passwordHash");
    if (!(await user.verifyPassword(req.valid.body.password))) {
      throw unauthorized("Incorrect password");
    }
    await History.deleteMany({ user: user._id });
    await user.deleteOne();
    clearSessionCookie(res, env);
    res.status(204).end();
  });

  return router;
}
