import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabaseClient';
import webpush from 'web-push';

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { premiereId, title, url } = req.body;
  if (!premiereId || !title || !url) return res.status(400).json({ error: 'Missing fields' });

  // Get all subscriptions for this premiere
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('premiere_id', premiereId);

  if (error) return res.status(500).json({ error: error.message });

  let sent = 0;
  for (const row of subs || []) {
    try {
      await webpush.sendNotification(
        row.subscription,
        JSON.stringify({
          title,
          body: 'Premiere started! Click to watch.',
          url
        })
      );
      sent++;
    } catch (e) {
      // Can add error handling (e.g., remove invalid subscriptions)
    }
  }

  res.status(200).json({ sent });
}
