import mongoose from "mongoose";



const activitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    activityId: {
      type: String,
      required: true,
    },

    title: {
      type: String,
      required: true,
    },

    category: {
      type: String,
      enum: [
        "breathing",
        "meditation",
        "journaling",
        "self-care",
        "grounding",
        "affirmation",
      ],
      required: true,
    },

    durationMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },

    completedAt: {
      type: Date,
      default: Date.now,
    },

    note: {
      type: String,
      maxlength: 1000,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {

    timestamps: true,
  }
);



activitySchema.index({ user: 1, completedAt: -1 });

const Activity = mongoose.model("Activity", activitySchema);

export default Activity;
