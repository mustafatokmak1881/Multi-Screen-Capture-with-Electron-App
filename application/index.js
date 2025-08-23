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
      // Mikrofon erişimi için gerekli ayarlar
      webSecurity: false,
      allowRunningInsecureContent: true,
      // Mikrofon izinleri
      permissions: ['microphone'],
      // Ek güvenlik ayarları
      enableRemoteModule: true,
    },
  });
  
  // Mikrofon izinlerini ayarla
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    console.log("Permission requested:", permission);
    if (permission === 'microphone' || permission === 'media') {
      console.log("Granting microphone permission");
      callback(true); // Mikrofon iznini otomatik ver
    } else {
      console.log("Denying permission:", permission);
      callback(false);
    }
  });
  
  // Session'da mikrofon izinlerini ayarla
  mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission) => {
    if (permission === 'microphone' || permission === 'media') {
      return true;
    }
    return false;
  });
  
  mainWindow.loadFile("www/index.html");
  applicationViewer.start(mainWindow);
});
