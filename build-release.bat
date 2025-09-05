@echo off
rem 设置控制台编码为UTF-8
chcp 65001 >nul 2>&1

echo ================================
echo DeepLearn Assistant - Build Tool
echo ================================
echo.

echo [INFO] Checking Node.js environment...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found, please install Node.js first
    echo Download: https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js environment ready

if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    npm install
    if errorlevel 1 (
        echo [ERROR] Dependencies installation failed
        pause
        exit /b 1
    )
)

echo [INFO] Cleaning old files...
npm run clean

echo [INFO] Building obfuscated version...
npm run build
if errorlevel 1 (
    echo [ERROR] Build failed
    pause
    exit /b 1
)

echo [INFO] Creating distribution package...
npm run pack
if errorlevel 1 (
    echo [ERROR] Packaging failed
    pause
    exit /b 1
)

echo.
echo [SUCCESS] Build completed!
echo [OUTPUT] Obfuscated files: dist/ directory
echo [OUTPUT] Distribution packages: release/ directory
echo.
echo [NOTICE] Installation guide:
echo    Chrome users: Use .zip file (extract and install)
echo    Edge users:   Use -edge folder (select folder directly)
echo.
echo Press any key to open release directory...
pause >nul
start explorer release\