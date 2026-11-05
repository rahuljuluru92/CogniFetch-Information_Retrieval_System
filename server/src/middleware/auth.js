import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { unauthorized } from "../lib/errors.js";
import { User } from "../models/User.js";

export const SESSION_COOKIE = "cf_session";

export function signSession(userId, env) {
  return jwt.sign({}, env.JWT_SECRET, {
    subject: String(userId),
    expiresIn: env.JWT_EXPIRES_IN,
    algorithm: "HS256",
  });
}

function cookieOptions(env) {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.COOKIE_SAMESITE,
    path: "/",
  };
}

export function setSessionCookie(res, token, env) {
  const { exp } = jwt.decode(token);
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(env), expires: new Date(exp * 1000) });
}

export function clearSessionCookie(res, env) {
  res.clearCookie(SESSION_COOKIE, cookieOptions(env));
}

function readToken(req) {
  const header = req.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();
  return req.cookies?.[SESSION_COOKIE];
}

/** Requires a valid session and attaches the current user document as req.user. */
export function requireAuth(env) {
  return async (req, _res, next) => {
    const token = readToken(req);
    if (!token) throw unauthorized();

    let payload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
    } catch {
      throw unauthorized("Your session has expired. Please log in again.");
    }

    if (!mongoose.isValidObjectId(payload.sub)) throw unauthorized();
    const user = await User.findById(payload.sub).select("+passwordChangedAt");
    if (!user) throw unauthorized("Account no longer exists");
    if (user.passwordChangedAt && payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
      throw unauthorized("Your password was changed. Please log in again.");
    }

    req.user = user;
    next();
  };
}
