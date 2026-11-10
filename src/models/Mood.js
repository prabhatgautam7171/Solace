import mongoose from "mongoose";

const moodSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    mood: {
      type: String,
      enum: ["happy", "calm", "neutral", "sad", "anxious", "angry"],
      required: true,
    },

    intensity: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },

    note: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    dateKey: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

moodSchema.index({ user: 1, dateKey: 1, createdAt: -1 });

const Mood = mongoose.model("Mood", moodSchema);

export default Mood;
