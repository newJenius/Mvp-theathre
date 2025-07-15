import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabaseClient';
import webpush from 'web-push';

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const now = new Date();
  const soon = new Date(now.getTime() + 60 * 1000);

  // Находим все премьеры, которые начинаются в ближайшую минуту
  const { data: videos, error: videosError } = await supabase
    .from('videos')
    .select('id, title')
    .gte('premiere_at', now.toISOString())
    .lt('premiere_at', soon.toISOString());

  if (videosError) return res.status(500).json({ error: videosError.message });

  let totalSent = 0;
  for (const video of videos || []) {
    // Получаем подписки на эту премьеру
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('premiere_id', video.id);

    for (const row of subs || []) {
      try {
        await webpush.sendNotification(
          row.subscription,
          JSON.stringify({
            title: video.title,
            body: 'Премьера началась! Жми, чтобы смотреть.',
            url: `https://ВАШ_ДОМЕН/watch/${video.id}`
          })
        );
        totalSent++;
      } catch (e) {
        // Можно добавить обработку ошибок
      }
    }
  }

  res.status(200).json({ totalSent, videos: (videos || []).length });
} 