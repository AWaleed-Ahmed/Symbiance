const http = require("node:http");
const https = require("node:https");
const { randomUUID } = require("node:crypto");
const { WebSocket, WebSocketServer } = require("ws");

const actions = new Set(["play", "pause", "seek"]);
function validPlayback(message) {
    return message && actions.has(message.action) &&
        Number.isFinite(message.currentTime) && message.currentTime >= 0;
}

async function createRelayServer({ port = 0, host = "127.0.0.1", tls, heartbeatMs = 15000 } = {}) {
    const handler = (request, response) => {
        response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
        response.end("Symbiance server is ready.\n");
    };
    const server = tls ? https.createServer(tls, handler) : http.createServer(handler);
    const wss = new WebSocketServer({ server, maxPayload: 16384 });
    const rooms = new Map();
    const send = (socket, message) => {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
    };
    const broadcast = (room, message, except) => {
        for (const socket of room.clients) if (socket !== except) send(socket, message);
    };
    function presence(room) {
        const members = new Map();
        for (const socket of room.clients) members.set(socket.profile.id, socket.profile);
        broadcast(room, { type: "members", members: [...members.values()] });
    }
    function leave(socket) {
        const room = rooms.get(socket.roomId);
        socket.roomId = null;
        if (!room) return;
        room.clients.delete(socket);
        if (!room.clients.size) rooms.delete(room.id);
        else presence(room);
    }
    wss.on("connection", socket => {
        socket.alive = true;
        socket.on("pong", () => { socket.alive = true; });
        socket.on("error", () => {});
        socket.on("close", () => leave(socket));
        socket.on("message", raw => {
            let message;
            try { message = JSON.parse(raw.toString()); } catch { return; }
            if (!message || typeof message !== "object") return;
            if (message.type === "ping") {
                send(socket, { type: "pong", sentAt: message.sentAt });
                return;
            }
            if (message.type === "join") {
                if (typeof message.roomId !== "string" || !/^[A-Za-z0-9-]{6,128}$/.test(message.roomId)) {
                    send(socket, { type: "error", message: "Invalid room code" });
                    return;
                }
                leave(socket);
                socket.profile = {
                    id: typeof message.profile?.id === "string" ? message.profile.id.slice(0, 64) : randomUUID(),
                    name: typeof message.profile?.name === "string" ? message.profile.name.trim().slice(0, 32) || "Viewer" : "Viewer",
                    color: /^#[a-f0-9]{6}$/i.test(message.profile?.color) ? message.profile.color : "#168078"
                };
                if (!rooms.has(message.roomId)) rooms.set(message.roomId, {
                    id: message.roomId, clients: new Set(), playback: null
                });
                const room = rooms.get(message.roomId);
                socket.roomId = room.id;
                room.clients.add(socket);
                send(socket, { type: "joined", roomId: room.id, clientCount: room.clients.size });
                for (const peer of room.clients) {
                    if (peer !== socket && peer.identity) send(socket, { type: "identity", identity: peer.identity });
                }
                if (room.playback) send(socket, {
                    type: "playback", ...room.playback, action: room.playback.paused ? "pause" : "play", snapshot: true
                });
                presence(room);
                return;
            }
            const room = rooms.get(socket.roomId);
            if (!room) return;
            if (message.type === "snapshot" && room.playback) {
                send(socket, { type: "playback", ...room.playback,
                    action: room.playback.paused ? "pause" : "play", snapshot: true });
                return;
            }
            if (message.type === "identity" && message.identity && typeof message.identity === "object") {
                socket.identity = message.identity;
                broadcast(room, { type: "identity", identity: message.identity }, socket);
            } else if (message.type === "playback" && validPlayback(message)) {
                const sentAt = Number.isFinite(message.sentAt) && Math.abs(Date.now() - message.sentAt) < 60000
                    ? message.sentAt : Date.now();
                room.playback = {
                    currentTime: message.currentTime, sentAt,
                    paused: message.action === "pause" || (message.action === "seek" && (room.playback?.paused ?? true))
                };
                broadcast(room, { type: "playback", action: message.action,
                    currentTime: message.currentTime, sentAt }, socket);
            }
        });
    });
    const heartbeat = setInterval(() => {
        for (const socket of wss.clients) {
            if (!socket.alive) socket.terminate();
            else { socket.alive = false; socket.ping(); }
        }
    }, heartbeatMs);
    heartbeat.unref();
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, resolve);
    });
    return { server, wss, rooms, port: server.address().port,
        async close() {
            clearInterval(heartbeat);
            for (const socket of wss.clients) socket.terminate();
            await new Promise(resolve => wss.close(resolve));
            await new Promise(resolve => server.close(resolve));
        }
    };
}

module.exports = { createRelayServer, validPlayback };
