import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { findSummary } from "../services/wikipedia.js";
import { findVideo } from "../services/youtube.js";

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
    const [video, article] = await Promise.all([
      findVideo(params, env),
      findSummary(params, env, req.log),
    ]);
    res.json({ video, article });
  });

  return router;
}
