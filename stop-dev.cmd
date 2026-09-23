@echo off
setlocal
cd /d "%~dp0"
"%USERPROFILE%\Documents\Codex\tools\node-v24.21.0-win-x64\node.exe" server\stop.js
pause
