const { _electron: electron, expect } = require("@playwright/test");
const path = require("node:path");
const fs = require("node:fs/promises");

async function main() {
    const root = path.join(__dirname, "..");
    const executablePath = path.join(root, "dist", "win-unpacked", "Symbiance.exe");
    const application = await electron.launch({ executablePath, args: [], timeout: 30000 });
    try {
        const page = await application.firstWindow();
        await expect(page.locator("#makeView h1")).toHaveText("Make a room");
        await expect(page.locator(".brand svg")).toBeVisible();
        await expect(page.locator("#profileName")).not.toHaveValue("");
        if (!await application.evaluate(({ app }) => app.isPackaged)) throw new Error("Expected packaged app.");
        await fs.mkdir(path.join(root, "test-results"), { recursive: true });
        await page.screenshot({ path: path.join(root, "test-results", "packaged-app.png") });
        console.log("Packaged Windows executable launches with working preload, icons and saved settings.");
    } finally { await application.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
