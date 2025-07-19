import { useRouter } from 'next/router';
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import LiveChat from '../../components/LiveChat';
// import EmotionCarousel from '../../components/EmotionCarousel';
import { NextPageContext } from 'next';
import WatchSubscribePush from '../../components/WatchSubscribePush';
import React from 'react';
import Header from '../../components/Header';
// Хелпер для определения мобильного устройства
function isMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

type Video = {
  id: string;
  title: string;
  cover_url: string;
  premiere_at: string;
  user_id: string;
  description: string;
  video_url: string;
  duration?: number; // Добавляем поле duration
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
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Получаем текущего пользователя
    try {
      supabase.auth.getUser().then(({ data: { user } }: any) => {
        setCurrentUser(user);
      }).catch((error: any) => {
        console.error('Ошибка при получении пользователя:', error);
      });
    } catch (error) {
      console.error('Ошибка инициализации Supabase:', error);
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    
    // Загружаем видео
    supabase
      .from('videos')
      .select('*')
      .eq('id', id)
      .single()
      .then(async ({ data }: any) => {
        setVideo(data);
        if (data?.user_id) {
          // Загружаем username автора
          const { data: userData } = await supabase
            .from('users')
            .select('username')
            .eq('id', data.user_id)
            .single();
          setAuthorUsername(userData?.username || null);
        }
      });

    // Загружаем количество ожидающих
    loadWaitingCount();
    
    // Проверяем, ждет ли текущий пользователь
    if (currentUser) {
      checkIfWaiting();
    }
  }, [id, currentUser]);

  useEffect(() => {
    // Загружаем ленту видео (кроме текущего)
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

  // Лента "Сейчас" (каталог текущего часа, как на главной)
  const [nowFeed, setNowFeed] = useState<Video[]>([]);
  useEffect(() => {
    if (!video) return;
    const now = new Date();
    const hourStart = new Date(now);
    hourStart.setMinutes(0, 0, 0);
    const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
    supabase
      .from('videos')
      .select('id, title, cover_url, premiere_at, duration')
      .neq('id', id)
      .gte('premiere_at', hourStart.toISOString())
      .lt('premiere_at', hourEnd.toISOString())
      .order('premiere_at', { ascending: false })
      .then(({ data }: { data: any }) => {
        if (data) setNowFeed(data);
      });
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
      console.error('Ошибка при загрузке количества ожидающих:', error);
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
      console.error('Ошибка при проверке статуса ожидания:', error);
    }
  };

  const toggleWaiting = async () => {
    if (!id || !currentUser) {
      alert('Войдите в аккаунт, чтобы ждать премьеру');
      return;
    }

    if (isLoading) return; // Предотвращаем повторные нажатия

    setIsLoading(true);

    try {
      if (isWaiting) {
        // Удаляем из списка ожидающих
        const { error } = await supabase
          .from('video_expected_users')
          .delete()
          .eq('video_id', id)
          .eq('user_id', currentUser.id);
        
        if (!error) {
          setIsWaiting(false);
          setWaitingCount(prev => Math.max(0, prev - 1));
        } else {
          console.error('Ошибка при удалении из списка ожидающих:', error);
        }
      } else {
        // Добавляем в список ожидающих
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
          console.error('Ошибка при добавлении в список ожидающих:', error);
        }
      }
    } catch (error) {
      console.error('Ошибка:', error);
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
        message: emotion.gif // отправляем ссылку на гифку
      });
    } catch (e) {
      // Можно добавить обработку ошибок
    }
  };

  if (!video) return <div>Загрузка...</div>;

  const premiere = new Date(video.premiere_at);
  const canWatch = now >= premiere;
  const timeUntilPremiere = Math.floor((premiere.getTime() - now.getTime()) / 60000);

  return (
    <>
      <Header />
    <div style={{ 
      padding: canWatch ? '0' : '8px',
      maxWidth: canWatch ? '100%' : '1200px',
      margin: '0 auto',
      paddingBottom: canWatch ? '60px' : '8px',
      background: '#111114',
      minHeight: '100vh',
      color: '#f3f3f3',
        fontFamily: `'JetBrains Mono', monospace`,
        paddingTop: 40 // уменьшен отступ сверху для Header
    }}>
      {!canWatch && (
        <h1 style={{ fontSize: '24px', marginBottom: '20px', color: '#fff', fontWeight: 700 }}>{video.title}</h1>
      )}
      
        {/* Основной контент */}
        <div style={{ width: '100%' }}>
          {!canWatch && (
            <>
              <div style={{ width: '100%', aspectRatio: '40/28', overflow: 'hidden', margin: 0, padding: 0 }}>
                <img src={video.cover_url} alt={video.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', margin: 0, padding: 0, borderRadius: 8, boxShadow: 'none', background: '#18181b' }} />
              </div>
              
              <div style={{ marginBottom: '20px', marginTop: '10px' }}>
                <div style={{ fontSize: '18px', marginBottom: '2px', color: '#e0e0e0', fontWeight: 700 }}>{video.title}</div>
                <div style={{ fontSize: '15px', marginBottom: '10px', color: '#bdbdbd' }}>{authorUsername ? `@${authorUsername}` : ''}</div>
                <SubscribeAuthorButton 
                  authorId={video.user_id} 
                  currentUser={currentUser} 
                />
                <div style={{ fontSize: '16px', marginBottom: '10px', color: '#bdbdbd' }}>Премьера: {premiere.toLocaleString()}</div>
                
                <div style={{
                  background: '#23232a',
                  padding: '15px',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 2px 8px #0006',
                }}>
                  <div style={{ fontSize: '16px', color: '#fff', marginRight: 32 }}>
                    Премьера начнётся через: <strong>{timeUntilPremiere} минут</strong>
                  </div>
                  <div style={{ fontSize: '14px', color: '#bdbdbd', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2196f3" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 4}}>
                      <circle cx="8" cy="8" r="4"/>
                      <circle cx="17" cy="8.5" r="3.5"/>
                      <ellipse cx="8" cy="17" rx="7" ry="4"/>
                      <ellipse cx="17" cy="17.5" rx="5" ry="2.5"/>
                    </svg>
                    Ждут премьеру: <strong>{waitingCount}</strong>
                  </div>
                </div>
                
                <button
                  onClick={toggleWaiting}
                  disabled={isLoading}
                  style={{
                    background: isWaiting ? '#222' : 'linear-gradient(90deg, #2563eb, #1e40af)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 20px',
                    fontWeight: 600,
                    fontSize: 16,
                    cursor: isLoading ? 'default' : 'pointer',
                    opacity: isLoading ? 0.7 : 1,
                    marginRight: 12
                  }}
                >
                  {isWaiting ? 'Вы ждёте премьеру' : isLoading ? '...' : 'Жду премьеру'}
                </button>
                {currentUser && (
                  <WatchSubscribePush premiereId={video.id} userId={currentUser.id} visible={isWaiting} />
                )}
              </div>
              
              <div style={{ fontSize: '16px', lineHeight: '1.6', marginBottom: '20px', color: '#e0e0e0' }}>
                <strong>Описание:</strong><br />
                {video.description}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '10px 0 0 0' }}>
                <ShareButton />
              </div>
            </>
          )}
          
          {canWatch && (
            <>
              <VideoPlayerWithFullscreen videoUrl={video.video_url} premiereAt={video.premiere_at} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '10px 0 0 0' }}>
                <ShareButton />
              </div>
              
              {/* Сворачиваемая вкладка с информацией */}
              <div style={{
                background: '#23232a',
                borderTop: '1px solid #23232a',
                marginTop: '0',
              }}>
                {/* Заголовок вкладки */}
                <div 
                  onClick={() => setIsInfoExpanded(!isInfoExpanded)}
                  style={{
                    padding: '16px 20px',
                    background: '#18181b',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: isInfoExpanded ? '1px solid #23232a' : 'none',
                    transition: 'background 0.3s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#23232a'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#18181b'}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}>
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
                
                {/* Содержимое вкладки */}
                {isInfoExpanded && (
                  <div style={{
                    padding: '20px',
                    background: '#23232a',
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
                        Премьера: {new Date(video.premiere_at).toLocaleString('ru-RU')}
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
                      <strong>Описание:</strong><br />
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
                      🎬 Премьера активна • Смотрите и общайтесь в чате
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
                  {showChat ? 'Скрыть комментарии' : 'Показать комментарии'}
                </button>
                <button
                  style={{
                    background: '#d1d5db', color: '#18181b', border: 'none', borderRadius: 7,
                    padding: '0 0', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                    transition: 'background 0.2s, color 0.2s', boxShadow: '0 1px 8px #0002',
                    letterSpacing: 0.2, minWidth: 120, maxWidth: 180, width: '100%', justifyContent: 'center',
                    height: 40,
                    fontFamily: `'JetBrains Mono', monospace`
                  }}
                  disabled
                >
                  Подписаться на автора
                </button>
              </div>
            </>
          )}
        </div>

      {/* Живой чат снизу - только для активных премьер */}
      {canWatch && video && (
        <>
          {showChat && (
            <div style={{ margin: '18px 0 0 0' }}>
              <LiveChat videoId={video.id} currentUser={currentUser} />
            </div>
          )}
          
          {/* Вертикальная лента "Сейчас" */}
          <div style={{ margin: '32px 0 0 0', width: '100%', padding: '0 10px' }}>
            <h2 style={{ color: '#bdbdbd', fontSize: 18, fontWeight: 600, margin: '0 0 18px 0', letterSpacing: 0.2 }}>Сейчас в эфире</h2>
            {nowFeed.length === 0 && <div style={{ color: '#666', fontSize: 15, textAlign: 'center', margin: '24px 0' }}>Нет других премьер в этом часу</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {nowFeed.map(v => (
                <a key={v.id} href={`/watch/${v.id}`} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  background: '#18181b',
                  borderRadius: 8,
                  padding: '10px 14px',
                  textDecoration: 'none',
                  color: '#e0e0e0',
                  border: '1.5px solid #23232a',
                  transition: 'background 0.2s, border 0.2s',
                  boxShadow: 'none',
                  fontSize: 16,
                }}>
                  <img src={v.cover_url} alt={v.title} style={{ width: 64, height: 40, objectFit: 'cover', borderRadius: 4, background: '#23232a', border: '1px solid #23232a' }} onError={e => { (e.currentTarget as HTMLImageElement).src = '/placeholder.png'; }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 16, color: '#e0e0e0', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.title}</div>
                    <div style={{ fontSize: 13, color: '#bdbdbd' }}>Премьера: {new Date(v.premiere_at).toLocaleString()}</div>
                  </div>
                  {v.duration && <div style={{ fontSize: 13, color: '#888', marginLeft: 8 }}>{Math.floor(v.duration/60)}:{(v.duration%60).toString().padStart(2,'0')}</div>}
                </a>
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
  // Получаем видео из базы
  const { data: video } = await supabase
    .from('videos')
    .select('premiere_at')
    .eq('id', id)
    .single();
  if (!video) return {};
  const now = new Date();
  const premiere = new Date(video.premiere_at);
  // Если премьера ещё не началась, скрываем Header
  return { hideHeader: now < premiere };
};

// Кастомный плеер с кнопкой полноэкранного режима (динамическая иконка)
function VideoPlayerWithFullscreen({ videoUrl, premiereAt }: { videoUrl: string, premiereAt: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  // Вычисляем, сколько секунд прошло с начала премьеры
  const [startOffset, setStartOffset] = useState(0);
  useEffect(() => {
    if (!premiereAt) return;
    const premiereDate = new Date(premiereAt);
    const now = new Date();
    const diff = Math.floor((now.getTime() - premiereDate.getTime()) / 1000); // в секундах
    setStartOffset(diff > 0 ? diff : 0);
  }, [premiereAt]);

  // Выставляем currentTime только один раз при загрузке метаданных
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

  // Обработчик смены состояния полноэкранного режима
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
        position: isPseudoFullscreen ? 'fixed' : 'relative',
        top: isPseudoFullscreen ? 0 : undefined,
        left: isPseudoFullscreen ? 0 : undefined,
        width: isPseudoFullscreen ? '100vw' : '100%',
        height: isPseudoFullscreen ? '100vh' : '100%',
        zIndex: isPseudoFullscreen ? 9999 : undefined,
        background: '#000',
        overflow: isPseudoFullscreen ? 'hidden' : 'visible',
        aspectRatio: isPseudoFullscreen ? undefined : '4/2.8',
        display: isPseudoFullscreen ? 'flex' : undefined,
        alignItems: isPseudoFullscreen ? 'center' : undefined,
        justifyContent: isPseudoFullscreen ? 'center' : undefined,
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
        }}
        onContextMenu={e => e.preventDefault()}
      />
      {/* Кнопка включения звука (unmute) слева */}
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
        title={isMuted ? 'Включить звук' : 'Звук включён'}
        disabled={!isMuted}
      >
        {/* Иконка динамика (не тонкая) */}
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
        title={isPseudoFullscreen ? 'Выйти из полноэкранного режима' : 'На весь экран'}
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
      {/* Блокируем взаимодействие с видео на мобильных, кроме полноэкранного режима */}
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

// Кнопка поделиться премьерой
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
        alert('Ссылка скопирована!');
      } catch (e) {
        prompt('Скопируйте ссылку:', url);
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
      title="Поделиться премьерой"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}>
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
      Поделиться
    </button>
  );
}

function SubscribeAuthorButton({ authorId, currentUser }: { authorId: string, currentUser: any }) {
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (currentUser && currentUser.id === authorId) return null;

  // Проверяем подписку при загрузке компонента
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
      if (!res.ok) throw new Error('Ошибка при подписке');
      setSubscribed(true);
      if ('Notification' in window) {
        if (Notification.permission !== 'granted') {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            alert('Вы подписались на премьеры пользователя, но не разрешили пуш-уведомления. Включите их, чтобы получать оповещения!');
            setLoading(false);
            return;
          }
        }
      }
      alert('Вы подписались на премьеры пользователя. Когда они появятся, мы пришлем вам уведомление!');
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
        {subscribed ? 'Вы подписаны на автора' : loading ? 'Подписка...' : 'Подписаться на автора'}
      </button>
      {error && <div style={{ color: '#f87171', marginTop: 8, fontSize: 14 }}>{error}</div>}
    </div>
  );
}
