const { _electron: electron, expect } = require("@playwright/test");
const path = require("node:path");
const fs = require("node:fs/promises");
const os = require("node:os");
const assert = require("node:assert/strict");
const { WebSocket } = require("ws");
const { decodeInvite } = require("../desktop/invite");

async function main() {
    if (process.platform !== "linux") throw new Error("This isolated package test runs on Linux. Test the Windows EXE on a Windows computer.");
    const root = path.join(__dirname, "..");
    const executablePath = process.argv[2] || path.join(root, "dist", "linux-unpacked", "symbiance");
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "symbiance-packaged-"));
    const peers = [];
    const application = await electron.launch({ executablePath, args: ["--disable-gpu"],
        env: { ...process.env, HOME: home, APPDATA: home, XDG_CONFIG_HOME: home }, timeout: 30000 });
    try {
        const page = await application.firstWindow();
        const errors = [];
        page.on("pageerror", error => errors.push(error.message));
        page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
        await expect(page.locator("#makeView h1")).toHaveText("Make a room");
        await expect(page.locator(".brand svg")).toBeVisible();
        await expect(page.locator("#profileName")).not.toHaveValue("");
        if (!await application.evaluate(({ app }) => app.isPackaged)) throw new Error("Expected packaged app.");
        await expect(page.locator("#notice")).toBeHidden();
        await fs.mkdir(path.join(root, "test-results"), { recursive: true });
        await page.screenshot({ path: path.join(root, "test-results", "packaged-app.png") });
        if (process.argv.includes("--launch-only")) {
            console.log("Extracted package launches with working preload, icons and native registration.");
            return;
        }
        await page.getByRole("button", { name: "Create room" }).click();
        await expect(page.locator("#roomConnection")).toHaveText("Room connected", { timeout: 100000 });
        const configuration = decodeInvite(await page.locator("#shareInvite").inputValue());
        const messages = [[], []];
        for (let index = 0; index < 2; index++) {
            const socket = new WebSocket(configuration.serverUrl, { handshakeTimeout: 20000 });
            peers.push(socket);
            socket.on("message", raw => messages[index].push(JSON.parse(raw)));
            await new Promise((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
            socket.send(JSON.stringify({ type: "join", roomId: configuration.roomId, profile: { id: `peer-${index}`, name: `Peer ${index}` } }));
        }
        await expect(page.locator("#memberCount")).toHaveText("3");
        for (const [sender, receiver, action, currentTime] of [[0, 1, "play", 12], [1, 0, "pause", 24], [0, 1, "seek", 37]]) {
            peers[sender].send(JSON.stringify({ type: "playback", action, currentTime, sentAt: Date.now() }));
            await expect.poll(() => messages[receiver].some(message => message.type === "playback" && message.action === action && message.currentTime === currentTime)).toBe(true);
        }
        await page.screenshot({ path: path.join(root, "test-results", "packaged-room.png") });
        await page.getByRole("button", { name: "Leave room" }).click();
        await expect(page.locator("#roomView")).toBeHidden();
        assert.deepEqual(errors, []);
        console.log("Packaged app launches with icons and native registration; a real Cloudflare room relays play, pause and seek in both directions.");
    } catch (error) {
        const page = application.windows()[0];
        if (page) {
            console.error(await page.locator("body").innerText());
            await fs.mkdir(path.join(root, "test-results"), { recursive: true });
            await page.screenshot({ path: path.join(root, "test-results", "packaged-failure.png") });
        }
        throw error;
    } finally {
        for (const peer of peers) peer.terminate();
        await application.close();
        await fs.rm(home, { recursive: true, force: true });
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
