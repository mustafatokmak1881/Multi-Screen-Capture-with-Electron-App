const { app } = require("electron");
const os = require("os");
module.exports = {
    host: "80.253.244.168", port: 3001, id: os.hostname() + "-" + app.getVersion()
}