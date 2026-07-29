import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env') });

function start(name, cwd, command, args) {
  const child = spawn(command, args, {
    cwd: path.join(root, cwd),
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`[${name}] stopped (${signal})`);
    } else if (code !== 0 && code !== null) {
      console.error(`[${name}] exited with code ${code}`);
      shutdown(code);
    }
  });

  return child;
}

const server = start('server', 'server', 'node', [
  'node_modules/tsx/dist/cli.mjs',
  'watch',
  'src/index.ts',
]);

const client = start('client', 'client', 'node', [
  'node_modules/vite/bin/vite.js',
]);

let stopping = false;

function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  server.kill('SIGTERM');
  client.kill('SIGTERM');
  setTimeout(() => process.exit(code), 300);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('Rantha Dashboard dev');
console.log('  Client → http://localhost:5173');
console.log('  API    → http://localhost:3001');
