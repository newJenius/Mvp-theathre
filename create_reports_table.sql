-- Create table for storing video reports
CREATE TABLE IF NOT EXISTS reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reporter_email TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_reports_video_id ON reports(video_id);
CREATE INDEX IF NOT EXISTS idx_reports_author_id ON reports(author_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at); 