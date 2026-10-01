/** Routes tab messages through the extension background connection. */
let connectionPort = null;
let joinedRoom = false;

function isTopWindow() {
    return window === window.top;
}

function sendWebSocketMessage(message) {
    if (!connectionPort || !joinedRoom) {
        console.warn("Symbiance: Not connected to the sync room yet.");
        return false;
    }
    connectionPort.postMessage(message);
    return true;
}

function sendPlaybackMessage(action, currentTime, sentAt) {
    return sendWebSocketMessage({
        type: "playback", action, currentTime, sentAt: sentAt || Date.now()
    });
}

function connectWebSocket() {
    const extensionAPI = typeof browser !== "undefined" ? browser : chrome;
    connectionPort = extensionAPI.runtime.connect({ name: "symbiance" });
    connectionPort.onMessage.addListener((message) => {
        if (message.type === "joined") {
            joinedRoom = true;
            console.log("Symbiance: Joined room", message.roomId, "Clients:", message.clientCount);
            sendWebSocketMessage({ type: "identity", identity: getContentIdentity() });
        } else if (message.type === "localPlayback") {
            sendPlaybackMessage(message.action, message.currentTime, message.sentAt);
        } else if (message.type === "playback") {
            handleRemotePlayback({ ...message, source: "symbiance" });
        } else if (message.type === "identity") {
            console.log("Symbiance: Content match result:",
                matchContentIdentity(getContentIdentity(), message.identity));
        } else if (message.type === "error") {
            console.error("Symbiance:", message.message);
        }
    });
    connectionPort.onDisconnect.addListener(() => {
        connectionPort = null;
        joinedRoom = false;
        console.warn("Symbiance: Extension connection lost. Reload this tab.");
    });
}

if (isTopWindow()) {
    connectWebSocket();
}
