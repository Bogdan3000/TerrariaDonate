@echo off
chcp 65001 >nul
title BDPTI Dashboard

echo =====================================
echo   🚀 Запуск BDPTI Dashboard
echo =====================================

REM Переход в папку проекта (где лежит package.json)
cd /d "%~dp0"

REM Включаем поддержку русских символов
set LANG=ru_RU.UTF-8
set LC_ALL=ru_RU.UTF-8

REM Проверяем наличие зависимостей
if not exist node_modules (
    echo 📦 Устанавливаю зависимости...
    call npm install
)

REM Запуск приложения (Electron)
echo 🔄 Запускаю BDPTI Dashboard в режиме приложения...
call npm run desktop

echo =====================================
echo   💡 Работа завершена
echo =====================================
pause