import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Upload() {
  const [user, setUser] = useState<any>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

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
      }}>
        Загрузка...
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#111114',
        color: '#e0e0e0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div>
          <h1>Требуется вход</h1>
          <p>Войдите или зарегистрируйтесь, чтобы загружать премьеры</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#111114', 
      padding: '40px',
      color: '#e0e0e0'
    }}>
      <h1>Загрузка премьеры</h1>
      <p>Пользователь: {user.email}</p>
      <p>Это упрощенная версия для тестирования</p>
    </div>
  );
}

export async function getServerSideProps() {
  return { props: { hideHeader: true } };
}
