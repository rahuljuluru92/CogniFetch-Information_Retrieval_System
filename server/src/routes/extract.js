import { Router } from "express";
import { z } from "zod";
import { AppError } from "../lib/errors.js";
import { requireAuth } from "../middleware/auth.js";
import { imageUpload } from "../middleware/upload.js";
import { validate } from "../middleware/validate.js";
import { extractConcepts } from "../services/concepts.js";
import { extractText } from "../services/ocr.js";

const textSchema = z.object({
  text: z.string().trim().min(3, "Paste some syllabus text first").max(20000, "Text is too long (max 20,000 characters)"),
});

async function respond(req, res, text) {
  const { concepts, source } = await extractConcepts(text, req.app.locals.env, req.log);
  if (concepts.length === 0) {
    throw new AppError(422, "No study topics were found in that text.", { code: "NO_TOPICS_FOUND" });
  }
  res.json({ concepts, source, characters: text.length });
}

export function extractRouter(env, limiters) {
  const router = Router();
  const auth = requireAuth(env);

  // One or more photos of a syllabus (multi-page syllabi are read in order and merged).
  router.post("/", auth, limiters.extract, imageUpload(env), async (req, res) => {
    const pages = [];
    for (const file of req.images) {
      // Sequential on purpose: OCR providers rate-limit bursts, and order matters.
      pages.push(await extractText(file, env));
    }
    await respond(req, res, pages.join("\n"));
  });

  // Already have the text (copied from a PDF or website)? Skip OCR.
  router.post("/text", auth, limiters.extract, validate(textSchema), async (req, res) => {
    await respond(req, res, req.valid.body.text);
  });

  return router;
}
