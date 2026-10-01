# Beginner's Guide to Symbiance

Symbiance lets two or more browser tabs follow the same video's play, pause, and seek actions. One computer runs the server. Everyone watching installs the extension.

## 1. Get the Files

On GitHub, click **Code** and **Download ZIP**, then unzip the folder. You can also clone the repository with Git.

Install [Node.js](https://nodejs.org/) and open a terminal in the Symbiance folder. Run:

```bash
npm install
```

## 2. Choose a Connection

**Same computer, direct connection:** Follow the certificate and local server steps in the [README](README.md#how-to-run-the-server). If Firefox stores the certificate exception, you only need to accept it again when that certificate is replaced or expires.

**Different computers, no browser certificate warning:** Install [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) on the computer hosting the server. In a PowerShell window in the Symbiance folder, run:

```powershell
$env:SYMBIANCE_ORIGIN = "http"
node server/server.js
```

In a second terminal, run:

```bash
cloudflared tunnel --url http://127.0.0.1:8080
```

Copy the `https://...trycloudflare.com` address shown in the second terminal. Keep both terminals open while watching. This temporary address changes when you restart the tunnel.

## 3. Load the Firefox Extension

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and select the project's `manifest.json`.
3. In Firefox's Extensions menu, grant Symbiance access to the video sites.
4. Open the Symbiance popup. Paste the tunnel's HTTPS address into **Server address** and click **Save**. Symbiance converts it to a secure WebSocket address and creates a room code.
5. Give each viewer the same server address and room code. They enter both in their own Symbiance popup.

If you use the direct local connection, keep the default server address and room code in the popup. Open the same video in both tabs and try pause or seek.

Firefox temporary add-ons must be loaded again after restarting Firefox. Cloudflare Quick Tunnels are for testing; a named tunnel or other trusted host provides a stable address.
