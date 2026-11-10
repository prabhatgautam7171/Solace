import express from "express";
import mongoose from "mongoose";
import Reminder from "../models/Reminder.js";
import DeviceToken from "../models/DeviceToken.js";
import authenticate from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticate);

// Register or update a device's Expo push token
router.post("/device-token", async (req, res, next) => {
  try {
    const { expoPushToken } = req.body;

    if (
      typeof expoPushToken !== "string" ||
      !ExpoPushTokenIsValid(expoPushToken)
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid Expo push token is required.",
      });
    }

    await DeviceToken.findOneAndUpdate(
      { user: req.user._id, expoPushToken },
      { user: req.user._id, expoPushToken },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({
      success: true,
      message: "Device token registered successfully.",
    });
  } catch (error) {
    next(error);
  }
});

// Create reminder
router.post("/", async (req, res, next) => {
  try {
    const { title, body, type, scheduledAt, repeat } = req.body;

    if (!title?.trim() || !body?.trim() || !scheduledAt) {
      return res.status(400).json({
        success: false,
        message: "Title, body and scheduledAt are required.",
      });
    }

    const scheduledDate = new Date(scheduledAt);

    if (Number.isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "scheduledAt must be a valid future date.",
      });
    }

    const reminder = await Reminder.create({
      user: req.user._id,
      title,
      body,
      type: type || "custom",
      scheduledAt: scheduledDate,
      nextRunAt: scheduledDate,
      repeat: repeat || "none",
    });

    res.status(201).json({
      success: true,
      reminder,
    });
  } catch (error) {
    next(error);
  }
});

// Get user's reminders
router.get("/", async (req, res, next) => {
  try {
    const reminders = await Reminder.find({ user: req.user._id }).sort({
      nextRunAt: 1,
    });

    res.json({
      success: true,
      count: reminders.length,
      reminders,
    });
  } catch (error) {
    next(error);
  }
});

// Update reminder
router.patch("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid reminder ID.",
      });
    }

    const allowedFields = ["title", "body", "type", "scheduledAt", "repeat", "enabled"];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (updates.scheduledAt !== undefined) {
      const date = new Date(updates.scheduledAt);

      if (Number.isNaN(date.getTime()) || date <= new Date()) {
        return res.status(400).json({
          success: false,
          message: "scheduledAt must be a valid future date.",
        });
      }

      updates.scheduledAt = date;
      updates.nextRunAt = date;
    }

    const reminder = await Reminder.findOneAndUpdate(
      { _id: id, user: req.user._id },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: "Reminder not found.",
      });
    }

    res.json({ success: true, reminder });
  } catch (error) {
    next(error);
  }
});

// Delete reminder
router.delete("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid reminder ID.",
      });
    }

    const reminder = await Reminder.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: "Reminder not found.",
      });
    }

    res.json({
      success: true,
      message: "Reminder deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
});

function ExpoPushTokenIsValid(token) {
  return /^ExponentPushToken\[[^\]]+\]$/.test(token) ||
    /^ExpoPushToken\[[^\]]+\]$/.test(token);
}

export default router;
