/**
 * websocket.js
 *
 * Handles the WebSocket connection between the Symbiance
 * browser extension and the Symbiance backend.
 */

let socket = null;


/**
 * Sends a message to the WebSocket server if connected.
 *
 * @param {Object} message
 */
function sendWebSocketMessage(message) {

    if (
        !socket ||
        socket.readyState !== WebSocket.OPEN
    ) {

        console.warn(
            "Symbiance: Cannot send message. WebSocket is not connected."
        );

        return false;
    }

    socket.send(
        JSON.stringify(message)
    );

    return true;
}


/**
 * Sends the current page's content identity to the room.
 */
function sendContentIdentity() {

    // getContentIdentity() is defined in content.js.
    if (typeof getContentIdentity !== "function") {

        console.error(
            "Symbiance: getContentIdentity() is not available."
        );

        return;
    }

    const identity = getContentIdentity();

    console.log(
        "Symbiance: Sending content identity:",
        identity
    );

    sendWebSocketMessage({

        type: "identity",

        identity
    });
}


/**
 * Sends a playback synchronization message to the room.
 *
 * @param {string} action - "play", "pause", or "seek"
 * @param {number} currentTime - The current playback time of the video
 * @param {number} sentAt - The timestamp when the event originated
 */
function sendPlaybackMessage(action, currentTime, sentAt) {
    
    console.log("Symbiance (Diagnostics): sendPlaybackMessage called. socket exists:", !!socket, "readyState:", socket ? socket.readyState : "N/A");

    // Verify the WebSocket exists and is open
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.warn("Symbiance (Diagnostics): sendPlaybackMessage aborted because WebSocket is not open.");
        return;
    }

    const message = {
        type: "playback",
        action: action,
        currentTime: currentTime,
        sentAt: sentAt || Date.now()
    };

    console.log(
        "Symbiance: Sending playback message:", 
        message
    );

    sendWebSocketMessage(message);
}


/**
 * Handles an identity received from another client.
 *
 * @param {Object} remoteIdentity
 */
function handleRemoteIdentity(remoteIdentity) {

    // Make sure the required functions exist.
    if (typeof getContentIdentity !== "function") {

        console.error(
            "Symbiance: getContentIdentity() is not available."
        );

        return;
    }

    if (typeof matchContentIdentity !== "function") {

        console.error(
            "Symbiance: matchContentIdentity() is not available."
        );

        return;
    }


    const localIdentity = getContentIdentity();


    console.log(
        "Symbiance: Local content identity:",
        localIdentity
    );

    console.log(
        "Symbiance: Remote content identity:",
        remoteIdentity
    );


    const result = matchContentIdentity(
        localIdentity,
        remoteIdentity
    );


    console.log(
        "Symbiance: Content match result:",
        result
    );


    // For now, we only log the result.
    //
    // Later:
    //
    // strong    -> enable synchronization
    // partial   -> show warning / wait
    // uncertain -> do not synchronize
    // mismatch  -> block synchronization
}


/**
 * Connect to the Symbiance WebSocket server.
 */
function connectWebSocket() {

    if (
        socket &&
        (
            socket.readyState === WebSocket.OPEN ||
            socket.readyState === WebSocket.CONNECTING
        )
    ) {

        console.log(
            "Symbiance: WebSocket already connected or connecting."
        );

        return;
    }


    console.log(
        "Symbiance: Connecting to WebSocket server..."
    );


socket = new WebSocket(
    "wss://nato-hope-programmes-ones.trycloudflare.com"
);

    /**
     * Fired when the connection to the server is established.
     */
    socket.addEventListener("open", () => {

        console.log(
            "Symbiance: WebSocket connected."
        );


        const joinMessage = {

            type: "join",

            roomId: "test-room"
        };


        sendWebSocketMessage(
            joinMessage
        );


        console.log(
            `Symbiance: Joining room "${joinMessage.roomId}"`
        );
    });


    /**
     * Fired when a message is received from the server.
     */
    socket.addEventListener("message", (event) => {

        let message;

        try {

            message = JSON.parse(
                event.data
            );

        } catch (error) {

            console.log(
                "Symbiance: Received non-JSON server message:",
                event.data
            );

            return;
        }


        console.log(
            "Symbiance: Received server message:",
            message
        );


        // ==================================================
        // JOIN CONFIRMATION
        // ==================================================

        if (message.type === "joined") {

            console.log(
                `Symbiance: Successfully joined room "${message.roomId}". ` +
                `Clients in room: ${message.clientCount}`
            );


            // We only send our identity AFTER the server confirms
            // that we have joined the room.
            sendContentIdentity();

            return;
        }


        // ==================================================
        // REMOTE CONTENT IDENTITY
        // ==================================================

        if (message.type === "identity") {

            console.log(
                "Symbiance: Received remote content identity."
            );


            handleRemoteIdentity(
                message.identity
            );

            return;
        }


        // ==================================================
        // SERVER ERROR
        // ==================================================

        if (message.type === "error") {

            console.error(
                "Symbiance: Server error:",
                message.message
            );

            return;
        }


        // ==================================================
        // PLAYBACK SYNCHRONIZATION
        // 
        // Message Format:
        // {
        //     type: "playback",
        //     action: "play" | "pause" | "seek",
        //     currentTime: <number>
        // }
        // ==================================================

        if (message.type === "playback") {
            const endToEndLatency = Date.now() - message.sentAt;

            console.log(
                "Symbiance (Diagnostics): End-to-end playback latency:",
                endToEndLatency,
                "ms"
            );
            
            // Forward the remote command down to child iframes
            const payload = {
                source: "symbiance",
                type: "playback",
                action: message.action,
                currentTime: message.currentTime,
                sentAt: message.sentAt
            };

            for (let i = 0; i < window.frames.length; i++) {
                window.frames[i].postMessage(payload, "*");
            }

            // Note: Remote playback behavior is intentionally NOT implemented yet.
            // Future step: handleRemotePlayback(message.action, message.currentTime);
            return;
        }

        // ==================================================
        // OTHER UNHANDLED MESSAGES (e.g. chat)
        // ==================================================

        console.log(
            "Symbiance: Unhandled server message:",
            message
        );
    });


    /**
     * Fired when the WebSocket connection closes.
     */
    socket.addEventListener("close", () => {

        console.log(
            "Symbiance: WebSocket disconnected."
        );

        socket = null;
    });


    /**
     * Fired when a WebSocket error occurs.
     */
    socket.addEventListener("error", (error) => {

        console.error(
            "Symbiance: WebSocket error:",
            error
        );
    });
}


/**
 * Safely checks if the current context is the top-level window.
 *
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


/**
 * Only establish the WebSocket connection if we are in the main page.
 */
if (isTopWindow()) {

    connectWebSocket();

    // Listen for postMessage events from the child video iframes
    window.addEventListener("message", (event) => {

        // SECURITY: Verify the message came from a child frame of this window.
        // We do not accept messages from unrelated windows or from ourselves.
        try {
            if (!event.source || event.source === window || event.source.top !== window) {
                return;
            }
        } catch (e) {
            // If checking event.source.top throws, it's not our child frame.
            return;
        }

        const data = event.data;
        
        // Validate payload shape
        if (!data || typeof data !== "object") {
            return;
        }

        if (data.source !== "symbiance" || data.type !== "playback") {
            return;
        }

        const action = data.action;
        const currentTime = data.currentTime;
        const sentAt = data.sentAt;

        // Validate action type and currentTime
        if (
            (action === "play" || action === "pause" || action === "seek") &&
            typeof currentTime === "number"
        ) {
            console.log(
                "Symbiance: Top window received playback event from iframe, forwarding to WebSocket:",
                data
            );

            // Forward to the WebSocket server using the existing sender function
            sendPlaybackMessage(action, currentTime, sentAt);
        }
    });
}