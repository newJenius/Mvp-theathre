import { useState, useEffect } from 'react';

export default function InstallPWA() {
  const [supportsPWA, setSupportsPWA] = useState(false);
  const [promptInstall, setPromptInstall] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setPromptInstall(e);
      setSupportsPWA(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const onClick = async () => {
    if (!promptInstall) {
      return;
    }
    promptInstall.prompt();
    const { outcome } = await promptInstall.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    setPromptInstall(null);
    setSupportsPWA(false);
  };

  if (!supportsPWA) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      left: 20,
      right: 20,
      background: '#1a1a1a',
      border: '1px solid #333',
      borderRadius: 12,
      padding: 16,
      zIndex: 1000,
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 4 }}>
            Install OneTimeShow
          </div>
          <div style={{ fontSize: 14, color: '#bdbdbd' }}>
            Add to home screen for better experience
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setSupportsPWA(false)}
            style={{
              background: 'transparent',
              border: '1px solid #333',
              color: '#bdbdbd',
              padding: '8px 16px',
              borderRadius: 6,
              fontSize: 14,
              cursor: 'pointer'
            }}
          >
            Later
          </button>
          <button
            onClick={onClick}
            style={{
              background: '#007AFF',
              border: 'none',
              color: '#fff',
              padding: '8px 16px',
              borderRadius: 6,
              fontSize: 14,
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            Install
          </button>
        </div>
      </div>
    </div>
  );
} 