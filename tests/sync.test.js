const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { once } = require("node:events");
const { WebSocket, WebSocketServer } = require("ws");

const source = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const quiet = { log() {}, warn() {}, error() {} };
function signal() {
    const listeners = [];
    return { addListener(fn) { listeners.push(fn); }, emit(...args) { listeners.forEach(fn => fn(...args)); } };
}
function makeTab(onConnect, nested = false, hasVideo = true, tabId = 1) {
    const events = {}, upward = [], downward = [];
    const video = {
        isConnected: true, currentTime: 0, paused: true,
        addEventListener(name, fn) { events[name] = fn; },
        play() { this.paused = false; events.play(); return Promise.resolve(); },
        pause() { this.paused = true; events.pause(); }
    };
    const incoming = signal(), outgoing = signal(), disconnect = signal();
    const port = { onMessage: incoming, onDisconnect: disconnect, postMessage: outgoing.emit };
    const window = { frames: [{ postMessage(data) { downward.push(data); } }], listeners: {},
        addEventListener(name, fn) { this.listeners[name] = fn; if (name === "message") this.listener = fn; } };
    window.top = nested ? { postMessage(data) { upward.push(data); } } : window;
    window.parent = window.top;
    const context = vm.createContext({ window, console: quiet, setTimeout, clearTimeout,
        document: { documentElement: {}, querySelector() { return hasVideo ? video : null; } },
        MutationObserver: class { observe() {} },
        getContentIdentity() { return {}; }, matchContentIdentity() { return {}; },
        browser: { runtime: { sendMessage(message) {
            onConnect.onMessage.emit(message, { tab: { id: tabId } });
        }, connect() {
            onConnect.emit({ name: "symbiance", sender: { tab: { id: tabId }, frameId: 0 },
                onMessage: outgoing, onDisconnect: disconnect, postMessage: incoming.emit });
            return port;
        } } }
    });
    vm.runInContext(source("extension/websocket.js"), context);
    vm.runInContext(source("extension/playback.js"), context);
    return { video, events, window, upward, downward, disconnect, incoming };
}

test("two tabs exchange playback through background WebSockets without echo", async () => {
    const server = new WebSocketServer({ port: 0 });
    await once(server, "listening");
    let playbackMessages = 0;
    server.on("connection", socket => socket.on("message", raw => {
        const message = JSON.parse(raw);
        if (message.type === "join") socket.send(JSON.stringify({ type: "joined", roomId: message.roomId }));
        if (message.type === "playback") {
            playbackMessages++;
            for (const client of server.clients) if (client !== socket) client.send(raw.toString());
        }
    }));
    const onConnect = signal();
    onConnect.onMessage = signal();
    onConnect.onChanged = signal();
    onConnect.settings = {};
    const connectedUrls = [];
    vm.runInNewContext(source("background.js"), {
        browser: { runtime: { onConnect, onMessage: onConnect.onMessage },
            storage: { local: { get(defaults) { return Promise.resolve({ ...defaults, ...onConnect.settings }); } },
                onChanged: onConnect.onChanged } },
        console: quiet, setTimeout, clearTimeout, setInterval, clearInterval, URL,
        WebSocket: class extends WebSocket {
            constructor(url) { super(`ws://localhost:${server.address().port}`); connectedUrls.push(url); }
        }
    });
    const a = makeTab(onConnect, false, true, 1), b = makeTab(onConnect, false, true, 2);
    async function until(predicate) {
        const deadline = Date.now() + 5000;
        while (!predicate()) {
            assert.ok(Date.now() < deadline, "timed out waiting for sync");
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }
    try {
        let joined = 0;
        [a, b].forEach(tab => tab.incoming.addListener(m => { if (m.type === "joined") joined++; }));
        await until(() => joined === 2);
        a.video.currentTime = 12;
        a.events.play();
        await until(() => !b.video.paused);
        assert.ok(b.video.currentTime >= 12);
        a.video.currentTime = 24;
        a.events.pause();
        await until(() => b.video.paused && b.video.currentTime === 24);
        a.video.currentTime = 37;
        a.events.seeking();
        await until(() => b.video.currentTime === 37);
        const embedded = makeTab(onConnect, true, true, 1);
        embedded.video.currentTime = 48;
        embedded.events.seeking();
        await until(() => b.video.currentTime === 48);
        await new Promise(resolve => setTimeout(resolve, 80));
        assert.equal(playbackMessages, 4);
        assert.equal(b.downward.length, 4);
        assert.equal(connectedUrls[0], "wss://127.0.0.1:8080");
        onConnect.settings = { serverUrl: "wss://example.test/watch", roomId: "private-123" };
        onConnect.onChanged.emit({ serverUrl: { newValue: onConnect.settings.serverUrl } }, "local");
        await until(() => connectedUrls.length === 4);
        await until(() => joined === 4);
        assert.deepEqual(connectedUrls.slice(2), [onConnect.settings.serverUrl, onConnect.settings.serverUrl]);
        a.video.currentTime = 58;
        a.events.seeking();
        await until(() => b.video.currentTime === 58);
        for (const client of server.clients) client.terminate();
        await until(() => connectedUrls.length === 6 && joined === 6);
        a.video.currentTime = 63;
        a.events.seeking();
        await until(() => b.video.currentTime === 63);
    } finally {
        a.window.listeners.pagehide(); b.window.listeners.pagehide();
        a.disconnect.emit(); b.disconnect.emit();
        for (const client of server.clients) client.terminate();
        await new Promise(resolve => server.close(resolve));
    }
});

test("nested players send upward and receive through video-less intermediate frames", () => {
    const onConnect = signal();
    onConnect.onMessage = signal();
    const sent = [];
    onConnect.onMessage.addListener(message => sent.push(message));
    const child = makeTab(onConnect, true);
    child.events.play();
    assert.equal(sent.find(message => message.type === "localPlayback").action, "play");
    const middle = makeTab(onConnect, true, false);
    const message = { source: "symbiance", type: "playback", action: "seek", currentTime: 33 };
    middle.window.listener({ source: middle.window.parent, data: message });
    assert.equal(middle.downward.length, 1);
    child.window.listener({ source: child.window.parent, data: middle.downward[0] });
    assert.equal(child.video.currentTime, 33);
    child.window.listener({ source: child.window.parent, data: { ...message, currentTime: -1 } });
    assert.equal(child.video.currentTime, 33);
});

test("popup accepts a trusted tunnel URL and creates a private room", async () => {
    const elements = Object.fromEntries(["settings", "serverUrl", "roomId", "status", "newRoom"]
        .map(id => [id, { value: "", textContent: "", listeners: {},
            classList: { toggle() {} }, addEventListener(name, fn) { this.listeners[name] = fn; } }]));
    let saved;
    vm.runInNewContext(source("popup/popup.js"), {
        document: { getElementById(id) { return elements[id]; } }, URL,
        crypto: { randomUUID() { return "private-room-123"; } },
        browser: { storage: { local: {
            get(defaults) { return Promise.resolve(defaults); },
            set(settings) { saved = settings; return Promise.resolve(); }
        } } }
    });
    await Promise.resolve();
    elements.serverUrl.value = "https://example.trycloudflare.com";
    await elements.settings.listeners.submit({ preventDefault() {} });
    assert.equal(saved.serverUrl, "wss://example.trycloudflare.com/");
    assert.equal(saved.roomId, "private-room-123");
    assert.match(elements.status.textContent, /Saved/);
});
