# Local Testing Guide

## Setup for Local Development

### 1. Install Dependencies

```powershell
cd d:\vk_bot_env
npm install
```

### 2. Create .env File

Copy `.env.example` to `.env`:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and fill in your credentials:

```
VK_TOKEN=your_vk_bot_token_here
GROUP_ID=your_group_id_here
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=your_supabase_anon_key_here
VK_CONFIRMATION_TOKEN=your_confirmation_string_here
```

### 3. Run Netlify Dev Server

```powershell
netlify dev
```

This starts:

- Local server on http://localhost:8888
- Functions available at http://localhost:8888/.netlify/functions/

### 4. Test Webhook Locally

Use curl or Postman to test:

```powershell
$body = @{
    type = "message_new"
    object = @{
        message = @{
            from_id = 123456789
            text = "📅 Schedule"
        }
    }
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:8888/.netlify/functions/vk-webhook" `
    -Method POST `
    -Body $body `
    -ContentType "application/json"
```

### 5. Test Reminders Function

```powershell
netlify functions:invoke check-reminders --local
```

## Debugging

### Check Function Logs

```powershell
netlify dev
# Logs appear in console
```

### Test Supabase Connection

```javascript
// Add to function for debugging
console.log("SUPABASE_URL:", process.env.SUPABASE_URL);
console.log(
  "Connection test:",
  await supabase.from("users").select("*").limit(1),
);
```

### VK API Debugging

Add to `vk-webhook.mjs`:

```javascript
console.log("Received event:", JSON.stringify(body, null, 2));
```

## Common Issues

**"Cannot find module '@supabase/supabase-js'"**

- Solution: `npm install`

**"process.env.SUPABASE_URL is undefined"**

- Solution: Check `.env` file exists and has correct values
- Solution: Restart `netlify dev`

**"Webhook test fails"**

- Solution: Check VK token in .env
- Solution: Verify Supabase connection in .env

## Deploy to Production

When everything works locally:

```powershell
git add .
git commit -m "Working bot"
git push origin main
```

Netlify auto-deploys from GitHub! 🚀

## Next Steps

1. Test locally with `netlify dev`
2. Monitor logs for errors
3. Fix any issues
4. Push to GitHub
5. Check Netlify deploy logs
6. Test live bot with real VK messages
