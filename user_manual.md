# Symbiance User Manual

Two computers, one watch party. One person hosts, the other joins; everyone watches their own copy of the same video in Firefox.

## Download

Open **[GitHub Releases](https://github.com/AWaleed-Ahmed/Symbiance/releases)** and expand **Assets** under the release you want. The current preview is **[v0.2.0-preview.1](https://github.com/AWaleed-Ahmed/Symbiance/releases/tag/v0.2.0-preview.1)**.

Download one app package for your x64 computer:

| File ending | Use it for |
| --- | --- |
| `x64-portable.exe` | Windows, without an installer |
| `x64-setup.exe` | Windows, with an installer |
| `amd64.deb` | Ubuntu / Debian installation |
| `x64.tar.gz` | Linux, extracted into a folder |

Also download **`symbiance-0.2.0.zip`**, the Firefox extension. Both people need the app and extension. The **Source code** ZIP/tar.gz links are for developers, not app installation.

Install Firefox **140 or newer** separately. The app bundles Node.js, the native messaging helper, and Cloudflare. You do not need to install Node, Cloudflare, Docker, or OpenSSL to use these packages.

## Install and Launch

### Windows

- For the installer, run `Symbiance-0.2.0-x64-setup.exe`, finish setup, and open Symbiance.
- For the portable version, keep `Symbiance-0.2.0-x64-portable.exe` in a stable folder and run it.
- This preview is unsigned, so Windows may show an unknown-publisher warning. Check that it came from this repository's release page; do not disable security protections.

### Ubuntu / Debian

For the DEB, open a terminal in your download folder:

```bash
sudo apt install ./Symbiance-0.2.0-amd64.deb
```

Then launch **Symbiance** from your applications menu.

For the tar.gz, extract it into a permanent folder, open that folder, and run the `symbiance` executable. Keep the entire extracted folder, not just that executable: the other files are required. If Linux reports a launch or sandbox error, note the full error and report it rather than running the app as root or disabling the sandbox.

## Set Up Firefox

Do this on **both computers**:

1. Extract `symbiance-0.2.0.zip` into a folder you can keep.
2. Open Firefox and enter `about:debugging#/runtime/this-firefox` in the address bar.
3. Click **Load Temporary Add-on** and select `manifest.json` inside the extracted folder.
4. Keep Symbiance running. Allow the extension to access your video site when Firefox requests permission.

This preview's extension is **unsigned**. You must open the debugging page yourself and repeat the temporary load after every Firefox restart. The desktop button shows **Extension signing pending**; it cannot install this unsigned add-on permanently.

## Pick Your Profile

Open **Profile**, enter a display name, pick a color, and click **Save profile**. Your name appears in the room's member list.

## Make a Room

Only one person needs to host:

1. Select **Make a room**.
2. Enter a room name and click **Create room**.
3. Wait for the room to connect, then use the copy icon beside **Room invitation**.
4. Send the full `symbiance:...` invitation privately to your friend.
5. Keep the app and your internet connection running while you watch.

The app starts the relay and Cloudflare tunnel for you. No terminal commands or Cloudflare account setup are needed for this packaged flow.

## Join a Room

1. Select **Join a room** in your app.
2. Paste the complete invitation into **Room invitation**.
3. Click **Join room** and check that you both appear under **In the room**.

Windows and Ubuntu packages use the same invitation format and sync protocol. Either operating system can host. A real Windows-to-Ubuntu Firefox watch session, including Ubuntu Snap integration, still needs user testing in this preview.

## Watch Together

1. Each person opens the **same video, episode, and version** in Firefox. Use **Video page** and **Open in Firefox**, or open the page yourself.
2. Allow the extension on the site. Keep only your intended video player active to avoid competing playback events.
3. Press play once on each computer if Firefox blocks automatic playback.
4. Play, pause, or seek. Those actions are shared with the room.

Symbiance sends playback state, not the video itself. Everyone needs their own access to the content, including any required subscription. Different edits, ads, buffering, and unsupported players can affect sync; not every website is guaranteed to work.

## Leave or Reconnect

Use the **Leave room** icon beside the room name to leave. If the host closes the app, the room is no longer reachable.

After restarting the host or its tunnel, create a room and share the new invitation. The old temporary Cloudflare address may no longer work. After restarting Firefox, load the temporary extension again before watching.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| Firefox disconnected | Start the app, load the temporary extension in the Firefox profile you are using, and grant site access. Reload the video page if needed. |
| Extension signing pending | Expected for this preview. Use the manual temporary-load steps above. |
| Cannot join | Ask the host to keep the app open and send the current full invitation. Check your internet connections. |
| Connected, but no sync | Check the member list, same video/version, extension permissions, and autoplay. Press play once on each computer. |
| Open in Firefox fails | Firefox must be installed in a standard location. Open the same video URL manually in Firefox as a workaround. |
| Ubuntu Snap Firefox stays disconnected | Native messaging through Snap is not fully verified here. Report your Ubuntu/Firefox versions and the error; do not assume a successful app launch proves browser integration. |
| Sync stops after Firefox restart | Temporary add-ons do not survive restart. Load `manifest.json` again. |

For a bug report, include your operating system, Firefox version, Symbiance release, the failing step, and any error text. Do not post your private invitation or tokens.

## Check a Download

Download `SHA256SUMS` from the same release. Compare the line for your package with a local hash:

**Ubuntu / Debian:**

```bash
sha256sum Symbiance-0.2.0-amd64.deb
```

**Windows PowerShell:**

```powershell
Get-FileHash .\Symbiance-0.2.0-x64-portable.exe -Algorithm SHA256
```

A matching checksum checks file integrity; it is not a publisher signature.

Looking for source setup instead? See **[build_steps.md](build_steps.md)**.
