const express = require("express");
const router = express.Router();
const path = require("path");
const multer = require("multer");
const prisma = require("../prismaClient");
const { authMiddleware } = require("./auth");

// --- Multer setup for image uploads ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/icompleted"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.user.id}_${Date.now()}${ext}`);
  },
});

const upload = multer({ storage });

// --- Helper to format responses ---
const formatAchievement = (achievement) => ({
  _id: String(achievement.id),
  id: achievement.id,
  user_id: achievement.user_id,
  achievementText: achievement.achievement_text,
  achievement_text: achievement.achievement_text,
  image: achievement.image,
  created_at: achievement.created_at,
  updated_at: achievement.updated_at,
  createdAt: achievement.created_at,
  updatedAt: achievement.updated_at,
});

// ✅ POST /api/icompleted — Add a new achievement
router.post("/", authMiddleware, upload.single("image"), async (req, res) => {
  try {
    const { achievementText } = req.body;
    const userId = Number(req.user.id);

    if (!achievementText || achievementText.trim().length < 3) {
      return res.status(400).json({ message: "Achievement text too short." });
    }

    const imagePath = req.file ? `/uploads/icompleted/${req.file.filename}` : null;

    // Create the record in PostgreSQL
    const newAchievement = await prisma.icompleted.create({
      data: {
        user_id: userId,
        achievement_text: achievementText.trim(),
        image: imagePath,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    console.log("✅ Achievement created:", newAchievement.id);

    res.status(201).json({
      message: "Achievement saved!",
      achievement: formatAchievement(newAchievement),
    });
  } catch (err) {
    console.error("❌ POST /api/icompleted error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ✅ GET /api/icompleted/my — Get all user achievements
router.get("/my", authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user.id);

    const achievements = await prisma.icompleted.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
    });

    console.log(`✅ Fetched ${achievements.length} achievements for user ${userId}`);

    res.json(achievements.map(formatAchievement));
  } catch (err) {
    console.error("❌ GET /api/icompleted/my error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ✅ DELETE /api/icompleted/:id — Delete achievement
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const achievementId = Number(req.params.id);

    // Ensure the record belongs to this user before deleting
    const achievement = await prisma.icompleted.findFirst({
      where: { id: achievementId, user_id: userId },
    });

    if (!achievement) {
      return res.status(404).json({ message: "Achievement not found or unauthorized" });
    }

    await prisma.icompleted.delete({ where: { id: achievementId } });

    console.log("✅ Achievement deleted:", achievementId);
    res.json({ message: "Achievement deleted successfully" });
  } catch (err) {
    console.error("❌ DELETE /api/icompleted error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
