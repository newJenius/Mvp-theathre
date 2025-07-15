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
      background: '#18181b',
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
        fontWeight: 'bold',
        fontSize: isMobile ? 26 : 34,
        textDecoration: 'none',
        letterSpacing: 1,
        marginLeft: isMobile ? 24 : 48,
        background: 'linear-gradient(90deg, #2196f3, #1769aa)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        color: 'transparent',
        display: 'inline-block',
      }}>
        Nermes
      </Link>
    </header>
  );
}
