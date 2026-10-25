const os = require("node:os");
const path = require("node:path");

function dataDirectory(platform = process.platform, env = process.env) {
    const root = platform === "win32" ? env.APPDATA : env.XDG_CONFIG_HOME || path.join(env.HOME || os.homedir(), ".config");
    if (!root) throw new Error("The user configuration directory is unavailable.");
    return path.join(root, "Symbiance");
}

function helperNames(platform = process.platform) {
    return platform === "win32" ? { tunnel: "cloudflared.exe", native: "symbiance-bridge.exe" }
        : { tunnel: "cloudflared", native: "symbiance-bridge" };
}

function firefoxCandidates(platform = process.platform, env = process.env) {
    if (platform === "linux") return ["/usr/bin/firefox", "/usr/bin/firefox-esr", "/usr/local/bin/firefox", "/snap/bin/firefox"];
    return [env.ProgramFiles, env["ProgramFiles(x86)"], env.LOCALAPPDATA]
        .filter(Boolean).map(root => path.join(root, "Mozilla Firefox", "firefox.exe"));
}

module.exports = { dataDirectory, helperNames, firefoxCandidates };
