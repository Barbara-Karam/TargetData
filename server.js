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

let simulate = true;
let esp32Online = false;

let latestIMU = {
  ax: 0.182,
  ay: -0.094,
  az: 0.987,
  gx: 12.4,
  gy: -6.8,
  gz: 8.9,
  enc: 1248,
  motorOn: true,
  motorSpeed: 178
};

function broadcastToBrowsers(obj) {
  const msg = JSON.stringify(obj);
  wssBrowser.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

function sendToESP32(obj) {
  const msg = JSON.stringify(obj);
  wssESP32.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

function broadcastStatus() {
  broadcastToBrowsers({ type: 'status', esp32: esp32Online || simulate });
}

wssESP32.on('connection', ws => {
  esp32Online = true;
  console.log('[ESP32] Connected');
  broadcastStatus();

  ws.on('message', raw => {
    try {
      const data = JSON.parse(raw);
      latestIMU = data;
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

wssBrowser.on('connection', ws => {
  console.log('[Browser] Connected');
  ws.send(JSON.stringify({ type: 'imu', ...latestIMU }));
  ws.send(JSON.stringify({ type: 'status', esp32: esp32Online || simulate }));

  ws.on('message', raw => {
    try {
      const cmd = JSON.parse(raw);

      if (!simulate) {
        sendToESP32(cmd);
        return;
      }

      if (cmd.type === 'motor') {
        latestIMU.motorOn = !!cmd.on;
        if (typeof cmd.speed === 'number') {
          latestIMU.motorSpeed = Math.max(0, Math.min(255, cmd.speed));
        }
        broadcastToBrowsers({ type: 'imu', ...latestIMU });
      }

      if (cmd.type === 'encoder_reset') {
        latestIMU.enc = 0;
        broadcastToBrowsers({ type: 'imu', ...latestIMU });
      }
    } catch (e) {
      console.error('[Browser] Bad JSON:', e.message);
    }
  });

  ws.on('close', () => console.log('[Browser] Disconnected'));
});

let t = 0;

setInterval(() => {
  if (!simulate || esp32Online) return;

  t += 0.06;

  latestIMU.ax = +(0.18 + 0.12 * Math.sin(t * 1.1)).toFixed(3);
  latestIMU.ay = +(-0.09 + 0.10 * Math.cos(t * 0.9)).toFixed(3);
  latestIMU.az = +(0.99 + 0.03 * Math.sin(t * 0.5)).toFixed(3);

  latestIMU.gx = +(12 + 8 * Math.sin(t * 1.6)).toFixed(3);
  latestIMU.gy = +(-7 + 6 * Math.cos(t * 1.2)).toFixed(3);
  latestIMU.gz = +(9 + 5 * Math.sin(t * 1.9)).toFixed(3);

  if (latestIMU.motorOn) {
    latestIMU.enc += Math.max(1, Math.floor(latestIMU.motorSpeed / 18));
  }

  broadcastToBrowsers({ type: 'imu', ...latestIMU });
  broadcastStatus();
}, 100);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));const express   = require('express');
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

let simulate = true;
let esp32Online = false;

let latestIMU = {
  ax: 0.182,
  ay: -0.094,
  az: 0.987,
  gx: 12.4,
  gy: -6.8,
  gz: 8.9,
  enc: 1248,
  motorOn: true,
  motorSpeed: 178
};

function broadcastToBrowsers(obj) {
  const msg = JSON.stringify(obj);
  wssBrowser.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

function sendToESP32(obj) {
  const msg = JSON.stringify(obj);
  wssESP32.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

function broadcastStatus() {
  broadcastToBrowsers({ type: 'status', esp32: esp32Online || simulate });
}

wssESP32.on('connection', ws => {
  esp32Online = true;
  console.log('[ESP32] Connected');
  broadcastStatus();

  ws.on('message', raw => {
    try {
      const data = JSON.parse(raw);
      latestIMU = data;
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

wssBrowser.on('connection', ws => {
  console.log('[Browser] Connected');
  ws.send(JSON.stringify({ type: 'imu', ...latestIMU }));
  ws.send(JSON.stringify({ type: 'status', esp32: esp32Online || simulate }));

  ws.on('message', raw => {
    try {
      const cmd = JSON.parse(raw);

      if (!simulate) {
        sendToESP32(cmd);
        return;
      }

      if (cmd.type === 'motor') {
        latestIMU.motorOn = !!cmd.on;
        if (typeof cmd.speed === 'number') {
          latestIMU.motorSpeed = Math.max(0, Math.min(255, cmd.speed));
        }
        broadcastToBrowsers({ type: 'imu', ...latestIMU });
      }

      if (cmd.type === 'encoder_reset') {
        latestIMU.enc = 0;
        broadcastToBrowsers({ type: 'imu', ...latestIMU });
      }
    } catch (e) {
      console.error('[Browser] Bad JSON:', e.message);
    }
  });

  ws.on('close', () => console.log('[Browser] Disconnected'));
});

let t = 0;

setInterval(() => {
  if (!simulate || esp32Online) return;

  t += 0.06;

  latestIMU.ax = +(0.18 + 0.12 * Math.sin(t * 1.1)).toFixed(3);
  latestIMU.ay = +(-0.09 + 0.10 * Math.cos(t * 0.9)).toFixed(3);
  latestIMU.az = +(0.99 + 0.03 * Math.sin(t * 0.5)).toFixed(3);

  latestIMU.gx = +(12 + 8 * Math.sin(t * 1.6)).toFixed(3);
  latestIMU.gy = +(-7 + 6 * Math.cos(t * 1.2)).toFixed(3);
  latestIMU.gz = +(9 + 5 * Math.sin(t * 1.9)).toFixed(3);

  if (latestIMU.motorOn) {
    latestIMU.enc += Math.max(1, Math.floor(latestIMU.motorSpeed / 18));
  }

  broadcastToBrowsers({ type: 'imu', ...latestIMU });
  broadcastStatus();
}, 100);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
