import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { notFound } from "../lib/errors.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { History, reconcileCompleted, subjectKeyOf } from "../models/History.js";

const saveSchema = z.object({
  subject: z.string().trim().min(1, "Subject is required").max(100),
  concepts: z
    .array(z.string().trim().min(1).max(200))
    .min(1, "Add at least one concept")
    .max(100, "At most 100 concepts can be saved"),
  completed: z.array(z.string().trim().min(1).max(200)).max(100).optional().default([]),
});

const progressSchema = z.object({
  concept: z.string().trim().min(1, "Concept is required").max(200),
  done: z.boolean(),
});

/** Removes case-insensitive duplicates, keeping the first spelling of each. */
export function dedupeCaseInsensitive(list) {
  const seen = new Set();
  return list.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function historyRouter(env) {
  const router = Router();
  router.use(requireAuth(env));

  router.get("/", async (req, res) => {
    const items = await History.find({ user: req.user._id }).sort({ updatedAt: -1 }).limit(200);
    res.json({ items });
  });

  // Upsert by subject (case-insensitive): saving the same subject again replaces its list.
  router.put("/", validate(saveSchema), async (req, res) => {
    const { subject, concepts, completed } = req.valid.body;
    const unique = dedupeCaseInsensitive(concepts);
    const item = await History.findOneAndUpdate(
      { user: req.user._id, subjectKey: subjectKeyOf(subject) },
      { $set: { subject, concepts: unique, completed: reconcileCompleted(unique, completed) } },
      { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true },
    );
    res.json({ item });
  });

  // Mark a single concept as done / not done.
  router.patch("/:id/progress", validate(progressSchema), async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw notFound("History item not found");
    const item = await History.findOne({ _id: req.params.id, user: req.user._id });
    if (!item) throw notFound("History item not found");

    const { concept, done } = req.valid.body;
    const match = item.concepts.find((c) => c.toLowerCase() === concept.toLowerCase());
    if (!match) throw notFound("That concept isn't in this subject");

    const others = item.completed.filter((c) => c.toLowerCase() !== match.toLowerCase());
    item.completed = done ? [...others, match] : others;
    await item.save();
    res.json({ item });
  });

  router.delete("/:id", async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw notFound("History item not found");
    const result = await History.deleteOne({ _id: req.params.id, user: req.user._id });
    if (result.deletedCount === 0) throw notFound("History item not found");
    res.status(204).end();
  });

  return router;
}
