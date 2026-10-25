const fs = require("node:fs/promises");
const { createReadStream } = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

async function walk(directory) {
    const files = [];
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) files.push(...await walk(file));
        else if (entry.isFile()) files.push(file);
    }
    return files.sort();
}

async function prepareRelease(input, output, version = require("../package.json").version, tag = process.env.RELEASE_TAG) {
    if (tag && !new RegExp(`^v${version.replace(/\./g, "\\.")}-preview\\.\\d+$`).test(tag)) {
        throw new Error("The preview tag must match package.json version.");
    }
    const expected = new Map([
        [`Symbiance-${version}-x64-portable.exe`, Buffer.from("MZ")],
        [`Symbiance-${version}-x64-setup.exe`, Buffer.from("MZ")],
        [`Symbiance-${version}-amd64.deb`, Buffer.from("!<arch>\n")],
        [`Symbiance-${version}-x64.tar.gz`, Buffer.from([0x1f, 0x8b])],
        [`symbiance-${version}.zip`, Buffer.from([0x50, 0x4b, 0x03, 0x04])]
    ]);
    const files = await walk(input);
    const selected = [];
    for (const [name, signature] of expected) {
        const matches = files.filter(file => path.basename(file) === name);
        if (!matches.length) throw new Error(`Missing release asset: ${name}`);
        if (matches.length > 1 && !name.endsWith(".zip")) throw new Error(`Duplicate release asset: ${name}`);
        const source = matches[0];
        const size = (await fs.stat(source)).size;
        if (size < (name.endsWith(".zip") ? 1024 : 1024 * 1024)) throw new Error(`Truncated release asset: ${name}`);
        const handle = await fs.open(source, "r");
        try {
            const header = Buffer.alloc(signature.length);
            await handle.read(header, 0, header.length, 0);
            if (!header.equals(signature)) throw new Error(`Invalid package format: ${name}`);
        } finally { await handle.close(); }
        selected.push({ name, source, size });
    }
    await fs.mkdir(output, { recursive: true });
    if ((await fs.readdir(output)).length) throw new Error("The release output directory must be empty.");
    const checksums = [];
    for (const asset of selected) {
        const target = path.join(output, asset.name);
        await fs.copyFile(asset.source, target);
        const hash = createHash("sha256");
        for await (const chunk of createReadStream(target)) hash.update(chunk);
        checksums.push(`${hash.digest("hex")}  ${asset.name}`);
    }
    await fs.writeFile(path.join(output, "SHA256SUMS"), checksums.join("\n") + "\n");
    return selected.map(({ name, size }) => ({ name, size }));
}

if (require.main === module) {
    const [input, output] = process.argv.slice(2);
    if (!input || !output) { console.error("Usage: node scripts/prepare-release.js INPUT OUTPUT"); process.exitCode = 1; }
    else prepareRelease(input, output).then(assets => console.log(JSON.stringify({ assets }))).catch(error => {
        console.error(error.message); process.exitCode = 1;
    });
}

module.exports = { prepareRelease };
