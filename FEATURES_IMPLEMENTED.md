# VK Bot - Complete Feature List

## ✅ All Features from Python Bot Implemented in JavaScript/Netlify

### 📅 Schedule Management
- **View Schedule** - `📅 Schedule` button
  - Shows all classes for the week sorted by day
  - Format: `Day • Start-End — Subject`
  - Bilingual support (English & Russian)

- **Add Class** - `/add <subject> <day(0-6)> <HH:MM> <HH:MM>`
  - Days: 0=Monday, 1=Tuesday, ..., 6=Sunday
  - Example: `/add Math 1 10:30 12:05`
  - Stores in Supabase with user_id

- **Delete Class** - `/delete <subject> <day> <HH:MM>`
  - Example: `/delete Math 1 10:30`
  - Removes from database

### 📝 Task/Deadline Management
- **View Tasks** - `📝 My tasks` button
  - Shows all pending tasks with due dates
  - Displays: Task name, due date, reminder offset
  - Interactive "✅ Done" button for each task

- **Add Task/Deadline** - `/deadline <task> <YYYY-MM-DD HH:MM> <days>`
  - Example: `/deadline Report 2025-12-20 12:00 2`
  - Sets reminders X days before deadline
  - Stores in Supabase tasks table

- **Complete Task** - Click "✅ Done" button
  - Marks task as done
  - Updates database with completion timestamp
  - Uses payload/callback system

### ⚙️ Settings
- **Reminder Offset** - `⚙️ Settings` button
  - Shows current notification offset (default: 60 minutes)
  - Allows users to adjust when reminders are sent
  - Stores in Supabase users table
  - Bilingual interface

### 🌐 Language Support
- **Auto-Detection** - Automatically detects Russian or English
  - Russian detected: Characters а-яА-ЯёЁ
  - Stores preference in database
  - All responses in user's language

- **Languages Implemented:**
  - ✅ English (en)
  - ✅ Russian (ru)
  - Easy to add more languages

### 💬 Keyboard Navigation
- **Main Keyboard** (6 buttons)
  1. 📅 Schedule - View all classes
  2. ➕ Add class - Instructions for /add command
  3. 📝 My tasks - View pending deadlines
  4. ➕ Add deadline - Instructions for /deadline command
  5. ⚙️ Settings - Reminder configuration
  6. ❓ Help - Show all commands

- **Settings Keyboard**
  - Current offset display
  - 🔙 Back button to main menu

- **Task Keyboard** (Inline)
  - ✅ Done button for each task
  - Uses payload system for inline responses

### 📚 Help & Responses
- **Help Command** - `/help` or `❓ Help` button
  - Shows all available commands
  - Examples for each command
  - Bilingual

- **Default Responses**
  - Greeting when user says "hello", "hi", "привет"
  - Friendly messages for all operations
  - Error handling with user-friendly messages

### 🔔 Reminder System (in check-reminders.mjs)
- **Class Reminders**
  - Sends 60-90 minutes before class
  - Based on schedule and day of week
  - Checks every 5 minutes via Netlify cron

- **Deadline Reminders**
  - Sends X days before due date
  - Configurable via /deadline command
  - Prevents duplicate reminders using reminders table

### 🛡️ Error Handling
- **Graceful Failures**
  - Try-catch blocks on all database operations
  - Friendly error messages to users
  - Console logging for debugging
  - Returns sensible defaults on error

- **Database Errors**
  - Connection failures handled
  - Missing data returns empty arrays/defaults
  - User operations fail gracefully

### 📊 Database Tables
- **users** - VK profiles
  - vk_id (primary key)
  - language (en/ru)
  - notify_offset (minutes)
  - name, created_at, updated_at

- **schedule** - Classes
  - user_id, subject, day, start_time, end_time
  - Indexed by user_id and day for fast queries

- **tasks** - Deadlines/To-Do items
  - user_id, task, due_date, remind_days, done
  - Tracks completion with completed_at timestamp

- **reminders** - Sent reminders log
  - Prevents duplicate reminders
  - Used by check-reminders.mjs

### 🚀 Deployment
- **Platform:** Netlify Serverless Functions
- **Database:** Supabase PostgreSQL
- **Runtime:** Node.js 18+ with ESBuild
- **Auto-deploy:** GitHub → Netlify webhook

### 📝 Command Reference

| Command | Format | Example |
|---------|--------|---------|
| Add Class | `/add <subject> <day> <start> <end>` | `/add Math 1 10:30 12:05` |
| Delete Class | `/delete <subject> <day> <start>` | `/delete Math 1 10:30` |
| Add Task | `/deadline <task> <date> <days>` | `/deadline Report 2025-12-20 12:00 2` |
| Help | `❓ Help` button | - |
| Schedule | `📅 Schedule` button | - |
| Tasks | `📝 My tasks` button | - |
| Settings | `⚙️ Settings` button | - |

## ✨ Features Not Yet Implemented (Optional Enhancements)
- [ ] ICS file upload/parsing
- [ ] Attendance logging
- [ ] Study time tracking
- [ ] Custom notification sounds
- [ ] Group chat support
- [ ] File attachments
- [ ] Recurring tasks

## 📋 Status
✅ **PRODUCTION READY**
- All core features working
- Database initialized
- Webhooks configured
- Error handling complete
- Bilingual support active
- Ready for user testing

