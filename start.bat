@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

set "PKG_MANAGER="

rem Check for pnpm command availability
call pnpm -v >nul 2>&1
if !errorlevel! equ 0 (
    set "PKG_MANAGER=pnpm"
) else (
    rem pnpm not found, check if npm has been used
    if exist "package-lock.json" (
        set "PKG_MANAGER=npm"
    ) else (
        rem pnpm is not installed and npm hasn't been used. Recommend pnpm.
        echo [setup] This project recommends using pnpm, but it is not found.
        echo You can install it globally via: npm install -g pnpm
        echo.
        set /p "USE_NPM=Would you like to use npm instead? [Y/n] "
        if /i "!USE_NPM!"=="n" (
            echo Operation cancelled by user.
            pause
            exit /b
        )
        set "PKG_MANAGER=npm"
    )
)

echo [info] Using %PKG_MANAGER%...

set NEED_INSTALL=0
if not exist "node_modules\" (
  set NEED_INSTALL=1
) else (
  if "%PKG_MANAGER%"=="pnpm" (
    call pnpm ls --depth=0 >nul 2>&1
  ) else (
    call npm ls --depth=0 >nul 2>&1
  )
  if !errorlevel! neq 0 set NEED_INSTALL=1
)

if %NEED_INSTALL%==1 (
  echo [setup] Installing dependencies with %PKG_MANAGER%...
  if "%PKG_MANAGER%"=="pnpm" (
    call pnpm install
  ) else (
    if exist "package-lock.json" (
        call npm ci
    ) else (
        call npm install
    )
  )
)

call cls
echo [run] %PKG_MANAGER% start
call %PKG_MANAGER% start
pause >nul
