import mongoose from "mongoose";

const reminderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 250,
    },
    type: {
      type: String,
      enum: ["mood_checkin", "affirmation", "breathing", "self_care", "custom"],
      default: "custom",
    },
    scheduledAt: {
      type: Date,
      required: true,
    },
    nextRunAt: {
      type: Date,
      required: true,
      index: true,
    },
    repeat: {
      type: String,
      enum: ["none", "daily", "weekly"],
      default: "none",
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    lastSentAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

reminderSchema.index({ enabled: 1, nextRunAt: 1 });

export default mongoose.model("Reminder", reminderSchema);
