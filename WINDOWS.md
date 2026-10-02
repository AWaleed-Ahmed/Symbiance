# Windows Desktop App

## For Viewers

Use the installer or portable EXE from a signed-extension release. Node.js and cloudflared are bundled; Docker, terminals, and certificate exceptions are not required. Firefox itself must already be installed.

1. Launch Symbiance. Click **Install extension** and approve Firefox's normal installation and site-access prompts once. The release must contain the Mozilla-signed add-on; a development build displays **Extension signing pending** instead.
2. Open **Profile**, choose a name and color, and save.
3. The host chooses **Make a room**. Symbiance starts its private local server and Cloudflare Tunnel automatically. Copy the invitation to your friends.
4. Friends choose **Join a room** and paste the invitation. They do not start a server or tunnel.
5. Open the same video in Firefox on each computer. Keep Symbiance running while watching. Browser autoplay restrictions may require pressing Play once on each computer.

The extension retries dropped connections and checks for stalled connections, without refreshing the video page. Reconnecting tabs receive the room's latest playback state. Firefox connections use the tunnel's publicly trusted certificate.

Quick Tunnels are temporary. Cloudflared reconnects network interruptions while its process is running, but closing the host app or losing that process ends the room address. Create a new room and share its new invitation in that case. A persistent room address requires a named tunnel or hosted relay; this build does not silently promise persistent invites.

## Building

Build prerequisites are Node.js and npm on the developer's machine only:

```powershell
npm ci
npm run build:win
```

Outputs: `dist/Symbiance-0.2.0-x64-portable.exe` and `dist/Symbiance-0.2.0-x64-setup.exe`. The native Firefox helper contains its own Node runtime. Cloudflare's official Windows binary is verified against its release SHA-256 digest. Configuration and the local profile live in `%APPDATA%/Symbiance`.

The desktop registers a per-user native-messaging host for `symbiance@awaleed-ahmed.github.io`. It only accepts the add-on through Firefox's native-messaging API. The helper talks to an authenticated loopback endpoint; ordinary web pages cannot configure rooms. Portable builds must remain in their extracted location while running. Starting the app again refreshes the helper registration.

## Signing the Firefox Extension

The repository does not include signing credentials or a pre-signed extension. Register the extension under the publisher's Mozilla account, obtain AMO API credentials, and provide `AMO_JWT_ISSUER` and `AMO_JWT_SECRET` as environment variables. Do not commit them.

```powershell
npm run extension:sign
npm run build:win
```

The signing command submits an unlisted add-on and copies the signed XPI into `assets/extension/symbiance-signed.xpi`. Windows builds automatically include that file. Signing and Mozilla review are external requirements and can take time. AMO may ask for a source archive or additional privacy information. Do not ship the unsigned ZIP from `extension:build` as a permanent Firefox add-on, and do not ask viewers to disable signature enforcement.

The manifest declares browsing activity, website content, and profile information because the extension sends page/video identity, playback state, and the selected profile to the room. Participants can see this information. Cloudflare transports encrypted connections to the host's relay. No analytics service is included. Add a publisher-hosted privacy policy matching these practices before public distribution.

Windows Authenticode signing is separate from Mozilla signing. These development EXEs are unsigned and Windows may display an unknown-publisher warning. A public release should use the publisher's code-signing certificate and a custom application icon.

## Verification

```powershell
npm test
npm run test:ui
```

The UI test launches Electron, checks profile and invitation flows, creates a real short-lived Cloudflare tunnel, verifies playback through it, captures screenshots, and shuts the room down. It does not register a Firefox helper or change the user's saved profile. Actual Firefox site access, signed-install consent, embedded-player compatibility and autoplay should also be tested manually before release.
