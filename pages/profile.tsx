import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

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

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.matchMedia('(max-width: 600px)').matches);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) {
        loadProfile(data.user.id);
        loadSubscribersCount(data.user.id);
      }
    });
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

  // Проверка возможности обновления профиля (раз в 3 недели)
  const checkProfileUpdateAvailability = () => {
    if (!profile?.updated_at) {
      setCanUpdateProfile(true);
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
  };

  const loadSubscribersCount = async (userId: string) => {
    const { count, error } = await supabase
      .from('author_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', userId);
    
    if (!error && count !== null) {
      setSubscribersCount(count);
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
        padding: 32,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        background: '#18181b',
        color: '#fff'
      }}>
        <h1 style={{ marginBottom: 32, fontSize: 28 }}>Профиль</h1>
        <p style={{ marginBottom: 32, fontSize: 16, color: '#bdbdbd' }}>Вы не авторизованы.</p>
        <div style={{ display: 'flex', gap: 16 }}>
          <button 
            onClick={() => window.location.href = '/login'}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(90deg, #2196f3, #1769aa)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 16,
              cursor: 'pointer',
              transition: 'opacity 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            Войти
          </button>
          <button 
            onClick={() => window.location.href = '/register'}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(90deg, #22c55e, #16a34a)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 16,
              cursor: 'pointer',
              transition: 'opacity 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            Зарегистрироваться
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#18181b',
      color: '#fff',
      padding: isMobile ? '16px' : '40px',
      paddingTop: isMobile ? '70px' : '100px',
    }}>
      <div style={{
        maxWidth: '600px',
        margin: '0 auto',
        background: '#23232a',
        borderRadius: isMobile ? '8px' : '12px',
        padding: isMobile ? '20px' : '40px',
        border: '1px solid #2a2a2a',
      }}>
        <h1 style={{ 
          fontSize: isMobile ? '20px' : '28px', 
          fontWeight: '700',
          marginBottom: isMobile ? '24px' : '32px',
          textAlign: 'center'
        }}>
          Профиль
        </h1>

        {/* Аватарка */}
        <div style={{ textAlign: 'center', marginBottom: isMobile ? '24px' : '32px' }}>
          <div style={{
            width: isMobile ? '70px' : '120px',
            height: isMobile ? '70px' : '120px',
            borderRadius: '50%',
            margin: '0 auto 12px',
            background: (previewUrl || profile?.avatar_url) ? 'none' : 'linear-gradient(135deg, #23232a 80%, #1769aa 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: isMobile ? '28px' : '48px',
            fontWeight: 'bold',
            color: 'white',
            overflow: 'hidden',
            border: '3px solid #2a2a2a',
          }}>
            {previewUrl ? (
              <img 
                src={previewUrl} 
                alt="Предварительный просмотр" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : profile?.avatar_url ? (
              <img 
                src={profile.avatar_url} 
                alt="Аватар" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  console.error('Ошибка загрузки аватарки:', profile.avatar_url);
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              (profile?.username || user.email || 'U').charAt(0).toUpperCase()
            )}
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: isMobile ? '10px 14px' : '8px 16px',
              background: 'linear-gradient(90deg, #2196f3, #1769aa)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: isMobile ? '13px' : '14px',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            {selectedFile ? 'Фото выбрано' : 'Выбрать фото'}
          </button>
          {selectedFile && (
            <p style={{ 
              fontSize: '11px', 
              color: '#22c55e', 
              marginTop: '6px',
              marginBottom: 0,
              wordBreak: 'break-word'
            }}>
              Выбрано: {selectedFile.name}
            </p>
          )}
        </div>

        {/* Никнейм */}
        <div style={{ marginBottom: isMobile ? '24px' : '32px' }}>
          <label style={{ 
            display: 'block', 
            color: '#fff', 
            fontSize: isMobile ? '13px' : '14px', 
            fontWeight: '500',
            marginBottom: '6px'
          }}>
            Никнейм
          </label>
          <input
            type="text"
            placeholder="Введите никнейм"
            value={username}
            onChange={(e) => handleUsernameChange(e.target.value)}
            style={{
              width: '100%',
              padding: isMobile ? '10px 12px' : '12px 16px',
              fontSize: isMobile ? '15px' : '16px',
              borderRadius: '8px',
              border: usernameError ? '1px solid #dc2626' : '1px solid #2a2a2a',
              background: '#18181b',
              color: '#fff',
              boxSizing: 'border-box',
            }}
          />
          {isCheckingUsername && (
            <p style={{ 
              fontSize: '11px', 
              color: '#2196f3', 
              marginTop: '6px',
              marginBottom: 0 
            }}>
              Проверяем доступность никнейма...
            </p>
          )}
          {usernameError && (
            <p style={{ 
              fontSize: '11px', 
              color: '#dc2626', 
              marginTop: '6px',
              marginBottom: 0 
            }}>
              {usernameError}
            </p>
          )}
        </div>

        {/* Кнопка сохранения изменений */}
        <div style={{ marginBottom: isMobile ? '24px' : '32px' }}>
          {!canUpdateProfile && (
            <div style={{ 
              padding: isMobile ? '6px 10px' : '8px 12px',
              borderRadius: '6px',
              fontSize: isMobile ? '11px' : '12px',
              textAlign: 'center',
              background: '#2a2a2a',
              color: '#bdbdbd',
              border: '1px solid #3a3a3a',
              marginBottom: '12px',
              opacity: 0.8,
              lineHeight: '1.3'
            }}>
              Профиль можно обновлять раз в 3 недели. Следующее обновление: {nextUpdateDate}
            </div>
          )}
          <button
            onClick={handleSaveChanges}
            disabled={loading || !hasChanges()}
            style={{
              width: '100%',
              padding: isMobile ? '12px 20px' : '14px 24px',
              background: !hasChanges() ? '#2a2a2a' : 'linear-gradient(90deg, #3b82f6, #1d4ed8)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              fontSize: isMobile ? '15px' : '16px',
              cursor: !hasChanges() ? 'default' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => {
              if (hasChanges() && !loading) {
                e.currentTarget.style.opacity = '0.8';
              }
            }}
            onMouseLeave={(e) => {
              if (hasChanges() && !loading) {
                e.currentTarget.style.opacity = '1';
              }
            }}
          >
            {loading ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
        </div>

        {/* Email */}
        <div style={{ marginBottom: isMobile ? '20px' : '24px' }}>
          <label style={{ 
            display: 'block', 
            color: '#fff', 
            fontSize: isMobile ? '13px' : '14px', 
            fontWeight: '500',
            marginBottom: '6px'
          }}>
            Email
          </label>
          <div style={{
            padding: isMobile ? '10px 12px' : '12px 16px',
            fontSize: isMobile ? '15px' : '16px',
            borderRadius: '8px',
            border: '1px solid #2a2a2a',
            background: '#18181b',
            color: '#bdbdbd',
            wordBreak: 'break-all'
          }}>
            {user.email}
          </div>
        </div>

        {/* Количество подписчиков */}
        <div style={{ marginBottom: isMobile ? '24px' : '32px' }}>
          <label style={{ 
            display: 'block', 
            color: '#fff', 
            fontSize: isMobile ? '13px' : '14px', 
            fontWeight: '500',
            marginBottom: '6px'
          }}>
            Подписчики
          </label>
          <div style={{
            padding: isMobile ? '10px 12px' : '12px 16px',
            fontSize: isMobile ? '15px' : '16px',
            borderRadius: '8px',
            border: '1px solid #2a2a2a',
            background: '#18181b',
            color: '#fff',
            fontWeight: '600',
          }}>
            {subscribersCount} подписчиков
          </div>
        </div>

        {/* Сообщения */}
        {message && (
          <div style={{ 
            padding: isMobile ? '10px 12px' : '12px 16px',
            borderRadius: '8px',
            fontSize: isMobile ? '13px' : '14px',
            textAlign: 'center',
            background: message.includes('Ошибка') ? '#fef2f2' : '#f0fdf4',
            color: message.includes('Ошибка') ? '#dc2626' : '#16a34a',
            border: `1px solid ${message.includes('Ошибка') ? '#fecaca' : '#bbf7d0'}`,
            marginBottom: isMobile ? '20px' : '24px',
            lineHeight: '1.4'
          }}>
            {message}
          </div>
        )}

        {/* Кнопка выхода */}
        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            padding: isMobile ? '12px 20px' : '14px 24px',
            background: 'linear-gradient(90deg, #dc2626, #b91c1c)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontWeight: '600',
            fontSize: isMobile ? '15px' : '16px',
            cursor: 'pointer',
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
        >
          Выйти из аккаунта
        </button>
      </div>
    </div>
  );
} 