import express from "express";
import Activity from "../models/Activity.js";
import authenticate from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticate);

// Predefined wellness activities
const activities = [
  {
    id: "box-breathing",
    title: "Box Breathing",
    category: "breathing",
    description: "A simple breathing technique to help you feel calm and focused.",
    durationMinutes: 5,
    instructions: [
      "Sit comfortably and relax your shoulders.",
      "Breathe in slowly for 4 seconds.",
      "Hold your breath gently for 4 seconds.",
      "Breathe out slowly for 4 seconds.",
      "Pause for 4 seconds and repeat.",
    ],
  },
  {
    id: "deep-breathing",
    title: "Deep Breathing",
    category: "breathing",
    description: "Slow, comfortable breathing to help you relax.",
    durationMinutes: 3,
    instructions: [
      "Find a comfortable position.",
      "Breathe in gently through your nose.",
      "Breathe out slowly without forcing it.",
      "Continue at a comfortable pace.",
    ],
  },
  {
    id: "mindful-meditation",
    title: "Mindful Meditation",
    category: "meditation",
    description: "Take a few minutes to notice the present moment.",
    durationMinutes: 10,
    instructions: [
      "Sit somewhere comfortable.",
      "Gently bring your attention to your breathing.",
      "Notice thoughts without judging them.",
      "When your mind wanders, gently return to your breath.",
      "Finish by noticing how you feel.",
    ],
  },
  {
    id: "gratitude-journal",
    title: "Gratitude Journal",
    category: "journaling",
    description: "Reflect on small things you appreciate today.",
    durationMinutes: 5,
    instructions: [
      "Find a quiet place.",
      "Write down three things you appreciate.",
      "Think about why each one matters to you.",
      "Notice how reflecting on them makes you feel.",
    ],
  },
  {
    id: "daily-reflection",
    title: "Daily Reflection",
    category: "journaling",
    description: "Explore your thoughts and emotions through writing.",
    durationMinutes: 10,
    instructions: [
      "How am I feeling right now?",
      "What was the best part of my day?",
      "What challenged me today?",
      "What is one kind thing I can do for myself tomorrow?",
    ],
  },
  {
    id: "mindful-walk",
    title: "Mindful Walk",
    category: "self-care",
    description: "Take a gentle walk and pay attention to your surroundings.",
    durationMinutes: 10,
    instructions: [
      "Choose a comfortable and safe place to walk.",
      "Walk at a relaxed pace.",
      "Notice the sights, sounds and sensations around you.",
      "Return whenever you feel ready.",
    ],
  },
  {
    id: "grounding-exercise",
    title: "5-4-3-2-1 Grounding",
    category: "grounding",
    description:
      "Reconnect with the present moment through your five senses.",
    durationMinutes: 5,
    instructions: [
      "Pause and take a comfortable breath.",
      "Notice five things you can see.",
      "Notice four things you can physically feel.",
      "Notice three things you can hear.",
      "Notice two things you can smell.",
      "Notice one thing you can taste.",
      "Take a moment to notice how you feel.",
    ],
  },
  {
    id: "daily-affirmation",
    title: "Daily Affirmation",
    category: "affirmation",
    description:
      "Take a moment to connect with a kind and encouraging thought.",
    durationMinutes: 2,
    instructions: [
      "Find a comfortable and quiet position.",
      "Read your affirmation slowly.",
      "Take a moment to reflect on what it means to you.",
      "Repeat it gently if it feels helpful.",
    ],
  },
];

// Get all activities
router.get("/", (req, res) => {
  try {
    const { category } = req.query;

    let result = activities;

    if (category) {
      result = activities.filter(
        (activity) => activity.category === category
      );
    }

    res.status(200).json({
      success: true,
      count: result.length,
      activities: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Could not fetch activities",
    });
  }
});

// Get completed activity history
router.get("/history", async (req, res) => {
  try {
    const limit = Math.min(
      Math.max(parseInt(req.query.limit) || 30, 1),
      100
    );

    const history = await Activity.find({
      user: req.user._id,
    })
      .sort({ completedAt: -1 })
      .limit(limit);

    res.status(200).json({
      success: true,
      count: history.length,
      history,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Could not fetch activity history",
    });
  }
});

// Get activity statistics
router.get("/stats", async (req, res) => {
  try {
    const stats = await Activity.aggregate([
      {
        $match: {
          user: req.user._id,
        },
      },
      {
        $group: {
          _id: "$category",
          totalCompleted: { $sum: 1 },
          totalMinutes: { $sum: "$durationMinutes" },
        },
      },
    ]);

    const totalActivities = stats.reduce(
      (sum, item) => sum + item.totalCompleted,
      0
    );

    const totalMinutes = stats.reduce(
      (sum, item) => sum + item.totalMinutes,
      0
    );

    res.status(200).json({
      success: true,
      totalActivities,
      totalMinutes,
      categoryStats: stats,
    });
  } catch (error) {
    console.error("Activity stats error:", error);

    res.status(500).json({
      success: false,
      message: "Could not fetch activity statistics",
    });
  }
});

// Get activity details
router.get("/:id", (req, res) => {
  const activity = activities.find(
    (item) => item.id === req.params.id
  );

  if (!activity) {
    return res.status(404).json({
      success: false,
      message: "Activity not found",
    });
  }

  res.status(200).json({
    success: true,
    activity,
  });
});

// Complete an activity
router.post("/:id/complete", async (req, res) => {
  try {
    const activity = activities.find(
      (item) => item.id === req.params.id
    );

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found",
      });
    }
    const { durationMinutes, note, metadata } = req.body;

    if (
      durationMinutes !== undefined &&
      (!Number.isInteger(durationMinutes) ||
        durationMinutes < 0 ||
        durationMinutes > 1440)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid activity duration",
      });
    }

    if (
      note !== undefined &&
      (typeof note !== "string" || note.length > 1000)
    ) {
      return res.status(400).json({
        success: false,
        message: "Note must be a string of at most 1000 characters",
      });
    }

    const completedActivity = await Activity.create({
      user: req.user._id,
      activityId: activity.id,
      title: activity.title,
      category: activity.category,
      durationMinutes: durationMinutes ?? activity.durationMinutes,
      note: note?.trim() || "",
      metadata:
        metadata && typeof metadata === "object" && !Array.isArray(metadata)
          ? metadata
          : {},
    });

    res.status(201).json({
      success: true,
      message: "Activity completed successfully",
      activity: completedActivity,
    });
  } catch (error) {
    console.error("Complete activity error:", error);

    res.status(500).json({
      success: false,
      message: "Could not complete activity",
    });
  }
});



export default router;
