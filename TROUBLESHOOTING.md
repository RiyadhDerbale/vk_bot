# 🔧 Troubleshooting Checklist

## Before Deployment

- [ ] Supabase database created
- [ ] SUPABASE_SCHEMA.sql executed successfully
- [ ] SUPABASE_URL copied (Project URL)
- [ ] SUPABASE_KEY copied (anon public key)
- [ ] VK_TOKEN obtained from community settings
- [ ] GROUP_ID obtained from community settings
- [ ] VK_CONFIRMATION_TOKEN obtained from Longpoll settings

## During Deployment

- [ ] `npm install` completed without errors
- [ ] GitHub repository created (optional but recommended)
- [ ] Code pushed to GitHub
- [ ] Netlify project created from Git
- [ ] Environment variables added to Netlify dashboard
- [ ] All 5 env vars set correctly (no typos)
- [ ] Deploy preview successful

## After Deployment

- [ ] Netlify deploy shows "Published"
- [ ] Functions appear in Netlify dashboard
- [ ] Webhook URL is accessible (paste URL in browser → see message)
- [ ] VK confirmation successful (check community API settings)

## Testing Messages

### Test 1: Simple Message

- Send any text to bot
- Expected: Bot responds instantly

### Test 2: Schedule Command

- Send: `📅 Schedule`
- Expected: "Your schedule is empty" or list of classes

### Test 3: Add Class

- Send: `/add Math 1 10:30 12:05`
- Expected: "Class 'Math' added!"
- Verify: Send `📅 Schedule` → should show Math class

### Test 4: Add Task

- Send: `/deadline Homework 2025-12-25 23:59 2`
- Expected: "Task 'Homework' saved!"
- Verify: Send `📝 My tasks` → should show task

### Test 5: Help

- Send: `❓ Help`
- Expected: List of all commands

## Common Error Messages & Fixes

### Error: "Confirmation failed" in VK settings

**Solutions:**

1. Check VK_CONFIRMATION_TOKEN is EXACTLY the same as in VK settings
2. Copy-paste it character by character
3. No spaces before or after
4. Retry confirmation in VK API settings

**If still failing:**

1. Go to VK API settings
2. Click "Delete" on webhook
3. Create NEW confirmation string
4. Update VK_CONFIRMATION_TOKEN on Netlify
5. Retry

### Error: Bot doesn't respond to messages

**Check:**

1. Is webhook URL correct?
   - Go to Netlify → Site settings → Domain
   - URL should be: `https://[SITE_NAME].netlify.app/.netlify/functions/vk-webhook`
2. Can you access it in browser?
   - Paste the URL in browser
   - Should see an error or confirmation message
3. Check Netlify function logs:
   - Netlify dashboard → Site → Functions → Logs
   - Look for errors in the past 5 minutes

**Fix:**

1. Copy EXACT webhook URL from Netlify
2. Paste in VK API settings → Webhook → Callback URL
3. Click "Confirm"
4. Wait 2 minutes
5. Test with message

### Error: "SUPABASE_URL is undefined"

**Check:**

1. Are env variables set on Netlify?
   - Site settings → Build & deploy → Environment
2. Are they spelled EXACTLY?
   - `SUPABASE_URL` (not `supabaseUrl` or `SUPABASE_Url`)
3. After adding vars, did you redeploy?
   - Just adding vars doesn't update live site
   - Need to trigger new deploy
   - Either push new code to GitHub
   - Or click "Trigger deploy" on Netlify

**Fix:**

1. Add environment variables on Netlify dashboard
2. Redeploy: `git push origin main`
3. Wait for green checkmark
4. Test bot

### Error: "Database connection failed"

**Check:**

1. Is SUPABASE_URL correct?
   - Should start with: `https://xxxxx.supabase.co`
   - Not: `http://` (must be https)
2. Is SUPABASE_KEY the "anon public" key?
   - NOT the "service_role" key
   - Get it from: Settings → API Keys → anon public
3. Is Supabase project alive?
   - Go to supabase.com → Check project status

**Fix:**

1. Double-check both values
2. Update on Netlify
3. Redeploy
4. Test

### Error: "Message appears to send but bot doesn't reply"

**Check:**

1. Open Netlify dashboard → Functions → Logs
2. Look for the function invocation
3. See what error appears

**Common causes:**

- VK_TOKEN is invalid or expired
- User permissions wrong
- Database query failed

**Fix:**

1. Check VK_TOKEN is valid (should be 100+ characters)
2. Verify VK_CONFIRMATION_TOKEN is in database (send `❓ Help` → confirms it's connected)
3. Check Supabase database has data (go to Supabase → Table Editor)

### Error: Reminders not working

**Check:**

1. Is `check-reminders.mjs` deployed?
   - Netlify → Functions → should see `check-reminders`
2. Do you have scheduled events in Supabase?
   - Go to Supabase → Table Editor → schedule
   - Add test class for today
3. Check function ran:
   - Netlify → Functions → select `check-reminders` → Invocations

**Current limitation:**

- check-reminders only runs on-demand (not automatically scheduled yet)
- Manual workaround: Set up external cron job (EasyCron, PagerDuty, etc.)

**Fix for automatic reminders:**

1. Use external service like EasyCron
2. Set to call: `https://YOUR_SITE.netlify.app/.netlify/functions/check-reminders`
3. Every 5 minutes
4. Done!

## Performance Checks

### Response Time Too Slow

Check:

1. Cold start? (normal on first request, 1-3 sec)
2. Database query slow?
3. Too many users?

If consistently slow:

1. Check function logs for errors
2. Check database indexes (should be auto-created)
3. Optimize query in function code

### Database Growing Too Large

Supabase free tier: 1GB max

- Keep ~6 months of data
- Archive old classes/tasks
- Delete test data

## Still Not Working?

Follow this order:

1. **Check webhook connection:**
   - Paste webhook URL in browser → should load
   - Check Netlify domain is correct

2. **Check VK credentials:**
   - VK_TOKEN should be 100+ characters
   - GROUP_ID should be number only
   - VK_CONFIRMATION_TOKEN should be string

3. **Check Supabase:**
   - Open Supabase.com → your project
   - Go to Table Editor
   - Add test user manually
   - Should see "users" table

4. **Check function code:**
   - Go to Netlify → Site settings → Functions
   - Look for error message
   - If error, check if code deployed correctly

5. **Check logs:**
   - Netlify: Site → Functions → Logs
   - Supabase: SQL Editor → see queries
   - VK: API Usage → see incoming webhooks

6. **Check environment variables:**
   - Each one set on Netlify? (5 total)
   - Spelled exactly right? (case-sensitive)
   - Just added? Redeploy after adding!

## Getting Help

If stuck:

1. Check error message in Netlify logs
2. Google the error message
3. Check Netlify Docs: https://docs.netlify.com/functions/overview/
4. Check Supabase Docs: https://supabase.com/docs
5. Check VK API Docs: https://dev.vk.com/

---

**Good luck! You've got this! 🚀**
