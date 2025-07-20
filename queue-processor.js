require('dotenv').config();
const Queue = require('bull');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { createClient } = require('@supabase/supabase-js');

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Storj S3 client
const s3 = new S3Client({
  endpoint: process.env.STORJ_ENDPOINT,
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.STORJ_ACCESS_KEY,
    secretAccessKey: process.env.STORJ_SECRET_KEY,
  },
  forcePathStyle: true,
});

// Create queue for video processing
const videoQueue = new Queue('video-processing', {
  redis: { 
    port: 6379, 
    host: '127.0.0.1',
    maxRetriesPerRequest: null
  }
});

// Task handler in queue
videoQueue.process(async (job) => {
  console.log(`Starting video processing: ${job.id}`);
  
  const { 
    inputPath, 
    coverPath,
    title, 
    description, 
    user_id, 
    premiere_at, 
    originalName, 
    originalNameCover
  } = job.data;

  const outputPath = path.join('processed', `${Date.now()}_output.mp4`);

  // Make sure processed folder exists
  if (!fs.existsSync('processed')) fs.mkdirSync('processed');

  try {
    // ffprobe: output information about source file tracks
    await new Promise((resolve) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          console.error('ffprobe error:', err);
        } else {
          console.log('ffprobe streams:', metadata.streams);
        }
        resolve();
      });
    });
    // Process video through ffmpeg
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions('-vf', 'fps=30')
        .outputOptions('-map', '0:v:0')
        .outputOptions('-map', '0:a:0?')
        .outputOptions('-c:v', 'libx264')
        .outputOptions('-preset', 'slow')
        .outputOptions('-crf', '20')
        .outputOptions('-maxrate', '5M')
        .outputOptions('-bufsize', '10M')
        .outputOptions('-c:a', 'aac')
        .outputOptions('-b:a', '192k')
        .outputOptions('-ar', '44100')
        .outputOptions('-ac', '2')
        .outputOptions('-movflags', '+faststart')
        .on('start', commandLine => {
          console.log('Spawned ffmpeg with command:', commandLine);
        })
        .on('stderr', stderrLine => {
          console.log('ffmpeg stderr:', stderrLine);
        })
        .save(outputPath)
        .on('end', () => {
          console.log(`Video processed: ${job.id}`);
          resolve();
        })
        .on('error', (err) => {
          console.error(`Error processing video ${job.id}:`, err);
          reject(err);
        });
    });

    // Get video duration
    let duration = 0;
    await new Promise((resolve) => {
      ffmpeg.ffprobe(outputPath, (err, metadata) => {
        if (!err && metadata && metadata.format && metadata.format.duration) {
          duration = Math.round(metadata.format.duration);
        }
        resolve();
      });
    });

    // Public Storj Share Links for raw access
    const publicCoverBase = 'https://link.storjshare.io/raw/jxj2acs5rzznak3duyrymzh2kwya/videos/videos';
    const publicVideoBase = 'https://link.storjshare.io/raw/jxhdowy5aqta7qav6ysj7h3erwxq/videos/videos';

    // Upload processed file to Storj
    const { size } = fs.statSync(outputPath);
    const storjKey = `videos/videos/${Date.now()}_${originalName}`;
    
    // Choose upload method based on file size
    if (size > 2 * 1024 * 1024 * 1024) {
      // For files larger than 2GB, use Multipart Upload
      console.log(`Large file (${size} bytes), using Multipart Upload`);
      
      // Create multipart upload
      const multipartUpload = await s3.send(new CreateMultipartUploadCommand({
        Bucket: process.env.STORJ_BUCKET,
        Key: storjKey,
        ContentType: 'video/mp4',
      }));
      
      const uploadId = multipartUpload.UploadId;
      const partSize = 8 * 1024 * 1024; // 8MB parts
      const parts = [];
      
      // Upload parts of the file
      const fileStream = fs.createReadStream(outputPath);
      let partNumber = 1;
      let buffer = Buffer.alloc(0);
      
      for await (const chunk of fileStream) {
        buffer = Buffer.concat([buffer, chunk]);
        
        if (buffer.length >= partSize) {
          const part = await s3.send(new UploadPartCommand({
            Bucket: process.env.STORJ_BUCKET,
            Key: storjKey,
            UploadId: uploadId,
            PartNumber: partNumber,
            Body: buffer,
          }));
          
          parts.push({
            ETag: part.ETag,
            PartNumber: partNumber,
          });
          
          buffer = Buffer.alloc(0);
          partNumber++;
        }
      }
      
      // Upload the last part
      if (buffer.length > 0) {
        const part = await s3.send(new UploadPartCommand({
          Bucket: process.env.STORJ_BUCKET,
          Key: storjKey,
          UploadId: uploadId,
          PartNumber: partNumber,
          Body: buffer,
        }));
        
        parts.push({
          ETag: part.ETag,
          PartNumber: partNumber,
        });
      }
      
      // Complete multipart upload
      await s3.send(new CompleteMultipartUploadCommand({
        Bucket: process.env.STORJ_BUCKET,
        Key: storjKey,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts },
      }));
      
    } else {
      // For files smaller than 2GB, use regular upload
      let body;
      try {
        body = fs.readFileSync(outputPath);
      } catch (error) {
        if (error.code === 'ERR_FS_FILE_TOO_LARGE') {
          console.log(`File too large (${size} bytes), using streaming`);
          body = fs.createReadStream(outputPath);
        } else {
          throw error;
        }
      }
      
      await s3.send(new PutObjectCommand({
        Bucket: process.env.STORJ_BUCKET,
        Key: storjKey,
        Body: body,
        ContentType: 'video/mp4',
        ...(body instanceof Buffer && { ContentLength: size }),
      }));
    }
    // Get presigned URL for 7 days
    const video_url = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: process.env.STORJ_BUCKET,
        Key: storjKey,
      }),
      { expiresIn: 60 * 60 * 24 * 7 }
    );

    // Upload cover to Storj
    let cover_url = null;
    if (coverPath && fs.existsSync(coverPath)) {
      const coverSize = fs.statSync(coverPath).size;
      const coverStorjKey = `videos/covers/${Date.now()}_${originalNameCover}`;
      
      // Covers are usually small, use buffered reading
      const coverBody = fs.readFileSync(coverPath);
      
      await s3.send(new PutObjectCommand({
        Bucket: process.env.STORJ_BUCKET,
        Key: coverStorjKey,
        Body: coverBody,
        ContentType: 'image/jpeg',
        ContentLength: coverSize,
      }));
      // Get presigned URL for cover for 7 days
      cover_url = await getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: process.env.STORJ_BUCKET,
          Key: coverStorjKey,
        }),
        { expiresIn: 60 * 60 * 24 * 7 }
      );
    }

    // Save link and metadata to Supabase
    const { error } = await supabase.from('videos').insert([
      {
        user_id: user_id || null,
        title: title || null,
        description: description || null,
        cover_url,
        video_url,
        premiere_at: premiere_at || null,
        created_at: new Date().toISOString(),
        duration,
      },
    ]);

    if (error) {
      throw new Error(`Error saving to Supabase: ${error.message}`);
    }

    // Delete temporary files
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

    console.log(`Video successfully processed and uploaded: ${job.id}`);
    
    return {
      success: true,
      video_url,
      duration
    };

  } catch (error) {
    // Do not delete temporary files in catch to allow the job to be retried
    console.error(`Error processing video ${job.id}:`, error);
    throw error;
  }
});

// Queue event handlers
videoQueue.on('completed', (job, result) => {
  console.log(`Task ${job.id} completed successfully:`, result);
});

videoQueue.on('failed', (job, err) => {
  console.error(`Task ${job.id} failed with error:`, err);
});

videoQueue.on('error', (err) => {
  console.error('Queue error:', err);
});

console.log('Video queue processor started and ready to work...');

// Handle process termination
process.on('SIGINT', async () => {
  console.log('Shutting down video queue processor...');
  await videoQueue.close();
  process.exit(0);
}); 