import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function MobileBottomBar() {
  const [user, setUser] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const checkMobile = () => setIsMobile(window.matchMedia('(max-width: 600px)').matches);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!isMobile) return null;

  return (
    <nav style={{
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 200,
      background: '#18181b',
      color: '#2196f3',
      backgroundColor: '#18181b',
      boxShadow: '0 -1px 4px #0006', // очень мягкая тень
      borderTop: '1px solid #23232a',
      WebkitBackdropFilter: 'none',
      backdropFilter: 'none',
      opacity: 1,
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      height: `calc(50px + env(safe-area-inset-bottom))`,
      paddingBottom: 'env(safe-area-inset-bottom)',
      margin: 0,
    }}>
      <Link href="/" style={{ textAlign: 'center', color: '#bdbdbd', textDecoration: 'none', flex: 1 }}>
        <div style={{ lineHeight: 1, display: 'flex', justifyContent: 'center', paddingTop: 2 }}>
          {/* Минималистичный домик */}
          <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="#bdbdbd" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="7,20 7,12 17,12 17,20" />
            <polyline points="3,12 12,4 21,12" />
          </svg>
        </div>
        <div style={{ fontSize: 11, marginTop: 2, color: '#bdbdbd' }}>Главная</div>
      </Link>
      <Link href="/upload" style={{ textAlign: 'center', color: '#bdbdbd', textDecoration: 'none', flex: 1 }}>
        <div style={{ lineHeight: 1, display: 'flex', justifyContent: 'center', paddingTop: 2 }}>
          {/* Минималистичная загрузка — стрелка вверх в круге */}
          <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="#bdbdbd" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <line x1="12" y1="16" x2="12" y2="8" />
            <polyline points="9,11 12,8 15,11" />
          </svg>
        </div>
        <div style={{ fontSize: 11, marginTop: 2, color: '#bdbdbd' }}>Загрузить</div>
      </Link>
      <Link href="/profile" style={{ textAlign: 'center', color: '#bdbdbd', textDecoration: 'none', flex: 1 }}>
        <div style={{ lineHeight: 1, display: 'flex', justifyContent: 'center', paddingTop: 2 }}>
          {/* Минималистичный профиль — только круг */}
          <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="#bdbdbd" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="8" />
          </svg>
        </div>
        <div style={{ fontSize: 11, marginTop: 2, color: '#bdbdbd' }}>Профиль</div>
      </Link>
    </nav>
  );
} 