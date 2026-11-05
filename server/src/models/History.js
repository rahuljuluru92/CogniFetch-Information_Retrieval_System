import mongoose from "mongoose";

const historySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    subject: { type: String, required: true, trim: true, maxlength: 100 },
    subjectKey: { type: String, required: true },
    concepts: {
      type: [{ type: String, trim: true, maxlength: 200 }],
      validate: [(list) => list.length > 0 && list.length <= 100, "1–100 concepts required"],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.user;
        delete ret.subjectKey;
        return ret;
      },
    },
  },
);

// One saved list per subject per user; saving the same subject again updates it.
historySchema.index({ user: 1, subjectKey: 1 }, { unique: true });
historySchema.index({ user: 1, updatedAt: -1 });

export const subjectKeyOf = (subject) => subject.trim().toLowerCase();

export const History = mongoose.models.History ?? mongoose.model("History", historySchema);
