const { app, BrowserWindow, desktopCapturer } = require("electron");
const remoteViewer = require("./remoteViewer");

app.on("ready", () => {
    let mainWindow = new BrowserWindow({});
    remoteViewer.start(desktopCapturer);
});