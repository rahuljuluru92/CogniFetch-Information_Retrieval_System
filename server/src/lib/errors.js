export class AppError extends Error {
  constructor(status, message, { code, details, cause, expose } = {}) {
    super(message, { cause });
    this.name = "AppError";
    this.status = status;
    this.code = code ?? defaultCode(status);
    this.details = details;
    this.expose = expose ?? status < 500;
  }
}

function defaultCode(status) {
  return (
    {
      400: "BAD_REQUEST",
      401: "UNAUTHORIZED",
      403: "FORBIDDEN",
      404: "NOT_FOUND",
      409: "CONFLICT",
      413: "PAYLOAD_TOO_LARGE",
      415: "UNSUPPORTED_MEDIA_TYPE",
      422: "UNPROCESSABLE",
      429: "TOO_MANY_REQUESTS",
      502: "UPSTREAM_ERROR",
      503: "SERVICE_UNAVAILABLE",
    }[status] ?? "INTERNAL_ERROR"
  );
}

export const badRequest = (message, details) => new AppError(400, message, { details });
export const unauthorized = (message = "Authentication required") => new AppError(401, message);
export const notFound = (message = "Not found") => new AppError(404, message);
export const conflict = (message) => new AppError(409, message);
export const upstream = (message, cause) => new AppError(502, message, { cause, expose: true });
export const unavailable = (message) => new AppError(503, message, { expose: true });
