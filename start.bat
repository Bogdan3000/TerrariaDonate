@echo off
title BDPTI Dashboard
echo =====================================
echo   🚀 Starting BDPTI Dashboard
echo =====================================

REM Go to project directory
cd /d "%~dp0"

REM Check dependencies
if not exist node_modules (
    echo Installing dependencies...
    call npm install
)

REM Start the backend
echo Starting the server...
call npm run desktop

pause