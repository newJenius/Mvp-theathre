import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import Link from 'next/link';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [invite, setInvite] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.matchMedia('(max-width: 600px)').matches);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    // Проверка инвайта
    const { data: invites, error } = await supabase
      .from('invites')
      .select('*')
      .eq('code', invite)
      .eq('used', false);

    if (error || !invites || invites.length === 0) {
      setMessage('Инвайт не найден или уже использован');
      setLoading(false);
      return;
    }

    // Регистрация через Supabase Auth
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });
    if (signUpError) {
      setMessage('Ошибка регистрации: ' + signUpError.message);
      setLoading(false);
      return;
    }

    // Пометить инвайт как использованный
    await supabase
      .from('invites')
      .update({ used: true })
      .eq('id', invites[0].id);

    setMessage('Проверьте почту для подтверждения!');
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
            Регистрация
          </h1>
          <p style={{ 
            color: '#bdbdbd', 
            fontSize: isMobile ? '14px' : '16px',
            margin: 0
          }}>
            Создайте аккаунт, чтобы создавать уникальные премьеры
          </p>
          <div style={{
            marginTop: '12px',
            padding: '8px 12px',
            background: '#2a2a2a',
            color: '#bdbdbd',
            borderRadius: '6px',
            fontSize: isMobile ? '12px' : '13px',
            border: '1px solid #3a3a3a',
            fontWeight: '400',
            opacity: 0.8
          }}>
            Для регистрации необходим инвайт-код
          </div>
        </div>

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '20px' }}>
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
                fontSize: isMobile ? '16px' : '16px',
                borderRadius: '8px',
                border: '1px solid #2a2a2a',
                background: '#18181b',
                color: '#fff',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = '#22c55e'}
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
              placeholder="Введите пароль"
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
              onFocus={(e) => e.target.style.borderColor = '#22c55e'}
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
              Инвайт-код
            </label>
            <input
              type="text"
              placeholder="Введите инвайт-код"
              value={invite}
              onChange={e => setInvite(e.target.value)}
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
              onFocus={(e) => e.target.style.borderColor = '#22c55e'}
              onBlur={(e) => e.target.style.borderColor = '#2a2a2a'}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{
              padding: isMobile ? '12px 20px' : '14px 24px',
              background: loading ? '#2a2a2a' : 'linear-gradient(90deg, #22c55e, #16a34a)',
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
            {loading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>

          {message && (
            <div style={{ 
              padding: isMobile ? '10px 14px' : '12px 16px',
              borderRadius: '8px',
              fontSize: isMobile ? '13px' : '14px',
              textAlign: 'center',
              background: message.includes('Ошибка') || message.includes('не найден') ? '#fef2f2' : '#f0fdf4',
              color: message.includes('Ошибка') || message.includes('не найден') ? '#dc2626' : '#16a34a',
              border: `1px solid ${message.includes('Ошибка') || message.includes('не найден') ? '#fecaca' : '#bbf7d0'}`
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
              Уже есть аккаунт?
            </p>
            <Link href="/login" style={{
              color: '#22c55e',
              textDecoration: 'none',
              fontSize: isMobile ? '15px' : '16px',
              fontWeight: '600',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              Войти
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
