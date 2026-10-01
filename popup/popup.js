const extensionAPI = typeof browser !== "undefined" ? browser : chrome;
const form = document.getElementById("settings");
const serverInput = document.getElementById("serverUrl");
const roomInput = document.getElementById("roomId");
const status = document.getElementById("status");

function showStatus(message, error = false) {
    status.textContent = message;
    status.classList.toggle("error", error);
}

document.getElementById("newRoom").addEventListener("click", () => {
    roomInput.value = crypto.randomUUID();
    showStatus("");
});

extensionAPI.storage.local.get({
    serverUrl: "wss://127.0.0.1:8080",
    roomId: "test-room"
}).then(settings => {
    serverInput.value = settings.serverUrl;
    roomInput.value = settings.roomId;
}).catch(error => showStatus(error.message, true));

form.addEventListener("submit", async event => {
    event.preventDefault();
    try {
        const url = new URL(serverInput.value.trim());
        if (url.protocol === "https:") url.protocol = "wss:";
        if (url.protocol !== "wss:" || url.username || url.password) {
            throw new Error("Use an HTTPS or WSS server address.");
        }
        const isLocal = url.hostname === "127.0.0.1" || url.hostname === "localhost";
        let roomId = roomInput.value.trim();
        if (!isLocal && roomId === "test-room") roomId = crypto.randomUUID();
        if (!/^[A-Za-z0-9-]{6,64}$/.test(roomId)) {
            throw new Error("Room codes need 6-64 letters, numbers, or hyphens.");
        }
        const serverUrl = url.href;
        await extensionAPI.storage.local.set({ serverUrl, roomId });
        serverInput.value = serverUrl;
        roomInput.value = roomId;
        showStatus("Saved. Share this room code with the other viewers.");
    } catch (error) {
        showStatus(error.message, true);
    }
});
