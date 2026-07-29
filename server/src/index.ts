import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import app from './app.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(rootDir, '.env') });
dotenv.config(); // also allow server/.env

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Rantha Dashboard API running on http://localhost:${PORT}`);
});
