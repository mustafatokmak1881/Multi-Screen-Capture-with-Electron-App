@echo off
REM Windows Installation Script for Go Terminal Client
REM Run this script as Administrator

echo ========================================
echo Go Terminal Client - Windows Kurulum
echo ========================================
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo HATA: Bu script Administrator olarak calistirilmali!
    echo.
    echo Sag tik yapip "Run as Administrator" secin.
    pause
    exit /b 1
)

REM Set the terminal ID (default: 1)
set /p TERMINAL_ID="Terminal ID girin (varsayilan: 1): "
if "%TERMINAL_ID%"=="" set TERMINAL_ID=1

echo.
echo Terminal ID: %TERMINAL_ID% olarak ayarlandi.
echo.

REM Set environment variable permanently
setx TERMINAL_ID "%TERMINAL_ID%" /M
echo Environment variable ayarlandi.
echo.

REM Install service
echo Servis kuruluyor...
go-terminal.exe install
if %errorLevel% neq 0 (
    echo HATA: Servis kurulamadi!
    pause
    exit /b 1
)

echo.
echo Servis baslatiliyor...
go-terminal.exe start
if %errorLevel% neq 0 (
    echo HATA: Servis baslatilamadi!
    pause
    exit /b 1
)

echo.
echo ========================================
echo KURULUM TAMAMLANDI!
echo ========================================
echo.
echo Terminal ID: %TERMINAL_ID%
echo Servis Adi: GoTerminalClient
echo.
echo Servis yonetimi:
echo - Baslatma: go-terminal.exe start
echo - Durdurma: go-terminal.exe stop
echo - Yeniden baslat: go-terminal.exe restart
echo - Kaldirma: go-terminal.exe uninstall
echo.
echo Servis durumu:
sc query GoTerminalClient
echo.
pause
