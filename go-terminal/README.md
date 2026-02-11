# Go Terminal Client

Go ile yazılmış Socket.IO tabanlı uzaktan komut çalıştırma client'ı.

## Özellikler

- ✅ **Cross-platform**: Windows, macOS, Linux desteği
- ✅ **Socket.IO v4**: Modern real-time iletişim
- ✅ **Otomatik başlatma**: Sistem başlangıcında otomatik çalışır
- ✅ **Sistem servisi**: Arka planda sürekli çalışır
- ✅ **Uzaktan komut**: Dashboard'dan komut gönder, sonucu al
- ✅ **Kolay kurulum**: Tek tıkla kurulum scriptleri

## 🚀 Hızlı Başlangıç

### Windows

1. `builds/go-terminal-windows-amd64.exe` dosyasını kopyala
2. Klasöre git ve Administrator olarak CMD/PowerShell aç
3. Kurulum scriptini çalıştır:
```cmd
install-windows.bat
```

### macOS

1. Terminal'i aç ve klasöre git:
```bash
cd go-terminal
```

2. Kurulum scriptini çalıştır:
```bash
sudo ./install-macos.sh
```

### Linux

1. Terminal'i aç ve klasöre git:
```bash
cd go-terminal
```

2. Kurulum scriptini çalıştır:
```bash
sudo ./install-linux.sh
```

**Hepsi bu kadar!** Servis otomatik olarak başlar ve sistem başlangıcında çalışacak şekilde ayarlanır.

## Kurulum

### 1. Binary'yi İndir veya Build Et

#### Hazır Binary Kullan (Önerilen)

`builds/` klasöründen sisteminize uygun binary'yi seçin:
- Windows (64-bit): `go-terminal-windows-amd64.exe`
- Windows (32-bit): `go-terminal-windows-386.exe`
- macOS (Intel): `go-terminal-macos-amd64`
- macOS (M1/M2/M3): `go-terminal-macos-arm64`
- Linux (64-bit): `go-terminal-linux-amd64`
- Linux (32-bit): `go-terminal-linux-386`
- Linux (ARM/Raspberry Pi): `go-terminal-linux-arm64`

#### Kendin Build Et

**Tek platform için:**
```bash
# macOS/Linux
go build -o go-terminal main.go

# Windows
go build -o go-terminal.exe main.go
```

**Tüm platformlar için (cross-compilation):**
```bash
chmod +x build.sh
./build.sh
```

Bu komut `builds/` klasöründe tüm platformlar için binary'ler oluşturur.

### 2. Otomatik Kurulum (Önerilen)

Sisteminize uygun kurulum scriptini çalıştırın:

**Windows (Administrator olarak CMD veya PowerShell):**
```cmd
install-windows.bat
```

**macOS:**
```bash
sudo ./install-macos.sh
```

**Linux:**
```bash
sudo ./install-linux.sh
```

Kurulum scripti otomatik olarak:
- ✅ Sisteminize uygun binary'yi seçer
- ✅ Terminal ID'yi sorar (varsayılan: 1)
- ✅ Environment variable ayarlar
- ✅ Servisi kurar
- ✅ Servisi başlatır

### 3. Manuel Kurulum

**Adım 1: Servisi Sisteme Kur**

**macOS/Linux:**
```bash
sudo ./go-terminal install
```

**Windows (Administrator olarak):**
```cmd
go-terminal.exe install
```

**Adım 2: Terminal ID Ayarla (Opsiyonel)**

**Windows:**
```cmd
setx TERMINAL_ID "1" /M
```

**macOS/Linux:**
```bash
export TERMINAL_ID=1
echo "export TERMINAL_ID=1" >> ~/.zshrc
```

**Adım 3: Servisi Başlat**

**macOS/Linux:**
```bash
sudo ./go-terminal start
```

**Windows:**
```cmd
go-terminal.exe start
```

## Kullanım

### Komutlar

```bash
# Servisi kur (sistem başlangıcında otomatik başlar)
./go-terminal install

# Servisi başlat
./go-terminal start

# Servisi durdur
./go-terminal stop

# Servisi yeniden başlat
./go-terminal restart

# Servisi kaldır
./go-terminal uninstall

# Normal çalıştır (servis olmadan, test için)
./go-terminal
```

### Terminal ID Değiştirme

Varsayılan terminal ID: **1**

Farklı bir ID kullanmak için:

**macOS/Linux:**
```bash
export TERMINAL_ID=2
./go-terminal
```

**Windows:**
```cmd
set TERMINAL_ID=2
go-terminal.exe
```

Servis olarak çalıştırırken ID değiştirmek için `/etc/environment` veya Windows Environment Variables'dan `TERMINAL_ID` değişkenini ayarlayın.

## Servis Yönetimi

### macOS

Servis dosyası: `~/Library/LaunchAgents/GoTerminalClient.plist`

```bash
# Status kontrol
launchctl list | grep GoTerminalClient

# Log görüntüleme
tail -f /var/log/GoTerminalClient.log
```

### Linux (systemd)

Servis dosyası: `/etc/systemd/system/GoTerminalClient.service`

```bash
# Status kontrol
systemctl status GoTerminalClient

# Log görüntüleme
journalctl -u GoTerminalClient -f
```

### Windows

Servis: "Go Terminal Client"

```cmd
# Status kontrol
sc query GoTerminalClient

# Log görüntüleme (Event Viewer)
eventvwr.msc
```

## Sunucu Ayarları

`main.go` dosyasındaki `serverHost` ve `serverPort` değerlerini değiştirerek farklı sunuculara bağlanabilirsiniz:

```go
const (
	serverHost = "umaigames.com"
	serverPort = "80"
)
```

## Troubleshooting

### Bağlantı Hatası

```bash
# Sunucuya erişim kontrolü
curl http://umaigames.com:80/socket.io/?EIO=4&transport=polling

# Terminal çalışıp çalışmadığını kontrol
# macOS/Linux:
ps aux | grep go-terminal

# Windows:
tasklist | findstr go-terminal
```

### Servis Başlatma Hatası

```bash
# macOS/Linux - izinleri kontrol et
sudo chown root:wheel go-terminal
sudo chmod +x go-terminal

# Logları kontrol et
tail -f /var/log/GoTerminalClient.log
```

## Dashboard'dan Test

1. `http://umaigames.com` adresini aç
2. Application ID: **1** seç (veya ayarladığın ID)
3. **Run** kısmından komut gönder:
   - `ls` - dosyaları listele
   - `pwd` - mevcut dizini göster
   - `whoami` - kullanıcı adını göster
   - `echo test` - test çıktısı
4. Sonuç **CMD Result** alanında görünecek

## Build (Farklı Platformlar İçin)

```bash
# macOS
GOOS=darwin GOARCH=amd64 go build -o go-terminal-mac main.go

# Windows
GOOS=windows GOARCH=amd64 go build -o go-terminal.exe main.go

# Linux
GOOS=linux GOARCH=amd64 go build -o go-terminal-linux main.go

# macOS Apple Silicon (M1/M2)
GOOS=darwin GOARCH=arm64 go build -o go-terminal-mac-arm64 main.go
```

## Lisans

Bu proje [Electron Multi-Screen Capture](https://github.com/username/Multi-Screen-Capture-with-Electron-App) projesinin bir parçasıdır.
