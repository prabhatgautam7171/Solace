import mongoose from "mongoose";

const deviceTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    expoPushToken: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

deviceTokenSchema.index({ user: 1, expoPushToken: 1 }, { unique: true });

export default mongoose.model("DeviceToken", deviceTokenSchema);
