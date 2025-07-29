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
  const [showInviteEmail, setShowInviteEmail] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);

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
    setLoading(true);
    setMessage('');
    
    try {
      // Check if user has username
      if (!username || username.trim().length === 0) {
        setMessage('Please set your username in profile first');
        setLoading(false);
        return;
      }

      // Validate form
      if (!title.trim()) {
        setMessage('Please enter a title');
        setLoading(false);
        return;
      }
      if (!premiereAt) {
        setMessage('Please select premiere date and time');
        setLoading(false);
        return;
      }
      if (!cover) {
        setMessage('Please select a cover image');
        setLoading(false);
        return;
      }
      if (!video) {
        setMessage('Please select a video file');
        setLoading(false);
        return;
      }

      // Create FormData
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('premiere_at', premiereAt); // Fix: use premiere_at instead of premiereAt
      formData.append('cover', cover);
      formData.append('video', video);

      // Upload to server
      const response = await fetch(`${apiUrl}/upload`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      setJobId(result.jobId);
      setProcessingStatus('waiting');
      
      // Save to localStorage
      localStorage.setItem('uploadJobId', result.jobId);
      localStorage.setItem('uploadProcessingStatus', 'waiting');
      
      // Clear form
      setTitle('');
      setDescription('');
      setPremiereAt('');
      setCover(null);
      setVideo(null);
      if (coverInputRef.current) coverInputRef.current.value = '';
      if (videoInputRef.current) videoInputRef.current.value = '';
      
      setMessage('Upload started! Processing in background...');
    } catch (error) {
      console.error('Upload error:', error);
      setMessage('Upload failed: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleGetInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setMessage('');
    
    try {
      const { error } = await supabase
        .from('waitlist')
        .insert([
          { email: inviteEmail }
        ]);

      if (error) {
        setMessage('Error: ' + error.message);
      } else {
        setMessage('Email added to waitlist! We\'ll contact you when invites are available.');
        setInviteEmail('');
        setShowInviteEmail(false);
      }
    } catch (error) {
      console.error('Waitlist error:', error);
      setMessage('Server connection error');
    } finally {
      setInviteLoading(false);
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
              background: '#39FF14',
              color: '#18181b',
              border: 'none',
              borderRadius: 6,
              fontSize: isMobile ? 16 : 18,
              fontWeight: 600,
              padding: isMobile ? '12px 0' : '14px 0',
              width: '280px',
              maxWidth: 'none',
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

          {/* Get Invite Section */}
          <div style={{ 
            textAlign: 'center', 
            marginTop: isMobile ? '20px' : '24px',
            paddingTop: isMobile ? '16px' : '20px',
            borderTop: '1px solid #23232a'
          }}>
            <p style={{ 
              color: '#6b7280', 
              fontSize: isMobile ? '12px' : '13px',
              margin: '0 0 16px 0'
            }}>
              Don't have an invite?
            </p>
            
            {!showInviteEmail ? (
              <button 
                type="button"
                onClick={() => setShowInviteEmail(true)}
                style={{
                  display: 'block',
                  margin: isMobile ? '0 auto' : '0 auto',
                  background: '#39FF14',
                  color: '#18181b',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: isMobile ? 16 : 18,
                  fontWeight: 600,
                  padding: isMobile ? '12px 0' : '14px 0',
                  width: '280px',
                  maxWidth: 'none',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.2s, color 0.2s',
                  boxShadow: 'none',
                  letterSpacing: '0.5px',
                }}
              >
                Get Invite
              </button>
            ) : (
              <form onSubmit={handleGetInvite} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: isMobile ? '10px 10px' : '12px 12px',
                    fontSize: '15px',
                    borderRadius: '0',
                    border: '1.5px solid #23232a',
                    background: '#18181b',
                    color: '#e0e0e0',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                    outline: 'none',
                  }}
                  onFocus={e => e.target.style.borderColor = '#444'}
                  onBlur={e => e.target.style.borderColor = '#23232a'}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    type="submit"
                    disabled={inviteLoading}
                    style={{
                      flex: 1,
                      padding: isMobile ? '10px 0' : '11px 0',
                      background: inviteLoading ? '#23232a' : '#39FF14',
                      color: inviteLoading ? '#888' : '#18181b',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: '600',
                      fontSize: isMobile ? '14px' : '15px',
                      cursor: inviteLoading ? 'default' : 'pointer',
                      transition: 'background 0.2s, color 0.2s',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {inviteLoading ? 'Sending...' : 'Submit'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setShowInviteEmail(false);
                      setInviteEmail('');
                    }}
                    style={{
                      padding: isMobile ? '10px 12px' : '11px 16px',
                      background: '#23232a',
                      color: '#bdbdbd',
                      border: '1px solid #23232a',
                      borderRadius: '6px',
                      fontWeight: '500',
                      fontSize: isMobile ? '14px' : '15px',
                      cursor: 'pointer',
                      transition: 'background 0.2s, color 0.2s',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {message && (
              <div style={{ 
                padding: isMobile ? '10px 10px' : '12px 12px',
                borderRadius: '0',
                fontSize: isMobile ? '13px' : '14px',
                textAlign: 'center',
                background: message.includes('error') ? '#2a181b' : '#182a1b',
                color: message.includes('error') ? '#ff5252' : '#22c55e',
                border: `1px solid ${message.includes('error') ? '#3a232a' : '#233a2a'}`,
                marginTop: '12px'
              }}>
                {message}
              </div>
            )}
          </div>
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
