import { spawn, execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { killProcessOnPort, isPortFree, waitForPort } from './process.js';
import { addServer } from './state.js';
import { getTailscaleStatus, setupTailscaleServe } from './tailscale.js';

export function allocatePort(projectDir) {
  const name = path.basename(projectDir);
  const hash = crypto.createHash('md5').update(name).digest();
  const base = 5100;
  const range = 800;
  return base + (hash.readUInt16BE(0) % range);
}

async function resolvePort(projectDir, requestedPort) {
  if (requestedPort) return requestedPort;

  let port = allocatePort(projectDir);
  for (let i = 0; i < 10; i++) {
    if (await isPortFree(port)) return port;
    port++;
  }
  throw new Error(`Could not find a free port in range ${allocatePort(projectDir)}-${port}`);
}

function which(cmd) {
  return new Promise((resolve) => {
    execFile('which', [cmd], (err, stdout) => {
      resolve(err ? null : stdout.trim());
    });
  });
}

export async function startVite({ projectDir, port: requestedPort, background = true, tailscalePath }) {
  const port = await resolvePort(projectDir, requestedPort);

  // Kill anything on the port first
  if (!(await isPortFree(port))) {
    await killProcessOnPort(port);
  }

  const npxPath = await which('npx');
  if (!npxPath) throw new Error('npx not found. Install Node.js to use Vite.');

  const logFile = `/tmp/dev-server-${port}.log`;
  const logFd = fs.openSync(logFile, 'w');

  const child = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', String(port)], {
    cwd: projectDir,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: { ...process.env },
  });
  child.unref();
  fs.closeSync(logFd);

  const started = await waitForPort(port, 15000);
  if (!started) {
    // Read log tail for error context
    try {
      const log = fs.readFileSync(logFile, 'utf8');
      const lines = log.split('\n').slice(-20).join('\n');
      throw new Error(`Vite failed to start on port ${port}. Log tail:\n${lines}`);
    } catch (e) {
      if (e.message.includes('Log tail')) throw e;
      throw new Error(`Vite failed to start on port ${port}`);
    }
  }

  const result = {
    type: 'vite',
    port,
    pid: child.pid,
    project_dir: projectDir,
    log_file: logFile,
    localUrl: `http://localhost:${port}`,
    tailscaleUrl: null,
  };

  // Set up Tailscale if requested
  if (tailscalePath) {
    try {
      result.tailscaleUrl = await setupTailscaleServe(tailscalePath, port);
      result.tailscale_path = tailscalePath;
    } catch {
      // Tailscale not available, continue without it
    }
  }

  addServer(result);
  return result;
}

export async function startJupyter({ projectDir, port: requestedPort, background = true, tailscalePath }) {
  const port = await resolvePort(projectDir, requestedPort);

  if (!(await isPortFree(port))) {
    await killProcessOnPort(port);
  }

  const jupyterPath = await which('jupyter');
  if (!jupyterPath) throw new Error('jupyter not found. Install Jupyter to use notebooks.');

  const logFile = `/tmp/dev-server-${port}.log`;
  const logFd = fs.openSync(logFile, 'w');

  const child = spawn('jupyter', [
    'notebook', '--no-browser',
    `--port=${port}`,
    '--ip=0.0.0.0',
    "--NotebookApp.token=''",
    '--NotebookApp.disable_check_xsrf=True',
  ], {
    cwd: projectDir,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: { ...process.env },
  });
  child.unref();
  fs.closeSync(logFd);

  const started = await waitForPort(port, 15000);
  if (!started) {
    try {
      const log = fs.readFileSync(logFile, 'utf8');
      const lines = log.split('\n').slice(-20).join('\n');
      throw new Error(`Jupyter failed to start on port ${port}. Log tail:\n${lines}`);
    } catch (e) {
      if (e.message.includes('Log tail')) throw e;
      throw new Error(`Jupyter failed to start on port ${port}`);
    }
  }

  const result = {
    type: 'jupyter',
    port,
    pid: child.pid,
    project_dir: projectDir,
    log_file: logFile,
    localUrl: `http://localhost:${port}`,
    tailscaleUrl: null,
  };

  if (tailscalePath) {
    try {
      result.tailscaleUrl = await setupTailscaleServe(tailscalePath, port);
      result.tailscale_path = tailscalePath;
    } catch {
      // Tailscale not available
    }
  }

  addServer(result);
  return result;
}
