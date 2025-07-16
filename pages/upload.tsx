import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

async function getPresignedUrl(file: File, filePrefix: string, bucket: string) {
  const fileName = `${filePrefix}/${Date.now()}_${file.name}`;
  const res = await fetch('/api/storj-presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName,
      fileType: file.type,
      bucket,
    }),
  });
  const data = await res.json();
  return { url: data.url, fileName };
}

async function uploadToStorj(file: File, url: string) {
  await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
}

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
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

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
        console.error('Ошибка при получении пользователя:', error);
        setCheckedAuth(true);
      });
    } catch (error) {
      console.error('Ошибка инициализации Supabase:', error);
      setCheckedAuth(true);
    }
  }, []);

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
        Загрузка...
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{
        minHeight: '100vh',
        width: '100vw',
        background: '#111114',
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
          <h1 style={{ color: '#e0e0e0', fontSize: isMobile ? 20 : 22, fontWeight: 600, marginBottom: 10, letterSpacing: 0.2 }}>Требуется вход</h1>
          <p style={{ color: '#6b7280', fontSize: isMobile ? 13 : 14, margin: 0, marginBottom: 0 }}>Войдите или зарегистрируйтесь, чтобы загружать премьеры</p>
        </div>
      </div>
    );
  }

  // Функция для проверки статуса обработки
  const checkStatus = async (jobId: string) => {
    try {
      const response = await fetch(`${apiUrl}/status/${jobId}`);
      const data = await response.json();
      
      if (response.ok) {
        setProcessingStatus(data.state);
        
        if (data.state === 'completed') {
          setMessage(`Видео успешно обработано! Ссылка: ${data.result.video_url}`);
          setJobId(null);
          setProcessingStatus('');
          setQueuePosition(null);
          setEstimatedTime(null);
        } else if (data.state === 'failed') {
          setMessage(`Ошибка обработки: ${data.failedReason}`);
          setJobId(null);
          setProcessingStatus('');
        }
      }
    } catch (error) {
      console.error('Ошибка проверки статуса:', error);
    }
  };

  // Проверяем статус каждые 10 секунд, если есть jobId
  useEffect(() => {
    if (!jobId) return;
    
    const interval = setInterval(() => {
      checkStatus(jobId);
    }, 10000);
    
    return () => clearInterval(interval);
  }, [jobId]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);
    setJobId(null);
    setProcessingStatus('');
    setQueuePosition(null);
    setEstimatedTime(null);

    if (!video) {
      setMessage('Не выбрано видео для загрузки.');
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('video', video);
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
        setMessage(`Видео добавлено в очередь! Позиция: ${data.queuePosition}, Примерное время: ${data.estimatedTime} минут`);
      } else {
        setMessage('Ошибка: ' + (data.error || 'Неизвестная ошибка'));
      }
    } catch (err: any) {
      setMessage('Ошибка загрузки: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Добавляем отображение статуса обработки
  const renderProcessingStatus = () => {
    if (!jobId) return null;
    
    const statusText = {
      'waiting': 'Ожидает обработки',
      'active': 'Обрабатывается',
      'completed': 'Завершено',
      'failed': 'Ошибка'
    };
    
    return (
      <div style={{
        background: '#1f2937',
        padding: '16px',
        borderRadius: '8px',
        marginTop: '16px',
        border: '1px solid #374151'
      }}>
        <h3 style={{ color: '#e5e7eb', marginBottom: '8px' }}>Статус обработки</h3>
        <p style={{ color: '#9ca3af', marginBottom: '4px' }}>
          ID задачи: {jobId}
        </p>
        <p style={{ color: '#9ca3af', marginBottom: '4px' }}>
          Статус: {statusText[processingStatus as keyof typeof statusText] || processingStatus}
        </p>
        {queuePosition && (
          <p style={{ color: '#9ca3af', marginBottom: '4px' }}>
            Позиция в очереди: {queuePosition}
          </p>
        )}
        {estimatedTime && (
          <p style={{ color: '#9ca3af', marginBottom: '4px' }}>
            Примерное время: {estimatedTime} минут
          </p>
        )}
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: '#111114', padding: isMobile ? '16px' : '40px', paddingTop: isMobile ? '56px' : '48px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
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
        }}>Загрузка премьеры</h1>
        <div style={{
          background: 'none',
          color: '#bdbdbd',
          fontSize: 14,
          marginBottom: 12,
          textAlign: 'center',
          lineHeight: 1.4,
        }}>
          Внимание: видео будет автоматически удалено сразу после окончания премьеры!
        </div>
        <input
          type="text"
          placeholder="Название видео"
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
          placeholder="Описание (необязательно)"
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
        <input
          type="datetime-local"
          value={premiereAt}
          onChange={e => setPremiereAt(e.target.value)}
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
        <label style={{ color: '#bdbdbd', fontSize: 15, marginBottom: 0, fontWeight: 400 }}>Обложка (обязательно)</label>
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
        <label style={{ color: '#bdbdbd', fontSize: 15, marginBottom: 0, fontWeight: 400 }}>Видео</label>
        <input
          type="file"
          accept="video/*"
          ref={videoInputRef}
          onChange={e => setVideo(e.target.files?.[0] || null)}
          style={{
            background: 'none',
            border: 'none',
            color: '#bdbdbd',
            fontSize: 15,
            padding: 0,
            marginBottom: 0,
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            background: loading ? '#23232a' : '#18181b',
            color: loading ? '#888' : '#e0e0e0',
            border: 'none',
            borderRadius: 6,
            fontSize: 18,
            fontWeight: 600,
            padding: '14px 0',
            marginTop: 8,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s, color 0.2s',
            boxShadow: 'none',
            letterSpacing: '0.5px',
          }}
        >
          {loading ? 'Загрузка...' : 'Загрузить'}
        </button>
        {message && (
          <div style={{ color: '#ff5252', fontSize: 15, marginTop: 4, textAlign: 'left' }}>{message}</div>
        )}
        {/* Добавляем отображение статуса после формы */}
        {renderProcessingStatus()}
      </form>
    </div>
  );
}

// Компонент для авто-роста textarea
function AutoResizeTextarea({ textareaRef, value }: { textareaRef: React.RefObject<HTMLTextAreaElement | null>, value: string }) {
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    }
  }, [value, textareaRef]);
  return null;
}

export async function getServerSideProps() {
  return { props: { hideHeader: true } };
}
