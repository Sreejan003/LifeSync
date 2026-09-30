'use strict';
/**
 * api/index.js — Vercel Serverless Function entry point
 * Vercel auto-detects files in api/ as serverless functions.
 * This file exports the Express app so Vercel wraps it correctly.
 */
const db = require('../backend/config/db');
const { app } = require('../backend/server');

// Initialize DB schema on cold start (CREATE IF NOT EXISTS — safe to repeat)
db.initDatabase().catch(err => console.error('[LifeSync] DB init error on cold start:', err));

module.exports = app;
