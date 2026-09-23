@echo off
setlocal
cd /d "%~dp0"
set "NODE_DIR=%USERPROFILE%\Documents\Codex\tools\node-v24.21.0-win-x64"
if not exist "%NODE_DIR%\node.exe" (
  echo Node.js not found. See README.md.
  pause
  exit /b 1
)
set "PATH=%NODE_DIR%;%USERPROFILE%\Documents\Codex\tools\MinGit-2.55.0.5\cmd;%USERPROFILE%\Documents\Codex\tools\MinGit-2.55.0.5\mingw64\bin;%PATH%"
if not exist "node_modules\vite\bin\vite.js" (
  echo Run npm install first. See README.md.
  pause
  exit /b 1
)
echo Open http://127.0.0.1:5173/ in your browser.
echo Press Ctrl+C to stop.
call npm.cmd run dev
pause
