import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import Link from 'next/link';

export async function getServerSideProps() {
  return { props: { hideHeader: true } };
}

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
      background: '#111114',
      padding: isMobile ? '0' : '0',
    }}>
      <div style={{
        background: 'none',
        borderRadius: 0,
        padding: isMobile ? '24px 12px' : '36px 0',
        width: '100%',
        maxWidth: isMobile ? '100%' : '340px',
        border: 'none',
        boxShadow: 'none',
      }}>
        <div style={{ textAlign: 'center', marginBottom: isMobile ? '20px' : '28px' }}>
          <h1 style={{ 
            color: '#e0e0e0', 
            fontSize: isMobile ? '20px' : '22px', 
            fontWeight: '600',
            marginBottom: '6px',
            letterSpacing: 0.2
          }}>
            Вход
          </h1>
          <p style={{ 
            color: '#6b7280', 
            fontSize: isMobile ? '13px' : '14px',
            margin: 0
          }}>
            Войдите, чтобы продолжить
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '16px' }}>
          <div>
            <label style={{ 
              display: 'block', 
              color: '#bdbdbd', 
              fontSize: '13px', 
              fontWeight: '500',
              marginBottom: '6px'
            }}>
              Email
            </label>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: isMobile ? '10px 10px' : '12px 12px',
                fontSize: '15px',
                borderRadius: '0',
                border: '1.5px solid #23232a',
                background: '#18181b',
                color: '#e0e0e0',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
                outline: 'none',
              }}
              onFocus={e => e.target.style.borderColor = '#444'}
              onBlur={e => e.target.style.borderColor = '#23232a'}
            />
          </div>

          <div>
            <label style={{ 
              display: 'block', 
              color: '#bdbdbd', 
              fontSize: '13px', 
              fontWeight: '500',
              marginBottom: '6px'
            }}>
              Пароль
            </label>
            <input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: isMobile ? '10px 10px' : '12px 12px',
                fontSize: '15px',
                borderRadius: '0',
                border: '1.5px solid #23232a',
                background: '#18181b',
                color: '#e0e0e0',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
                outline: 'none',
              }}
              onFocus={e => e.target.style.borderColor = '#444'}
              onBlur={e => e.target.style.borderColor = '#23232a'}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{
              padding: isMobile ? '12px 0' : '13px 0',
              background: loading ? '#23232a' : '#18181b',
              color: loading ? '#888' : '#e0e0e0',
              border: 'none',
              borderRadius: '0',
              fontWeight: '600',
              fontSize: isMobile ? '15px' : '15px',
              cursor: loading ? 'default' : 'pointer',
              transition: 'background 0.2s, color 0.2s',
              opacity: loading ? 0.7 : 1,
              marginTop: 2,
              width: '100%',
              letterSpacing: 0.2
            }}
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>

          {message && (
            <div style={{ 
              padding: isMobile ? '10px 10px' : '12px 12px',
              borderRadius: '0',
              fontSize: isMobile ? '13px' : '14px',
              textAlign: 'center',
              background: message.includes('Ошибка') ? '#2a181b' : '#182a1b',
              color: message.includes('Ошибка') ? '#ff5252' : '#22c55e',
              border: `1px solid ${message.includes('Ошибка') ? '#3a232a' : '#233a2a'}`
            }}>
              {message}
            </div>
          )}

          <div style={{ 
            textAlign: 'center', 
            marginTop: isMobile ? '10px' : '14px',
            paddingTop: isMobile ? '12px' : '14px',
            borderTop: '1px solid #23232a'
          }}>
            <p style={{ 
              color: '#6b7280', 
              fontSize: isMobile ? '12px' : '13px',
              margin: '0 0 10px 0'
            }}>
              Нет аккаунта?
            </p>
            <Link href="/register" style={{
              color: '#2196f3',
              textDecoration: 'none',
              fontSize: isMobile ? '14px' : '15px',
              fontWeight: '500',
              transition: 'opacity 0.2s',
            }}>
              Зарегистрироваться
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

