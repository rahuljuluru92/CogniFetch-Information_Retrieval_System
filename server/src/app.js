import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import { pinoHttp } from "pino-http";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { createLimiters } from "./middleware/rateLimit.js";
import { authRouter } from "./routes/auth.js";
import { extractRouter } from "./routes/extract.js";
import { historyRouter } from "./routes/history.js";
import { quizRouter } from "./routes/quiz.js";
import { videosRouter } from "./routes/videos.js";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function createApp(env, logger) {
  const app = express();
  const limiters = createLimiters(env);
  app.locals.env = env;

  app.disable("x-powered-by");
  if (env.TRUST_PROXY) app.set("trust proxy", env.TRUST_PROXY);

  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/api/health" } }));
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "default-src": ["'self'"],
          "script-src": ["'self'"],
          // react-hot-toast injects a <style> tag at runtime.
          "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          "font-src": ["'self'", "https://fonts.gstatic.com"],
          "img-src": ["'self'", "data:", "https://i.ytimg.com", "https://upload.wikimedia.org"],
          "frame-src": ["https://www.youtube-nocookie.com"],
          "connect-src": ["'self'"],
          "object-src": ["'none'"],
          "base-uri": ["'self'"],
          "form-action": ["'self'"],
          "frame-ancestors": ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  // CORS only matters for the API. The server's own origin is always allowed (browsers send
  // Origin on same-origin POSTs and module scripts); other origins must be listed explicitly.
  // Disallowed origins are rejected outright, which also blocks cross-site form/fetch CSRF.
  app.use(
    "/api",
    cors((req, callback) => {
      const origin = req.get("origin");
      const self = `${req.protocol}://${req.get("host")}`;
      if (!origin || origin === self || env.CORS_ORIGINS.includes(origin)) {
        return callback(null, { origin: Boolean(origin), credentials: true });
      }
      return callback(new Error("Not allowed by CORS"));
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    const dbUp = mongoose.connection.readyState === 1;
    res.status(dbUp ? 200 : 503).json({ status: dbUp ? "ok" : "degraded", db: dbUp ? "up" : "down" });
  });

  app.use("/api", limiters.api);
  app.use("/api/auth", authRouter(env, limiters));
  app.use("/api/extract", extractRouter(env, limiters));
  app.use("/api/videos", videosRouter(env, limiters));
  app.use("/api/quiz", quizRouter(env, limiters));
  app.use("/api/history", historyRouter(env));
  app.use("/api", notFoundHandler);

  // In production the API can also serve the built React app (single origin = simplest + safest cookies).
  if (env.SERVE_CLIENT) {
    const dist = path.resolve(serverRoot, env.CLIENT_DIST);
    if (!existsSync(path.join(dist, "index.html"))) {
      throw new Error(`SERVE_CLIENT=true but no build found at ${dist}. Run "npm run build" first.`);
    }
    app.use(express.static(dist, { index: false, maxAge: "1y", immutable: true }));
    app.get("/{*splat}", (_req, res) => {
      res.set("Cache-Control", "no-cache").sendFile(path.join(dist, "index.html"));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
