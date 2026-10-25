# Build and Run Symbiance from Source

This guide is for running the code or building packages, not using a downloaded EXE. For ready-to-run downloads, use the [user manual](user_manual.md).

## Requirements

- Git and Node.js 24 with npm.
- Windows x64 or Ubuntu/Debian x64 for the desktop app.
- Firefox 140 or newer for playback sync.
- Internet access to download dependencies and build tools.

Run the following commands to clone and install dependencies:

```bash
git clone https://github.com/AWaleed-Ahmed/Symbiance.git
cd Symbiance
npm ci
```

Run all following commands from the repository root. There is no separate dependency install inside `server/`.

## Run the Desktop App

Prepare the bundled Cloudflare binary and native Firefox helper before starting Electron.

### Ubuntu / Debian

```bash
npm run assets -- linux
npm run native:build:linux
npm start
```

### Windows

```powershell
npm run assets -- win32
npm run native:build
npm start
```

The asset command downloads and checks Cloudflare's binary. You do not need a separate system installation of `cloudflared` for this desktop flow.

In Firefox, open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select the repository's root `manifest.json`. Repeat after restarting Firefox. Then follow [Make a Room](user_manual.md#make-a-room) or [Join a Room](user_manual.md#join-a-room). No JavaScript URL edits are needed.

## Build Packages

Use the matching operating system for each build. Windows builds are best made on Windows, rather than relying on Wine from Linux.

### Ubuntu / Debian

```bash
npm run build:linux
```

Outputs:

- `dist/Symbiance-0.2.0-amd64.deb`
- `dist/Symbiance-0.2.0-x64.tar.gz`

### Windows

```powershell
npm run build:win
```

Outputs:

- `dist/Symbiance-0.2.0-x64-portable.exe`
- `dist/Symbiance-0.2.0-x64-setup.exe`

For only a portable Windows build, run `npm run build:win:portable`.

Both package commands prepare assets, build the native helper, and create the unsigned Firefox extension ZIP in `dist/extension/`. Output names above match version `0.2.0`; later versions use the version in `package.json`.

To build just the extension:

```bash
npm run extension:build
```

Build outputs are ignored by Git. Published downloads belong under [GitHub Releases](https://github.com/AWaleed-Ahmed/Symbiance/releases), not in the source tree. These commands do not sign the app or permanently install the unsigned extension.

## Check a Build

Run the automated tests:

```bash
npm test
```

On Linux, smoke-test an extracted desktop build:

```bash
npm run test:packaged -- dist/linux-unpacked/symbiance --launch-only
```

On a headless Linux machine, this launch check needs a display such as Xvfb. The repository's packaging workflow builds on Windows and Ubuntu and runs its checks; a successful build alone does not verify a real two-person watch session.

## Optional: Run Only the Relay

Use this only if you want the server and browser extension without the desktop app. The hosting computer needs Node.js and a separate `cloudflared` installation for this mode. Guests do not need to run the server.

In a first terminal at the repository root, start a plain HTTP origin bound to loopback:

**Ubuntu / Debian:**

```bash
SYMBIANCE_ORIGIN=http npm run server
```

**Windows PowerShell:**

```powershell
$env:SYMBIANCE_ORIGIN = "http"
npm run server
```

In a second terminal, expose that local origin through Cloudflare:

```bash
cloudflared tunnel --url http://127.0.0.1:8080
```

Copy the printed `https://...trycloudflare.com` address. Each viewer loads the source extension in Firefox, opens its toolbar popup, and enters:

- **Server address:** the same Cloudflare HTTPS address; the extension converts it to WSS.
- **Room code:** the same private code, 6-64 letters, numbers, or hyphens. Use a newly generated code, not `test-room`.

Save the settings on each computer, then open the same video. Keep both host terminals running. A new tunnel gets a new address, so update everyone's popup settings when it changes.

Do not expose the plain HTTP origin directly to the internet. The tunnel provides the public HTTPS/WSS connection. Without `SYMBIANCE_ORIGIN=http`, the standalone server defaults to TLS and expects `server/.local/key.pem` and `server/.local/cert.pem`; it will not start without those certificate files.
