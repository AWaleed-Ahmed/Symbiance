const fs = require("node:fs/promises");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const extensionId = "symbiance@awaleed-ahmed.github.io";
async function installNativeHost(directory, executable) {
    await fs.access(executable);
    const manifestPath = path.join(directory, "native-manifest.json");
    await fs.writeFile(manifestPath, JSON.stringify({ name: "com.symbiance.bridge",
        description: "Symbiance desktop room connection", path: executable,
        type: "stdio", allowed_extensions: [extensionId] }, null, 2));
    const result = spawnSync("reg.exe", ["ADD", "HKCU\\Software\\Mozilla\\NativeMessagingHosts\\com.symbiance.bridge",
        "/ve", "/t", "REG_SZ", "/d", manifestPath, "/f"], { windowsHide: true, encoding: "utf8" });
    if (result.status !== 0) throw new Error("Firefox integration could not be registered for this Windows account.");
}
module.exports = { installNativeHost, extensionId };
