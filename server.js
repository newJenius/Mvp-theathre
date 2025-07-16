const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' }); // временная папка для загрузки

// API для загрузки видео
app.post('/upload', upload.single('video'), (req, res) => {
  const inputPath = req.file.path;
  const outputPath = path.join('processed', `${Date.now()}_output.mp4`);

  // Убедись, что папка processed существует
  if (!fs.existsSync('processed')) fs.mkdirSync('processed');

  // Пример обработки: нормализация fps и перекодировка
  ffmpeg(inputPath)
    .outputOptions('-vf', 'fps=30')
    .outputOptions('-c:v', 'libx264')
    .outputOptions('-preset', 'fast')
    .outputOptions('-crf', '23')
    .outputOptions('-c:a', 'aac')
    .outputOptions('-b:a', '128k')
    .save(outputPath)
    .on('end', () => {
      // После обработки можно отправить файл на Storj (добавим позже)
      // Удаляем исходный файл
      fs.unlinkSync(inputPath);
      res.json({ message: 'Видео обработано!', file: outputPath });
    })
    .on('error', (err) => {
      fs.unlinkSync(inputPath);
      res.status(500).json({ error: 'Ошибка обработки видео', details: err.message });
    });
});

app.listen(4000, () => {
  console.log('Backend сервер запущен на порту 4000');
}); 