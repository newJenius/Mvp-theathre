import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
type Video = {
  id: string;
  title: string;
  cover_url: string;
  premiere_at: string;
  duration?: number;
};

export default function Profile() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [subscribersCount, setSubscribersCount] = useState(0);
  const [username, setUsername] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [usernameError, setUsernameError] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [canUpdateProfile, setCanUpdateProfile] = useState(true);
  const [nextUpdateDate, setNextUpdateDate] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const usernameTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);

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
        if (data.user) {
          loadProfile(data.user.id);
          loadSubscribersCount(data.user.id);
          loadUserVideos(data.user.id);
        }
      }).catch((error: any) => {
        console.error('Ошибка при получении пользователя:', error);
      });
    } catch (error) {
      console.error('Ошибка инициализации Supabase:', error);
    }
  }, []);

  useEffect(() => {
    if (profile?.username) {
      setUsername(profile.username);
    }
  }, [profile]);

  // Отладочная информация для аватарки
  useEffect(() => {
    console.log('Отображение аватарки:', { 
      previewUrl, 
      profileAvatarUrl: profile?.avatar_url, 
      profile, 
      user 
    });
  }, [previewUrl, profile, user]);

  // Проверка возможности обновления профиля (раз в 3 недели, но первое изменение всегда разрешено)
  const checkProfileUpdateAvailability = () => {
    if (!profile?.updated_at) {
      setCanUpdateProfile(true);
      return;
    }
    // Если updated_at совпадает с created_at (или отличается < 1 мин), разрешаем первое изменение
    if (profile?.created_at && Math.abs(new Date(profile.updated_at).getTime() - new Date(profile.created_at).getTime()) < 60 * 1000) {
      setCanUpdateProfile(true);
      setNextUpdateDate('');
      return;
    }
    const lastUpdate = new Date(profile.updated_at);
    const now = new Date();
    const threeWeeksInMs = 21 * 24 * 60 * 60 * 1000; // 21 день в миллисекундах
    const timeSinceLastUpdate = now.getTime() - lastUpdate.getTime();
    
    if (timeSinceLastUpdate >= threeWeeksInMs) {
      setCanUpdateProfile(true);
      setNextUpdateDate('');
    } else {
      setCanUpdateProfile(false);
      const nextUpdate = new Date(lastUpdate.getTime() + threeWeeksInMs);
      setNextUpdateDate(nextUpdate.toLocaleDateString('ru-RU'));
    }
  };

  useEffect(() => {
    checkProfileUpdateAvailability();
  }, [profile]);

  const loadProfile = async (userId: string) => {
    try {
      console.log('Загружаем профиль для пользователя:', userId);
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      console.log('Данные профиля из базы:', data);
      console.log('Ошибка загрузки профиля:', error);
      
      if (!error && data) {
        setProfile(data);
        console.log('Профиль установлен:', data);
      } else {
        console.error('Не удалось загрузить профиль:', error);
      }
    } catch (error) {
      console.error('Ошибка при загрузке профиля:', error);
    }
  };

  const loadSubscribersCount = async (userId: string) => {
    try {
      const { count, error } = await supabase
        .from('author_subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', userId);
      
      if (!error && count !== null) {
        setSubscribersCount(count);
      }
    } catch (error) {
      console.error('Ошибка при загрузке количества подписчиков:', error);
    }
  };

  const loadUserVideos = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('id, title, cover_url, premiere_at, duration')
        .eq('user_id', userId)
        .order('premiere_at', { ascending: false });
      if (!error && data) {
        setVideos(data);
      }
    } catch (error) {
      // ignore
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setSelectedFile(null);
      setPreviewUrl('');
    }
  };

  const checkUsernameAvailability = async (username: string) => {
    if (!username || username === profile?.username) {
      setUsernameError('');
      return true;
    }

    // Проверка минимальной длины
    if (username.length < 4) {
      setUsernameError('Никнейм должен содержать минимум 4 символа');
      return false;
    }

    // Проверка, что никнейм не начинается с цифры
    if (/^\d/.test(username)) {
      setUsernameError('Никнейм не может начинаться с цифры');
      return false;
    }

    setIsCheckingUsername(true);
    setUsernameError('');

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .not('id', 'eq', user?.id);

      if (error) {
        console.error('Ошибка проверки никнейма:', error);
        return false;
      }

      if (data && data.length > 0) {
        // Никнейм найден - занят
        setUsernameError('Этот никнейм уже занят');
        return false;
      } else {
        // Никнейм не найден - доступен
        setUsernameError('');
        return true;
      }
    } catch (error) {
      console.error('Ошибка проверки никнейма:', error);
      return false;
    } finally {
      setIsCheckingUsername(false);
    }
  };

  const handleUsernameChange = (value: string) => {
    setUsername(value);
    setUsernameError('');

    // Очищаем предыдущий таймаут
    if (usernameTimeoutRef.current) {
      clearTimeout(usernameTimeoutRef.current);
    }

    // Проверяем никнейм с задержкой (debounce)
    if (value && value !== profile?.username) {
      usernameTimeoutRef.current = setTimeout(() => {
        checkUsernameAvailability(value);
      }, 500);
    }
  };

  const handleSaveChanges = async () => {
    if (!user || usernameError) return;

    // Проверяем ограничение на обновление профиля
    if (!canUpdateProfile) {
      setMessage(`Профиль можно обновлять раз в 3 недели. Следующее обновление: ${nextUpdateDate}`);
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      // Финальная проверка никнейма перед сохранением
      const isAvailable = await checkUsernameAvailability(username);
      if (!isAvailable) {
        setMessage('Никнейм уже занят. Выберите другой.');
        setLoading(false);
        return;
      }

      let avatarUrl = profile?.avatar_url;

      // Загружаем аватарку, если выбрана
      if (selectedFile) {
        // Очищаем имя файла от специальных символов и кириллицы
        const fileExtension = selectedFile.name.split('.').pop() || 'jpg';
        const sanitizedFileName = `avatar_${Date.now()}.${fileExtension}`;
        const fileName = `avatars/${user.id}/${sanitizedFileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, selectedFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);

        avatarUrl = publicUrl;
      }

      // Подготавливаем данные для сохранения
      const updateData: any = {
        id: user.id,
        username: username,
        updated_at: new Date().toISOString()
      };

      // Добавляем avatar_url только если он есть
      if (avatarUrl) {
        updateData.avatar_url = avatarUrl;
      }

      console.log('Данные для сохранения:', updateData);

      // Обновляем профиль в базе
      const { error: updateError } = await supabase
        .from('users')
        .upsert(updateData);

      if (updateError) {
        console.error('Ошибка обновления:', updateError);
        throw updateError;
      }

      setProfile((prev: any) => ({ 
        ...prev, 
        username: username,
        avatar_url: avatarUrl,
        updated_at: updateData.updated_at
      }));
      
      setSelectedFile(null);
      setPreviewUrl('');
      setMessage('Изменения сохранены!');
      
      // Обновляем состояние возможности обновления
      setTimeout(() => {
        checkProfileUpdateAvailability();
      }, 1000);
    } catch (error: any) {
      console.error('Ошибка сохранения:', error);
      setMessage('Ошибка сохранения: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = () => {
    const hasValidUsername = (username.length >= 4 && !/^\d/.test(username)) || username === profile?.username;
    const hasChangesToSave = selectedFile || (username !== profile?.username && hasValidUsername);
    return hasChangesToSave && !usernameError && canUpdateProfile;
  };

  if (!user) {
    return (
      <div style={{ 
        minHeight: '100vh',
        background: '#111114',
        color: '#d1d5db',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0
      }}>
        <h1 style={{ marginBottom: 18, fontSize: 22, fontWeight: 600, letterSpacing: 0.2 }}>Профиль</h1>
        <p style={{ fontSize: 15, color: '#6b7280', textAlign: 'center', margin: 0, marginBottom: 22 }}>Вы не авторизованы</p>
        <button 
          onClick={() => window.location.href = '/login'}
          style={{
            padding: '10px 32px',
            background: '#18181b',
            color: '#d1d5db',
            border: '1.5px solid #23232a',
            borderRadius: 0,
            fontWeight: 500,
            fontSize: 15,
            cursor: 'pointer',
            transition: 'background 0.2s, color 0.2s, border 0.2s',
            boxShadow: 'none',
            outline: 'none',
            letterSpacing: 0.2,
            fontFamily: `'JetBrains Mono', monospace`
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#23232a';
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.border = '1.5px solid #393a3f';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = '#18181b';
            e.currentTarget.style.color = '#d1d5db';
            e.currentTarget.style.border = '1.5px solid #23232a';
          }}
        >
          Войти
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#111114', color: '#e0e0e0', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 12px' }}>
      <div style={{ width: '100%', maxWidth: 400, margin: '0 auto', marginTop: 48, background: 'none', borderRadius: 0, boxShadow: 'none', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        {/* Аватар */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 96, height: 96, borderRadius: '50%', overflow: 'hidden', border: '2px solid #23232a', background: '#18181b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {previewUrl || profile?.avatar_url ? (
              <img src={previewUrl || profile?.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ color: '#888a92', fontSize: 38 }}>?</div>
            )}
          </div>
          <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} />
          <button onClick={() => fileInputRef.current?.click()} style={{ background: 'none', color: '#bdbdbd', border: 'none', fontSize: 15, cursor: 'pointer', marginTop: 2, padding: 0, textDecoration: 'underline', letterSpacing: 0.2 }}>Изменить аватар</button>
        </div>
        {/* Никнейм и подписчики */}
        <div style={{ width: '100%', textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: '#e0e0e0', marginBottom: 2 }}>{username || '...'}</div>
          <div style={{ fontSize: 15, color: '#bdbdbd', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888a92" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="4"/><circle cx="17" cy="8.5" r="3.5"/><ellipse cx="8" cy="17" rx="7" ry="4"/><ellipse cx="17" cy="17.5" rx="5" ry="2.5"/></svg>
            {subscribersCount} подписчиков
          </div>
        </div>
        {/* Форма редактирования */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <input
            type="text"
            value={username}
            onChange={e => handleUsernameChange(e.target.value)}
            maxLength={24}
            placeholder="Никнейм"
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
              textAlign: 'center',
            }}
            disabled={!canUpdateProfile}
          />
          {usernameError && <div style={{ color: '#ff5252', fontSize: 14, textAlign: 'center' }}>{usernameError}</div>}
          <button
            onClick={handleSaveChanges}
            disabled={loading || !!usernameError || !canUpdateProfile}
            style={{
              background: loading ? '#23232a' : '#18181b',
              color: loading ? '#888' : '#e0e0e0',
              border: 'none',
              borderRadius: 6,
              fontSize: 17,
              fontWeight: 600,
              padding: '12px 0',
              marginTop: 0,
              cursor: loading || !!usernameError || !canUpdateProfile ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s, color 0.2s',
              boxShadow: 'none',
              letterSpacing: '0.5px',
              width: '100%',
            }}
          >
            {loading ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
          {message && <div style={{ color: '#ff5252', fontSize: 14, textAlign: 'center' }}>{message}</div>}
          {!canUpdateProfile && (
            <div style={{ color: '#bdbdbd', fontSize: 13, textAlign: 'center', marginTop: 2 }}>
              Профиль можно обновлять раз в 3 недели.<br />Следующее обновление: {nextUpdateDate}
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          style={{
            background: 'rgba(36,40,48,0.85)',
            color: '#ff5252',
            border: '1.5px solid #23232a',
            borderRadius: 8,
            fontSize: 15,
            cursor: 'pointer',
            marginTop: 18,
            padding: '12px 0',
            width: '100%',
            fontWeight: 500,
            letterSpacing: 0.2,
            transition: 'background 0.2s, color 0.2s, border 0.2s',
            boxShadow: 'none',
          }}
          onMouseOver={e => {
            e.currentTarget.style.background = '#23232a';
            e.currentTarget.style.color = '#ff7676';
            e.currentTarget.style.border = '1.5px solid #393a3f';
          }}
          onMouseOut={e => {
            e.currentTarget.style.background = 'rgba(36,40,48,0.85)';
            e.currentTarget.style.color = '#ff5252';
            e.currentTarget.style.border = '1.5px solid #23232a';
          }}
        >
          Выйти из аккаунта
        </button>
      </div>
      {/* Список видео пользователя */}
      <div style={{ width: '100%', maxWidth: 600, margin: '36px auto 60px auto', background: 'none', borderRadius: 0, boxShadow: 'none', padding: 0 }}>
        <h2 style={{ color: '#bdbdbd', fontSize: 18, fontWeight: 600, margin: '0 0 18px 0', letterSpacing: 0.2 }}>Ваши премьеры</h2>
        {videos.length === 0 && <div style={{ color: '#666', fontSize: 15, textAlign: 'center', margin: '24px 0' }}>Вы ещё не загружали видео</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {videos.map(video => (
            <a key={video.id} href={`/watch/${video.id}`} style={{
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
              <img src={video.cover_url} alt={video.title} style={{ width: 64, height: 40, objectFit: 'cover', borderRadius: 4, background: '#23232a', border: '1px solid #23232a' }} onError={e => { (e.currentTarget as HTMLImageElement).src = '/placeholder.png'; }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 16, color: '#e0e0e0', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{video.title}</div>
                <div style={{ fontSize: 13, color: '#bdbdbd' }}>Премьера: {new Date(video.premiere_at).toLocaleString()}</div>
              </div>
              {video.duration && <div style={{ fontSize: 13, color: '#888', marginLeft: 8 }}>{Math.floor(video.duration/60)}:{(video.duration%60).toString().padStart(2,'0')}</div>}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
} 

export async function getServerSideProps() {
  return { props: { hideHeader: true } };
} 