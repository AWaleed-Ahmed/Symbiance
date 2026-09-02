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
        "ws://localhost:8080"
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
        // FUTURE MESSAGES
        //
        // play
        // pause
        // seek
        // chat
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
}