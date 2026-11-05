import { badRequest } from "../lib/errors.js";

/** Validates req[source] against a zod schema and replaces it with the parsed value. */
export const validate = (schema, source = "body") => (req, _res, next) => {
  const result = schema.safeParse(req[source] ?? {});
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    throw badRequest(details[0]?.message ?? "Invalid request", details);
  }
  // req.query is a getter in Express 5, so store parsed values separately.
  req.valid = { ...req.valid, [source]: result.data };
  next();
};
