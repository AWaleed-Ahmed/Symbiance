let connectionPort = null;
let joinedRoom = false;
let reconnectTimer = null;

function isTopWindow() {
    return window === window.top;
}

function sendWebSocketMessage(message) {
    if (!connectionPort || !joinedRoom) {
        console.warn("Symbiance: Not connected to the sync room yet.");
        return false;
    }
    try { connectionPort.postMessage(message); }
    catch { joinedRoom = false; return false; }
    return true;
}

function sendPlaybackMessage(action, currentTime, sentAt) {
    return sendWebSocketMessage({
        type: "playback", action, currentTime, sentAt: sentAt || Date.now()
    });
}

function connectWebSocket() {
    const extensionAPI = typeof browser !== "undefined" ? browser : chrome;
    clearTimeout(reconnectTimer);
    let current;
    try { current = extensionAPI.runtime.connect({ name: "symbiance" }); }
    catch { reconnectTimer = setTimeout(connectWebSocket, 2000); return; }
    connectionPort = current;
    joinedRoom = false;
    current.onMessage.addListener((message) => {
        if (connectionPort !== current) return;
        if (message.type === "joined") {
            joinedRoom = true;
            console.log("Symbiance: Joined room", message.roomId, "Clients:", message.clientCount);
            sendWebSocketMessage({ type: "identity", identity: getContentIdentity() });
        } else if (message.type === "localPlayback") {
            sendPlaybackMessage(message.action, message.currentTime, message.sentAt);
        } else if (message.type === "requestPlayback") {
            sendWebSocketMessage({ type: "snapshot" });
        } else if (message.type === "playback") {
            handleRemotePlayback({ ...message, source: "symbiance" });
        } else if (message.type === "identity") {
            console.log("Symbiance: Content match result:",
                matchContentIdentity(getContentIdentity(), message.identity));
        } else if (message.type === "error") {
            console.error("Symbiance:", message.message);
        } else if (message.type === "connectionStatus" && !message.connected) {
            joinedRoom = false;
        }
    });
    current.onDisconnect.addListener(() => {
        if (connectionPort !== current) return;
        void extensionAPI.runtime.lastError;
        connectionPort = null;
        joinedRoom = false;
        reconnectTimer = setTimeout(connectWebSocket, 1000);
    });
}

if (isTopWindow()) {
    connectWebSocket();
    window.addEventListener("pagehide", () => {
        clearTimeout(reconnectTimer);
        const current = connectionPort;
        connectionPort = null;
        if (current?.disconnect) current.disconnect();
    });
    window.addEventListener("pageshow", () => { if (!connectionPort) connectWebSocket(); });
}
