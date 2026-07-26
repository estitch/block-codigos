@echo off
title Block Codigos - Puerto 3030

pushd "%~dp0"

echo.
echo =========================================
echo  BLOCK CODIGOS ^| puerto 3030
echo =========================================
echo.

REM Obtener la carpeta actual
set "APPDIR=%CD%"

REM Iniciar el servidor
start "Block Codigos" cmd /k "cd /d "%APPDIR%" && node server.js"

REM Esperar unos segundos
timeout /t 5 /nobreak >nul

REM Obtener la primera IPv4
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /i "IPv4"') do (
    set IP=%%i
    goto :ip
)

:ip
set "IP=%IP: =%"

echo Abriendo http://%IP%:3030
start msedge "http://%IP%:3030"

pause