const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

async function main() {
    const directory = path.join(__dirname, "..", "assets");
    await fs.mkdir(path.join(directory, "extension"), { recursive: true });
    await fs.mkdir(path.join(directory, "native"), { recursive: true });
    const response = await fetch("https://api.github.com/repos/cloudflare/cloudflared/releases/latest", {
        headers: { "User-Agent": "Symbiance-build", Accept: "application/vnd.github+json" }
    });
    if (!response.ok) throw new Error(`Cloudflare release lookup failed (${response.status}).`);
    const release = await response.json();
    const licenseDirectory = path.join(directory, "licenses");
    await fs.mkdir(licenseDirectory, { recursive: true });
    for (const [name, url] of [
        ["cloudflared-LICENSE", `https://raw.githubusercontent.com/cloudflare/cloudflared/${release.tag_name}/LICENSE`],
        ["node-LICENSE", "https://raw.githubusercontent.com/nodejs/node/v22.x/LICENSE"]
    ]) {
        const license = await fetch(url);
        if (!license.ok) throw new Error(`Bundled license download failed (${license.status}).`);
        await fs.writeFile(path.join(licenseDirectory, name), await license.text());
    }
    const asset = release.assets.find(item => item.name === "cloudflared-windows-amd64.exe");
    if (!asset || !/^sha256:[a-f0-9]{64}$/.test(asset.digest || "")) {
        throw new Error("The official Cloudflare release has no verifiable SHA-256 digest.");
    }
    const target = path.join(directory, "cloudflared.exe");
    const digest = bytes => "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex");
    try {
        if (digest(await fs.readFile(target)) === asset.digest) {
            console.log(`Cloudflare ${release.tag_name} already verified.`);
            return;
        }
    } catch {}
    const binary = await fetch(asset.browser_download_url);
    if (!binary.ok) throw new Error(`Cloudflare download failed (${binary.status}).`);
    const bytes = Buffer.from(await binary.arrayBuffer());
    if (digest(bytes) !== asset.digest) throw new Error("Cloudflare download checksum mismatch.");
    await fs.writeFile(target, bytes);
    await fs.writeFile(path.join(directory, "cloudflared-release.json"), JSON.stringify({
        version: release.tag_name, url: asset.browser_download_url, digest: asset.digest
    }, null, 2));
    console.log(`Cloudflare ${release.tag_name} downloaded and verified.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
