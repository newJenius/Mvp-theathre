require('dotenv').config();
const Queue = require('bull');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { createClient } = require('@supabase/supabase-js');

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Storj S3 client
const s3 = new S3Client({
  endpoint: process.env.STORJ_ENDPOINT,
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.STORJ_ACCESS_KEY,
    secretAccessKey: process.env.STORJ_SECRET_KEY,
  },
  forcePathStyle: true,
});

// Создаём очередь для обработки видео
const videoQueue = new Queue('video-processing', {
  redis: { 
    port: 6379, 
    host: '127.0.0.1',
    maxRetriesPerRequest: null
  }
});

// Обработчик задач в очереди
videoQueue.process(async (job) => {
  console.log(`Начинаю обработку видео: ${job.id}`);
  
  const { 
    inputPath, 
    title, 
    description, 
    user_id, 
    premiere_at, 
    originalName 
  } = job.data;

  const outputPath = path.join('processed', `${Date.now()}_output.mp4`);

  // Убедись, что папка processed существует
  if (!fs.existsSync('processed')) fs.mkdirSync('processed');

  try {
    // Обработка видео через ffmpeg
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions('-vf', 'fps=30')
        .outputOptions('-c:v', 'libx264')
        .outputOptions('-preset', 'fast')
        .outputOptions('-crf', '23')
        .outputOptions('-c:a', 'aac')
        .outputOptions('-b:a', '128k')
        .save(outputPath)
        .on('end', () => {
          console.log(`Видео обработано: ${job.id}`);
          resolve();
        })
        .on('error', (err) => {
          console.error(`Ошибка обработки видео ${job.id}:`, err);
          reject(err);
        });
    });

    // Получаем длительность видео
    let duration = 0;
    await new Promise((resolve) => {
      ffmpeg.ffprobe(outputPath, (err, metadata) => {
        if (!err && metadata && metadata.format && metadata.format.duration) {
          duration = Math.round(metadata.format.duration);
        }
        resolve();
      });
    });

    // Загружаем обработанный файл на Storj
    const fileStream = fs.createReadStream(outputPath);
    const storjKey = `videos/${Date.now()}_${originalName}`;
    
    await s3.send(new PutObjectCommand({
      Bucket: process.env.STORJ_BUCKET,
      Key: storjKey,
      Body: fileStream,
      ContentType: 'video/mp4',
    }));

    const video_url = `${process.env.STORJ_ENDPOINT.replace(/\/$/, '')}/${process.env.STORJ_BUCKET}/${storjKey}`;

    // Сохраняем ссылку и метаданные в Supabase
    const { error } = await supabase.from('videos').insert([
      {
        user_id: user_id || null,
        title: title || null,
        description: description || null,
        cover_url: null,
        video_url,
        premiere_at: premiere_at || null,
        created_At: new Date().toISOString(),
        duration,
      },
    ]);

    if (error) {
      throw new Error(`Ошибка сохранения в Supabase: ${error.message}`);
    }

    // Удаляем временные файлы
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

    console.log(`Видео успешно обработано и загружено: ${job.id}`);
    
    return {
      success: true,
      video_url,
      duration
    };

  } catch (error) {
    // Очищаем временные файлы в случае ошибки
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    
    console.error(`Ошибка обработки видео ${job.id}:`, error);
    throw error;
  }
});

// Обработчики событий очереди
videoQueue.on('completed', (job, result) => {
  console.log(`Задача ${job.id} завершена успешно:`, result);
});

videoQueue.on('failed', (job, err) => {
  console.error(`Задача ${job.id} завершилась с ошибкой:`, err);
});

videoQueue.on('error', (err) => {
  console.error('Ошибка очереди:', err);
});

console.log('Процессор очереди видео запущен и готов к работе...');

// Обработка завершения процесса
process.on('SIGINT', async () => {
  console.log('Завершение работы процессора очереди...');
  await videoQueue.close();
  process.exit(0);
}); 