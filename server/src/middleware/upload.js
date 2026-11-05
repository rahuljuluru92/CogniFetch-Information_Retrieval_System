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

/** Accepts a single in-memory image upload in field "image" and verifies its real type. */
export function imageUpload(env) {
  const maxBytes = Math.round(env.MAX_UPLOAD_MB * 1024 * 1024);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1, fields: 5 },
  }).single("image");

  return (req, res, next) => {
    upload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(new AppError(413, `Image must be ${env.MAX_UPLOAD_MB} MB or smaller`));
        }
        return next(new AppError(400, err.message));
      }
      if (err) return next(err);
      if (!req.file) return next(new AppError(400, 'Attach an image in the "image" field'));

      const mime = detectImageType(req.file.buffer);
      if (!mime) return next(new AppError(415, "Only JPEG, PNG or WebP images are supported"));
      req.file.mimetype = mime;
      next();
    });
  };
}
