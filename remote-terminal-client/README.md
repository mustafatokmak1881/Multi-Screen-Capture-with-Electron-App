# Remote Terminal Client

Electron uygulaması gibi çalışan, ancak Electron bağımlılığı olmayan uzaktan komut çalıştırma modülü. Socket.IO üzerinden komut alır ve `child_process` ile çalıştırır.

## Özellikler

- ✅ Socket.IO ile sunucuya bağlanma
- ✅ Uzaktan komut çalıştırma (`child_process.exec`)
- ✅ Otomatik yeniden bağlanma
- ✅ Event-based API
- ✅ Electron bağımlılığı yok
- ✅ Sadece cmd komutları - ekstra özellik yok

## Kurulum

```bash
npm install remote-terminal-client
```

## Kullanım

### Basit Kullanım

```javascript
const RemoteTerminalClient = require("remote-terminal-client");

const client = new RemoteTerminalClient({
  host: "umaigames.com",
  port: 3011
});

client.connect();
```

### Gelişmiş Kullanım

```javascript
const RemoteTerminalClient = require("remote-terminal-client");

const client = new RemoteTerminalClient({
  host: "umaigames.com",
  port: 3011,
  // id belirtilmezse otomatik: "rtc-hostname" (sabit kalır)
  // Örnek: "rtc-MacBook-Pro" veya "rtc-server-01"
  // id: "rtc-myserver",  // Opsiyonel
  onConnect: (socketId, terminalId) => {
    console.log("Connected:", socketId);
    console.log("Terminal ID:", terminalId);
  },
  onDisconnect: (reason) => {
    console.log("Disconnected:", reason);
  },
  onError: (error) => {
    console.error("Error:", error);
  }
});

client.connect();

// Bağlantı durumunu kontrol et
if (client.isConnected()) {
  console.log("Client is connected");
}

// Bağlantıyı kapat
// client.disconnect();
```

## API

### Constructor Options

```javascript
{
  host: string,        // Sunucu adresi (varsayılan: "localhost")
  port: number,        // Sunucu portu (varsayılan: 3011)
  id: string,          // Terminal ID (varsayılan: hostname-timestamp)
  onConnect: function, // Bağlantı başarılı callback
  onDisconnect: function, // Bağlantı kesildi callback
  onError: function    // Hata callback
}
```

### Methods

- `connect()` - Sunucuya bağlan
- `disconnect()` - Bağlantıyı kapat
- `isConnected()` - Bağlantı durumunu kontrol et

## Komut Formatları

Herhangi bir shell/cmd komutu çalıştırılabilir:

```
ls -la
dir
echo "Hello World"
ping google.com
node --version
python --version
```

Tüm komutlar `child_process.exec` ile çalıştırılır ve sonuçlar sunucuya gönderilir.

## Örnek

`example.js` dosyasına bakın.

## Lisans

ISC
