import { spawn } from 'node:child_process';

const run = (command, args) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { stdio: 'inherit', env: process.env });
  child.on('error', reject);
  child.on('exit', (code, signal) => {
    if (code === 0) resolve();
    else reject(new Error(`${command} ${args.join(' ')} failed${signal ? ` with ${signal}` : ` with exit code ${code}`}`));
  });
});

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const playwright = process.platform === 'win32' ? 'node_modules/.bin/playwright.cmd' : 'node_modules/.bin/playwright';

await run(npm, ['run', 'db:test']);
await run(npm, ['run', 'build']);
await run(playwright, ['test', 'tests/event-booking.spec.ts', 'tests/manual-payment.spec.ts', 'tests/organizer.spec.ts']);
await run(npm, ['run', 'build:preview']);
await run(npm, ['run', 'preview:fixture']);
await run(playwright, ['test', 'tests/hosting.spec.ts']);
