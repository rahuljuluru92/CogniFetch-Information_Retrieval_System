import { AppError, unavailable, upstream } from "../lib/errors.js";
import { fetchJson } from "../lib/http.js";

/** Extracts plain text from an image using the OCR.space API. */
export async function extractText(file, env) {
  if (!env.OCR_API_KEY) throw unavailable("Text recognition is not configured on this server");

  const form = new FormData();
  form.append("file", new Blob([file.buffer], { type: file.mimetype }), file.originalname || "upload");
  form.append("language", "eng");
  form.append("OCREngine", "2");
  form.append("scale", "true");
  form.append("detectOrientation", "true");

  const data = await fetchJson(env.OCR_API_URL, {
    method: "POST",
    headers: { apikey: env.OCR_API_KEY },
    body: form,
    timeoutMs: Math.max(env.HTTP_TIMEOUT_MS, 30000),
    service: "OCR service",
  });

  if (!data || data.IsErroredOnProcessing) {
    const message = [data?.ErrorMessage].flat().filter(Boolean).join(" ");
    throw upstream(message ? `OCR failed: ${message}` : "OCR failed");
  }

  const text = (data.ParsedResults ?? [])
    .map((result) => result?.ParsedText ?? "")
    .join("\n")
    .trim();

  if (!text) {
    throw new AppError(422, "No readable text was found in the image. Try a sharper, well-lit photo.", {
      code: "NO_TEXT_FOUND",
    });
  }
  return text;
}
