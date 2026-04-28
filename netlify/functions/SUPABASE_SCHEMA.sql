-- Supabase SQL Schema for VK Bot
-- Copy and paste this into Supabase SQL Editor

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  vk_id BIGINT UNIQUE NOT NULL,
  name VARCHAR(255),
  language VARCHAR(2) DEFAULT 'en',
  notify_offset INTEGER DEFAULT 60,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create schedule table
CREATE TABLE IF NOT EXISTS schedule (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(vk_id) ON DELETE CASCADE,
  subject VARCHAR(255) NOT NULL,
  day INTEGER NOT NULL,
  start_time VARCHAR(5) NOT NULL,
  end_time VARCHAR(5) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(vk_id) ON DELETE CASCADE,
  task VARCHAR(500) NOT NULL,
  due_date TIMESTAMP NOT NULL,
  remind_days INTEGER DEFAULT 1,
  done BOOLEAN DEFAULT FALSE,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- Create reminders table (for tracking sent reminders)
CREATE TABLE IF NOT EXISTS reminders (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(vk_id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  reference_id BIGINT,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create attendance table (optional)
CREATE TABLE IF NOT EXISTS attendance (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(vk_id) ON DELETE CASCADE,
  class_id BIGINT REFERENCES schedule(id) ON DELETE CASCADE,
  attended BOOLEAN DEFAULT TRUE,
  date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create study_logs table (optional)
CREATE TABLE IF NOT EXISTS study_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(vk_id) ON DELETE CASCADE,
  subject VARCHAR(255),
  duration_minutes INTEGER,
  date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_users_vk_id ON users(vk_id);
CREATE INDEX idx_schedule_user_id ON schedule(user_id);
CREATE INDEX idx_schedule_day ON schedule(day);
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_done ON tasks(done);
CREATE INDEX idx_reminders_user_id ON reminders(user_id);
CREATE INDEX idx_attendance_user_id ON attendance(user_id);
CREATE INDEX idx_study_logs_user_id ON study_logs(user_id);

-- Enable RLS (Row Level Security) for security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_logs ENABLE ROW LEVEL SECURITY;

-- Create policies (allow service role to access)
CREATE POLICY "Allow service role" ON users
  FOR ALL USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role" ON schedule
  FOR ALL USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role" ON tasks
  FOR ALL USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role" ON reminders
  FOR ALL USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role" ON attendance
  FOR ALL USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role" ON study_logs
  FOR ALL USING (true)
  WITH CHECK (true);
  