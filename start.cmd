@echo off
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Counting Desk needs Node.js 22 or newer.
  echo Install Node.js, then run start.cmd again.
  pause
  exit /b 1
)

node server.mjs
set "exitCode=%errorlevel%"
if not "%exitCode%"=="0" (
  echo.
  echo Counting Desk stopped with an error.
  pause
)
exit /b %exitCode%
