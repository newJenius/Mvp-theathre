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
      <Link href="/" style={{ textAlign: 'center', color: '#2196f3', textDecoration: 'none', flex: 1 }}>
        <div style={{ lineHeight: 1, display: 'flex', justifyContent: 'center', paddingTop: 2 }}>
          <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11.5L12 4l9 7.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V11.5z"/><path d="M9 22V12h6v10"/></svg>
        </div>
        <div style={{ fontSize: 11, marginTop: 2, color: '#fff' }}>Главная</div>
      </Link>
      <Link href="/upload" style={{ textAlign: 'center', color: '#2196f3', textDecoration: 'none', flex: 1 }}>
        <div style={{ lineHeight: 1, display: 'flex', justifyContent: 'center', paddingTop: 2 }}>
          <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
        </div>
        <div style={{ fontSize: 11, marginTop: 2, color: '#fff' }}>Загрузить</div>
      </Link>
      <Link href="/profile" style={{ textAlign: 'center', color: '#2196f3', textDecoration: 'none', flex: 1 }}>
        <div style={{ lineHeight: 1, display: 'flex', justifyContent: 'center', paddingTop: 2 }}>
          <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-7 8-7s8 3 8 7"/></svg>
        </div>
        <div style={{ fontSize: 11, marginTop: 2, color: '#fff' }}>Профиль</div>
      </Link>
    </nav>
  );
} 