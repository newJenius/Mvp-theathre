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
  const coverInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const TITLE_LIMIT = 150;
  const [user, setUser] = useState<any>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.matchMedia('(max-width: 600px)').matches);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setCheckedAuth(true);
    });
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
        background: '#18181b',
        borderRadius: 10,
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
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: isMobile ? 18 : 22,
        color: '#fff',
        textAlign: 'center',
        background: '#18181b',
        borderRadius: 10,
        margin: isMobile ? '20px auto' : '40px auto',
        maxWidth: isMobile ? '90%' : 500,
        boxShadow: '0 2px 16px #0004',
        padding: isMobile ? '20px' : '40px',
        paddingTop: isMobile ? '80px' : '40px',
      }}>
        Зарегистрируйтесь, чтобы загружать премьеры!
      </div>
    );
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);

    let coverUrl = '';
    let videoUrl = '';

    // Используем raw base URL для Storj
    const STORJ_PUBLIC_BASE = 'https://link.storjshare.io/raw/jw5fmzy4nkrs4kbu7gofbnwdllmq/videos';

    try {
      if (cover) {
        const coverPresignedUrl = await getPresignedUrl(cover, 'covers', 'videos');
        await uploadToStorj(cover, coverPresignedUrl.url);
        coverUrl = `${STORJ_PUBLIC_BASE}/${coverPresignedUrl.fileName}`;
      }
      if (video) {
        const { url: videoPresignedUrl, fileName: videoFileName } = await getPresignedUrl(video, 'videos', 'videos');
        await uploadToStorj(video, videoPresignedUrl);
        videoUrl = `${STORJ_PUBLIC_BASE}/${videoFileName}`;
      }
      if (!videoUrl) {
        setMessage('Не выбрано видео для загрузки.');
        return;
      }
      // Сохраняем ссылку и метаданные в Supabase
      const { error } = await supabase.from('videos').insert([
        {
          title,
          description,
          video_url: videoUrl,
          cover_url: coverUrl,
          premiere_at: premiereAt,
          user_id: (await supabase.auth.getUser()).data.user?.id,
        },
      ]);
      if (error) {
        setMessage('Ошибка сохранения в базу: ' + error.message);
      } else {
        setMessage('Видео успешно загружено!');
        setTitle('');
        setDescription('');
        setPremiereAt('');
        setCover(null);
        setVideo(null);
        if (coverInputRef.current) coverInputRef.current.value = '';
        if (videoInputRef.current) videoInputRef.current.value = '';
      }
    } catch (err) {
      setMessage('Ошибка загрузки: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#18181b',
      padding: isMobile ? '70px 10px 16px 10px' : '80px 20px 20px 20px',
    }}>
      <form onSubmit={handleUpload} style={{
        maxWidth: isMobile ? '95%' : 400,
        margin: '0 auto',
        padding: isMobile ? '24px 16px' : '32px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? 16 : 12,
        background: '#23232a',
        borderRadius: isMobile ? 8 : 10,
        boxShadow: 'none',
        boxSizing: 'border-box',
        color: '#f3f3f3',
        border: '1px solid #2a2a2a',
      }}>
        <label style={{ fontWeight: 500, fontSize: isMobile ? 14 : 15 }}>Название:
          <input
            type="text"
            placeholder="Название"
            value={title}
            onChange={e => {
              if (e.target.value.length <= TITLE_LIMIT) setTitle(e.target.value);
            }}
            required
            maxLength={TITLE_LIMIT}
            style={{ 
              width: '100%', 
              padding: isMobile ? 10 : 8, 
              fontSize: isMobile ? 14 : 15, 
              marginTop: 4, 
              borderRadius: 6, 
              border: '1px solid #23232a', 
              background: '#18181b', 
              color: '#f3f3f3',
              boxSizing: 'border-box'
            }}
          />
          <div style={{ fontSize: isMobile ? 11 : 12, color: title.length >= TITLE_LIMIT ? '#e57373' : '#bdbdbd', textAlign: 'right', marginTop: 4 }}>
            {title.length} / {TITLE_LIMIT}
          </div>
        </label>
        <label style={{ fontWeight: 500, fontSize: isMobile ? 14 : 15 }}>Описание:
          <textarea
            ref={descriptionRef}
            placeholder="Описание"
            value={description}
            onChange={e => {
              if (e.target.value.length <= DESCRIPTION_LIMIT) setDescription(e.target.value);
            }}
            required
            maxLength={DESCRIPTION_LIMIT}
            style={{ 
              width: '100%', 
              padding: isMobile ? 10 : 8, 
              fontSize: isMobile ? 14 : 15, 
              marginTop: 4, 
              borderRadius: 6, 
              border: '1px solid #23232a', 
              background: '#18181b', 
              color: '#f3f3f3', 
              resize: 'none', 
              minHeight: isMobile ? 80 : 60, 
              overflow: 'hidden',
              boxSizing: 'border-box'
            }}
          />
          <div style={{ fontSize: isMobile ? 11 : 12, color: description.length >= DESCRIPTION_LIMIT ? '#e57373' : '#bdbdbd', textAlign: 'right', marginTop: 4 }}>
            {description.length} / {DESCRIPTION_LIMIT}
          </div>
        </label>
        {/* Авто-рост textarea */}
        {typeof window !== 'undefined' && (
          <AutoResizeTextarea textareaRef={descriptionRef} value={description} />
        )}
        <label style={{ fontWeight: 500, fontSize: isMobile ? 14 : 15 }}>Дата и время премьеры:
          <input
            type="datetime-local"
            value={premiereAt}
            onChange={e => setPremiereAt(e.target.value)}
            required
            style={{ 
              width: '100%', 
              padding: isMobile ? 10 : 8, 
              fontSize: isMobile ? 14 : 15, 
              marginTop: 4, 
              borderRadius: 6, 
              border: '1px solid #23232a', 
              background: '#18181b', 
              color: '#f3f3f3',
              boxSizing: 'border-box'
            }}
          />
          <div style={{ fontSize: isMobile ? 12 : 13, color: '#ffb300', marginTop: 6 }}>
            Важно: время указывается в UTC!
          </div>
        </label>
        <label style={{ fontWeight: 500, fontSize: isMobile ? 14 : 15 }}>Обложка:
          <input
            type="file"
            accept="image/*"
            onChange={e => setCover(e.target.files?.[0] || null)}
            required
            ref={coverInputRef}
            style={{ 
              width: '100%', 
              marginTop: 4, 
              background: '#18181b', 
              color: '#f3f3f3', 
              border: '1px solid #23232a', 
              borderRadius: 6,
              padding: isMobile ? 8 : 4,
              fontSize: isMobile ? 13 : 14
            }}
          />
        </label>
        <label style={{ fontWeight: 500, fontSize: isMobile ? 14 : 15 }}>Видео:
          <input
            type="file"
            accept="video/*"
            onChange={e => setVideo(e.target.files?.[0] || null)}
            required
            ref={videoInputRef}
            style={{ 
              width: '100%', 
              marginTop: 4, 
              background: '#18181b', 
              color: '#f3f3f3', 
              border: '1px solid #23232a', 
              borderRadius: 6,
              padding: isMobile ? 8 : 4,
              fontSize: isMobile ? 13 : 14
            }}
          />
        </label>
        
        {/* Предупреждение о том, что видео исчезают после премьеры */}
        <div style={{
          background: '#2a2a2a',
          color: '#bdbdbd',
          padding: isMobile ? '8px 12px' : '10px 16px',
          marginTop: isMobile ? '8px' : '12px',
          borderRadius: '6px',
          border: '1px solid #3a3a3a',
          textAlign: 'center',
          fontSize: isMobile ? '11px' : '12px',
          lineHeight: '1.3',
          opacity: 0.7
        }}>
          Видео удаляются сразу после окончания премьеры
        </div>
        
        <button type="submit" style={{
          padding: isMobile ? '14px 0' : '10px 0',
          background: 'linear-gradient(90deg, #2196f3, #1769aa)',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontWeight: 'bold',
          fontSize: isMobile ? 15 : 16,
          cursor: 'pointer',
          marginTop: isMobile ? 12 : 8,
          transition: 'background 0.2s',
          opacity: loading ? 0.6 : 1,
          pointerEvents: loading ? 'none' : 'auto',
        }} disabled={loading}>
        {loading ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <svg style={{ width: 18, height: 18, verticalAlign: 'middle', animation: 'spin 1s linear infinite' }} viewBox="0 0 50 50">
              <circle cx="25" cy="25" r="20" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeDasharray="31.4 31.4"/>
            </svg>
            Загрузка...
          </span>
        ) : 'Загрузить видео'}
        </button>
        <div style={{ fontSize: isMobile ? 13 : 14, color: '#e57373', minHeight: isMobile ? 24 : 20, textAlign: 'center' }}>{message}</div>
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
