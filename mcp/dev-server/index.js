#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  getProcessOnPort,
  isPortFree,
  killProcessOnPort,
} from './lib/process.js';
import { startJupyter, startVite } from './lib/servers.js';
import { getServerByPort, getServers, removeServer } from './lib/state.js';
import {
  getTailscaleStatus,
  getTailscaleUrl,
  removeTailscaleServe,
} from './lib/tailscale.js';

const TOOLS = [
  {
    name: 'dev_server_start',
    description:
      'Start a dev server (Vite or Jupyter). Kills any existing process on the target port, starts the server in background, optionally sets up Tailscale Serve, and returns access URLs.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['vite', 'jupyter'],
          description: 'Type of dev server to start',
        },
        port: {
          type: 'number',
          description:
            'Port number. If omitted, auto-assigned based on project directory name hash (range 5100-5899)',
        },
        project_dir: {
          type: 'string',
          description: 'Absolute path to the project root directory',
        },
        tailscale_path: {
          type: 'string',
          description:
            "Path to expose via Tailscale Serve (e.g. '/my-app'). Omit to skip Tailscale.",
        },
        background: {
          type: 'boolean',
          default: true,
          description: 'Run in background (default true)',
        },
      },
      required: ['type', 'project_dir'],
    },
  },
  {
    name: 'dev_server_stop',
    description:
      'Stop a running dev server by port. Kills the process and removes any Tailscale Serve route.',
    inputSchema: {
      type: 'object',
      properties: {
        port: {
          type: 'number',
          description: 'Port of the dev server to stop',
        },
        tailscale_path: {
          type: 'string',
          description:
            "Tailscale serve path to remove (e.g. '/my-app'). Falls back to stored state if omitted.",
        },
      },
      required: ['port'],
    },
  },
  {
    name: 'dev_server_status',
    description:
      'List all tracked dev servers with their ports, types, project directories, PIDs, and whether they are still running.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'dev_server_urls',
    description:
      'Get local and Tailscale URLs for a dev server on a given port.',
    inputSchema: {
      type: 'object',
      properties: {
        port: {
          type: 'number',
          description: 'Port of the dev server',
        },
      },
      required: ['port'],
    },
  },
  {
    name: 'port_check',
    description:
      'Check what process is running on a given port. Returns PID, process name, and command, or reports the port as free.',
    inputSchema: {
      type: 'object',
      properties: {
        port: {
          type: 'number',
          description: 'Port number to check',
        },
      },
      required: ['port'],
    },
  },
];

function json(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function error(msg) {
  return { content: [{ type: 'text', text: msg }], isError: true };
}

async function handleDevServerStart(args) {
  const { type, project_dir, port, tailscale_path, background } = args;

  if (type === 'vite') {
    const result = await startVite({
      projectDir: project_dir,
      port,
      background: background ?? true,
      tailscalePath: tailscale_path,
    });
    return json(result);
  }

  if (type === 'jupyter') {
    const result = await startJupyter({
      projectDir: project_dir,
      port,
      background: background ?? true,
      tailscalePath: tailscale_path,
    });
    return json(result);
  }

  return error(`Unknown server type: ${type}`);
}

async function handleDevServerStop(args) {
  const { port, tailscale_path } = args;

  // Check state for tailscale path
  const entry = getServerByPort(port);
  const tsPath = tailscale_path || entry?.tailscale_path;

  // Remove Tailscale serve if configured
  if (tsPath) {
    await removeTailscaleServe(tsPath);
  }

  // Kill the process
  const killed = await killProcessOnPort(port);
  removeServer(port);

  return json({
    port,
    stopped: killed,
    tailscale_removed: !!tsPath,
  });
}

async function handleDevServerStatus() {
  const servers = getServers();
  const entries = Object.values(servers);

  if (entries.length === 0) {
    return json({ servers: [], message: 'No tracked dev servers' });
  }

  return json({ servers: entries });
}

async function handleDevServerUrls(args) {
  const { port } = args;

  const free = await isPortFree(port);
  if (free) {
    return json({
      port,
      listening: false,
      message: `Nothing is listening on port ${port}`,
    });
  }

  const localUrl = `http://localhost:${port}`;
  const tailscaleUrl = await getTailscaleUrl(port);
  const status = await getTailscaleStatus();

  return json({
    port,
    listening: true,
    localUrl,
    tailscaleUrl,
    tailscale_available: status.available,
    tailscale_hostname: status.hostname,
  });
}

async function handlePortCheck(args) {
  const { port } = args;

  const free = await isPortFree(port);
  if (free) {
    return json({ port, status: 'free', message: `Port ${port} is available` });
  }

  const proc = await getProcessOnPort(port);
  if (proc) {
    return json({
      port,
      status: 'in_use',
      pid: proc.pid,
      command: proc.command,
    });
  }

  return json({
    port,
    status: 'in_use',
    message: 'Port is in use but could not identify the process',
  });
}

const server = new Server(
  { name: 'dev-server-manager', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'dev_server_start':
        return await handleDevServerStart(args);
      case 'dev_server_stop':
        return await handleDevServerStop(args);
      case 'dev_server_status':
        return await handleDevServerStatus();
      case 'dev_server_urls':
        return await handleDevServerUrls(args);
      case 'port_check':
        return await handlePortCheck(args);
      default:
        return error(`Unknown tool: ${name}`);
    }
  } catch (e) {
    return error(`Error: ${e.message}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
