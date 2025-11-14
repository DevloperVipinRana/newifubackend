// routes/activityRoutes.js
const express = require("express");
const router = express.Router();
const prisma = require("../prismaClient"); // ✅ Prisma client
const { authMiddleware } = require("./auth");

// ✅ Save completed activity
router.post("/complete", authMiddleware, async (req, res) => {
  console.log("✅ Activity completion request received:", req.body);
  console.log("🔐 User from auth middleware:", req.user);

  try {
    const { activityKey, title, response, feedback } = req.body;

    if (!activityKey || !title) {
      return res.status(400).json({ message: "Missing activityKey or title" });
    }

    // Check if user_id exists
    if (!req.user || !req.user.id) {
      console.error("❌ No user ID found in request");
      return res.status(401).json({ message: "User not authenticated" });
    }

    const userId = Number(req.user.id);
    console.log("📝 Creating activity with user_id:", userId);

    // Validate user_id is a valid number
    if (isNaN(userId)) {
      console.error("❌ Invalid user ID:", req.user.id);
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const feedbackType = feedback?.type || null;
    const feedbackValue = feedback?.value || null;
    const feedbackEmoji = feedback?.emoji || null;
    const feedbackLabel = feedback?.label || null;

    console.log("💾 Attempting to save activity to database...");

    const activity = await prisma.activities.create({
      data: {
        user_id: userId,
        activity_key: activityKey,
        title,
        response: response || null,
        feedback_type: feedbackType,
        feedback_value: feedbackValue,
        feedback_emoji: feedbackEmoji,
        feedback_label: feedbackLabel,
        date: new Date(),
        completed_at: new Date(),
      },
    });

    console.log("✅ Activity saved successfully, ID:", activity.id);
    res.status(201).json({ message: "Activity saved", log: activity });
  } catch (err) {
    console.error("❌ Error saving activity:", err);
    console.error("❌ Error name:", err.name);
    console.error("❌ Error message:", err.message);
    console.error("❌ Error stack:", err.stack);
    
    // Send more detailed error in development
    res.status(500).json({ 
      message: "Server error",
      error: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});




// ✅ Update activity feedback
router.post("/update-feedback", authMiddleware, async (req, res) => {
  console.log("✅ Feedback update request received:", req.body);

  try {
    const { activityKey, title, feedback } = req.body;

    if (!activityKey || !title) {
      return res.status(400).json({ message: "Missing activityKey or title" });
    }

    // Find most recent activity
    const log = await prisma.activities.findFirst({
      where: {
        user_id: req.user.id,
        activity_key: activityKey,
        title,
      },
      orderBy: { completed_at: "desc" },
    });

    if (!log) {
      return res.status(404).json({ message: "Activity not found" });
    }

    const updated = await prisma.activities.update({
      where: { id: log.id },
      data: {
        feedback_type: feedback?.type || null,
        feedback_value: feedback?.value || null,
        feedback_emoji: feedback?.emoji || null,
        feedback_label: feedback?.label || null,
      },
    });

    res.json({ message: "Feedback updated", log: updated });
  } catch (err) {
    console.error("❌ Error updating feedback:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Get today's activities
router.get("/today", authMiddleware, async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const logs = await prisma.activities.findMany({
      where: {
        user_id: req.user.id,
        date: { gte: startOfDay, lte: endOfDay },
      },
      orderBy: { completed_at: "desc" },
    });

    const transformed = logs.map((log) => ({
      ...log,
      feedback: {
        type: log.feedback_type,
        value: log.feedback_value,
        emoji: log.feedback_emoji,
        label: log.feedback_label,
      },
    }));

    res.json(transformed);
  } catch (err) {
    console.error("❌ Error fetching today's activities:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Get activity history
router.get("/history", authMiddleware, async (req, res) => {
  try {
    const logs = await prisma.activities.findMany({
      where: { user_id: req.user.id },
      orderBy: { completed_at: "desc" },
      take: 50,
    });

    const transformed = logs.map((log) => ({
      ...log,
      feedback: {
        type: log.feedback_type,
        value: log.feedback_value,
        emoji: log.feedback_emoji,
        label: log.feedback_label,
      },
    }));

    res.json(transformed);
  } catch (err) {
    console.error("❌ Error fetching history:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
