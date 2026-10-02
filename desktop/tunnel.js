const { EventEmitter } = require("node:events");
const { spawn } = require("node:child_process");

class Tunnel extends EventEmitter {
    constructor(binary) { super(); this.binary = binary; }
    start(port) {
        this.stop();
        this.stopping = false;
        return new Promise((resolve, reject) => {
            let settled = false;
            let checking = false;
            let output = "";
            const child = spawn(this.binary, ["tunnel", "--no-autoupdate", "--url", `http://127.0.0.1:${port}`],
                { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
            this.child = child;
            const timeout = setTimeout(() => {
                if (!settled) { settled = true; this.stop(); reject(new Error("The room address took too long to start. Check your internet connection.")); }
            }, 90000);
            const waitUntilReady = async address => {
                while (!settled && this.child === child) {
                    try {
                        const response = await fetch(address, { signal: AbortSignal.timeout(5000) });
                        if (response.ok && (await response.text()).includes("Symbiance server is ready")) {
                            if (settled || this.child !== child) return;
                            settled = true; clearTimeout(timeout); resolve(address.replace("https:", "wss:"));
                            return;
                        }
                    } catch {}
                    await new Promise(done => setTimeout(done, 2000));
                }
            };
            const read = chunk => {
                output = (output + chunk.toString()).slice(-12000);
                const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
                if (match && !settled && !checking) {
                    checking = true;
                    waitUntilReady(match[0]);
                }
            };
            child.stdout.on("data", read);
            child.stderr.on("data", read);
            child.once("error", () => {
                clearTimeout(timeout);
                if (!settled) { settled = true; reject(new Error("The bundled connection helper could not start.")); }
            });
            child.once("exit", () => {
                clearTimeout(timeout);
                if (!settled) { settled = true; reject(new Error("The connection helper stopped before the room was ready.")); }
                if (!this.stopping && this.child === child) this.emit("lost");
            });
        });
    }
    stop() { this.stopping = true; if (this.child) this.child.kill(); this.child = null; }
}
module.exports = { Tunnel };
