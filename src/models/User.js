
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const WELLNESS_GOALS = [
  "manage_stress",
  "improve_sleep",
  "build_confidence",
  "emotional_awareness",
  "practice_mindfulness",
  "build_habits",
];

const userSchema = new mongoose.Schema(
  {
    // ------------------------------------
    // 1. Personal information
    // ------------------------------------
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: 2,
      maxlength: 60,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },

    avatar: {
      type: String,
      default: null,
      trim: true,
    },

    bio: {
      type: String,
      default: "",
      trim: true,
      maxlength: 250,
    },

    // ------------------------------------
    // 2. Authentication and security
    // ------------------------------------
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 8,
      maxlength: 72,
      select: false,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    refreshTokenHash: {
      type: String,
      select: false,
      default: null,
    },

    refreshTokenExpiresAt: {
      type: Date,
      select: false,
      default: null,
    },

    lastActiveAt: {
      type: Date,
      default: null,
    },

    // ------------------------------------
    // 3. Wellness identity
    // ------------------------------------
    wellnessGoals: {
      type: [
        {
          type: String,
          enum: WELLNESS_GOALS,
        },
      ],
      default: [],
      validate: {
        validator: (goals) => goals.length <= 6,
        message: "You can select a maximum of 6 wellness goals.",
      },
    },

    onboardingCompleted: {
      type: Boolean,
      default: false,
    },

    // ------------------------------------
    // 4. App preferences
    // ------------------------------------
    preferences: {
      personalizationEnabled: {
        type: Boolean,
        default: true,
      },

      timezone: {
        type: String,
        default: "Asia/Kolkata",
        trim: true,
      },

      language: {
        type: String,
        default: "en",
        trim: true,
      },

      theme: {
        type: String,
        enum: ["system", "light", "dark"],
        default: "system",
      },

      weeklySummaryEnabled: {
        type: Boolean,
        default: true,
      },
    },

    // ------------------------------------
    // 5. Privacy preferences
    // ------------------------------------
    privacy: {
      analyticsEnabled: {
        type: Boolean,
        default: true,
      },

      aiPersonalizationEnabled: {
        type: Boolean,
        default: true,
      },
    },

    // ------------------------------------
    // 6. Account lifecycle
    // ------------------------------------
    deactivatedAt: {
      type: Date,
      default: null,
    },

    deletionRequestedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,

    toJSON: {
      transform(doc, ret) {
        delete ret.password;
        delete ret.refreshTokenHash;
        delete ret.refreshTokenExpiresAt;
        return ret;
      },
    },
  }
);

// ------------------------------------
// Password hashing
// ------------------------------------
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  this.password = await bcrypt.hash(this.password, 12);
});

// ------------------------------------
// Password comparison
// ------------------------------------
userSchema.methods.comparePassword = async function (
  candidatePassword
) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ------------------------------------
// Helpful indexes
// ------------------------------------
userSchema.index({ isActive: 1, createdAt: -1 });

const User = mongoose.model("User", userSchema);

export default User;
