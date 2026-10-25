const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { createHash } = require("node:crypto");
const { prepareRelease } = require("../scripts/prepare-release");

async function fixture(t) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "symbiance-release-"));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const input = path.join(root, "input");
    const output = path.join(root, "output");
    await fs.mkdir(input);
    for (const [name, signature] of [
        ["Symbiance-0.2.0-x64-portable.exe", Buffer.from("MZ")],
        ["Symbiance-0.2.0-x64-setup.exe", Buffer.from("MZ")],
        ["Symbiance-0.2.0-amd64.deb", Buffer.from("!<arch>\n")],
        ["Symbiance-0.2.0-x64.tar.gz", Buffer.from([0x1f, 0x8b])],
        ["symbiance-0.2.0.zip", Buffer.from([0x50, 0x4b, 0x03, 0x04])]
    ]) {
        const bytes = Buffer.alloc(1024 * 1024);
        signature.copy(bytes);
        await fs.writeFile(path.join(input, name), bytes);
    }
    return { input, output };
}

test("release preparation collects exact packages and writes matching checksums", async t => {
    const { input, output } = await fixture(t);
    const assets = await prepareRelease(input, output, "0.2.0", "v0.2.0-preview.1");
    assert.equal(assets.length, 5);
    for (const line of (await fs.readFile(path.join(output, "SHA256SUMS"), "utf8")).trim().split("\n")) {
        const [digest, name] = line.split("  ");
        assert.equal(digest, createHash("sha256").update(await fs.readFile(path.join(output, name))).digest("hex"));
    }
});

test("release preparation rejects missing and truncated packages", async t => {
    const { input, output } = await fixture(t);
    const file = path.join(input, "Symbiance-0.2.0-x64-setup.exe");
    await fs.writeFile(file, "MZ");
    await assert.rejects(prepareRelease(input, output), /Truncated/);
    await fs.rm(file);
    await assert.rejects(prepareRelease(input, output), /Missing/);
});

test("release preparation rejects incorrect formats and duplicate packages", async t => {
    const { input, output } = await fixture(t);
    const file = path.join(input, "Symbiance-0.2.0-x64-portable.exe");
    await fs.writeFile(file, Buffer.alloc(1024 * 1024));
    await assert.rejects(prepareRelease(input, output), /Invalid package format/);
    await fs.mkdir(path.join(input, "duplicate"));
    await fs.copyFile(file, path.join(input, "duplicate", path.basename(file)));
    await assert.rejects(prepareRelease(input, output), /Duplicate/);
});

test("release preparation rejects stale output and version-mismatched tags", async t => {
    const { input, output } = await fixture(t);
    await assert.rejects(prepareRelease(input, output, "0.2.0", "v9.0.0-preview.1"), /tag must match/);
    await fs.mkdir(output);
    await fs.writeFile(path.join(output, "stale.exe"), "old");
    await assert.rejects(prepareRelease(input, output), /must be empty/);
});
