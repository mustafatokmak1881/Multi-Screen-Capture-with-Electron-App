// Image Processor Worker
self.onmessage = function(e) {
  const { canvas, quality, width, height } = e.data;
  
  // Canvas'tan image data al
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, width, height);
  
  // Basit image processing - brightness ve contrast ayarı
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    // Brightness artır
    data[i] = Math.min(255, data[i] * 1.1);     // Red
    data[i + 1] = Math.min(255, data[i + 1] * 1.1); // Green
    data[i + 2] = Math.min(255, data[i + 2] * 1.1); // Blue
  }
  
  // Processed image data'yı geri gönder
  ctx.putImageData(imageData, 0, 0);
  
  // JPEG olarak encode et
  canvas.toBlob((blob) => {
    self.postMessage({ blob, processed: true });
  }, 'image/jpeg', quality);
};
