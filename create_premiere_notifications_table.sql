-- Create table for storing email notifications for premieres
CREATE TABLE IF NOT EXISTS premiere_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(video_id, email)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_premiere_notifications_video_id ON premiere_notifications(video_id);
CREATE INDEX IF NOT EXISTS idx_premiere_notifications_email ON premiere_notifications(email); 