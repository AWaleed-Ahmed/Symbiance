const { _electron: electron, expect } = require("@playwright/test");
const path = require("node:path");
const fs = require("node:fs/promises");
const assert = require("node:assert/strict");
const { WebSocket } = require("ws");
const { once } = require("node:events");
const { decodeInvite } = require("../desktop/invite");

async function main() {
    const root = path.join(__dirname, "..");
    const application = await electron.launch({ args: [root, "--smoke-test"], timeout: 30000 });
    const errors = [];
    let peers = [];
    try {
        const page = await application.firstWindow();
        page.on("pageerror", error => errors.push(error.message));
        page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
        await expect(page.locator("#makeView h1")).toHaveText("Make a room");
        await expect(page.locator(".brand svg")).toBeVisible();
        await page.locator('[data-view="profile"]').click();
        await page.locator("#profileName").fill("Alice");
        await page.locator(".swatch").nth(1).click();
        await page.locator("#profileForm button[type=submit]").click();
        await expect(page.locator("#sidebarName")).toHaveText("Alice");
        await page.locator('[data-view="join"]').click();
        await page.locator("#invitation").fill("not-an-invitation");
        await page.locator("#joinForm button").click();
        await expect(page.locator("#notice")).toBeVisible();
        await page.locator('[data-view="make"]').click();
        await page.locator("#roomName").fill("Friday movie night");
        await fs.mkdir(path.join(root, "test-results"), { recursive: true });
        await page.screenshot({ path: path.join(root, "test-results", "desktop-home.png") });
        await page.locator("#makeForm button").click();
        await expect(page.locator("#activeRoomName")).toHaveText("Friday movie night", { timeout: 100000 });
        await expect(page.locator("#roomConnection")).toHaveText("Room connected");
        const invitation = await page.locator("#shareInvite").inputValue();
        const configuration = decodeInvite(invitation);
        for (const name of ["test-a", "test-b"]) {
            const socket = new WebSocket(configuration.serverUrl, { handshakeTimeout: 20000 });
            peers.push(socket);
            await once(socket, "open");
            socket.send(JSON.stringify({ type: "join", roomId: configuration.roomId, profile: { id: name, name } }));
        }
        await expect(page.locator("#memberCount")).toHaveText("3");
        const received = once(peers[1], "message");
        peers[0].send(JSON.stringify({ type: "playback", action: "pause", currentTime: 31 }));
        let playback;
        const deadline = Date.now() + 10000;
        peers[1].on("message", raw => { const message = JSON.parse(raw); if (message.type === "playback") playback = message; });
        await received;
        while (!playback && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
        assert.equal(playback?.currentTime, 31, "Playback must cross the real Cloudflare tunnel");
        await page.screenshot({ path: path.join(root, "test-results", "desktop-room.png") });
        await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(780, 650));
        await page.waitForFunction(() => innerWidth < 850);
        await page.screenshot({ path: path.join(root, "test-results", "compact-room.png"), fullPage: true });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "No horizontal overflow");
        await page.locator("#leaveRoom").click();
        await expect(page.locator("#roomView")).toBeHidden();
        assert.deepEqual(errors, [], "No renderer or missing-asset errors");
        console.log("Desktop UI, profile, validation, actual Cloudflare room and playback checks passed.");
    } finally {
        for (const peer of peers) peer.terminate();
        await application.close();
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
