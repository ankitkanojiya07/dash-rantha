import express from 'express';
import cors from 'cors';
import apiRouter from './routes/api.js';
import { loadBookingStore } from './data/bookingStore.js';

// Load Excel into memory once per cold start (reused on warm invocations)
loadBookingStore();

const app = express();

app.use(cors());
app.use(express.json());

// Read-only API — no write routes except sync refresh trigger
// Mounted at /api for local + Vite proxy; also at / for Vercel catch-all path stripping
app.use('/api', apiRouter);
app.use(apiRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', mode: 'read-only' });
});

export default app;
