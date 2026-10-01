# Symbiance

Symbiance is a browser extension and WebSocket server combination for synchronizing HTML5 video playback between tabs.

The extension's background process connects each tab to the local secure WebSocket server. The server relays play, pause, and seek commands to the other tabs in the room.

---

## Prerequisites

> **🚨 Non-programmer or never used GitHub? Start here:** Check out our **[Beginner's Guide (for-noobs.md)](for-noobs.md)** for a super simple, step-by-step setup tutorial without the developer jargon!

You need **Node.js**. Install dependencies with `npm install` in the project root. Direct local connections also need **OpenSSL** to create a certificate. The tunnel option below needs `cloudflared` instead.

## How to Run the Server

Generate a local server-only certificate once from the project root. On Windows with Git installed, OpenSSL is usually at `C:\Program Files\Git\usr\bin\openssl.exe`.

```bash
mkdir -p server/.local
openssl req -x509 -newkey rsa:2048 -sha256 -nodes -keyout server/.local/key.pem -out server/.local/cert.pem -days 365 -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" -addext "basicConstraints=critical,CA:FALSE" -addext "keyUsage=critical,digitalSignature,keyEncipherment" -addext "extendedKeyUsage=serverAuth"
```

The certificate and private key stay in the ignored `server/.local` directory. Start the server:

```bash
node server/server.js
```

In Firefox, visit `https://127.0.0.1:8080`. The certificate is self-signed, so Firefox will ask you to add a certificate exception. Check that the address is exactly `127.0.0.1` before accepting. The page should then say `Symbiance server is ready.` Reload the temporary add-on and refresh the video tabs.

If Firefox stores the local exception in that profile, you do not need to accept it on every server start. A session-only exception, a replaced certificate, or an expired certificate will prompt again.

### No Browser Certificate Exception

For viewers on other machines, use a server address with a publicly trusted certificate. A [Cloudflare Quick Tunnel](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) works for testing. Install `cloudflared`, then start Symbiance in HTTP origin mode:

```powershell
$env:SYMBIANCE_ORIGIN = "http"
node server/server.js
```

In another terminal:

```bash
cloudflared tunnel --url http://127.0.0.1:8080
```

Open the Symbiance extension popup and paste the tunnel's `https://...trycloudflare.com` URL into **Server address**. The popup converts it to `wss://`. Click **Save**; it creates a private room code when switching away from the local default. Share the tunnel URL and room code with the other viewers. Each viewer enters the same values in their extension popup. Open tabs reconnect when settings change.

Quick Tunnel URLs change each time the tunnel restarts and are intended for testing. For a stable setup, use a [named Cloudflare Tunnel](https://developers.cloudflare.com/tunnel/get-started/) or another trusted HTTPS/WSS host. The local origin stays bound to `127.0.0.1`; do not expose its HTTP port directly to the internet.

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
4. Grant Symbiance access to the video sites in Firefox's Extensions menu.

---

## How to Use

1. **Open a Supported Site:** Both you and your friend need to navigate to the identical video page (e.g., a specific episode on `aniwaves.ru`).
2. **Automatic Connection:** Once the page loads, the extension will connect to the local secure WebSocket server and join the default room (`test-room`).
3. **Play the Video:** Press play! The extension will capture the `play`, `pause`, and `seek` events and broadcast them to everyone in the room. The receiving clients will automatically calculate the network transport latency and adjust their `<video>` start times so that you watch in perfect unison.
