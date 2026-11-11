import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createBrowserServer } from './server.mjs';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const server = createBrowserServer({
  baseline: projectRoot,
  candidate: projectRoot,
  regression: projectRoot,
});
server.listen(0, '127.0.0.1');
await new Promise((resolve, reject) => {
  server.once('listening', resolve);
  server.once('error', reject);
});

try {
  const address = server.address();
  const child = spawn(process.execPath, [
    fileURLToPath(new URL('./verify.mjs', import.meta.url)),
    'regression',
  ], {
    env: { ...process.env, BEAN_BROWSER_URL: 'http://127.0.0.1:' + address.port },
    stdio: 'inherit',
  });
  const exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve(code ?? (signal ? 1 : 1)));
  });
  if (exitCode !== 0) process.exitCode = exitCode;
} finally {
  await new Promise(resolve => server.close(resolve));
}
