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
  if (diff <= 0) return '0м';
  const hours = Math.floor(diff / 1000 / 60 / 60);
  const minutes = Math.floor((diff / 1000 / 60) % 60);
  return `${hours > 0 ? hours + 'ч ' : ''}${minutes}м`;
}

export default function Home() {
  const [videos, setVideos] = useState<any[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  // Загружаем аватарки авторов
  const loadAvatars = async (videosData: Video[]) => {
    const userIds = Array.from(new Set(videosData.map(v => v.user_id)));
    console.log('Загружаем аватарки для пользователей:', userIds);
    
    if (userIds.length === 0) return videosData;
    
    const { data: usersData, error } = await supabase
      .from('users')
      .select('id, avatar_url');
    
    console.log('Данные пользователей из базы:', usersData);
    console.log('Ошибка загрузки пользователей:', error);
    
    if (error || !usersData) return videosData;
    
    const userMap = Object.fromEntries(usersData.map((u: any) => [u.id, u.avatar_url]));
    console.log('userMap:', userMap);
    console.log('videosData before avatar merge:', videosData);
    
    const result = videosData.map(v => ({ ...v, avatar_url: userMap[v.user_id] || undefined }));
    console.log('videosData after avatar merge:', result);
    
    return result;
  };

  // Функция для загрузки количества ожидающих для видео
  const loadWaitingCounts = async (videoIds: string[], videosData: Video[]) => {
    if (videoIds.length === 0) return;
    
    try {
      const { data, error } = await supabase
        .from('video_expected_users')
        .select('video_id')
        .in('video_id', videoIds);
      
      if (error) {
        console.error('Ошибка загрузки ожидающих:', error);
        return;
      }
      
      if (data) {
        // Группируем по video_id и считаем количество
        const counts: { [key: string]: number } = {};
        data.forEach((item: any) => {
          counts[item.video_id] = (counts[item.video_id] || 0) + 1;
        });
        
        // Обновляем видео с количеством ожидающих
        let updatedVideos = videosData.map(video => ({
            ...video,
          waitingCount: counts[video.id] !== undefined ? counts[video.id] : 0
        }));
        // Загружаем аватарки
        const videosWithAvatars = await loadAvatars(updatedVideos);
        setVideos(videosWithAvatars);
      }
    } catch (error) {
      console.error('Ошибка в loadWaitingCounts:', error);
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function fetchVideos() {
      const { data, error } = await supabase
        .from('videos')
        .select('id, title, cover_url, premiere_at, user_id');
      if (!error && isMounted) {
        const videosData = data || [];
        // Загружаем количество ожидающих и аватарки
        const videoIds = videosData.map(v => v.id);
        await loadWaitingCounts(videoIds, videosData);
      }
    }
    fetchVideos();
    // Mobile detection
    const checkMobile = () => setIsMobile(window.matchMedia('(max-width: 600px)').matches);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => { isMounted = false; window.removeEventListener('resize', checkMobile); };
  }, []);

  // Получаем текущий час и дату пользователя
  const now = new Date();
  const nowHour = now.getHours();

  // Фильтруем только сегодняшние видео
  const todayVideos = videos.filter(v => isToday(v.premiere_at)).sort((a, b) => new Date(a.premiere_at).getTime() - new Date(b.premiere_at).getTime());

  // Группируем сегодняшние видео по часу премьеры
  const videosByHour: { [hour: number]: Video[] } = {};
  todayVideos.forEach(video => {
    const hour = getHour(video.premiere_at);
    if (!videosByHour[hour]) videosByHour[hour] = [];
    videosByHour[hour].push(video);
  });

  // Для раздела 'Сейчас': только видео, у которых премьера уже наступила и час совпадает
  const nowVideos = todayVideos.filter(v => {
    const d = new Date(v.premiere_at);
    return d.getHours() === nowHour && d <= now;
  });

  // Остальные часы (без текущего)
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const afterNow = hours.filter(h => h > nowHour);
  const beforeNow = hours.filter(h => h < nowHour);
  const orderedHours = [nowHour, ...afterNow, ...beforeNow];

  // Функция для красивого заголовка
  function hourLabel(hour: number) {
    return `${hour.toString().padStart(2, '0')}:00`;
  }

  return (
    <div style={{ padding: '64px 12px 60px 12px', background: '#18181b', minHeight: '100vh', color: '#f3f3f3', boxSizing: 'border-box' }}>
      {/* Предупреждение о том, что видео исчезают после премьеры */}
      <div style={{
        background: '#23232a',
        color: '#bdbdbd',
        padding: '12px 16px',
        margin: '0 0 16px 0',
        borderRadius: '8px',
        border: '1px solid #23232a',
        textAlign: 'center',
        fontSize: '14px',
        lineHeight: '1.4',
      }}>
        Видео удаляются сразу после окончания премьеры
      </div>
      
      {/* Раздел 'Сейчас' */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '18px 0 10px 8px', color: '#f3f3f3' }}>{hourLabel(nowHour)} (Сейчас)</h2>
        <div style={{
          display: 'block',
        }}>
          {nowVideos.length === 0 && <div style={{ color: '#bdbdbd', fontSize: 16 }}>Нет видео</div>}
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
                height: '80%',
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
                  onError={e => { e.currentTarget.src = '/placeholder.jpg'; }}
                />
                {/* Статус для углов */}
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
                  // Левый верхний угол
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
                {/* Правый нижний угол: статус */}
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
                      // В эфире (до 2 часов после премьеры)
                      return 'В эфире';
                    } else if (premiere > now && premiere.getTime() - now.getTime() < 30 * 60 * 1000) {
                      // Скоро (меньше 30 минут до премьеры)
                      return 'Скоро';
                    } else if (premiere > now) {
                      // Ожидается
                      return 'Ожидается';
                    } else {
                      // Завершено
                      return 'Завершено';
                    }
                  })()}
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
                  Автор: {video.user_id}
                </div>
                <div style={{ fontSize: 10, color: '#bdbdbd', marginTop: 0 }}>Премьера: {new Date(video.premiere_at).toLocaleString()}</div>
                {new Date(video.premiere_at) > new Date() && (
                  <div style={{ fontSize: 10, color: '#e57373', marginTop: 0 }}>
                    До премьеры: {getTimeLeft(video.premiere_at)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
      {/* Остальные разделы по часам — всегда показывать */}
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
            {(!videosByHour[hour] || videosByHour[hour].length === 0) && <div style={{ color: '#bdbdbd', fontSize: 16 }}>Нет видео</div>}
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
                    onError={e => { e.currentTarget.src = '/placeholder.jpg'; }}
                  />
                  {/* Статус для углов */}
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
                    // Левый верхний угол
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
                  {/* Правый нижний угол: статус */}
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
                        // В эфире (до 2 часов после премьеры)
                        return 'В эфире';
                      } else if (premiere > now && premiere.getTime() - now.getTime() < 30 * 60 * 1000) {
                        // Скоро (меньше 30 минут до премьеры)
                        return 'Скоро';
                      } else if (premiere > now) {
                        // Ожидается
                        return 'Ожидается';
                      } else {
                        // Завершено
                        return 'Завершено';
                      }
                    })()}
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
                  <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>Премьера: {new Date(video.premiere_at).toLocaleString()}</div>
                  {new Date(video.premiere_at) > new Date() && (
                    <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
                      До премьеры: {getTimeLeft(video.premiere_at)}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, color: '#666', marginTop: 2, gap: 6 }}>
                    <img src={video.avatar_url || '/avatar-placeholder.png'} alt="avatar" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover', background: '#23232a', border: '1px solid #23232a', marginRight: 4 }} />
                    Автор: {video.user_id}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
