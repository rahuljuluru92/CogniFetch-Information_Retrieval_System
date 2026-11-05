import mongoose from "mongoose";
import { AppError } from "../lib/errors.js";

export function notFoundHandler(req, _res, next) {
  next(new AppError(404, `Route ${req.method} ${req.path} not found`));
}

function normalize(err) {
  if (err instanceof AppError) return err;
  if (err?.type === "entity.parse.failed") return new AppError(400, "Malformed JSON body");
  if (err?.type === "entity.too.large") return new AppError(413, "Request body is too large");
  if (err instanceof mongoose.Error.ValidationError) {
    const first = Object.values(err.errors)[0];
    return new AppError(400, first?.message ?? "Invalid data");
  }
  if (err instanceof mongoose.Error.CastError) return new AppError(400, "Invalid identifier");
  if (err?.code === 11000) return new AppError(409, "That record already exists");
  if (err?.message === "Not allowed by CORS") return new AppError(403, "Origin not allowed");
  return new AppError(500, "Something went wrong on our side", { cause: err });
}

// Express identifies error handlers by their 4-argument signature.
export function errorHandler(err, req, res, _next) {
  const error = normalize(err);
  if (error.status >= 500) {
    req.log?.error({ err: err.cause ?? err }, "Request failed");
  }
  if (res.headersSent) return;
  res.status(error.status).json({
    error: {
      code: error.code,
      message: error.expose ? error.message : "Something went wrong on our side",
      ...(error.details && { details: error.details }),
    },
  });
}
