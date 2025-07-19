import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type Video = {
  id: string;
  title: string;
  cover_url: string;
  premiere_at: string;
  user_id: string;
  waitingCount?: number;
  avatar_url?: string;
  username?: string;
};

function getHour(dateStr: string) {
  return new Date(dateStr).getHours();
}

function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
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

export default function Home() {
  const [videos, setVideos] = useState<any[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  // Load waiting count and avatars
  const loadAvatars = async (videosData: Video[]) => {
    const userIds = Array.from(new Set(videosData.map(v => v.user_id)));
    console.log('Loading avatars for users:', userIds);
    
    if (userIds.length === 0) return videosData;
    
    const { data: usersData, error } = await supabase
      .from('users')
      .select('id, avatar_url, username');
    
    console.log('User data from database:', usersData);
    console.log('Error loading users:', error);
    
    if (error || !usersData) return videosData;
    
    const userMap = Object.fromEntries(usersData.map((u: any) => [u.id, { avatar_url: u.avatar_url, username: u.username }]));
    console.log('userMap:', userMap);
    console.log('videosData before avatar merge:', videosData);
    
    const result: Video[] = videosData.map(v => ({
      ...v,
      avatar_url: userMap[v.user_id]?.avatar_url || undefined,
      username: userMap[v.user_id]?.username || undefined
    }));
    console.log('videosData after avatar merge:', result);
    
    return result;
  };

  // Function to load waiting count for videos
  const loadWaitingCounts = async (videoIds: string[], videosData: Video[]) => {
    if (videoIds.length === 0) return;
    
    try {
      const { data, error } = await supabase
        .from('video_expected_users')
        .select('video_id')
        .in('video_id', videoIds);
      
      if (error) {
        console.error('Error loading waiting users:', error);
        return;
      }
      
      if (data) {
        // Group by video_id and count
        const counts: { [key: string]: number } = {};
        data.forEach((item: any) => {
          counts[item.video_id] = (counts[item.video_id] || 0) + 1;
        });
        
        // Update videos with waiting count
        let updatedVideos = videosData.map(video => ({
            ...video,
          waitingCount: counts[video.id] !== undefined ? counts[video.id] : 0
        }));
        // Load avatars
        const videosWithAvatars = await loadAvatars(updatedVideos);
        setVideos(videosWithAvatars);
      }
    } catch (error) {
      console.error('Error in loadWaitingCounts:', error);
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function fetchVideos() {
      try {
        const { data, error } = await supabase
          .from('videos')
          .select('id, title, cover_url, premiere_at, user_id, duration');
        if (!error && isMounted) {
          const videosData = data || [];
          // Load waiting count and avatars
          const videoIds = videosData.map((v: any) => v.id);
          await loadWaitingCounts(videoIds, videosData);
        }
      } catch (error) {
        console.error('Error loading videos:', error);
      }
    }
    fetchVideos();
    // Mobile detection
    const checkMobile = () => setIsMobile(window.matchMedia('(max-width: 600px)').matches);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => { isMounted = false; window.removeEventListener('resize', checkMobile); };
  }, []);

  // Get current hour and user date
  const now = new Date();
  const nowHour = now.getHours();

  // Filter only today's videos
  const todayVideos = videos.filter(v => isToday(v.premiere_at)).sort((a, b) => new Date(a.premiere_at).getTime() - new Date(b.premiere_at).getTime());

  // Group today's videos by premiere hour
  const videosByHour: { [hour: number]: Video[] } = {};
  todayVideos.forEach(video => {
    const hour = getHour(video.premiere_at);
    if (!videosByHour[hour]) videosByHour[hour] = [];
    videosByHour[hour].push(video);
  });

  // For 'Now' section: all videos of current hour
  const nowVideos = todayVideos.filter(v => {
    const d = new Date(v.premiere_at);
    return d.getHours() === nowHour;
  }).sort((a, b) => {
    // Sort: first those that have already started, then those that haven't started yet
    const now = new Date();
    const aTime = new Date(a.premiere_at);
    const bTime = new Date(b.premiere_at);
    const aStarted = aTime <= now;
    const bStarted = bTime <= now;
    if (aStarted === bStarted) {
      // If both started or both haven't started — sort by premiere time
      return aTime.getTime() - bTime.getTime();
    }
    // First those that have already started
    return aStarted ? -1 : 1;
  });

  // Other hours (excluding current)
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const afterNow = hours.filter(h => h > nowHour);
  const beforeNow = hours.filter(h => h < nowHour);
  const orderedHours = [nowHour, ...afterNow, ...beforeNow];

  // Function for beautiful header
  function hourLabel(hour: number) {
    return `${hour.toString().padStart(2, '0')}:00`;
  }

  return (
    <div style={{ padding: '64px 12px 60px 12px', background: '#111114', minHeight: '100vh', color: '#e0e0e0', boxSizing: 'border-box' }}>
      {/* Warning that videos disappear after premiere */}
      <div style={{
        background: '#18181b',
        color: '#bdbdbd',
        padding: '12px 16px',
        margin: '0 0 16px 0',
        borderRadius: '8px',
        border: '1px solid #23232a',
        textAlign: 'center',
        fontSize: '14px',
        lineHeight: '1.4',
      }}>
        Videos are automatically deleted immediately after the premiere ends
      </div>
      
      {/* 'Now' section */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '18px 0 10px 8px', color: '#f3f3f3' }}>{hourLabel(nowHour)} (Now)</h2>
        <div style={{
          display: 'block',
        }}>
          {nowVideos.length === 0 && <div style={{ color: '#bdbdbd', fontSize: 16 }}>No videos</div>}
          {nowVideos.map(video => (
            <div
              key={video.id}
              style={{
                width: '100%',
                maxWidth: 600,
                margin: '0 auto 16px auto',
                background: 'none',
                borderRadius: 8,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <a href={`/watch/${video.id}`} style={{
                display: 'block',
                width: '100%',
                height: 'auto',
                aspectRatio: '4/3',
                overflow: 'hidden',
                position: 'relative',
              }}>
                <img
                  src={video.cover_url}
                  alt={video.title}
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
                  const premiere = new Date(video.premiere_at);
                  const durationMs = (video.duration || 0) * 1000;
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
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:'middle',marginRight:3}}><ellipse cx="12" cy="12" rx="8" ry="5"/><circle cx="12" cy="12" r="2.2"/></svg> {video.waitingCount || 0}
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
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:'middle',marginRight:3}}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg> {video.waitingCount || 0}
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
                    const premiere = new Date(video.premiere_at);
                    const durationMs = (video.duration || 0) * 1000;
                    const extraMs = 3 * 60 * 1000;
                    if (premiere <= now && now.getTime() - premiere.getTime() < durationMs + extraMs) {
                      // Live (video duration + 3 minutes)
                      return 'Live';
                    } else if (premiere > now && premiere.getTime() - now.getTime() < 30 * 60 * 1000) {
                      // Soon (less than 30 minutes before premiere)
                      return 'Soon';
                    } else if (premiere > now) {
                      // Expected
                      return 'Expected';
                    } else {
                      // Completed
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
                  {new Date(video.premiere_at).toLocaleString()}
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
                  <a href={`/watch/${video.id}`} style={{ color: '#fff', textDecoration: 'none' }}>{video.title}</a>
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: '#bdbdbd', marginBottom: 4, gap: 6 }}>
                  <img src={video.avatar_url || '/avatar-placeholder.png'} alt="avatar" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', background: '#23232a', border: '1px solid #23232a', marginRight: 4 }} />
                  {video.username || '—'}
                </div>
                {new Date(video.premiere_at) > new Date() && (
                  <div style={{ fontSize: 10, color: '#e57373', marginTop: 0 }}>
                    Until premiere: {getTimeLeft(video.premiere_at)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
      {/* Other hour sections — always show */}
      {orderedHours.filter(h => h !== nowHour).map(hour => (
        <section key={hour} style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '18px 0 10px 8px', color: '#f3f3f3' }}>{hourLabel(hour)}</h2>
          <div style={{
            display: 'flex',
            overflowX: 'auto',
            gap: 14,
            padding: '4px 0 8px 8px',
            scrollbarWidth: 'thin',
          }}>
            {(!videosByHour[hour] || videosByHour[hour].length === 0) && <div style={{ color: '#bdbdbd', fontSize: 16 }}>No videos</div>}
            {videosByHour[hour] && videosByHour[hour].map(video => (
              <div
                key={video.id}
                style={{
                  width: 340,
                  minWidth: 340,
                  maxWidth: 340,
                  height: 360,
                  flex: '0 0 auto',
                  background: 'none',
                  border: 'none',
                  borderRadius: 8,
                  boxShadow: 'none',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  marginBottom: 8,
                }}
              >
                <a href={`/watch/${video.id}`} style={{
                  display: 'block',
                  width: '100%',
                  height: 238,
                  overflow: 'hidden',
                  position: 'relative',
                }}>
                  <img
                    src={video.cover_url}
                    alt={video.title}
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
                    const premiere = new Date(video.premiere_at);
                    let status = '';
                    if (premiere <= now && now.getTime() - premiere.getTime() < 2 * 60 * 60 * 1000) {
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
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:'middle',marginRight:3}}><ellipse cx="12" cy="12" rx="8" ry="5"/><circle cx="12" cy="12" r="2.2"/></svg> {video.waitingCount || 0}
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
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:'middle',marginRight:3}}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg> {video.waitingCount || 0}
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
                      const premiere = new Date(video.premiere_at);
                      if (premiere <= now && now.getTime() - premiere.getTime() < 2 * 60 * 60 * 1000) {
                        // Live (up to 2 hours after premiere)
                        return 'Live';
                      } else if (premiere > now && premiere.getTime() - now.getTime() < 30 * 60 * 1000) {
                        // Soon (less than 30 minutes before premiere)
                        return 'Soon';
                      } else if (premiere > now) {
                        // Expected
                        return 'Expected';
                      } else {
                        // Completed
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
                    {new Date(video.premiere_at).toLocaleString()}
                  </div>
                </a>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '6px 10px 6px 10px', minHeight: 0 }}>
                  <div style={{ padding: '2px 0', margin: '0 0 4px 0', position: 'relative', zIndex: 1 }}>
                    <h3 style={{
                      fontSize: 16,
                      fontWeight: 700,
                      margin: 0,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      color: '#fff',
                      lineHeight: 1.2,
                    }}>
                      <a href={`/watch/${video.id}`} style={{ color: '#fff', textDecoration: 'none' }}>{video.title}</a>
                    </h3>
                  </div>
                  {new Date(video.premiere_at) > new Date() && (
                    <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
                      Until premiere: {getTimeLeft(video.premiere_at)}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, color: '#666', marginTop: 2, gap: 6 }}>
                    <img src={video.avatar_url || '/avatar-placeholder.png'} alt="avatar" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover', background: '#23232a', border: '1px solid #23232a', marginRight: 4 }} />
                    {video.username || '—'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
      {/* Easter egg at the very bottom of the feed */}
      <div style={{
        width: '100%',
        textAlign: 'center',
        color: '#23232a',
        fontSize: 13,
        margin: '40px 0 60px 0', // increased bottom margin
        opacity: 0.45,
        letterSpacing: 1.5,
        userSelect: 'none',
      }}>timurXD</div>
    </div>
  );
}
