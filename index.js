require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect MongoDB
// mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
//   .then(() => console.log('✅ MongoDB Connected'))
//   .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Serve uploads folder (for profile images, etc.)
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', require('./routes/auth'));           // Auth routes
app.use('/api/dailygoals', require('./routes/dailyGoals')); // Daily Goals routes
app.use('/api/weekly-goals', require('./routes/weeklyGoals'));

const activityRoutes = require("./routes/activityRoutes");
app.use("/api/activities", activityRoutes);

const fiveMinActivityRoutes = require("./routes/fiveMinActivityRoutes");
app.use("/api/five-min-activities", fiveMinActivityRoutes);

const notToDoRoutes = require("./routes/notToDo");
app.use("/api/not-to-do", notToDoRoutes);

const postRoutes = require("./routes/postRoutes");
app.use("/api/posts", postRoutes);

const icompletedRoutes = require('./routes/icompleted');
app.use('/api/icompleted', icompletedRoutes);

const notificationRoutes = require('./routes/notifications');
app.use('/api/notifications', notificationRoutes);

const imagesRoutes = require('./routes/images');
app.use('/api/images', imagesRoutes);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
