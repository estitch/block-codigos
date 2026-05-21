@echo off
title Tienda Teleactiva - Puerto 3031
cd /d "%~dp0"
echo.
echo  =========================================
echo   TIENDA TELEACTIVA  ^|  puerto 3031
echo  =========================================
echo.
node tienda-server.js
pause
