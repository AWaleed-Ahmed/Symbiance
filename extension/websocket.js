/**
 * websocket.js
 *
 * Handles the WebSocket connection between the Symbiance
 * browser extension and the Symbiance backend.
 */

let socket = null;

/**
 * Connect to the Symbiance WebSocket server.
 */
function connectWebSocket() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        console.log("Symbiance: WebSocket already connected.");
        return;
    }

    console.log("Symbiance: Connecting to WebSocket server...");

    let topLocation = "cross-origin/unavailable";
    try {
        topLocation = window.top.location.href;
    } catch (e) {
        // cross-origin frame restriction
    }
    
    let frameElement = "cross-origin/unavailable";
    try {
        frameElement = window.frameElement;
    } catch (e) {
        // cross-origin frame restriction
    }

    console.log("=== WS CONNECTION DIAGNOSTICS ===");
    console.log("Timestamp:", Date.now());
    console.log("window.location.href:", window.location.href);
    console.log("window === window.top:", window === window.top);
    console.log("window.top === window.self:", window.top === window.self);
    console.log("window.parent === window:", window.parent === window);
    console.log("window.frameElement:", frameElement);
    console.log("window.top.location.href:", topLocation);
    console.log("=================================");

    socket = new WebSocket("ws://localhost:8080");

    socket.addEventListener("open", () => {
        console.log("Symbiance: WebSocket connected.");
    });

    socket.addEventListener("message", (event) => {
        console.log("Symbiance: Server message:", event.data);
    });

    socket.addEventListener("close", () => {
        console.log("Symbiance: WebSocket disconnected.");
    });

    socket.addEventListener("error", (error) => {
        console.error("Symbiance: WebSocket error:", error);
    });
}
/**
 * Safely checks if the current context is the top-level window.
 * Accessing window.top can throw if cross-origin frame rules apply,
 * which implies we are not the top window.
 */
function isTopWindow() {
    try {
        return window === window.top;
    } catch (e) {
        return false;
    }
}

// Only establish the WebSocket connection if we are in the main page.
if (isTopWindow()) {
    connectWebSocket();
}