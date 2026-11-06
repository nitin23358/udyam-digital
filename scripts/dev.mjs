// Runs the API (port 8787) and the Vite dev server (port 5173) together.
import { spawn } from 'child_process';
const run = (name, cmd, args, cwd) => {
  const p = spawn(cmd, args, { cwd, shell: true, stdio: 'pipe' });
  p.stdout.on('data', (d) => process.stdout.write(`[${name}] ${d}`));
  p.stderr.on('data', (d) => process.stderr.write(`[${name}] ${d}`));
  return p;
};
const procs = [run('api', 'node', ['--watch', 'src/index.js'], 'server'), run('web', 'npx', ['vite'], 'client')];
const stop = () => { procs.forEach((p) => p.kill()); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
