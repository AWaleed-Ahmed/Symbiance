const test = require("node:test");
const assert = require("node:assert/strict");
const { once, EventEmitter } = require("node:events");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { WebSocket } = require("ws");
const { createRelayServer } = require("../server/relay");
const { encodeInvite, decodeInvite } = require("../desktop/invite");
const { RoomClient } = require("../desktop/room-client");
const { Controller } = require("../desktop/controller");
const { createConnector } = require("../desktop/connector");
const { spawn } = require("node:child_process");
const { helperNames, dataDirectory } = require("../desktop/platform");
const { installNativeHost } = require("../desktop/native-install");

async function until(predicate, timeout = 5000) {
    const deadline = Date.now() + timeout;
    while (!predicate()) {
        assert.ok(Date.now() < deadline, "Timed out waiting for state");
        await new Promise(resolve => setTimeout(resolve, 20));
    }
}
async function peer(relay, roomId, id = roomId) {
    const socket = new WebSocket(`ws://127.0.0.1:${relay.port}`);
    const messages = [];
    socket.on("message", raw => messages.push(JSON.parse(raw)));
    await once(socket, "open");
    socket.send(JSON.stringify({ type: "join", roomId, profile: { id, name: id } }));
    await until(() => messages.some(message => message.type === "joined"));
    return { socket, messages };
}

test("desktop and native helper agree on Windows and Linux resource paths", () => {
    assert.equal(dataDirectory("win32", { APPDATA: "C:/Users/Viewer/AppData/Roaming" }),
        path.join("C:/Users/Viewer/AppData/Roaming", "Symbiance"));
    assert.equal(dataDirectory("linux", { XDG_CONFIG_HOME: "/custom/config", HOME: "/home/viewer" }), path.join("/custom/config", "Symbiance"));
    assert.equal(dataDirectory("linux", { HOME: "/home/viewer" }), path.join("/home/viewer", ".config", "Symbiance"));
    assert.deepEqual(helperNames("linux"), { tunnel: "cloudflared", native: "symbiance-bridge" });
    assert.deepEqual(helperNames("win32"), { tunnel: "cloudflared.exe", native: "symbiance-bridge.exe" });
});

test("Linux native messaging registration points Firefox at the bundled helper", async t => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "symbiance-registration-"));
    t.after(() => fs.rm(home, { recursive: true, force: true }));
    await installNativeHost(home, process.execPath, { platform: "linux", home });
    const manifest = JSON.parse(await fs.readFile(path.join(home, ".mozilla", "native-messaging-hosts", "com.symbiance.bridge.json")));
    assert.equal(manifest.path, process.execPath);
    assert.equal(manifest.type, "stdio");
    assert.deepEqual(manifest.allowed_extensions, ["symbiance@awaleed-ahmed.github.io"]);
});

test("invitations reject insecure endpoints, malformed codes and embedded credentials", () => {
    const room = { roomId: "private-room-123", serverUrl: "wss://example.trycloudflare.com", name: "Movie night" };
    assert.deepEqual(decodeInvite(encodeInvite(room)), { ...room, serverUrl: room.serverUrl + "/" });
    for (const serverUrl of ["ws://localhost", "https://example.com", "wss://user:secret@example.com"]) {
        assert.throws(() => decodeInvite(encodeInvite({ ...room, serverUrl })));
    }
    assert.throws(() => decodeInvite("broken"));
    assert.throws(() => decodeInvite(encodeInvite({ ...room, roomId: "bad" })));
});

test("relay isolates rooms, deduplicates profiles and restores playback to reconnecting tabs", async t => {
    const relay = await createRelayServer();
    t.after(() => relay.close());
    const a = await peer(relay, "room-one", "viewer-a");
    const b = await peer(relay, "room-one", "viewer-b");
    const other = await peer(relay, "room-two", "viewer-c");
    const tab = await peer(relay, "room-one", "viewer-a");
    await until(() => a.messages.some(m => m.type === "members" && m.members.length === 2));
    a.socket.send(JSON.stringify({ type: "playback", action: "pause", currentTime: 42 }));
    await until(() => b.messages.some(m => m.type === "playback"));
    assert.equal(b.messages.find(m => m.type === "playback").currentTime, 42);
    assert.equal(other.messages.some(m => m.type === "playback"), false);
    a.socket.send(JSON.stringify({ type: "playback", action: "seek", currentTime: -1 }));
    const resumed = await peer(relay, "room-one", "viewer-b");
    await until(() => resumed.messages.some(m => m.snapshot));
    assert.equal(resumed.messages.find(m => m.snapshot).currentTime, 42);
    assert.equal(resumed.messages.find(m => m.snapshot).action, "pause");
    tab.socket.send(JSON.stringify({ type: "ping", sentAt: 123 }));
    await until(() => tab.messages.some(m => m.type === "pong" && m.sentAt === 123));
});

test("desktop room client reconnects automatically after a dropped socket", async t => {
    const relay = await createRelayServer();
    const client = new RoomClient();
    const statuses = [], messages = [];
    client.on("status", status => statuses.push(status));
    client.on("message", message => messages.push(message));
    t.after(async () => { client.close(); await relay.close(); });
    client.connect({ serverUrl: `ws://127.0.0.1:${relay.port}`, roomId: "recover-room", profile: { id: "viewer" } });
    await until(() => messages.some(m => m.type === "joined"));
    for (const socket of relay.wss.clients) socket.terminate();
    await until(() => messages.filter(m => m.type === "joined").length === 2);
    assert.ok(statuses.includes("reconnecting"));
    assert.equal(statuses.at(-1), "connected");
});

test("controller owns helpers, saves profile and cleans up after a failed tunnel", async t => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "symbiance-test-"));
    class FakeTunnel extends EventEmitter {
        async start() { return "wss://room.trycloudflare.com"; }
        stop() { this.stopped = true; }
    }
    let tunnel;
    const controller = new Controller({ directory, tunnelFactory: () => (tunnel = new FakeTunnel()) });
    t.after(async () => { await controller.leaveRoom(); await fs.rm(directory, { recursive: true, force: true }); });
    await controller.initialize();
    await controller.saveProfile({ name: "Alice", color: "#e05e72" });
    await controller.makeRoom("Friday");
    const relay = controller.relay;
    assert.equal(decodeInvite(controller.state.room.invite).name, "Friday");
    await until(() => controller.state.connection === "connected");
    await controller.leaveRoom();
    assert.ok(tunnel.stopped);
    assert.equal(relay.server.listening, false);
    const restored = new Controller({ directory });
    await restored.initialize();
    assert.equal(restored.state.profile.name, "Alice");
    assert.equal(restored.state.profile.id, controller.state.profile.id);
    controller.tunnelFactory = () => ({ async start() { throw new Error("offline"); }, stop() {} });
    await assert.rejects(controller.makeRoom("Failed"), /offline/);
    assert.equal(controller.relay, null);
    assert.equal(controller.state.busy, false);
});

test("native bridge uses authenticated loopback and framed messages without Node installed", async t => {
    const appData = await fs.mkdtemp(path.join(os.tmpdir(), "symbiance-native-"));
    const directory = path.join(appData, "Symbiance");
    await fs.mkdir(directory);
    const config = { roomId: "private-native", serverUrl: "wss://example.com" };
    const connector = await createConnector(directory, () => config, () => {});
    const executable = path.join(__dirname, "..", "assets", process.platform, "native", helperNames().native);
    const binaryExists = await fs.access(executable).then(() => true, () => false);
    const child = spawn(binaryExists ? executable : process.execPath,
        binaryExists ? [] : [path.join(__dirname, "..", "desktop", "native-host.js")],
        { env: { ...process.env, APPDATA: appData, XDG_CONFIG_HOME: appData, PATH: binaryExists ? "" : process.env.PATH }, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    t.after(async () => { child.stdin.end(); await once(child, "exit"); await connector.close(); await fs.rm(appData, { recursive: true, force: true }); });
    let input = Buffer.alloc(0);
    const messages = [];
    child.stdout.on("data", chunk => {
        input = Buffer.concat([input, chunk]);
        while (input.length >= 4 && input.length >= input.readUInt32LE(0) + 4) {
            const length = input.readUInt32LE(0);
            messages.push(JSON.parse(input.subarray(4, length + 4)));
            input = input.subarray(length + 4);
        }
    });
    await until(() => messages.some(m => m.type === "configuration"));
    assert.deepEqual(messages.find(m => m.type === "configuration").configuration, config);
    const body = Buffer.from(JSON.stringify({ type: "ping" }));
    const frame = Buffer.alloc(body.length + 4);
    frame.writeUInt32LE(body.length); body.copy(frame, 4);
    child.stdin.write(frame.subarray(0, 2)); child.stdin.write(frame.subarray(2));
    await until(() => messages.some(m => m.type === "pong"));
    const saved = JSON.parse(await fs.readFile(path.join(directory, "connector.json")));
    const unauthorized = new WebSocket(`ws://127.0.0.1:${saved.port}`);
    unauthorized.on("error", () => {});
    await once(unauthorized, "close").catch(() => {});
    assert.equal(unauthorized.readyState, WebSocket.CLOSED);
});
