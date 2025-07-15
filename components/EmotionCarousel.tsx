import { useState, useEffect } from 'react';

const emotions = [
  { id: 1, name: 'Смех', gif: 'https://i.gifer.com/SC77.gif' },
  { id: 2, name: 'Вау', gif: 'https://i.gifer.com/S7hF.gif' },
  { id: 3, name: 'Сердце', gif: 'https://i.gifer.com/VA0w.gif' },
  { id: 4, name: 'Огонь', gif: 'https://i.gifer.com/VZ7e.gif' },
  { id: 5, name: 'Класс', gif: 'https://i.gifer.com/IQ0X.gif' },
  { id: 6, name: 'Круто', gif: 'https://i.gifer.com/Pbd.gif' },
  { id: 7, name: 'Класс', gif: 'https://i.gifer.com/1Pxu.gif' },
  { id: 8, name: 'Круто', gif: 'https://i.gifer.com/PyTL.gif' },
];

export default function EmotionCarousel({ onEmotionClick }: { onEmotionClick?: (emotion: typeof emotions[0]) => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % emotions.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      padding: '20px',
      background: '#18181b',
      borderTop: '1px solid #23232a',
    }}>
      
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
      }}>
        {emotions.map((emotion, index) => (
          <div
            key={emotion.id}
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '8px',
              overflow: 'hidden',
              border: 'none',
              cursor: 'pointer',
              background: '#23232a',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#1769aa'}
            onMouseLeave={e => e.currentTarget.style.background = '#23232a'}
            onClick={() => {
              if (onEmotionClick) {
                onEmotionClick(emotion);
              } else {
                setCurrentIndex(index);
              }
            }}
          >
            <img
              src={emotion.gif}
              alt={emotion.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                background: '#23232a',
              }}
            />
          </div>
        ))}
      </div>
      
      <div style={{
        textAlign: 'center',
        marginTop: '12px',
        fontSize: '14px',
        color: '#666',
      }}></div>
    </div>
  );
} 