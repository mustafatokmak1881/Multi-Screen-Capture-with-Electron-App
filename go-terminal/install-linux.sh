#!/bin/bash

# Linux Installation Script for Go Terminal Client
# Run with: sudo ./install-linux.sh

echo "========================================"
echo "Go Terminal Client - Linux Kurulum"
echo "========================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "HATA: Bu script sudo ile calistirilmali!"
    echo ""
    echo "Kullanim: sudo ./install-linux.sh"
    exit 1
fi

# Detect architecture
ARCH=$(uname -m)
if [ "$ARCH" = "x86_64" ]; then
    BINARY="builds/go-terminal-linux-amd64"
    echo "64-bit Linux tespit edildi."
elif [ "$ARCH" = "i386" ] || [ "$ARCH" = "i686" ]; then
    BINARY="builds/go-terminal-linux-386"
    echo "32-bit Linux tespit edildi."
elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
    BINARY="builds/go-terminal-linux-arm64"
    echo "ARM Linux (Raspberry Pi) tespit edildi."
else
    echo "HATA: Desteklenmeyen mimari: $ARCH"
    exit 1
fi

# Check if binary exists
if [ ! -f "$BINARY" ]; then
    echo "HATA: Binary bulunamadi: $BINARY"
    echo "Once build.sh scriptini calistirin."
    exit 1
fi

# Copy binary to current directory
cp "$BINARY" ./go-terminal
chmod +x ./go-terminal
echo "Binary kopyalandi: ./go-terminal"
echo ""

# Get Terminal ID
read -p "Terminal ID girin (varsayilan: 1): " TERMINAL_ID
TERMINAL_ID=${TERMINAL_ID:-1}

echo ""
echo "Terminal ID: $TERMINAL_ID olarak ayarlandi."
echo ""

# Set environment variable in /etc/environment
if ! grep -q "TERMINAL_ID=" /etc/environment; then
    echo "TERMINAL_ID=$TERMINAL_ID" >> /etc/environment
    echo "Environment variable /etc/environment'a eklendi."
else
    sed -i "s/TERMINAL_ID=.*/TERMINAL_ID=$TERMINAL_ID/" /etc/environment
    echo "Environment variable /etc/environment'da guncellendi."
fi

# Also set for current session
export TERMINAL_ID=$TERMINAL_ID

echo ""

# Install service
echo "Servis kuruluyor..."
./go-terminal install
if [ $? -ne 0 ]; then
    echo "HATA: Servis kurulamadi!"
    exit 1
fi

echo ""

# Reload systemd
systemctl daemon-reload

echo "Servis baslatiliyor..."
./go-terminal start
if [ $? -ne 0 ]; then
    echo "HATA: Servis baslatilamadi!"
    exit 1
fi

echo ""
echo "========================================"
echo "KURULUM TAMAMLANDI!"
echo "========================================"
echo ""
echo "Terminal ID: $TERMINAL_ID"
echo "Servis Adi: GoTerminalClient"
echo ""
echo "Servis yonetimi:"
echo "  - Baslatma: sudo ./go-terminal start"
echo "  - Durdurma: sudo ./go-terminal stop"
echo "  - Yeniden baslat: sudo ./go-terminal restart"
echo "  - Kaldirma: sudo ./go-terminal uninstall"
echo ""
echo "veya systemctl ile:"
echo "  - systemctl status GoTerminalClient"
echo "  - systemctl start GoTerminalClient"
echo "  - systemctl stop GoTerminalClient"
echo "  - systemctl restart GoTerminalClient"
echo ""
echo "Servis durumu:"
systemctl status GoTerminalClient --no-pager
echo ""
echo "Loglar:"
echo "  journalctl -u GoTerminalClient -f"
echo ""
