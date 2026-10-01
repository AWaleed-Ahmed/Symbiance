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
    if (area === "local" && (changes.serverUrl || changes.roomId)) {
        for (const reload of activeConnections) reload();
    }
});

extensionAPI.runtime.onMessage.addListener((message, sender) => {
    if (message?.type !== "localPlayback" || sender.tab?.id == null) return;
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

    function connect() {
        if (disconnected) return;
        const current = new WebSocket(settings.serverUrl);
        socket = current;
        current.addEventListener("open", () => {
            current.send(JSON.stringify({ type: "join", roomId: settings.roomId }));
        });
        current.addEventListener("message", (event) => {
            if (disconnected) return;
            try {
                port.postMessage(JSON.parse(event.data));
            } catch (error) {
                console.warn("Symbiance: Could not deliver server message", error);
            }
        });
        current.addEventListener("error", () => {
            console.warn("Symbiance: Cannot reach " + settings.serverUrl);
        });
        current.addEventListener("close", () => {
            if (!disconnected && socket === current) retryTimer = setTimeout(connect, 2000);
        });
    }

    async function reload() {
        try {
            const saved = await extensionAPI.storage.local.get(defaultSettings);
            if (disconnected) return;
            clearTimeout(retryTimer);
            const previous = socket;
            socket = null;
            if (previous) previous.close();
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
        if (socket) socket.close();
        if (tabConnections.get(tabId) === port) tabConnections.delete(tabId);
    });
    activeConnections.add(reload);
    reload();
});
