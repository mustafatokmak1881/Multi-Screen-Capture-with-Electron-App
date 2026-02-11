#!/bin/bash

# Build script for all platforms

echo "Building Go Terminal Client for all platforms..."

# Windows (64-bit)
echo "Building for Windows (amd64)..."
GOOS=windows GOARCH=amd64 go build -o builds/go-terminal-windows-amd64.exe main.go

# Windows (32-bit)
echo "Building for Windows (386)..."
GOOS=windows GOARCH=386 go build -o builds/go-terminal-windows-386.exe main.go

# macOS (Intel)
echo "Building for macOS (amd64)..."
GOOS=darwin GOARCH=amd64 go build -o builds/go-terminal-macos-amd64 main.go

# macOS (Apple Silicon - M1/M2/M3)
echo "Building for macOS (arm64)..."
GOOS=darwin GOARCH=arm64 go build -o builds/go-terminal-macos-arm64 main.go

# Linux (64-bit)
echo "Building for Linux (amd64)..."
GOOS=linux GOARCH=amd64 go build -o builds/go-terminal-linux-amd64 main.go

# Linux (32-bit)
echo "Building for Linux (386)..."
GOOS=linux GOARCH=386 go build -o builds/go-terminal-linux-386 main.go

# Linux (ARM - Raspberry Pi, etc.)
echo "Building for Linux (arm64)..."
GOOS=linux GOARCH=arm64 go build -o builds/go-terminal-linux-arm64 main.go

echo ""
echo "✅ Build completed! Binaries are in the 'builds' directory:"
ls -lh builds/
