const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { authMiddleware } = require("./auth");
const prisma = require("../prismaClient");

// --- Multer setup for image uploads ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/posts/"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.user.id}_${Date.now()}${ext}`);
  },
});
const upload = multer({ storage });

// ✅ CREATE NEW POST
router.post("/", authMiddleware, upload.single("image"), async (req, res) => {
  try {
    const { text, hashtags } = req.body;

    const extractedHashtags = text ? text.match(/#\w+/g) || [] : [];
    let allHashtags = extractedHashtags;

    if (hashtags) {
      try {
        const parsed = JSON.parse(hashtags);
        allHashtags = [...new Set([...extractedHashtags, ...parsed])];
      } catch {
        console.warn("Invalid hashtags JSON");
      }
    }

    const imagePath = req.file ? `/uploads/posts/${req.file.filename}` : null;

    // Create post with hashtags
    const post = await prisma.posts.create({
      data: {
        user_id: Number(req.user.id),
        text,
        image: imagePath,
        created_at: new Date(),
        updated_at: new Date(),
        post_hashtags: {
          create: allHashtags.map((tag) => ({
            hashtag: tag.replace(/^#/, "").toLowerCase(),
          })),
        },
      },
      include: { post_hashtags: true },
    });

    res.status(201).json({ id: post.id, message: "Post created successfully" });
  } catch (err) {
    console.error("❌ POST /api/posts error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ✅ LIKE / UNLIKE POST (with notifications)
router.put("/:id/like", authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const postId = Number(req.params.id);

    // Get post details to find the post owner
    const post = await prisma.posts.findUnique({
      where: { id: postId },
      select: { user_id: true, text: true },
    });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const existingLike = await prisma.post_likes.findFirst({
      where: { user_id: userId, post_id: postId },
    });

    if (existingLike) {
      // Unlike: delete like and notification
      await prisma.$transaction([
        prisma.post_likes.delete({ where: { id: existingLike.id } }),
        prisma.notifications.deleteMany({
          where: {
            sender_id: userId,
            recipient_id: post.user_id,
            post_id: postId,
            type: "like",
          },
        }),
      ]);

      const likes = await prisma.post_likes.findMany({
        where: { post_id: postId },
        select: { user_id: true },
      });

      return res.json({
        liked: false,
        likes: likes.map((l) => l.user_id.toString()),
        message: "Post unliked",
      });
    }

    // Like: create like and notification (only if not liking own post)
    await prisma.post_likes.create({
      data: { user_id: userId, post_id: postId },
    });

    if (post.user_id !== userId) {
      // Get sender's name for notification
      const sender = await prisma.users.findUnique({
        where: { id: userId },
        select: { name: true },
      });

      await prisma.notifications.create({
        data: {
          sender_id: userId,
          recipient_id: post.user_id,
          post_id: postId,
          type: "like",
          text: `${sender.name} liked your post`,
          read: 0,
          created_at: new Date(),
        },
      });
    }

    const likes = await prisma.post_likes.findMany({
      where: { post_id: postId },
      select: { user_id: true },
    });

    res.json({
      liked: true,
      likes: likes.map((l) => l.user_id.toString()),
      message: "Post liked",
    });
  } catch (err) {
    console.error("❌ PUT /like error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ✅ ADD COMMENT (with notifications)
router.post("/:id/comment", authMiddleware, async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const userId = Number(req.user.id);
    const { text } = req.body;

    // Get post details to find the post owner
    const post = await prisma.posts.findUnique({
      where: { id: postId },
      select: { user_id: true, text: true },
    });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Create comment
    await prisma.post_comments.create({
      data: {
        post_id: postId,
        user_id: userId,
        text,
        created_at: new Date(),
      },
    });

    // Create notification (only if not commenting on own post)
    if (post.user_id !== userId) {
      // Get sender's name for notification
      const sender = await prisma.users.findUnique({
        where: { id: userId },
        select: { name: true },
      });

      await prisma.notifications.create({
        data: {
          sender_id: userId,
          recipient_id: post.user_id,
          post_id: postId,
          type: "comment",
          text: `${sender.name} commented on your post`,
          read: 0,
          created_at: new Date(),
        },
      });
    }

    const comments = await prisma.post_comments.findMany({
      where: { post_id: postId },
      include: {
        users: {
          select: { id: true, name: true, profile_image: true },
        },
      },
      orderBy: { created_at: "asc" },
    });

    const formattedComments = comments.map((c) => ({
      _id: c.id.toString(),
      text: c.text,
      user: {
        _id: c.user_id.toString(),
        name: c.users?.name,
        profileImage: c.users?.profile_image,
      },
    }));

    res.json({ message: "Comment added", comments: formattedComments });
  } catch (err) {
    console.error("❌ POST /comment error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ✅ FETCH FEED (excluding user's own posts) WITH INTEREST MATCHING
router.get("/feed", authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user.id);

    // Get current user's interests
    const currentUser = await prisma.users.findUnique({
      where: { id: userId },
      select: { interests: true },
    });

    let userInterests = [];
    if (currentUser?.interests) {
      try {
        userInterests = JSON.parse(currentUser.interests);
        // Normalize interests to lowercase for comparison
        userInterests = userInterests.map((interest) => interest.toLowerCase());
      } catch (err) {
        console.warn("Failed to parse user interests:", err);
      }
    }

    // Fetch all posts (excluding user's own)
    const posts = await prisma.posts.findMany({
      where: { deleted: 0, NOT: { user_id: userId } },
      include: {
        users: { select: { id: true, name: true, profile_image: true } },
        post_hashtags: true,
        post_likes: true,
        post_comments: {
          include: {
            users: { select: { id: true, name: true, profile_image: true } },
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    // Format posts and check if hashtags match user interests
    const formatted = posts.map((p) => {
      const postHashtags = p.post_hashtags.map((h) => h.hashtag.toLowerCase());
      
      // Check if any post hashtag matches any user interest
      const matchesInterest = userInterests.length > 0 && 
        postHashtags.some((hashtag) => 
          userInterests.some((interest) => 
            hashtag.includes(interest) || interest.includes(hashtag)
          )
        );

      return {
        _id: p.id.toString(),
        text: p.text,
        image: p.image,
        created_at: p.created_at,
        updated_at: p.updated_at,
        hashtags: p.post_hashtags.map((h) => `#${h.hashtag}`),
        likes: p.post_likes.map((l) => l.user_id.toString()),
        comments: p.post_comments.map((c) => ({
          _id: c.id.toString(),
          text: c.text,
          user: {
            _id: c.users?.id.toString(),
            name: c.users?.name,
            profileImage: c.users?.profile_image,
          },
        })),
        user: {
          _id: p.users?.id.toString(),
          name: p.users?.name,
          profileImage: p.users?.profile_image,
        },
        matchesInterest, // ✅ Add this flag for frontend
      };
    });

    // Sort: matching posts first, then others (both in descending order by date)
    const sortedPosts = [
      ...formatted.filter((p) => p.matchesInterest),
      ...formatted.filter((p) => !p.matchesInterest),
    ];

    console.log(`📊 Feed stats: ${sortedPosts.filter(p => p.matchesInterest).length} matching, ${sortedPosts.filter(p => !p.matchesInterest).length} other posts`);

    res.json(sortedPosts);
  } catch (err) {
    console.error("❌ GET /feed error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ✅ SOFT DELETE POST
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const userId = Number(req.user.id);

    const post = await prisma.posts.updateMany({
      where: { id: postId, user_id: userId },
      data: { deleted: 1 },
    });

    if (post.count === 0)
      return res
        .status(404)
        .json({ message: "Post not found or not owned by user" });

    res.json({ message: "Post deleted (soft)" });
  } catch (err) {
    console.error("❌ DELETE /post error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.get("/my-posts", authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user.id);

    // Fetch only current user's posts
    const posts = await prisma.posts.findMany({
      where: { deleted: 0, user_id: userId },
      include: {
        users: { select: { id: true, name: true, profile_image: true } },
        post_hashtags: true,
        post_likes: true,
        post_comments: {
          include: {
            users: { select: { id: true, name: true, profile_image: true } },
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    // Format posts
    const formatted = posts.map((p) => ({
      _id: p.id.toString(),
      text: p.text,
      image: p.image,
      created_at: p.created_at,
      updated_at: p.updated_at,
      hashtags: p.post_hashtags.map((h) => `#${h.hashtag}`),
      likes: p.post_likes.map((l) => l.user_id.toString()),
      comments: p.post_comments.map((c) => ({
        _id: c.id.toString(),
        text: c.text,
        user: {
          _id: c.users?.id.toString(),
          name: c.users?.name,
          profileImage: c.users?.profile_image,
        },
      })),
      user: {
        _id: p.users?.id.toString(),
        name: p.users?.name,
        profileImage: p.users?.profile_image,
      },
    }));

    console.log(`📊 User posts: ${formatted.length} posts found for user ${userId}`);

    res.json(formatted);
  } catch (err) {
    console.error("❌ GET /my-posts error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});


module.exports = router;
