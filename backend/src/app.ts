/**
 * Express app setup — shared between local dev server and Vercel serverless.
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

import { defaultLimiter } from './middleware/rate-limit';
import { errorHandler } from './middleware/error-handler';
import { seedData } from './services/seed';

import authRoutes from './routes/auth.routes';
import projectsRoutes from './routes/projects.routes';
import sensorsRoutes from './routes/sensors.routes';
import marketplaceRoutes from './routes/marketplace.routes';
import retireRoutes from './routes/retire.routes';
import certificatesRoutes from './routes/certificates.routes';
import reportsRoutes from './routes/reports.routes';
import communityRoutes from './routes/community.routes';
import dashboardRoutes from './routes/dashboard.routes';
import verifyRoutes from './routes/verify.routes';
import hederaRoutes from './routes/hedera.routes';
import notificationsRoutes from './routes/notifications.routes';
import schedulingRoutes from './routes/scheduling.routes';
import healthRoutes from './routes/health.routes';
import exploreRoutes from './routes/explore.routes';
import walletRoutes from './routes/wallet.routes';
import guardianRoutes from './routes/guardian.routes';

// Seed in-memory data store (runs once per cold start)
seedData();

const app = express();

// Allow multiple frontend origins (local dev + Vercel production)
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  // Vercel preview/production URLs are added via FRONTEND_URL env var
].filter(Boolean);

// ─── Core Middleware ─────────────────────────────────────────────────────────

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
      return callback(null, true);
    }
    // Also allow any *.vercel.app origin for preview deployments
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    callback(null, false);
  },
  credentials: true,
}));
app.use(express.json());
app.use(defaultLimiter);

// ─── Root ────────────────────────────────────────────────────────────────────

app.get('/', (_req, res) => {
  res.json({
    name: 'AquaVera API',
    version: '1.0.0',
    status: 'running',
    docs: '/api/health',
  });
});

// ─── Routes ──────────────────────────────────────────────────────────────────

app.use('/api/health', healthRoutes);
app.use('/api/explore', exploreRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/sensors', sensorsRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/retire', retireRoutes);
app.use('/api/certificates', certificatesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/hedera', hederaRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/scheduling', schedulingRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/guardian', guardianRoutes);

// ─── Error Handler (must be last) ───────────────────────────────────────────

app.use(errorHandler);

export default app;
