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
        // System notification permission window
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setError('You did not allow notifications in the browser');
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
        if (!res.ok) throw new Error('Error saving subscription');
        setSubscribed(true);
      } else {
        setError('Push API is not supported');
      }
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  return (
    <>
      {unsupported && (
        <div style={{ color: '#f87171', fontSize: 14, textAlign: 'center', marginTop: 8 }}>
          Push notifications are not supported in your browser
        </div>
      )}
      <button
        onClick={handleSubscribe}
        disabled={subscribed || loading || unsupported}
        style={{
          background: subscribed ? '#fef9c3' : '#fef9c3',
          color: '#18181b',
          border: 'none',
          borderRadius: 7,
          padding: '12px 0',
          fontWeight: 700,
          fontSize: 15,
          cursor: subscribed || unsupported ? 'default' : 'pointer',
          opacity: loading || unsupported ? 0.7 : 1,
          marginTop: 0,
          width: '100%',
          maxWidth: 420,
          transition: 'background 0.2s, color 0.2s',
          boxShadow: 'none',
          letterSpacing: 0.2,
          fontFamily: `'JetBrains Mono', monospace`
        }}
      >
        {subscribed ? 'Notifications enabled' : loading ? 'Enabling...' : 'Enable premiere notifications'}
      </button>
      {error && <div style={{ color: '#f87171', marginTop: 8, fontSize: 14 }}>{error}</div>}
    </>
  );
} 