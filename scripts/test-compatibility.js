const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { extractAll, extractFile } = require("@electron/asar");
const { setTimeout: delay } = require("node:timers/promises");

async function until(predicate) {
    const deadline = Date.now() + 10000;
    while (!predicate()) {
        assert.ok(Date.now() < deadline, "Timed out waiting for package compatibility check");
        await delay(20);
    }
}

async function main() {
    const root = path.join(__dirname, "..");
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "symbiance-compatibility-"));
    const archives = ["linux", "win"].map(platform => path.join(root, "dist", `${platform}-unpacked`, "resources", "app.asar"));
    const clients = [];
    const relays = [];
    try {
        for (const file of ["server/relay.js", "desktop/room-client.js", "desktop/invite.js"]) {
            assert.deepEqual(extractFile(archives[0], file), extractFile(archives[1], file), `${file} must match across packages`);
        }
        for (let index = 0; index < archives.length; index++) extractAll(archives[index], path.join(directory, String(index)));
        const packages = [0, 1].map(index => ({
            ...require(path.join(directory, String(index), "server/relay.js")),
            ...require(path.join(directory, String(index), "desktop/room-client.js"))
        }));
        for (const host of packages) {
            const relay = await host.createRelayServer();
            relays.push(relay);
            const keeper = new host.RoomClient();
            clients.push(keeper);
            let keeperJoined = false;
            keeper.on("message", message => { if (message.type === "joined") keeperJoined = true; });
            keeper.connect({ serverUrl: `ws://127.0.0.1:${relay.port}`, roomId: "shared-platform-room", profile: { id: "desktop-host" } });
            await until(() => keeperJoined);
            const messages = [[], []];
            const peers = packages.map(({ RoomClient }, index) => {
                const peer = new RoomClient({ retryMs: 50 });
                clients.push(peer);
                peer.on("message", message => messages[index].push(message));
                peer.connect({ serverUrl: `ws://127.0.0.1:${relay.port}`, roomId: "shared-platform-room", profile: { id: `peer-${index}` } });
                return peer;
            });
            await until(() => messages.every(list => list.some(message => message.type === "joined")));
            for (const [sender, receiver, action, currentTime] of [[0, 1, "play", 12], [1, 0, "pause", 24], [0, 1, "seek", 37], [1, 0, "play", 42]]) {
                peers[sender].send({ type: "playback", action, currentTime, sentAt: Date.now() });
                await until(() => messages[receiver].some(message => message.type === "playback" && message.action === action && message.currentTime === currentTime));
            }
            for (const socket of relay.wss.clients) if (socket.profile.id !== "desktop-host") socket.terminate();
            await until(() => messages.every(list => list.filter(message => message.type === "joined").length === 2));
            await until(() => messages.every(list => list.some(message => message.snapshot && message.currentTime === 42)));
            for (const peer of peers) peer.close();
            keeper.close();
            await relay.close();
            relays.pop();
        }
        console.log("Linux and Windows packaged protocol code matches. Both host directions pass play, pause, seek, reconnect and playback restoration using code extracted from each package. Windows executable execution is not tested here.");
    } finally {
        for (const client of clients) client.close();
        for (const relay of relays) await relay.close();
        await fs.rm(directory, { recursive: true, force: true });
    }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
