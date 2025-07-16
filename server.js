require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const Queue = require('bull');

const app = express();

// CORS настройки
app.use(cors({
  origin: [
    'https://143.198.121.243',
    'http://localhost:3000',
    'https://*.vercel.app',
    'https://vercel.app',
  ],
  credentials: true,
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

const upload = multer({ dest: 'uploads/' });

// API для загрузки видео
app.post('/upload', upload.single('video'), async (req, res) => {
  try {
    const inputPath = req.file.path;
    const { title, description, user_id, premiere_at } = req.body;

    // Добавляем задачу в очередь
    const job = await videoQueue.add({
      inputPath,
      title,
      description,
      user_id,
      premiere_at,
      originalName: req.file.originalname
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

app.listen(4000, () => {
  console.log('Backend сервер с очередью запущен на порту 4000');
}); 