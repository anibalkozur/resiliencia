@echo off
title Banco de pruebas de ejercicios (dev)
cd /d "%~dp0\..\.."

echo Arrancando el banco de pruebas de ejercicios...
echo.
echo 1. Con el celu en la MISMA wifi que esta PC.
echo 2. Escanea el QR con la app Expo Go (celu ^ Android).
echo 3. Presiona s + Enter en esta ventana si no entra por wifi.
echo.
echo Para detener, presiona Ctrl+C o cerra esta ventana.
echo.

if not exist "apps\exercise-tester\node_modules" (
  echo Instalando dependencias de la app por primera vez...
  call "%APPDATA%\npm\pnpm.cmd" install
  if errorlevel 1 (
    echo.
    echo Fallo la instalacion. Revisa tu conexion y volve a intentar.
    pause
    exit /b 1
  )
  echo.
)

set "PNPM=pnpm"
if exist "%APPDATA%\npm\pnpm.cmd" set "PNPM=%APPDATA%\npm\pnpm.cmd"
call "%PNPM%" --filter @resiliencia/exercise-tester start
pause