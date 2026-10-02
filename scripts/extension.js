const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");

async function main() {
    const root = path.join(__dirname, "..");
    const source = path.join(root, "build", "extension");
    const output = path.join(root, "dist", "extension");
    await fs.mkdir(source, { recursive: true });
    await fs.mkdir(output, { recursive: true });
    for (const file of ["manifest.json", "background.js", "content.js", "extension", "popup"]) {
        await fs.cp(path.join(root, file), path.join(source, file), { recursive: true });
    }
    const action = process.argv[2] || "build";
    if (!["build", "sign"].includes(action)) throw new Error("Choose build or sign.");
    if (action === "sign" && (!process.env.AMO_JWT_ISSUER || !process.env.AMO_JWT_SECRET)) {
        throw new Error("Set AMO_JWT_ISSUER and AMO_JWT_SECRET from Mozilla's developer account before signing.");
    }
    const args = [path.join(root, "node_modules", "web-ext", "bin", "web-ext.js"), action,
        "--source-dir", source, "--artifacts-dir", output];
    args.push(...(action === "build" ? ["--overwrite-dest"] : ["--channel", "unlisted"]));
    await new Promise((resolve, reject) => {
        const env = { ...process.env };
        if (action === "sign") {
            env.WEB_EXT_API_KEY = process.env.AMO_JWT_ISSUER;
            env.WEB_EXT_API_SECRET = process.env.AMO_JWT_SECRET;
        }
        const child = spawn(process.execPath, args, { stdio: "inherit", windowsHide: true, env });
        child.on("error", reject);
        child.on("exit", code => code === 0 ? resolve() : reject(new Error(`Extension ${action} failed (${code}).`)));
    });
    if (action === "sign") {
        const files = (await fs.readdir(output)).filter(file => file.endsWith(".xpi"));
        if (files.length !== 1) throw new Error("Expected exactly one signed XPI in dist/extension.");
        const destination = path.join(root, "assets", "extension");
        await fs.mkdir(destination, { recursive: true });
        await fs.copyFile(path.join(output, files[0]), path.join(destination, "symbiance-signed.xpi"));
        console.log("Signed Firefox extension ready for the Windows release.");
    }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
