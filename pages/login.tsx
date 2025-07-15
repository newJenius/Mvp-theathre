import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import Link from 'next/link';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.matchMedia('(max-width: 600px)').matches);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      setMessage('Ошибка входа: ' + error.message);
    } else {
      setMessage('Вход выполнен!');
      // Редирект на главную после успешного входа
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#18181b',
      padding: isMobile ? '16px' : '20px',
    }}>
      <div style={{
        background: '#23232a',
        borderRadius: isMobile ? 8 : 12,
        padding: isMobile ? '24px 20px' : '40px',
        width: '100%',
        maxWidth: isMobile ? '100%' : '400px',
        border: '1px solid #2a2a2a',
      }}>
        <div style={{ textAlign: 'center', marginBottom: isMobile ? '24px' : '32px' }}>
          <h1 style={{ 
            color: '#fff', 
            fontSize: isMobile ? '24px' : '28px', 
            fontWeight: '700',
            marginBottom: '8px'
          }}>
            Вход в аккаунт
          </h1>
          <p style={{ 
            color: '#bdbdbd', 
            fontSize: isMobile ? '14px' : '16px',
            margin: 0
          }}>
            Войдите, чтобы продолжить
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '20px' }}>
          <div>
            <label style={{ 
              display: 'block', 
              color: '#fff', 
              fontSize: '14px', 
              fontWeight: '500',
              marginBottom: '8px'
            }}>
              Email
            </label>
            <input
              type="email"
              placeholder="Введите ваш email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: isMobile ? '10px 14px' : '12px 16px',
                fontSize: isMobile ? '16px' : '16px', // 16px для мобильных чтобы не зуммилось
                borderRadius: '8px',
                border: '1px solid #2a2a2a',
                background: '#18181b',
                color: '#fff',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = '#2196f3'}
              onBlur={(e) => e.target.style.borderColor = '#2a2a2a'}
            />
          </div>

          <div>
            <label style={{ 
              display: 'block', 
              color: '#fff', 
              fontSize: '14px', 
              fontWeight: '500',
              marginBottom: '8px'
            }}>
              Пароль
            </label>
            <input
              type="password"
              placeholder="Введите ваш пароль"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: isMobile ? '10px 14px' : '12px 16px',
                fontSize: isMobile ? '16px' : '16px',
                borderRadius: '8px',
                border: '1px solid #2a2a2a',
                background: '#18181b',
                color: '#fff',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = '#2196f3'}
              onBlur={(e) => e.target.style.borderColor = '#2a2a2a'}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{
              padding: isMobile ? '12px 20px' : '14px 24px',
              background: loading ? '#2a2a2a' : 'linear-gradient(90deg, #2196f3, #1769aa)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              fontSize: isMobile ? '15px' : '16px',
              cursor: loading ? 'default' : 'pointer',
              transition: 'opacity 0.2s',
              opacity: loading ? 0.7 : 1,
            }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => !loading && (e.currentTarget.style.opacity = '1')}
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>

          {message && (
            <div style={{ 
              padding: isMobile ? '10px 14px' : '12px 16px',
              borderRadius: '8px',
              fontSize: isMobile ? '13px' : '14px',
              textAlign: 'center',
              background: message.includes('Ошибка') ? '#fef2f2' : '#f0fdf4',
              color: message.includes('Ошибка') ? '#dc2626' : '#16a34a',
              border: `1px solid ${message.includes('Ошибка') ? '#fecaca' : '#bbf7d0'}`
            }}>
              {message}
            </div>
          )}

          <div style={{ 
            textAlign: 'center', 
            marginTop: isMobile ? '12px' : '16px',
            paddingTop: isMobile ? '16px' : '20px',
            borderTop: '1px solid #2a2a2a'
          }}>
            <p style={{ 
              color: '#bdbdbd', 
              fontSize: isMobile ? '13px' : '14px',
              margin: '0 0 12px 0'
            }}>
              Нет аккаунта?
            </p>
            <Link href="/register" style={{
              color: '#2196f3',
              textDecoration: 'none',
              fontSize: isMobile ? '15px' : '16px',
              fontWeight: '600',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              Зарегистрироваться
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

