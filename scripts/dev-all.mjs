import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const commands = [
  { label: 'web', script: 'dev' },
  { label: 'api', script: 'api:dev' },
];
const children = new Map();
let stopping = false;
let finalCode = 0;

function pipeLines(stream, label, target) {
  const lines = createInterface({ input: stream });
  lines.on('line', (line) => target.write(`[${label}] ${line}\n`));
}

function stop(signal = 'SIGTERM', code = 0) {
  if (stopping) return;
  stopping = true;
  finalCode = code;

  for (const child of children.values()) {
    if (!child.pid || child.exitCode !== null) continue;
    try {
      process.kill(process.platform === 'win32' ? child.pid : -child.pid, signal);
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  }

  const forceExit = setTimeout(() => {
    for (const child of children.values()) {
      if (!child.pid || child.exitCode !== null) continue;
      try {
        process.kill(process.platform === 'win32' ? child.pid : -child.pid, 'SIGKILL');
      } catch (error) {
        if (error.code !== 'ESRCH') throw error;
      }
    }
    process.exit(finalCode);
  }, 3000);
  forceExit.unref();
}

for (const command of commands) {
  const child = spawn('npm', ['run', command.script], {
    env: process.env,
    detached: process.platform !== 'win32',
    stdio: ['inherit', 'pipe', 'pipe'],
  });
  children.set(command.label, child);
  pipeLines(child.stdout, command.label, process.stdout);
  pipeLines(child.stderr, command.label, process.stderr);

  child.on('error', (error) => {
    process.stderr.write(`[${command.label}] gagal dimulai: ${error.message}\n`);
    stop('SIGTERM', 1);
  });
  child.on('exit', (code, signal) => {
    if (!stopping) {
      const reason = signal ? `signal ${signal}` : `kode ${code ?? 1}`;
      process.stderr.write(`[${command.label}] berhenti (${reason}); proses lain ikut dihentikan.\n`);
      stop('SIGTERM', code ?? 1);
    }
    if ([...children.values()].every((item) => item.exitCode !== null || item.signalCode !== null)) {
      process.exit(finalCode);
    }
  });
}

process.on('SIGINT', () => stop('SIGINT', 0));
process.on('SIGTERM', () => stop('SIGTERM', 0));
