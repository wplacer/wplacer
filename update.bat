@echo off
setlocal enabledelayedexpansion

echo Verifying Git Installation...
git --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Git found!
    echo.
    goto :git_pull
)

echo Git not found!
echo.

echo Checking if winget is available...
winget --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Winget not found!
    echo.
    echo Winget is required to install Git automatically.
    echo Please install Git manually at: https://git-scm.com/
    echo Or upgrade to Windows 10 version 1809+ or Windows 11.
    echo.
    pause
    exit /b 1
)

echo Winget found!
echo.

echo Installing Git with winget...
echo This can take a few minutes.
echo.
winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements

if %errorlevel% neq 0 (
    echo.
    echo Installation failed!
    echo Try to install manually at: https://git-scm.com/
    echo.
    pause
    exit /b 1
)

echo.
echo Git successfully installed!
echo.
echo Git has been installed and PATH updated by winget.
echo To use Git, you must restart your command prompt (terminal) for PATH changes to take effect.
echo After restarting, please run this script again.
echo.
pause
exit /b 0

:git_pull

echo Repository:
git remote get-url origin 2>nul
if %errorlevel% neq 0 (
    echo Could not determine the remote repository.
    echo Make sure you are in a folder with an initialized Git repository.
    echo.
    goto :end
)

echo.
echo Current branch:
git branch --show-current 2>nul
if %errorlevel% neq 0 (
    echo Could not determine current branch.
)
echo.

echo Checking for changes...
git fetch origin 2>&1
if %errorlevel% neq 0 (
    echo Warning: Could not fetch from remote repository.
    echo Note: Without a successful fetch, 'git pull' will likely fail. Please check your internet connection and remote repository configuration.
    echo.
)

echo Updating repository...
git pull

if %errorlevel% equ 0 (
    echo.
    echo Repository updated successfully!
) else (
    echo.
    echo Error updating the repository.
    echo Possible causes:
    echo - No internet connection
    echo - Authentication required
    echo - Merge conflicts
    echo - No remote repository configured
    echo.
    echo You may need to resolve conflicts manually or check your credentials.
)

:end
echo.
echo All done!
pause