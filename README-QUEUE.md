# Система очереди обработки видео

Эта система использует Redis и Bull для управления очередью обработки видео, что позволяет:
- Контролировать нагрузку на сервер
- Обрабатывать видео по одному
- Отслеживать статус обработки
- Автоматически повторять обработку при ошибках

## Компоненты системы

1. **Redis** - база данных для хранения очереди
2. **Backend сервер** (`server.js`) - принимает загрузки и добавляет в очередь
3. **Процессор очереди** (`queue-processor.js`) - обрабатывает видео из очереди
4. **Фронтенд** - показывает статус обработки

## Установка и запуск

### 1. Установи Redis на VPS:

```bash
sudo apt update
sudo apt install redis-server -y
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

### 2. Установи зависимости:

```bash
npm install
```

### 3. Запусти систему:

#### Вариант A: Автоматический запуск (рекомендуется)
```bash
chmod +x start-system.sh
./start-system.sh
```

#### Вариант B: Ручной запуск
```bash
# Терминал 1: Запуск процессора очереди
node queue-processor.js

# Терминал 2: Запуск основного сервера
node server.js
```

## API эндпоинты

### POST /upload
Загружает видео в очередь обработки.

**Ответ:**
```json
{
  "message": "Видео добавлено в очередь обработки",
  "jobId": "123",
  "queuePosition": 1,
  "estimatedTime": 10
}
```

### GET /status/:jobId
Проверяет статус обработки видео.

**Ответ:**
```json
{
  "jobId": "123",
  "state": "active", // waiting, active, completed, failed
  "progress": 50,
  "result": {
    "video_url": "https://...",
    "duration": 3600
  },
  "failedReason": null
}
```

### GET /queue-info
Получает информацию об очереди.

**Ответ:**
```json
{
  "waiting": 2,
  "active": 1,
  "completed": 10,
  "failed": 0,
  "total": 13
}
```

## Мониторинг

### Проверка статуса Redis:
```bash
redis-cli ping
```

### Проверка очереди:
```bash
curl https://api.nermes.xyz/queue-info
```

### Просмотр логов:
```bash
# Логи процессора очереди
tail -f /var/log/queue-processor.log

# Логи основного сервера
tail -f /var/log/server.log
```

## Настройка

### Изменение количества одновременных обработок:
В файле `queue-processor.js` измени:
```javascript
const videoQueue = new Queue('video-processing', {
  redis: { port: 6379, host: '127.0.0.1' },
  concurrency: 2 // Количество одновременных обработок
});
```

### Изменение параметров ffmpeg:
В файле `queue-processor.js` настрой параметры обработки:
```javascript
ffmpeg(inputPath)
  .outputOptions('-vf', 'fps=30')
  .outputOptions('-c:v', 'libx264')
  .outputOptions('-preset', 'fast')
  .outputOptions('-crf', '23')
  // Добавь свои параметры
```

## Устранение неполадок

### Redis не запускается:
```bash
sudo systemctl status redis-server
sudo journalctl -u redis-server
```

### Очередь не работает:
1. Проверь, что Redis запущен: `redis-cli ping`
2. Проверь логи процессора очереди
3. Убедись, что все переменные окружения настроены

### Видео не обрабатывается:
1. Проверь, что ffmpeg установлен: `ffmpeg -version`
2. Проверь доступ к Storj и Supabase
3. Проверь логи процессора очереди

## Автозапуск при перезагрузке сервера

### Создай systemd сервис:

```bash
sudo nano /etc/systemd/system/video-processor.service
```

Содержимое:
```ini
[Unit]
Description=Video Processing Queue
After=network.target redis-server.service

[Service]
Type=simple
User=root
WorkingDirectory=/root/onetimeshow
ExecStart=/usr/bin/node queue-processor.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Включи автозапуск:
```bash
sudo systemctl enable video-processor.service
sudo systemctl start video-processor.service
```

## Безопасность

- Ограничь доступ к Redis только с localhost
- Используйте HTTPS для всех API запросов
- Настройте firewall для защиты портов
- Регулярно обновляйте зависимости

## Масштабирование

Для увеличения производительности:
1. Увеличьте количество процессоров очереди
2. Добавьте больше серверов обработки
3. Используйте кластер Redis
4. Оптимизируйте параметры ffmpeg 