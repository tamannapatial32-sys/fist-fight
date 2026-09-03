@echo off
title Fist Fight - Webcam AI Fighting Game
cd /d "%~dp0"
echo =======================================================
echo          FIST FIGHT - WEBCAM AI ARCADE
echo =======================================================
echo Starting local web server...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "server.ps1"
pause
