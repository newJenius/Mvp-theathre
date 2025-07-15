import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { subscription, premiereId, userId } = req.body;
  if (!subscription || !premiereId || !userId) return res.status(400).json({ error: 'Missing fields' });

  // Сохраняем подписку в таблицу push_subscriptions
  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    premiere_id: premiereId,
    subscription
  }, { onConflict: ['user_id', 'premiere_id'] });

  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ success: true });
} 