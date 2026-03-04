require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const http    = require('http');
const { WebSocketServer } = require('ws');
const jwt     = require('jsonwebtoken');
const url     = require('url');

const authRoutes   = require('./routes/auth');
const tenantRoutes = require('./routes/tenants');
const orgVdcRoutes = require('./routes/orgVdcs');
const vmRoutes     = require('./routes/vms');
const userRoutes   = require('./routes/users');
const auditRoutes  = require('./routes/audit');
const statsRoutes  = require('./routes/stats');

const { initializeSheets } = require('./services/sheetsService');
const db         = require('./services/sheetsService');
const { SHEETS } = require('./config/googleSheets');
const MockShell  = require('./services/mockShell');

const app    = express();
const server = http.createServer(app);   // shared HTTP + WS server
const PORT   = process.env.PORT || 3001;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// ─── HTTP Routes ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), ws: 'ws://localhost:' + PORT + '/terminal' });
});

app.use('/api/auth',     authRoutes);
app.use('/api/tenants',  tenantRoutes);
app.use('/api/org-vdcs', orgVdcRoutes);
app.use('/api/vms',      vmRoutes);
app.use('/api/users',    userRoutes);
app.use('/api/audit',    auditRoutes);
app.use('/api/stats',    statsRoutes);

app.use((req, res) => res.status(404).json({ error: `Route ${req.method} ${req.path} not found` }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Internal server error' }); });

// ─── WebSocket Terminal ───────────────────────────────────────────────────────
const wss = new WebSocketServer({ server, path: '/terminal' });

wss.on('connection', async (ws, req) => {
  const query = url.parse(req.url, true).query;
  const token = query.token;
  const vmId  = query.vmId;

  // Authenticate
  let user;
  try {
    user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    ws.send(JSON.stringify({ type: 'output', data: '\x1b[31mAuthentication failed. Connection closed.\x1b[0m\r\n' }));
    ws.close();
    return;
  }

  // Fetch VM
  let vm;
  try {
    vm = await db.findById(SHEETS.VMS, vmId);
  } catch {}

  if (!vm) {
    ws.send(JSON.stringify({ type: 'output', data: '\x1b[31mVM not found.\x1b[0m\r\n' }));
    ws.close();
    return;
  }

  // Check access (admin can access all, client only own tenant)
  if (user.role !== 'admin' && vm.tenant_id !== user.tenant_id) {
    ws.send(JSON.stringify({ type: 'output', data: '\x1b[31mAccess denied.\x1b[0m\r\n' }));
    ws.close();
    return;
  }

  if (vm.status !== 'running') {
    ws.send(JSON.stringify({ type: 'output', data: `\x1b[33mVM is not running. Current status: ${vm.status}\x1b[0m\r\n` }));
    ws.close();
    return;
  }

  // Create shell session
  const shell = new MockShell(vm, user);
  let inputBuffer = '';

  const send = (data) => {
    if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'output', data }));
  };

  // Connection sequence
  send(`\x1b[2J\x1b[H`); // clear screen
  send(`\x1b[33mConnecting to ${vm.name} (${vm.ip})...\x1b[0m\r\n`);

  setTimeout(() => {
    send(`\x1b[32mAuthenticated via SSH key pair.\x1b[0m\r\n`);
    setTimeout(() => {
      send(shell.banner());
      send(shell.prompt());
    }, 300);
  }, 600);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'input') {
      const data = msg.data;

      // Handle special keys
      if (data === '\r' || data === '\n') {
        send('\r\n');
        const cmd = inputBuffer.trim();
        inputBuffer = '';

        if (cmd) {
          const result = shell.run(cmd);
          if (result === '__EXIT__') {
            send('\x1b[33mlogout\x1b[0m\r\nConnection closed.\r\n');
            ws.close();
            return;
          }
          if (result === '\x1bc') {
            send('\x1bc');
          } else if (result) {
            send(result + '\r\n');
          }
        }
        send(shell.prompt());
      }
      else if (data === '\x7f' || data === '\b') {
        // Backspace
        if (inputBuffer.length > 0) {
          inputBuffer = inputBuffer.slice(0, -1);
          send('\b \b');
        }
      }
      else if (data === '\x03') {
        // Ctrl+C
        inputBuffer = '';
        send('^C\r\n');
        send(shell.prompt());
      }
      else if (data === '\x0c' || data === '\x1b[2J') {
        // Ctrl+L — clear
        inputBuffer = '';
        send('\x1bc');
        send(shell.prompt());
      }
      else if (data === '\x1b[A') {
        // Arrow Up — history
        const histCmd = shell.history[shell.histIdx + 1];
        if (histCmd) {
          shell.histIdx++;
          // Clear current input
          send('\r' + shell.prompt() + histCmd + ' '.repeat(Math.max(0, inputBuffer.length - histCmd.length)));
          send('\r' + shell.prompt() + histCmd);
          inputBuffer = histCmd;
        }
      }
      else if (data === '\x1b[B') {
        // Arrow Down — history
        if (shell.histIdx > 0) {
          shell.histIdx--;
          const histCmd = shell.history[shell.histIdx] || '';
          send('\r' + shell.prompt() + histCmd + ' '.repeat(Math.max(0, inputBuffer.length - histCmd.length)));
          send('\r' + shell.prompt() + histCmd);
          inputBuffer = histCmd;
        } else if (shell.histIdx === 0) {
          shell.histIdx = -1;
          send('\r' + shell.prompt() + ' '.repeat(inputBuffer.length));
          send('\r' + shell.prompt());
          inputBuffer = '';
        }
      }
      else if (data === '\t') {
        // Tab — basic autocomplete
        const prefix = inputBuffer.split(' ').pop() || '';
        const suggestions = [
          ...Object.keys(shell.fs).filter(p => p.startsWith(shell.cwd + '/' + prefix) || p.startsWith(prefix)),
          ...['ls','cd','cat','ps','top','free','df','git','npm','systemctl','apt','docker','nginx','node'].filter(c => c.startsWith(prefix))
        ];
        if (suggestions.length === 1) {
          const completion = suggestions[0].split('/').pop();
          send(completion.slice(prefix.length));
          inputBuffer += completion.slice(prefix.length);
        } else if (suggestions.length > 1) {
          send('\r\n' + suggestions.slice(0, 8).join('  ') + '\r\n');
          send(shell.prompt() + inputBuffer);
        }
      }
      else if (data.length === 1 && data.charCodeAt(0) >= 32) {
        // Regular printable character
        inputBuffer += data;
        send(data);
      }
    }

    // Terminal resize
    if (msg.type === 'resize') {
      // Could use for advanced features
    }
  });

  ws.on('close', () => {
    console.log(`Terminal session closed: VM=${vm.name} User=${user.email}`);
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
  });
});

console.log('🖥️  WebSocket terminal endpoint: ws://localhost:' + PORT + '/terminal');

// ─── Start ────────────────────────────────────────────────────────────────────
async function start() {
  try {
    console.log('🔄 Initializing Google Sheets...');
    await initializeSheets();
  } catch (err) {
    console.warn('⚠️  Could not initialize Google Sheets:', err.message);
  }

  server.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`🖥️  Terminal WebSocket at ws://localhost:${PORT}/terminal`);
  });
}

start();
