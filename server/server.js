/**
 * server.js — Application entry point (Phase 2).
 *
 * Changes from Phase 1:
 *  - cookie-parser added (required for JWT cookie reading)
 *  - Socket.IO uses socketAuth middleware (JWT from cookie)
 *  - /uploads served as static directory for user avatars
 *  - CORS updated to allow credentials (cookies)
 */

const env = require('./config/env'); // Must be first — loads + validates .env
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');

const { connectDB } = require('./config/db');
const apiRoutes = require('./routes/api');
const errorHandler = require('./middleware/errorHandler');
const { registerHandlers } = require('./socket/handlers');
const { socketAuth } = require('./middleware/auth');

// ─── Express App ─────────────────────────────────────────────────────────────

const app = express();

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());

// CORS — must allow credentials so the JWT cookie is sent cross-origin (dev)
app.use(
  cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true, // Required for cookie-based auth
  })
);

app.use(cookieParser());          // Parse cookies before routes
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

// Serve uploaded avatars
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// REST API routes
app.use('/api', apiRoutes);

// Catch-all: serve index.html (the index does an auth check and redirects)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Global error handler — must be last
app.use(errorHandler);

// ─── HTTP Server + Socket.IO ──────────────────────────────────────────────────

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true, // Required so the cookie is included in the WS handshake
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Attach io to express app so routes/controllers can emit socket events
app.set('io', io);

// Socket.IO auth middleware — runs before any event handler

// Rejects connections that don't have a valid JWT cookie
io.use(socketAuth);

// Register event handlers for every authenticated connection
io.on('connection', (socket) => {
  registerHandlers(io, socket);
});

// ─── Start ────────────────────────────────────────────────────────────────────

async function start() {
  try {
    await connectDB();

    httpServer.listen(env.PORT, () => {
      console.log(`[Server] Running on http://localhost:${env.PORT} (${env.NODE_ENV})`);
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err.message);
    process.exit(1);
  }
}

start();
