require('dotenv').config();
const Queue = require('bull');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
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
    coverPath,
    title, 
    description, 
    user_id, 
    premiere_at, 
    originalName, 
    originalNameCover
  } = job.data;

  const outputPath = path.join('processed', `${Date.now()}_output.mp4`);

  // Убедись, что папка processed существует
  if (!fs.existsSync('processed')) fs.mkdirSync('processed');

  try {
    // Обработка видео через ffmpeg
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions('-vf', 'fps=30')
        .outputOptions('-map', '0:v:0')
        .outputOptions('-map', '0:a:0?')
        .outputOptions('-c:v', 'libx264')
        .outputOptions('-preset', 'ultrafast')
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

    // Публичные Storj Share Links для raw доступа
    const publicCoverBase = 'https://link.storjshare.io/raw/jxj2acs5rzznak3duyrymzh2kwya/videos/videos';
    const publicVideoBase = 'https://link.storjshare.io/raw/jxhdowy5aqta7qav6ysj7h3erwxq/videos/videos';

    // Загружаем обработанный файл на Storj
    const { size } = fs.statSync(outputPath);
    const storjKey = `videos/videos/${Date.now()}_${originalName}`;
    
    // Выбираем метод загрузки в зависимости от размера файла
    if (size > 2 * 1024 * 1024 * 1024) {
      // Для файлов больше 2GB используем Multipart Upload
      console.log(`Файл большой (${size} байт), используем Multipart Upload`);
      
      // Создаём multipart upload
      const multipartUpload = await s3.send(new CreateMultipartUploadCommand({
        Bucket: process.env.STORJ_BUCKET,
        Key: storjKey,
        ContentType: 'video/mp4',
      }));
      
      const uploadId = multipartUpload.UploadId;
      const partSize = 8 * 1024 * 1024; // 8MB части
      const parts = [];
      
      // Загружаем части файла
      const fileStream = fs.createReadStream(outputPath);
      let partNumber = 1;
      let buffer = Buffer.alloc(0);
      
      for await (const chunk of fileStream) {
        buffer = Buffer.concat([buffer, chunk]);
        
        if (buffer.length >= partSize) {
          const part = await s3.send(new UploadPartCommand({
            Bucket: process.env.STORJ_BUCKET,
            Key: storjKey,
            UploadId: uploadId,
            PartNumber: partNumber,
            Body: buffer,
          }));
          
          parts.push({
            ETag: part.ETag,
            PartNumber: partNumber,
          });
          
          buffer = Buffer.alloc(0);
          partNumber++;
        }
      }
      
      // Загружаем последнюю часть
      if (buffer.length > 0) {
        const part = await s3.send(new UploadPartCommand({
          Bucket: process.env.STORJ_BUCKET,
          Key: storjKey,
          UploadId: uploadId,
          PartNumber: partNumber,
          Body: buffer,
        }));
        
        parts.push({
          ETag: part.ETag,
          PartNumber: partNumber,
        });
      }
      
      // Завершаем multipart upload
      await s3.send(new CompleteMultipartUploadCommand({
        Bucket: process.env.STORJ_BUCKET,
        Key: storjKey,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts },
      }));
      
    } else {
      // Для файлов меньше 2GB используем обычную загрузку
      let body;
      try {
        body = fs.readFileSync(outputPath);
      } catch (error) {
        if (error.code === 'ERR_FS_FILE_TOO_LARGE') {
          console.log(`Файл слишком большой (${size} байт), используем потоковое чтение`);
          body = fs.createReadStream(outputPath);
        } else {
          throw error;
        }
      }
      
      await s3.send(new PutObjectCommand({
        Bucket: process.env.STORJ_BUCKET,
        Key: storjKey,
        Body: body,
        ContentType: 'video/mp4',
        ...(body instanceof Buffer && { ContentLength: size }),
      }));
    }
    // Получаем presigned URL на 7 дней
    const video_url = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: process.env.STORJ_BUCKET,
        Key: storjKey,
      }),
      { expiresIn: 60 * 60 * 24 * 7 }
    );

    // Загружаем обложку на Storj
    let cover_url = null;
    if (coverPath && fs.existsSync(coverPath)) {
      const coverSize = fs.statSync(coverPath).size;
      const coverStorjKey = `videos/covers/${Date.now()}_${originalNameCover}`;
      
      // Обложки обычно маленькие, используем буферизованное чтение
      const coverBody = fs.readFileSync(coverPath);
      
      await s3.send(new PutObjectCommand({
        Bucket: process.env.STORJ_BUCKET,
        Key: coverStorjKey,
        Body: coverBody,
        ContentType: 'image/jpeg',
        ContentLength: coverSize,
      }));
      // Получаем presigned URL на 7 дней для обложки
      cover_url = await getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: process.env.STORJ_BUCKET,
          Key: coverStorjKey,
        }),
        { expiresIn: 60 * 60 * 24 * 7 }
      );
    }

    // Сохраняем ссылку и метаданные в Supabase
    const { error } = await supabase.from('videos').insert([
      {
        user_id: user_id || null,
        title: title || null,
        description: description || null,
        cover_url,
        video_url,
        premiere_at: premiere_at || null,
        created_at: new Date().toISOString(),
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
    // Не удаляем временные файлы в catch, чтобы задача могла быть повторно обработана
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