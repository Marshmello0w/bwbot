@echo off
title Blackwater Discord Bot
color 0A

echo =========================================
echo     Blackwater Discord Bot Starter
echo =========================================
echo.

:: Pr??fe ob Node.js installiert ist
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js ist nicht installiert!
    echo Bitte installiere Node.js von https://nodejs.org/
    pause
    exit /b 1
)

:: Zeige Node Version
echo [INFO] Node.js Version:
node --version
echo.

:: Pr??fe ob npm packages installiert sind
if not exist "node_modules" (
    echo [INFO] Installiere Dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] Fehler beim Installieren der Dependencies!
        pause
        exit /b 1
    )
    echo.
)

:: Pr??fe ob .env existiert
if not exist ".env" (
    echo [WARNING] .env Datei nicht gefunden!
    echo Erstelle .env Datei mit deinen Zugangsdaten.
    echo.
    pause
)

:: Starte den Bot mit Auto-Restart
:start
cls
echo =========================================
echo     Blackwater Discord Bot
echo     Status: STARTING
echo =========================================
echo.
echo [%date% %time%] Bot wird gestartet...
echo.

:: Starte Node.js mit dem Bot
node bot.js

:: Wenn der Bot abst??rzt
echo.
echo =========================================
echo     Bot wurde beendet!
echo =========================================
echo.

if errorlevel 1 (
    echo [ERROR] Bot ist abgest??rzt! (Exit Code: %errorlevel%)
    echo.
    echo Neustart in 10 Sekunden...
    echo Dr??cke STRG+C zum Beenden.
    timeout /t 10 /nobreak
    goto start
) else (
    echo [INFO] Bot wurde normal beendet.
    echo.
    pause
)
