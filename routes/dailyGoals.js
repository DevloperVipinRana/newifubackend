const express = require("express");
const router = express.Router();
const prisma = require("../prismaClient"); // ✅ Prisma Client
const { authMiddleware } = require("./auth");

// Helper: format goal object for frontend
const formatGoalResponse = (goal) => ({
  _id: String(goal.id),
  id: goal.id,
  user_id: goal.user_id,
  text: goal.text,
  completed: Boolean(goal.completed),
  date: goal.created_at,
  created_at: goal.created_at,
  updated_at: goal.updated_at,
});

// ✅ Add a daily goal
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    const userId = Number(req.user.id);

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Goal text is required" });
    }

    const newGoal = await prisma.daily_goals.create({
      data: {
        user_id: userId,
        text: text.trim(),
        completed: 0,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    console.log("✅ Daily goal added:", newGoal);
    res.status(201).json(formatGoalResponse(newGoal));
  } catch (err) {
    console.error("❌ Error adding daily goal:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get today's daily goals
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user.id);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const goals = await prisma.daily_goals.findMany({
      where: {
        user_id: userId,
        created_at: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: { created_at: "desc" },
    });

    const formatted = goals.map(formatGoalResponse);
    console.log(`✅ Fetched ${formatted.length} daily goals for user ${userId}`);
    res.json(formatted);
  } catch (err) {
    console.error("❌ Error fetching daily goals:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Toggle completion
router.patch("/:id/toggle", authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const goalId = Number(req.params.id);

    const goal = await prisma.daily_goals.findFirst({
      where: { id: goalId, user_id: userId },
    });

    if (!goal) return res.status(404).json({ error: "Daily goal not found" });

    const updatedGoal = await prisma.daily_goals.update({
      where: { id: goalId },
      data: {
        completed: goal.completed ? 0 : 1,
        updated_at: new Date(),
      },
    });

    console.log("✅ Goal toggled:", updatedGoal);
    res.json(formatGoalResponse(updatedGoal));
  } catch (err) {
    console.error("❌ Error toggling goal:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Delete a daily goal
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const goalId = Number(req.params.id);

    const deleted = await prisma.daily_goals.deleteMany({
      where: { id: goalId, user_id: userId },
    });

    if (deleted.count === 0)
      return res.status(404).json({ error: "Daily goal not found" });

    console.log("✅ Goal deleted successfully");
    res.json({ message: "Daily goal deleted" });
  } catch (err) {
    console.error("❌ Error deleting goal:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get count of completed goals
router.get("/completed/count", authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user.id);

    const completedCount = await prisma.daily_goals.count({
      where: { user_id: userId, completed: 1 },
    });

    res.json({ completedCount });
  } catch (err) {
    console.error("❌ Error getting completed goals count:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Weekly goals summary
router.get("/weekly/status", authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user.id);

    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    const goals = await prisma.daily_goals.findMany({
      where: {
        user_id: userId,
        created_at: {
          gte: startOfWeek,
          lt: endOfWeek,
        },
      },
    });

    const weekStatus = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      const dateStr = day.toISOString().slice(0, 10);

      const dayGoals = goals.filter(
        (g) => g.created_at.toISOString().slice(0, 10) === dateStr
      );
      const total = dayGoals.length;
      const completed = dayGoals.filter((g) => g.completed).length;

      weekStatus.push({
        date: dateStr,
        totalGoals: total,
        completedGoals: completed,
        allCompleted: total > 0 && completed === total,
        hasIncomplete: total > 0 && completed < total,
      });
    }

    res.json(weekStatus);
  } catch (err) {
    console.error("❌ Error fetching weekly status:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;


