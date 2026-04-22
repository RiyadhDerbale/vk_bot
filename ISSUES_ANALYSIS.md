# 🔧 Issues Found & Fixes Required

**Date:** April 22, 2026  
**Status:** Critical Issues Identified

---

## Issues Summary

### 1. ❌ ICS Upload Feature Not Implemented
**Problem:** The `/upload` command is mentioned in help text but NOT implemented in the code
- No `/upload` command handler in `handleMessage()`
- No ICS parsing function
- No function to download ICS from URL
- Students can't import their timetables

**Solution:** 
- Add ICS parsing function (using icalendar library equivalent for JavaScript)
- Add `/upload` command handler
- Add URL download functionality

---

### 2. ❌ Statistics & Help Show Same Content
**Problem:** Both "📊 Statistics" button and "❓ Help" button show the same help text
- Statistics button should show attendance + task completion stats
- Help button should show command documentation
- Currently both just show help_text response

**Current Code (Line 811-833):**
```javascript
// Statistics button
if (text === "📊 Statistics") {
  const [attendance, tasks] = await Promise.all([...]);
  // Sends statistics... ✅ THIS IS CORRECT
}

// Help button (need to check)
if (text === "❓ Help" || text === "❓ Помощь") {
  await sendMessage(userId, getResponse(lang, "help_text"), getMainKeyboard());
  return;
}
```

**Solution:** Verify both functions work independently

---

### 3. ⚠️ ICS Parsing Not Available
**Problem:** No icalendar library available in Netlify Node.js environment
- Need alternative approach (manual parsing or use a lightweight library)

**Options:**
A. Use `ical.js` lightweight library (recommended)
B. Manual ICS parsing (regex-based)
C. Use a free API service to convert ICS

**Solution:** Use `ical.js` library

---

## Implementation Plan

### Step 1: Add ICS Parsing Function
Create function to parse ICS calendar and extract events

### Step 2: Add URL Download Function
Create function to download ICS file from URL

### Step 3: Add `/upload` Command Handler
Handle `/upload <url>` command and import classes

### Step 4: Verify Statistics Function Works Correctly
Ensure stats are calculated and displayed properly

### Step 5: Verify Help Function Works Correctly
Ensure help text is displayed independently

---

## Files to Modify
- `netlify/functions/vk-webhook.mjs` - Main implementation
- `package.json` - Add ical.js dependency (if using)

---

## Expected Outcome
✅ Students can import ICS calendars with `/upload <url>`  
✅ Statistics button shows real stats (attendance %, task completion %)  
✅ Help button shows command documentation  
✅ Both features work independently
