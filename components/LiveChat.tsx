import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

type ChatMessage = {
  id: number;
  video_id: string;
  user_id: string;
  message: string;
  created_at: string;
};

type LiveChatProps = {
  videoId: string;
  currentUser: any;
};

export default function LiveChat({ videoId, currentUser }: LiveChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const MESSAGE_LIMIT = 500;

  // Автопрокрутка больше не нужна, так как новые сообщения сверху

  // Загрузка сообщений
  useEffect(() => {
    loadMessages();
    
    // Подписка на новые сообщения через Supabase Realtime
    try {
      const channel = supabase
        .channel(`comments:${videoId}`)
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'video_chat_messages',
            filter: `video_id=eq.${videoId}`
          }, 
          (payload: any) => {
            setMessages(prev => [...prev, payload.new as ChatMessage]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (error) {
      console.error('Ошибка подписки на комментарии:', error);
    }
  }, [videoId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      const parent = messagesEndRef.current.parentElement?.parentElement;
      if (parent) {
        // Прокручиваем чуть ниже, чтобы последнее сообщение не было вплотную к верху
        parent.scrollTop = parent.scrollHeight - parent.clientHeight - 32;
      } else {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages]);

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('video_chat_messages')
        .select('*')
        .eq('video_id', videoId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (!error && data) {
        setMessages(data);
      }
    } catch (error) {
      console.error('Ошибка загрузки сообщений:', error);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser || isLoading || cooldown) return;

    setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('video_chat_messages')
        .insert({
          video_id: videoId,
          user_id: currentUser.id,
          message: newMessage.trim()
        })
        .select();

      if (!error && data) {
        console.log('Сообщение отправлено:', data);
        setNewMessage('');
        setCooldown(true);
        setTimeout(() => setCooldown(false), 2000);
      } else {
        console.error('Ошибка отправки сообщения:', error);
      }
    } catch (error) {
      console.error('Ошибка:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Генерация уникального цвета по user_id
  function getUserColor(userId: string) {
    // Простая хеш-функция для генерации цвета
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 60%)`;
  }

  const getUserDisplayName = (message: ChatMessage) => {
    // Если это сообщение текущего пользователя, показываем его email
    if (message.user_id === currentUser?.id && currentUser?.email) {
      return currentUser.email.split('@')[0];
    }
    // Для других пользователей показываем короткий ID
    return `user_${message.user_id.slice(0, 4)}`;
  };

  return (
    <div style={{
      width: '100%',
      maxWidth: '100%',
      height: '400px',
      border: '1px solid #23232a',
      borderRadius: '6px',
      display: 'flex',
      flexDirection: 'column',
      background: '#18181b',
      boxShadow: '0 2px 8px #000a',
      color: '#f3f3f3',
    }}>
      {/* Заголовок комментариев */}
      <div style={{
        padding: '8px 12px',
        background: 'linear-gradient(135deg, #23232a 80%, #1769aa 100%)',
        borderBottom: '1px solid #23232a',
        borderTopLeftRadius: '4px',
        borderTopRightRadius: '4px',
        fontWeight: '700',
        fontSize: '14px',
        color: '#fff',
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2196f3" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:'middle'}}>
          <path d="M21 11.5a8.38 8.38 0 0 1-1.9 5.4A8.5 8.5 0 0 1 12 21.5a8.38 8.38 0 0 1-5.4-1.9L3 21l1.4-3.6A8.38 8.38 0 0 1 2.5 12a8.5 8.5 0 1 1 17 0z"/>
        </svg>
        Комментарии
      </div>

      {/* Форма отправки сообщения - СВЕРХУ */}
      <form onSubmit={sendMessage} style={{
        padding: '16px',
        borderBottom: '1px solid #23232a',
        background: '#18181b',
      }}>
          <div style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
          }}>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => {
              if (e.target.value.length <= MESSAGE_LIMIT) setNewMessage(e.target.value);
            }}
            placeholder={currentUser ? "Написать сообщение..." : "Войдите для отправки сообщений"}
            disabled={!currentUser || isLoading || cooldown}
            style={{
              flex: 1,
              padding: '12px 14px',
              border: '2px solid #23232a',
              borderRadius: '6px',
              fontSize: '15px',
              outline: 'none',
              transition: 'border-color 0.3s',
              background: '#23232a',
              color: '#f3f3f3',
              height: 40,
              minWidth: 0,
            }}
            maxLength={MESSAGE_LIMIT}
          />
          <span style={{ fontSize: 11, color: newMessage.length >= MESSAGE_LIMIT ? '#e57373' : '#bdbdbd', minWidth: 48, textAlign: 'right', opacity: 0.7, userSelect: 'none' }}>
            {newMessage.length} / {MESSAGE_LIMIT}
          </span>
          <button
            type="submit"
           disabled={!newMessage.trim() || !currentUser || isLoading || cooldown}
           style={{
             width: 40,
             height: 40,
             padding: 0,
             background: newMessage.trim() && currentUser ? 'linear-gradient(135deg, #23232a 80%, #1769aa 100%)' : '#23232a',
             color: '#fff',
             border: 'none',
             borderRadius: '6px',
             fontSize: '18px',
             cursor: newMessage.trim() && currentUser ? 'pointer' : 'not-allowed',
             fontWeight: '600',
             transition: 'opacity 0.3s',
             opacity: isLoading ? 0.7 : 1,
             display: 'flex',
             alignItems: 'center',
             justifyContent: 'center',
           }}
          >
            {isLoading ? '⏳' : '→'}
          </button>
        </div>
      </form>

      {/* Область сообщений - СНИЗУ, новые сообщения сверху */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px',
        background: '#18181b',
        display: 'flex',
        flexDirection: 'column-reverse',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {messages.length === 0 ? (
            <div style={{
              textAlign: 'center',
              color: '#bdbdbd',
              fontSize: '14px',
              marginTop: '20px',
            }}>
              Начните общение первым!
            </div>
          ) : (
            [...messages].reverse().map((message, idx, arr) => (
              <div key={message.id} style={{
                marginBottom: '6px',
                padding: '4px 8px',
                fontSize: '14px',
                color: '#f3f3f3',
                wordBreak: 'break-word',
                lineHeight: '1.4',
              }}>
                <span style={{
                  fontWeight: '600',
                  color: message.user_id === currentUser?.id ? '#2196f3' : getUserColor(message.user_id),
                  marginRight: '8px',
                  transition: 'color 0.2s',
                }}>
                  {getUserDisplayName(message)}:
                </span>
                <span>{
                  message.message.match(/^https?:\/\/.*\.gif$/i)
                    ? (
                        <img src={message.message} alt="gif" style={{ maxWidth: '36px', maxHeight: '36px', verticalAlign: 'middle', borderRadius: '8px', background: '#23232a' }} />
                      )
                    : message.message
                }</span>
                {idx === 0 && <div ref={messagesEndRef} />}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
} 