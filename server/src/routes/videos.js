import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { findSummary } from "../services/wikipedia.js";
import { findVideos } from "../services/youtube.js";

const schema = z.object({
  concept: z.string().trim().min(1, "Concept is required").max(200),
  subject: z.string().trim().max(100).optional().default(""),
  channel: z.string().trim().max(100).optional().default(""),
  popular: z.boolean().optional().default(false),
});

export function videosRouter(env, limiters) {
  const router = Router();

  router.post("/search", requireAuth(env), limiters.video, validate(schema), async (req, res) => {
    const params = req.valid.body;
    const [{ videos, query, channelMatched }, article] = await Promise.all([
      findVideos(params, env),
      findSummary(params, env, req.log),
    ]);
    // `video` is kept for older clients; `videos` holds the best match first plus alternatives.
    res.json({ video: { ...videos[0], query, channelMatched }, videos, channelMatched, article });
  });

  return router;
}
