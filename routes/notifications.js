const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Middleware to verify JWT token (adjust based on your auth setup)
const { authMiddleware } = require("./auth");

// Get all notifications for current user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id; // Adjust based on your auth middleware

    const notifications = await prisma.notifications.findMany({
      where: {
        recipient_id: userId,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            profile_image: true,
          },
        },
        post: {
          select: {
            id: true,
            text: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      take: 50,
    });

    // Format response to match frontend expectations
    const formattedNotifications = notifications.map(notif => ({
      _id: notif.id.toString(),
      sender: {
        _id: notif.sender.id.toString(),
        name: notif.sender.name,
        profileImage: notif.sender.profile_image,
      },
      type: notif.type, // This now includes 'share'
      post: {
        _id: notif.post.id.toString(),
        text: notif.post.text,
      },
      text: notif.text,
      read: notif.read === 1,
      createdAt: notif.created_at.toISOString(),
    }));

    res.json(formattedNotifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = parseInt(req.params.id);

    const notification = await prisma.notifications.updateMany({
      where: {
        id: notificationId,
        recipient_id: userId,
      },
      data: {
        read: 1,
      },
    });

    if (notification.count === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Failed to update notification' });
  }
});

// Mark all notifications as read
router.put('/read-all', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    await prisma.notifications.updateMany({
      where: {
        recipient_id: userId,
        read: 0,
      },
      data: {
        read: 1,
      },
    });

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Failed to update notifications' });
  }
});

// Get unread count
router.get('/unread-count', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const count = await prisma.notifications.count({
      where: {
        recipient_id: userId,
        read: 0,
      },
    });

    res.json({ count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ message: 'Failed to fetch unread count' });
  }
});

// Delete notification
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = parseInt(req.params.id);

    const deleted = await prisma.notifications.deleteMany({
      where: {
        id: notificationId,
        recipient_id: userId,
      },
    });

    if (deleted.count === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ message: 'Failed to delete notification' });
  }
});

module.exports = router;
