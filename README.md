# RPOD Target Spacecraft: Mission Control Dashboard & Relay Server

## Overview

This repository contains the Ground Segment software for the RPOD Target Spacecraft. It is a full-stack Node.js application that serves as both a **Telemetry Relay Server** and a **Real-Time Mission Dashboard**.

Because microcontrollers (like the ESP32) can struggle to serve multiple simultaneous WebSocket clients or host complex web assets directly, this Node.js server acts as an ultra-low-latency cloud broker. It receives live 6-DoF inertial data from the spacecraft and broadcasts it to any number of connected browser clients, while routing telecommands (motor control, odometry resets) from the dashboard back to the flight hardware.

## System Features

* **Dual-Channel WebSocket Broker:** Maintains segregated WebSocket upgrade paths. Flight hardware connects via `/esp32`, while human operators connect via `/ws`.
* **State Caching:** The server caches the latest telemetry snapshot (`latestIMU`), ensuring that newly opened dashboard tabs instantly render the spacecraft's current state without waiting for the next transmission cycle.
* **Real-Time Data Visualization:** The frontend features a rolling 100-sample line chart (via Chart.js) for instantaneous acceleration and gyroscopic analysis, alongside dynamic CSS-driven progress bars for immediate visual feedback.
* **Bidirectional Telecommand UI:** Provides a debounced speed slider and toggle switch for safe, responsive actuation of the target's rotation mechanisms, plus a hardware encoder reset trigger.
* **Live Health Monitoring:** Visual badges instantly indicate the connection health of both the Cloud Server and the active ESP32 flight node.

---

## Tech Stack

* **Backend:** Node.js, Express (`express`), WebSockets (`ws`)
* **Frontend:** Vanilla HTML5, CSS3, JavaScript
* **Visualization:** Chart.js (v4.4.3 via CDN)

---

## Project Structure

To run this application correctly, ensure your files are structured as follows:

```text
├── public/
│   └── index.html      # The frontend dashboard UI (HTML/CSS/JS)
├── package.json        # Node.js dependencies and scripts
└── server.js           # The Express & WebSocket relay server

```

---

## Installation & Setup

**1. Install Dependencies**
Ensure Node.js (v18.0.0 or higher) is installed on your deployment machine.

```bash
npm install

```

**2. Run the Server (Local Development)**

```bash
npm start

```

The server will bind to `localhost:3000` (or your environment's `$PORT`).

**3. Access the Dashboard**
Open your browser and navigate to `http://localhost:3000`.

---

## Network Architecture & Routing

The `server.js` file establishes a single HTTP server that handles standard web traffic and upgrades WebSocket connections based on the URL path.

| Endpoint | Client Type | Protocol | Function |
| --- | --- | --- | --- |
| `/` | Browser | HTTP | Serves the static `index.html` dashboard. |
| `/esp32` | Spacecraft | WSS | Ingests telemetry (`20Hz`) and relays commands. |
| `/ws` | Browser | WSS | Pushes telemetry to UI and receives user input. |

---

## Data Flow & JSON Protocol

The server does not heavily mutate the data; it acts as a high-speed router. It enforces the following JSON structures for network traffic:

### 1. Telemetry Broadcast (ESP32 → Server → Browser)

The ESP32 pushes this payload. The server caches it and broadcasts it to all `/ws` clients.

```json
{
  "type": "imu",
  "ax": 0.012, "ay": -0.981, "az": 0.055,
  "gx": 1.230, "gy": -0.450, "gz": 0.110,
  "enc": 10452,
  "motorOn": true,
  "motorSpeed": 160
}

```

### 2. Status Broadcast (Server → Browser)

Injected by the Node.js server to inform the UI if the spacecraft has dropped off the network.

```json
{
  "type": "status",
  "esp32": true 
}

```

### 3. Telecommand Routing (Browser → Server → ESP32)

When an operator interacts with the UI, the browser sends these payloads. The server instantly routes them to the `/esp32` socket.

```json
{
  "type": "motor",
  "on": true,
  "speed": 200
}

```

---

## UI/UX Design Notes

* **Debounced Inputs:** The motor speed slider incorporates an 80ms debounce. This prevents flooding the ESP32 and the WebSocket server with hundreds of rapid-fire JSON payloads as the user drags the slider.
* **Responsive State:** If the Node server detects an ESP32 disconnect, it automatically broadcasts a `false` status to the frontend. The UI responds by turning the ESP32 badge red and visually reverting the motor toggle to `OFF`, ensuring the operator's dashboard accurately reflects the spacecraft's failsafe state.
