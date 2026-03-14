import fs from 'fs';
import path from 'path';
import os from 'os';

const STATE_DIR = path.join(os.homedir(), '.claude');
const STATE_FILE = path.join(STATE_DIR, 'dev-servers.json');

function loadState() {
  try {
    const data = fs.readFileSync(STATE_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return { servers: {} };
  }
}

function saveState(state) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const tmp = STATE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, STATE_FILE);
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function addServer(entry) {
  const state = loadState();
  state.servers[String(entry.port)] = {
    ...entry,
    started_at: new Date().toISOString(),
  };
  saveState(state);
}

export function removeServer(port) {
  const state = loadState();
  delete state.servers[String(port)];
  saveState(state);
}

export function getServers() {
  const state = loadState();
  const alive = {};
  for (const [port, entry] of Object.entries(state.servers)) {
    if (entry.pid && isProcessAlive(entry.pid)) {
      alive[port] = { ...entry, running: true };
    } else {
      alive[port] = { ...entry, running: false };
    }
  }
  // Prune dead entries
  const pruned = {};
  for (const [port, entry] of Object.entries(alive)) {
    if (entry.running) pruned[port] = entry;
  }
  saveState({ servers: pruned });
  return alive;
}

export function getServerByPort(port) {
  const state = loadState();
  const entry = state.servers[String(port)];
  if (!entry) return null;
  return {
    ...entry,
    running: entry.pid ? isProcessAlive(entry.pid) : false,
  };
}
