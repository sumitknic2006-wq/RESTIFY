const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const { getDatabaseStatus } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const ruleRoutes = require('./routes/ruleRoutes');
const activityRoutes = require('./routes/activityRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const goalRoutes = require('./routes/goalRoutes');
const streakRoutes = require('./routes/streakRoutes');
const achievementRoutes = require('./routes/achievementRoutes');
const challengeRoutes = require('./routes/challengeRoutes');
const userRoutes = require('./routes/userRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const errorMiddleware = require('./middleware/errorMiddleware');

const app = express();
const productionOrigin = 'https://restify-6no6.vercel.app';

app.use(express.json({ limit: '10kb' }));
app.use(
  cors({
    origin(origin, callback) {
      const allowedOrigins = [env.CLIENT_URL, productionOrigin];
      if (env.NODE_ENV === 'development') {
        allowedOrigins.push('http://localhost:5173', 'http://localhost:5174');
      }
      const isLocalOrigin =
        origin === 'http://localhost:5173' ||
        origin === 'http://localhost:5174' ||
        origin === 'http://127.0.0.1:5173' ||
        origin === 'http://127.0.0.1:5174';
      const isAllowed =
        !origin ||
        (allowedOrigins.includes(origin) && (env.NODE_ENV === 'development' || !isLocalOrigin));
      callback(null, isAllowed);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.get('/api/health', (req, res) => {
  const databaseStatus = getDatabaseStatus();

  res.status(200).json({
    success: true,
    message: 'RESTIFY backend is running',
    service: 'restify-backend',
    environment: env.NODE_ENV,
    database: databaseStatus.status,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/rules', ruleRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/streaks', streakRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use(errorMiddleware);

module.exports = app;
