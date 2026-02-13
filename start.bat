@echo off
echo ========================================
echo  启动双语语言实验服务器
echo ========================================
echo.

REM 检查 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 未找到 Node.js！
    echo 请从 https://nodejs.org/ 下载并安装
    pause
    exit /b 1
)

echo ✅ Node.js 已安装
echo.

REM 安装依赖
echo 📦 正在安装依赖...
call npm install
echo.

REM 启动服务器
echo 🚀 启动服务器...
echo.
node server.js
pause