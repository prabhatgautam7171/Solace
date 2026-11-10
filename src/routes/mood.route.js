import express from "express";
import mongoose from "mongoose";
import Mood from "../models/Mood.js";
import authenticate from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticate);

// Get today's date according to user's timezone
const getTodayDate = (timezone = "Asia/Kolkata") => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
};

// Create a mood entry
router.post("/", async (req, res) => {
  try {
    const { mood, intensity, note } = req.body;

    const validMoods = [
      "happy",
      "calm",
      "neutral",
      "sad",
      "anxious",
      "angry",
    ];

    if (!validMoods.includes(mood)) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid mood",
      });
    }

    if (
      !Number.isInteger(intensity) ||
      intensity < 1 ||
      intensity > 5
    ) {
      return res.status(400).json({
        success: false,
        message: "Intensity must be between 1 and 5",
      });
    }

    if (note && typeof note !== "string") {
      return res.status(400).json({
        success: false,
        message: "Note must be a string",
      });
    }

    if (note && note.trim().length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Note cannot exceed 1000 characters",
      });
    }

    const timezone = req.user.preferences?.timezone || "Asia/Kolkata";

    const moodEntry = await Mood.create({
      user: req.user._id,
      mood,
      intensity,
      note: note?.trim() || "",
      dateKey: getTodayDate(timezone),
    });

    res.status(201).json({
      success: true,
      message: "Mood recorded successfully",
      mood: moodEntry,
    });
  } catch (error) {
    console.error("Create mood error:", error);

    res.status(500).json({
      success: false,
      message: "Could not record mood",
    });
  }
});

// Get all mood entries
router.get("/", async (req, res) => {
  try {
    const limit = Math.min(
      Math.max(parseInt(req.query.limit) || 30, 1),
      100
    );

    const moods = await Mood.find({
      user: req.user._id,
    })
      .sort({ createdAt: -1 })
      .limit(limit);

    res.status(200).json({
      success: true,
      count: moods.length,
      moods,
    });
  } catch (error) {
    console.error("Fetch moods error:", error);

    res.status(500).json({
      success: false,
      message: "Could not fetch mood history",
    });
  }
});

// Get today's mood entries
router.get("/today", async (req, res) => {
  try {
    const timezone = req.user.preferences?.timezone || "Asia/Kolkata";
    const today = getTodayDate(timezone);

    const moods = await Mood.find({
      user: req.user._id,
      dateKey: today,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      date: today,
      count: moods.length,
      moods,
    });
  } catch (error) {
    console.error("Fetch today's mood error:", error);

    res.status(500).json({
      success: false,
      message: "Could not fetch today's mood",
    });
  }
});

// Update a mood entry
router.patch("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid mood ID",
      });
    }

    const { mood, intensity, note } = req.body;

    const updates = {};

    if (mood !== undefined) {
      const validMoods = [
        "happy",
        "calm",
        "neutral",
        "sad",
        "anxious",
        "angry",
      ];

      if (!validMoods.includes(mood)) {
        return res.status(400).json({
          success: false,
          message: "Please select a valid mood",
        });
      }

      updates.mood = mood;
    }

    if (intensity !== undefined) {
      if (
        !Number.isInteger(intensity) ||
        intensity < 1 ||
        intensity > 5
      ) {
        return res.status(400).json({
          success: false,
          message: "Intensity must be between 1 and 5",
        });
      }

      updates.intensity = intensity;
    }

    if (note !== undefined) {
      if (
        typeof note !== "string" ||
        note.length > 1000
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid note. Maximum length is 1000 characters",
        });
      }

      updates.note = note.trim();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide at least one field to update",
      });
    }

    const moodEntry = await Mood.findOneAndUpdate(
      {
        _id: req.params.id,
        user: req.user._id,
      },
      updates,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!moodEntry) {
      return res.status(404).json({
        success: false,
        message: "Mood entry not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Mood updated successfully",
      mood: moodEntry,
    });
  } catch (error) {
    console.error("Update mood error:", error);

    res.status(500).json({
      success: false,
      message: "Could not update mood",
    });
  }
});

// Delete a mood entry
router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid mood ID",
      });
    }

    const moodEntry = await Mood.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!moodEntry) {
      return res.status(404).json({
        success: false,
        message: "Mood entry not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Mood deleted successfully",
    });
  } catch (error) {
    console.error("Delete mood error:", error);

    res.status(500).json({
      success: false,
      message: "Could not delete mood",
    });
  }
});

export default router;
