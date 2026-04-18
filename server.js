const express   = require('express');
const http      = require('http');
const WebSocket = require('ws');
const path      = require('path');
const url       = require('url');

const app    = express();
const server = http.createServer(app);

// ── Two WS servers multiplexed on the same HTTP port ──
const wssESP32   = new WebSocket.Server({ noServer: true });  // ESP32 → server
const wssBrowser = new WebSocket.Server({ noServer: true });  // server → browser
// ──────────────────────────────────────────────────────

// Serve dashboard
app.use(express.static(path.join(__dirname, 'public')));

// Route WebSocket upgrades by URL path
server.on('upgrade', (req, socket, head) => {
  const { pathname } = url.parse(req.url);

  if (pathname === '/esp32') {
    wssESP32.handleUpgrade(req, socket, head, ws => {
      wssESP32.emit('connection', ws, req);
    });
  } else if (pathname === '/ws') {
    wssBrowser.handleUpgrade(req, socket, head, ws => {
      wssBrowser.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

// Latest snapshot (so new browser tabs get data immediately)
let latestIMU   = { ax:0, ay:0, az:0, gx:0, gy:0, gz:0 };
let esp32Online = false;

// ── ESP32 connection ──────────────────────────────────
wssESP32.on('connection', ws => {
  esp32Online = true;
  console.log('[ESP32] connected');
  broadcastStatus();

  ws.on('message', raw => {
    try {
      const data  = JSON.parse(raw);
      latestIMU   = data;

      // Forward to every open browser tab
      const msg = JSON.stringify({ type: 'imu', ...data });
      wssBrowser.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(msg);
      });
    } catch (e) {
      console.error('[ESP32] bad JSON:', e.message);
    }
  });

  ws.on('close', () => {
    esp32Online = false;
    console.log('[ESP32] disconnected');
    broadcastStatus();
  });
});
// ─────────────────────────────────────────────────────

// ── Browser connection ────────────────────────────────
wssBrowser.on('connection', ws => {
  console.log('[Browser] connected');
  // Give the new tab the current values right away
  ws.send(JSON.stringify({ type: 'imu',    ...latestIMU }));
  ws.send(JSON.stringify({ type: 'status', esp32: esp32Online }));

  ws.on('close', () => console.log('[Browser] disconnected'));
});
// ─────────────────────────────────────────────────────

function broadcastStatus() {
  const msg = JSON.stringify({ type: 'status', esp32: esp32Online });
  wssBrowser.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
