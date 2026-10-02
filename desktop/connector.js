const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const { WebSocket, WebSocketServer } = require("ws");

async function createConnector(directory, getConfiguration, onStatus) {
    const token = randomBytes(32).toString("hex");
    const server = http.createServer((request, response) => { response.writeHead(404); response.end(); });
    const wss = new WebSocketServer({ noServer: true, maxPayload: 16384 });
    server.on("upgrade", (request, socket, head) => {
        if (request.headers.authorization !== `Bearer ${token}` || request.headers.origin) return socket.destroy();
        wss.handleUpgrade(request, socket, head, client => wss.emit("connection", client));
    });
    const send = (client, value) => {
        if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(value));
    };
    wss.on("connection", client => {
        send(client, { type: "configuration", configuration: getConfiguration() });
        onStatus(wss.clients.size);
        client.on("close", () => onStatus(wss.clients.size));
        client.on("error", () => {});
        client.on("message", raw => {
            try {
                const message = JSON.parse(raw.toString());
                if (message.type === "ping") send(client, { type: "pong" });
            } catch {}
        });
    });
    await fs.mkdir(directory, { recursive: true });
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });
    const configFile = path.join(directory, "connector.json");
    await fs.writeFile(configFile, JSON.stringify({ port: server.address().port, token }), { mode: 0o600 });
    return {
        broadcast() { for (const client of wss.clients) send(client, { type: "configuration", configuration: getConfiguration() }); },
        async close() {
            for (const client of wss.clients) client.terminate();
            await new Promise(resolve => wss.close(resolve));
            await new Promise(resolve => server.close(resolve));
            await fs.rm(configFile, { force: true });
        }
    };
}
module.exports = { createConnector };
