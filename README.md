# Symbiance

Symbiance is a browser extension and WebSocket server combination designed for perfectly synchronizing video playback across multiple browsers and devices. It allows you to host private watch parties by coordinating standard HTML5 `<video>` events (Play, Pause, Seek) in real-time, completely bypassing CORS restrictions via cross-origin `postMessage` bridges.

This project uses a hub-and-spoke architecture: 
1. The **Top Window** of the webpage communicates securely with child iframes holding the `<video>`.
2. A single **WebSocket connection** is routed through a secure **Cloudflare Tunnel** to a centralized Node.js server.
3. The server broadcasts the playback state and utilizes **Timestamp Latency Compensation** to mathematically sync the play times down to the millisecond.

---

## Prerequisites

> **🚨 Non-programmer or never used GitHub? Start here:** Check out our **[Beginner's Guide (for-noobs.md)](for-noobs.md)** for a super simple, step-by-step setup tutorial without the developer jargon!

To host the WebSocket server, you will need **Node.js** and **Cloudflared** (Cloudflare Tunnel).

### Installing Cloudflared

**Windows:**
Open Command Prompt or PowerShell and run:
```cmd
winget install Cloudflare.cloudflared
```

**Linux (Debian/Ubuntu):**
Download and install the latest `.deb` package:
```bash
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
```

**macOS:**
```bash
brew install cloudflare/cloudflare/cloudflared
```

---

## How to Run the Server

You need two terminal windows to host the server and expose it to the internet securely.

### 1. Start the WebSocket Server
In your first terminal, navigate to the root of the project and start the Node server. By default, it listens on port `8080`.
```bash
node server/server.js
```
*(If you haven't installed dependencies yet, run `npm install` inside the `server/` folder to install the `ws` library).*

### 2. Start the Cloudflare Tunnel
In your second terminal, create a secure tunnel pointing to your local port `8080`:
```bash
cloudflared tunnel --url http://localhost:8080
```
When this command runs, Cloudflare will generate a temporary URL that looks something like this:
`https://nato-hope-programmes-ones.trycloudflare.com`

---

## Configuring the Extension

Before installing the extension in your browser, you must point it to your newly generated Cloudflare Tunnel.

1. Open `extension/websocket.js`.
2. Locate the WebSocket connection block (around line 191).
3. Replace the URL with your Cloudflare tunnel URL. **Make sure to change `https://` to `wss://`**.

Example:
```javascript
socket = new WebSocket(
    "wss://nato-hope-programmes-ones.trycloudflare.com"
);
```

---

## Installing the Extension

### Google Chrome / Brave / Edge
1. Navigate to the Extensions page (`chrome://extensions/`).
2. Toggle **Developer mode** on in the top-right corner.
3. Click **Load unpacked** in the top-left corner.
4. Select the root folder of this project (the folder containing `manifest.json`).

### Mozilla Firefox
1. Navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select the `manifest.json` file inside the project folder.

---

## How to Use

1. **Open a Supported Site:** Both you and your friend need to navigate to the identical video page (e.g., a specific episode on `aniwaves.ru`).
2. **Automatic Connection:** Once the page loads, the extension will automatically connect to the WebSocket server and join the default watch party room (`test-room`).
3. **Play the Video:** Press play! The extension will capture the `play`, `pause`, and `seek` events and broadcast them to everyone in the room. The receiving clients will automatically calculate the network transport latency and adjust their `<video>` start times so that you watch in perfect unison.
