function encodeInvite({ serverUrl, roomId, name }) {
    return "symbiance:" + Buffer.from(JSON.stringify({ v: 1, serverUrl, roomId, name })).toString("base64url");
}
function decodeInvite(value) {
    if (typeof value !== "string" || value.length > 4096 || !value.trim().startsWith("symbiance:")) {
        throw new Error("Paste a Symbiance room invitation.");
    }
    let invite;
    try { invite = JSON.parse(Buffer.from(value.trim().slice(10), "base64url").toString()); }
    catch { throw new Error("This invitation is incomplete or invalid."); }
    let url;
    try { url = new URL(invite.serverUrl); } catch { throw new Error("This invitation has an invalid server address."); }
    if (invite.v !== 1 || url.protocol !== "wss:" || url.username || url.password || typeof invite.roomId !== "string" ||
        !/^[A-Za-z0-9-]{6,64}$/.test(invite.roomId)) throw new Error("This invitation is not supported.");
    return { serverUrl: url.href, roomId: invite.roomId, name: String(invite.name || "Watch room").slice(0, 80) };
}
module.exports = { encodeInvite, decodeInvite };
