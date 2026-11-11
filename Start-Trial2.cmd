@echo off
cd /d "%~dp0"
docker compose -f compose.trial2.yaml up -d --build
if errorlevel 1 (
  echo Trial 2 could not start. Check Docker Desktop and port 8641.
  pause
  exit /b 1
)
start "" "http://127.0.0.1:8641"
