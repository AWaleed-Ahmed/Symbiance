const extensionAPI = typeof browser !== "undefined" ? browser : chrome;
const tabConnections = new Map();
const activeConnections = new Set();
const defaultSettings = {
    serverUrl: "wss://127.0.0.1:8080",
    roomId: "test-room"
};

function validSettings(settings) {
    try {
        const url = new URL(settings.serverUrl);
        return url.protocol === "wss:" && !url.username && !url.password &&
            /^[A-Za-z0-9-]{6,64}$/.test(settings.roomId) &&
            (url.hostname === "127.0.0.1" || url.hostname === "localhost" ||
                settings.roomId !== "test-room");
    } catch (error) {
        return false;
    }
}

extensionAPI.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.serverUrl || changes.roomId || changes.profile || changes.desktopPaused)) {
        for (const reload of activeConnections) reload();
    }
});

extensionAPI.runtime.onMessage.addListener((message, sender) => {
    if (!["localPlayback", "requestPlayback"].includes(message?.type) || sender.tab?.id == null) return;
    const port = tabConnections.get(sender.tab.id);
    if (port) port.postMessage(message);
});

// Each tab needs its own server client so the server can relay between tabs.
extensionAPI.runtime.onConnect.addListener((port) => {
    if (port.name !== "symbiance") return;

    const tabId = port.sender.tab?.id;
    if (tabId != null) tabConnections.set(tabId, port);

    let socket;
    let retryTimer;
    let disconnected = false;
    let settings = defaultSettings;
    let heartbeat;
    let lastPong = 0;
    let settingsRevision = 0;

    function connect() {
        if (disconnected) return;
        const current = new WebSocket(settings.serverUrl);
        socket = current;
        current.addEventListener("open", () => {
            if (socket !== current || disconnected) return current.close();
            lastPong = Date.now();
            current.send(JSON.stringify({ type: "join", roomId: settings.roomId, profile: settings.profile }));
            heartbeat = setInterval(() => {
                if (Date.now() - lastPong > 45000) return current.close();
                if (current.readyState === WebSocket.OPEN) current.send(JSON.stringify({ type: "ping", sentAt: Date.now() }));
            }, 15000);
        });
        current.addEventListener("message", (event) => {
            if (disconnected || socket !== current) return;
            try {
                const message = JSON.parse(event.data);
                if (message.type === "pong") { lastPong = Date.now(); return; }
                port.postMessage(message);
            } catch (error) {
                console.warn("Symbiance: Could not deliver server message", error);
            }
        });
        current.addEventListener("error", () => {
            console.warn("Symbiance: Cannot reach " + settings.serverUrl);
        });
        current.addEventListener("close", () => {
            if (socket !== current) return;
            clearInterval(heartbeat);
            if (!disconnected) {
                port.postMessage({ type: "connectionStatus", connected: false });
                retryTimer = setTimeout(connect, 2000);
            }
        });
    }

    async function reload() {
        const revision = ++settingsRevision;
        try {
            const saved = await extensionAPI.storage.local.get({ ...defaultSettings, profile: null, desktopPaused: false });
            if (disconnected || revision !== settingsRevision) return;
            clearTimeout(retryTimer);
            clearInterval(heartbeat);
            const previous = socket;
            socket = null;
            if (previous) previous.close();
            port.postMessage({ type: "connectionStatus", connected: false });
            if (saved.desktopPaused) return;
            if (!validSettings(saved)) {
                console.warn("Symbiance: Configure a secure server and private room in the extension popup.");
                return;
            }
            settings = saved;
            connect();
        } catch (error) {
            console.error("Symbiance: Could not load connection settings", error);
        }
    }

    port.onMessage.addListener((message) => {
        if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
    });
    port.onDisconnect.addListener(() => {
        disconnected = true;
        activeConnections.delete(reload);
        clearTimeout(retryTimer);
        clearInterval(heartbeat);
        if (socket) socket.close();
        if (tabConnections.get(tabId) === port) tabConnections.delete(tabId);
    });
    activeConnections.add(reload);
    reload();
});

// The native connection keeps the background active and receives desktop room settings.
if (extensionAPI.runtime.connectNative) {
    let nativePort;
    let nativeRetry;
    let nativeHeartbeat;
    function connectDesktop() {
        try {
            const current = extensionAPI.runtime.connectNative("com.symbiance.bridge");
            nativePort = current;
            current.onMessage.addListener(async message => {
                if (nativePort !== current) return;
                if (message.type === "configuration") {
                    const configuration = message.configuration;
                    if (configuration && validSettings(configuration)) {
                        await extensionAPI.storage.local.set({ ...configuration, desktopPaused: false, desktopConnected: true });
                    } else if (configuration === null) {
                        await extensionAPI.storage.local.set({ desktopPaused: true, desktopConnected: true });
                    }
                } else if (message.type === "desktopStatus") {
                    await extensionAPI.storage.local.set({ desktopConnected: message.connected });
                }
            });
            current.onDisconnect.addListener(() => {
                if (nativePort !== current) return;
                void extensionAPI.runtime.lastError;
                nativePort = null;
                clearInterval(nativeHeartbeat);
                extensionAPI.storage.local.set({ desktopConnected: false });
                nativeRetry = setTimeout(connectDesktop, 5000);
            });
            nativeHeartbeat = setInterval(() => current.postMessage({ type: "ping" }), 15000);
        } catch { clearTimeout(nativeRetry); nativeRetry = setTimeout(connectDesktop, 5000); }
    }
    connectDesktop();
}
