import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Header({ disableScrollHide = false }: { disableScrollHide?: boolean }) {
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();
  const [shouldHide, setShouldHide] = useState(false);
  const [hideOnScroll, setHideOnScroll] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    // Mobile detection
    const checkMobile = () => setIsMobile(window.matchMedia('(max-width: 600px)').matches);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (disableScrollHide) return; // Don't hide header on scroll if disabled
    
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          if (currentScrollY > lastScrollY && currentScrollY > 40) {
            setHideOnScroll(true);
          } else {
            setHideOnScroll(false);
          }
          setLastScrollY(currentScrollY);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY, disableScrollHide]);

  // Remove useEffect that calculates shouldHide

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: isMobile ? '8px 0' : '12px 0',
      borderBottom: '1px solid #23232a',
      margin: 0,
      background: '#0a0a0c',
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      zIndex: 100,
      boxSizing: 'border-box',
      // boxShadow: '0 2px 8px #000a', // remove shadow
      transition: 'transform 0.3s cubic-bezier(.4,0,.2,1)',
      transform: (disableScrollHide ? false : hideOnScroll) ? 'translateY(-100%)' : 'translateY(0)',
    }}>
      <Link href="/" style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: isMobile ? 8 : 18,
        textDecoration: 'none',
        marginLeft: isMobile ? 24 : 48,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: isMobile ? 28 : 34, height: isMobile ? 28 : 34 }}>
          <svg width={isMobile ? 22 : 26} height={isMobile ? 22 : 26} viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="13" cy="13" r="12" stroke="#bdbdbd" strokeWidth="2" />
            <circle cx="13" cy="13" r="3" fill="#bdbdbd" />
          </svg>
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: isMobile ? 1 : 2 }}>
          <span style={{
            fontWeight: 500,
            fontSize: isMobile ? 16 : 18,
            letterSpacing: 0.5,
            color: '#bdbdbd',
            textTransform: 'lowercase',
            fontFamily: 'monospace',
          }}>
            onetimeshow
          </span>
          <span style={{
            fontSize: isMobile ? 11 : 14,
            color: '#e57373',
            fontWeight: 600,
            letterSpacing: 0.2,
            fontFamily: 'monospace',
            opacity: 0.92,
            textShadow: '0 1px 2px #000a',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            userSelect: 'none',
          }}>
            Don't miss it — premieres disappear forever!
          </span>
        </span>
      </Link>
    </header>
  );
}
