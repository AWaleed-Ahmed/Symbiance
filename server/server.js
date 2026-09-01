/**
 * FestiveWatch WebSocket Server
 * 
 * This is the initial WebSocket server for the FestiveWatch project.
 * It currently acts as a basic server to verify that extension clients 
 * can successfully connect and send messages. It does not broadcast yet.
 */

const { WebSocketServer } = require('ws');

// Create a new WebSocket server listening on port 8080
const wss = new WebSocketServer({ port: 8080 });

console.log('FestiveWatch: WebSocket server started on ws://localhost:8080');

// Listen for incoming client connections
wss.on('connection', function connection(ws) {
    console.log('FestiveWatch: Client connected');

    // Send a welcome message to the newly connected client
    ws.send('FestiveWatch: Connected to server');

    // Listen for messages sent by the client
    ws.on('message', function incoming(message) {
        console.log('FestiveWatch: Received message:', message.toString());
    });

    // Listen for client disconnections
    ws.on('close', function close() {
        console.log('FestiveWatch: Client disconnected');
    });

    // Handle client-level WebSocket errors
    ws.on('error', function error(err) {
        console.error('FestiveWatch: WebSocket client error:', err);
    });
});

// Handle server-level WebSocket errors
wss.on('error', function error(err) {
    console.error('FestiveWatch: WebSocket server error:', err);
});
