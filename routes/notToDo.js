const express = require("express");
const router = express.Router();
const { authMiddleware } = require("./auth");
const prisma = require("../prismaClient");

// ✅ POST /api/not-to-do — Save multiple habits
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { habits } = req.body; // expects an array of habit strings
    const userId = Number(req.user.id);

    if (!habits || !Array.isArray(habits) || habits.length === 0) {
      return res.status(400).json({ message: "No habits provided" });
    }

    // Create multiple habits in one go using Prisma's createMany
    const result = await prisma.not_to_dos.createMany({
      data: habits.map((habit) => ({
        user_id: userId,
        habit: habit.trim(),
        date: new Date(),
      })),
    });

    res.status(201).json({
      message: "Habits saved successfully",
      insertedCount: result.count,
    });
  } catch (err) {
    console.error("❌ Error saving habits:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ✅ GET /api/not-to-do/recent — Get 3 most recent habits
router.get("/recent", authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user.id);

    const habits = await prisma.not_to_dos.findMany({
      where: { user_id: userId },
      orderBy: { date: "desc" },
      take: 3, // limit 3
    });

    res.json({ habits });
  } catch (err) {
    console.error("❌ Error fetching recent habits:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;

