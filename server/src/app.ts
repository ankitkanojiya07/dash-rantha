import express from 'express';
import cors from 'cors';
import apiRouter from './routes/api.js';
import { getBookingStore } from './data/bookingStore.js';

const app = express();

app.use(cors());
app.use(express.json());

// Lazy-load Excel store on first request (survives Vercel cold starts cleanly)
app.use((req, _res, next) => {
  if (req.path === '/health') return next();
  try {
    getBookingStore();
    next();
  } catch (err) {
    next(err);
  }
});

// Local Vite proxy hits /api/*; Vercel rewrite may pass paths with or without /api
app.use('/api', apiRouter);
app.use(apiRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', mode: 'read-only' });
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const message = err instanceof Error ? err.message : 'Internal server error';
  res.status(500).json({ error: message });
});

export default app;
