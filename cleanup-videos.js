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
      .not('duration', 'is', null) // Get videos that have duration (processed videos)
      .not('video_url', 'is', null); // Only videos that still have video_url
    if (error) throw error;
    if (!videos || videos.length === 0) {
      console.log('No completed videos.');
      return;
    }
    
    // Filter videos that have finished (premiere time + duration + 30 seconds buffer)
    const finished = videos.filter((v) => {
      const premiere = new Date(v.premiere_at);
      const endTime = premiere.getTime() + (v.duration || 0) * 1000 + 30 * 1000; // +30 seconds buffer
      return now.getTime() > endTime;
    });
    
    if (finished.length === 0) {
      console.log('No completed videos.');
      return;
    }
    
    console.log(`Found ${finished.length} videos to cleanup`);
    
    const errors = [];
    for (const video of finished) {
      try {
        // Delete video file from Storj
        if (video.video_url) {
          const urlParts = video.video_url.split('/');
          const fileName = urlParts[urlParts.length - 1].split('?')[0]; // Remove query parameters
          const delResult = await s3.send(new DeleteObjectCommand({
            Bucket: process.env.STORJ_BUCKET,
            Key: `videos/videos/${fileName}`, // Match the upload path
          }));
          console.log(`Deleted video from Storj: ${fileName}, video ID: ${video.id}`);
        }
        
        // Nullify video_url in Supabase (keep the record, just remove video link)
        const { error: updError } = await supabase
          .from('videos')
          .update({ video_url: null })
          .eq('id', video.id);
          
        if (updError) {
          errors.push({ id: video.id, error: 'Error updating video_url in Supabase', details: updError });
        } else {
          console.log(`Nullified video_url in Supabase: ${video.id}`);
        }
        
      } catch (e) {
        errors.push({ id: video.id, error: 'Error during cleanup', details: e });
      }
    }
    
    if (errors.length > 0) {
      console.error('Errors during deletion:', errors);
    } else {
      console.log('Cleanup completed without errors.');
    }
  } catch (e) {
    console.error('Error executing script:', e);
  }
})(); 