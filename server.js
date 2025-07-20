require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const Queue = require('bull');

const app = express();

// CORS settings
app.use(cors({
  origin: [
    'https://api.nermes.xyz',
    'http://localhost:3000',
    'https://mvp-theathre.vercel.app',
    'https://vercel.app',
    'https://www.onetimeshow.app',
    'https://onetimeshow.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Create queue for video processing
const videoQueue = new Queue('video-processing', {
  redis: { 
    port: 6379, 
    host: '127.0.0.1',
    maxRetriesPerRequest: null
  }
});

const upload = multer({ dest: 'uploads/' });

// API for video upload
app.post('/upload', upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'cover', maxCount: 1 }
]), async (req, res) => {
  try {
    const videoFile = req.files['video'][0];
    const coverFile = req.files['cover'][0];
    const inputPath = videoFile.path;
    const coverPath = coverFile.path;
    const { title, description, user_id, premiere_at } = req.body;

    // Add task to queue
    const job = await videoQueue.add({
      inputPath,
      coverPath,
      title,
      description,
      user_id,
      premiere_at,
      originalName: videoFile.originalname,
      originalNameCover: coverFile.originalname
    }, {
      attempts: 3, // Number of retry attempts on error
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });

    // Get information about queue position
    const waitingJobs = await videoQueue.getWaiting();
    const position = waitingJobs.findIndex(j => j.id === job.id) + 1;

    console.log(`Video added to queue. ID: ${job.id}, Position: ${position}`);

    res.json({ 
      message: 'Video added to processing queue',
      jobId: job.id,
      queuePosition: position,
      estimatedTime: position * 10 // approximate time in minutes (10 min per video)
    });

  } catch (error) {
    console.error('Error adding to queue:', error);
    res.status(500).json({ 
      error: 'Error adding video to queue', 
      details: error.message 
    });
  }
});

// API for checking processing status
app.get('/status/:jobId', async (req, res) => {
  try {
    const job = await videoQueue.getJob(req.params.jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const state = await job.getState();
    const progress = job._progress;
    const result = job.returnvalue;

    res.json({
      jobId: job.id,
      state: state, // 'waiting', 'active', 'completed', 'failed'
      progress: progress,
      result: result,
      failedReason: job.failedReason
    });

  } catch (error) {
    console.error('Error getting status:', error);
    res.status(500).json({ 
      error: 'Error getting status', 
      details: error.message 
    });
  }
});

// API for getting queue information
app.get('/queue-info', async (req, res) => {
  try {
    const waiting = await videoQueue.getWaiting();
    const active = await videoQueue.getActive();
    const completed = await videoQueue.getCompleted();
    const failed = await videoQueue.getFailed();

    res.json({
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      total: waiting.length + active.length + completed.length + failed.length
    });

  } catch (error) {
    console.error('Error getting queue information:', error);
    res.status(500).json({ 
      error: 'Error getting queue information', 
      details: error.message 
    });
  }
});

app.listen(4000, () => {
  console.log('Backend server with queue started on port 4000');
}); 