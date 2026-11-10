import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      default: "New conversation",
      trim: true,
    },

    messages: [
      {
        role: {
          type: String,
          enum: ["user", "assistant"],
          required: true,
        },

        content: {
          type: String,
          required: true,
          trim: true,
        },

        // Assistant response metadata
        responseType: {
          type: String,
          enum: [
            "conversation",
            "encouragement",
            "reflection",
            "activity",
            "breathing",
            "affirmation",
            "check_in",
          ],
          default: "conversation",
        },

        mascot: {
          emotion: {
            type: String,
            enum: [
              "neutral",
              "curious",
              "happy",
              "comforting",
              "calm",
              "thinking",
              "speaking",
            ],
            default: "neutral",
          },

          animation: {
            type: String,
            enum: ["idle", "float", "bounce", "think", "gentle", "celebrate"],
            default: "idle",
          },

          intensity: {
            type: Number,
            min: 0,
            max: 1,
            default: 0.5,
          },
        },

        suggestedReplies: {
          type: [String],
          default: [],
          validate: {
            validator: (replies) =>
              replies.length <= 3 &&
              replies.every((reply) => reply.length <= 100),
            message: "Maximum 3 suggested replies, each up to 100 characters.",
          },
        },

        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
