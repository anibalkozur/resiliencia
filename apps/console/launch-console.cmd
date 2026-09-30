@echo off
title ResiliencIA Console (dev)
cd /d "%~dp0"
echo Arrancando ResiliencIA Console...
echo.
echo Para detener la app, cerra la ventana de Electron o presiona Ctrl+C aca.
echo.
set "PNPM=pnpm"
if exist "%APPDATA%\npm\pnpm.cmd" set "PNPM=%APPDATA%\npm\pnpm.cmd"
call "%PNPM%" dev
pause