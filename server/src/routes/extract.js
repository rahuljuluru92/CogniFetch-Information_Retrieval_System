import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { imageUpload } from "../middleware/upload.js";
import { extractConcepts } from "../services/concepts.js";
import { extractText } from "../services/ocr.js";

export function extractRouter(env, limiters) {
  const router = Router();

  router.post("/", requireAuth(env), limiters.extract, imageUpload(env), async (req, res) => {
    const text = await extractText(req.file, env);
    const { concepts, source } = await extractConcepts(text, env, req.log);
    res.json({ concepts, source, characters: text.length });
  });

  return router;
}
