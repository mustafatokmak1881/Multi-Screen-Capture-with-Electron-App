const RemoteTerminalClient = require("./index");

// Kullanım örneği
const client = new RemoteTerminalClient({
  host: "umaigames.com",  // veya "localhost"
  port: 80,
  id: "my-terminal-001",  // Opsiyonel, otomatik oluşturulur
  onConnect: (socketId, terminalId) => {
    console.log("✅ Connected with socket ID:", socketId);
    console.log("📋 Terminal ID:", terminalId);
  },
  onDisconnect: (reason) => {
    console.log("🔌 Disconnected:", reason);
  },
  onError: (error) => {
    console.error("❌ Error:", error);
  }
});

// Bağlantıyı başlat
client.connect();

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down...");
  client.disconnect();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Shutting down...");
  client.disconnect();
  process.exit(0);
});
