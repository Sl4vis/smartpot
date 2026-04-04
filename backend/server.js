require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const sensorRoutes = require('./routes/sensors');
const plantRoutes = require('./routes/plants');
const aiRoutes = require('./routes/ai');
const dashboardRoutes = require('./routes/dashboard');
const notificationRoutes = require('./routes/notifications');
const { startIoTHubListener } = require('./services/azureIotService');
const { startPushScheduler } = require('./services/pushNotificationService');

const app = express();
const PORT = process.env.PORT || 3001;

// Render / reverse proxy fix
app.set('trust proxy', 1);

// ── Middleware ───────────────────────────────────────────
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Príliš veľa požiadaviek. Skúste znova neskôr.' }
});

const iotLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { error: 'IoT rate limit exceeded' }
});

// ── Routes ──────────────────────────────────────────────
app.use('/api/sensors', iotLimiter, sensorRoutes);
app.use('/api/plants', apiLimiter, plantRoutes);
app.use('/api/ai', apiLimiter, aiRoutes);
app.use('/api/dashboard', apiLimiter, dashboardRoutes);
app.use('/api/notifications', apiLimiter, notificationRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Smart Plant Pot API beží' });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ── Error handler ───────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Interná chyba servera'
      : err.message
  });
});

// ── Start ───────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`🌱 Smart Plant Pot API beží na porte ${PORT}`);
  console.log(`   Prostredie: ${process.env.NODE_ENV || 'development'}`);

  await startIoTHubListener();
  startPushScheduler();
});

module.exports = app;
