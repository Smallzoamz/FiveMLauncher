@echo off
chcp 65001 >nul
title FiveM Launcher - Deploy Script
color 0A

echo ============================================
echo   FiveM Launcher - Auto Deploy Script
echo ============================================
echo.

:: Get current version from package.json
for /f "tokens=2 delims=:, " %%a in ('findstr /C:"\"version\"" package.json') do set CURRENT_VERSION=%%~a
echo Current version: %CURRENT_VERSION%
echo.

:: Ask for new version
set /p NEW_VERSION=Enter new version (e.g. 1.0.2) or press Enter to use %CURRENT_VERSION%: 
if "%NEW_VERSION%"=="" set NEW_VERSION=%CURRENT_VERSION%

echo.
echo New version will be: %NEW_VERSION%
echo.

:: Update package.json version using npm
echo [1/6] Updating package.json version...
call npm version %NEW_VERSION% --no-git-tag-version --allow-same-version
if %errorlevel% neq 0 (
    echo ERROR: Failed to update package.json
    pause
    exit /b 1
)
echo Done!
echo.

:: Git add all changes
echo [2/6] Adding all changes to git...
git add .
if %errorlevel% neq 0 (
    echo ERROR: Failed to git add
    pause
    exit /b 1
)
echo Done!
echo.

:: Git commit
echo [3/6] Committing changes...
set /p COMMIT_MSG=Enter commit message (or press Enter for default): 
if "%COMMIT_MSG%"=="" set COMMIT_MSG=Release v%NEW_VERSION%
git commit -m "%COMMIT_MSG%"
if %errorlevel% neq 0 (
    echo WARNING: Nothing to commit or commit failed
)
echo Done!
echo.

:: Push to main
echo [4/6] Pushing to main branch...
git push origin main
if %errorlevel% neq 0 (
    echo ERROR: Failed to push to main
    pause
    exit /b 1
)
echo Done!
echo.

:: Delete old tag if exists (both local and remote)
echo [5/6] Creating release tag v%NEW_VERSION%...
git tag -d v%NEW_VERSION% 2>nul
git push origin --delete v%NEW_VERSION% 2>nul

:: Create new tag
git tag v%NEW_VERSION%
if %errorlevel% neq 0 (
    echo ERROR: Failed to create tag
    pause
    exit /b 1
)
echo Tag created!
echo.

:: Push tag
echo [6/6] Pushing tag to GitHub...
git push origin v%NEW_VERSION%
if %errorlevel% neq 0 (
    echo ERROR: Failed to push tag
    pause
    exit /b 1
)
echo Done!
echo.

echo ============================================
echo   Deploy Complete!
echo ============================================
echo.
echo Version: v%NEW_VERSION%
echo Tag: v%NEW_VERSION%
echo.
echo GitHub Actions will now build the release.
echo Check: https://github.com/Smallzoamz/FiveMLauncher/actions
echo.
pause
