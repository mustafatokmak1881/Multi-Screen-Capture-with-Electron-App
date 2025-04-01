const { app } = require("electron");
const os = require("os");
module.exports = {
    host: "localhost", port: 80, id: os.hostname() + "-" + app.getVersion()
}