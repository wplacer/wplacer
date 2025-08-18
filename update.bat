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

set "NODE_VERSION_STR="
for /f "delims=" %%v in ('node -v') do set "NODE_VERSION_STR=%%v"

rem Extract by character position
set "NODE_MAJOR=!NODE_VERSION_STR:~1,2!"
set "NODE_MINOR=!NODE_VERSION_STR:~4,2!"

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

echo Your Node.js version (!NODE_VERSION_STR!) is outdated or could not be parsed.
echo This project requires Node.js v20.6.0 or newer.
goto :install_node_prompt

:version_is_good
echo Node.js version is compatible (!NODE_VERSION_STR! found).
echo.
goto :nuke_and_reclone


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


:nuke_and_reclone
echo.
echo =================================================================
echo                      NUKE AND RE-CLONE
echo This process will GUARANTEE a clean, up-to-date installation.
echo 	Any and all local changes will be permanently lost.
echo
echo YOUR USER FILES (ACCOUNT COOKIES, TEMPLATES AND WPLACER SETTINGS)
echo WILL BE BACKED UP AND SAFELY RESTORED AFTER THE UPDATE IS DONE.
echo =================================================================
echo.
pause

set "BACKUP_DIR=_update_backup"
set "TEMP_CLONE_DIR=_update_temp_clone"
set "FILES_TO_BACKUP=users.json templates.json settings.json"

echo Determining remote repository URL...
for /f "delims=" %%i in ('git remote get-url origin') do set "REMOTE_URL=%%i"
if not defined REMOTE_URL (
    echo.
    echo ============================= ERROR =============================
    echo 	Could not determine the remote repository URL.
    echo     Make sure you are running this in the correct folder.
    echo 		       Update cannot proceed.
    echo =================================================================
    echo.
    goto :final_pause
)
echo Found remote: !REMOTE_URL!
echo.

echo Backing up user files...
if exist "!BACKUP_DIR!" rd /s /q "!BACKUP_DIR!"
mkdir "!BACKUP_DIR!"
for %%f in (%FILES_TO_BACKUP%) do (
    if exist "%%f" (
        copy "%%f" "!BACKUP_DIR!\" >nul
        echo   - Backed up %%f
    )
)
echo.

echo Cloning latest version into a temporary folder...
if exist "!TEMP_CLONE_DIR!" rd /s /q "!TEMP_CLONE_DIR!"
git clone "!REMOTE_URL!" "!TEMP_CLONE_DIR!"
if %errorlevel% neq 0 (
    echo.
    echo ============================= ERROR =============================
    echo Failed to clone the repository. The script cannot proceed.
    echo             Please check your internet connection.
    echo =================================================================
    echo.
    goto :cleanup_and_fail
)
echo Clone successful.
echo.

echo Wiping the current directory (except this script)...
for /d %%d in (*) do (
    if /i not "%%d" == "!BACKUP_DIR!" if /i not "%%d" == "!TEMP_CLONE_DIR!" (
        echo   - Deleting folder: %%d
        rd /s /q "%%d"
    )
)
for %%f in (*) do (
    if /i not "%%~nxf" == "%~nx0" (
        echo   - Deleting file: %%f
        del /f /q "%%f"
    )
)
echo Wipe complete.
echo.

echo Preparing new update script...
if exist "!TEMP_CLONE_DIR!\update.bat" (
    ren "!TEMP_CLONE_DIR!\update.bat" "update_new.bat"
    echo   - Renamed new updater to update_new.bat to prevent conflicts.
)
echo.

echo Moving new version into place...
xcopy "!TEMP_CLONE_DIR!\*" ".\" /e /h /y /q
if %errorlevel% neq 0 (
    echo.
    echo ============================= ERROR =============================
    echo 	Failed to move new files from temporary clone.
    echo How did we get here? I don't know. But the package is now broken.
    echo =================================================================
    echo.
    goto :cleanup_and_fail
)
echo Move successful.
echo.

echo Restoring user files...
if exist "!BACKUP_DIR!" (
    xcopy "!BACKUP_DIR!\*" ".\" /y /q
    echo   - Restore complete.
)
echo.

echo Cleaning up temporary folders...
if exist "!BACKUP_DIR!" rd /s /q "!BACKUP_DIR!"
if exist "!TEMP_CLONE_DIR!" rd /s /q "!TEMP_CLONE_DIR!"
echo.

if exist package.json (
    echo Checking for Node.js package updates...
    npm install
    if %errorlevel% equ 0 (
        echo Node.js packages are up to date!
    ) else (
        echo.
        echo ============================ WARNING ============================
        echo 	'npm install' failed. The project files are updated,
        echo     but you may need to run 'npm install' manually.
        echo ===============================================================
    )
    echo.
)

echo =================================================================
echo                     UPDATE COMPLETE!
echo.
echo The project has been completely refreshed to the latest version.
echo.
echo ========================= IMPORTANT =========================
echo A new update script has been downloaded as 'update_new.bat'.
echo Because a running script cannot update itself, you must
echo         perform the following steps MANUALLY:
echo.
echo 1. Close this window.
echo 2. Delete this old script ('%~nx0').
echo 3. Rename 'update_new.bat' to 'update.bat'.
echo.
echo This is the only way to ensure future updates work correctly.
echo =================================================================
goto :end

:cleanup_and_fail
echo.
echo An error occurred during the update process.
echo The update has failed, and the folder may be in an inconsistent state.
echo Your backed up data files (if any) are in the '!BACKUP_DIR!' folder.
echo Please restore them manually and re-clone the repository.
goto :end

:end
echo.
echo All done!

:final_pause
