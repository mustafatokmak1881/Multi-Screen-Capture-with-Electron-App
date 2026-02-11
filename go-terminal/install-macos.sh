#!/bin/bash

# macOS Installation Script for Go Terminal Client
# Run with: sudo ./install-macos.sh

echo "========================================"
echo "Go Terminal Client - macOS Kurulum"
echo "========================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "HATA: Bu script sudo ile calistirilmali!"
    echo ""
    echo "Kullanim: sudo ./install-macos.sh"
    exit 1
fi

# Detect architecture
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    BINARY="builds/go-terminal-macos-arm64"
    echo "Apple Silicon (M1/M2/M3) tespit edildi."
elif [ "$ARCH" = "x86_64" ]; then
    BINARY="builds/go-terminal-macos-amd64"
    echo "Intel Mac tespit edildi."
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

# Set environment variable
echo "export TERMINAL_ID=$TERMINAL_ID" >> ~/.zshrc
echo "export TERMINAL_ID=$TERMINAL_ID" >> ~/.bash_profile
echo "Environment variable ayarlandi."
echo ""

# Install service
echo "Servis kuruluyor..."
./go-terminal install
if [ $? -ne 0 ]; then
    echo "HATA: Servis kurulamadi!"
    exit 1
fi

echo ""
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
echo "Servis durumu:"
launchctl list | grep GoTerminalClient
echo ""
echo "Loglar:"
echo "  tail -f /var/log/GoTerminalClient.log"
echo ""
