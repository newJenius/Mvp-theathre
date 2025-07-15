import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Header() {
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
  }, [lastScrollY]);

  // Проверяем, нужно ли скрыть хедер (на странице видео во время активной премьеры)
  useEffect(() => {
    const checkIfShouldHide = async () => {
      if (router.pathname === '/watch/[id]' && router.query.id) {
        try {
          const { data: video } = await supabase
            .from('videos')
            .select('premiere_at')
            .eq('id', router.query.id)
            .single();
          
          if (video) {
            const now = new Date();
            const premiere = new Date(video.premiere_at);
            const canWatch = now >= premiere;
            setShouldHide(canWatch);
          }
        } catch (error) {
          console.error('Ошибка при проверке статуса видео:', error);
        }
      } else {
        setShouldHide(false);
      }
    };

    checkIfShouldHide();
  }, [router.pathname, router.query.id]);

  if (shouldHide) {
    return null;
  }

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
      boxShadow: '0 2px 8px #000a',
      transition: 'transform 0.3s cubic-bezier(.4,0,.2,1)',
      transform: hideOnScroll ? 'translateY(-100%)' : 'translateY(0)',
    }}>
      <Link href="/" style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        textDecoration: 'none',
        marginLeft: isMobile ? 24 : 48,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: isMobile ? 28 : 34, height: isMobile ? 28 : 34 }}>
          <svg width={isMobile ? 22 : 26} height={isMobile ? 22 : 26} viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="13" cy="13" r="12" stroke="#bdbdbd" strokeWidth="2" />
            <circle cx="13" cy="13" r="3" fill="#bdbdbd" />
          </svg>
        </span>
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
      </Link>
    </header>
  );
}
