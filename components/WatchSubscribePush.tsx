import React, { useState, useEffect } from 'react';

const VAPID_PUBLIC_KEY = 'BDYWw2muyYWNSnroP2SEtO13aQtSps9Z-h4KRJrtQafHFsZADry3PIBF_KYMIgZtpV5C4UQZDMGRvw4dmlxWjy4';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export default function WatchSubscribePush({ premiereId, userId, visible = true }: { premiereId: string, userId: string, visible?: boolean }) {
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setUnsupported(true);
    }
  }, []);

  if (!visible) return null;

  async function handleSubscribe() {
    setLoading(true);
    setError(null);
    try {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        // Системное окно разрешения уведомлений
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setError('Вы не разрешили уведомления в браузере');
          setLoading(false);
          return;
        }
        const registration = await navigator.serviceWorker.register('/sw.js');
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
        const res = await fetch('/api/save-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription, premiereId, userId })
        });
        if (!res.ok) throw new Error('Ошибка при сохранении подписки');
        setSubscribed(true);
      } else {
        setError('Push API не поддерживается');
      }
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  return (
    <>
      {unsupported && (
        <div style={{ color: '#f87171', marginTop: 8, fontSize: 14 }}>
          Уведомления не поддерживаются в вашем браузере или на этом устройстве.<br/>
          Попробуйте открыть сайт на компьютере или установить его на главный экран, если используете iPhone (iOS 16.4+).
        </div>
      )}
      <button
        onClick={handleSubscribe}
        disabled={subscribed || loading || unsupported}
        style={{
          background: subscribed ? '#23232a' : '#23232a',
          color: '#e0e0e0',
          border: 'none',
          borderRadius: 0,
          padding: '8px 20px',
          fontWeight: 600,
          fontSize: 16,
          cursor: subscribed || unsupported ? 'default' : 'pointer',
          opacity: loading || unsupported ? 0.7 : 1,
          marginTop: 12
        }}
      >
        {subscribed ? 'Уведомления включены' : loading ? 'Включение...' : 'Включить уведомления о начале'}
      </button>
      {error && <div style={{ color: '#f87171', marginTop: 8, fontSize: 14 }}>{error}</div>}
    </>
  );
} 