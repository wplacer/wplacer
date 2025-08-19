@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

set NEED_INSTALL=0
if not exist "node_modules\" (
  set NEED_INSTALL=1
) else (
  call npm ls --depth=1 >nul 2>&1
  if errorlevel 1 set NEED_INSTALL=1
)

if %NEED_INSTALL%==1 (
  echo [setup] Installing dependencies…
  if exist "package-lock.json" (
    call npm ci
  ) else (
    call npm install
  )
)

call cls
echo [run] npm start
call npm start
pause >nul
