import { useRouter } from 'next/router';
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import LiveChat from '../../components/LiveChat';
// import EmotionCarousel from '../../components/EmotionCarousel';
import { NextPageContext } from 'next';
import WatchSubscribePush from '../../components/WatchSubscribePush';
import Header from '../../components/Header';
// Helper for mobile device detection
function isMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

function getTimeLeft(premiere_at: string) {
  const now = new Date();
  const premiere = new Date(premiere_at);
  const diff = premiere.getTime() - now.getTime();
  if (diff <= 0) return '0m';
  const hours = Math.floor(diff / 1000 / 60 / 60);
  const minutes = Math.floor((diff / 1000 / 60) % 60);
  return `${hours > 0 ? hours + 'h ' : ''}${minutes}m`;
}

type Video = {
  id: string;
  title: string;
  cover_url: string;
  premiere_at: string;
  user_id: string;
  description: string;
  video_url: string;
  duration?: number; // Add duration field
  avatar_url?: string;
  username?: string;
};

export default function Watch(props: any) {
  const router = useRouter();
  const { id } = router.query;
  const [video, setVideo] = useState<Video | null>(null);
  const [authorUsername, setAuthorUsername] = useState<string | null>(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const [waitingCount, setWaitingCount] = useState(0);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [now, setNow] = useState(new Date());
  const [feedVideos, setFeedVideos] = useState<Video[]>([]);
  const [fakeMessages, setFakeMessages] = useState<Array<{
    id: number;
    user_id: string;
    message: string;
    created_at: string;
    username: string;
  }>>([]);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Generate fake messages for videos without video_url
  useEffect(() => {
    if (video && !video.video_url) {
      const fakeUsers = [
        { id: 'fake_user_1', username: 'AlexRider' },
        { id: 'fake_user_2', username: 'MayaTech' },
        { id: 'fake_user_3', username: 'SamViewer' },
        { id: 'fake_user_4', username: 'LunaStream' },
        { id: 'fake_user_5', username: 'MaxPrime' }
      ];
      
      // Simple, topic-relevant, FOMO-inducing comments
      const fakeComments = [
        "Missed the premiere, wish I saw it.",
        "AI startups... not what I expected.",
        "Anyone else shocked by the truth?",
        "Wish I joined from the start.",
        "This changed how I see AI companies.",
        "So many secrets behind the scenes.",
        "Why didn't I watch this live?",
        "That part about the billion-dollar lie... wow.",
        "Makes you think twice about AI hype.",
        "Next time, I'm not missing the premiere."
      ];
      
      const messages = fakeUsers.map((user, index) => ({
        id: index + 1,
        user_id: user.id,
        message: fakeComments[index % fakeComments.length],
        created_at: new Date(Date.now() - (fakeUsers.length - index) * 30000).toISOString(),
        username: user.username
      }));
      
      setFakeMessages(messages);
    } else {
      setFakeMessages([]);
    }
  }, [video]);

  useEffect(() => {
    // Get current user
    try {
      supabase.auth.getUser().then(({ data: { user } }: any) => {
        setCurrentUser(user);
      }).catch((error: any) => {
        console.error('Error getting user:', error);
      });
    } catch (error) {
      console.error('Supabase initialization error:', error);
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    
    // Load video
    supabase
      .from('videos')
      .select('*')
      .eq('id', id)
      .single()
      .then(async ({ data }: any) => {
        setVideo(data);
        if (data?.user_id) {
          // Load author username and avatar
          const { data: userData } = await supabase
            .from('users')
            .select('username, avatar_url')
            .eq('id', data.user_id)
            .single();
          setAuthorUsername(userData?.username || null);
          // Update video with avatar_url
          setVideo({
            ...data,
            avatar_url: userData?.avatar_url || undefined,
            username: userData?.username || undefined
          });
        } else {
          setVideo(data);
        }
      });

    // Load waiting count
    loadWaitingCount();
    
    // Check if current user is waiting
    if (currentUser) {
      checkIfWaiting();
    }
  }, [id, currentUser]);

  useEffect(() => {
    // Load video feed (excluding current)
    supabase
      .from('videos')
      .select('id, title, cover_url, premiere_at, duration')
      .neq('id', id)
      .order('premiere_at', { ascending: false })
      .limit(12)
      .then(({ data }: { data: any }) => {
        if (data) setFeedVideos(data);
      });
  }, [id]);

  // "Now" feed (current hour catalog, like on main page)
  const [nowFeed, setNowFeed] = useState<Video[]>([]);
  useEffect(() => {
    if (!video) return;
    const now = new Date();
    
    const loadNowFeed = async () => {
      const { data: videos } = await supabase
        .from('videos')
        .select('id, title, cover_url, premiere_at, duration, user_id')
        .neq('id', id)
        .lte('premiere_at', now.toISOString()) // Only videos that have already started
        .gte('premiere_at', new Date(now.getTime() - 60 * 60 * 1000).toISOString()) // Within the last hour
        .order('premiere_at', { ascending: false });
      
      if (videos && videos.length > 0) {
        // Filter out completed premieres
        const activeVideos = videos.filter((v: any) => {
          if (!v.duration) return true; // If no duration, show it
          const premiereEnd = new Date(new Date(v.premiere_at).getTime() + v.duration * 1000);
          return premiereEnd > now; // Only show if premiere hasn't ended yet
        });
        
        // Load avatars and usernames
        const userIds = Array.from(new Set(activeVideos.map((v: any) => v.user_id)));
        const { data: usersData } = await supabase
          .from('users')
          .select('id, avatar_url, username')
          .in('id', userIds);
        
        if (usersData) {
          const userMap = Object.fromEntries(usersData.map((u: any) => [u.id, { avatar_url: u.avatar_url, username: u.username }]));
          const videosWithAvatars = activeVideos.map((v: any) => ({
            ...v,
            avatar_url: userMap[v.user_id]?.avatar_url || undefined,
            username: userMap[v.user_id]?.username || undefined
          }));
          setNowFeed(videosWithAvatars);
        } else {
          setNowFeed(activeVideos);
        }
      } else {
        setNowFeed(videos || []);
      }
    };
    
    loadNowFeed();
  }, [id, video]);

  const loadWaitingCount = async () => {
    if (!id) return;
    
    try {
      const { count, error } = await supabase
        .from('video_expected_users')
        .select('*', { count: 'exact', head: true })
        .eq('video_id', id);
      
      if (!error && count !== null) {
        setWaitingCount(count);
      }
    } catch (error) {
      console.error('Error loading waiting count:', error);
    }
  };

  const checkIfWaiting = async () => {
    if (!id || !currentUser) return;
    
    try {
      const { data, error } = await supabase
        .from('video_expected_users')
        .select('*')
        .eq('video_id', id)
        .eq('user_id', currentUser.id)
        .single();
      
      setIsWaiting(!!data);
    } catch (error) {
      console.error('Error checking waiting status:', error);
    }
  };

  const toggleWaiting = async () => {
    if (!id) return;

    if (!currentUser) {
      // Show email form for non-registered users
      setShowEmailForm(true);
      return;
    }

    if (isLoading) return; // Prevent double clicks

    setIsLoading(true);

    try {
      if (isWaiting) {
        // Remove from waiting list
        const { error } = await supabase
          .from('video_expected_users')
          .delete()
          .eq('video_id', id)
          .eq('user_id', currentUser.id);
        
        if (!error) {
          setIsWaiting(false);
          setWaitingCount(prev => Math.max(0, prev - 1));
        } else {
          console.error('Error removing from waiting list:', error);
        }
      } else {
        // Add to waiting list
        const { error } = await supabase
          .from('video_expected_users')
          .insert({
            video_id: id,
            user_id: currentUser.id
          });
        
        if (!error) {
          setIsWaiting(true);
          setWaitingCount(prev => prev + 1);
        } else {
          console.error('Error adding to waiting list:', error);
        }
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendEmotionToChat = async (emotion: { id: number; name: string; gif: string }) => {
    if (!currentUser || !video) return;
    try {
      await supabase.from('video_chat_messages').insert({
        video_id: video.id,
        user_id: currentUser.id,
        message: emotion.gif // send gif link
      });
    } catch (e) {
      // Add error handling
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !id) return;

    setIsLoading(true);
    try {
      // Save email to Supabase
      const { error } = await supabase
        .from('premiere_notifications')
        .insert({
          video_id: id,
          email: email,
          created_at: new Date().toISOString()
        });

      if (!error) {
        setEmailSubmitted(true);
        setShowEmailForm(false);
        setEmail('');
      } else {
        console.error('Error saving email:', error);
        alert('Error saving email. Please try again.');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error saving email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!video) return <div>Loading...</div>;

  const premiere = new Date(video.premiere_at);
  const canWatch = now >= premiere;
  const timeUntilPremiere = Math.floor((premiere.getTime() - now.getTime()) / 60000);

  return (
    <>
      <Header disableScrollHide={true} />
    <div style={{ 
      padding: canWatch ? '0' : '8px',
      maxWidth: canWatch ? '100%' : '1200px',
      margin: '0 auto',
      paddingBottom: canWatch ? '60px' : '8px',
      background: '#000000',
      minHeight: '100vh',
      color: '#f3f3f3',
      fontFamily: `'JetBrains Mono', monospace`,
      paddingTop: !canWatch ? 56 : 40,
      // Add margin-top when video is live to account for fixed video
      marginTop: canWatch && video.video_url ? '25vh' : '0'
    }}>
      {/* Удаляю отображение названия ролика сверху, если премьера не началась */}
      {/* {!canWatch && (
        <h1 style={{ fontSize: '24px', marginBottom: '20px', color: '#fff', fontWeight: 700 }}>{video.title}</h1>
      )} */}
      
        {/* Main content */}
        <div style={{ width: '100%' }}>
          {!canWatch && (
            <>
              <div style={{ width: '100%', aspectRatio: '40/28', overflow: 'hidden', margin: 0, padding: 0 }}>
                <img src={video.cover_url} alt={video.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', margin: 0, padding: 0, borderRadius: 8, boxShadow: 'none', background: '#0a0a0c' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '10px 0 0 0' }}>
                <ShareButton />
              </div>
              
              <div style={{ marginBottom: '20px', marginTop: '10px' }}>
                <div style={{
                  background: '#000000',
                  padding: '15px',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 2px 8px #0006',
                }}>
                  <div style={{ fontSize: '16px', color: '#fff', marginRight: 32 }}>
                    Premiere starts in: <strong>{timeUntilPremiere} minutes</strong>
                  </div>
                  <div style={{ fontSize: '14px', color: '#bdbdbd', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2196f3" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 4}}>
                      <circle cx="8" cy="8" r="4"/>
                      <circle cx="17" cy="8.5" r="3.5"/>
                      <ellipse cx="8" cy="17" rx="7" ry="4"/>
                      <ellipse cx="17" cy="17.5" rx="5" ry="2.5"/>
                    </svg>
                    Waiting for premiere: <strong>{waitingCount}</strong>
                  </div>
                </div>
                <div style={{ fontSize: '18px', marginBottom: '2px', color: '#e0e0e0', fontWeight: 700 }}>{video.title}</div>
                <div style={{ fontSize: '15px', marginBottom: '10px', color: '#bdbdbd' }}>{authorUsername ? `@${authorUsername}` : ''}</div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  {emailSubmitted ? (
                    <div style={{
                      background: '#22c55e',
                      color: '#18181b',
                      border: 'none',
                      borderRadius: 7,
                      padding: '12px 24px',
                      fontWeight: 700,
                      fontSize: 15,
                      margin: 0,
                      width: '100%',
                      maxWidth: 420,
                      textAlign: 'center',
                      fontFamily: `'JetBrains Mono', monospace`
                    }}>
                      ✓ Email saved! We'll notify you
                    </div>
                  ) : showEmailForm ? (
                    <form onSubmit={handleEmailSubmit} style={{ width: '100%', maxWidth: 420 }}>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        required
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: '1px solid #23232a',
                          borderRadius: 7,
                          background: '#0a0a0c',
                          color: '#fff',
                          fontSize: 15,
                          marginBottom: 8,
                          fontFamily: `'JetBrains Mono', monospace`
                        }}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="submit"
                          disabled={isLoading}
                          style={{
                            background: '#39FF14',
                            color: '#18181b',
                            border: 'none',
                            borderRadius: 7,
                            padding: '12px 24px',
                            fontWeight: 700,
                            fontSize: 15,
                            cursor: isLoading ? 'default' : 'pointer',
                            opacity: isLoading ? 0.7 : 1,
                            flex: 1,
                            fontFamily: `'JetBrains Mono', monospace`
                          }}
                        >
                          {isLoading ? 'Saving...' : 'Save Email'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowEmailForm(false)}
                          style={{
                            background: '#23232a',
                            color: '#fff',
                            border: '1px solid #23232a',
                            borderRadius: 7,
                            padding: '12px 16px',
                            fontWeight: 700,
                            fontSize: 15,
                            cursor: 'pointer',
                            fontFamily: `'JetBrains Mono', monospace`
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      onClick={toggleWaiting}
                      disabled={isLoading}
                      style={{
                        background: '#bbf7d0',
                        color: '#18181b',
                        border: 'none',
                        borderRadius: 7,
                        padding: '12px 0',
                        fontWeight: 700,
                        fontSize: 15,
                        cursor: isLoading ? 'default' : 'pointer',
                        opacity: isLoading ? 0.7 : 1,
                        margin: 0,
                        width: '100%',
                        maxWidth: 420,
                        transition: 'background 0.2s, color 0.2s',
                        boxShadow: 'none',
                        letterSpacing: 0.2,
                        fontFamily: `'JetBrains Mono', monospace`
                      }}
                    >
                      {isWaiting ? 'You are waiting for the premiere' : isLoading ? '...' : 'Wait for premiere'}
                    </button>
                  )}
                  {currentUser && (
                    <WatchSubscribePush premiereId={video.id} userId={currentUser.id} visible={isWaiting} />
                  )}
                </div>
              </div>
              
              <div style={{ fontSize: '16px', lineHeight: '1.6', marginBottom: '20px', color: '#e0e0e0' }}>
                <strong>Description:</strong><br />
                {video.description}
              </div>
            </>
          )}
          
          {canWatch && (
            <>
              {video.video_url ? (
                <>
                  <VideoPlayerWithFullscreen videoUrl={video.video_url} premiereAt={video.premiere_at} />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '10px 0 0 0' }}>
                    <ShareButton />
                  </div>
                </>
              ) : (
                <>
                  <div style={{
                    background: 'linear-gradient(135deg, #18181b 60%, #23232a 100%)',
                    color: '#f3f3f3',
                    borderRadius: 16,
                    padding: '36px 28px 32px 28px',
                    margin: '48px 10px 32px 10px',
                    maxWidth: 480,
                    textAlign: 'center',
                    fontSize: 20,
                    fontWeight: 600,
                    letterSpacing: 0.2,
                    boxShadow: '0 4px 32px #000a',
                    border: '1.5px solid #23232a',
                    position: 'relative',
                  }}>
                    <div style={{ fontSize: 44, marginBottom: 8, color: '#22c55e', lineHeight: 1 }}>
                      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l2.5 2.5"/></svg>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#f3f3f3', marginBottom: 6 }}>
                      Elite content expired
                    </div>
                    <div style={{ fontSize: 14, color: '#bdbdbd', fontWeight: 400, marginBottom: 8 }}>
                      You missed it. This exclusive premiere is gone forever.<br/>
                      Only those who watched live got to see it.
                    </div>
                    <div style={{ fontSize: 12, color: '#666', fontWeight: 400, marginBottom: 16, textAlign: 'center' }}>
                      {(() => {
                        // Generate consistent number based on video ID
                        let hash = 0;
                        for (let i = 0; i < video.id.length; i++) {
                          const char = video.id.charCodeAt(i);
                          hash = ((hash << 5) - hash) + char;
                          hash = hash & hash; // Convert to 32-bit integer
                        }
                        return Math.abs(hash % 35) + 1;
                      })()} people watched this premiere
                    </div>
                    <a href="/" style={{
                      display: 'inline-block',
                      background: 'linear-gradient(90deg, #22c55e 60%, #16a34a 100%)',
                      color: '#18181b',
                      fontWeight: 700,
                      fontSize: 16,
                      borderRadius: 8,
                      padding: '12px 32px',
                      textDecoration: 'none',
                    }}>
                      Go to main page
                    </a>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '10px 0 0 0' }}>
                    <ShareButton />
                  </div>
                </>
              )}
              {/* Collapsible information tab */}
              <div style={{
                background: '#000000',
                borderTop: '1px solid #23232a',
                marginTop: '0',
              }}>
                {/* Tab header */}
                <div 
                  onClick={() => setIsInfoExpanded(!isInfoExpanded)}
                  style={{
                    padding: '16px 20px',
                    background: '#000000',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: isInfoExpanded ? '1px solid #23232a' : 'none',
                    transition: 'background 0.3s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#111111'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#000000'}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}>
                    {video.avatar_url ? (
                      <img
                        src={video.avatar_url}
                        alt="avatar"
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          objectFit: 'cover',
                          background: '#23232a',
                          border: '1.5px solid #23232a',
                          display: 'block',
                        }}
                        onError={e => { (e.currentTarget as HTMLImageElement).src = '/avatar-placeholder.png'; }}
                      />
                    ) : (
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: '#23232a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '16px',
                      }}>
                        {authorUsername ? authorUsername.charAt(0).toUpperCase() : ''}
                      </div>
                    )}
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '16px', color: '#fff' }}>
                        {video.title}
                      </div>
                      <div style={{ fontSize: '14px', color: '#bdbdbd' }}>
                        {authorUsername ? `@${authorUsername}` : ''}
                      </div>
                    </div>
                  </div>
                  <div style={{
                    fontSize: '20px',
                    color: '#bdbdbd',
                    transition: 'transform 0.3s',
                    transform: isInfoExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}>
                    ▼
                  </div>
                </div>
                
                {/* Tab content */}
                {isInfoExpanded && (
                  <div style={{
                    padding: '20px',
                    background: '#000000',
                    borderBottom: '1px solid #23232a',
                  }}>
                    <div style={{ marginBottom: '16px' }}>
                      <h3 style={{ 
                        fontSize: '20px', 
                        marginBottom: '8px',
                        color: '#fff',
                        fontWeight: '600',
                      }}>
                        {video.title}
                      </h3>
                      <div style={{ 
                        fontSize: '14px', 
                        color: '#bdbdbd',
                        marginBottom: '12px',
                      }}>
                        Premiere: {new Date(video.premiere_at).toLocaleString('en-US')}
                      </div>
                    </div>
                    
                    <div style={{
                      fontSize: '15px',
                      lineHeight: '1.6',
                      color: '#e0e0e0',
                      background: '#18181b',
                      padding: '16px',
                      borderRadius: '8px',
                      border: '1px solid #23232a',
                    }}>
                      <strong>Description:</strong><br />
                      {video.description}
                    </div>
                    
                    <div style={{
                      marginTop: '16px',
                      padding: '12px 16px',
                      background: 'linear-gradient(135deg, #23232a 80%, #1769aa 100%)',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: '500',
                    }}>
                      🎬 Premiere is active • Watch and chat in comments
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 12, margin: '18px 10px 18px 10px', justifyContent: 'center', alignItems: 'center' }}>
                <button
                  onClick={() => setShowChat((v) => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    background: '#23232a', color: '#e5e7eb', border: 'none', borderRadius: 7,
                    padding: '0 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                    transition: 'background 0.2s, color 0.2s', boxShadow: '0 1px 8px #0002',
                    letterSpacing: 0.2, width: '100%', height: 40,
                    fontFamily: `'JetBrains Mono', monospace`
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', display: 'inline-block' }}><path d="M21 11.5a8.38 8.38 0 0 1-1.9 5.4A8.5 8.5 0 0 1 12 21.5a8.38 8.38 0 0 1-5.4-1.9L3 21l1.4-3.6A8.38 8.38 0 0 1 2.5 12a8.5 8.5 0 1 1 17 0z"/></svg>
                  {showChat ? 'Hide comments' : 'Show comments'}
                </button>
                <a href="/register" style={{
                  display: 'inline-block',
                  background: '#39FF14',
                  color: '#18181b',
                  border: 'none',
                  borderRadius: 7,
                  padding: '12px 24px',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  transition: 'background 0.2s, color 0.2s',
                  boxShadow: 'none',
                  letterSpacing: 0.2,
                  textDecoration: 'none',
                  fontFamily: `'JetBrains Mono', monospace`,
                  textAlign: 'center',
                  minWidth: 120,
                  maxWidth: 180,
                  width: '100%',
                }}>
                  Register
                </a>
              </div>
            </>
          )}
        </div>

      {/* Live chat below - only for active premieres */}
      {canWatch && video && (
        <>
          {showChat && (
            <div style={{ margin: '18px 0 0 0' }}>
              <LiveChat videoId={video.id} currentUser={currentUser} fakeMessages={fakeMessages} />
            </div>
          )}
          
          {/* Vertical "Now" feed */}
          <div style={{ margin: '32px 0 0 0', width: '100%', padding: '0 10px' }}>
            <h2 style={{ color: '#bdbdbd', fontSize: 18, fontWeight: 600, margin: '0 0 18px 0', letterSpacing: 0.2 }}>Now on air</h2>
            {nowFeed.length === 0 && <div style={{ color: '#666', fontSize: 15, textAlign: 'center', margin: '24px 0' }}>No other premieres in this hour</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {nowFeed.map(v => (
                <div
                  key={v.id}
                  style={{
                    width: '100%',
                    maxWidth: 600,
                    margin: '0 auto',
                    background: 'none',
                    borderRadius: 8,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <a href={`/watch/${v.id}`} style={{
                    display: 'block',
                    width: '100%',
                    height: 'auto',
                    aspectRatio: '4/3',
                    overflow: 'hidden',
                    position: 'relative',
                  }}>
                    <img
                      src={v.cover_url}
                      alt={v.title}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        background: 'none',
                        display: 'block',
                        border: 'none',
                        boxShadow: 'none',
                      }}
                      onError={e => { e.currentTarget.src = '/placeholder.png'; }}
                    />
                    {/* Status for corners */}
                    {(() => {
                      const now = new Date();
                      const premiere = new Date(v.premiere_at);
                      const durationMs = (v.duration || 0) * 1000;
                      const extraMs = 3 * 60 * 1000;
                      let status = '';
                      if (premiere <= now && now.getTime() - premiere.getTime() < durationMs + extraMs) {
                        status = 'live';
                      } else if (premiere > now && premiere.getTime() - now.getTime() < 30 * 60 * 1000) {
                        status = 'soon';
                      } else if (premiere > now) {
                        status = 'waiting';
                      } else {
                        status = 'ended';
                      }
                      // Top left corner
                      if (status === 'live') {
                        return (
                          <div style={{
                            position: 'absolute',
                            top: 8,
                            left: 8,
                            background: 'rgba(0,0,0,0.65)',
                            color: '#fff',
                            fontSize: 13,
                            fontWeight: 500,
                            borderRadius: 12,
                            padding: '2px 10px',
                            zIndex: 2,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:'middle',marginRight:3}}><ellipse cx="12" cy="12" rx="8" ry="5"/><circle cx="12" cy="12" r="2.2"/></svg> 0
                          </div>
                        );
                      } else if (status === 'soon' || status === 'waiting') {
                        return (
                          <div style={{
                            position: 'absolute',
                            top: 8,
                            left: 8,
                            background: 'rgba(0,0,0,0.65)',
                            color: '#fff',
                            fontSize: 13,
                            fontWeight: 500,
                            borderRadius: 12,
                            padding: '2px 10px',
                            zIndex: 2,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:'middle',marginRight:3}}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg> 0
                          </div>
                        );
                      }
                      return null;
                    })()}
                    {/* Bottom right corner: status */}
                    <div style={{
                      position: 'absolute',
                      right: 8,
                      bottom: 8,
                      background: 'rgba(0,0,0,0.65)',
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: 12,
                      padding: '2px 12px',
                      zIndex: 2,
                    }}>
                      {(() => {
                        const now = new Date();
                        const premiere = new Date(v.premiere_at);
                        const durationMs = (v.duration || 0) * 1000;
                        const extraMs = 3 * 60 * 1000;
                        if (premiere <= now && now.getTime() - premiere.getTime() < durationMs + extraMs) {
                          return 'Live';
                        } else if (premiere > now && premiere.getTime() - now.getTime() < 30 * 60 * 1000) {
                          return 'Soon';
                        } else if (premiere > now) {
                          return 'Expected';
                        } else {
                          return 'Completed';
                        }
                      })()}
                    </div>
                    {/* Premiere date — bottom left corner */}
                    <div style={{
                      position: 'absolute',
                      left: 8,
                      bottom: 8,
                      background: 'rgba(0,0,0,0.65)',
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 500,
                      borderRadius: 12,
                      padding: '2px 12px',
                      zIndex: 2,
                    }}>
                      {new Date(v.premiere_at).toLocaleString()}
                    </div>
                  </a>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px 12px 10px 12px' }}>
                    <h3 style={{
                      fontSize: 16,
                      fontWeight: 700,
                      margin: '0 0 6px 0',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      color: '#fff',
                    }}>
                      <a href={`/watch/${v.id}`} style={{ color: '#fff', textDecoration: 'none' }}>{v.title}</a>
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: '#bdbdbd', marginBottom: 4, gap: 6 }}>
                      <img src={v.avatar_url || '/avatar-placeholder.png'} alt="avatar" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', background: '#23232a', border: '1px solid #23232a', marginRight: 4 }} />
                      {v.username || '—'}
                    </div>
                    {new Date(v.premiere_at) > new Date() && (
                      <div style={{ fontSize: 10, color: '#e57373', marginTop: 0 }}>
                        Until premiere: {getTimeLeft(v.premiere_at)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
    </>
  );
}

Watch.getInitialProps = async (ctx: NextPageContext) => {
  const { query } = ctx;
  const id = query.id;
  if (!id) return {};
  // Get video from database
  const { data: video } = await supabase
    .from('videos')
    .select('premiere_at')
    .eq('id', id)
    .single();
  if (!video) return {};
  const now = new Date();
  const premiere = new Date(video.premiere_at);
  // If premiere hasn't started yet, hide Header
  return { hideHeader: now < premiere };
};

// Custom video player with fullscreen button (dynamic icon)
function VideoPlayerWithFullscreen({ videoUrl, premiereAt }: { videoUrl: string, premiereAt: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  // Calculate how many seconds have passed since the premiere
  const [startOffset, setStartOffset] = useState(0);
  useEffect(() => {
    if (!premiereAt) return;
    const premiereDate = new Date(premiereAt);
    const now = new Date();
    const diff = Math.floor((now.getTime() - premiereDate.getTime()) / 1000); // in seconds
    setStartOffset(diff > 0 ? diff : 0);
  }, [premiereAt]);

  // Set currentTime only once when metadata is loaded
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const setTime = () => {
      if (startOffset > 0 && video.duration && startOffset < video.duration) {
        video.currentTime = startOffset;
        video.play();
      }
    };
    video.addEventListener('loadedmetadata', setTime);
    if (video.readyState >= 1) setTime();
    return () => {
      video.removeEventListener('loadedmetadata', setTime);
    };
  }, [startOffset, videoUrl]);

  // Fullscreen state change handler
  const handleFullscreenChange = useCallback(() => {
    const fsElement = document.fullscreenElement || (document as any).webkitFullscreenElement || (document as any).msFullscreenElement;
    setIsFullscreen(!!fsElement && (containerRef.current === fsElement));
  }, []);

  useEffect(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, [handleFullscreenChange]);

  useEffect(() => {
    if (isPseudoFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isPseudoFullscreen]);

  const handleFullscreen = () => {
    const video = videoRef.current;
    if (!isFullscreen) {
      if (video) {
        if (video.requestFullscreen) {
          video.requestFullscreen();
        } else if ((video as any).webkitRequestFullscreen) {
          (video as any).webkitRequestFullscreen();
        } else if ((video as any).msRequestFullscreen) {
          (video as any).msRequestFullscreen();
        }
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
    }
  };

  // ,kf ,k

  const isMobile = isMobileDevice();

  return (
    <div
      ref={containerRef}
      style={{
        position: isPseudoFullscreen ? 'fixed' : 'fixed',
        top: isPseudoFullscreen ? 0 : 56,
        left: isPseudoFullscreen ? 0 : 0,
        width: isPseudoFullscreen ? '100vw' : '100%',
        height: isPseudoFullscreen ? '100vh' : '25vh',
        zIndex: isPseudoFullscreen ? 9999 : 1000,
        background: '#000000',
        overflow: isPseudoFullscreen ? 'hidden' : 'hidden',
        aspectRatio: isPseudoFullscreen ? undefined : '4/2.8',
        display: isPseudoFullscreen ? 'flex' : 'flex',
        alignItems: isPseudoFullscreen ? 'center' : 'center',
        justifyContent: isPseudoFullscreen ? 'center' : 'center',
      }}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        autoPlay
        playsInline
        muted={isMuted}
        controls={false}
        disablePictureInPicture
        controlsList="nodownload nofullscreen noremoteplayback noplaybackrate nofullscreen"
        style={{
          width: isPseudoFullscreen && isMobile ? '100vh' : '100%',
          height: isPseudoFullscreen && isMobile ? '100vw' : '100%',
          objectFit: isPseudoFullscreen && isMobile ? 'contain' : 'cover',
          position: isPseudoFullscreen && isMobile ? 'absolute' : 'static',
          top: isPseudoFullscreen && isMobile ? '50%' : undefined,
          left: isPseudoFullscreen && isMobile ? '50%' : undefined,
          transform: isPseudoFullscreen && isMobile ? 'translate(-50%, -50%) rotate(90deg)' : undefined,
          background: '#000',
          maxHeight: '100%',
        }}
        onContextMenu={e => e.preventDefault()}
      />
      {/* Unmute button (left) */}
      <button
        onClick={() => {
          setIsMuted(false);
          if (videoRef.current) {
            videoRef.current.muted = false;
            videoRef.current.volume = 1;
            videoRef.current.play();
          }
        }}
          style={{
            position: 'absolute',
          top: 12,
          left: 12,
          background: isMuted ? 'rgba(24,24,27,0.85)' : 'rgba(24,24,27,0.5)',
          border: 'none',
          borderRadius: 6,
          padding: 6,
          cursor: isMuted ? 'pointer' : 'default',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.2s',
          }}
        title={isMuted ? 'Unmute' : 'Sound on'}
        disabled={!isMuted}
      >
        {/* Sound icon (not thin) */}
        {isMuted ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 9 9 9 13 5 13 19 9 15 5 15 5 9" fill="#fff"/>
            <line x1="17" y1="9" x2="21" y2="13" stroke="#fff" strokeWidth="2"/>
            <line x1="21" y1="9" x2="17" y2="13" stroke="#fff" strokeWidth="2"/>
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 9 9 9 13 5 13 19 9 15 5 15 5 9" fill="#fff"/>
            <path d="M15 9.34a4 4 0 0 1 0 5.32" stroke="#fff" strokeWidth="2"/>
            <path d="M17.5 7.5a8 8 0 0 1 0 9" stroke="#fff" strokeWidth="2"/>
          </svg>
        )}
      </button>
      <button
        onClick={() => setIsPseudoFullscreen(!isPseudoFullscreen)}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          background: 'rgba(24,24,27,0.85)',
          border: 'none',
          borderRadius: 6,
          padding: 6,
          cursor: 'pointer',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.2s',
        }}
        title={isPseudoFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
      >
        {isPseudoFullscreen ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="5" x2="19" y2="19" />
            <line x1="19" y1="5" x2="5" y2="19" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 7 3 3 7 3" />
            <polyline points="17 3 21 3 21 7" />
            <polyline points="21 17 21 21 17 21" />
            <polyline points="7 21 3 21 3 17" />
          </svg>
        )}
      </button>
      {/* Block video interaction on mobile except fullscreen mode */}
      {isMobile && !isFullscreen && !isPseudoFullscreen && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 9,
            background: 'transparent',
            pointerEvents: 'auto',
            touchAction: 'none',
          }}
          onTouchStart={e => e.preventDefault()}
          onClick={e => e.preventDefault()}
        />
      )}
    </div>
  );
}

// Share premiere button
function ShareButton() {
  const handleShare = async () => {
    const url = window.location.href;
    const title = document.title;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch (e) {}
    } else {
      try {
        await navigator.clipboard.writeText(url);
        alert('Link copied!');
      } catch (e) {
        prompt('Copy link:', url);
      }
    }
  };
  return (
    <button
      onClick={handleShare}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: 'none',
        border: 'none',
        color: '#2563eb',
        fontSize: 15,
        cursor: 'pointer',
        padding: '4px 10px',
        borderRadius: 0,
        transition: 'background 0.2s',
        fontFamily: `'JetBrains Mono', monospace`
      }}
      title="Share premiere"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}>
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
      Share
    </button>
  );
}

function SubscribeAuthorButton({ authorId, currentUser }: { authorId: string, currentUser: any }) {
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (currentUser && currentUser.id === authorId) return null;

  // Check subscription on component load
  useEffect(() => {
    if (!currentUser || !authorId) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('author_subscriptions')
          .select('id')
          .eq('user_id', currentUser.id)
          .eq('author_id', authorId)
          .single();
        if (!error && data) {
          setSubscribed(true);
        } else {
          setSubscribed(false);
        }
      } catch (e) {
        // ignore
      }
    })();
  }, [currentUser, authorId]);

  async function handleSubscribe() {
    if (!currentUser) {
      window.location.href = '/register';
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/subscribe-author', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, authorId })
      });
      if (!res.ok) throw new Error('Error subscribing');
      setSubscribed(true);
      if ('Notification' in window) {
        if (Notification.permission !== 'granted') {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            alert('You subscribed to premieres, but did not allow push notifications. Please enable them to receive notifications!');
            setLoading(false);
            return;
          }
        }
      }
      alert('You subscribed to premieres. When they appear, we will send you a notification!');
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  return (
    <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
      <button
        onClick={handleSubscribe}
        disabled={subscribed || loading}
        style={{
          background: subscribed ? '#e5e7eb' : '#e5e7eb',
          color: '#18181b',
          border: 'none',
          borderRadius: 7,
          padding: '12px 0',
          paddingLeft: 10,
          paddingRight: 10,
          fontWeight: 700,
          fontSize: 12,
          cursor: subscribed ? 'default' : 'pointer',
          opacity: loading ? 0.7 : 1,
          marginTop: 10,
          marginBottom: 4,
          width: 'calc(100% - 20px)',
          letterSpacing: 0.2,
          boxShadow: '0 1px 8px #0002',
          transition: 'background 0.2s, color 0.2s',
          display: 'block',
        }}
      >
        {subscribed ? 'You are subscribed to the author' : loading ? 'Subscribing...' : 'Subscribe to author'}
      </button>
      {error && <div style={{ color: '#f87171', marginTop: 8, fontSize: 14 }}>{error}</div>}
    </div>
  );
}
