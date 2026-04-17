✅ SUPABASE CREDENTIALS RECEIVED
═══════════════════════════════════════════════════════════════

Great! You have your Supabase account set up. Now follow these steps:

📝 YOUR CREDENTIALS
═════════════════════════════════════════════════════════════════

Project URL:
https://thqcgfhfqgjxttboydou.supabase.co

Anon Public Key:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRocWNnZmhmcWdqeHR0Ym95ZG91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MTYxMzcsImV4cCI6MjA5MTk5MjEzN30.djMQ9jP23LQl9faFGpRZ2JJSdXPKqPyfVmh_2eMA-Y0

✅ STEP 1: CREATE DATABASE TABLES
═════════════════════════════════════════════════════════════════

1. Go to: https://thqcgfhfqgjxttboydou.supabase.co
2. Sign in with your Supabase account
3. Click: "SQL Editor" (left sidebar)
4. Click: "New Query"
5. Copy ENTIRE content from: d:\vk_bot_env\SUPABASE_SCHEMA.sql
6. Paste into the SQL Editor
7. Click: "Run" button (green triangle)
8. Result: All 6 tables created! ✅

✅ STEP 2: GET VK CREDENTIALS
═════════════════════════════════════════════════════════════════

You need 3 things from VK:

1. VK_TOKEN (Access Token)
   - Go to: Your VK Community
   - Settings → Work with API
   - Create new access token
   - Copy the token (100+ characters)

2. GROUP_ID (Community/Group ID)
   - Go to: Community Settings
   - Look for "Community ID" or "Group ID"
   - Just a number (e.g., 237363984)

3. VK_CONFIRMATION_TOKEN (Confirmation String)
   - Go to: API Usage → Longpoll Settings
   - Find: "Confirmation string"
   - Copy it

✅ STEP 3: ADD ENVIRONMENT VARIABLES TO NETLIFY
═════════════════════════════════════════════════════════════════

You need to add 5 environment variables to Netlify:

1. Go to: https://netlify.com
2. Sign in
3. Click: Your site name
4. Go to: Site settings → Build & deploy → Environment
5. Click: "Edit variables"
6. Add these 5 variables:

   Variable Name: VK_TOKEN
   Value: [Your VK bot token]

   Variable Name: GROUP_ID
   Value: [Your VK group ID]

   Variable Name: SUPABASE_URL
   Value: https://thqcgfhfqgjxttboydou.supabase.co

   Variable Name: SUPABASE_KEY
   Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRocWNnZmhmcWdqeHR0Ym95ZG91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MTYxMzcsImV4cCI6MjA5MTk5MjEzN30.djMQ9jP23LQl9faFGpRZ2JJSdXPKqPyfVmh_2eMA-Y0

   Variable Name: VK_CONFIRMATION_TOKEN
   Value: [Your VK confirmation string]

7. Click: "Save"

✅ STEP 4: DEPLOY TO NETLIFY
═════════════════════════════════════════════════════════════════

Push your code to GitHub (Netlify will auto-deploy):

1. Terminal: cd d:\vk_bot_env
2. Terminal: git add .
3. Terminal: git commit -m "Add Supabase credentials and public folder"
4. Terminal: git push origin main
5. Wait: ~2-3 minutes
6. Result: Green checkmark on Netlify ✅

✅ STEP 5: GET YOUR NETLIFY SITE URL
═════════════════════════════════════════════════════════════════

After deployment:

1. Go to: Netlify.com → Your site
2. Look for: "Site URL" (at top)
3. Example: https://your-site-name.netlify.app
4. Copy this URL

✅ STEP 6: CONFIGURE VK WEBHOOK
═════════════════════════════════════════════════════════════════

Connect your VK community to Netlify:

1. Go to: Your VK Community Settings
2. API Usage → Longpoll Settings → Webhook
3. In "Callback URL" paste:
   https://YOUR_SITE_NAME.netlify.app/.netlify/functions/vk-webhook

4. API Version: 5.131 (or higher)
5. Enable Events:
   ☐ Message new
   ☐ Message reply
6. Click: "Confirm"
7. Click: "Save"

✅ STEP 7: TEST YOUR BOT
═════════════════════════════════════════════════════════════════

1. Open your VK community chat
2. Send: Hello
   Expected: Bot responds!

3. Send: 📅 Schedule
   Expected: "Empty schedule" or shows classes

4. Send: /add Math 1 10:30 12:05
   Expected: "Class 'Math' added!"

5. Send: 📅 Schedule
   Expected: Shows Math class

6. Send: ❓ Help
   Expected: Shows all commands

If all work → YOU'RE LIVE! 🎉

📋 CHECKLIST
═════════════════════════════════════════════════════════════════

Database:
☐ Ran SQL from SUPABASE_SCHEMA.sql
☐ All tables created
☐ Can see tables in Supabase

VK Credentials:
☐ VK_TOKEN (100+ characters)
☐ GROUP_ID (just a number)
☐ VK_CONFIRMATION_TOKEN (string)

Netlify Environment:
☐ All 5 variables added
☐ Values are correct (copy-paste carefully!)
☐ Saved variables

Deployment:
☐ Pushed code to GitHub
☐ Netlify auto-deployed
☐ Deploy shows green checkmark

VK Webhook:
☐ Callback URL set correctly
☐ Confirmation clicked
☐ Saved

Testing:
☐ Bot responds to messages
☐ Commands work (/add, /deadline)
☐ Bot is LIVE! 🎉

🎯 TIMELINE
═════════════════════════════════════════════════════════════════

Step 1 (Database): 5 minutes
Step 2 (VK Creds): 10 minutes
Step 3 (Netlify Vars): 5 minutes
Step 4 (Deploy): 5 minutes
Step 5 (Get URL): 1 minute
Step 6 (VK Webhook): 3 minutes
Step 7 (Test): 5 minutes

TOTAL: ~34 minutes to LIVE! 🚀

🚨 IMPORTANT SECURITY NOTES
═════════════════════════════════════════════════════════════════

✅ DO:
• Keep your VK_TOKEN secret
• Don't share SUPABASE_KEY publicly
• Only add credentials to Netlify (not GitHub)
• Rotate tokens if compromised

❌ DON'T:
• Commit .env file to GitHub
• Share your credentials in chat
• Put secrets in code comments
• Use test credentials in production

🎉 YOU'RE READY!
═════════════════════════════════════════════════════════════════

You have:
✅ Supabase credentials
✅ Database schema
✅ Netlify account
✅ VK community

Now follow the 7 steps above and you'll have a LIVE VK bot
running 24/7 on Netlify servers!

Questions? Read TROUBLESHOOTING.md

════════════════════════════════════════════════════════════════

            👉 START NOW: Follow Steps 1-7 Above

                   Estimated Time: 34 minutes

                Result: LIVE VK BOT on Netlify! 🚀

════════════════════════════════════════════════════════════════
