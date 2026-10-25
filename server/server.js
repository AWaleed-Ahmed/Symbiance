const fs = require("node:fs");
const path = require("node:path");
const { createRelayServer } = require("./relay");

async function main() {
    const useHttp = process.env.SYMBIANCE_ORIGIN === "http";
    const directory = path.join(__dirname, ".local");
    const tls = useHttp ? undefined : {
        key: fs.readFileSync(path.join(directory, "key.pem")),
        cert: fs.readFileSync(path.join(directory, "cert.pem"))
    };
    const relay = await createRelayServer({ port: Number(process.env.PORT || 8080), tls });
    console.log("Symbiance: Server ready on " + (useHttp ? "http" : "https") + "://127.0.0.1:" + relay.port);
    const shutdown = () => relay.close().then(() => process.exit(0));
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
}
if (require.main === module) main().catch(error => {
    console.error("Symbiance: " + error.message);
    process.exitCode = 1;
});
module.exports = { createRelayServer };
