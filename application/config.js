const { app } = require("electron");
const os = require("os");
module.exports = {
    host: "umaigames.com", port: 80, id: os.hostname() + "-" + app.getVersion()
}