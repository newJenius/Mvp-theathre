import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { useEffect } from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import MobileBottomBar from '../components/MobileBottomBar';
import ErrorBoundary from '../components/ErrorBoundary';
import InstallPWA from '../components/InstallPWA';

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js')
          .then(function(registration) {
            console.log('SW registered: ', registration);
          })
          .catch(function(registrationError) {
            console.log('SW registration failed: ', registrationError);
          });
      });
    }

    // Handle app installed event
    window.addEventListener('appinstalled', (evt) => {
      console.log('App was installed');
    });
  }, []);

  return (
    <>
      <Head>
        <meta name="application-name" content="OneTimeShow" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="OneTimeShow" />
        <meta name="description" content="Live video streaming platform" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="msapplication-TileColor" content="#18181b" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="theme-color" content="#18181b" />

        <link rel="apple-touch-icon" href="/apple-touch-icon.svg" />
        <link rel="icon" type="image/svg+xml" sizes="32x32" href="/icon-32x32.svg" />
        <link rel="icon" type="image/svg+xml" sizes="16x16" href="/icon-16x16.svg" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#18181b" />
        <link rel="shortcut icon" href="/favicon.svg" />

        <meta name="twitter:card" content="summary" />
        <meta name="twitter:url" content="https://onetimeshow.app" />
        <meta name="twitter:title" content="OneTimeShow" />
        <meta name="twitter:description" content="Live video streaming platform" />
        <meta name="twitter:image" content="https://onetimeshow.app/icon-192x192.svg" />
        <meta name="twitter:creator" content="@onetimeshow" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="OneTimeShow" />
        <meta property="og:description" content="Live video streaming platform" />
        <meta property="og:site_name" content="OneTimeShow" />
        <meta property="og:url" content="https://onetimeshow.app" />
        <meta property="og:image" content="https://onetimeshow.app/icon-192x192.svg" />
      </Head>
      <ErrorBoundary>
        {!pageProps.hideHeader && <Header />}
        <Component {...pageProps} />
        <MobileBottomBar />
        <InstallPWA />
      </ErrorBoundary>
    </>
  );
} 