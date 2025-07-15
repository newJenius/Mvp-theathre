import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { userId, authorId } = req.body;
  if (!userId || !authorId) return res.status(400).json({ error: 'Missing fields' });

  // Сохраняем подписку на автора
  const { error } = await supabase.from('author_subscriptions').upsert({
    user_id: userId,
    author_id: authorId
  }, { onConflict: 'user_id,author_id' });

  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ success: true });
} 