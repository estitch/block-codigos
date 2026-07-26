@echo off
cd /d "%~dp0"

echo ========================================
echo 1/2 - Ejecutando filter_revqa.py...
echo ========================================
python filter_revqa.py
if %errorlevel% neq 0 (
    echo Error en filter_revqa.py
    pause
    exit /b 1
)
echo OK

echo.
echo ========================================
echo 2/2 - Ejecutando transferir_ids.py...
echo ========================================
python transferir_ids.py
if %errorlevel% neq 0 (
    echo Error en transferir_ids.py
    pause
    exit /b 1
)
echo OK

echo.
echo Proceso completado exitosamente
pause
