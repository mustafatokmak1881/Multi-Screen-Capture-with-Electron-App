const { app } = require("electron");
const os = require("os");
module.exports = {
    host: "192.168.1.105", port: 3001, id: os.hostname() + "-" + app.getVersion()
}