export const MAX_UPLOAD_MB = Number(import.meta.env.VITE_MAX_UPLOAD_MB ?? 1) || 1;
export const MAX_IMAGES = 5;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Returns a user-facing problem with the chosen file, or null when it's acceptable. */
export function validateImage(file, maxMb = MAX_UPLOAD_MB) {
  if (!file) return "Choose an image first.";
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return "Only JPEG, PNG or WebP images are supported.";
  if (file.size > maxMb * 1024 * 1024) return `The image must be ${maxMb} MB or smaller. Try cropping it.`;
  return null;
}
