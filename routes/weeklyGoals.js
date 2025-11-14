const express = require("express");
const router = express.Router();
const { authMiddleware } = require("./auth");
const prisma = require("../prismaClient");

// Helper: Get start and end of current week (Sunday–Saturday)
const getCurrentWeekRange = () => {
  const now = new Date();
  const firstDayOfWeek = new Date(now);
  firstDayOfWeek.setDate(now.getDate() - now.getDay());
  firstDayOfWeek.setHours(0, 0, 0, 0);

  const lastDayOfWeek = new Date(firstDayOfWeek);
  lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);
  lastDayOfWeek.setHours(23, 59, 59, 999);

  return { start: firstDayOfWeek, end: lastDayOfWeek };
};

// Helper: Transform DB result to match frontend expectations
const transformGoal = (goal) => {
  if (!goal) return null;

  let feedbackEntries = [];
  if (goal.feedback_entries) {
    try {
      feedbackEntries =
        typeof goal.feedback_entries === "string"
          ? JSON.parse(goal.feedback_entries)
          : goal.feedback_entries;
    } catch (e) {
      console.error("Error parsing feedback_entries:", e);
      feedbackEntries = [];
    }
  }

  return {
    _id: goal.id.toString(),
    text: goal.text,
    progress: goal.progress,
    completed: Boolean(goal.completed),
    feedback_entries: feedbackEntries,
    week_start: goal.week_start,
    created_at: goal.created_at,
    updated_at: goal.updated_at,
  };
};

//
// ✅ Add a new weekly goal
//
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { text, progress = 0 } = req.body;
    const { start } = getCurrentWeekRange();

    const completed = progress === 100 ? 1 : 0;

const goal = await prisma.weekly_goals.create({
  data: {
    user_id: Number(req.user.id),
    text,
    progress,
    completed,
    feedback_entries: JSON.stringify([]),
    week_start: start,
  },
});


    res.status(201).json(transformGoal(goal));
  } catch (err) {
    console.error("❌ POST /weekly-goals error:", err);
    res.status(500).json({ error: err.message });
  }
});

//
// ✅ Get this week's goals
//
router.get("/", authMiddleware, async (req, res) => {
  try {
    const { start, end } = getCurrentWeekRange();

    const goals = await prisma.weekly_goals.findMany({
      where: {
        user_id: Number(req.user.id),
        week_start: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { created_at: "asc" },
    });

    res.json(goals.map(transformGoal));
  } catch (err) {
    console.error("❌ GET /weekly-goals error:", err);
    res.status(500).json({ error: err.message });
  }
});

//
// ✅ Toggle completed manually
//
router.patch("/:id/toggle", authMiddleware, async (req, res) => {
  try {
    const goal = await prisma.weekly_goals.findFirst({
      where: {
        id: Number(req.params.id),
        user_id: Number(req.user.id),
      },
    });

    if (!goal) {
      return res.status(404).json({ error: "WeeklyGoal not found" });
    }

    const updatedGoal = await prisma.weekly_goals.update({
      where: { id: goal.id },
      data: { completed: !goal.completed, updated_at: new Date() },
    });

    res.json(transformGoal(updatedGoal));
  } catch (err) {
    console.error("❌ PATCH /weekly-goals/:id/toggle error:", err);
    res.status(500).json({ error: err.message });
  }
});

//
// ✅ Delete a goal
//
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const deletedGoal = await prisma.weekly_goals.deleteMany({
      where: {
        id: Number(req.params.id),
        user_id: Number(req.user.id),
      },
    });

    if (deletedGoal.count === 0) {
      return res.status(404).json({ error: "WeeklyGoal not found" });
    }

    res.json({ message: "WeeklyGoal deleted successfully" });
  } catch (err) {
    console.error("❌ DELETE /weekly-goals/:id error:", err);
    res.status(500).json({ error: err.message });
  }
});

//
// ✅ Update goal progress and feedback
//
router.patch("/:id", authMiddleware, async (req, res) => {
  try {
    const { text, progress, feedback } = req.body;

    const goal = await prisma.weekly_goals.findFirst({
      where: { id: Number(req.params.id), user_id: Number(req.user.id) },
    });

    if (!goal) {
      return res.status(404).json({ error: "WeeklyGoal not found" });
    }

    const newProgress = progress ?? goal.progress;
    const completed = newProgress === 100;

    let feedbackEntries = [];
    if (goal.feedback_entries) {
      try {
        feedbackEntries =
          typeof goal.feedback_entries === "string"
            ? JSON.parse(goal.feedback_entries)
            : goal.feedback_entries;
      } catch (e) {
        feedbackEntries = [];
      }
    }

    if (feedback && feedback.trim() !== "") {
      feedbackEntries.push({
        progress: newProgress,
        feedback: feedback.trim(),
        created_at: new Date().toISOString(),
      });
    }

    const updatedGoal = await prisma.weekly_goals.update({
  where: { id: Number(req.params.id) },
  data: {
    text,
    progress: newProgress,
    completed: completed ? 1 : 0, // ✅ convert boolean → int (1 or 0)
    feedback_entries: JSON.stringify(feedbackEntries),
    updated_at: new Date(),
  },
});


    res.json(transformGoal(updatedGoal));
  } catch (err) {
    console.error("❌ PATCH /weekly-goals/:id error:", err);
    res.status(500).json({ error: err.message });
  }
});

//
// ✅ Get feedback history for a goal
//
router.get("/:id/feedback", authMiddleware, async (req, res) => {
  try {
    const goal = await prisma.weekly_goals.findFirst({
      where: { id: Number(req.params.id), user_id: Number(req.user.id) },
      select: { feedback_entries: true },
    });

    if (!goal) {
      return res.status(404).json({ error: "WeeklyGoal not found" });
    }

    let feedbackEntries = [];
    if (goal.feedback_entries) {
      try {
        feedbackEntries =
          typeof goal.feedback_entries === "string"
            ? JSON.parse(goal.feedback_entries)
            : goal.feedback_entries;
      } catch (e) {
        feedbackEntries = [];
      }
    }

    res.json(feedbackEntries);
  } catch (err) {
    console.error("❌ GET /weekly-goals/:id/feedback error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;