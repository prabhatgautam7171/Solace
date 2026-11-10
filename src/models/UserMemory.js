
import mongoose from "mongoose";

const profileSchema = new mongoose.Schema(
  {
    preferredName: {
      type: String,
      default: "",
      maxlength: 50,
      trim: true,
    },

    interests: {
      type: [String],
      default: [],
    },

    communicationStyle: {
      type: String,
      default: "",
      maxlength: 200,
      trim: true,
    },

    likes: {
      type: [String],
      default: [],
    },

    dislikes: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

const memorySchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: [
        "goal",
        "preference",
        "important_event",
        "personal",
      ],
      required: true,
    },

    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },

    importance: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5,
    },

    source: {
      type: String,
      enum: ["conversation", "explicit"],
      default: "conversation",
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const userMemorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    profile: {
      type: profileSchema,
      default: () => ({}),
    },

    memories: {
      type: [memorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const UserMemory = mongoose.model("UserMemory", userMemorySchema);

export default UserMemory;
