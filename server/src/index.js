import mongoose from "mongoose";
import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { createLogger } from "./lib/logger.js";

let env;
try {
  env = loadEnv();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const logger = createLogger(env);

for (const [key, feature] of [
  ["OCR_API_KEY", "image text recognition"],
  ["YOUTUBE_API_KEY", "video search"],
  ["GEMINI_API_KEY", "AI concept extraction (heuristic fallback will be used)"],
]) {
  if (!env[key]) logger.warn(`${key} is not set: ${feature} is disabled`);
}

mongoose.set("strictQuery", true);
mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected"));
mongoose.connection.on("reconnected", () => logger.info("MongoDB reconnected"));

await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
logger.info("Connected to MongoDB");

const app = createApp(env, logger);
const server = app.listen(env.PORT, () => logger.info(`API listening on port ${env.PORT}`));

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received, shutting down`);
  const force = setTimeout(() => process.exit(1), 10000).unref();
  server.close(async () => {
    await mongoose.disconnect().catch(() => {});
    clearTimeout(force);
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => logger.error({ err: reason }, "Unhandled promise rejection"));
