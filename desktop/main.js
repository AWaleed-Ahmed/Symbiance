const { app, BrowserWindow, ipcMain, clipboard } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const os = require("node:os");
const { Controller } = require("./controller");
const { createConnector } = require("./connector");
const { installNativeHost } = require("./native-install");
const { dataDirectory, helperNames } = require("./platform");

app.setName("Symbiance");
let window;
let controller;
let connector;
let quitting = false;
const resources = () => app.isPackaged ? process.resourcesPath : path.join(__dirname, "..", "assets");
const helperResources = () => app.isPackaged ? process.resourcesPath : path.join(resources(), process.platform);
const smokeTest = !app.isPackaged && process.argv.includes("--smoke-test");

async function firefox(file) {
    const candidates = process.platform === "linux" ? ["/usr/bin/firefox", "/usr/local/bin/firefox", "/snap/bin/firefox"]
        : [process.env.ProgramFiles, process.env["ProgramFiles(x86)"], process.env.LOCALAPPDATA]
        .filter(Boolean).map(root => path.join(root, "Mozilla Firefox", "firefox.exe"));
    const binary = candidates.find(candidate => fs.existsSync(candidate));
    if (!binary) throw new Error("Firefox is not installed in a standard location.");
    const child = spawn(binary, [file], { detached: true, stdio: "ignore", windowsHide: true });
    await new Promise((resolve, reject) => { child.once("spawn", resolve); child.once("error", reject); });
    child.unref();
}

function registerIPC() {
    const handle = (name, callback) => ipcMain.handle("symbiance:" + name, async (event, ...args) => {
        if (event.sender !== window.webContents || !event.senderFrame.url.startsWith("file:")) throw new Error("Invalid app request.");
        try { return { ok: true, value: await callback(...args) }; }
        catch (error) { return { ok: false, error: error.message }; }
    });
    handle("state", () => controller.snapshot());
    handle("make", name => controller.makeRoom(name));
    handle("join", invite => controller.joinRoom(invite));
    handle("leave", () => controller.state.busy ? Promise.reject(new Error("Wait for room setup to finish.")) : controller.leaveRoom());
    handle("profile", profile => controller.saveProfile(profile));
    handle("copy", () => {
        if (!controller.state.room) throw new Error("Create or join a room first.");
        clipboard.writeText(controller.state.room.invite);
    });
    handle("firefox", value => {
        const url = new URL(value);
        if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("Enter a video page address.");
        return firefox(url.href);
    });
    handle("install", () => {
        const xpi = path.join(resources(), "extension", "symbiance-signed.xpi");
        if (!fs.existsSync(xpi)) throw new Error("This build needs a Mozilla-signed Firefox extension. See the release instructions.");
        return firefox(xpi);
    });
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
    app.on("second-instance", () => { if (window) { window.restore(); window.focus(); } });
    app.whenReady().then(async () => {
        const directory = smokeTest ? fs.mkdtempSync(path.join(os.tmpdir(), "symbiance-ui-")) : dataDirectory();
        const helpers = helperNames();
        controller = new Controller({ directory, tunnelBinary: path.join(helperResources(), helpers.tunnel) });
        await controller.initialize();
        controller.state.extensionSigned = fs.existsSync(path.join(resources(), "extension", "symbiance-signed.xpi"));
        try { if (!smokeTest) await installNativeHost(directory, path.join(helperResources(), "native", helpers.native)); }
        catch (error) { controller.state.error = error.message; }
        connector = await createConnector(directory, () => controller.configuration(), count => {
            controller.state.extensionConnected = count > 0; controller.update();
        });
        controller.on("configuration", () => connector.broadcast());
        window = new BrowserWindow({ width: 1080, height: 760, minWidth: 760, minHeight: 600,
            title: "Symbiance", backgroundColor: "#f7f9f9", autoHideMenuBar: true,
            webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true, nodeIntegration: false } });
        registerIPC();
        controller.on("state", state => { if (!window.isDestroyed()) window.webContents.send("symbiance:state", state); });
        window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
        window.webContents.on("will-navigate", event => event.preventDefault());
        await window.loadFile(path.join(__dirname, "index.html"));
    }).catch(error => { console.error(error.message); app.quit(); });
    app.on("window-all-closed", () => app.quit());
    app.on("before-quit", event => {
        if (quitting) return;
        event.preventDefault();
        quitting = true;
        Promise.resolve(controller?.leaveRoom()).then(() => connector?.close()).finally(() => app.quit());
    });
}
