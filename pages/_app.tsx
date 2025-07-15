import '../styles/globals.css';
import type { AppProps } from 'next/app';
import Header from '../components/Header';
import MobileBottomBar from '../components/MobileBottomBar';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      {!pageProps.hideHeader && <Header />}
      <Component {...pageProps} />
      <MobileBottomBar />
    </>
  );
} 