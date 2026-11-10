@echo off
cd /d "%~dp0"
echo RailSyn - simulation only. Open http://127.0.0.1:8630
node src/server.mjs --open
pause
