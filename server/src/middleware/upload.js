import multer from "multer";
import { AppError } from "../lib/errors.js";

const SIGNATURES = [
  { mime: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: "image/png",
    test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    mime: "image/webp",
    test: (b) => b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP",
  },
];

export function detectImageType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  return SIGNATURES.find((sig) => sig.test(buffer))?.mime ?? null;
}

export const MAX_IMAGES = 5;

/**
 * Accepts up to MAX_IMAGES in-memory images (field "images", or legacy "image"),
 * verifies each one's real type and exposes them as req.images.
 */
export function imageUpload(env) {
  const maxBytes = Math.round(env.MAX_UPLOAD_MB * 1024 * 1024);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: MAX_IMAGES, fields: 5 },
  }).fields([
    { name: "images", maxCount: MAX_IMAGES },
    { name: "image", maxCount: 1 },
  ]);

  return (req, res, next) => {
    upload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(new AppError(413, `Each image must be ${env.MAX_UPLOAD_MB} MB or smaller`));
        }
        if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
          return next(new AppError(400, `Upload between 1 and ${MAX_IMAGES} images in the "images" field`));
        }
        return next(new AppError(400, err.message));
      }
      if (err) return next(err);

      const files = [...(req.files?.images ?? []), ...(req.files?.image ?? [])];
      if (files.length === 0) return next(new AppError(400, 'Attach at least one image in the "images" field'));
      if (files.length > MAX_IMAGES) return next(new AppError(400, `Upload at most ${MAX_IMAGES} images`));

      for (const file of files) {
        const mime = detectImageType(file.buffer);
        if (!mime) return next(new AppError(415, "Only JPEG, PNG or WebP images are supported"));
        file.mimetype = mime;
      }
      req.images = files;
      next();
    });
  };
}
