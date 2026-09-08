# Beginner's Guide to Symbiance

Welcome! If you've never used GitHub, don't know what "Git" is, or have never written a line of code, this guide is specifically for you.

We'll walk you through exactly how to download, set up, and use Symbiance to watch videos with your friends.

---

## 1. Downloading the Project (No Git Required)

Instead of using command line tools to download this, you can just download it as a normal ZIP file!

1. At the top of this GitHub page, look for a green button that says **`<> Code`**.
2. Click it, and select **Download ZIP** from the dropdown menu.
3. Once downloaded, extract (unzip) the folder anywhere on your computer (for example, on your Desktop).

---

## 2. Installing the Requirements

To run the server that connects you and your friends, you only need to install two standard programs.

### A. Node.js
This is the engine that runs our server.
1. Go to the [Node.js website](https://nodejs.org/).
2. Download and install the "LTS" (Long Term Support) version.
3. Just click "Next" through the standard installation steps.

### B. Cloudflare Tunnel (Cloudflared)
This is the magic tool that securely exposes your local server to the internet so your friends can connect to it.

**For Windows Users:**
1. Click the Windows Start menu, type `cmd`, and open the **Command Prompt**.
2. Copy and paste this exact command and press Enter:
   ```cmd
   winget install Cloudflare.cloudflared
   ```
3. Wait for it to finish installing.

**For Mac Users:**
If you have Homebrew installed, open Terminal and run `brew install cloudflare/cloudflare/cloudflared`.

---

## 3. Starting Your Server

Now it's time to turn on the engine. You will need to open **two** Command Prompt (or Terminal) windows.

**Window 1: Start the Server**
1. Open Command Prompt.
2. Use the `cd` (change directory) command to navigate to the folder you extracted earlier. For example:
   ```cmd
   cd Desktop\Symbiance-main
   ```
3. Run the server by typing:
   ```cmd
   node server/server.js
   ```
*(Leave this window open in the background!)*

**Window 2: Start the Tunnel**
1. Open a **new** Command Prompt window.
2. Type the following command and press Enter:
   ```cmd
   cloudflared tunnel --url http://localhost:8080
   ```
3. In the text that appears, look for a web link that ends in `.trycloudflare.com`. 
   *(Example: `https://funny-words.trycloudflare.com`)*
4. Copy this link.

---

## 4. Setting up the Extension

Before installing the extension, you need to tell it where your server is.

1. Open the extracted `Symbiance-main` folder on your computer.
2. Open the `extension` folder.
3. Right-click on the file named `websocket.js` and open it with **Notepad** (or any text editor).
4. Scroll down to around line 191 until you see a link inside quotes.
5. Replace the link with the one you copied from Window 2. 
   **Crucial Step:** Change the `https://` at the start of your link to `wss://`.
6. Save the file and close Notepad.

---

## 5. Installing the Extension to your Browser

**For Chrome / Edge / Brave:**
1. Open your browser and go to the extensions page. (Type `chrome://extensions/` in the address bar).
2. Turn on **Developer mode** (usually a toggle switch in the top right corner).
3. Click the **Load unpacked** button in the top left.
4. Select the `Symbiance-main` folder you downloaded and extracted earlier.

---

## 6. Time to Watch!

1. You and your friends should all navigate to the exact same video page.
2. The extension will automatically connect to your server.
3. When you press play, pause, or skip, the extension will instantly sync the video for everyone!

Enjoy your watch party!
