const express   = require('express');
const http      = require('http');
const WebSocket = require('ws');
const path      = require('path');
const url       = require('url');

const app    = express();
const server = http.createServer(app);

const wssESP32   = new WebSocket.Server({ noServer: true });
const wssBrowser = new WebSocket.Server({ noServer: true });

app.use(express.static(path.join(__dirname, 'public')));

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

// Latest snapshot for new browser tabs
let latestIMU = {
  ax: 0, ay: 0, az: 0,
  gx: 0, gy: 0, gz: 0,
  enc: 0, motorOn: false, motorSpeed: 160
};
let esp32Online = false;

// ── Helper: send to all open browser tabs ──────────────
function broadcastToBrowsers(obj) {
  const msg = JSON.stringify(obj);
  wssBrowser.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

// ── Helper: send to ESP32 ─────────────────────────────
function sendToESP32(obj) {
  const msg = JSON.stringify(obj);
  wssESP32.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

function broadcastStatus() {
  broadcastToBrowsers({ type: 'status', esp32: esp32Online });
}
// ──────────────────────────────────────────────────────

// ── ESP32 connection ───────────────────────────────────
wssESP32.on('connection', ws => {
  esp32Online = true;
  console.log('[ESP32] Connected');
  broadcastStatus();

  // ESP32 → browsers (IMU + encoder + motor state)
  ws.on('message', raw => {
    try {
      const data = JSON.parse(raw);
      latestIMU  = data;
      broadcastToBrowsers({ type: 'imu', ...data });
    } catch (e) {
      console.error('[ESP32] Bad JSON:', e.message);
    }
  });

  ws.on('close', () => {
    esp32Online = false;
    console.log('[ESP32] Disconnected');
    broadcastStatus();
  });
});
// ──────────────────────────────────────────────────────

// ── Browser connection ─────────────────────────────────
wssBrowser.on('connection', ws => {
  console.log('[Browser] Connected');

  // Give new tab the latest data immediately
  ws.send(JSON.stringify({ type: 'imu',    ...latestIMU }));
  ws.send(JSON.stringify({ type: 'status', esp32: esp32Online }));

  // Browser → ESP32 (motor commands, encoder reset)
  ws.on('message', raw => {
    try {
      const cmd = JSON.parse(raw);
      console.log('[Browser→ESP32]', cmd);
      sendToESP32(cmd);
    } catch (e) {
      console.error('[Browser] Bad JSON:', e.message);
    }
  });

  ws.on('close', () => console.log('[Browser] Disconnected'));
});
// ──────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
