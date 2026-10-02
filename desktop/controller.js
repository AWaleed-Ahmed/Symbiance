const { EventEmitter } = require("node:events");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { createRelayServer } = require("../server/relay");
const { RoomClient } = require("./room-client");
const { Tunnel } = require("./tunnel");
const { encodeInvite, decodeInvite } = require("./invite");

class Controller extends EventEmitter {
    constructor({ directory, tunnelBinary, relayFactory = createRelayServer, tunnelFactory = binary => new Tunnel(binary) }) {
        super();
        this.directory = directory;
        this.tunnelBinary = tunnelBinary;
        this.relayFactory = relayFactory;
        this.tunnelFactory = tunnelFactory;
        this.client = new RoomClient();
        this.operation = 0;
        this.state = { profile: null, room: null, connection: "offline", members: [],
            extensionConnected: false, extensionSigned: false, busy: false, error: "" };
        this.client.on("status", connection => { this.state.connection = connection; this.update(); });
        this.client.on("message", message => {
            if (message.type === "members") { this.state.members = message.members; this.update(); }
        });
    }
    update() { this.emit("state", this.snapshot()); }
    snapshot() { return JSON.parse(JSON.stringify(this.state)); }
    configuration() {
        return this.state.room ? { serverUrl: this.state.room.serverUrl, roomId: this.state.room.roomId,
            profile: this.state.profile } : null;
    }
    async initialize() {
        await fs.mkdir(this.directory, { recursive: true });
        let saved;
        try { saved = JSON.parse(await fs.readFile(path.join(this.directory, "profile.json"), "utf8")); } catch {}
        this.state.profile = {
            id: typeof saved?.id === "string" && /^[a-f0-9-]{36}$/i.test(saved.id) ? saved.id : randomUUID(),
            name: typeof saved?.name === "string" && saved.name.trim() ? saved.name : "Viewer",
            color: /^#[a-f0-9]{6}$/i.test(saved?.color) ? saved.color : "#168078"
        };
        await this.saveProfile(this.state.profile);
    }
    async saveProfile(profile) {
        const name = String(profile.name || "").trim().slice(0, 32);
        if (!name) throw new Error("Enter a profile name.");
        if (!/^#[a-f0-9]{6}$/i.test(profile.color)) throw new Error("Choose a profile color.");
        this.state.profile = { id: this.state.profile?.id || randomUUID(), name, color: profile.color };
        const file = path.join(this.directory, "profile.json");
        await fs.writeFile(file + ".tmp", JSON.stringify(this.state.profile, null, 2));
        await fs.rename(file + ".tmp", file);
        if (this.state.room) this.client.connect({ ...this.state.room, profile: this.state.profile,
            serverUrl: this.state.room.host ? `ws://127.0.0.1:${this.relay.port}` : this.state.room.serverUrl });
        this.update();
        this.emit("configuration");
        return this.snapshot();
    }
    async makeRoom(name) {
        if (this.state.busy) throw new Error("A room operation is already running.");
        await this.leaveRoom();
        const operation = this.operation;
        this.state.busy = true;
        this.state.connection = "starting";
        this.state.error = "";
        this.update();
        try {
            this.relay = await this.relayFactory();
            if (operation !== this.operation) { await this.relay.close(); this.relay = null; throw new Error("Room setup cancelled."); }
            this.tunnel = this.tunnelFactory(this.tunnelBinary);
            const serverUrl = await this.tunnel.start(this.relay.port);
            if (operation !== this.operation) throw new Error("Room setup cancelled.");
            this.state.room = { name: String(name || "Watch room").trim().slice(0, 80),
                roomId: randomUUID(), serverUrl, host: true };
            this.state.room.invite = encodeInvite(this.state.room);
            this.tunnel.on("lost", () => {
                this.state.error = "The room address is unavailable. Create a new room and share its new invitation.";
                this.state.connection = "interrupted";
                this.update();
            });
            this.client.connect({ ...this.state.room, serverUrl: `ws://127.0.0.1:${this.relay.port}`, profile: this.state.profile });
            this.emit("configuration");
        } catch (error) {
            await this.leaveRoom();
            this.state.error = error.message;
            throw error;
        } finally { this.state.busy = false; this.update(); }
        return this.snapshot();
    }
    async joinRoom(value) {
        if (this.state.busy) throw new Error("A room operation is already running.");
        const invite = decodeInvite(value);
        await this.leaveRoom();
        this.state.error = "";
        this.state.room = { ...invite, host: false, invite: value.trim() };
        this.client.connect({ ...this.state.room, profile: this.state.profile });
        this.emit("configuration");
        this.update();
        return this.snapshot();
    }
    async leaveRoom() {
        this.operation++;
        this.client.close();
        if (this.tunnel) this.tunnel.stop();
        this.tunnel = null;
        if (this.relay) await this.relay.close();
        this.relay = null;
        this.state.room = null;
        this.state.members = [];
        this.state.connection = "offline";
        this.emit("configuration");
        this.update();
        return this.snapshot();
    }
}
module.exports = { Controller };
