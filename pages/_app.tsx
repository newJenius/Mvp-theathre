import '../styles/globals.css';
import type { AppProps } from 'next/app';
import Header from '../components/Header';
import MobileBottomBar from '../components/MobileBottomBar';
import ErrorBoundary from '../components/ErrorBoundary';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>
      {!pageProps.hideHeader && <Header />}
      <Component {...pageProps} />
      <MobileBottomBar />
    </ErrorBoundary>
  );
} 