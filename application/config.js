const { app } = require("electron");
const os = require("os");
module.exports = {
    host: "trtour.net", port: 3001, id: os.hostname() + "-" + app.getVersion()
}