import { rateLimit } from "express-rate-limit";

const handler = (_req, res, _next, options) => {
  res.status(options.statusCode).json({
    error: { code: "TOO_MANY_REQUESTS", message: "Too many requests. Please slow down and try again shortly." },
  });
};

const make = (windowMs, limit, extra = {}) =>
  rateLimit({ windowMs, limit, standardHeaders: "draft-8", legacyHeaders: false, handler, ...extra });

export function createLimiters(env) {
  const skip = () => env.isTest;
  return {
    api: make(15 * 60 * 1000, 600, { skip }),
    auth: make(15 * 60 * 1000, 20, { skip, skipSuccessfulRequests: true }),
    // OCR + LLM calls are the expensive ones (and cost API quota).
    extract: make(60 * 60 * 1000, 30, { skip }),
    video: make(60 * 60 * 1000, 300, { skip }),
  };
}
