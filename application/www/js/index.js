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
