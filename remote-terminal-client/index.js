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
    console.log(`🔌 Connecting to ${socketUrl}...`);
    
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
      console.log("=".repeat(50));
      console.log("✅ Connected to server");
      console.log("📋 Terminal ID:", this.id);
      console.log("🔌 Socket ID:", this.socket.id);
      console.log("🌐 Server:", `http://${this.host}:${this.port}`);
      console.log("🏠 Room:", `terminal-${this.id}`);
      console.log("=".repeat(50));
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
      console.log("🔌 Disconnected:", reason);
      this.connected = false;
      
      if (this.onDisconnect) {
        this.onDisconnect(reason);
      }
    });

    // Bağlantı hatası
    this.socket.on("connect_error", (error) => {
      console.error("❌ Connection error:", error.message);
      
      if (this.onError) {
        this.onError(error);
      }
    });

    // Komut isteği - Ana mantık burada
    this.socket.on("getRunRequest", (data) => {
      console.log("📥 Command received:", data.cmd);
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
          console.log("📤 Command response sent");
        }
      );
    } catch (error) {
      data["cmd"] = "catchError: " + error.message;
      this.socket.emit("getRunResponse", data);
      console.error("❌ Command execution error:", error);
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
