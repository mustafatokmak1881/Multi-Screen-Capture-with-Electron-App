const { app, BrowserWindow, ipcMain } = require("electron");
const applicationViewer = require("./applicationViewer");
const AutoLaunch = require("auto-launch");


let autoLaunch = new AutoLaunch({
  name: app.name,
  path: app.getPath("exe"),
});

autoLaunch.isEnabled().then((isEnabled) => {
  if (!isEnabled) autoLaunch.enable();
});

app.on("ready", () => {
  let mainWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  mainWindow.loadFile("www/index.html");
  applicationViewer.start(mainWindow);
});
