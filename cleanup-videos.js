require('dotenv').config();
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { createClient } = require('@supabase/supabase-js');

const s3 = new S3Client({
  region: 'us-east-1',
  endpoint: process.env.STORJ_ENDPOINT,
  credentials: {
    accessKeyId: process.env.STORJ_ACCESS_KEY,
    secretAccessKey: process.env.STORJ_SECRET_KEY,
  },
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  try {
    const now = new Date();
    const { data: videos, error } = await supabase
      .from('videos')
      .select('*')
      .not('duration', 'is', null);
    if (error) throw error;
    if (!videos || videos.length === 0) {
      console.log('Нет завершённых видео.');
      return;
    }
    const finished = videos.filter((v) => {
      const premiere = new Date(v.premiere_at);
      return now.getTime() > premiere.getTime() + (v.duration || 0) * 1000;
    });
    if (finished.length === 0) {
      console.log('Нет завершённых видео.');
      return;
    }
    const errors = [];
    for (const video of finished) {
      try {
        const urlParts = video.video_url.split('/');
        const fileName = urlParts[urlParts.length - 1].split('?')[0]; // только имя файла без query string
        await s3.send(new DeleteObjectCommand({
          Bucket: process.env.STORJ_BUCKET,
          Key: `videos/${fileName}`,
        }));
        console.log(`Удалено из Storj: ${fileName}`);
      } catch (e) {
        errors.push({ id: video.id, error: 'Ошибка удаления из Storj', details: e });
      }
      // После удаления из Storj, обнуляем ссылку на видео в Supabase
      const { error: updError } = await supabase.from('videos').update({ video_url: null }).eq('id', video.id);
      if (updError) errors.push({ id: video.id, error: 'Ошибка обновления video_url в Supabase', details: updError });
      else console.log(`Обнулена ссылка video_url в Supabase: ${video.id}`);
    }
    if (errors.length > 0) {
      console.error('Ошибки при удалении:', errors);
    } else {
      console.log('Удаление завершено без ошибок.');
    }
  } catch (e) {
    console.error('Ошибка выполнения скрипта:', e);
  }
})(); 