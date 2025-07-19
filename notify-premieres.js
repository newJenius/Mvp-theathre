require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

(async () => {
  const now = new Date();
  const soon = new Date(now.getTime() + 60 * 1000);
  // Find all premieres that start in the next minute
  const { data: videos, error: videosError } = await supabase
    .from('videos')
    .select('id, title')
    .gte('premiere_at', now.toISOString())
    .lt('premiere_at', soon.toISOString());

  if (videosError) {
    console.error('Error getting premieres:', videosError);
    return;
  }

  let totalSent = 0;
  for (const video of videos || []) {
    // Get subscriptions for this premiere
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
            body: 'Premiere started! Click to watch.',
            url: `https://YOUR_DOMAIN/watch/${video.id}`
          })
        );
        totalSent++;
        console.log(`Notification sent for video ${video.id}`);
      } catch (e) {
        console.error('Error sending notification:', e);
      }
    }
  }
  console.log(`Total notifications sent: ${totalSent}`);
})(); 