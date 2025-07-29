import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function MobileBottomBar() {
  const [user, setUser] = useState<any>(null);
  // const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // const checkMobile = () => setIsMobile(window.matchMedia('(max-width: 600px)').matches);
    // checkMobile();
    // window.addEventListener('resize', checkMobile);
    // Safe user check
    try {
      supabase.auth.getUser().then(({ data }: any) => setUser(data.user)).catch((error: any) => {
        console.error('Error getting user:', error);
      });
    } catch (error) {
      console.error('Supabase initialization error:', error);
    }
    // return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // if (!isMobile) return null;

  return (
    <nav style={{
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 200,
      background: '#000000',
      color: '#2196f3',
      backgroundColor: '#000000',
      boxShadow: '0 -1px 4px #0006', // very soft shadow
      borderTop: '1px solid #23232a',
      WebkitBackdropFilter: 'none',
      backdropFilter: 'none',
      opacity: 1,
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      height: 'calc(50px + env(safe-area-inset-bottom, 0px))',
      minHeight: 50,
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      margin: 0,
      backgroundClip: 'padding-box',
    }}>
      <Link href="/" style={{ textAlign: 'center', color: '#bdbdbd', textDecoration: 'none', flex: 1 }}>
        <div style={{ lineHeight: 1, display: 'flex', justifyContent: 'center', paddingTop: 2 }}>
          {/* Modern home icon */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#bdbdbd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9,22 9,12 15,12 15,22"/>
          </svg>
        </div>
        <div style={{ fontSize: 11, marginTop: 2, color: '#bdbdbd' }}>Main</div>
      </Link>
      <Link href="/upload" style={{ textAlign: 'center', color: '#39FF14', textDecoration: 'none', flex: 1 }}>
        <div style={{ lineHeight: 1, display: 'flex', justifyContent: 'center', paddingTop: 2 }}>
          {/* Modern plus icon */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#39FF14" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </div>
        <div style={{ fontSize: 11, marginTop: 2, color: '#39FF14', fontWeight: '600' }}>Upload</div>
      </Link>
      <Link href="/profile" style={{ textAlign: 'center', color: '#bdbdbd', textDecoration: 'none', flex: 1 }}>
        <div style={{ lineHeight: 1, display: 'flex', justifyContent: 'center', paddingTop: 2 }}>
          {/* Modern user icon */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#bdbdbd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <div style={{ fontSize: 11, marginTop: 2, color: '#bdbdbd' }}>Profile</div>
      </Link>
    </nav>
  );
} 