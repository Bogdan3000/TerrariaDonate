@echo off
title BDPTI Dashboard
echo =====================================
echo    🚀 Запуск BDPTI Dashboard
echo =====================================

REM Переходим в папку проекта (если батник не лежит рядом с package.json — укажи путь)
cd /d "%~dp0"

REM Проверяем, есть ли node_modules
if not exist node_modules (
    echo 📦 Устанавливаю зависимости...
    call npm install
)

REM Запуск backend'а
echo 🔄 Запускаю сервер...
call npm run start

pause