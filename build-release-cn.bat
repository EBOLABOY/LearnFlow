@echo off
rem 确保批处理文件使用正确的编码
chcp 936 >nul 2>&1

echo ================================
echo 深学助手 - 自动打包工具
echo ================================
echo.

echo [信息] 正在检查Node.js环境...
node --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到Node.js，请先安装Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

echo [成功] Node.js环境正常

if not exist "node_modules" (
    echo [信息] 正在安装依赖包...
    npm install
    if errorlevel 1 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
)

echo [信息] 正在清理旧文件...
npm run clean

echo [信息] 正在构建混淆版本...
npm run build
if errorlevel 1 (
    echo [错误] 构建失败
    pause
    exit /b 1
)

echo [信息] 正在创建分发包...
npm run pack
if errorlevel 1 (
    echo [错误] 打包失败
    pause
    exit /b 1
)

echo.
echo [完成] 打包完成！
echo [输出] 混淆文件位于: dist\ 目录
echo [输出] 分发包位于: release\ 目录
echo.
echo [说明] 分发说明:
echo    Chrome用户: 使用 .zip 压缩包（解压后安装）
echo    Edge用户:   使用 -edge 文件夹（直接选择文件夹）
echo.
echo 按任意键打开release目录...
pause >nul
start explorer release\