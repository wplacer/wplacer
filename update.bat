@echo off
setlocal enabledelayedexpansion

echo Verifying Git Installation...
git --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Git found!
    echo.
    goto :node_version_check
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
echo Git has been installed. To use Git, you must restart your command prompt (terminal) for PATH changes to take effect.
echo After restarting, please run this script again.
echo.
pause
exit /b 0

:node_version_check
echo Verifying Node.js installation and version...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js not found. It is a required dependency.
    goto :install_node_prompt
)

for /f "tokens=1,2 delims=.v" %%a in ('node -v') do (
    set "NODE_MAJOR=%%a"
    set "NODE_MINOR=%%b"
)

set IS_COMPATIBLE=1
if !NODE_MAJOR! LSS 20 set IS_COMPATIBLE=0
if !NODE_MAJOR! EQU 20 if !NODE_MINOR! LSS 6 set IS_COMPATIBLE=0

if !IS_COMPATIBLE! equ 1 (
    echo Node.js version is compatible (v!NODE_MAJOR!.!NODE_MINOR!.x found).
    echo.
    goto :git_pull
) else (
    echo Your Node.js version (v!NODE_MAJOR!.!NODE_MINOR!.x) is outdated.
    echo This project requires Node.js v20.6.0 or newer.
    goto :install_node_prompt
)

:install_node_prompt
echo.
winget --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Winget not found! Cannot install Node.js automatically.
    echo.
    echo Please install/upgrade Node.js manually from:
    echo https://nodejs.org/en/download/current
    echo.
    pause
    exit /b 1
)

echo Winget is available to help.
set /p "CHOICE=Do you want to install/upgrade Node.js automatically using winget? (Y/N): "
if /i "!CHOICE!" neq "Y" (
    echo.
    echo Action cancelled by user.
    echo Please install Node.js v20.6.0+ manually to proceed.
    echo https://nodejs.org/en/download/current
    echo.
    pause
    exit /b 1
)

echo.
echo Installing/Upgrading Node.js with winget...
echo This may take a few minutes.
echo.
winget install -e --id OpenJS.NodeJS --source winget --accept-package-agreements --accept-source-agreements

if %errorlevel% neq 0 (
    echo.
    echo Installation failed!
    echo Please try to install/upgrade manually from: https://nodejs.org/en/download/current
    echo.
    pause
    exit /b 1
)

echo.
echo Node.js successfully installed/upgraded!
echo.
echo You MUST restart your command prompt (terminal) for PATH changes to take effect.
echo After restarting, please run this script again to complete the update.
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
    
    rem -- New section to run npm install after a successful pull --
    if exist package.json (
        echo.
        echo Checking for Node.js package updates...
        npm install
        
        if %errorlevel% equ 0 (
            echo.
            echo Node.js packages are up to date!
        ) else (
            echo.
            echo Error: 'npm install' failed.
            echo Please check your Node.js and npm setup. You may need to run 'npm install' manually.
        )
    )

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
