import { useRouter } from 'next/router';
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import LiveChat from '../../components/LiveChat';
import EmotionCarousel from '../../components/EmotionCarousel';
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
        fontFamily: `'JetBrains Mono', monospace`
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
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: '#23232a', color: '#e5e7eb', border: 'none', borderRadius: 7,
                    padding: '0 0', fontWeight: 700, fontSize: 16, cursor: 'pointer',
                    transition: 'background 0.2s, color 0.2s', boxShadow: '0 1px 8px #0002',
                    letterSpacing: 0.2, minWidth: 140, maxWidth: 180, width: '100%', justifyContent: 'center',
                    height: 48,
                    fontFamily: `'JetBrains Mono', monospace`
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-1.9 5.4A8.5 8.5 0 0 1 12 21.5a8.38 8.38 0 0 1-5.4-1.9L3 21l1.4-3.6A8.38 8.38 0 0 1 2.5 12a8.5 8.5 0 1 1 17 0z"/></svg>
                  Чат
                </button>
                <button
                  style={{
                    background: '#d1d5db', color: '#18181b', border: 'none', borderRadius: 7,
                    padding: '0 0', fontWeight: 700, fontSize: 16, cursor: 'pointer',
                    transition: 'background 0.2s, color 0.2s', boxShadow: '0 1px 8px #0002',
                    letterSpacing: 0.2, minWidth: 120, maxWidth: 180, width: '100%', justifyContent: 'center',
                    height: 48,
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
          
          {/* Карусель эмоций */}
          <EmotionCarousel onEmotionClick={sendEmotionToChat} />
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

  const handleFullscreen = () => {
    if (!isFullscreen) {
      if (containerRef.current) {
        if (containerRef.current.requestFullscreen) {
          containerRef.current.requestFullscreen();
        } else if ((containerRef.current as any).webkitRequestFullscreen) {
          (containerRef.current as any).webkitRequestFullscreen();
        } else if ((containerRef.current as any).msRequestFullscreen) {
          (containerRef.current as any).msRequestFullscreen();
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


  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16/11',
        overflow: 'hidden',
        background: isFullscreen ? '#000' : '#111',
        transition: 'background 0.2s',
      }}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        autoPlay
        playsInline
        muted
        controls={false}
        disablePictureInPicture
        controlsList="nodownload nofullscreen noremoteplayback noplaybackrate nofullscreen"
        style={{ width: '100%', height: '100%', objectFit: isFullscreen ? 'contain' : 'cover' }}
        onContextMenu={e => e.preventDefault()}
      />
      {/* Блокируем взаимодействие с видео на мобильных, кроме полноэкранного режима */}
      {isMobileDevice() && !isFullscreen && (
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
      <button
        onClick={handleFullscreen}
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
        title={isFullscreen ? 'Выйти из полноэкранного режима' : 'Полноэкранный режим'}
      >
        {isFullscreen ? (
          // Иконка выхода из fullscreen — крестик (X), очень тонкая
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="5" x2="19" y2="19" />
            <line x1="19" y1="5" x2="5" y2="19" />
          </svg>
        ) : (
          // Минималистичная иконка входа в fullscreen (только углы, Pinterest style)
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 7 3 3 7 3" />
            <polyline points="17 3 21 3 21 7" />
            <polyline points="21 17 21 21 17 21" />
            <polyline points="7 21 3 21 3 17" />
          </svg>
        )}
      </button>
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
          fontSize: 16,
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
