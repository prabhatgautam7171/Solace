import express from "express";
import Mood from "../models/Mood.js";
import Activity from "../models/Activity.js";
import authenticate from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticate);

// Get date range
const getDateRange = (period = "7d") => {
  const days = period === "30d" ? 30 : 7;
  const endDate = new Date();
  const startDate = new Date();

  startDate.setDate(startDate.getDate() - days);

  return { startDate, endDate, days };
};

// Get overall wellness overview
router.get("/overview", async (req, res) => {
  try {
    const userId = req.user._id;
    const { startDate, endDate } = getDateRange(
      req.query.period === "30d" ? "30d" : "7d"
    );

    const [moodStats, activityStats] = await Promise.all([
      Mood.aggregate([
        {
          $match: {
            user: userId,
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: null,
            totalEntries: { $sum: 1 },
            averageIntensity: { $avg: "$intensity" },
          },
        },
      ]),

      Activity.aggregate([
        {
          $match: {
            user: userId,
            completedAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: null,
            totalActivities: { $sum: 1 },
            totalMinutes: { $sum: "$durationMinutes" },
          },
        },
      ]),
    ]);

    res.status(200).json({
      success: true,
      period: req.query.period === "30d" ? "30 days" : "7 days",
      overview: {
        totalMoodEntries: moodStats[0]?.totalEntries || 0,
        averageMoodIntensity: Number(
          (moodStats[0]?.averageIntensity || 0).toFixed(1)
        ),
        completedActivities: activityStats[0]?.totalActivities || 0,
        totalWellnessMinutes: activityStats[0]?.totalMinutes || 0,
      },
    });
  } catch (error) {
    console.error("Overview error:", error);

    res.status(500).json({
      success: false,
      message: "Could not fetch wellness overview",
    });
  }
});

// Get mood distribution and trends
router.get("/moods", async (req, res) => {
  try {
    const userId = req.user._id;
    const { startDate, endDate } = getDateRange(
      req.query.period === "30d" ? "30d" : "7d"
    );

    const moods = await Mood.find({
      user: userId,
      createdAt: { $gte: startDate, $lte: endDate },
    }).sort({ createdAt: 1 });

    const moodCounts = {};

    const dailyTrends = {};

    let totalIntensity = 0;

    moods.forEach((entry) => {
      moodCounts[entry.mood] = (moodCounts[entry.mood] || 0) + 1;

      dailyTrends[entry.dateKey] =
        dailyTrends[entry.dateKey] || {
          date: entry.dateKey,
          entries: 0,
          totalIntensity: 0,
        };

      dailyTrends[entry.dateKey].entries++;
      dailyTrends[entry.dateKey].totalIntensity += entry.intensity;

      totalIntensity += entry.intensity;
    });

    const moodDistribution = Object.entries(moodCounts).map(
      ([mood, count]) => ({
        mood,
        count,
        percentage: moods.length
          ? Number(((count / moods.length) * 100).toFixed(1))
          : 0,
      })
    );

    const trends = Object.values(dailyTrends).map((day) => ({
      date: day.date,
      entries: day.entries,
      averageIntensity: Number(
        (day.totalIntensity / day.entries).toFixed(1)
      ),
    }));

    const mostFrequentMood = moodDistribution.sort(
      (a, b) => b.count - a.count
    )[0]?.mood || null;

    res.status(200).json({
      success: true,
      totalEntries: moods.length,
      averageIntensity: moods.length
        ? Number((totalIntensity / moods.length).toFixed(1))
        : 0,
      mostFrequentMood,
      moodDistribution,
      dailyTrends: trends,
    });
  } catch (error) {
    console.error("Mood insights error:", error);

    res.status(500).json({
      success: false,
      message: "Could not fetch mood insights",
    });
  }
});

// Get activity statistics
router.get("/activities", async (req, res) => {
  try {
    const userId = req.user._id;
    const { startDate, endDate } = getDateRange(
      req.query.period === "30d" ? "30d" : "7d"
    );

    const activities = await Activity.aggregate([
      {
        $match: {
          user: userId,
          completedAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: "$category",
          totalCompleted: { $sum: 1 },
          totalMinutes: { $sum: "$durationMinutes" },
        },
      },
      {
        $sort: { totalCompleted: -1 },
      },
    ]);

    const totalActivities = activities.reduce(
      (sum, item) => sum + item.totalCompleted,
      0
    );

    const totalMinutes = activities.reduce(
      (sum, item) => sum + item.totalMinutes,
      0
    );

    res.status(200).json({
      success: true,
      totalActivities,
      totalMinutes,
      categoryBreakdown: activities.map((item) => ({
        category: item._id,
        completed: item.totalCompleted,
        minutes: item.totalMinutes,
      })),
    });
  } catch (error) {
    console.error("Activity insights error:", error);

    res.status(500).json({
      success: false,
      message: "Could not fetch activity insights",
    });
  }
});

// Get weekly progress
router.get("/weekly", async (req, res) => {
  try {
    const userId = req.user._id;
    const { startDate, endDate } = getDateRange("7d");

    const [moods, activities] = await Promise.all([
      Mood.find({
        user: userId,
        createdAt: { $gte: startDate, $lte: endDate },
      }).select("mood intensity dateKey createdAt"),

      Activity.find({
        user: userId,
        completedAt: { $gte: startDate, $lte: endDate },
      }).select("category durationMinutes completedAt"),
    ]);

    const moodDays = new Set(moods.map((item) => item.dateKey));
    const activityDays = new Set(
      activities.map((item) => item.completedAt.toISOString().slice(0, 10))
    );

    const averageIntensity = moods.length
      ? moods.reduce((sum, item) => sum + item.intensity, 0) / moods.length
      : 0;

    res.status(200).json({
      success: true,
      period: "Last 7 days",
      progress: {
        moodCheckIns: moods.length,
        moodTrackingDays: moodDays.size,
        averageMoodIntensity: Number(averageIntensity.toFixed(1)),
        activitiesCompleted: activities.length,
        activeActivityDays: activityDays.size,
        wellnessMinutes: activities.reduce(
          (sum, item) => sum + item.durationMinutes,
          0
        ),
      },
    });
  } catch (error) {
    console.error("Weekly insights error:", error);

    res.status(500).json({
      success: false,
      message: "Could not fetch weekly progress",
    });
  }
});

export default router;
