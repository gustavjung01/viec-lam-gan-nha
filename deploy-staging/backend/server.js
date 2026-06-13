import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import { initDatabase, initMarketplaceTables } from './src/database.js';
import { initTelegramBot } from './src/telegram.js';
import applyRoutes from './src/routes/apply.js';
import marketplaceRoutes from './src/routes/marketplace.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5175';

// Security middleware - CORS
const allowedOrigins = [
  FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175'
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('CORS policy: Origin not allowed'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per windowMs
  message: {
    success: false,
    message: 'Quá nhiều request, vui lòng thử lại sau'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);

// Stricter rate limit for apply endpoint
const applyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 applications per hour per IP
  message: {
    success: false,
    message: 'Bạn đã gửi quá nhiều đơn ứng tuyển, vui lòng thử lại sau 1 giờ'
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0'
  });
});

// Apply routes
app.use('/api/apply', applyLimiter, applyRoutes);
app.use('/api', limiter, marketplaceRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint không tồn tại'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Lỗi hệ thống'
  });
});

// Initialize and start server
async function startServer() {
  try {
    // Init database
    await initDatabase();
    
    // Init marketplace tables
    await initMarketplaceTables();
    
    // Init Telegram bot
    initTelegramBot();
    
    // Start server
    app.listen(PORT, () => {
      console.log('=================================');
      console.log('🚀 Backend server running');
      console.log(`📡 Port: ${PORT}`);
      console.log(`🌐 Frontend: ${FRONTEND_URL}`);
      console.log(`📊 Health: http://localhost:${PORT}/api/health`);
      console.log('=================================');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
