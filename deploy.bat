@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

echo 🚀 深学助手认证系统部署开始...

REM 检查 Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js 未安装，请先安装 Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

REM 检查 npm
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ npm 未安装，请检查 Node.js 安装
    pause
    exit /b 1
)

echo ✅ Node.js 环境检查通过

REM 检查 Vercel CLI
vercel --version >nul 2>&1
if errorlevel 1 (
    echo ⚠️ Vercel CLI 未安装，正在安装...
    npm install -g vercel
    if errorlevel 1 (
        echo ❌ Vercel CLI 安装失败
        pause
        exit /b 1
    )
    echo ✅ Vercel CLI 安装成功
)

echo 📦 安装项目依赖...
npm install
if errorlevel 1 (
    echo ❌ 依赖安装失败
    pause
    exit /b 1
)
echo ✅ 依赖安装成功

REM 检查环境变量配置
if not exist ".env" (
    echo ⚠️ 未找到 .env 文件，请先配置环境变量
    echo 📝 请复制 .env.example 为 .env 并填入真实配置：
    echo    copy .env.example .env
    echo    然后编辑 .env 文件填入您的数据库和JWT配置
    pause
    exit /b 1
)

echo 🌐 开始部署到 Vercel...

REM 检查登录状态
vercel whoami >nul 2>&1
if errorlevel 1 (
    echo 🔑 请先登录 Vercel...
    vercel login
    if errorlevel 1 (
        echo ❌ Vercel 登录失败
        pause
        exit /b 1
    )
)

echo 🚀 正在部署项目...
vercel --prod --confirm
if errorlevel 1 (
    echo ❌ 项目部署失败
    pause
    exit /b 1
)

echo ✅ 项目部署成功！

REM 获取部署URL (需要手动输入)
echo.
echo 📝 请从上面的输出中复制您的 Vercel 项目URL
echo 格式类似: https://your-project-name.vercel.app
set /p VERCEL_URL="请输入您的Vercel项目URL: "

if not "!VERCEL_URL!"=="" (
    echo 🔧 正在更新API配置...
    
    REM 使用 PowerShell 进行文件替换
    powershell -Command "(Get-Content 'extension/popup.js') -replace 'https://your-vercel-project.vercel.app', '!VERCEL_URL!' | Set-Content 'extension/popup.js'"
    powershell -Command "(Get-Content 'content/loader.js') -replace 'https://your-vercel-project.vercel.app', '!VERCEL_URL!' | Set-Content 'content/loader.js'"
    
    echo ✅ API配置已更新
    
    echo 🔨 重新构建Chrome扩展...
    npm run build
    if errorlevel 1 (
        echo ❌ 扩展构建失败
    ) else (
        echo ✅ 扩展构建成功！
    )
)

echo.
echo 🎉 部署完成！
echo 📋 下一步操作：
echo    1. 在 SQLPub 中执行 database/init.sql 初始化数据库
echo    2. 在 Vercel Dashboard 中设置环境变量
echo    3. 在 Chrome 中加载 dist/ 目录测试扩展
echo    4. 测试注册、登录和认证功能
echo.
echo ✨ 深学助手认证系统部署完成！
pause