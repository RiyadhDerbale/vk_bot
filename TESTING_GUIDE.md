# 🧪 VK Bot - Quick Testing Guide

## Ready to Test!

Your bot is now fully deployed with all features from the Python version. Here's how to test everything:

### Step 1: Send Your First Message

Send **"hello"** or **"привет"** to your bot and you should get:

- ✅ Greeting with your name
- ✅ Main keyboard with 6 buttons
- ✅ Instant response (< 2 seconds)

### Step 2: Test Schedule Management

**Test: View Empty Schedule**

- Click `📅 Schedule` button
- Expected: "Your schedule is empty"

**Test: Add a Class**

- Click `➕ Add class` for instructions
- Send: `/add Math 1 10:30 12:05`
- Expected: "Class 'Math' added!"
- Then click `📅 Schedule` to verify

**Test: View Schedule**

- Click `📅 Schedule` button
- Expected: See "Math • 10:30-12:05 — Math" (Tuesday)

**Test: Delete a Class**

- Send: `/delete Math 1 10:30`
- Expected: "Class 'Math' deleted!"

### Step 3: Test Task Management

**Test: Add a Task**

- Click `➕ Add deadline` for instructions
- Send: `/deadline Report 2025-12-20 12:00 2`
- Expected: "Task 'Report' saved!"

**Test: View Tasks**

- Click `📝 My tasks` button
- Expected: See your task with "Due: 2025-12-20 12:00", "Remind 2 day(s) before"
- You should see a ✅ Done button

**Test: Complete Task**

- Click the ✅ Done button on any task
- Expected: "Task marked as done!"
- Click `📝 My tasks` again - task should be gone (only pending shown)

### Step 4: Test Settings

**Test: View Settings**

- Click `⚙️ Settings` button
- Expected: See "Reminder offset: 60 minutes"
- Settings keyboard with 🔙 Back button

**Test: Return to Menu**

- Click `🔙 Back` button
- Expected: Return to main keyboard

### Step 5: Test Help

**Test: Get Help**

- Click `❓ Help` button
- Expected: List of all commands with examples

### Step 6: Test Language Detection

**Test: Russian**

- Send: "привет" (hello in Russian)
- Expected: All responses in Russian

**Test: English**

- Send: "hello"
- Expected: All responses in English

### Step 7: Test Error Handling

**Test: Invalid Day**

- Send: `/add Math 10 10:30 12:05`
- Expected: "Day must be 0 (Mon) to 6 (Sun)"

**Test: Invalid Deadline Format**

- Send: `/deadline Report invalid 2`
- Expected: Error message about format

**Test: Empty Fields**

- Send: `/add`
- Expected: Helpful instruction message

## 📊 Database Verification

To verify data is being saved in Supabase:

1. Go to https://supabase.com/dashboard
2. Open your project
3. Check `users` table
   - Should have rows with your VK ID, language, notify_offset
4. Check `schedule` table
   - Should have your classes (subject, day, start_time, end_time)
5. Check `tasks` table
   - Should have your tasks (task, due_date, remind_days, done=false/true)

## 🔔 Reminder Testing (Advanced)

The bot checks for reminders every 5 minutes. To test:

1. Add a class for today at a time 60-90 minutes from now
2. Wait up to 5 minutes
3. Should receive a reminder message when time window hits
4. Check `reminders` table to verify reminder was logged

Example:

- Current time: 3:00 PM
- Add class at 4:15 PM (75 minutes away)
- Should get reminder around 3:50-4:00 PM (60-90 min before)

## ✅ Checklist

- [ ] Bot responds to messages instantly
- [ ] Schedule buttons work (📅)
- [ ] Can add classes with /add
- [ ] Can view schedule
- [ ] Can delete classes with /delete
- [ ] Can add tasks with /deadline
- [ ] Can view tasks
- [ ] Can mark tasks done with button
- [ ] Settings show and go back
- [ ] Help shows all commands
- [ ] Russian responses work
- [ ] English responses work
- [ ] Database has your data in users table
- [ ] Database has your classes in schedule table
- [ ] Database has your tasks in tasks table

## 🐛 Troubleshooting

**Bot doesn't respond:**

1. Check Netlify logs: https://app.netlify.com/sites/[YOUR-SITE]/functions
2. Verify VK_TOKEN, SUPABASE_URL, SUPABASE_KEY are set in Netlify
3. Verify VK webhook URL is correct in VK settings
4. Try redeploying: `git push origin main`

**Database errors:**

1. Check Supabase status page
2. Verify SUPABASE_URL and SUPABASE_KEY in Netlify
3. Run SQL schema in Supabase (SUPABASE_SCHEMA.sql)

**Wrong language:**

1. The bot auto-detects based on Cyrillic characters
2. To force English: Send English text only
3. To force Russian: Send Russian text with Cyrillic

**Reminders not working:**

1. Add a test class for 5-10 minutes from now
2. Check check-reminders function logs on Netlify
3. Verify database has the schedule entry
4. Function runs every 5 minutes, so max wait is 5 min

## 📞 Support Commands

Try these for hidden features:

- `/help` - Full command list
- Type "hello" - Greeting
- Type "привет" - Russian greeting
- Click any button - See what happens!

---

**Happy Testing! 🎉**

Your bot is production-ready. Once you verify all features work, you can share it with users!
