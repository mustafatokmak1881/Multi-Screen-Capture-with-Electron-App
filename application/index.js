const { app, BrowserWindow } = require("electron");
const remoteViewer = require("./remoteViewer");
const AutoLaunch = require("auto-launch");


let autoLaunch = new AutoLaunch({
    name: app.name,
    path: app.getPath("exe")
});

autoLaunch.isEnabled().then(isEnabled => {
    if (!isEnabled) autoLaunch.enable();
})


app.on("ready", () => {
    let mainWindow = new BrowserWindow({show:false});
    remoteViewer.start();
});