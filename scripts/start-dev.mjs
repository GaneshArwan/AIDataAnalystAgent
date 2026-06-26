import { createServer } from 'net';
import { spawn } from 'child_process';

const DEFAULT_PORT = parseInt(process.env.PORT || '3000', 10);

/**
 * Checks if a port is available by attempting to listen on it.
 */
export function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => {
      resolve(false);
    });
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    // Removing '0.0.0.0' to let the OS choose the default interface (handles IPv4/IPv6 better)
    server.listen(port);
  });
}

/**
 * Finds the first available port starting from startPort.
 */
export async function findAvailablePort(startPort) {
  let port = startPort;
  while (!(await isPortAvailable(port))) {
    console.log(`Port ${port} is in use, trying ${port + 1}...`);
    port++;
  }
  return port;
}


import { fileURLToPath } from 'url';

/**
 * Main execution: Find port and spawn Next.js dev server.
 */
async function start() {
  const port = await findAvailablePort(DEFAULT_PORT);
  console.log(`🚀 Starting Next.js on available port: ${port}`);
  
  const child = spawn('npx', ['next', 'dev', '-p', port.toString()], {
    stdio: 'inherit',
    shell: true
  });

  child.on('exit', (code) => {
    process.exit(code || 0);
  });

  // Handle termination signals
  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  start().catch(err => {
    console.error('Failed to start development server:', err);
    process.exit(1);
  });
}
