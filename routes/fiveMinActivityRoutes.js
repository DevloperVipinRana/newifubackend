const express = require("express");
const router = express.Router();
const prisma = require("../prismaClient"); // ✅ Prisma Client
const { authMiddleware } = require("./auth");

// ✅ Log a completed 5-min activity
router.post("/log", authMiddleware, async (req, res) => {
  try {
    const { activityKey, title } = req.body;
    const userId = Number(req.user.id);

    if (!activityKey || !title) {
      return res
        .status(400)
        .json({ message: "activityKey and title are required" });
    }

    // Create new log
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
