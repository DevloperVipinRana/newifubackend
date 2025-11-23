const express = require("express");
const router = express.Router();
const prisma = require("../prismaClient");
const { authMiddleware } = require("./auth");

// ✅ Get all activities from library
router.get("/library", authMiddleware, async (req, res) => {
  try {
    const activities = await prisma.five_min_library.findMany({
      orderBy: { id: 'asc' }
    });

    console.log(`✅ Retrieved ${activities.length} activities from library`);
    res.json(activities);
  } catch (err) {
    console.error("❌ Error in GET /five-min/library:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ✅ Get activities filtered by type/category
router.get("/library/filter", authMiddleware, async (req, res) => {
  try {
    const { type, category } = req.query;
    
    const where = {};
    if (type) where.type = type;
    if (category) where.category = { contains: category };

    const activities = await prisma.five_min_library.findMany({
      where,
      orderBy: { id: 'asc' }
    });

    console.log(`✅ Filtered activities: ${activities.length}`);
    res.json(activities);
  } catch (err) {
    console.error("❌ Error in GET /five-min/library/filter:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ✅ Get single activity by key
router.get("/library/:activityKey", authMiddleware, async (req, res) => {
  try {
    const { activityKey } = req.params;

    const activity = await prisma.five_min_library.findUnique({
      where: { activity_key: activityKey }
    });

    if (!activity) {
      return res.status(404).json({ message: "Activity not found" });
    }

    console.log(`✅ Retrieved activity: ${activity.title}`);
    res.json(activity);
  } catch (err) {
    console.error("❌ Error in GET /five-min/library/:activityKey:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ✅ Log a completed 5-min activity
router.post("/log", authMiddleware, async (req, res) => {
  try {
    const { activityKey, title, category } = req.body;
    const userId = Number(req.user.id);

    if (!activityKey || !title) {
      return res
        .status(400)
        .json({ message: "activityKey and title are required" });
    }

    const newLog = await prisma.five_min_activities.create({
      data: {
        user_id: userId,
        activity_key: activityKey,
        title,
        date: new Date(),
        completed_at: new Date(),
      },
    });

    console.log("✅ 5-Min Activity logged:", newLog);
    res.status(201).json(newLog);
  } catch (err) {
    console.error("❌ Error in POST /five-min/log:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ✅ Get all logs of current user
router.get("/logs", authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user.id);

    const logs = await prisma.five_min_activities.findMany({
      where: { user_id: userId },
      orderBy: { completed_at: "desc" },
    });

    console.log(`✅ Retrieved ${logs.length} logs for user ${userId}`);
    res.json(logs);
  } catch (err) {
    console.error("❌ Error in GET /five-min/logs:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
