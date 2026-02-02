// Port test scripti - umaigames.com'un hangi portta çalıştığını test eder
// Kullanım: cd web/server && node test-port.js
const io = require("socket.io-client");

const testPort = (port) => {
  return new Promise((resolve) => {
    console.log(`\n🔍 Port ${port} test ediliyor...`);
    const socket = io.connect(`http://umaigames.com:${port}`, {
      transports: ['websocket', 'polling'],
      timeout: 5000,
      reconnection: false
    });

    const timeout = setTimeout(() => {
      socket.disconnect();
      console.log(`❌ Port ${port}: Zaman aşımı (5 saniye)`);
      resolve(false);
    }, 5000);

    socket.on("connect", () => {
      clearTimeout(timeout);
      console.log(`✅ Port ${port}: BAŞARILI! Socket ID: ${socket.id}`);
      socket.disconnect();
      resolve(true);
    });

    socket.on("connect_error", (error) => {
      clearTimeout(timeout);
      console.log(`❌ Port ${port}: Bağlantı hatası - ${error.message}`);
      resolve(false);
    });
  });
};

async function testPorts() {
  console.log("🚀 umaigames.com port testi başlatılıyor...\n");
  
  const port80 = await testPort(80);
  const port3011 = await testPort(3011);
  
  console.log("\n" + "=".repeat(50));
  console.log("📊 TEST SONUÇLARI:");
  console.log("=".repeat(50));
  
  if (port80) {
    console.log("✅ Port 80: ÇALIŞIYOR - Bu portu kullanın!");
  } else {
    console.log("❌ Port 80: ÇALIŞMIYOR");
  }
  
  if (port3011) {
    console.log("✅ Port 3011: ÇALIŞIYOR - Bu portu kullanın!");
  } else {
    console.log("❌ Port 3011: ÇALIŞMIYOR");
  }
  
  console.log("\n💡 ÖNERİ:");
  if (port80 && port3011) {
    console.log("Her iki port da çalışıyor. Port 80 (standart HTTP) önerilir.");
  } else if (port80) {
    console.log("Port 80 kullanın.");
  } else if (port3011) {
    console.log("Port 3011 kullanın.");
  } else {
    console.log("Hiçbir port çalışmıyor. Sunucunun çalıştığından emin olun.");
  }
}

testPorts();
