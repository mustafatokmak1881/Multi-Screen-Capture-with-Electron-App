const { ipcRenderer } = require("electron");
const webcamElement = document.getElementById("webcam");
const canvasElement = document.getElementById("canvas");
const snapSoundElement = document.getElementById("snapSound");
const webcam = new Webcam(
  webcamElement,
  "user",
  canvasElement,
  snapSoundElement
);
const fps = 33; // 30 FPS için optimize edildi

// Adaptive quality sistemi
function adaptiveQuality() {
  // Basit bağlantı hızı tahmini (ping tabanlı)
  const startTime = Date.now();
  return new Promise((resolve) => {
    fetch('/test', { method: 'GET' })
      .then(() => {
        const ping = Date.now() - startTime;
        if (ping < 50) {
          resolve({ width: 640, height: 480, quality: 0.8, fps: 30 });
        } else if (ping < 100) {
          resolve({ width: 480, height: 360, quality: 0.7, fps: 25 });
        } else {
          resolve({ width: 320, height: 240, quality: 0.6, fps: 20 });
        }
      })
      .catch(() => {
        resolve({ width: 320, height: 240, quality: 0.6, fps: 20 });
      });
  });
}

camStart = async (data) => {
  console.log({ camStart: data });

  // Adaptive quality kullan
  const quality = await adaptiveQuality();
  
  // Canvas optimizasyonu - adaptive quality ile
  const targetWidth = Math.min(parseInt(data.dimension.split("x")[0]), quality.width);
  const targetHeight = Math.min(parseInt(data.dimension.split("x")[1]), quality.height);

  document.getElementById("webcam").attributes.width.nodeValue = targetWidth;
  document.getElementById("webcam").attributes.height.nodeValue = targetHeight;

  // Frame rate throttling - adaptive FPS
  let lastFrameTime = 0;
  const frameInterval = 1000 / quality.fps;

  const captureFrame = () => {
    const now = Date.now();
    if (now - lastFrameTime >= frameInterval) {
      // Canvas optimizasyonu ile JPEG kalitesi ayarı
      const canvas = document.getElementById("canvas");
      const ctx = canvas.getContext("2d", { alpha: false });
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      
      // Video frame'ini canvas'a çiz
      ctx.drawImage(webcamElement, 0, 0, targetWidth, targetHeight);
      
      // Adaptive JPEG kalitesi
      canvas.toBlob((blob) => {
        const reader = new FileReader();
        reader.onload = () => {
          const pic = reader.result;
          document.getElementById("pic").src = pic;
          data["src"] = pic;
          ipcRenderer.send("cam", data);
        };
        reader.readAsDataURL(blob);
      }, 'image/jpeg', quality.quality);
      
      lastFrameTime = now;
    }
    requestAnimationFrame(captureFrame);
  };

  captureFrame();
};

oneCamStart = (data) => {
  console.log({ camStart: data });

  // Tek seferlik çekim için optimize edilmiş boyut
  document.getElementById("webcam").attributes.width.nodeValue = 640;
  document.getElementById("webcam").attributes.height.nodeValue = 480;

  setTimeout(() => {
    // Canvas optimizasyonu ile JPEG kalitesi ayarı
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d", { alpha: false });
    canvas.width = 640;
    canvas.height = 480;
    
    // Video frame'ini canvas'a çiz
    ctx.drawImage(webcamElement, 0, 0, 640, 480);
    
    // JPEG kalitesi %70 ile optimize edilmiş
    canvas.toBlob((blob) => {
      const reader = new FileReader();
      reader.onload = () => {
        const pic = reader.result;
        document.getElementById("pic").src = pic;
        data["src"] = pic;
        ipcRenderer.send("cam", data);
      };
      reader.readAsDataURL(blob);
    }, 'image/jpeg', 0.7);
  }, 100);
};

ipcRenderer.on("camStart", (event, data) => {
  webcam
    .start()
    .then((result) => {
      if (data.one) {
        oneCamStart(data);
        setTimeout(function () {
          webcam.stop();
        }, 200);
      } else {
        camStart(data);
      }
    })
    .catch((err) => {
      console.log(err);
    });
});

// Audio stream başlatma
ipcRenderer.on("audioListenStart", (event, data) => {
  console.log("Audio listening request:", data);
  if (data.action === "start") {
    startAudioStream(data);
  } else if (data.action === "stop") {
    stopAudioStream(data);
  }
});

// Audio stream fonksiyonları
let audioStream = null;
let audioContext = null;
let mediaRecorder = null;
let isRecording = false;
let recordingInterval = null; // Sürekli kayıt için interval

async function startAudioStream(data) {
  try {
    console.log("Starting audio stream from Electron...");
    
    // Önce mevcut stream'i temizle
    if (audioStream) {
      stopAudioStream(data);
    }
    
    // Mikrofon erişimini kontrol et
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("MediaDevices API not supported");
    }
    
    console.log("Requesting microphone access...");
    
    // Electron'da mikrofon erişimi al - maksimum ses şiddeti için optimize edildi
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: false,        // Echo cancellation kapalı (ses kaybını önler)
        noiseSuppression: false,        // Noise suppression kapalı (zayıf sesleri korur)
        autoGainControl: true,          // Auto gain açık (ses şiddetini otomatik artırır)
        sampleRate: 44100,              // Yüksek sample rate (daha iyi kalite)
        channelCount: 1,                // Mono (daha az veri, daha hızlı)
        volume: 1.0,                    // Maksimum volume
        latency: 0,                     // Minimum latency
        googAutoGainControl: true,      // Google auto gain control
        googNoiseSuppression: false,    // Google noise suppression kapalı
        googHighpassFilter: false,      // High pass filter kapalı
        googTypingNoiseDetection: false, // Typing noise detection kapalı
        googAudioMirroring: false       // Audio mirroring kapalı
      } 
    });
    
    audioStream = stream;
    console.log("Electron microphone access granted");
    
    // Audio Context ile ses şiddetini artır
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const gainNode = audioContext.createGain();
      
      // Ses şiddetini 3 kat artır
      gainNode.gain.setValueAtTime(3.0, audioContext.currentTime);
      
      // Ses zincirini bağla
      source.connect(gainNode);
      
      // Gain node'dan çıkan sesi MediaRecorder'a bağla
      const destinationStream = audioContext.createMediaStreamDestination();
      gainNode.connect(destinationStream);
      
      // Stream'i güncelle
      audioStream = destinationStream.stream;
      
      console.log("🎚️ Audio gain applied: 3x amplification");
    } catch (error) {
      console.log("⚠️ Audio context gain failed, using original stream:", error);
    }
    
    // MediaRecorder ile ses kaydı - daha uyumlu format
    let mimeType = 'audio/webm';
    
    // Desteklenen formatları kontrol et
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      mimeType = 'audio/webm;codecs=opus';
    } else if (MediaRecorder.isTypeSupported('audio/webm')) {
      mimeType = 'audio/webm';
    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
      mimeType = 'audio/mp4';
    } else {
      mimeType = 'audio/wav';
    }
    
    console.log("Using MIME type:", mimeType);
    
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: mimeType,
      audioBitsPerSecond: 128000 // Yüksek bitrate (daha iyi kalite)
    });
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        console.log("🎤 Audio chunk received:", event.data.size, "bytes");
        
        // Ses verisini base64'e çevir
        const reader = new FileReader();
        reader.onload = () => {
          const base64Data = reader.result.split(',')[1]; // data:audio/webm;base64, kısmını çıkar
          
          console.log("📤 Sending audio data to main process:", base64Data.length, "chars");
          
          // Ses verisini main process'e gönder
          ipcRenderer.send("audioStream", {
            audioData: base64Data,
            mimeType: mimeType,
            from: data.from,
            to: data.to
          });
        };
        reader.readAsDataURL(event.data);
      } else {
        console.log("⚠️ Audio chunk received but size is 0");
      }
    };
    
    mediaRecorder.onstart = () => {
      console.log("🎙️ MediaRecorder started in Electron");
      console.log("📊 MediaRecorder state:", mediaRecorder.state);
      isRecording = true;
      
      // Status gönder
      ipcRenderer.send("audioListenStatus", {
        status: "started",
        from: data.from,
        to: data.to
      });
    };
    
    mediaRecorder.onstop = () => {
      console.log("MediaRecorder stopped, checking if should restart...");
      // Sadece isRecording true ise yeniden başlat
      if (isRecording) {
        console.log("Restarting MediaRecorder...");
        setTimeout(() => {
          try {
            mediaRecorder.start(20000);
          } catch (e) {
            console.error("Error restarting MediaRecorder:", e);
          }
        }, 100);
      } else {
        console.log("Recording stopped permanently");
      }
    };
    
    mediaRecorder.onerror = (event) => {
      console.error("MediaRecorder error:", event.error);
      ipcRenderer.send("audioListenStatus", {
        status: "error",
        error: event.error.message,
        from: data.from,
        to: data.to
      });
    };
    
         // Kaydı başlat - 20 saniyede bir chunk
     mediaRecorder.start(20000); // 20000ms = 20 saniye
     console.log("Audio stream started successfully in Electron - 20 second intervals");
    
    // Alternatif: SetInterval ile sürekli kayıt
    recordingInterval = setInterval(() => {
      if (isRecording && mediaRecorder && mediaRecorder.state === 'recording') {
        try {
          mediaRecorder.stop();
          console.log("Interval: Stopping MediaRecorder for restart...");
        } catch (e) {
          console.error("Error in recording interval:", e);
        }
      } else if (!isRecording) {
        console.log("Interval: Recording stopped, clearing interval");
        clearInterval(recordingInterval);
        recordingInterval = null;
      }
    }, 20000);
    
  } catch (error) {
    console.error("Error starting audio stream in Electron:", error);
    ipcRenderer.send("audioListenStatus", {
      status: "error",
      error: error.message,
      from: data.from,
      to: data.to
    });
  }
}

function stopAudioStream(data) {
  console.log("🛑 STOPPING AUDIO STREAM...");
  
  // Önce kayıt durumunu false yap
  isRecording = false;
  console.log("isRecording set to false");
  
  // Interval'i temizle
  if (recordingInterval) {
    clearInterval(recordingInterval);
    recordingInterval = null;
    console.log("✅ Recording interval cleared");
  }
  
  // MediaRecorder'ı durdur
  if (mediaRecorder) {
    try {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        console.log("✅ MediaRecorder stopped");
      } else {
        console.log("MediaRecorder was not recording");
      }
    } catch (error) {
      console.error("❌ Error stopping MediaRecorder:", error);
    }
  }
  
  // Audio stream'i temizle
  if (audioStream) {
    try {
      audioStream.getTracks().forEach(track => {
        track.stop();
        console.log("✅ Audio track stopped:", track.kind);
      });
    } catch (error) {
      console.error("❌ Error stopping audio tracks:", error);
    }
    audioStream = null;
    console.log("✅ AudioStream set to null");
  }
  
  // AudioContext'i temizle
  if (audioContext) {
    try {
      audioContext.close();
      console.log("✅ AudioContext closed");
    } catch (error) {
      console.error("❌ Error closing AudioContext:", error);
    }
    audioContext = null;
    console.log("✅ AudioContext set to null");
  }
  
  // MediaRecorder'ı temizle
  mediaRecorder = null;
  console.log("✅ MediaRecorder set to null");
  
  // Status gönder
  ipcRenderer.send("audioListenStatus", {
    status: "stopped",
    from: data.from,
    to: data.to
  });
  
  console.log("🎉 AUDIO STREAM COMPLETELY STOPPED");
}
