-- Создание таблицы для хранения пользователей, ожидающих премьеру видео
CREATE TABLE IF NOT EXISTS video_expected_users (
  id SERIAL PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(video_id, user_id)
);

-- Создание индексов для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_video_expected_users_video_id ON video_expected_users(video_id);
CREATE INDEX IF NOT EXISTS idx_video_expected_users_user_id ON video_expected_users(user_id);
CREATE INDEX IF NOT EXISTS idx_video_expected_users_created_at ON video_expected_users(created_at);

-- Настройка RLS (Row Level Security)
ALTER TABLE video_expected_users ENABLE ROW LEVEL SECURITY;

-- Политика: пользователи могут видеть все записи ожидающих
DROP POLICY IF EXISTS "Users can view all expected users" ON video_expected_users;
CREATE POLICY "Users can view all expected users" ON video_expected_users
  FOR SELECT USING (true);

-- Политика: пользователи могут добавлять себя в список ожидающих
DROP POLICY IF EXISTS "Users can insert themselves to expected users" ON video_expected_users;
CREATE POLICY "Users can insert themselves to expected users" ON video_expected_users
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Политика: пользователи могут удалять себя из списка ожидающих
DROP POLICY IF EXISTS "Users can delete themselves from expected users" ON video_expected_users;
CREATE POLICY "Users can delete themselves from expected users" ON video_expected_users
  FOR DELETE USING (auth.uid() = user_id);

-- Создание таблицы для чата во время премьер
CREATE TABLE IF NOT EXISTS video_chat_messages (
  id SERIAL PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Создание индексов для чата
CREATE INDEX IF NOT EXISTS idx_video_chat_messages_video_id ON video_chat_messages(video_id);
CREATE INDEX IF NOT EXISTS idx_video_chat_messages_created_at ON video_chat_messages(created_at);

-- Настройка RLS для чата
ALTER TABLE video_chat_messages ENABLE ROW LEVEL SECURITY;

-- Политика: пользователи могут видеть все сообщения чата
DROP POLICY IF EXISTS "Users can view all chat messages" ON video_chat_messages;
CREATE POLICY "Users can view all chat messages" ON video_chat_messages
  FOR SELECT USING (true);

-- Политика: пользователи могут отправлять сообщения
DROP POLICY IF EXISTS "Users can insert chat messages" ON video_chat_messages;
CREATE POLICY "Users can insert chat messages" ON video_chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id); 

-- Подписки на автора (канал)
create table if not exists author_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  author_id uuid references users(id) on delete cascade,
  created_at timestamp with time zone default now(),
  unique (user_id, author_id)
); 