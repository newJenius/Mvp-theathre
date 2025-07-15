import type { NextApiRequest, NextApiResponse } from 'next';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { supabase } from '../../lib/supabaseClient';

const s3 = new S3Client({
  region: 'us-east-1',
  endpoint: process.env.STORJ_ENDPOINT,
  credentials: {
    accessKeyId: process.env.STORJ_ACCESS_KEY!,
    secretAccessKey: process.env.STORJ_SECRET_KEY!,
  },
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end('Unauthorized');
  }
  if (req.method !== 'POST') return res.status(405).end();

  try {
    // Получаем все видео, у которых премьера завершилась
    const now = new Date();
    const { data: videos, error } = await supabase
      .from('videos')
      .select('*')
      .not('duration', 'is', null)
      .lt('premiere_at', new Date(now.getTime() - 1000 * 60 * 60 * 24 * 365).toISOString()) // safety: не удалять слишком старые без duration
      ;
    if (error) throw error;
    if (!videos || videos.length === 0) return res.status(200).json({ message: 'Нет завершённых видео.' });

    // Фильтруем только те, у которых премьера завершилась
    const finished = videos.filter((v: any) => {
      const premiere = new Date(v.premiere_at);
      return now.getTime() > premiere.getTime() + (v.duration || 0) * 1000;
    });
    if (finished.length === 0) return res.status(200).json({ message: 'Нет завершённых видео.' });

    // Удаляем из Storj и Supabase
    const errors: any[] = [];
    for (const video of finished) {
      // Парсим имя файла из video_url
      try {
        const urlParts = video.video_url.split('/');
        const fileName = urlParts[urlParts.length - 1];
        await s3.send(new DeleteObjectCommand({
          Bucket: process.env.STORJ_BUCKET!,
          Key: `videos/${fileName}`,
        }));
      } catch (e) {
        errors.push({ id: video.id, error: 'Ошибка удаления из Storj', details: e });
      }
      // Удаляем запись из Supabase
      const { error: delError } = await supabase.from('videos').delete().eq('id', video.id);
      if (delError) errors.push({ id: video.id, error: 'Ошибка удаления из Supabase', details: delError });
    }
    res.status(200).json({ message: 'Удаление завершено', errors });
  } catch (e) {
    res.status(500).json({ error: e });
  }
} 