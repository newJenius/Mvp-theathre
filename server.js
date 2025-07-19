require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const Queue = require('bull');
const WebSocket = require('ws');

const app = express();
const port = process.env.PORT || 3000;

// CORS настройки
app.use(cors({
  origin: [
    'https://api.nermes.xyz',
    'http://localhost:3000',
    'https://mvp-theathre.vercel.app',
    'https://vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Создаём очередь для обработки видео
const videoQueue = new Queue('video-processing', {
  redis: { 
    port: 6379, 
    host: '127.0.0.1',
    maxRetriesPerRequest: null
  }
});

// Создаём HTTP сервер
const server = require('http').createServer(app);

// WebSocket сервер для уведомлений (на том же порту)
const wss = new WebSocket.Server({ server });

// Хранилище подключений пользователей
const userConnections = new Map();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const userId = url.searchParams.get('userId');
  
  if (userId) {
    userConnections.set(userId, ws);
    console.log(`Пользователь ${userId} подключился к WebSocket`);
  }
  
  ws.on('close', () => {
    // Удаляем подключение при отключении
    for (const [uid, connection] of userConnections.entries()) {
      if (connection === ws) {
        userConnections.delete(uid);
        console.log(`Пользователь ${uid} отключился от WebSocket`);
        break;
      }
    }
  });
});

// Функция для отправки уведомления пользователю
function notifyUser(userId, message) {
  const ws = userConnections.get(userId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

const upload = multer({ dest: 'uploads/' });

// API для загрузки видео
app.post('/upload', upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'cover', maxCount: 1 }
]), async (req, res) => {
  try {
    const videoFile = req.files['video'][0];
    const coverFile = req.files['cover'][0];
    const inputPath = videoFile.path;
    const coverPath = coverFile.path;
    const { title, description, user_id, premiere_at } = req.body;

    // Добавляем задачу в очередь
    const job = await videoQueue.add({
      inputPath,
      coverPath,
      title,
      description,
      user_id,
      premiere_at,
      originalName: videoFile.originalname,
      originalNameCover: coverFile.originalname
    }, {
      attempts: 3, // Количество попыток при ошибке
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });

    // Получаем информацию о позиции в очереди
    const waitingJobs = await videoQueue.getWaiting();
    const position = waitingJobs.findIndex(j => j.id === job.id) + 1;

    console.log(`Видео добавлено в очередь. ID: ${job.id}, Позиция: ${position}`);

    res.json({ 
      message: 'Видео добавлено в очередь обработки',
      jobId: job.id,
      queuePosition: position,
      estimatedTime: position * 10 // примерное время в минутах (10 мин на видео)
    });

  } catch (error) {
    console.error('Ошибка добавления в очередь:', error);
    res.status(500).json({ 
      error: 'Ошибка добавления видео в очередь', 
      details: error.message 
    });
  }
});

// API для проверки статуса обработки
app.get('/status/:jobId', async (req, res) => {
  try {
    const job = await videoQueue.getJob(req.params.jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }

    const state = await job.getState();
    const progress = job._progress;
    const result = job.returnvalue;

    res.json({
      jobId: job.id,
      state: state, // 'waiting', 'active', 'completed', 'failed'
      progress: progress,
      result: result,
      failedReason: job.failedReason
    });

  } catch (error) {
    console.error('Ошибка получения статуса:', error);
    res.status(500).json({ 
      error: 'Ошибка получения статуса', 
      details: error.message 
    });
  }
});

// API для получения информации об очереди
app.get('/queue-info', async (req, res) => {
  try {
    const waiting = await videoQueue.getWaiting();
    const active = await videoQueue.getActive();
    const completed = await videoQueue.getCompleted();
    const failed = await videoQueue.getFailed();

    res.json({
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      total: waiting.length + active.length + completed.length + failed.length
    });

  } catch (error) {
    console.error('Ошибка получения информации об очереди:', error);
    res.status(500).json({ 
      error: 'Ошибка получения информации об очереди', 
      details: error.message 
    });
  }
});

server.listen(port, () => {
  console.log(`Backend сервер с WebSocket запущен на порту ${port}`);
}); 