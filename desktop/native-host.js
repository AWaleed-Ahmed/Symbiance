const fs = require("node:fs");
const path = require("node:path");
const { WebSocket } = require("ws");

let input = Buffer.alloc(0);
let socket;
let retry;
let stopped = false;
function send(message) {
    const body = Buffer.from(JSON.stringify(message));
    const header = Buffer.alloc(4);
    header.writeUInt32LE(body.length);
    process.stdout.write(Buffer.concat([header, body]));
}
function connect() {
    if (stopped) return;
    let configuration;
    try {
        configuration = JSON.parse(fs.readFileSync(path.join(process.env.APPDATA, "Symbiance", "connector.json"), "utf8"));
        if (!Number.isInteger(configuration.port) || configuration.port < 1 || configuration.port > 65535 ||
            !/^[a-f0-9]{64}$/.test(configuration.token)) throw new Error();
    } catch {
        send({ type: "desktopStatus", connected: false });
        retry = setTimeout(connect, 3000);
        return;
    }
    socket = new WebSocket(`ws://127.0.0.1:${configuration.port}`, {
        headers: { Authorization: `Bearer ${configuration.token}` }, maxPayload: 16384
    });
    socket.on("open", () => send({ type: "desktopStatus", connected: true }));
    socket.on("message", raw => { try { send(JSON.parse(raw.toString())); } catch {} });
    socket.on("error", () => {});
    socket.on("close", () => { if (!stopped) { send({ type: "desktopStatus", connected: false }); retry = setTimeout(connect, 3000); } });
}
process.stdin.on("data", chunk => {
    input = Buffer.concat([input, chunk]);
    while (input.length >= 4) {
        const length = input.readUInt32LE(0);
        if (length > 1048576) return process.exit(1);
        if (input.length < length + 4) break;
        let message;
        try { message = JSON.parse(input.subarray(4, length + 4).toString()); } catch { return process.exit(1); }
        input = input.subarray(length + 4);
        if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
    }
});
process.stdin.on("end", () => { stopped = true; clearTimeout(retry); if (socket) socket.terminate(); });
connect();
