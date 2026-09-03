/**
 * Symbiance WebSocket Server
 *
 * Responsibilities:
 * - Accept WebSocket connections
 * - Allow clients to join rooms
 * - Track clients inside each room
 * - Store client content identities
 * - Share identities between room members
 * - Broadcast messages to other clients in the same room
 */

const { WebSocketServer, WebSocket } = require("ws");

const PORT = process.env.PORT || 8080;

const wss = new WebSocketServer({
    port: PORT
});


/**
 * Maps room IDs to room objects.
 *
 * Example:
 *
 * rooms = {
 *
 *   "test-room" => {
 *
 *       clients: Set(ws1, ws2),
 *
 *       identities: Map(
 *           ws1 => {...},
 *           ws2 => {...}
 *       )
 *   }
 * }
 */
const rooms = new Map();

console.log(
    "Symbiance: WebSocket server started on ws://localhost:8080"
);


/**
 * Removes a client from its current room.
 */
function leaveRoom(ws) {

    if (!ws.roomId) {
        return;
    }

    const room = rooms.get(ws.roomId);

    if (room) {

        room.clients.delete(ws);

        // Remove the client's stored identity as well.
        room.identities.delete(ws);

        // Delete the room when nobody remains.
        if (room.clients.size === 0) {

            rooms.delete(ws.roomId);

            console.log(
                `Symbiance: Room "${ws.roomId}" deleted`
            );
        }
    }

    console.log(
        `Symbiance: Client left room "${ws.roomId}"`
    );

    ws.roomId = null;
}


/**
 * Sends existing room identities to a newly joined client.
 */
function sendExistingIdentities(ws, room) {

    for (const [client, identity] of room.identities) {

        // Do not send a client's own identity back to them.
        if (client === ws) {
            continue;
        }

        if (ws.readyState === WebSocket.OPEN) {

            console.log("Symbiance: Sending existing identity to newly joined client");

            ws.send(JSON.stringify({
                type: "identity",
                identity
            }));
        }
    }
}


/**
 * Adds a client to a room.
 */
function joinRoom(ws, roomId) {

    // Leave any previous room first.
    leaveRoom(ws);


    // Create the room if it doesn't exist.
    if (!rooms.has(roomId)) {

        rooms.set(roomId, {

            clients: new Set(),

            identities: new Map()
        });

        console.log(
            `Symbiance: Room "${roomId}" created`
        );
    }


    const room = rooms.get(roomId);


    // Add client to the room.
    room.clients.add(ws);

    ws.roomId = roomId;


    console.log(
        `Symbiance: Client joined room "${roomId}". ` +
        `Clients in room: ${room.clients.size}`
    );


    // Confirm successful join.
    ws.send(JSON.stringify({

        type: "joined",

        roomId,

        clientCount: room.clients.size
    }));


    // Give the new client the identities of people
    // who were already in the room.
    sendExistingIdentities(ws, room);
}


/**
 * Stores a client's content identity.
 */
function storeIdentity(ws, identity) {

    if (!ws.roomId) {
        return;
    }

    const room = rooms.get(ws.roomId);

    if (!room) {
        return;
    }

    room.identities.set(ws, identity);

    console.log(
        `Symbiance: Stored content identity for client ` +
        `in room "${ws.roomId}"`
    );
}


/**
 * Broadcasts a message to every OTHER client
 * in the same room.
 */
function broadcastToRoom(sender, message) {

    if (!sender.roomId) {
        return;
    }

    const room = rooms.get(sender.roomId);

    if (!room) {
        return;
    }

    for (const client of room.clients) {

        // Don't send the message back to the sender.
        if (client === sender) {
            continue;
        }

        if (client.readyState === WebSocket.OPEN) {
            
            console.log("Symbiance: Broadcasting message to another client in room");

            client.send(
                JSON.stringify(message)
            );
        }
    }
}


/**
 * Handle WebSocket client connections.
 */
wss.on("connection", (ws) => {

    console.log(
        "Symbiance: Client connected"
    );

    ws.roomId = null;


    /**
     * Handle incoming client messages.
     */
    ws.on("message", (rawMessage) => {

        let message;

        try {

            message = JSON.parse(
                rawMessage.toString()
            );

        } catch (error) {

            console.error(
                "Symbiance: Received invalid JSON"
            );

            return;
        }


        console.log(
            "Symbiance: Received message:",
            message
        );


        // ==================================================
        // JOIN ROOM
        // ==================================================

        if (message.type === "join") {

            if (
                !message.roomId ||
                typeof message.roomId !== "string"
            ) {

                ws.send(JSON.stringify({

                    type: "error",

                    message: "Invalid room ID"
                }));

                return;
            }


            joinRoom(
                ws,
                message.roomId
            );

            return;
        }


        // ==================================================
        // CONTENT IDENTITY
        // ==================================================

        if (message.type === "identity") {

            if (!ws.roomId) {

                ws.send(JSON.stringify({

                    type: "error",

                    message:
                        "You must join a room before sending identity"
                }));

                return;
            }


            if (
                !message.identity ||
                typeof message.identity !== "object"
            ) {

                ws.send(JSON.stringify({

                    type: "error",

                    message: "Invalid content identity"
                }));

                return;
            }


            // Store this client's identity.
            storeIdentity(
                ws,
                message.identity
            );


            // Share identity with everyone else in the room.
            broadcastToRoom(
                ws,
                {
                    type: "identity",

                    identity: message.identity
                }
            );

            return;
        }


        // ==================================================
        // OTHER ROOM MESSAGES
        //
        // Later:
        //
        // play
        // pause
        // seek
        // chat
        // ==================================================

        if (ws.roomId) {

            broadcastToRoom(
                ws,
                message
            );

        } else {

            ws.send(JSON.stringify({

                type: "error",

                message:
                    "You must join a room first"
            }));
        }
    });


    /**
     * Handle client disconnection.
     */
    ws.on("close", () => {

        console.log(
            "Symbiance: Client disconnected"
        );

        leaveRoom(ws);
    });


    /**
     * Handle client errors.
     */
    ws.on("error", (error) => {

        console.error(
            "Symbiance: WebSocket client error:",
            error
        );
    });
});


/**
 * Handle server errors.
 */
wss.on("error", (error) => {

    console.error(
        "Symbiance: WebSocket server error:",
        error
    );
});