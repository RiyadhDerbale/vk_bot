# VK Personal Assistant Bot - Netlify Serverless Deployment

A 100% complete VKontakte bot running on Netlify serverless functions with Supabase database.

## 🚀 Features

✅ **Bilingual Support** - English & Russian (auto-detects)
✅ **Schedule Management** - Add classes, view timetable
✅ **Task Tracking** - Create deadlines with reminders
✅ **Automatic Reminders** - 60-90 min before classes, deadline notifications
✅ **Webhook Integration** - Real-time VK message handling
✅ **Cloud Database** - Supabase (PostgreSQL)
✅ **Serverless** - No server costs, pay per use
✅ **Always Online** - Netlify ensures 99.9% uptime

## 📋 Prerequisites

1. **VK Community** (VKontakte group)
2. **Netlify Account** (free)
3. **Supabase Account** (free tier available)
4. **Node.js 18+** (local development)

## 🔧 Complete Setup Steps

### Step 1: Create Supabase Database

1. Go to [supabase.com](https://supabase.com) → Sign up
2. Create new project
3. Go to **SQL Editor**
4. Copy entire content from `SUPABASE_SCHEMA.sql`
5. Run the SQL query
6. Go to **Settings → API**:
   - Copy `Project URL` (SUPABASE_URL)
   - Copy `anon public` key (SUPABASE_KEY)

### Step 2: Get VK Bot Credentials

1. Go to VK Community settings → **API Usage**
2. Create access token (for community management)
3. Copy:
   - **Access Token** (VK_TOKEN)
   - **Group ID** (GROUP_ID)
4. Go to **Longpoll Settings**:
   - Enable Bot API
   - Create confirmation string (copy for VK_CONFIRMATION_TOKEN)

### Step 3: Deploy to Netlify

#### Option A: Using Netlify CLI

```bash
# Clone this repo or create new folder
cd d:\vk_bot_env

# Install dependencies
npm install

# Login to Netlify
netlify login

# Deploy
netlify deploy --prod
```

#### Option B: GitHub + Netlify (Recommended)

1. Push to GitHub:

```bash
git init
git add .
git commit -m "VK Bot - Netlify Serverless"
git remote add origin https://github.com/YOUR_USERNAME/vk-bot.git
git branch -M main
git push -u origin main
```

2. On [netlify.com](https://netlify.com):
   - Click "New site from Git"
   - Select your repository
   - Netlify auto-detects settings
   - Click Deploy

### Step 4: Set Environment Variables

On Netlify:

1. Site settings → **Build & deploy → Environment**
2. Add variables:

```
VK_TOKEN=your_vk_token_here
GROUP_ID=your_group_id_here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_key_here
VK_CONFIRMATION_TOKEN=your_confirmation_string_here
```

### Step 5: Configure VK Webhook

In VK Community → **API Usage → Longpoll Settings → Webhook**:

1. **Callback URL**: `https://your-site.netlify.app/.netlify/functions/vk-webhook`
2. **API Version**: 5.131 or higher
3. **Enabled Events**:
   - ✅ Message new
   - ✅ Message reply
4. **Confirmation token**: Use same as VK_CONFIRMATION_TOKEN
5. Click "Confirm" and "Save"

### Step 6: Set Up Scheduled Reminders

Create Netlify Cron Job in `netlify/functions/check-reminders.mjs`:

Already included! The function runs automatically. To test:

```bash
# Local test
netlify functions:invoke check-reminders
```

## 📱 User Commands

| Command         | Example                               | Description                |
| --------------- | ------------------------------------- | -------------------------- |
| 📅 Schedule     | Click button                          | View all classes           |
| ➕ Add class    | `/add Math 1 10:30 12:05`             | Add single class (day 0-6) |
| 📝 My tasks     | Click button                          | View pending tasks         |
| ➕ Add deadline | `/deadline Report 2025-12-20 23:59 2` | Create task with deadline  |
| ✅ Done         | Click button                          | Mark task complete         |
| ⚙️ Settings     | Click button                          | Manage preferences         |
| ❓ Help         | Click button                          | Show all commands          |

## 🗂️ Project Structure

```
vk-bot-netlify/
├── netlify/
│   └── functions/
│       ├── vk-webhook.mjs          # Main message handler
│       └── check-reminders.mjs      # Scheduled reminder checker
├── netlify.toml                     # Netlify config
├── package.json                     # Dependencies
├── .gitignore
├── SUPABASE_SCHEMA.sql              # Database schema
└── README.md
```

## 🔌 How It Works

```
User sends message in VK
         ↓
VK sends webhook to Netlify
         ↓
vk-webhook.mjs processes message
         ↓
Bot queries Supabase
         ↓
Bot sends reply via VK API
         ↓
check-reminders.mjs (every 5 min)
         ↓
Checks for upcoming classes/deadlines
         ↓
Sends reminders via VK API
```

## 🚨 Troubleshooting

### "Confirmation failed" error

- Check VK_CONFIRMATION_TOKEN is set correctly
- Ensure webhook URL is accessible (check Netlify status)
- Retry webhook confirmation in VK settings

### Bot not responding

- Check Netlify function logs: `Site settings → Functions → Logs`
- Verify SUPABASE_URL and SUPABASE_KEY are correct
- Test webhook: `netlify functions:invoke vk-webhook`

### Database errors

- Verify Supabase schema is created (check SQL Editor)
- Check SUPABASE_KEY is "anon public" key, not secret
- Test connection: `netlify functions:invoke check-reminders`

### Reminders not working

- Ensure `check-reminders.mjs` is deployed (check Functions)
- Verify timezone offset (currently set for Asia/Novosibirsk)
- Check Netlify logs for errors

## 💡 Customization

### Change Timezone

Edit `netlify/functions/check-reminders.mjs`:

```javascript
const TIMEZONE_OFFSET = 6; // Change to your timezone offset
```

### Change Reminder Time

Edit `netlify/functions/check-reminders.mjs`:

```javascript
if (minutesUntilClass >= 60 && minutesUntilClass <= 90) { // Change 60-90 to your preferred range
```

### Add More Commands

Edit `netlify/functions/vk-webhook.mjs` in `handleMessage()` function

### Change Messages

Edit `responses` object in `netlify/functions/vk-webhook.mjs`

## 📊 Monitoring

Check function performance on Netlify:

- Site → Functions → Monitor
- View invocations, errors, duration
- Logs are available for 1 day by default

## 🔐 Security

- All environment variables are secure on Netlify
- Supabase RLS (Row Level Security) enabled
- Webhook token validation in place
- No sensitive data in logs

## 💰 Cost Estimate

- **Netlify**: Free tier (125k req/month)
- **Supabase**: Free tier (500k rows, 1GB)
- **VK**: Free
- **Total**: $0 for small communities!

## 📞 Support

- Netlify Docs: https://docs.netlify.com/functions/overview/
- Supabase Docs: https://supabase.com/docs
- VK API: https://dev.vk.com/

## 🎯 Next Steps

1. ✅ Set up Supabase
2. ✅ Get VK credentials
3. ✅ Deploy to Netlify
4. ✅ Configure webhook
5. ✅ Test with friends
6. ✅ Customize messages
7. ✅ Launch! 🚀

---

**Ready?** Start with Step 1 above!
