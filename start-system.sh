#!/bin/bash

echo "Запуск системы обработки видео..."

# Проверяем, установлен ли Redis
if ! command -v redis-server &> /dev/null; then
    echo "Redis не установлен. Устанавливаем..."
    sudo apt update
    sudo apt install redis-server -y
    sudo systemctl enable redis-server
fi

# Запускаем Redis, если не запущен
if ! systemctl is-active --quiet redis-server; then
    echo "Запускаем Redis..."
    sudo systemctl start redis-server
fi

# Проверяем, что Redis работает
if ! redis-cli ping &> /dev/null; then
    echo "Ошибка: Redis не отвечает"
    exit 1
fi

echo "Redis запущен и работает"

# Переходим в папку проекта
cd "$(dirname "$0")"

# Устанавливаем зависимости, если нужно
if [ ! -d "node_modules" ]; then
    echo "Устанавливаем зависимости..."
    npm install
fi

# Запускаем процессор очереди в фоне
echo "Запускаем процессор очереди..."
node queue-processor.js &
QUEUE_PID=$!

# Ждём немного, чтобы процессор запустился
sleep 2

# Запускаем основной сервер
echo "Запускаем основной сервер..."
node server.js &
SERVER_PID=$!

echo "Система запущена!"
echo "Backend сервер PID: $SERVER_PID"
echo "Процессор очереди PID: $QUEUE_PID"
echo ""
echo "Для остановки нажмите Ctrl+C"

# Функция для корректного завершения
cleanup() {
    echo ""
    echo "Останавливаем систему..."
    kill $SERVER_PID 2>/dev/null
    kill $QUEUE_PID 2>/dev/null
    exit 0
}

# Обработчик сигнала завершения
trap cleanup SIGINT SIGTERM

# Ждём завершения процессов
wait 