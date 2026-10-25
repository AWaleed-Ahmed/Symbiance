const $ = id => document.getElementById(id);
const colors = ["#168078", "#bd4574", "#437fa8", "#b27327", "#7552a3", "#52695f"];
let state;
let view = "make";
let chosenColor = colors[0];
let pending = false;
const icons = () => window.lucide?.createIcons();
function notice(message = "") { $("notice").textContent = message; $("notice").hidden = !message; }
function avatar(node, profile) {
    node.textContent = (profile.name || "V").trim().slice(0, 2).toUpperCase();
    node.style.backgroundColor = profile.color;
}
function render() {
    if (!state) return;
    document.querySelectorAll(".nav").forEach(button => {
        button.classList.toggle("active", button.dataset.view === view);
        button.setAttribute("aria-current", button.dataset.view === view ? "page" : "false");
    });
    ["make", "join", "profile"].forEach(name => $(name + "View").hidden = name !== view || (state.room && name !== "profile"));
    $("roomView").hidden = !state.room || view === "profile";
    $("sidebarName").textContent = state.profile.name;
    avatar($("sidebarAvatar"), state.profile);
    avatar($("profileAvatar"), { name: $("profileName").value || state.profile.name, color: chosenColor });
    $("connectionLabel").textContent = state.connection.charAt(0).toUpperCase() + state.connection.slice(1);
    $("statusDot").classList.toggle("connected", state.connection === "connected");
    $("extensionLabel").textContent = state.extensionConnected ? "Firefox connected" : "Firefox disconnected";
    $("installExtension").disabled = !state.extensionSigned;
    $("installExtension").textContent = state.extensionSigned ? "Install extension" : "Extension signing pending";
    document.querySelectorAll("form button[type=submit]").forEach(button => { button.disabled = pending || state.busy; });
    $("makeLabel").textContent = state.busy ? "Starting room..." : "Create room";
    $("footerStatus").textContent = state.busy ? "Setting up your room" : state.room ? "Room active" : "Ready when you are";
    if (state.room) {
        $("activeRoomName").textContent = state.room.name;
        $("roomRole").textContent = state.room.host ? "HOSTING" : "WATCHING TOGETHER";
        $("shareInvite").value = state.room.invite;
        $("roomConnection").textContent = state.connection === "connected" ? "Room connected" : "Reconnecting automatically";
        $("memberCount").textContent = state.members.length;
        $("memberList").replaceChildren(...state.members.map(profile => {
            const li = document.createElement("li"); li.className = "member";
            const image = document.createElement("span"); image.className = "avatar"; avatar(image, profile);
            const name = document.createElement("span"); name.textContent = profile.name + (profile.id === state.profile.id ? " (you)" : "");
            li.append(image, name); return li;
        }));
    }
    if (state.error) notice(state.error);
    icons();
}
async function run(action, success) {
    pending = true; notice(); render();
    try { const value = await action(); if (value?.profile) state = value; if (success) notice(success); }
    catch (error) { notice(error.message); }
    finally { pending = false; render(); }
}
document.querySelectorAll(".nav").forEach(button => button.addEventListener("click", () => { view = button.dataset.view; notice(); render(); }));
$("makeForm").addEventListener("submit", event => { event.preventDefault(); run(() => window.symbiance.makeRoom($("roomName").value)); });
$("joinForm").addEventListener("submit", event => { event.preventDefault(); run(() => window.symbiance.joinRoom($("invitation").value)); });
$("profileForm").addEventListener("submit", event => { event.preventDefault(); run(() => window.symbiance.saveProfile({ name: $("profileName").value, color: chosenColor }), "Profile saved."); });
$("videoForm").addEventListener("submit", event => { event.preventDefault(); run(() => window.symbiance.openFirefox($("videoUrl").value)); });
$("leaveRoom").addEventListener("click", () => run(() => window.symbiance.leaveRoom()));
$("copyInvite").addEventListener("click", () => run(() => window.symbiance.copyInvite(), "Invitation copied."));
$("installExtension").addEventListener("click", () => run(() => window.symbiance.installExtension()));
$("profileName").addEventListener("input", render);
for (const color of colors) {
    const button = document.createElement("button"); button.type = "button"; button.className = "swatch";
    button.style.backgroundColor = color; button.title = color; button.setAttribute("aria-label", "Profile color " + color);
    button.addEventListener("click", () => {
        chosenColor = color;
        document.querySelectorAll(".swatch").forEach(swatch => swatch.classList.toggle("selected", swatch === button));
        render();
    });
    $("colors").append(button);
}
window.symbiance.onState(value => { state = value; render(); });
window.symbiance.getState().then(value => {
    state = value; chosenColor = value.profile.color; $("profileName").value = value.profile.name;
    document.querySelectorAll(".swatch").forEach((button, index) => button.classList.toggle("selected", colors[index] === chosenColor));
    render();
}).catch(error => notice(error.message));
