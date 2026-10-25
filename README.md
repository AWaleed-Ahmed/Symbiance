<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/branding/symbiance-wordmark-white.png">
    <source media="(prefers-color-scheme: light)" srcset="assets/branding/symbiance-wordmark-dark.png">
    <img src="assets/branding/symbiance-wordmark-white.png" alt="Symbiance" width="680">
  </picture>
</p>

**Different sofas. Same scene.**

Movie night should not need a countdown, three false starts, and someone yelling "what timestamp are you at?"

Symbiance brings your Firefox video players into the same watch room. Play, pause, or seek, and the other viewers follow along. You bring the video and the snacks; Symbiance handles the awkward timing bit.

[Download a release](https://github.com/AWaleed-Ahmed/Symbiance/releases) · [User manual](user_manual.md) · [Build from source](build_steps.md)

## Grab Your Copy

Open **[Releases](https://github.com/AWaleed-Ahmed/Symbiance/releases)**, choose a release, then expand **Assets**. On the repository page, Releases is also linked in the right sidebar on desktop.

The current download is **[v0.2.0-preview.1](https://github.com/AWaleed-Ahmed/Symbiance/releases/tag/v0.2.0-preview.1)**, an unsigned x64 preview:

| Your computer | Download |
| --- | --- |
| Windows, no installation | [Portable EXE](https://github.com/AWaleed-Ahmed/Symbiance/releases/download/v0.2.0-preview.1/Symbiance-0.2.0-x64-portable.exe) |
| Windows, installed app | [Setup EXE](https://github.com/AWaleed-Ahmed/Symbiance/releases/download/v0.2.0-preview.1/Symbiance-0.2.0-x64-setup.exe) |
| Ubuntu / Debian | [DEB package](https://github.com/AWaleed-Ahmed/Symbiance/releases/download/v0.2.0-preview.1/Symbiance-0.2.0-amd64.deb) |
| Linux, extracted app | [tar.gz archive](https://github.com/AWaleed-Ahmed/Symbiance/releases/download/v0.2.0-preview.1/Symbiance-0.2.0-x64.tar.gz) |
| Firefox, required on both computers | [Extension ZIP](https://github.com/AWaleed-Ahmed/Symbiance/releases/download/v0.2.0-preview.1/symbiance-0.2.0.zip) |

Download the app **and** the extension ZIP. The automatically generated **Source code** archives are not ready-to-run apps. Checksums are in `SHA256SUMS` on the release page.

## Start the Watch Party

1. Install Firefox 140 or newer and launch Symbiance on both computers. Node.js and Cloudflare are bundled; no separate setup is needed.
2. Extract the extension ZIP. In Firefox, open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select the extracted `manifest.json`.
3. One person chooses **Make a room**, clicks **Create room**, and sends the copied invitation to their friend.
4. The friend chooses **Join a room**, pastes the invitation, and clicks **Join room**.
5. Open the same video in Firefox on both computers. Allow the extension on that site, press play once if Firefox blocks autoplay, and keep both apps open.

Windows and Ubuntu use the same room protocol, so they can share a room. Real two-computer playback still needs testing; this is a preview, not a promise of perfect sync on every website.

## The Small Print

- The Firefox extension is **not signed yet**. Temporary loading is manual and must be repeated after Firefox restarts. The app's extension-install button is disabled in this preview.
- The Windows builds are also unsigned and may show an unknown-publisher warning.
- Everyone needs their own access to the same video. Symbiance syncs playback controls; it does not stream the video to your friend or bypass subscriptions.
- Keep invitations private. When the host restarts the room or tunnel, share the new invitation.

Need installation steps or troubleshooting? Read the **[user manual](user_manual.md)**. Want to run the source code or make packages? Head to **[build_steps.md](build_steps.md)**.
