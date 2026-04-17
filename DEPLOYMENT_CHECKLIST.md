# ✅ DEPLOYMENT CHECKLIST

Use this checklist to ensure everything is ready before deploying.

## Pre-Deployment (Before You Start)

- [ ] Read `00_START_HERE.txt`
- [ ] Read `QUICK_START.md`
- [ ] Have Supabase account ready
- [ ] Have VK community ready
- [ ] Have Netlify account ready
- [ ] Have GitHub account (optional but recommended)

## Supabase Setup

- [ ] Created Supabase project
- [ ] Project is in ready state
- [ ] Opened SQL Editor
- [ ] Copied entire SUPABASE_SCHEMA.sql
- [ ] Pasted into SQL Editor
- [ ] Clicked "Run" button
- [ ] No SQL errors shown
- [ ] All tables created (check Table Editor)
- [ ] Went to Settings → API Keys
- [ ] Copied Project URL → `SUPABASE_URL`
- [ ] Copied anon public key → `SUPABASE_KEY`
- [ ] Saved both values securely

## VK Bot Setup

- [ ] Opened VK Community
- [ ] Went to Community Settings
- [ ] Found "Work with API" section
- [ ] Created new access token
- [ ] Token appears (100+ characters)
- [ ] Copied token → `VK_TOKEN`
- [ ] Found Group ID number
- [ ] Copied Group ID → `GROUP_ID`
- [ ] Went to API Usage → Longpoll Settings
- [ ] Enabled "Bot API"
- [ ] Generated/found confirmation string
- [ ] Copied confirmation string → `VK_CONFIRMATION_TOKEN`
- [ ] Saved all three values

## Local Setup

- [ ] Opened terminal
- [ ] Navigated to `d:\vk_bot_env`
- [ ] Ran `npm install`
- [ ] No errors shown
- [ ] `node_modules` folder created
- [ ] Can see `netlify` folder exists
- [ ] Can see `netlify/functions/` exists
- [ ] Can see `vk-webhook.mjs` exists
- [ ] Can see `check-reminders.mjs` exists

## Netlify Deployment

### Option A: CLI Deploy

- [ ] Ran `netlify login`
- [ ] Successfully logged in
- [ ] Ran `netlify deploy --prod`
- [ ] Shows "Published" (green checkmark)
- [ ] Site URL shows (e.g., https://xxx.netlify.app)
- [ ] Copied site URL

### Option B: GitHub Deploy

- [ ] Created GitHub account
- [ ] Created new repository "vk-bot"
- [ ] Repository is public
- [ ] Ran `git init` in project folder
- [ ] Ran `git add .`
- [ ] Ran `git commit -m "VK Bot"`
- [ ] Ran `git remote add origin https://github.com/YOUR/vk-bot.git`
- [ ] Ran `git branch -M main`
- [ ] Ran `git push -u origin main`
- [ ] Code appeared on GitHub
- [ ] Went to netlify.com
- [ ] Clicked "New site from Git"
- [ ] Selected vk-bot repository
- [ ] Netlify auto-detected settings
- [ ] Clicked "Deploy"
- [ ] Shows "Published" (green checkmark)

## Environment Variables

On Netlify Dashboard:

- [ ] Went to Site settings
- [ ] Found Build & deploy → Environment
- [ ] Clicked "Edit variables"
- [ ] Added `VK_TOKEN`
- [ ] Added `GROUP_ID`
- [ ] Added `SUPABASE_URL`
- [ ] Added `SUPABASE_KEY`
- [ ] Added `VK_CONFIRMATION_TOKEN`
- [ ] All 5 variables showing in list
- [ ] Clicked "Save"
- [ ] Dashboard shows variables saved
- [ ] Triggered new deploy OR waited for auto-deploy

## Functions Verification

On Netlify:

- [ ] Went to Site → Functions
- [ ] Can see `vk-webhook` function
- [ ] Can see `check-reminders` function
- [ ] Both show "Build Successful"
- [ ] Can click on each function to see logs

## VK Webhook Configuration

In VK Community Settings:

- [ ] Went to API Usage → Longpoll Settings
- [ ] Found Webhook section
- [ ] In "Callback URL" field, pasted: `https://YOUR_SITE.netlify.app/.netlify/functions/vk-webhook`
- [ ] Set API Version to `5.131` or higher
- [ ] Checked these events:
  - [ ] Message new
  - [ ] Message reply
- [ ] Clicked "Confirm" button
- [ ] Shows success message
- [ ] Clicked "Save" button
- [ ] Webhook configuration saved

## Testing Messages

Test in your VK Community:

- [ ] Send: `Hello`
- [ ] Bot responds within 2 seconds
- [ ] Response is in your language
- [ ] Send: `❓ Help`
- [ ] See list of commands
- [ ] Send: `📅 Schedule`
- [ ] See "empty" message or schedule
- [ ] Send: `/add Math 1 10:30 12:05`
- [ ] See "Class added!" message
- [ ] Send: `📅 Schedule` again
- [ ] See Math class in list
- [ ] Send: `/deadline Test 2025-12-25 23:59 2`
- [ ] See "Task saved!" message
- [ ] Send: `📝 My tasks`
- [ ] See Test task in list
- [ ] Send: `⚙️ Settings`
- [ ] See settings menu

## Monitoring Setup

- [ ] On Netlify: Site → Functions → Logs
- [ ] Can see recent invocations
- [ ] No error messages visible
- [ ] Response times look reasonable (<500ms)
- [ ] On Supabase: Table Editor → users
- [ ] Can see your test user created
- [ ] Can see language detected
- [ ] On Supabase: Table Editor → schedule
- [ ] Can see Math class added
- [ ] On Supabase: Table Editor → tasks
- [ ] Can see Test task added

## Reminders Test

- [ ] On Supabase: Add class for TODAY
- [ ] Set start time to 1 hour from now
- [ ] Wait 5 minutes (or trigger manually)
- [ ] Check Netlify → Functions → check-reminders logs
- [ ] Should see invocation in last 10 minutes
- [ ] In VK, should receive reminder message
- [ ] If no reminder, check TIMEZONE_OFFSET in function

## Local Testing (Optional)

- [ ] Ran `netlify dev`
- [ ] Server started on localhost:8888
- [ ] Visited http://localhost:8888 in browser
- [ ] Saw Netlify page or error (normal)
- [ ] Tested webhook function locally
- [ ] Function responded correctly
- [ ] Stopped dev server (Ctrl+C)

## Final Verification

- [ ] Bot is LIVE on Netlify ✅
- [ ] Webhook configured in VK ✅
- [ ] Bot responds to messages ✅
- [ ] Database has all data ✅
- [ ] Environment variables set ✅
- [ ] Functions deployed ✅
- [ ] No errors in logs ✅
- [ ] Reminders working (or will work) ✅

## After Deployment

- [ ] Shared bot link with friends
- [ ] Friends can message and get responses
- [ ] Bookmark Netlify dashboard (for monitoring)
- [ ] Save credentials securely (password manager)
- [ ] Set calendar reminder to upgrade when needed
- [ ] Read DEPLOYMENT_GUIDE.md for customization

## Troubleshooting Checklist

If something doesn't work:

- [ ] Checked TROUBLESHOOTING.md
- [ ] Reviewed Netlify function logs
- [ ] Verified all environment variables
- [ ] Confirmed webhook URL is correct
- [ ] Checked VK confirmation in API settings
- [ ] Verified Supabase credentials
- [ ] Tried redeploying
- [ ] Tried testing locally first
- [ ] Checked that all 5 env vars are set
- [ ] Waited 2+ minutes after changing env vars

## Success! 🎉

If you've checked all boxes:

✅ Your VK bot is LIVE on Netlify
✅ Responding to messages in real-time
✅ Storing data in Supabase
✅ Sending automatic reminders
✅ Costing you $0 (until you scale)
✅ Running 24/7 reliably
✅ Ready for production use

---

**Congratulations! You've successfully deployed a serverless VK bot!** 🚀

Now you can:

- Customize messages and commands
- Add new features
- Scale to thousands of users
- Update without downtime
- Monitor performance
- Backup data
- Sleep well (bot runs without you!)

**Next Steps:** Read `DEPLOYMENT_GUIDE.md` for customization tips.
