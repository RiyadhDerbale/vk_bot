# 🚀 QUICK START - VK Bot on Netlify (5 minutes)

## Step 1️⃣ Create Supabase Database (2 min)

1. Go to https://supabase.com → Sign up
2. Create new project → Name it "vk-bot" → Choose region closest to you
3. Wait for project to be ready
4. Go to **SQL Editor** → New Query
5. Copy ALL code from `SUPABASE_SCHEMA.sql` file
6. Paste and run (click ▶️ button)
7. Go to **Settings → API Keys**:
   - Copy `Project URL` → Save as `SUPABASE_URL`
   - Copy the key under `anon public` → Save as `SUPABASE_KEY`

## Step 2️⃣ Get VK Bot Token (2 min)

1. Open your VK Community
2. Go to **Community Settings → Work with API**
3. Create new access token (with all permissions) → Copy as `VK_TOKEN`
4. Copy your **Group ID** → Save as `GROUP_ID`
5. Go to **API Usage → Longpoll Settings**:
   - Enable "Bot API"
   - Copy the **Confirmation string** → Save as `VK_CONFIRMATION_TOKEN`

## Step 3️⃣ Deploy to Netlify (1 min)

### Option A: Quick Deploy (Easiest)

```powershell
cd d:\vk_bot_env
npm install
netlify login
netlify deploy --prod
```

### Option B: Using GitHub (Recommended for updates)

1. Create GitHub account
2. Create new public repository "vk-bot"
3. Run:

```powershell
cd d:\vk_bot_env
git init
git add .
git commit -m "VK Bot Netlify"
git remote add origin https://github.com/YOUR_USERNAME/vk-bot.git
git branch -M main
git push -u origin main
```

4. Go to https://netlify.com:
   - Click "New site from Git"
   - Select your vk-bot repo
   - Click Deploy

## Step 4️⃣ Add Environment Variables (30 sec)

On Netlify Dashboard:

1. Your site → **Site settings → Build & deploy → Environment**
2. Click "Edit variables"
3. Add these:

```
VK_TOKEN = your_vk_token_here
GROUP_ID = your_group_id_here
SUPABASE_URL = https://xxxxx.supabase.co
SUPABASE_KEY = your_key_here
VK_CONFIRMATION_TOKEN = your_confirmation_string_here
```

4. Save

## Step 5️⃣ Connect VK Webhook (1 min)

In VK Community Settings → **API Usage → Longpoll Settings → Webhook**:

1. **Callback URL**: `https://YOUR_NETLIFY_SITE.netlify.app/.netlify/functions/vk-webhook`
2. **API Version**: 5.131
3. **Enable Events**:
   - ✅ Message new
   - ✅ Message reply
4. Click "Confirm" button
5. Click "Save"

## ✅ DONE!

Your bot is now LIVE! 🎉

### Test it:

1. Message your VK community
2. Bot should reply instantly!
3. Try commands:
   - `/add Math 1 10:30 12:05`
   - `/deadline Report 2025-12-20 23:59 2`
   - `📅 Schedule`
   - `❓ Help`

### Monitor it:

Go to Netlify Dashboard → **Functions** → See real-time logs and usage

---

## ⚠️ Common Mistakes

❌ **Confirmation failed** → Check VK_CONFIRMATION_TOKEN spelling
❌ **Bot doesn't respond** → Check webhook URL is correct (copy-paste it)
❌ **Database errors** → Verify SUPABASE_URL and SUPABASE_KEY are correct
❌ **"Function not found"** → Wait 2 minutes after deploy, then refresh

---

## 🎯 Where is my bot running?

Your bot code is now on Netlify servers:

- **vk-webhook.mjs** - Handles messages (runs instantly)
- **check-reminders.mjs** - Sends reminders (runs every 5 min)
- **Supabase** - Stores all data (replaces your SQLite)

It's 100% serverless - no server to maintain! ✨

---

**Next:** Check `DEPLOYMENT_GUIDE.md` for advanced customization
