const { EventEmitter } = require("node:events");
const { WebSocket } = require("ws");

class RoomClient extends EventEmitter {
    constructor({ heartbeatMs = 15000, retryMs = 1000 } = {}) {
        super();
        this.heartbeatMs = heartbeatMs;
        this.retryMs = retryMs;
        this.generation = 0;
    }
    connect(config) {
        this.close();
        this.config = config;
        this.stopped = false;
        this.attempt = 0;
        this.open(this.generation);
    }
    open(generation) {
        if (this.stopped || generation !== this.generation) return;
        this.emit("status", this.attempt ? "reconnecting" : "connecting");
        const socket = new WebSocket(this.config.serverUrl, { handshakeTimeout: 10000, maxPayload: 65536 });
        this.socket = socket;
        let lastPong = Date.now();
        let heartbeat;
        socket.on("open", () => {
            if (generation !== this.generation) return socket.close();
            socket.send(JSON.stringify({ type: "join", roomId: this.config.roomId, profile: this.config.profile }));
            heartbeat = setInterval(() => {
                if (Date.now() - lastPong > this.heartbeatMs * 3) return socket.terminate();
                if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "ping", sentAt: Date.now() }));
            }, this.heartbeatMs);
            heartbeat.unref();
        });
        socket.on("message", raw => {
            if (generation !== this.generation) return;
            let message;
            try { message = JSON.parse(raw.toString()); } catch { return; }
            if (message.type === "pong") { lastPong = Date.now(); return; }
            if (message.type === "joined") {
                this.attempt = 0;
                this.emit("status", "connected");
            }
            this.emit("message", message);
        });
        socket.on("error", error => this.emit("diagnostic", error.message));
        socket.on("close", () => {
            clearInterval(heartbeat);
            if (this.stopped || generation !== this.generation) return;
            this.emit("status", "reconnecting");
            this.retry = setTimeout(() => this.open(generation), Math.min(10000, this.retryMs * 2 ** this.attempt++));
        });
    }
    send(message) {
        if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
    }
    close() {
        this.stopped = true;
        this.generation++;
        clearTimeout(this.retry);
        if (this.socket) this.socket.terminate();
        this.socket = null;
    }
}

module.exports = { RoomClient };
