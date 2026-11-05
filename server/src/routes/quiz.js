import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { generateQuiz } from "../services/quiz.js";

const schema = z.object({
  concept: z.string().trim().min(1, "Concept is required").max(200),
  subject: z.string().trim().max(100).optional().default(""),
  count: z.number().int().min(3).max(10).optional().default(5),
});

export function quizRouter(env, limiters) {
  const router = Router();

  router.post("/", requireAuth(env), limiters.quiz, validate(schema), async (req, res) => {
    res.json({ questions: await generateQuiz(req.valid.body, env) });
  });

  return router;
}
