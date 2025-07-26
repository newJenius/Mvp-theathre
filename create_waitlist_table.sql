-- Create waitlist table
CREATE TABLE IF NOT EXISTS waitlist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'invited', 'registered')),
    invited_at TIMESTAMP WITH TIME ZONE,
    registered_at TIMESTAMP WITH TIME ZONE
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist(status);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist(created_at);

-- Add comment to table
COMMENT ON TABLE waitlist IS 'Table for storing users who requested invites to the platform';

-- Add comments to columns
COMMENT ON COLUMN waitlist.id IS 'Unique identifier for the waitlist entry';
COMMENT ON COLUMN waitlist.email IS 'Email address of the user requesting an invite';
COMMENT ON COLUMN waitlist.created_at IS 'Timestamp when the user joined the waitlist';
COMMENT ON COLUMN waitlist.status IS 'Current status: pending, invited, or registered';
COMMENT ON COLUMN waitlist.invited_at IS 'Timestamp when the user was invited';
COMMENT ON COLUMN waitlist.registered_at IS 'Timestamp when the user registered'; 