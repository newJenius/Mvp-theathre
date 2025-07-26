import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
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
  const [inviteCodes, setInviteCodes] = useState<string[]>([]);
  const [inviteError, setInviteError] = useState<string>('');

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
        console.error('Error getting user:', error);
      });
    } catch (error) {
      console.error('Supabase initialization error:', error);
    }
  }, []);

  useEffect(() => {
    if (profile?.username) {
      setUsername(profile.username);
    }
  }, [profile]);

  // Debug information for avatar
  useEffect(() => {
    console.log('Displaying avatar:', { 
      previewUrl, 
      profileAvatarUrl: profile?.avatar_url, 
      profile, 
      user 
    });
  }, [previewUrl, profile, user]);

  // Check profile update possibility (every 3 weeks, but first change is always allowed)
  const checkProfileUpdateAvailability = () => {
    if (!profile?.updated_at) {
      setCanUpdateProfile(true);
      return;
    }
    // If updated_at matches created_at (or differs < 1 min), allow first change
    if (profile?.created_at && Math.abs(new Date(profile.updated_at).getTime() - new Date(profile.created_at).getTime()) < 60 * 1000) {
      setCanUpdateProfile(true);
      setNextUpdateDate('');
      return;
    }
    const lastUpdate = new Date(profile.updated_at);
    const now = new Date();
    const threeWeeksInMs = 21 * 24 * 60 * 60 * 1000; // 21 days in milliseconds
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
      console.log('Loading profile for user:', userId);
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      console.log('Profile data from database:', data);
      console.log('Profile loading error:', error);
      
      if (!error && data) {
        setProfile(data);
        console.log('Profile set:', data);
      } else {
        console.error('Failed to load profile:', error);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
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
      console.error('Error loading subscribers count:', error);
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

    // Check minimum length
    if (username.length < 4) {
      setUsernameError('Username must contain at least 4 characters');
      return false;
    }

    // Check that username doesn't start with a number
    if (/^\d/.test(username)) {
      setUsernameError('Username cannot start with a number');
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
        setUsernameError('This username is already taken');
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
      setMessage(`Profile can be updated every 3 weeks. Next update: ${nextUpdateDate}`);
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      // Финальная проверка никнейма перед сохранением
      const isAvailable = await checkUsernameAvailability(username);
      if (!isAvailable) {
        setMessage('Username is already taken. Please choose another.');
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

      console.log('Data to save:', updateData);

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
      setMessage('Changes saved!');
      
      // Обновляем состояние возможности обновления
      setTimeout(() => {
        checkProfileUpdateAvailability();
      }, 1000);
    } catch (error: any) {
      console.error('Ошибка сохранения:', error);
      setMessage('Error saving: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = () => {
    const hasValidUsername = (username.length >= 4 && !/^\d/.test(username)) || username === profile?.username;
    const hasChangesToSave = selectedFile || (username !== profile?.username && hasValidUsername);
    return hasChangesToSave && !usernameError && canUpdateProfile;
  };

  // Генерация случайного кода (6-8 символов)
  function generateCode() {
    return uuidv4().replace(/-/g, '').slice(0, 8).toUpperCase();
  }

  // Загрузка или генерация инвайт-кодов
  const handleShowInviteCodes = async () => {
    setInviteError('');
    if (!user?.id) {
      setInviteError('Пользователь не найден');
      return;
    }
    setLoading(true);
    try {
      // Получаем неиспользованные коды пользователя
      const { data: existing, error } = await supabase
        .from('invites')
        .select('code')
        .eq('invited_by', user.id)
        .eq('used', false);
      if (error) throw error;
      let codes = existing?.map((row: any) => row.code) || [];
      // Если меньше 3, генерируем недостающие
      if (codes.length < 3) {
        const toCreate = 3 - codes.length;
        const newCodes = Array.from({ length: toCreate }, () => generateCode());
        // Сохраняем новые коды в базу
        for (const code of newCodes) {
          const { error: insertError } = await supabase
            .from('invites')
            .insert([{ code, used: false, invited_by: user.id }]);
          if (insertError) throw insertError;
        }
        codes = [...codes, ...newCodes];
      }
      setInviteCodes(codes.slice(0, 3));
    } catch (e: any) {
      setInviteError('Ошибка при генерации инвайт-кодов');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div style={{ 
        minHeight: '100vh',
        background: '#0a0a0c',
        color: '#d1d5db',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0
      }}>
        <h1 style={{ marginBottom: 18, fontSize: 22, fontWeight: 600, letterSpacing: 0.2 }}>Profile</h1>
        <p style={{ fontSize: 15, color: '#6b7280', textAlign: 'center', margin: 0, marginBottom: 22 }}>You are not authorized</p>
        <button 
          onClick={() => window.location.href = '/login'}
          style={{
            padding: '12px 32px',
            background: '#39FF14',
            color: '#18181b',
            border: 'none',
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 15,
            cursor: 'pointer',
            transition: 'background 0.2s, color 0.2s',
            boxShadow: 'none',
            outline: 'none',
            letterSpacing: 0.2,
            fontFamily: `'JetBrains Mono', monospace`,
            margin: '0 10px',
            width: '280px',
            maxWidth: 'none'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#32d912';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = '#39FF14';
          }}
        >
          Login
        </button>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#0a0a0c', 
      color: '#e0e0e0', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      padding: isMobile ? '0 12px' : '0 12px',
      paddingTop: isMobile ? '56px' : '48px'
    }}>
      <div style={{ 
        width: '100%', 
        maxWidth: 400, 
        margin: '0 auto', 
        marginTop: isMobile ? '20px' : '48px', 
        background: 'none', 
        borderRadius: 0, 
        boxShadow: 'none', 
        padding: 0, 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        gap: isMobile ? '20px' : '28px' 
      }}>
        {/* Аватар */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isMobile ? '8px' : '12px' }}>
          <div style={{ 
            width: isMobile ? 80 : 96, 
            height: isMobile ? 80 : 96, 
            borderRadius: '50%', 
            overflow: 'hidden', 
            border: '2px solid #23232a', 
            background: '#18181b', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}>
            {previewUrl || profile?.avatar_url ? (
              <img src={previewUrl || profile?.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ color: '#888a92', fontSize: isMobile ? 32 : 38 }}>?</div>
            )}
          </div>
          <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} />
          <button onClick={() => fileInputRef.current?.click()} style={{ 
            background: 'none', 
            color: '#bdbdbd', 
            border: 'none', 
            fontSize: isMobile ? 14 : 15, 
            cursor: 'pointer', 
            marginTop: 2, 
            padding: 0, 
            textDecoration: 'underline', 
            letterSpacing: 0.2 
          }}>Change avatar</button>
        </div>
        {/* Никнейм и подписчики */}
        <div style={{ width: '100%', textAlign: 'center', marginBottom: isMobile ? 6 : 8 }}>
          <div style={{ fontSize: isMobile ? 20 : 22, fontWeight: 600, color: '#e0e0e0', marginBottom: 2 }}>{username || '...'}</div>
          <div style={{ fontSize: isMobile ? 14 : 15, color: '#bdbdbd', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <svg width={isMobile ? 16 : 18} height={isMobile ? 16 : 18} viewBox="0 0 24 24" fill="none" stroke="#888a92" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="4"/><circle cx="17" cy="8.5" r="3.5"/><ellipse cx="8" cy="17" rx="7" ry="4"/><ellipse cx="17" cy="17.5" rx="5" ry="2.5"/></svg>
            {subscribersCount} subscribers
          </div>
        </div>
        {/* Форма редактирования */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '18px' }}>
          <input
            type="text"
            value={username}
            onChange={e => handleUsernameChange(e.target.value)}
            maxLength={24}
            placeholder="Username"
            style={{
              background: '#18181b',
              border: 'none',
              borderBottom: '1.5px solid #23232a',
              color: '#e0e0e0',
              fontSize: isMobile ? 16 : 18,
              padding: isMobile ? '10px 8px' : '12px 8px',
              outline: 'none',
              borderRadius: 0,
              marginBottom: 0,
              transition: 'border 0.2s',
              textAlign: 'center',
            }}
            disabled={!canUpdateProfile}
          />
          {usernameError && <div style={{ color: '#ff5252', fontSize: isMobile ? 13 : 14, textAlign: 'center' }}>{usernameError}</div>}
          <button
            onClick={handleSaveChanges}
            disabled={loading || !!usernameError || !canUpdateProfile}
            style={{
              background: loading || !!usernameError || !canUpdateProfile ? '#23232a' : '#39FF14',
              color: loading || !!usernameError || !canUpdateProfile ? '#888' : '#18181b',
              border: 'none',
              borderRadius: 6,
              fontSize: isMobile ? 15 : 17,
              fontWeight: 600,
              padding: isMobile ? '10px 0' : '12px 0',
              marginTop: 0,
              cursor: loading || !!usernameError || !canUpdateProfile ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s, color 0.2s',
              boxShadow: 'none',
              letterSpacing: '0.5px',
              width: '100%',
            }}
          >
            {loading ? 'Saving...' : 'Save changes'}
          </button>
          {message && <div style={{ color: '#ff5252', fontSize: isMobile ? 13 : 14, textAlign: 'center' }}>{message}</div>}
          {!canUpdateProfile && (
            <div style={{ color: '#bdbdbd', fontSize: isMobile ? 12 : 13, textAlign: 'center', marginTop: 2 }}>
              Profile can be updated every 3 weeks.<br />Next update: {nextUpdateDate}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '10px' : '12px', width: '100%' }}>
          <button
            onClick={handleLogout}
            style={{
              background: 'rgba(36,40,48,0.85)',
              color: '#ff5252',
              border: '1.5px solid #23232a',
              borderRadius: 8,
              fontSize: isMobile ? 14 : 15,
              cursor: 'pointer',
              marginTop: isMobile ? '14px' : '18px',
              padding: isMobile ? '10px 0' : '12px 0',
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
            Log out of account
          </button>
          <button
            style={{
              background: '#23232a',
              color: '#e0e0e0',
              border: '1.5px solid #23232a',
              borderRadius: 8,
              fontSize: isMobile ? 15 : 16,
              cursor: 'pointer',
              marginTop: 0,
              padding: isMobile ? '10px 0' : '12px 0',
              width: '100%',
              fontWeight: 500,
              letterSpacing: 0.2,
              transition: 'background 0.2s, color 0.2s, border 0.2s',
              boxShadow: 'none',
            }}
            onClick={handleShowInviteCodes}
          >
            My Invite Codes
          </button>
        </div>
      </div>
      {/* Invite codes display block */}
      <div style={{ 
        width: '100%', 
        maxWidth: isMobile ? '100%' : 600, 
        margin: isMobile ? '20px 0 0 0' : '24px auto 0 auto', 
        background: 'none', 
        borderRadius: 0, 
        boxShadow: 'none', 
        padding: isMobile ? '0 12px' : 0, 
        textAlign: 'center' 
      }}>
        {inviteCodes.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={{ color: '#bdbdbd', fontSize: 16, marginBottom: 8 }}>Your invite codes:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {inviteCodes.map((code, idx) => (
                <div key={idx} style={{ background: '#18181b', color: '#e0e0e0', borderRadius: 6, padding: '8px 0', fontSize: 18, letterSpacing: 2, fontWeight: 600 }}>{code}</div>
              ))}
            </div>
            <div style={{ color: '#888', fontSize: 13, marginTop: 8 }}>Share these codes with friends so they can register.</div>
          </div>
        )}
        {inviteError && <div style={{ color: '#ff5252', fontSize: 14, marginTop: 8 }}>{inviteError}</div>}
      </div>
      {/* User's videos list */}
      <div style={{ 
        width: '100%', 
        maxWidth: isMobile ? '100%' : 600, 
        margin: isMobile ? '28px 0 60px 0' : '36px auto 60px auto', 
        background: 'none', 
        borderRadius: 0, 
        boxShadow: 'none', 
        padding: isMobile ? '0 12px' : 0 
      }}>
        <h2 style={{ color: '#bdbdbd', fontSize: isMobile ? 16 : 18, fontWeight: 600, margin: '0 0 18px 0', letterSpacing: 0.2 }}>Your premieres</h2>
        {videos.length === 0 && <div style={{ color: '#666', fontSize: isMobile ? 14 : 15, textAlign: 'center', margin: '24px 0' }}>You haven't uploaded any videos yet</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '18px' }}>
          {videos.map(video => (
            <a key={video.id} href={`/watch/${video.id}`} style={{
              display: 'flex',
              alignItems: 'center',
              gap: isMobile ? 12 : 16,
              background: '#18181b',
              borderRadius: 8,
              padding: isMobile ? '8px 12px' : '10px 14px',
              textDecoration: 'none',
              color: '#e0e0e0',
              border: '1.5px solid #23232a',
              transition: 'background 0.2s, border 0.2s',
              boxShadow: 'none',
              fontSize: isMobile ? 14 : 16,
              width: '100%',
              boxSizing: 'border-box',
              minWidth: 0,
            }}>
              <img src={video.cover_url} alt={video.title} style={{ 
                width: isMobile ? 56 : 64, 
                height: isMobile ? 35 : 40, 
                objectFit: 'cover', 
                borderRadius: 4, 
                background: '#23232a', 
                border: '1px solid #23232a',
                flexShrink: 0
              }} onError={e => { (e.currentTarget as HTMLImageElement).src = '/placeholder.png'; }} />
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <div style={{ 
                  fontWeight: 600, 
                  fontSize: isMobile ? 14 : 16, 
                  color: '#e0e0e0', 
                  marginBottom: 2, 
                  whiteSpace: 'nowrap', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis' 
                }}>{video.title}</div>
                <div style={{ 
                  fontSize: isMobile ? 12 : 13, 
                  color: '#bdbdbd',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>Premiere: {new Date(video.premiere_at).toLocaleString()}</div>
              </div>
              {video.duration && <div style={{ 
                fontSize: isMobile ? 12 : 13, 
                color: '#888', 
                marginLeft: 8,
                flexShrink: 0
              }}>{Math.floor(video.duration/60)}:{(video.duration%60).toString().padStart(2,'0')}</div>}
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