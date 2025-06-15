@echo off
title PM2 Setup f??r Blackwater Bot
color 0B

echo =========================================
echo     PM2 Setup f??r 24/7 Bot-Betrieb
echo =========================================
echo.

:: Pr??fe ob npm vorhanden ist
where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm nicht gefunden! Installiere Node.js zuerst.
    pause
    exit /b 1
)

:: PM2 installieren
echo [1/4] Installiere PM2 global...
call npm install -g pm2
if errorlevel 1 (
    echo [ERROR] PM2 Installation fehlgeschlagen!
    echo Versuche CMD als Administrator auszuf??hren.
    pause
    exit /b 1
)

:: PM2 Windows Startup installieren
echo.
echo [2/4] Installiere PM2 Windows Startup...
call npm install -g pm2-windows-startup
call pm2-startup install

:: Bot Dependencies installieren
echo.
echo [3/4] Stelle sicher, dass Bot Dependencies installiert sind...
if not exist "node_modules" (
    call npm install
)

:: ecosystem.config.js erstellen
echo.
echo [4/4] Erstelle PM2 Konfiguration...
(
echo module.exports = {
echo   apps: [{
echo     name: 'Blackwater-Bot',
echo     script: './bot.js',
echo     instances: 1,
echo     autorestart: true,
echo     watch: false,
echo     max_memory_restart: '500M',
echo     env: {
echo       NODE_ENV: 'production'
echo     },
echo     error_file: './logs/pm2-error.log',
echo     out_file: './logs/pm2-out.log',
echo     log_file: './logs/pm2-combined.log',
echo     time: true,
echo     merge_logs: true,
echo     min_uptime: '10s',
echo     max_restarts: 10,
echo     restart_delay: 4000,
echo     exp_backoff_restart_delay: 100
echo   }]
echo };
) > ecosystem.config.js

echo.
echo =========================================
echo     PM2 Setup abgeschlossen!
echo =========================================
echo.
echo Verf??gbare Befehle:
echo   pm2 start ecosystem.config.js  - Bot starten
echo   pm2 stop Blackwater-Bot       - Bot stoppen  
echo   pm2 restart Blackwater-Bot    - Bot neustarten
echo   pm2 logs                      - Logs anzeigen
echo   pm2 monit                     - Live Monitoring
echo   pm2 save                      - Konfiguration speichern
echo.
echo M??chtest du den Bot jetzt starten? (J/N)
choice /c JN /n
if errorlevel 2 goto end

:: Bot mit PM2 starten
echo.
echo Starte Bot mit PM2...
call pm2 start ecosystem.config.js
call pm2 save

echo.
echo Bot l??uft jetzt im Hintergrund!
echo Verwende 'pm2 logs' um die Logs zu sehen.

:end
echo.
pause
