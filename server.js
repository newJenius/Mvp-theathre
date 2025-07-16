require('dotenv').config();
const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const upload = multer({ dest: 'uploads/' });

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

app.use(express.json());

// API для загрузки видео
app.post('/upload', upload.single('video'), async (req, res) => {
  const inputPath = req.file.path;
  const outputPath = path.join('processed', `${Date.now()}_output.mp4`);

  if (!fs.existsSync('processed')) fs.mkdirSync('processed');

  // Получаем метаданные из запроса (title, description, user_id, premiere_at)
  const { title, description, user_id, premiere_at } = req.body;

  // Обработка видео через ffmpeg
  ffmpeg(inputPath)
    .outputOptions('-vf', 'fps=30')
    .outputOptions('-c:v', 'libx264')
    .outputOptions('-preset', 'fast')
    .outputOptions('-crf', '23')
    .outputOptions('-c:a', 'aac')
    .outputOptions('-b:a', '128k')
    .save(outputPath)
    .on('end', async () => {
      try {
        // Получаем длительность видео
        let duration = 0;
        await new Promise((resolve, reject) => {
          ffmpeg.ffprobe(outputPath, (err, metadata) => {
            if (!err && metadata && metadata.format && metadata.format.duration) {
              duration = Math.round(metadata.format.duration);
            }
            resolve();
          });
        });

        // Загружаем обработанный файл на Storj
        const fileStream = fs.createReadStream(outputPath);
        const storjKey = `videos/${Date.now()}_${req.file.originalname}`;
        await s3.send(new PutObjectCommand({
          Bucket: process.env.STORJ_BUCKET,
          Key: storjKey,
          Body: fileStream,
          ContentType: req.file.mimetype,
        }));
        const video_url = `${process.env.STORJ_ENDPOINT.replace(/\/$/, '')}/${process.env.STORJ_BUCKET}/${storjKey}`;

        // Сохраняем ссылку и метаданные в Supabase
        const { data, error } = await supabase.from('videos').insert([
          {
            user_id: user_id || null,
            title: title || null,
            description: description || null,
            cover_url: null, // Можно реализовать позже
            video_url,
            premiere_at: premiere_at || null,
            created_At: new Date().toISOString(),
            duration,
          },
        ]);
        // Удаляем временные файлы
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
        if (error) {
          return res.status(500).json({ error: 'Ошибка сохранения в Supabase', details: error.message });
        }
        res.json({ message: 'Видео обработано и загружено!', video_url });
      } catch (err) {
        fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        res.status(500).json({ error: 'Ошибка обработки или загрузки видео', details: err.message });
      }
    })
    .on('error', (err) => {
      fs.unlinkSync(inputPath);
      res.status(500).json({ error: 'Ошибка обработки видео', details: err.message });
    });
});

app.listen(4000, () => {
  console.log('Backend сервер запущен на порту 4000');
}); 