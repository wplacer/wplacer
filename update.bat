@echo off

if /i not "%1" == ":run" (
    echo Starting in a new window to ensure the script can pause...
    start "Update Script" cmd /c ""%~f0" :run & pause"
    goto :eof
)

shift /1


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
    goto :final_pause
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
    goto :final_pause
)

echo.
echo Git successfully installed!
echo.
echo Git has been installed. To use Git, you must restart your command prompt (terminal) for PATH changes to take effect.
echo After restarting, please run this script again.
echo.
goto :final_pause

:node_version_check
echo Verifying Node.js installation and version...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js not found. It is a required dependency.
    goto :install_node_prompt
)

rem  So apparently the previous variable name corrupts the environment because batch is actually worthless
set "NODE_VERSION_STR="
for /f "delims=" %%v in ('node -v') do set "NODE_VERSION_STR=%%v"

rem Extract by character position
set "NODE_MAJOR=!NODE_VERSION_STR:~1,2!"
set "NODE_MINOR=!NODE_VERSION_STR:~4,2!"

rem Use a safe variable name: VERSION_OK
set VERSION_OK=0
if defined NODE_MAJOR (
    if !NODE_MAJOR! GTR 20 (
        set VERSION_OK=1
    ) else if !NODE_MAJOR! EQU 20 (
        if !NODE_MINOR! GEQ 6 (
            set VERSION_OK=1
        )
    )
)

if !VERSION_OK! equ 1 goto :version_is_good

echo Your Node.js version (v!NODE_MAJOR!.!NODE_MINOR!.x) is outdated or could not be parsed.
echo This project requires Node.js v20.6.0 or newer.
goto :install_node_prompt

:version_is_good
echo Node.js version is compatible (v!NODE_MAJOR!.!NODE_MINOR!.x found).
echo.
goto :git_pull


:install_node_prompt
echo.
winget --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Winget not found! Cannot install Node.js automatically.
    echo.
    echo Please install/upgrade Node.js manually from:
    echo https://nodejs.org/en/download/current
    echo.
    goto :final_pause
)

echo Winget is available to help.
set /p "CHOICE=Do you want to install/upgrade Node.js automatically using winget? (Y/N): "
if /i "!CHOICE!" neq "Y" (
    echo.
    echo Action cancelled by user.
    echo Please install Node.js v20.6.0+ manually to proceed.
    echo https://nodejs.org/en/download/current
    echo.
    goto :final_pause
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
    goto :final_pause
)

echo.
echo Node.js successfully installed/upgraded!
echo.
echo You MUST restart your command prompt (terminal) for PATH changes to take effect.
echo After restarting, please run this script again to complete the update.
echo.
goto :final_pause


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
goto :final_pause


:final_pause
