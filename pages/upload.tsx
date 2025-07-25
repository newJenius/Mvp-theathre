import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Upload() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const DESCRIPTION_LIMIT = 1500;
  const [premiereAt, setPremiereAt] = useState('');
  const [cover, setCover] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const TITLE_LIMIT = 150;
  const [user, setUser] = useState<any>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.nermes.xyz';
  const [username, setUsername] = useState<string | null>(null);

  // Load username from users table
  useEffect(() => {
    if (!user) return;
    supabase
      .from('users')
      .select('username')
      .eq('id', user.id)
      .single()
      .then((res: { data: { username?: string } | null }) => {
        setUsername(res.data?.username || null);
      });
  }, [user]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.matchMedia('(max-width: 600px)').matches);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    try {
      supabase.auth.getUser().then(({ data }: any) => {
        setUser(data.user);
        setCheckedAuth(true);
      }).catch((error: any) => {
        console.error('Error getting user:', error);
        setCheckedAuth(true);
      });
    } catch (error) {
      console.error('Supabase initialization error:', error);
      setCheckedAuth(true);
    }
  }, []);

  // Check status every 10 seconds if there's a jobId
  useEffect(() => {
    if (!jobId) return;
    
    const interval = setInterval(() => {
      checkStatus(jobId);
    }, 10000);
    
    return () => clearInterval(interval);
  }, [jobId]);

  // Restore upload state from localStorage when page loads
  useEffect(() => {
    const savedJobId = localStorage.getItem('uploadJobId');
    const savedProcessingStatus = localStorage.getItem('uploadProcessingStatus');
    const savedQueuePosition = localStorage.getItem('uploadQueuePosition');
    const savedEstimatedTime = localStorage.getItem('uploadEstimatedTime');
    
    // Restore form data
    const savedTitle = localStorage.getItem('uploadTitle');
    const savedDescription = localStorage.getItem('uploadDescription');
    const savedPremiereAt = localStorage.getItem('uploadPremiereAt');
    
    if (savedTitle) setTitle(savedTitle);
    if (savedDescription) setDescription(savedDescription);
    if (savedPremiereAt) setPremiereAt(savedPremiereAt);
    
    if (savedJobId) {
      setJobId(savedJobId);
      setProcessingStatus(savedProcessingStatus || 'waiting');
      setQueuePosition(savedQueuePosition ? parseInt(savedQueuePosition) : null);
      setEstimatedTime(savedEstimatedTime ? parseInt(savedEstimatedTime) : null);
    }
  }, []);

  // Save form data when it changes
  useEffect(() => {
    if (title) localStorage.setItem('uploadTitle', title);
    else localStorage.removeItem('uploadTitle');
    
    if (description) localStorage.setItem('uploadDescription', description);
    else localStorage.removeItem('uploadDescription');
    
    if (premiereAt) localStorage.setItem('uploadPremiereAt', premiereAt);
    else localStorage.removeItem('uploadPremiereAt');
  }, [title, description, premiereAt]);

  // Save state to localStorage when it changes
  useEffect(() => {
    if (jobId) {
      localStorage.setItem('uploadJobId', jobId);
      localStorage.setItem('uploadProcessingStatus', processingStatus);
      if (queuePosition) localStorage.setItem('uploadQueuePosition', queuePosition.toString());
      if (estimatedTime) localStorage.setItem('uploadEstimatedTime', estimatedTime.toString());
    } else {
      // Clear localStorage if upload is completed
      localStorage.removeItem('uploadJobId');
      localStorage.removeItem('uploadProcessingStatus');
      localStorage.removeItem('uploadQueuePosition');
      localStorage.removeItem('uploadEstimatedTime');
      
      // Clear form data after successful upload
      localStorage.removeItem('uploadTitle');
      localStorage.removeItem('uploadDescription');
      localStorage.removeItem('uploadPremiereAt');
    }
  }, [jobId, processingStatus, queuePosition, estimatedTime]);

  // Function to check processing status
  const checkStatus = async (jobId: string) => {
    try {
      const response = await fetch(`${apiUrl}/status/${jobId}`);
      const data = await response.json();
      
      if (response.ok) {
        setProcessingStatus(data.state);
        
        if (data.state === 'completed') {
          setMessage('Video successfully processed and uploaded!');
          setJobId(null);
          setProcessingStatus('');
        } else if (data.state === 'failed') {
          setMessage(`Processing error: ${data.failedReason}`);
          setJobId(null);
          setProcessingStatus('');
        }
      }
    } catch (error) {
      console.error('Error checking status:', error);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);
    setJobId(null);
    setProcessingStatus('');
    setQueuePosition(null);
    setEstimatedTime(null);

    // File size limit (2 GB)
    const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;
    if (video && video.size > MAX_FILE_SIZE) {
      setMessage('Uploading files larger than 2 GB is not supported. Please select a smaller file.');
      setLoading(false);
      return;
    }

    // Check: premiere date is not more than 6 days in advance
    if (premiereAt) {
      const premiereDate = new Date(premiereAt);
      const now = new Date();
      const maxDate = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);
      if (premiereDate > maxDate) {
        setMessage('Premiere cannot be scheduled more than 6 days in advance.');
        setLoading(false);
        return;
      }
    }

    if (!video) {
      setMessage('No video selected for upload.');
      setLoading(false);
      return;
    }

    if (!username || username.trim().length === 0) {
      setMessage('Please set your username in your profile before uploading a video.');
      setLoading(false);
      return;
    }
    try {
      const formData = new FormData();
      formData.append('video', video);
      if (cover) {
        formData.append('cover', cover);
      }
      formData.append('title', title);
      formData.append('description', description);
      formData.append('user_id', user?.id || '');
      formData.append('premiere_at', premiereAt);

      const response = await fetch(`${apiUrl}/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setJobId(data.jobId);
        setQueuePosition(data.queuePosition);
        setEstimatedTime(data.estimatedTime);
        setProcessingStatus('waiting');
        setMessage(`Video added to queue! Position: ${data.queuePosition}, Estimated time: ${data.estimatedTime} minutes`);
      } else {
        setMessage('Error: ' + (data.error || 'Unknown error'));
      }
    } catch (err: any) {
      setMessage('Upload error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Add processing status display
  const renderProcessingStatus = () => {
    if (!jobId) return null;
    
    const statusText = {
      'waiting': 'Waiting for processing',
      'active': 'Processing',
      'completed': 'Completed',
      'failed': 'Error'
    };
    
    return (
      <div style={{
        background: '#1f2937',
        padding: '16px',
        borderRadius: '8px',
        marginTop: '16px',
        border: '1px solid #374151'
      }}>
        <h3 style={{ color: '#e5e7eb', marginBottom: '8px' }}>Processing status</h3>
        <p style={{ color: '#9ca3af', marginBottom: '4px' }}>
          Task ID: {jobId}
        </p>
        <p style={{ color: '#9ca3af', marginBottom: '4px' }}>
          Status: {statusText[processingStatus as keyof typeof statusText] || processingStatus}
        </p>
        {queuePosition && (
          <p style={{ color: '#9ca3af', marginBottom: '4px' }}>
            Queue position: {queuePosition}
          </p>
        )}
        {estimatedTime && (
          <p style={{ color: '#9ca3af', marginBottom: '4px' }}>
            Estimated time: {estimatedTime} minutes
          </p>
        )}
      </div>
    );
  };

  if (!checkedAuth) {
    return (
      <div style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: isMobile ? 18 : 22,
        color: '#fff',
        textAlign: 'center',
        background: '#111114',
        margin: isMobile ? '20px auto' : '40px auto',
        maxWidth: isMobile ? '90%' : 500,
        boxShadow: '0 2px 16px #0004',
        padding: isMobile ? '20px' : '40px',
        paddingTop: isMobile ? '80px' : '40px',
      }}>
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{
        minHeight: '100vh',
        width: '100vw',
        background: '#0a0a0c',
        color: '#e0e0e0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: isMobile ? 17 : 20,
        textAlign: 'center',
        margin: 0,
        padding: 0,
        boxShadow: 'none',
        borderRadius: 0,
        letterSpacing: 0.2,
        fontWeight: 500
      }}>
        <div style={{
          maxWidth: 340,
          width: '100%',
          background: 'none',
          borderRadius: 0,
          padding: isMobile ? '24px 12px' : '36px 0',
          margin: '0 auto',
          border: 'none',
          boxShadow: 'none',
        }}>
          <h1 style={{ color: '#e0e0e0', fontSize: isMobile ? 20 : 22, fontWeight: 600, marginBottom: 10, letterSpacing: 0.2 }}>Login required</h1>
          <p style={{ color: '#6b7280', fontSize: isMobile ? 13 : 14, margin: 0, marginBottom: 0 }}>Sign in or register to upload premieres</p>
          <a
            href="/register"
            style={{
              display: 'block',
              margin: isMobile ? '22px auto 0 auto' : '28px auto 0 auto',
              background: '#18181b',
              color: '#e0e0e0',
              border: 'none',
              borderRadius: 6,
              fontSize: isMobile ? 16 : 18,
              fontWeight: 600,
              padding: isMobile ? '12px 0' : '14px 0',
              width: '100%',
              maxWidth: 340,
              textAlign: 'center',
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'background 0.2s, color 0.2s',
              boxShadow: 'none',
              letterSpacing: '0.5px',
            }}
          >
            Register
          </a>
        </div>
      </div>
    );
  }

  // Show warning if no username
  if (user && (!username || username.trim().length === 0)) {
    return (
      <div style={{
        minHeight: '100vh',
        width: '100vw',
        background: '#0a0a0c',
        color: '#e57373',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: isMobile ? 17 : 20,
        textAlign: 'center',
        margin: 0,
        padding: 0,
        boxShadow: 'none',
        borderRadius: 0,
        letterSpacing: 0.2,
        fontWeight: 500
      }}>
        <div style={{
          maxWidth: 340,
          width: '100%',
          background: 'none',
          borderRadius: 0,
          padding: isMobile ? '24px 12px' : '36px 0',
          margin: '0 auto',
          border: 'none',
          boxShadow: 'none',
        }}>
          <h1 style={{ color: '#e57373', fontSize: isMobile ? 20 : 22, fontWeight: 600, marginBottom: 10, letterSpacing: 0.2 }}>Требуется имя пользователя</h1>
          <p style={{ color: '#bdbdbd', fontSize: isMobile ? 13 : 14, margin: 0, marginBottom: 0 }}>
            Укажите имя пользователя в <a href="/profile" style={{ color: '#22c55e', textDecoration: 'underline' }}>профиле</a> перед загрузкой видео.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0c', padding: isMobile ? '16px' : '40px', paddingTop: isMobile ? '56px' : '48px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
      {jobId && (
        <div style={{
          position: 'fixed',
          top: isMobile ? '60px' : '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#1f2937',
          color: '#9ca3af',
          padding: '8px 16px',
          borderRadius: '20px',
          fontSize: '14px',
          zIndex: 1000,
          border: '1px solid #374151',
          opacity: 0.9
        }}>
          Upload in progress...
        </div>
      )}
      <form onSubmit={handleUpload} style={{
        width: '100%',
        maxWidth: 400,
        background: 'none',
        borderRadius: 0,
        boxShadow: 'none',
        padding: isMobile ? '0' : '0',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}>
        <h1 style={{
          fontSize: 15,
          fontWeight: 400,
          color: '#888a92',
          margin: 0,
          marginBottom: 18,
          letterSpacing: '0',
          textAlign: 'left',
        }}>Upload premiere</h1>
        <div style={{
          background: 'none',
          color: '#bdbdbd',
          fontSize: 14,
          marginBottom: 12,
          textAlign: 'center',
          lineHeight: 1.4,
        }}>
          Warning: video will be automatically deleted immediately after the premiere ends!
        </div>
        <input
          type="text"
          placeholder="Video title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={TITLE_LIMIT}
          style={{
            background: '#18181b',
            border: 'none',
            borderBottom: '1.5px solid #23232a',
            color: '#e0e0e0',
            fontSize: 18,
            padding: '12px 8px',
            outline: 'none',
            borderRadius: 0,
            marginBottom: 0,
            transition: 'border 0.2s',
          }}
        />
        <textarea
          ref={descriptionRef}
          placeholder="Description (optional)"
          value={description}
          onChange={e => setDescription(e.target.value)}
          maxLength={DESCRIPTION_LIMIT}
          style={{
            background: '#18181b',
            border: 'none',
            borderBottom: '1.5px solid #23232a',
            color: '#bdbdbd',
            fontSize: 16,
            padding: '12px 8px',
            outline: 'none',
            borderRadius: 0,
            minHeight: 60,
            resize: 'vertical',
            marginBottom: 0,
            transition: 'border 0.2s',
          }}
        />
        <label style={{ color: '#bdbdbd', fontSize: 15, marginBottom: 4, fontWeight: 400, display: 'block' }}>Premiere date and time (UTC)</label>
        <input
          type="datetime-local"
          value={premiereAt}
          onChange={e => setPremiereAt(e.target.value)}
          placeholder="YYYY-MM-DDThh:mm"
          style={{
            background: '#18181b',
            border: 'none',
            borderBottom: '1.5px solid #23232a',
            color: '#e0e0e0',
            fontSize: 16,
            padding: '12px 8px',
            outline: 'none',
            borderRadius: 0,
            marginBottom: 0,
            transition: 'border 0.2s',
          }}
        />
        <label style={{ color: '#bdbdbd', fontSize: 15, marginBottom: 0, fontWeight: 400 }}>Cover (required)</label>
        {jobId ? (
          <div style={{
            background: '#1f2937',
            border: '1px solid #374151',
            color: '#9ca3af',
            fontSize: 14,
            padding: '12px 8px',
            borderRadius: 4,
            marginBottom: 16,
            textAlign: 'center'
          }}>
            Files already uploaded, processing in the background
          </div>
        ) : (
          <input
            type="file"
            accept="image/*"
            ref={coverInputRef}
            onChange={e => setCover(e.target.files?.[0] || null)}
            required
            style={{
              background: 'none',
              border: 'none',
              color: '#bdbdbd',
              fontSize: 15,
              padding: 0,
              marginBottom: 0,
            }}
          />
        )}
        <label style={{ color: '#bdbdbd', fontSize: 15, marginBottom: 0, fontWeight: 400 }}>
          Video (required)
        </label>
        {jobId ? (
          <div style={{
            background: '#1f2937',
            border: '1px solid #374151',
            color: '#9ca3af',
            fontSize: 14,
            padding: '12px 8px',
            borderRadius: 4,
            marginBottom: 16,
            textAlign: 'center'
          }}>
            Video is being processed and uploaded to server
          </div>
        ) : (
          <input
            type="file"
            accept="video/*"
            ref={videoInputRef}
            onChange={e => setVideo(e.target.files?.[0] || null)}
            required
            style={{
              background: 'none',
              border: 'none',
              color: '#bdbdbd',
              fontSize: 15,
              padding: 0,
              marginBottom: 0,
            }}
          />
        )}
        <button
          type="submit"
          disabled={loading || !!jobId}
          style={{
            background: loading || !!jobId ? '#23232a' : '#39FF14',
            color: loading || !!jobId ? '#888' : '#18181b',
            border: 'none',
            borderRadius: 6,
            fontSize: 18,
            fontWeight: 600,
            padding: '14px 0',
            marginTop: 8,
            cursor: loading || !!jobId ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s, color 0.2s',
            boxShadow: 'none',
            letterSpacing: '0.5px',
          }}
        >
          {loading ? 'Uploading...' : jobId ? 'Upload in progress' : 'Upload'}
        </button>
        {message && (
          <div style={{ color: message.toLowerCase().includes('success') ? '#22c55e' : '#ff5252', fontSize: 15, marginTop: 4, textAlign: 'left' }}>{message}</div>
        )}
        {renderProcessingStatus()}
      </form>
    </div>
  );
}

export async function getServerSideProps() {
  return { props: { hideHeader: true } };
}
