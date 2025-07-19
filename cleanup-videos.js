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
      console.log('No completed videos.');
      return;
    }
    const finished = videos.filter((v) => {
      const premiere = new Date(v.premiere_at);
      return now.getTime() > premiere.getTime() + (v.duration || 0) * 1000;
    });
    if (finished.length === 0) {
      console.log('No completed videos.');
      return;
    }
    const errors = [];
    for (const video of finished) {
      try {
        if (video.video_url) {
          const urlParts = video.video_url.split('/');
          const fileName = urlParts[urlParts.length - 1].split('?')[0];
          const delResult = await s3.send(new DeleteObjectCommand({
            Bucket: process.env.STORJ_BUCKET,
            Key: `videos/videos/${fileName}`,
          }));
          console.log(`Deleted from Storj: ${fileName}, result:`, delResult);
        } else {
          console.log(`video_url is already null for video: ${video.id}, skipping Storj deletion`);
        }
      } catch (e) {
        errors.push({ id: video.id, error: 'Error deleting from Storj', details: e });
      }
      // After deleting from Storj, nullify the video link in Supabase
      const { error: updError } = await supabase.from('videos').update({ video_url: null }).eq('id', video.id);
      if (updError) errors.push({ id: video.id, error: 'Error updating video_url in Supabase', details: updError });
      else console.log(`Nullified video_url in Supabase: ${video.id}`);
    }
    if (errors.length > 0) {
      console.error('Errors during deletion:', errors);
    } else {
      console.log('Deletion completed without errors.');
    }
  } catch (e) {
    console.error('Error executing script:', e);
  }
})(); 