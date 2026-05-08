#import logging
#logging.basicConfig(level=logging.DEBUG)
#import collections
#import collections.abc
#
## Fix for old tatsu library on Python 3.10+
#if not hasattr(collections, 'Mapping'):
#    collections.Mapping = collections.abc.Mapping
#if not hasattr(collections, 'MutableMapping'):
#    collections.MutableMapping = collections.abc.MutableMapping
#
#import sqlite3
#import json
#import logging
#import requests
#from datetime import datetime, timedelta
#
#
#import vk_api
#from vk_api.bot_longpoll import VkBotLongPoll, VkBotEventType
#from vk_api.keyboard import VkKeyboard, VkKeyboardColor
#from vk_api.utils import get_random_id
#from icalendar import Calendar
#from apscheduler.schedulers.background import BackgroundScheduler
#import pytz
#
#logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
##========== CONFIGURATION ==========
#VK_TOKEN = "vk1.a.eZvEbyVQo2aLD4K-r_7DxudJLQ4iNke42CLOnxo-ewzkJhDCjgY-FFImW2JeNulCAByv9bzkSuo_VXZFEV1GbMGoTfjD_TlDUV_pfIIfXU2eJvNsYIVFvVRa7OQxAhzGJPle69aDCxH7jYlu-LbbfSLM-9ZVDiOkmo3zSdgiWYegoSqKJqtGAGoyldsJYC79Fc9up1aNsvk3uJ3NZaE6Xg"
#GROUP_ID = 237363984          # Replace with your group ID
#TIMEZONE = pytz.timezone("Asia/Novosibirsk")  # Change to your local timezone
#
#
#
#    
## ========== DATABASE INIT ==========
#def init_db():
#    conn = sqlite3.connect("student_bot.db")
#    c = conn.cursor()
#    c.execute("""CREATE TABLE IF NOT EXISTS users (
#        vk_id INTEGER PRIMARY KEY,
#        notify_offset INTEGER DEFAULT 60
#    )""")
#    c.execute("""CREATE TABLE IF NOT EXISTS schedule (
#        id INTEGER PRIMARY KEY AUTOINCREMENT,
#        user_id INTEGER,
#        subject TEXT,
#        day_of_week INTEGER,
#        start_time TEXT,
#        end_time TEXT
#    )""")
#    c.execute("""CREATE TABLE IF NOT EXISTS deadlines (
#        id INTEGER PRIMARY KEY AUTOINCREMENT,
#        user_id INTEGER,
#        task TEXT,
#        due_date TEXT,
#        remind_days INTEGER,
#        done BOOLEAN DEFAULT 0
#    )""")
#    conn.commit()
#    conn.close()
#
#init_db()
#
## ========== DATABASE HELPERS ==========
#def get_user_offset(user_id):
#    conn = sqlite3.connect("student_bot.db")
#    c = conn.cursor()
#    c.execute("SELECT notify_offset FROM users WHERE vk_id = ?", (user_id,))
#    row = c.fetchone()
#    conn.close()
#    return row[0] if row else 60
#
#def set_user_offset(user_id, minutes):
#    conn = sqlite3.connect("student_bot.db")
#    c = conn.cursor()
#    c.execute("INSERT OR REPLACE INTO users (vk_id, notify_offset) VALUES (?, ?)", (user_id, minutes))
#    conn.commit()
#    conn.close()
#
#def add_schedule(user_id, subject, day_of_week, start_time, end_time):
#    conn = sqlite3.connect("student_bot.db")
#    c = conn.cursor()
#    c.execute("INSERT INTO schedule (user_id, subject, day_of_week, start_time, end_time) VALUES (?,?,?,?,?)",
#              (user_id, subject, day_of_week, start_time, end_time))
#    conn.commit()
#    conn.close()
#
#def get_schedule(user_id):
#    conn = sqlite3.connect("student_bot.db")
#    c = conn.cursor()
#    c.execute("SELECT subject, day_of_week, start_time, end_time FROM schedule WHERE user_id = ?", (user_id,))
#    rows = c.fetchall()
#    conn.close()
#    return rows
#
#def delete_schedule(user_id, subject, day_of_week, start_time):
#    conn = sqlite3.connect("student_bot.db")
#    c = conn.cursor()
#    c.execute("DELETE FROM schedule WHERE user_id=? AND subject=? AND day_of_week=? AND start_time=?",
#              (user_id, subject, day_of_week, start_time))
#    conn.commit()
#    conn.close()
#
#def add_deadline(user_id, task, due_date, remind_days):
#    conn = sqlite3.connect("student_bot.db")
#    c = conn.cursor()
#    c.execute("INSERT INTO deadlines (user_id, task, due_date, remind_days, done) VALUES (?,?,?,?,0)",
#              (user_id, task, due_date, remind_days))
#    conn.commit()
#    conn.close()
#
#def get_deadlines(user_id, only_pending=True):
#    conn = sqlite3.connect("student_bot.db")
#    c = conn.cursor()
#    if only_pending:
#        c.execute("SELECT id, task, due_date, remind_days FROM deadlines WHERE user_id=? AND done=0", (user_id,))
#    else:
#        c.execute("SELECT id, task, due_date, remind_days, done FROM deadlines WHERE user_id=?", (user_id,))
#    rows = c.fetchall()
#    conn.close()
#    return rows
#
#def mark_deadline_done(deadline_id, user_id):
#    conn = sqlite3.connect("student_bot.db")
#    c = conn.cursor()
#    c.execute("UPDATE deadlines SET done=1 WHERE id=? AND user_id=?", (deadline_id, user_id))
#    conn.commit()
#    conn.close()
#
## ========== ICS PARSING ==========
##def parse_ics_and_save(user_id, ics_content):
##    try:
##        cal = Calendar(ics_content)
##        count = 0
##        for event in cal.events:
##            subject = event.name
##            start = event.begin.datetime
##            end = event.end.datetime
##            day_of_week = start.weekday()
##            start_time = start.strftime("%H:%M")
##            end_time = end.strftime("%H:%M")
##            add_schedule(user_id, subject, day_of_week, start_time, end_time)
##            count += 1
##        return count
##    except Exception as e:
##        logging.error(f"ICS parsing error: {e}")
##        return 0
#
##def parse_ics_and_save(user_id, ics_content):
##    try:
##        cal = Calendar.from_ical(ics_content)
##        count = 0
##        for component in cal.walk():
##            if component.name == "VEVENT":
##                subject = str(component.get('SUMMARY', 'No title'))
##                dtstart = component.get('DTSTART')
##                dtend = component.get('DTEND')
##                if dtstart is None or dtend is None:
##                    continue
##                start = dtstart.dt
##                end = dtend.dt
##                # Handle all-day events (date only)
##                if not isinstance(start, datetime):
##                    start = datetime.combine(start, datetime.min.time())
##                if not isinstance(end, datetime):
##                    end = datetime.combine(end, datetime.min.time())
##                day_of_week = start.weekday()
##                start_time = start.strftime("%H:%M")
##                end_time = end.strftime("%H:%M")
##                add_schedule(user_id, subject, day_of_week, start_time, end_time)
##                count += 1
##        return count
##    except Exception as e:
##        logging.error(f"ICS parsing error: {e}")
##        return 0 
#    
#    # Add this new function near your other ICS functions (around line 150)
#
#def parse_ics_from_url(user_id, ics_url):
#    """Download and parse ICS file from a URL"""
#    try:
#        # Download the ICS file
#        response = requests.get(ics_url, timeout=30)
#        response.raise_for_status()  # Check if download was successful
#        
#        # Parse the ICS content
#        cal = Calendar.from_ical(response.text)
#        count = 0
#        
#        for component in cal.walk():
#            if component.name == "VEVENT":
#                subject = str(component.get('SUMMARY', 'No title'))
#                dtstart = component.get('DTSTART')
#                dtend = component.get('DTEND')
#                
#                if dtstart is None or dtend is None:
#                    continue
#                    
#                start = dtstart.dt
#                end = dtend.dt
#                
#                # Handle all-day events (date only)
#                if not isinstance(start, datetime):
#                    start = datetime.combine(start, datetime.min.time())
#                if not isinstance(end, datetime):
#                    end = datetime.combine(end, datetime.min.time())
#                    
#                day_of_week = start.weekday()
#                start_time = start.strftime("%H:%M")
#                end_time = end.strftime("%H:%M")
#                
#                add_schedule(user_id, subject, day_of_week, start_time, end_time)
#                count += 1
#                
#        return count
#    except requests.exceptions.RequestException as e:
#        logging.error(f"Failed to download ICS from URL: {e}")
#        return -1
#    except Exception as e:
#        logging.error(f"ICS parsing error: {e}")
#        return 0
#
## ==#======== KEYBOARDS ==========
##def #get_main_keyboard():
#    #keyboard = VkKeyboard(one_time=False)
#    #keyboard.add_button("📅 Schedule", color=VkKeyboardColor.PRIMARY)
#    #keyboard.add_button("➕ Add class", color=VkKeyboardColor.POSITIVE)
#    #keyboard.add_line()
#    #keyboard.add_button("📝 My tasks", color=VkKeyboardColor.SECONDARY)
#    #keyboard.add_button("➕ Add deadline", color=VkKeyboardColor.POSITIVE)
#    #keyboard.add_line()
#    #keyboard.add_button("⚙️ Settings", color=VkKeyboardColor.SECONDARY)
#    #return keyboard.get_keyboard()
##
#
#def get_main_keyboard():
#    keyboard = VkKeyboard(one_time=False)
#    keyboard.add_button("📅 Schedule", color=VkKeyboardColor.PRIMARY)
#    keyboard.add_button("➕ Add class", color=VkKeyboardColor.POSITIVE)
#    keyboard.add_line()
#    keyboard.add_button("📝 My tasks", color=VkKeyboardColor.SECONDARY)
#    keyboard.add_button("➕ Add deadline", color=VkKeyboardColor.POSITIVE)
#    keyboard.add_line()
#    keyboard.add_button("⚙️ Settings", color=VkKeyboardColor.SECONDARY)
#    keyboard.add_button("❓ Help", color=VkKeyboardColor.PRIMARY)  # New help button
#    return keyboard.get_keyboard()
#
#def get_deadline_keyboard(deadline_id):
#    keyboard = VkKeyboard(inline=True)
#    keyboard.add_button("✅ Done", color=VkKeyboardColor.POSITIVE, payload={"cmd": "mark_done", "did": deadline_id})
#    return keyboard.get_keyboard()
#
##def send_message(vk, user_id, text, keyboard=None):
##    vk.method("messages.send", {
##        "user_id": user_id,
##        "message": text,
##        "random_id": get_random_id(),
##        "keyboard": keyboard if keyboard else VkKeyboard().get_empty_keyboard()
##    })
#
##def send_message(vk, user_id, text, keyboard=None):
##    vk.method("messages.send", {
##        "user_id": user_id,
##        "message": text,
##        "random_id": get_random_id(),
##        "keyboard": keyboard if keyboard else VkKeyboard().get_empty_keyboard()
##    })
#
#
#def send_message(vk, user_id, text, keyboard=None):
#    try:
#        vk.messages.send(
#            user_id=user_id,
#            message=text,
#            random_id=get_random_id(),
#            keyboard=keyboard if keyboard else VkKeyboard().get_empty_keyboard()
#        )
#    except Exception as e:
#        logging.error(f"Error sending message to {user_id}: {e}")
#
#
#def handle_message(vk, user_id, text, attachments):
#    # Check for ICS URL command first
#    if text.startswith("/ics") or text.startswith("/import"):
#        parts = text.split(maxsplit=1)
#        if len(parts) == 2:
#            ics_url = parts[1].strip()
#            
#            # Basic URL validation
#            if ics_url.startswith(('http://', 'https://')):
#                send_message(vk, user_id, "⏳ Downloading and importing schedule from URL... Please wait.", get_main_keyboard())
#                count = parse_ics_from_url(user_id, ics_url)
#                
#                if count == -1:
#                    send_message(vk, user_id, "❌ Failed to download the ICS file. Check if the URL is correct and accessible.", get_main_keyboard())
#                elif count == 0:
#                    send_message(vk, user_id, "⚠️ No events found in the ICS file or failed to parse.", get_main_keyboard())
#                else:
#                    send_message(vk, user_id, f"✅ Successfully imported {count} events from the ICS URL!", get_main_keyboard())
#            else:
#                send_message(vk, user_id, "❌ Invalid URL. Please provide a valid HTTP or HTTPS link.", get_main_keyboard())
#        else:
#            send_message(vk, user_id, "📅 Usage: `/ics <URL>`\nExample: `/ics https://example.com/schedule.ics`\n\nYou can also upload an .ics file directly.", get_main_keyboard())
#        return
#    
#    # Regular text commands
#    if text == "📅 Schedule":
#        sched = get_schedule(user_id)
#        if not sched:
#            send_message(vk, user_id, "Your schedule is empty. Add classes via button, upload an .ics file, or use /ics <URL>", get_main_keyboard())
#        else:
#            msg = "📚 Your schedule:\n"
#            days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
#            for subj, dow, start, end in sched:
#                msg += f"{days[dow]} {start}-{end} — {subj}\n"
#            send_message(vk, user_id, msg, get_main_keyboard())
#
#    elif text == "➕ Add class":
#        send_message(vk, user_id, "Send command:\n`/add <subject> <day(0=Mon..6=Sun)> <HH:MM> <HH:MM>`\nExample: /add Math 1 10:30 12:05", get_main_keyboard())
#
#    elif text == "📝 My tasks":
#        deadlines = get_deadlines(user_id, only_pending=True)
#        if not deadlines:
#            send_message(vk, user_id, "No active tasks.", get_main_keyboard())
#        else:
#            for did, task, due_date, remind_days in deadlines:
#                dt = datetime.strptime(due_date, "%Y-%m-%d %H:%M")
#                msg = f"📌 {task}\n⏰ Due: {dt.strftime('%d.%m.%Y %H:%M')}\n🔔 Remind {remind_days} day(s) before"
#                send_message(vk, user_id, msg, get_deadline_keyboard(did))
#
#    elif text == "➕ Add deadline":
#        send_message(vk, user_id, "Send command:\n`/deadline <task> <YYYY-MM-DD HH:MM> <remind_days>`\nExample: /deadline Physics report 2025-12-20 23:59 2", get_main_keyboard())
#
#    elif text == "⚙️ Settings":
#        offset = get_user_offset(user_id)
#        keyboard = VkKeyboard()
#        keyboard.add_button(f"⏰ Reminder offset: {offset} min", color=VkKeyboardColor.PRIMARY)
#        keyboard.add_line()
#        keyboard.add_button("🔙 Back", color=VkKeyboardColor.SECONDARY)
#        send_message(vk, user_id, "Notification settings:", keyboard.get_keyboard())
#
#    # Command handlers
#    elif text.startswith("/add"):
#        parts = text.split()
#        if len(parts) == 5:
#            _, subject, day_str, start_time, end_time = parts
#            if day_str.isdigit() and 0 <= int(day_str) <= 6:
#                add_schedule(user_id, subject, int(day_str), start_time, end_time)
#                send_message(vk, user_id, f"Class '{subject}' added!", get_main_keyboard())
#            else:
#                send_message(vk, user_id, "Day must be 0 (Mon) to 6 (Sun).", get_main_keyboard())
#        else:
#            send_message(vk, user_id, "Usage: /add <subject> <day> <start> <end>", get_main_keyboard())
#
#    elif text.startswith("/deadline"):
#        parts = text.split(maxsplit=3)
#        if len(parts) == 4:
#            _, task, due_date, remind_days = parts
#            if remind_days.isdigit():
#                add_deadline(user_id, task, due_date, int(remind_days))
#                send_message(vk, user_id, f"Task '{task}' saved!", get_main_keyboard())
#            else:
#                send_message(vk, user_id, "Remind days must be an integer.", get_main_keyboard())
#        else:
#            send_message(vk, user_id, "Usage: /deadline <task> <YYYY-MM-DD HH:MM> <days>", get_main_keyboard())
#    
#    elif text.startswith("/help"):
#        help_text = """📖 **Available Commands:**
#
#📅 **Schedule:**
#• /ics <URL> - Import timetable from ICS link
#• /add <subject> <day> <start> <end> - Add single class
#
#📝 **Tasks:**
#• /deadline <task> <date> <days> - Add deadline
#• Click "✅ Done" on tasks to complete them
#
#⚙️ **Settings:**
#• Use buttons below to navigate
#
#💡 **Tip:** You can also upload .ics files directly!"""
#        send_message(vk, user_id, help_text, get_main_keyboard())
#
#    else:
#        send_message(vk, user_id, "Unknown command. Use buttons, /ics <URL>, or /help", get_main_keyboard())
#
#
## ========== MESSAGE HANDLING ==========
#def handle_message(vk, user_id, text, attachments):
#    if text == "📅 Schedule":
#        sched = get_schedule(user_id)
#        if not sched:
#            send_message(vk, user_id, "Your schedule is empty. Add classes via button or upload an .ics file.", get_main_keyboard())
#        else:
#            msg = "📚 Your schedule:\n"
#            days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
#            for subj, dow, start, end in sched:
#                msg += f"{days[dow]} {start}-{end} — {subj}\n"
#            send_message(vk, user_id, msg, get_main_keyboard())
#
#    elif text == "➕ Add class":
#        send_message(vk, user_id, "Send command:\n`/add <subject> <day(0=Mon..6=Sun)> <HH:MM> <HH:MM>`\nExample: /add Math 1 10:30 12:05", get_main_keyboard())
#
#    elif text == "📝 My tasks":
#        deadlines = get_deadlines(user_id, only_pending=True)
#        if not deadlines:
#            send_message(vk, user_id, "No active tasks.", get_main_keyboard())
#        else:
#            for did, task, due_date, remind_days in deadlines:
#                dt = datetime.strptime(due_date, "%Y-%m-%d %H:%M")
#                msg = f"📌 {task}\n⏰ Due: {dt.strftime('%d.%m.%Y %H:%M')}\n🔔 Remind {remind_days} day(s) before"
#                send_message(vk, user_id, msg, get_deadline_keyboard(did))
#
#    elif text == "➕ Add deadline":
#        send_message(vk, user_id, "Send command:\n`/deadline <task> <YYYY-MM-DD HH:MM> <remind_days>`\nExample: /deadline Physics report 2025-12-20 23:59 2", get_main_keyboard())
#
#    elif text == "⚙️ Settings":
#        offset = get_user_offset(user_id)
#        keyboard = VkKeyboard()
#        keyboard.add_button(f"⏰ Reminder offset: {offset} min", color=VkKeyboardColor.PRIMARY)
#        keyboard.add_line()
#        keyboard.add_button("🔙 Back", color=VkKeyboardColor.SECONDARY)
#        send_message(vk, user_id, "Notification settings:", keyboard.get_keyboard())
#
#    # Command handlers
#    elif text.startswith("/add"):
#        parts = text.split()
#        if len(parts) == 5:
#            _, subject, day_str, start_time, end_time = parts
#            if day_str.isdigit() and 0 <= int(day_str) <= 6:
#                add_schedule(user_id, subject, int(day_str), start_time, end_time)
#                send_message(vk, user_id, f"Class '{subject}' added!", get_main_keyboard())
#            else:
#                send_message(vk, user_id, "Day must be 0 (Mon) to 6 (Sun).", get_main_keyboard())
#        else:
#            send_message(vk, user_id, "Usage: /add <subject> <day> <start> <end>", get_main_keyboard())
#
#    elif text.startswith("/deadline"):
#        parts = text.split(maxsplit=3)
#        if len(parts) == 4:
#            _, task, due_date, remind_days = parts
#            if remind_days.isdigit():
#                add_deadline(user_id, task, due_date, int(remind_days))
#                send_message(vk, user_id, f"Task '{task}' saved!", get_main_keyboard())
#            else:
#                send_message(vk, user_id, "Remind days must be an integer.", get_main_keyboard())
#        else:
#            send_message(vk, user_id, "Usage: /deadline <task> <YYYY-MM-DD HH:MM> <days>", get_main_keyboard())
#    else:
#        send_message(vk, user_id, "Unknown command. Use buttons or /add, /deadline.", get_main_keyboard())
#
## ========== INLINE BUTTON HANDLING ==========
#def handle_payload(vk, user_id, payload):
#    if payload.get("cmd") == "mark_done":
#        did = payload["did"]
#        mark_deadline_done(did, user_id)
#        send_message(vk, user_id, "✅ Task marked as done!", get_main_keyboard())
#
## ========== REMINDER SCHEDULER ==========
#def send_reminders(vk):
#    conn = sqlite3.connect("student_bot.db")
#    c = conn.cursor()
#    now = datetime.now(TIMEZONE)
#
#    # Class reminders (60 min before)
#    offset = 60
#    soon = now + timedelta(minutes=offset)
#    c.execute("""
#        SELECT s.user_id, s.subject, s.start_time, u.notify_offset
#        FROM schedule s
#        JOIN users u ON s.user_id = u.vk_id
#        WHERE s.day_of_week = ? AND s.start_time = ?
#    """, (now.weekday(), soon.strftime("%H:%M")))
#    rows = c.fetchall()
#    for user_id, subject, start_time, user_offset in rows:
#        if user_offset == offset:
#            send_message(vk, user_id, f"🔔 Reminder: Class '{subject}' starts at {start_time} (in {offset} minutes)", get_main_keyboard())
#
#    # Deadline reminders
#    c.execute("SELECT id, user_id, task, due_date, remind_days FROM deadlines WHERE done=0")
#    deadlines = c.fetchall()
#    for did, user_id, task, due_date, remind_days in deadlines:
#        due_dt = datetime.strptime(due_date, "%Y-%m-%d %H:%M")
#        due_dt = TIMEZONE.localize(due_dt) if due_dt.tzinfo is None else due_dt
#        delta = due_dt - now
#        if timedelta(days=remind_days) - timedelta(hours=1) < delta < timedelta(days=remind_days) + timedelta(hours=1):
#            send_message(vk, user_id, f"⚠️ Deadline '{task}' is in {remind_days} day(s) (due {due_dt.strftime('%d.%m.%Y %H:%M')})", get_main_keyboard())
#    conn.close()
#
#scheduler = BackgroundScheduler()
#def start_scheduler(vk):
#    scheduler.add_job(func=lambda: send_reminders(vk), trigger="interval", minutes=1)
#    scheduler.start()
#
## ========== MAIN LOOP ==========
#def main():
#    vk_session = vk_api.VkApi(token=VK_TOKEN)
#    vk = vk_session.get_api()
#    longpoll = VkBotLongPoll(vk_session, GROUP_ID)
#
#    start_scheduler(vk)
#    logging.basicConfig(level=logging.INFO)
#
#    print("Bot started! Waiting for messages...")
#    for event in longpoll.listen():
#        if event.type == VkBotEventType.MESSAGE_NEW:
#            msg = event.object.message
#            user_id = msg["from_id"]
#            text = msg.get("text", "")
#            attachments = msg.get("attachments", [])
#
#            # ICS file upload handling
#            ics_attachments = [att for att in attachments if att["type"] == "doc" and att["doc"]["title"].endswith(".ics")]
#            if ics_attachments:
#                url = ics_attachments[0]["doc"]["url"]
#                resp = requests.get(url)
#                if resp.status_code == 200:
#                    count = parse_ics_from_url (user_id, resp.text)
#                    send_message(vk, user_id, f"Imported {count} events from .ics", get_main_keyboard())
#                else:
#                    send_message(vk, user_id, "Failed to download file", get_main_keyboard())
#                continue
#
#            # Inline button payload
#            payload = msg.get("payload")
#            if payload:
#                try:
#                    payload = json.loads(payload)
#                    handle_payload(vk, user_id, payload)
#                except:
#                    pass
#                continue
#
#            # Normal text message
#            handle_message(vk, user_id, text, attachments)
#
#if __name__ == "__main__":
# main()

#import logging
#import sqlite3
#import json
#import requests
#from datetime import datetime, timedelta
#import vk_api
#from vk_api.bot_longpoll import VkBotLongPoll, VkBotEventType
#from vk_api.keyboard import VkKeyboard, VkKeyboardColor
#from vk_api.utils import get_random_id
#from icalendar import Calendar
#import pytz
#import time
#
## ========== CONFIGURATION ==========
#VK_TOKEN = "vk1.a.eZvEbyVQo2aLD4K-r_7DxudJLQ4iNke42CLOnxo-ewzkJhDCjgY-FFImW2JeNulCAByv9bzkSuo_VXZFEV1GbMGoTfjD_TlDUV_pfIIfXU2eJvNsYIVFvVRa7OQxAhzGJPle69aDCxH7jYlu-LbbfSLM-9ZVDiOkmo3zSdgiWYegoSqKJqtGAGoyldsJYC79Fc9up1aNsvk3uJ3NZaE6Xg"
#GROUP_ID = 237363984
#TIMEZONE = pytz.timezone("Asia/Novosibirsk")
#
#logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
#
## ========== DATABASE INIT ==========
#def init_db():
#    conn = sqlite3.connect("student_bot.db")
#    c = conn.cursor()
#    c.execute("""CREATE TABLE IF NOT EXISTS users (
#        vk_id INTEGER PRIMARY KEY,
#        notify_offset INTEGER DEFAULT 60
#    )""")
#    c.execute("""CREATE TABLE IF NOT EXISTS schedule (
#        id INTEGER PRIMARY KEY AUTOINCREMENT,
#        user_id INTEGER,
#        subject TEXT,
#        day_of_week INTEGER,
#        start_time TEXT,
#        end_time TEXT
#    )""")
#    c.execute("""CREATE TABLE IF NOT EXISTS deadlines (
#        id INTEGER PRIMARY KEY AUTOINCREMENT,
#        user_id INTEGER,
#        task TEXT,
#        due_date TEXT,
#        remind_days INTEGER,
#        done BOOLEAN DEFAULT 0
#    )""")
#    conn.commit()
#    conn.close()
#
#init_db()
#
## ========== DATABASE HELPERS ==========
#def add_schedule(user_id, subject, day_of_week, start_time, end_time):
#    conn = sqlite3.connect("student_bot.db")
#    c = conn.cursor()
#    c.execute("INSERT INTO schedule (user_id, subject, day_of_week, start_time, end_time) VALUES (?,?,?,?,?)",
#              (user_id, subject, day_of_week, start_time, end_time))
#    conn.commit()
#    conn.close()
#
#def get_schedule(user_id):
#    conn = sqlite3.connect("student_bot.db")
#    c = conn.cursor()
#    c.execute("SELECT subject, day_of_week, start_time, end_time FROM schedule WHERE user_id = ?", (user_id,))
#    rows = c.fetchall()
#    conn.close()
#    return rows
#
#def add_deadline(user_id, task, due_date, remind_days):
#    conn = sqlite3.connect("student_bot.db")
#    c = conn.cursor()
#    c.execute("INSERT INTO deadlines (user_id, task, due_date, remind_days, done) VALUES (?,?,?,?,0)",
#              (user_id, task, due_date, remind_days))
#    conn.commit()
#    conn.close()
#
#def get_deadlines(user_id, only_pending=True):
#    conn = sqlite3.connect("student_bot.db")
#    c = conn.cursor()
#    if only_pending:
#        c.execute("SELECT id, task, due_date, remind_days FROM deadlines WHERE user_id=? AND done=0", (user_id,))
#    else:
#        c.execute("SELECT id, task, due_date, remind_days, done FROM deadlines WHERE user_id=?", (user_id,))
#    rows = c.fetchall()
#    conn.close()
#    return rows
#
#def mark_deadline_done(deadline_id, user_id):
#    conn = sqlite3.connect("student_bot.db")
#    c = conn.cursor()
#    c.execute("UPDATE deadlines SET done=1 WHERE id=? AND user_id=?", (deadline_id, user_id))
#    conn.commit()
#    conn.close()
#
## ========== ICS PARSING ==========
#def parse_ics_and_save(user_id, ics_content):
#    try:
#        cal = Calendar.from_ical(ics_content)
#        count = 0
#        for component in cal.walk():
#            if component.name == "VEVENT":
#                subject = str(component.get('SUMMARY', 'No title'))
#                dtstart = component.get('DTSTART')
#                dtend = component.get('DTEND')
#                if dtstart is None or dtend is None:
#                    continue
#                start = dtstart.dt
#                end = dtend.dt
#                if not isinstance(start, datetime):
#                    start = datetime.combine(start, datetime.min.time())
#                if not isinstance(end, datetime):
#                    end = datetime.combine(end, datetime.min.time())
#                day_of_week = start.weekday()
#                start_time = start.strftime("%H:%M")
#                end_time = end.strftime("%H:%M")
#                add_schedule(user_id, subject, day_of_week, start_time, end_time)
#                count += 1
#        return count
#    except Exception as e:
#        logging.error(f"ICS parsing error: {e}")
#        return 0
#
#def parse_ics_from_url(user_id, ics_url):
#    try:
#        response = requests.get(ics_url, timeout=30)
#        response.raise_for_status()
#        return parse_ics_and_save(user_id, response.text)
#    except Exception as e:
#        logging.error(f"URL download failed: {e}")
#        return -1
#
## ========== KEYBOARDS ==========
#def get_main_keyboard():
#    keyboard = VkKeyboard(one_time=False)
#    keyboard.add_button("📅 Schedule", color=VkKeyboardColor.PRIMARY)
#    keyboard.add_button("➕ Add class", color=VkKeyboardColor.POSITIVE)
#    keyboard.add_line()
#    keyboard.add_button("📝 My tasks", color=VkKeyboardColor.SECONDARY)
#    keyboard.add_button("➕ Add deadline", color=VkKeyboardColor.POSITIVE)
#    keyboard.add_line()
#    keyboard.add_button("❓ Help", color=VkKeyboardColor.PRIMARY)
#    return keyboard.get_keyboard()
#
#def get_deadline_keyboard(deadline_id):
#    keyboard = VkKeyboard(inline=True)
#    keyboard.add_button("✅ Done", color=VkKeyboardColor.POSITIVE, payload={"cmd": "mark_done", "did": deadline_id})
#    return keyboard.get_keyboard()
#
## ========== SEND MESSAGE ==========
#def send_message(vk, user_id, text, keyboard=None):
#    try:
#        if keyboard is None:
#            keyboard = VkKeyboard().get_empty_keyboard()
#        
#        vk.messages.send(
#            user_id=user_id,
#            message=text,
#            random_id=get_random_id(),
#            keyboard=keyboard
#        )
#        logging.info(f"Sent message to {user_id}")
#    except Exception as e:
#        logging.error(f"Error sending message to {user_id}: {e}")
#
## ========== MESSAGE HANDLING ==========
#def handle_message(vk, user_id, text, attachments):
#    logging.info(f"Received from {user_id}: {text}")
#    
#    # Help command
#    if text == "/start" or text == "/help" or text == "❓ Help":
#        help_text = """🤖 **Hello! I'm your study assistant bot!**
#
#Here's what I can do:
#
#📅 **Schedule Management:**
#• `/ics <URL>` - Import your timetable from an ICS link
#• `/add <subject> <day> <start> <end>` - Add a single class
#• Click "📅 Schedule" to view your timetable
#
#📝 **Task Management:**
#• `/deadline <task> <date> <days>` - Add a deadline
#• Click "📝 My tasks" to see pending tasks
#• Click "✅ Done" to complete tasks
#
#📌 **Day numbers:** 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
#
#💡 **Quick examples:**
#• `/add Math 1 10:30 12:05`
#• `/deadline Homework 2025-12-20 23:59 2`
#• `/ics https://example.com/schedule.ics`
#
#Just type a command or click the buttons below!"""
#        send_message(vk, user_id, help_text, get_main_keyboard())
#        return
#    
#    # ICS URL command
#    if text.startswith("/ics"):
#        parts = text.split(maxsplit=1)
#        if len(parts) == 2:
#            ics_url = parts[1].strip()
#            if ics_url.startswith(('http://', 'https://')):
#                send_message(vk, user_id, "⏳ Importing your schedule from the URL... Please wait!", get_main_keyboard())
#                count = parse_ics_from_url(user_id, ics_url)
#                if count == -1:
#                    send_message(vk, user_id, "❌ Couldn't download the file. Please check the URL and try again.", get_main_keyboard())
#                elif count == 0:
#                    send_message(vk, user_id, "⚠️ No classes found in the file. Make sure it's a valid calendar file.", get_main_keyboard())
#                else:
#                    send_message(vk, user_id, f"✅ Success! I've added {count} classes to your schedule! 🎉", get_main_keyboard())
#            else:
#                send_message(vk, user_id, "❌ Please provide a valid URL starting with http:// or https://", get_main_keyboard())
#        else:
#            send_message(vk, user_id, "📅 **Import your timetable:**\n\nSend: `/ics <your_calendar_url>`\n\nExample: `/ics https://university.com/schedule.ics`", get_main_keyboard())
#        return
#    
#    # Show schedule
#    if text == "📅 Schedule":
#        sched = get_schedule(user_id)
#        if not sched:
#            send_message(vk, user_id, "📭 Your schedule is empty. Use `/ics <URL>` to import or `/add` to add classes manually.", get_main_keyboard())
#        else:
#            msg = "📚 **Your Weekly Schedule:**\n\n"
#            days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
#            current_day = None
#            for subj, dow, start, end in sorted(sched, key=lambda x: (x[1], x[2])):
#                if current_day != days[dow]:
#                    current_day = days[dow]
#                    msg += f"\n**{current_day}:**\n"
#                msg += f"  • {start}-{end} - {subj}\n"
#            send_message(vk, user_id, msg, get_main_keyboard())
#        return
#    
#    # Add class instruction
#    if text == "➕ Add class":
#        msg = """📝 **Add a class manually:**
#
#Send the command in this format:
#`/add <subject> <day> <start_time> <end_time>`
#
#📌 **Day numbers:**
#0 = Monday
#1 = Tuesday
#2 = Wednesday
#3 = Thursday
#4 = Friday
#5 = Saturday
#6 = Sunday
#
#⏰ **Time format:** HH:MM (24-hour)
#
#**Example:** `/add Mathematics 1 10:30 12:05`"""
#        send_message(vk, user_id, msg, get_main_keyboard())
#        return
#    
#    # Show tasks
#    if text == "📝 My tasks":
#        deadlines = get_deadlines(user_id, only_pending=True)
#        if not deadlines:
#            send_message(vk, user_id, "✅ You have no pending tasks! Great job keeping up! 🎉", get_main_keyboard())
#        else:
#            send_message(vk, user_id, f"📋 **You have {len(deadlines)} pending task(s):**", get_main_keyboard())
#            for did, task, due_date, remind_days in deadlines:
#                dt = datetime.strptime(due_date, "%Y-%m-%d %H:%M")
#                msg = f"📌 **{task}**\n⏰ Due: {dt.strftime('%d.%m.%Y at %H:%M')}\n🔔 Reminder: {remind_days} day(s) before"
#                send_message(vk, user_id, msg, get_deadline_keyboard(did))
#        return
#    
#    # Add deadline instruction
#    if text == "➕ Add deadline":
#        msg = """📝 **Add a deadline:**
#
#Send the command in this format:
#`/deadline <task> <date> <remind_days>`
#
#📅 **Date format:** YYYY-MM-DD HH:MM
#
#**Example:** `/deadline Physics report 2025-12-20 23:59 2`
#
#This will remind you 2 days before the deadline!"""
#        send_message(vk, user_id, msg, get_main_keyboard())
#        return
#    
#    # Add class command
#    if text.startswith("/add"):
#        parts = text.split()
#        if len(parts) == 5:
#            _, subject, day_str, start_time, end_time = parts
#            if day_str.isdigit() and 0 <= int(day_str) <= 6:
#                add_schedule(user_id, subject, int(day_str), start_time, end_time)
#                days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
#                send_message(vk, user_id, f"✅ Added **{subject}** on {days[int(day_str)]} from {start_time} to {end_time}!", get_main_keyboard())
#            else:
#                send_message(vk, user_id, "❌ Day must be between 0 (Monday) and 6 (Sunday).", get_main_keyboard())
#        else:
#            send_message(vk, user_id, "❌ Format: `/add <subject> <day> <start> <end>`\nExample: `/add Math 1 10:30 12:05`", get_main_keyboard())
#        return
#    
#    # Add deadline command
#    if text.startswith("/deadline"):
#        parts = text.split(maxsplit=3)
#        if len(parts) == 4:
#            _, task, due_date, remind_days = parts
#            if remind_days.isdigit():
#                add_deadline(user_id, task, due_date, int(remind_days))
#                send_message(vk, user_id, f"✅ Task **{task}** saved! I'll remind you {remind_days} day(s) before the deadline.", get_main_keyboard())
#            else:
#                send_message(vk, user_id, "❌ Reminder days must be a number.", get_main_keyboard())
#        else:
#            send_message(vk, user_id, "❌ Format: `/deadline <task> <YYYY-MM-DD HH:MM> <days>`\nExample: `/deadline Homework 2025-12-20 23:59 2`", get_main_keyboard())
#        return
#    
#    # Default response for unknown messages
#    if text and not text.startswith('/'):
#        send_message(vk, user_id, f"👋 Hello! I'm your study assistant. Try sending **/help** to see what I can do!\n\n(You said: \"{text[:50]}\")", get_main_keyboard())
#    elif text:
#        send_message(vk, user_id, "❓ I don't recognize that command. Type **/help** to see all available commands!", get_main_keyboard())
#
## ========== INLINE BUTTON HANDLING ==========
#def handle_payload(vk, user_id, payload):
#    if payload.get("cmd") == "mark_done":
#        did = payload["did"]
#        mark_deadline_done(did, user_id)
#        send_message(vk, user_id, "✅ Task completed! Great work! 🎉", get_main_keyboard())
#
## ========== MAIN LOOP ==========
#def main():
#    print("=" * 50)
#    print("🤖 Starting VK Study Assistant Bot...")
#    print("=" * 50)
#    
#    try:
#        # Initialize VK session with just the token (no auth() needed for group token)
#        vk_session = vk_api.VkApi(token=VK_TOKEN)
#        vk = vk_session.get_api()
#        
#        # Get group info to verify connection
#        try:
#            group = vk.groups.getById(group_id=GROUP_ID)[0]
#            print(f"✅ Bot connected to group: {group['name']}")
#            print(f"📱 Group ID: {GROUP_ID}")
#            print(f"🌍 Timezone: {TIMEZONE}")
#        except Exception as e:
#            print(f"⚠️ Could not verify group: {e}")
#            print("But the bot should still work!")
#        
#        print("-" * 50)
#        print("🎯 Bot is now listening for messages...")
#        print("💡 Press Ctrl+C to stop the bot")
#        print("=" * 50 + "\n")
#        
#        # Initialize long poll
#        longpoll = VkBotLongPoll(vk_session, GROUP_ID)
#        
#        # Process events
#        for event in longpoll.listen():
#            if event.type == VkBotEventType.MESSAGE_NEW:
#                try:
#                    msg = event.object.message
#                    user_id = msg["from_id"]
#                    text = msg.get("text", "").strip()
#                    attachments = msg.get("attachments", [])
#                    
#                    # Handle file attachments
#                    ics_attachments = [att for att in attachments if att["type"] == "doc" and att["doc"]["title"].endswith(".ics")]
#                    if ics_attachments:
#                        url = ics_attachments[0]["doc"]["url"]
#                        resp = requests.get(url)
#                        if resp.status_code == 200:
#                            count = parse_ics_and_save(user_id, resp.text)
#                            send_message(vk, user_id, f"✅ Imported {count} classes from your ICS file! 🎉", get_main_keyboard())
#                        else:
#                            send_message(vk, user_id, "❌ Failed to read the file. Please try again.", get_main_keyboard())
#                        continue
#                    
#                    # Handle inline button payloads
#                    payload = msg.get("payload")
#                    if payload:
#                        try:
#                            payload = json.loads(payload)
#                            handle_payload(vk, user_id, payload)
#                        except:
#                            pass
#                        continue
#                    
#                    # Handle normal messages
#                    if text:
#                        handle_message(vk, user_id, text, attachments)
#                    else:
#                        send_message(vk, user_id, "👋 Hello! Send /help to see what I can do!", get_main_keyboard())
#                        
#                except Exception as e:
#                    logging.error(f"Error processing message: {e}")
#                    try:
#                        send_message(vk, user_id, "❌ Sorry, something went wrong. Please try again later.", get_main_keyboard())
#                    except:
#                        pass
#                    
#    except KeyboardInterrupt:
#        print("\n" + "=" * 50)
#        print("🛑 Bot stopped by user")
#        print("👋 Goodbye!")
#        print("=" * 50)
#    except Exception as e:
#        print(f"\n❌ Fatal error: {e}")
#        logging.error(f"Fatal error: {e}")
#
#if __name__ == "__main__":
#    main()
#
#
#    
#import logging
#import sqlite3
#import json
#import requests
#from datetime import datetime, timedelta
#import vk_api
#from vk_api.bot_longpoll import VkBotLongPoll, VkBotEventType
#from vk_api.keyboard import VkKeyboard, VkKeyboardColor
#from vk_api.utils import get_random_id
#from icalendar import Calendar
#from apscheduler.schedulers.background import BackgroundScheduler
#import pytz
#import re
#from langdetect import detect, detect_langs
#from googletrans import Translator
#import warnings
#warnings.filterwarnings('ignore')
#
## ========== CONFIGURATION ==========
#VK_TOKEN = "vk1.a.eZvEbyVQo2aLD4K-r_7DxudJLQ4iNke42CLOnxo-ewzkJhDCjgY-FFImW2JeNulCAByv9bzkSuo_VXZFEV1GbMGoTfjD_TlDUV_pfIIfXU2eJvNsYIVFvVRa7OQxAhzGJPle69aDCxH7jYlu-LbbfSLM-9ZVDiOkmo3zSdgiWYegoSqKJqtGAGoyldsJYC79Fc9up1aNsvk3uJ3NZaE6Xg"
#GROUP_ID = 237363984
#TIMEZONE = pytz.timezone("Asia/Novosibirsk")
#
#logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
#
## ========== TRANSLATION SETUP ==========
#translator = Translator()
#
## Response templates in English (will be translated to any language)
#RESPONSE_TEMPLATES = {
#    'welcome': "👋 Hello! I'm your study assistant! I can help you with schedule, deadlines, and reminders.",
#    'schedule_header': "📚 Your Schedule:",
#    'empty_schedule': "📭 Your schedule is empty. Send an ICS file, use /add command, or say 'add class'.",
#    'class_added': "✅ Added class: {subject} on {day} from {start} to {end}",
#    'no_tasks': "✅ You have no pending tasks! Great job! 🎉",
#    'tasks_header': "📋 You have {count} pending task(s):",
#    'task_completed': "✅ Task completed! Great work! 🎉",
#    'class_reminder': "🔔 Reminder! Class '{subject}' starts in {minutes} minutes at {start_time}",
#    'deadline_reminder': "⚠️ Deadline reminder! '{task}' is due in {days} day(s) on {due_date}",
#    'unknown': "I didn't understand. You can ask about schedule, tasks, or say 'help' for commands.",
#    'add_class_prompt': "📝 To add a class, send:\n/add <subject> <day> <start> <end>\n\nDays: 0=Mon,1=Tue,2=Wed,3=Thu,4=Fri,5=Sat,6=Sun\nExample: /add Mathematics 1 10:30 12:05",
#    'add_deadline_prompt': "📝 To add a deadline, send:\n/deadline <task> <YYYY-MM-DD HH:MM> <remind_days>\nExample: /deadline Final project 2025-12-20 23:59 7",
#    'importing': "⏳ Importing schedule from URL... Please wait.",
#    'import_success': "✅ Successfully imported {count} classes! 🎉",
#    'import_fail': "❌ Failed to download the ICS file. Please check the URL.",
#    'help_text': """🤖 **Study Assistant Bot - Help**
#
#📅 **Schedule Management:**
#• Send an ICS file or URL
#• Use /add command for manual entry
#• Say "my schedule" to view
#• Automatic reminders 60-90 minutes before class
#
#📝 **Task Management:**
#• Use /deadline command to add tasks
#• Say "my tasks" to view pending tasks
#• Click ✅ Done to complete tasks
#
#💡 **Natural Language:**
#Just speak naturally in ANY language!
#- "Show my schedule"
#- "What tasks do I have?"
#- "Add a new class"
#- "Help me"
#
#⚙️ **Commands:**
#/ics <url> - Import from URL
#/add <subject> <day> <start> <end>
#/deadline <task> <date> <days>
#/help - Show this help
#
#🌍 I understand ANY language!"""
#}
#
## ========== DATABASE INIT ==========
#def init_db():
#    conn = sqlite3.connect("student_bot.db")
#    c = conn.cursor()
#    c.execute("""CREATE TABLE IF NOT EXISTS users (
#        vk_id INTEGER PRIMARY KEY,
#        notify_offset INTEGER DEFAULT 75,
#        preferred_language TEXT DEFAULT 'en'
#    )""")
#    c.execute("""CREATE TABLE IF NOT EXISTS schedule (
#        id INTEGER PRIMARY KEY AUTOINCREMENT,
#        user_id INTEGER,
#        subject TEXT,
#        day_of_week INTEGER,
#        start_time TEXT,
#        end_time TEXT
#    )""")
#    c.execute("""CREATE TABLE IF NOT EXISTS deadlines (
#        id INTEGER PRIMARY KEY AUTOINCREMENT,
#        user_id INTEGER,
#        task TEXT,
#        due_date TEXT,
#        remind_days INTEGER,
#        done BOOLEAN DEFAULT 0
#    )""")
#    c.execute("""CREATE TABLE IF NOT EXISTS reminders (
#        key TEXT PRIMARY KEY,
#        value TEXT,
#        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
#    )""")
#    conn.commit()
#    conn.close()
#
#init_db()
#
## ========== LANGUAGE DETECTION & TRANSLATION ==========
#def detect_user_language(user_id):
#    """Get user's preferred language from database"""
#    conn = sqlite3.connect("student_bot.db")
#    c = conn.cursor()
#    c.execute("SELECT preferred_language FROM users WHERE vk_id = ?", (user_id,))
#    row = c.fetchone()
#    conn.close()
#    return row[0] if row else None
#
#def set_user_language(user_id, language_code):
#    """Save user's preferred language"""
#    conn = sqlite3.connect("student_bot.db")
#    c = conn.cursor()
#    c.execute("UPDATE users SET preferred_language = ? WHERE vk_id = ?", (language_code, user_id))
#    conn.commit()
#    conn.close()
#
#def detect_language_from_text(text):
#    """Detect language from any text (supports all languages)"""
#    try:
#        if not text or len(text.strip()) < 3:
#            return 'en'
#        
#        # Clean the text
#        clean_text = re.sub(r'[^a-zA-Zа-яА-Я\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]', ' ', text.lower())
#        
#        # Detect language
#        detected = detect(clean_text)
#        return detected
#    except:
#        return 'en'  # Default to English if detection fails
#
#def translate_to_user_language(user_id, text, target_lang=None):
#    """Translate text to user's preferred language"""
#    try:
#        if target_lang is None:
#            target_lang = detect_user_language(user_id)
#        
#        if not target_lang or target_lang == 'en':
#            return text
#        
#        # Translate to target language
#        translated = translator.translate(text, dest=target_lang)
#        return translated.text
#    except Exception as e:
#        logging.error(f"Translation error: {e}")
#        return text
#
#def get_response(user_id, template_key, **kwargs):
#    """Get response in user's language with variables"""
#    try:
#        # Get user's language
#        user_lang = detect_user_language(user_id)
#        
#        # Get template in English
#        template_text = RESPONSE_TEMPLATES.get(template_key, template_key)
#        
#        # Fill in variables
#        if kwargs:
#            try:
#                template_text = template_text.format(**kwargs)
#            except:
#                pass
#        
#        # Translate to user's language if needed
#        if user_lang and user_lang != 'en':
#            translated = translator.translate(template_text, dest=user_lang)
#            return translated.text
#        
#        return template_text
#    except Exception as e:
#        logging.error(f"Response error: {e}")
#        return RESPONSE_TEMPLATES.get(template_key, template_key)
#
## ========== NATURAL LANGUAGE UNDERSTANDING (Multi-language) ==========
#def understand_intent(text, user_lang='en'):
#    """Understand user intent in ANY language using keyword matching and translation"""
#    text_lower = text.lower()
#    
#    # Translate to English for better intent detection if needed
#    english_text = text_lower
#    if user_lang != 'en':
#        try:
#            translated = translator.translate(text, dest='en')
#            english_text = translated.text.lower()
#        except:
#            pass
#    
#    # Intent patterns (keywords in English after translation)
#    intents = {
#        'show_schedule': ['schedule', 'timetable', 'classes', 'my classes', 'today\'s classes', 'show schedule', 'view schedule', 'what classes', 'расписание', 'занятия', 'уроки'],
#        'show_tasks': ['task', 'tasks', 'deadline', 'deadlines', 'homework', 'assignment', 'my tasks', 'pending tasks', 'what tasks', 'due', 'задачи', 'дедлайн', 'домашка', 'задания'],
#        'add_class': ['add class', 'new class', 'add course', 'create class', 'добавить занятие', 'новая пара', 'добавить пару'],
#        'add_deadline': ['add deadline', 'new deadline', 'add task', 'create task', 'добавить дедлайн', 'новая задача', 'добавить задачу'],
#        'help': ['help', 'commands', 'what can you do', 'how to use', 'помощь', 'команды', 'что ты умеешь'],
#        'greeting': ['hello', 'hi', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening', 'привет', 'здравствуй', 'добрый']
#    }
#    
#    # Check each intent
#    for intent, keywords in intents.items():
#        if any(keyword in english_text for keyword in keywords):
#            return intent
#    
#    # Check for ICS URL
#    if text.startswith(('http://', 'https://')) or '/ics' in text:
#        return 'ics_url'
#    
#    # Check for commands
#    if text.startswith('/'):
#        if text.startswith('/add'):
#            return 'add_class_command'
#        elif text.startswith('/deadline'):
#            return 'add_deadline_command'
#        elif text.startswith('/ics'):
#            return 'ics_command'
#        elif text.startswith('/help'):
#            return 'help'
#    
#    return 'unknown'
#
## ========== DATABASE HELPERS ==========
#def get_user_offset(user_id):
#    conn = sqlite3.connect("student_bot.db")
#    c = conn.cursor()
#    c.execute("SELECT notify_offset FROM users WHERE vk_id = ?", (user_id,))
#    row = c.fetchone()
#    conn.close()
#    return row[0] if row else 75
#
#def add_schedule(user_id, subject, day_of_week, start_time, end_time):
#    conn = sqlite3.connect("student_bot.db")
#    c = conn.cursor()
#    c.execute("INSERT INTO schedule (user_id, subject, day_of_week, start_time, end_time) VALUES (?,?,?,?,?)",
#              (user_id, subject, day_of_week, start_time, end_time))
#    conn.commit()
#    conn.close()
#
#def get_schedule(user_id):
#    conn = sqlite3.connect("student_bot.db")
#    c = conn.cursor()
#    c.execute("SELECT subject, day_of_week, start_time, end_time FROM schedule WHERE user_id = ? ORDER BY day_of_week, start_time", (user_id,))
#    rows = c.fetchall()
#    conn.close()
#    return rows
#
#def add_deadline(user_id, task, due_date, remind_days):
#    conn = sqlite3.connect("student_bot.db")
#    c = conn.cursor()
#    c.execute("INSERT INTO deadlines (user_id, task, due_date, remind_days, done) VALUES (?,?,?,?,0)",
#              (user_id, task, due_date, remind_days))
#    conn.commit()
#    conn.close()
#
#def get_deadlines(user_id, only_pending=True):
#    conn = sqlite3.connect("student_bot.db")
#    c = conn.cursor()
#    if only_pending:
#        c.execute("SELECT id, task, due_date, remind_days FROM deadlines WHERE user_id=? AND done=0 ORDER BY due_date", (user_id,))
#    else:
#        c.execute("SELECT id, task, due_date, remind_days, done FROM deadlines WHERE user_id=? ORDER BY due_date", (user_id,))
#    rows = c.fetchall()
#    conn.close()
#    return rows
#
#def mark_deadline_done(deadline_id, user_id):
#    conn = sqlite3.connect("student_bot.db")
#    c = conn.cursor()
#    c.execute("UPDATE deadlines SET done=1 WHERE id=? AND user_id=?", (deadline_id, user_id))
#    conn.commit()
#    conn.close()
#
## ========== ICS PARSING ==========
#def parse_ics_and_save(user_id, ics_content):
#    try:
#        cal = Calendar.from_ical(ics_content)
#        count = 0
#        for component in cal.walk():
#            if component.name == "VEVENT":
#                subject = str(component.get('SUMMARY', 'No title'))
#                dtstart = component.get('DTSTART')
#                dtend = component.get('DTEND')
#                if dtstart is None or dtend is None:
#                    continue
#                start = dtstart.dt
#                end = dtend.dt
#                if not isinstance(start, datetime):
#                    start = datetime.combine(start, datetime.min.time())
#                if not isinstance(end, datetime):
#                    end = datetime.combine(end, datetime.min.time())
#                day_of_week = start.weekday()
#                start_time = start.strftime("%H:%M")
#                end_time = end.strftime("%H:%M")
#                add_schedule(user_id, subject, day_of_week, start_time, end_time)
#                count += 1
#        return count
#    except Exception as e:
#        logging.error(f"ICS parsing error: {e}")
#        return 0
#
#def parse_ics_from_url(user_id, ics_url):
#    try:
#        response = requests.get(ics_url, timeout=30)
#        response.raise_for_status()
#        return parse_ics_and_save(user_id, response.text)
#    except Exception as e:
#        logging.error(f"URL download failed: {e}")
#        return -1
#
## ========== KEYBOARDS (Auto-translated) ==========
#def get_main_keyboard(user_id):
#    """Get keyboard with buttons in user's language"""
#    keyboard = VkKeyboard(one_time=False)
#    
#    # Get button texts in user's language
#    texts = {
#        'schedule': get_response(user_id, 'schedule_header').split(':')[0].strip(),
#        'add_class': "➕ Add Class",
#        'tasks': "📝 My Tasks", 
#        'add_deadline': "➕ Add Deadline",
#        'help': "❓ Help"
#    }
#    
#    # Translate button texts
#    user_lang = detect_user_language(user_id)
#    if user_lang and user_lang != 'en':
#        try:
#            texts['add_class'] = translator.translate("➕ Add Class", dest=user_lang).text
#            texts['tasks'] = translator.translate("📝 My Tasks", dest=user_lang).text
#            texts['add_deadline'] = translator.translate("➕ Add Deadline", dest=user_lang).text
#            texts['help'] = translator.translate("❓ Help", dest=user_lang).text
#        except:
#            pass
#    
#    keyboard.add_button(texts['schedule'], color=VkKeyboardColor.PRIMARY)
#    keyboard.add_button(texts['add_class'], color=VkKeyboardColor.POSITIVE)
#    keyboard.add_line()
#    keyboard.add_button(texts['tasks'], color=VkKeyboardColor.SECONDARY)
#    keyboard.add_button(texts['add_deadline'], color=VkKeyboardColor.POSITIVE)
#    keyboard.add_line()
#    keyboard.add_button(texts['help'], color=VkKeyboardColor.PRIMARY)
#    
#    return keyboard.get_keyboard()
#
#def get_deadline_keyboard(user_id, deadline_id):
#    keyboard = VkKeyboard(inline=True)
#    done_text = get_response(user_id, 'task_completed').split('!')[0] + "!"
#    keyboard.add_button(done_text, color=VkKeyboardColor.POSITIVE, payload={"cmd": "mark_done", "did": deadline_id})
#    return keyboard.get_keyboard()
#
## ========== SEND MESSAGE ==========
#def send_message(vk, user_id, text, keyboard=None):
#    try:
#        if keyboard is None:
#            keyboard = VkKeyboard().get_empty_keyboard()
#        
#        vk.messages.send(
#            user_id=user_id,
#            message=text,
#            random_id=get_random_id(),
#            keyboard=keyboard
#        )
#        logging.info(f"Sent message to {user_id}")
#    except Exception as e:
#        logging.error(f"Error sending message to {user_id}: {e}")
#
## ========== MULTI-LANGUAGE MESSAGE HANDLING ==========
#def handle_message(vk, user_id, text, attachments):
#    # Detect language from message
#    detected_lang = detect_language_from_text(text)
#    
#    # Get or set user's language preference
#    user_lang = detect_user_language(user_id)
#    if not user_lang:
#        # First time user - save their language
#        conn = sqlite3.connect("student_bot.db")
#        c = conn.cursor()
#        c.execute("INSERT INTO users (vk_id, preferred_language) VALUES (?, ?)", (user_id, detected_lang))
#        conn.commit()
#        conn.close()
#        user_lang = detected_lang
#    
#    # Understand intent
#    intent = understand_intent(text, user_lang)
#    
#    # Handle different intents
#    if intent == 'show_schedule':
#        sched = get_schedule(user_id)
#        if not sched:
#            response = get_response(user_id, 'empty_schedule')
#            send_message(vk, user_id, response, get_main_keyboard(user_id))
#        else:
#            days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
#            msg = get_response(user_id, 'schedule_header') + "\n\n"
#            current_day = None
#            for subj, dow, start, end in sched:
#                if current_day != days[dow]:
#                    current_day = days[dow]
#                    # Translate day name if needed
#                    if user_lang != 'en':
#                        try:
#                            current_day = translator.translate(current_day, dest=user_lang).text
#                        except:
#                            pass
#                    msg += f"\n**{current_day}:**\n"
#                msg += f"  • {start}-{end} - {subj}\n"
#            send_message(vk, user_id, msg, get_main_keyboard(user_id))
#    
#    elif intent == 'show_tasks':
#        deadlines = get_deadlines(user_id, only_pending=True)
#        if not deadlines:
#            response = get_response(user_id, 'no_tasks')
#            send_message(vk, user_id, response, get_main_keyboard(user_id))
#        else:
#            header = get_response(user_id, 'tasks_header', count=len(deadlines))
#            send_message(vk, user_id, header, get_main_keyboard(user_id))
#            for did, task, due_date, remind_days in deadlines:
#                dt = datetime.strptime(due_date, "%Y-%m-%d %H:%M")
#                date_str = dt.strftime('%d.%m.%Y %H:%M')
#                msg = f"📌 **{task}**\n⏰ {date_str}\n🔔 +{remind_days} day(s)"
#                send_message(vk, user_id, msg, get_deadline_keyboard(user_id, did))
#    
#    elif intent == 'add_class':
#        response = get_response(user_id, 'add_class_prompt')
#        send_message(vk, user_id, response, get_main_keyboard(user_id))
#    
#    elif intent == 'add_deadline':
#        response = get_response(user_id, 'add_deadline_prompt')
#        send_message(vk, user_id, response, get_main_keyboard(user_id))
#    
#    elif intent == 'help':
#        response = get_response(user_id, 'help_text')
#        send_message(vk, user_id, response, get_main_keyboard(user_id))
#    
#    elif intent == 'greeting':
#        welcome = get_response(user_id, 'welcome')
#        send_message(vk, user_id, welcome, get_main_keyboard(user_id))
#    
#    elif intent in ['ics_command', 'ics_url']:
#        # Extract URL
#        url_match = re.search(r'(https?://[^\s]+)', text)
#        if url_match:
#            ics_url = url_match.group(1)
#            send_message(vk, user_id, get_response(user_id, 'importing'), get_main_keyboard(user_id))
#            count = parse_ics_from_url(user_id, ics_url)
#            if count == -1:
#                send_message(vk, user_id, get_response(user_id, 'import_fail'), get_main_keyboard(user_id))
#            elif count > 0:
#                send_message(vk, user_id, get_response(user_id, 'import_success', count=count), get_main_keyboard(user_id))
#        else:
#            send_message(vk, user_id, "Send: /ics <URL>", get_main_keyboard(user_id))
#    
#    elif intent == 'add_class_command':
#        parts = text.split()
#        if len(parts) == 5:
#            _, subject, day_str, start_time, end_time = parts
#            if day_str.isdigit() and 0 <= int(day_str) <= 6:
#                add_schedule(user_id, subject, int(day_str), start_time, end_time)
#                days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
#                if user_lang != 'en':
#                    try:
#                        days = [translator.translate(day, dest=user_lang).text for day in days]
#                    except:
#                        pass
#                response = get_response(user_id, 'class_added', subject=subject, day=days[int(day_str)], start=start_time, end=end_time)
#                send_message(vk, user_id, response, get_main_keyboard(user_id))
#            else:
#                send_message(vk, user_id, get_response(user_id, 'add_class_prompt'), get_main_keyboard(user_id))
#        else:
#            send_message(vk, user_id, get_response(user_id, 'add_class_prompt'), get_main_keyboard(user_id))
#    
#    elif intent == 'add_deadline_command':
#        parts = text.split(maxsplit=3)
#        if len(parts) == 4:
#            _, task, due_date, remind_days = parts
#            if remind_days.isdigit():
#                add_deadline(user_id, task, due_date, int(remind_days))
#                response = get_response(user_id, 'task_completed')
#                send_message(vk, user_id, response, get_main_keyboard(user_id))
#            else:
#                send_message(vk, user_id, get_response(user_id, 'add_deadline_prompt'), get_main_keyboard(user_id))
#        else:
#            send_message(vk, user_id, get_response(user_id, 'add_deadline_prompt'), get_main_keyboard(user_id))
#    
#    else:
#        response = get_response(user_id, 'unknown')
#        send_message(vk, user_id, response, get_main_keyboard(user_id))
#
## ========== REMINDER SCHEDULER ==========
#def check_and_send_reminders(vk):
#    """Check for classes and send reminders"""
#    conn = sqlite3.connect("student_bot.db")
#    c = conn.cursor()
#    now = datetime.now(TIMEZONE)
#    current_day = now.weekday()
#    
#    # Get all users
#    c.execute("SELECT DISTINCT user_id FROM schedule")
#    users = c.fetchall()
#    
#    for (user_id,) in users:
#        # Get user's language
#        c.execute("SELECT preferred_language, notify_offset FROM users WHERE vk_id = ?", (user_id,))
#        user_data = c.fetchone()
#        if not user_data:
#            continue
#        user_lang = user_data[0] if user_data[0] else 'en'
#        notify_offset = user_data[1] if user_data[1] else 75
#        
#        # Get today's schedule
#        c.execute("SELECT subject, start_time, end_time FROM schedule WHERE user_id = ? AND day_of_week = ?", 
#                  (user_id, current_day))
#        classes = c.fetchall()
#        
#        for subject, start_time, end_time in classes:
#            # Parse class time
#            class_hour, class_minute = map(int, start_time.split(':'))
#            class_datetime = now.replace(hour=class_hour, minute=class_minute, second=0, microsecond=0)
#            
#            # Calculate minutes until class
#            minutes_until = (class_datetime - now).total_seconds() / 60
#            
#            # Send reminder if class is in 60-90 minutes
#            if 60 <= minutes_until <= 90:
#                reminder_key = f"reminder_{user_id}_{current_day}_{start_time}"
#                c.execute("SELECT value FROM reminders WHERE key = ?", (reminder_key,))
#                already_reminded = c.fetchone()
#                
#                if not already_reminded:
#                    # Get reminder text in user's language
#                    reminder_text = get_response(user_id, 'class_reminder', minutes=int(minutes_until), subject=subject, start_time=start_time)
#                    send_message(vk, user_id, reminder_text, get_main_keyboard(user_id))
#                    
#                    # Store reminder sent
#                    c.execute("INSERT OR REPLACE INTO reminders (key, value) VALUES (?, ?)", (reminder_key, "sent"))
#                    conn.commit()
#    
#    # Clean old reminders
#    c.execute("DELETE FROM reminders WHERE datetime(timestamp) < datetime('now', '-1 day')")
#    conn.commit()
#    conn.close()
#
## ========== SCHEDULER ==========
#scheduler = BackgroundScheduler()
#
#def start_scheduler(vk):
#    scheduler.add_job(func=lambda: check_and_send_reminders(vk), trigger="interval", minutes=5)
#    scheduler.start()
#
## ========== INLINE BUTTON HANDLING ==========
#def handle_payload(vk, user_id, payload):
#    if payload.get("cmd") == "mark_done":
#        did = payload["did"]
#        mark_deadline_done(did, user_id)
#        response = get_response(user_id, 'task_completed')
#        send_message(vk, user_id, response, get_main_keyboard(user_id))
#
## ========== MAIN LOOP ==========
#def main():
#    print("=" * 60)
#    print("🌍 Starting VK Study Assistant Bot (Universal Multilingual)")
#    print("=" * 60)
#    
#    try:
#        # Initialize VK session
#        vk_session = vk_api.VkApi(token=VK_TOKEN)
#        vk = vk_session.get_api()
#        
#        # Verify connection
#        try:
#            group = vk.groups.getById(group_id=GROUP_ID)[0]
#            print(f"✅ Bot connected to group: {group['name']}")
#            print(f"📱 Group ID: {GROUP_ID}")
#            print(f"🌍 Timezone: {TIMEZONE}")
#            print(f"🗣️ Language Support: ANY language (auto-detected)")
#            print(f"⏰ Class reminders: 60-90 minutes before each class")
#        except Exception as e:
#            print(f"⚠️ Could not verify group: {e}")
#        
#        print("-" * 60)
#        print("🎯 Bot is now listening for messages...")
#        print("💡 Speak naturally in ANY language!")
#        print("   Examples:")
#        print("   • English: 'Show my schedule'")
#        print("   • Russian: 'Покажи расписание'")
#        print("   • Spanish: 'Mostrar mi horario'")
#        print("   • German: 'Zeige meinen Stundenplan'")
#        print("   • Japanese: 'スケジュールを表示'")
#        print("   • ANY language works!")
#        print("💡 Press Ctrl+C to stop the bot")
#        print("=" * 60 + "\n")
#        
#        # Start reminder scheduler
#        start_scheduler(vk)
#        print("✅ Reminder system active - checking every 5 minutes\n")
#        
#        # Initialize long poll
#        longpoll = VkBotLongPoll(vk_session, GROUP_ID)
#        
#        # Process events
#        for event in longpoll.listen():
#            if event.type == VkBotEventType.MESSAGE_NEW:
#                try:
#                    msg = event.object.message
#                    user_id = msg["from_id"]
#                    text = msg.get("text", "").strip()
#                    attachments = msg.get("attachments", [])
#                    
#                    # Handle file attachments
#                    ics_attachments = [att for att in attachments if att["type"] == "doc" and att["doc"]["title"].endswith(".ics")]
#                    if ics_attachments:
#                        url = ics_attachments[0]["doc"]["url"]
#                        resp = requests.get(url)
#                        if resp.status_code == 200:
#                            count = parse_ics_and_save(user_id, resp.text)
#                            response = get_response(user_id, 'import_success', count=count)
#                            send_message(vk, user_id, response, get_main_keyboard(user_id))
#                        else:
#                            send_message(vk, user_id, "❌ Failed to read file", get_main_keyboard(user_id))
#                        continue
#                    
#                    # Handle inline button payloads
#                    payload = msg.get("payload")
#                    if payload:
#                        try:
#                            payload = json.loads(payload)
#                            handle_payload(vk, user_id, payload)
#                        except:
#                            pass
#                        continue
#                    
#                    # Handle normal messages
#                    if text:
#                        handle_message(vk, user_id, text, attachments)
#                    else:
#                        welcome = get_response(user_id, 'welcome')
#                        send_message(vk, user_id, welcome, get_main_keyboard(user_id))
#                        
#                except Exception as e:
#                    logging.error(f"Error processing message: {e}")
#                    
#    except KeyboardInterrupt:
#        print("\n" + "=" * 60)
#        print("🛑 Bot stopped by user")
#        print("👋 Goodbye!")
#        print("=" * 60)
#    except Exception as e:
#        print(f"\n❌ Fatal error: {e}")
#        logging.error(f"Fatal error: {e}")
#
#if __name__ == "__main__":
#    main()


#import logging
#import sqlite3
#import json
#import requests
#from datetime import datetime, timedelta
#import vk_api
#from vk_api.bot_longpoll import VkBotLongPoll, VkBotEventType
#from vk_api.keyboard import VkKeyboard, VkKeyboardColor
#from vk_api.utils import get_random_id
#from icalendar import Calendar
#from apscheduler.schedulers.background import BackgroundScheduler
#import pytz
#import re
#from collections import defaultdict
#import random
#
#
#
## ========== CONFIGURATION ==========
#VK_TOKEN = "vk1.a.eZvEbyVQo2aLD4K-r_7DxudJLQ4iNke42CLOnxo-ewzkJhDCjgY-FFImW2JeNulCAByv9bzkSuo_VXZFEV1GbMGoTfjD_TlDUV_pfIIfXU2eJvNsYIVFvVRa7OQxAhzGJPle69aDCxH7jYlu-LbbfSLM-9ZVDiOkmo3zSdgiWYegoSqKJqtGAGoyldsJYC79Fc9up1aNsvk3uJ3NZaE6Xg"
#GROUP_ID = 237363984
#TIMEZONE = pytz.timezone("Asia/Novosibirsk")
#
#logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
#
## ========== SMART LANGUAGE DETECTION ==========
#class SmartLanguageDetector:
#    @staticmethod
#    def detect(text):
#        if not text or len(text.strip()) < 2:
#            return 'en'
#        
#        text_lower = text.lower()
#        
#        # Check for Russian characters (Cyrillic)
#        cyrillic_count = sum(1 for c in text_lower if '\u0400' <= c <= '\u04FF')
#        if cyrillic_count > len(text) * 0.1:
#            return 'ru'
#        
#        # Common Russian words
#        russian_words = ['привет', 'здравствуй', 'расписание', 'помощь', 'спасибо', 'пожалуйста', 'что', 'как', 'где']
#        if any(word in text_lower for word in russian_words):
#            return 'ru'
#        
#        return 'en'
#    
#    @staticmethod
#    def get_name(code):
#        return 'Russian' if code == 'ru' else 'English'
#
## ========== DATABASE WITH CONTEXT MEMORY ==========
#def init_db():
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("""CREATE TABLE IF NOT EXISTS users (
#        vk_id INTEGER PRIMARY KEY,
#        language TEXT DEFAULT 'en',
#        name TEXT DEFAULT '',
#        last_interaction DATETIME DEFAULT CURRENT_TIMESTAMP,
#        conversation_context TEXT DEFAULT ''
#    )""")
#    c.execute("""CREATE TABLE IF NOT EXISTS schedule (
#        id INTEGER PRIMARY KEY AUTOINCREMENT,
#        user_id INTEGER,
#        subject TEXT,
#        day_of_week INTEGER,
#        start_time TEXT,
#        end_time TEXT,
#        location TEXT DEFAULT '',
#        teacher TEXT DEFAULT '',
#        notes TEXT DEFAULT ''
#    )""")
#    c.execute("""CREATE TABLE IF NOT EXISTS deadlines (
#        id INTEGER PRIMARY KEY AUTOINCREMENT,
#        user_id INTEGER,
#        task TEXT,
#        due_date TEXT,
#        remind_days INTEGER,
#        priority TEXT DEFAULT 'normal',
#        notes TEXT DEFAULT '',
#        done INTEGER DEFAULT 0
#    )""")
#    c.execute("""CREATE TABLE IF NOT EXISTS reminders (
#        key TEXT PRIMARY KEY,
#        value TEXT,
#        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
#    )""")
#    c.execute("""CREATE TABLE IF NOT EXISTS conversations (
#        id INTEGER PRIMARY KEY AUTOINCREMENT,
#        user_id INTEGER,
#        message TEXT,
#        response TEXT,
#        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
#    )""")
#    conn.commit()
#    conn.close()
#
#init_db()
#
## ========== USER MANAGEMENT ==========
#def get_user_lang(user_id):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("SELECT language FROM users WHERE vk_id = ?", (user_id,))
#    row = c.fetchone()
#    conn.close()
#    return row[0] if row else 'en'
#
#def set_user_lang(user_id, lang):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("INSERT OR REPLACE INTO users (vk_id, language) VALUES (?, ?)", (user_id, lang))
#    conn.commit()
#    conn.close()
#
#def get_user_name(user_id):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("SELECT name FROM users WHERE vk_id = ?", (user_id,))
#    row = c.fetchone()
#    conn.close()
#    return row[0] if row else None
#
#def set_user_name(user_id, name):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("UPDATE users SET name = ? WHERE vk_id = ?", (name, user_id))
#    conn.commit()
#    conn.close()
#
#def save_conversation(user_id, message, response):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("INSERT INTO conversations (user_id, message, response) VALUES (?, ?, ?)", (user_id, message, response))
#    conn.commit()
#    conn.close()
#
## ========== SCHEDULE MANAGEMENT ==========
#def add_class(user_id, subject, day, start, end, location='', teacher=''):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("""INSERT INTO schedule (user_id, subject, day_of_week, start_time, end_time, location, teacher) 
#                 VALUES (?,?,?,?,?,?,?)""", (user_id, subject, day, start, end, location, teacher))
#    conn.commit()
#    conn.close()
#
#def get_today_schedule(user_id):
#    today = datetime.now(TIMEZONE).weekday()
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("""SELECT subject, start_time, end_time, location, teacher FROM schedule 
#                 WHERE user_id = ? AND day_of_week = ? ORDER BY start_time""", (user_id, today))
#    rows = c.fetchall()
#    conn.close()
#    return rows
#
#def get_tomorrow_schedule(user_id):
#    tomorrow = (datetime.now(TIMEZONE).weekday() + 1) % 7
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("""SELECT subject, start_time, end_time, location, teacher FROM schedule 
#                 WHERE user_id = ? AND day_of_week = ? ORDER BY start_time""", (user_id, tomorrow))
#    rows = c.fetchall()
#    conn.close()
#    return rows
#
#def get_week_schedule(user_id):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("""SELECT subject, day_of_week, start_time, end_time FROM schedule 
#                 WHERE user_id = ? ORDER BY day_of_week, start_time""", (user_id,))
#    rows = c.fetchall()
#    conn.close()
#    return rows
#
#def find_next_class(user_id):
#    now = datetime.now(TIMEZONE)
#    current_day = now.weekday()
#    current_time = now.strftime("%H:%M")
#    
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("""SELECT subject, day_of_week, start_time, end_time FROM schedule 
#                 WHERE user_id = ? ORDER BY day_of_week, start_time""", (user_id,))
#    classes = c.fetchall()
#    conn.close()
#    
#    # Find next class
#    for subject, day, start, end in classes:
#        if day > current_day or (day == current_day and start > current_time):
#            return {'subject': subject, 'day': day, 'start': start, 'end': end}
#    if classes:
#        first = classes[0]
#        return {'subject': first[0], 'day': first[1], 'start': first[2], 'end': first[3]}
#    return None
#
## ========== DEADLINE MANAGEMENT ==========
#def add_task(user_id, task, due_date, days, priority='normal'):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("""INSERT INTO deadlines (user_id, task, due_date, remind_days, priority, done) 
#                 VALUES (?,?,?,?,?,0)""", (user_id, task, due_date, days, priority))
#    conn.commit()
#    conn.close()
#
#def get_upcoming_tasks(user_id, days=7):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("""SELECT id, task, due_date, priority FROM deadlines 
#                 WHERE user_id = ? AND done = 0 AND date(due_date) <= date('now', '+' || ? || ' days')
#                 ORDER BY due_date""", (user_id, days))
#    rows = c.fetchall()
#    conn.close()
#    return rows
#
#def complete_task(task_id, user_id):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("UPDATE deadlines SET done = 1 WHERE id = ? AND user_id = ?", (task_id, user_id))
#    conn.commit()
#    conn.close()
#
## ========== ICS IMPORT ==========
#
#def import_ics_from_link(user_id, ics_url):
#    """Download and import ICS calendar from a URL"""
#    try:
#        # Download the ICS file
#        response = requests.get(ics_url, timeout=30)
#        response.raise_for_status()
#        
#        # Parse the ICS content
#        cal = Calendar.from_ical(response.text)
#        count = 0
#        
#        for component in cal.walk():
#            if component.name == "VEVENT":
#                subject = str(component.get('SUMMARY', 'Class'))
#                dtstart = component.get('DTSTART')
#                dtend = component.get('DTEND')
#                
#                if dtstart and dtend:
#                    start = dtstart.dt
#                    end = dtend.dt
#                    
#                    # Handle all-day events
#                    if not isinstance(start, datetime):
#                        start = datetime.combine(start, datetime.min.time())
#                    if not isinstance(end, datetime):
#                        end = datetime.combine(end, datetime.min.time())
#                    
#                    # Add to database
#                    day_of_week = start.weekday()
#                    start_time = start.strftime("%H:%M")
#                    end_time = end.strftime("%H:%M")
#                    
#                    add_class(user_id, subject, day_of_week, start_time, end_time)
#                    count += 1
#        
#        return count
#    except requests.exceptions.RequestException as e:
#        logging.error(f"Failed to download ICS: {e}")
#        return -1
#    except Exception as e:
#        logging.error(f"ICS parsing error: {e}")
#
#   
#def import_ics(user_id, content):
#    try:
#        cal = Calendar.from_ical(content)
#        count = 0
#        for component in cal.walk():
#            if component.name == "VEVENT":
#                subject = str(component.get('SUMMARY', 'Class'))
#                dtstart = component.get('DTSTART')
#                dtend = component.get('DTEND')
#                if dtstart and dtend:
#                    start = dtstart.dt
#                    end = dtend.dt
#                    if not isinstance(start, datetime):
#                        start = datetime.combine(start, datetime.min.time())
#                    if not isinstance(end, datetime):
#                        end = datetime.combine(end, datetime.min.time())
#                    add_class(user_id, subject, start.weekday(), start.strftime("%H:%M"), end.strftime("%H:%M"))
#                    count += 1
#        return count
#    except Exception as e:
#        logging.error(f"ICS import error: {e}")
#        return 0
#
## ========== INTELLIGENT RESPONSES ==========
#class IntelligentAssistant:
#    def __init__(self):
#        self.contexts = defaultdict(dict)
#    
#    def understand_intent(self, text, lang='en'):
#        text_lower = text.lower()
#        
#        # Intent patterns
#        intents = {
#            'greeting': ['hi', 'hello', 'hey', 'привет', 'здравствуй', 'добрый день', 'good morning', 'good afternoon'],
#            'schedule_today': ['what classes', 'what do i have', 'today schedule', 'today\'s classes', 'what\'s today', 'расписание на сегодня', 'что сегодня', 'какие пары сегодня'],
#            'schedule_tomorrow': ['tomorrow', 'завтра', 'tomorrow schedule', 'what\'s tomorrow', 'расписание на завтра'],
#            'schedule_week': ['this week', 'whole week', 'week schedule', 'вся неделя', 'расписание на неделю', 'какая неделя'],
#            'next_class': ['next class', 'next lesson', 'what\'s next', 'следующая пара', 'что дальше', 'следующее занятие'],
#            'add_class': ['add class', 'add course', 'new class', 'добавить пару', 'новая пара', 'добавить занятие'],
#            'add_task': ['add task', 'add deadline', 'new task', 'new deadline', 'добавить задачу', 'добавить дедлайн', 'новая задача'],
#            'my_tasks': ['my tasks', 'my deadlines', 'what tasks', 'pending tasks', 'мои задачи', 'мои дедлайны', 'какие задачи'],
#            'complete_task': ['complete', 'done', 'finish', 'завершить', 'готово', 'выполнено'],
#            'help': ['help', 'what can you do', 'commands', 'помощь', 'что ты умеешь', 'команды'],
#            'thanks': ['thanks', 'thank you', 'спасибо', 'благодарю'],
#            'who_are_you': ['who are you', 'what are you', 'who made you', 'кто ты', 'что ты такое'],
#            'time': ['what time', 'current time', 'сколько времени', 'который час'],
#            'date': ['what date', 'today\'s date', 'какое сегодня число', 'сегодняшняя дата'],
#        }
#        
#        for intent, keywords in intents.items():
#            if any(keyword in text_lower for keyword in keywords):
#                return intent
#        
#        return 'unknown'
#    
#    def generate_response(self, user_id, message, lang='en'):
#        intent = self.understand_intent(message, lang)
#        
#        # Day names
#        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
#        if lang == 'ru':
#            days = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"]
#        
#        # Greeting
#        if intent == 'greeting':
#            name = get_user_name(user_id)
#            if name:
#                if lang == 'ru':
#                    return f"Привет, {name}! 👋 Рад тебя видеть! Чем могу помочь сегодня?"
#                return f"Hello, {name}! 👋 Great to see you! How can I help you today?"
#            else:
#                if lang == 'ru':
#                    return f"Привет! 👋 Я твой личный помощник. Как я могу к тебе обращаться?"
#                return f"Hi there! 👋 I'm your personal assistant. What should I call you?"
#        
#        # Today's schedule
#        if intent == 'schedule_today':
#            classes = get_today_schedule(user_id)
#            if not classes:
#                if lang == 'ru':
#                    return "📭 У тебя сегодня нет пар! Можешь отдохнуть или заняться своими делами. 🎉"
#                return "📭 You have no classes today! You can relax or work on your own projects. 🎉"
#            
#            response = "📚 **Today's Schedule:**\n\n" if lang == 'en' else "📚 **Расписание на сегодня:**\n\n"
#            for subject, start, end, location, teacher in classes:
#                response += f"⏰ {start}-{end} • **{subject}**\n"
#                if location:
#                    response += f"   📍 {location}\n"
#                if teacher:
#                    response += f"   👨‍🏫 {teacher}\n"
#                response += "\n"
#            
#            # Add next class reminder
#            next_class = find_next_class(user_id)
#            if next_class:
#                if lang == 'ru':
#                    response += f"\n💡 Следующая пара: **{next_class['subject']}** в {next_class['start']}"
#                else:
#                    response += f"\n💡 Next class: **{next_class['subject']}** at {next_class['start']}"
#            
#            return response
#        
#        # Tomorrow's schedule
#        if intent == 'schedule_tomorrow':
#            classes = get_tomorrow_schedule(user_id)
#            if not classes:
#                if lang == 'ru':
#                    return "📭 Завтра нет пар! Можешь спокойно отдохнуть. 🌟"
#                return "📭 No classes tomorrow! You can have a relaxing day. 🌟"
#            
#            response = "📚 **Tomorrow's Schedule:**\n\n" if lang == 'en' else "📚 **Расписание на завтра:**\n\n"
#            for subject, start, end, location, teacher in classes:
#                response += f"⏰ {start}-{end} • **{subject}**\n"
#                if location:
#                    response += f"   📍 {location}\n"
#                response += "\n"
#            return response
#        
#        # Week schedule
#        if intent == 'schedule_week':
#            classes = get_week_schedule(user_id)
#            if not classes:
#                if lang == 'ru':
#                    return "📭 Расписание пусто. Добавь пары с помощью /add или отправь ICS файл."
#                return "📭 Your schedule is empty. Add classes with /add or upload an ICS file."
#            
#            response = "📚 **Weekly Schedule:**\n\n" if lang == 'en' else "📚 **Расписание на неделю:**\n\n"
#            current_day = None
#            for subject, day, start, end in classes:
#                if current_day != days[day]:
#                    current_day = days[day]
#                    response += f"\n**{current_day}:**\n"
#                response += f"   • {start}-{end} - {subject}\n"
#            return response
#        
#        # Next class
#        if intent == 'next_class':
#            next_class = find_next_class(user_id)
#            if next_class:
#                if lang == 'ru':
#                    return f"⏰ Следующая пара: **{next_class['subject']}** в {next_class['start']}. {'Не опаздывай! 📚' if next_class['start'] else ''}"
#                return f"⏰ Your next class is **{next_class['subject']}** at {next_class['start']}. {'Do not be late! 📚' if next_class['start'] else ''}"
#            else:
#                if lang == 'ru':
#                    return "🎉 У тебя больше нет пар на сегодня! Можешь отдохнуть!"
#                return "🎉 You have no more classes today! Time to relax!"
#        
#        # My tasks
#        if intent == 'my_tasks':
#            tasks = get_upcoming_tasks(user_id)
#            if not tasks:
#                if lang == 'ru':
#                    return "✅ Отлично! У тебя нет pending задач. Продолжай в том же духе! 🎉"
#                return "✅ Great! You have no pending tasks. Keep up the good work! 🎉"
#            
#            response = "📋 **Upcoming Tasks:**\n\n" if lang == 'en' else "📋 **Предстоящие задачи:**\n\n"
#            for tid, task, due_date, priority in tasks:
#                dt = datetime.strptime(due_date, "%Y-%m-%d %H:%M")
#                priority_emoji = "🔴" if priority == 'high' else "🟡" if priority == 'medium' else "🟢"
#                response += f"{priority_emoji} **{task}**\n   ⏰ Due: {dt.strftime('%d.%m.%Y at %H:%M')}\n\n"
#            response += "\n💡 Say 'complete [task name]' when you finish a task!"
#            return response
#        
#        # Help
#        if intent == 'help':
#            if lang == 'ru':
#                return """🤖 **Что я умею:**
#
#📅 **Расписание:**
#• "Что сегодня?" - показать пары на сегодня
#• "Что завтра?" - показать пары на завтра
#• "Что на неделе?" - полное расписание
#• "Следующая пара?" - ближайшее занятие
#• Отправь ICS файл - импорт расписания
#
#📝 **Задачи:**
#• "Мои задачи" - список дедлайнов
#• "Добавить задачу [название] до [дата]"
#• "Готово [название]" - отметить выполненное
#
#💬 **Общение:**
#• Просто говори естественно!
#• Я запоминаю контекст разговора
#• Могу давать советы и напоминания
#
#🌍 Я говорю по-русски и по-английски!"""
#            else:
#                return """🤖 **What I can do:**
#
#📅 **Schedule:**
#• "What's today?" - show today's classes
#• "What about tomorrow?" - show tomorrow's schedule
#• "Show this week" - full weekly schedule
#• "What's next?" - next upcoming class
#• Send an ICS file - import your timetable
#
#📝 **Tasks:**
#• "My tasks" - list all deadlines
#• "Add task [name] by [date]"
#• "Complete [task name]" - mark as done
#
#💬 **Conversation:**
#• Just speak naturally!
#• I remember conversation context
#• I can give advice and reminders
#
#🌍 I speak both English and Russian!"""
#        
#        # Thanks
#        if intent == 'thanks':
#            if lang == 'ru':
#                return "Всегда пожалуйста! 😊 Рад помочь! Нужна еще какая-нибудь помощь?"
#            return "You're welcome! 😊 Happy to help! Anything else I can do for you?"
#        
#        # Who are you
#        if intent == 'who_are_you':
#            if lang == 'ru':
#                return """🤖 Я твой персональный учебный ассистент!
#
#Я помогаю:
#• Следить за расписанием
#• Управлять задачами и дедлайнами
#• Давать напоминания о парах
#• Отвечать на вопросы
#
#Просто говори со мной как с другом! 💙"""
#            return """🤖 I'm your personal study assistant!
#
#I help you with:
#• Tracking your schedule
#• Managing tasks and deadlines
#• Sending class reminders
#• Answering questions
#
#Just talk to me like a friend! 💙"""
#        
#        # Time
#        if intent == 'time':
#            now = datetime.now(TIMEZONE)
#            if lang == 'ru':
#                return f"🕐 Сейчас {now.strftime('%H:%M')} в Новосибирске."
#            return f"🕐 It's currently {now.strftime('%H:%M')} in Novosibirsk."
#        
#        # Date
#        if intent == 'date':
#            now = datetime.now(TIMEZONE)
#            if lang == 'ru':
#                return f"📅 Сегодня {now.strftime('%d.%m.%Y')}, {days[now.weekday()]}."
#            return f"📅 Today is {now.strftime('%A, %B %d, %Y')}."
#        
#        # Add class (natural language)
#        if 'add class' in message.lower() or 'добавить пару' in message.lower():
#            if lang == 'ru':
#                return "📝 Чтобы добавить пару, отправь:\n`/add <предмет> <день> <начало> <конец>`\n\nДни: 0=Пн, 1=Вт, 2=Ср, 3=Чт, 4=Пт, 5=Сб, 6=Вс\nПример: `/add Математика 1 10:30 12:05`"
#            return "📝 To add a class, send:\n`/add <subject> <day> <start> <end>`\n\nDays: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun\nExample: `/add Mathematics 1 10:30 12:05`"
#        
#        # Add task (natural language)
#        if 'add task' in message.lower() or 'добавить задачу' in message.lower():
#            if lang == 'ru':
#                return "📝 Чтобы добавить задачу, отправь:\n`/deadline <задача> <ГГГГ-ММ-ДД ЧЧ:ММ> <дни>`\nПример: `/deadline Курсовая 2025-12-20 23:59 7`"
#            return "📝 To add a task, send:\n`/deadline <task> <YYYY-MM-DD HH:MM> <days>`\nExample: `/deadline Final project 2025-12-20 23:59 7`"
#        
#        # Unknown - intelligent fallback
#        if lang == 'ru':
#            responses = [
#                f"Я не совсем понял. Можешь перефразировать? 😊\n\nНапример, спроси:\n• 'Что сегодня?'\n• 'Мои задачи'\n• 'Помощь'",
#                f"Хм, интересно... Расскажи подробнее, что ты имеешь в виду? 🤔\n\nЯ могу помочь с расписанием и задачами!",
#                f"Извини, я не совсем уловил суть. Попробуй спросить иначе!\n\nНапример: 'Какие пары сегодня?' или 'Что у меня по задачам?'"
#            ]
#        else:
#            responses = [
#                f"I'm not sure I understood. Could you rephrase that? 😊\n\nTry asking:\n• 'What's today?'\n• 'My tasks'\n• 'Help'",
#                f"Hmm, interesting... Could you tell me more about what you mean? 🤔\n\nI can help with schedules and tasks!",
#                f"Sorry, I didn't quite catch that. Try asking differently!\n\nFor example: 'What classes today?' or 'Show my tasks'"
#            ]
#        return random.choice(responses)
#    
#    def handle_name_intro(self, user_id, message, lang='en'):
#        # Try to extract name from greeting
#        words = message.lower().split()
#        if 'my name is' in message.lower() or 'call me' in message.lower() or 'зовут' in message.lower():
#            for i, word in enumerate(words):
#                if word in ['is', 'me', 'зовут'] and i + 1 < len(words):
#                    name = words[i + 1].capitalize()
#                    set_user_name(user_id, name)
#                    if lang == 'ru':
#                        return f"Приятно познакомиться, {name}! 👋 Теперь я буду знать, как к тебе обращаться. Чем могу помочь?"
#                    return f"Nice to meet you, {name}! 👋 I'll remember your name. How can I help you today?"
#        return None
#
## ========== VK BOT SETUP ==========
#def send_message(vk, user_id, text, keyboard=None):
#    try:
#        if keyboard is None:
#            keyboard = VkKeyboard().get_empty_keyboard()
#        vk.messages.send(user_id=user_id, message=text, random_id=get_random_id(), keyboard=keyboard)
#    except Exception as e:
#        logging.error(f"Send error: {e}")
#
#def get_keyboard(lang='en'):
#    keyboard = VkKeyboard(one_time=False)
#    if lang == 'ru':
#        keyboard.add_button("📅 Что сегодня?", color=VkKeyboardColor.PRIMARY)
#        keyboard.add_button("➕ Добавить пару", color=VkKeyboardColor.POSITIVE)
#        keyboard.add_line()
#        keyboard.add_button("📝 Мои задачи", color=VkKeyboardColor.SECONDARY)
#        keyboard.add_button("➕ Добавить задачу", color=VkKeyboardColor.POSITIVE)
#        keyboard.add_line()
#        keyboard.add_button("❓ Помощь", color=VkKeyboardColor.PRIMARY)
#    else:
#        keyboard.add_button("📅 What's today?", color=VkKeyboardColor.PRIMARY)
#        keyboard.add_button("➕ Add class", color=VkKeyboardColor.POSITIVE)
#        keyboard.add_line()
#        keyboard.add_button("📝 My tasks", color=VkKeyboardColor.SECONDARY)
#        keyboard.add_button("➕ Add task", color=VkKeyboardColor.POSITIVE)
#        keyboard.add_line()
#        keyboard.add_button("❓ Help", color=VkKeyboardColor.PRIMARY)
#    return keyboard.get_keyboard()
#
#def get_task_keyboard(task_id, lang='en'):
#    keyboard = VkKeyboard(inline=True)
#    text = "✅ Complete" if lang == 'en' else "✅ Готово"
#    keyboard.add_button(text, color=VkKeyboardColor.POSITIVE, payload={"cmd": "complete", "tid": task_id})
#    return keyboard.get_keyboard()
#
## ========== COMMAND HANDLERS ==========
#
#def handle_message(vk, user_id, text, attachments):
#    # Check for ICS link in message
#    if text.startswith('/ics') or text.startswith('/import') or 'http' in text and '.ics' in text:
#        # Extract URL from message
#        import re
#        url_match = re.search(r'(https?://[^\s]+\.ics)', text)
#        
#        if url_match:
#            ics_url = url_match.group(1)
#            send_message(vk, user_id, "⏳ Importing schedule from link... Please wait.")
#            
#            count = import_ics_from_link(user_id, ics_url)
#            
#            if count == -1:
#                send_message(vk, user_id, "❌ Failed to download the ICS file. Check if the link is correct.")
#            elif count == 0:
#                send_message(vk, user_id, "⚠️ No classes found in the calendar file.")
#            else:
#                send_message(vk, user_id, f"✅ Successfully imported {count} classes from the link!")
#            return
#        
#        # If no URL found but /ics command used
#        if text.startswith('/ics') or text.startswith('/import'):
#            parts = text.split(maxsplit=1)
#            if len(parts) == 2:
#                ics_url = parts[1].strip()
#                if ics_url.startswith(('http://', 'https://')):
#                    send_message(vk, user_id, "⏳ Importing schedule from link... Please wait.")
#                    count = import_ics_from_link(user_id, ics_url)
#                    
#                    if count == -1:
#                        send_message(vk, user_id, "❌ Failed to download. Check the link.")
#                    elif count == 0:
#                        send_message(vk, user_id, "⚠️ No classes found.")
#                    else:
#                        send_message(vk, user_id, f"✅ Imported {count} classes!")
#                else:
#                    send_message(vk, user_id, "❌ Please provide a valid HTTP or HTTPS link.")
#            else:
#                send_message(vk, user_id, "📅 Usage: /ics https://example.com/schedule.ics")
#            return
#    
#    # Rest of your existing handle_message code continues here... 
#def handle_commands(vk, user_id, text, lang='en'):
#    # /add command
#    if text.startswith('/add'):
#        parts = text.split()
#        if len(parts) == 5:
#            _, subject, day, start, end = parts
#            if day.isdigit() and 0 <= int(day) <= 6:
#                add_class(user_id, subject, int(day), start, end)
#                days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
#                if lang == 'ru':
#                    days = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"]
#                    return f"✅ Добавлена пара: **{subject}** на {days[int(day)]} с {start} до {end}"
#                return f"✅ Added class: **{subject}** on {days[int(day)]} from {start} to {end}"
#        return "❌ Usage: /add <subject> <day(0-6)> <start> <end>" if lang == 'en' else "❌ Использование: /add <предмет> <день> <начало> <конец>"
#    
#    # /deadline command
#    if text.startswith('/deadline'):
#        parts = text.split(maxsplit=3)
#        if len(parts) == 4:
#            _, task, due_date, days = parts
#            if days.isdigit():
#                add_task(user_id, task, due_date, int(days))
#                return "✅ Task added! I'll remind you before the deadline." if lang == 'en' else "✅ Задача добавлена! Я напомню перед дедлайном."
#        return "❌ Usage: /deadline <task> <YYYY-MM-DD HH:MM> <days>" if lang == 'en' else "❌ Использование: /deadline <задача> <ГГГГ-ММ-ДД ЧЧ:ММ> <дни>"
#    
#    return None
#
## ========== REMINDER SYSTEM ==========
#def check_reminders(vk):
#    try:
#        conn = sqlite3.connect("assistant_bot.db")
#        c = conn.cursor()
#        now = datetime.now(TIMEZONE)
#        current_day = now.weekday()
#        
#        c.execute("SELECT DISTINCT user_id FROM schedule")
#        users = c.fetchall()
#        
#        for (user_id,) in users:
#            c.execute("SELECT language FROM users WHERE vk_id = ?", (user_id,))
#            lang_row = c.fetchone()
#            lang = lang_row[0] if lang_row else 'en'
#            
#            c.execute("SELECT subject, start_time FROM schedule WHERE user_id = ? AND day_of_week = ?", (user_id, current_day))
#            classes = c.fetchall()
#            
#            for subject, start_time in classes:
#                hour, minute = map(int, start_time.split(':'))
#                class_time = now.replace(hour=hour, minute=minute, second=0)
#                minutes_until = (class_time - now).total_seconds() / 60
#                
#                if 60 <= minutes_until <= 90:
#                    key = f"reminder_{user_id}_{current_day}_{start_time}"
#                    c.execute("SELECT value FROM reminders WHERE key = ?", (key,))
#                    if not c.fetchone():
#                        if lang == 'ru':
#                            msg = f"🔔 **Напоминание!**\nПара '{subject}' начнется через {int(minutes_until)} минут в {start_time}.\n\nНе опаздывай! 📚"
#                        else:
#                            msg = f"🔔 **Reminder!**\nClass '{subject}' starts in {int(minutes_until)} minutes at {start_time}.\n\nDon't be late! 📚"
#                        
#                        send_message(vk, user_id, msg, get_keyboard(lang))
#                        c.execute("INSERT INTO reminders (key, value) VALUES (?, ?)", (key, "sent"))
#                        conn.commit()
#        
#        conn.close()
#    except Exception as e:
#        logging.error(f"Reminder error: {e}")
#
## ========== MAIN ==========
#scheduler = BackgroundScheduler()
#assistant = IntelligentAssistant()
#
#def main():
#    print("=" * 70)
#    print("🤖 Intelligent Study Assistant Bot")
#    print("=" * 70)
#    print("🎯 Features:")
#    print("   • Natural conversation like a real person")
#    print("   • Remembers context and names")
#    print("   • Schedule and task management")
#    print("   • ICS file import")
#    print("   • English & Russian support")
#    print("=" * 70 + "\n")
#    
#    try:
#        vk_session = vk_api.VkApi(token=VK_TOKEN)
#        vk = vk_session.get_api()
#        
#        # Start reminder scheduler
#        scheduler.add_job(lambda: check_reminders(vk), 'interval', minutes=5)
#        scheduler.start()
#        
#        print("✅ Bot is running! Press Ctrl+C to stop\n")
#        
#        longpoll = VkBotLongPoll(vk_session, GROUP_ID)
#        
#        for event in longpoll.listen():
#            if event.type == VkBotEventType.MESSAGE_NEW:
#                try:
#                    msg = event.object.message
#                    user_id = msg["from_id"]
#                    text = msg.get("text", "").strip()
#                    attachments = msg.get("attachments", [])
#                    
#                    # Detect language
#                    lang = SmartLanguageDetector.detect(text)
#                    set_user_lang(user_id, lang)
#                    
#                    # Handle ICS file upload
#                    ics_files = [att for att in attachments if att["type"] == "doc" and att["doc"]["title"].endswith(".ics")]
#                    if ics_files:
#                        url = ics_files[0]["doc"]["url"]
#                        resp = requests.get(url)
#                        if resp.status_code == 200:
#                            count = import_ics_from_link(user_id, resp.text)
#                            if count > 0:
#                                msg_text = f"✅ Successfully imported {count} classes!" if lang == 'en' else f"✅ Успешно импортировано {count} пар!"
#                            else:
#                                msg_text = "❌ No valid events found." if lang == 'en' else "❌ Не найдено событий."
#                            send_message(vk, user_id, msg_text, get_keyboard(lang))
#                        continue
#                    
#                    # Handle button payloads
#                    payload = msg.get("payload")
#                    if payload:
#                        try:
#                            payload = json.loads(payload)
#                            if payload.get("cmd") == "complete":
#                                complete_task(payload["tid"], user_id)
#                                msg_text = "✅ Task completed! Great job!" if lang == 'en' else "✅ Задача выполнена! Отлично!"
#                                send_message(vk, user_id, msg_text, get_keyboard(lang))
#                        except:
#                            pass
#                        continue
#                    
#                    # Handle name introduction
#                    name_response = assistant.handle_name_intro(user_id, text, lang)
#                    if name_response:
#                        send_message(vk, user_id, name_response, get_keyboard(lang))
#                        save_conversation(user_id, text, name_response)
#                        continue
#                    
#                    # Handle commands
#                    cmd_response = handle_commands(vk, user_id, text, lang)
#                    if cmd_response:
#                        send_message(vk, user_id, cmd_response, get_keyboard(lang))
#                        save_conversation(user_id, text, cmd_response)
#                        continue
#                    
#                    # Generate intelligent response
#                    response = assistant.generate_response(user_id, text, lang)
#                    send_message(vk, user_id, response, get_keyboard(lang))
#                    save_conversation(user_id, text, response)
#                    
#                except Exception as e:
#                    logging.error(f"Error: {e}")
#                    
#    except KeyboardInterrupt:
#        print("\n🛑 Bot stopped")
#    except Exception as e:
#        print(f"\n❌ Error: {e}")
#
#if __name__ == "__main__":
#    main()

#import logging
#import sqlite3
#import json
#import requests
#from datetime import datetime, timedelta
#import vk_api
#from vk_api.bot_longpoll import VkBotLongPoll, VkBotEventType
#from vk_api.keyboard import VkKeyboard, VkKeyboardColor
#from vk_api.utils import get_random_id
#from icalendar import Calendar
#from apscheduler.schedulers.background import BackgroundScheduler
#import pytz
#import re
#from collections import defaultdict
#import random
#
## ========== CONFIGURATION ==========
#VK_TOKEN = "vk1.a.eZvEbyVQo2aLD4K-r_7DxudJLQ4iNke42CLOnxo-ewzkJhDCjgY-FFImW2JeNulCAByv9bzkSuo_VXZFEV1GbMGoTfjD_TlDUV_pfIIfXU2eJvNsYIVFvVRa7OQxAhzGJPle69aDCxH7jYlu-LbbfSLM-9ZVDiOkmo3zSdgiWYegoSqKJqtGAGoyldsJYC79Fc9up1aNsvk3uJ3NZaE6Xg"
#GROUP_ID = 237363984
#TIMEZONE = pytz.timezone("Asia/Novosibirsk")
#
#logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
#
## ========== SMART LANGUAGE DETECTION ==========
#class SmartLanguageDetector:
#    @staticmethod
#    def detect(text):
#        if not text or len(text.strip()) < 2:
#            return 'en'
#        
#        text_lower = text.lower()
#        
#        # Check for Russian characters (Cyrillic)
#        cyrillic_count = sum(1 for c in text_lower if '\u0400' <= c <= '\u04FF')
#        if cyrillic_count > len(text) * 0.1:
#            return 'ru'
#        
#        # Common Russian words
#        russian_words = ['привет', 'здравствуй', 'расписание', 'помощь', 'спасибо', 'пожалуйста', 'что', 'как', 'где']
#        if any(word in text_lower for word in russian_words):
#            return 'ru'
#        
#        return 'en'
#    
#    @staticmethod
#    def get_name(code):
#        return 'Russian' if code == 'ru' else 'English'
#
## ========== DATABASE WITH CONTEXT MEMORY ==========
#def init_db():
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("""CREATE TABLE IF NOT EXISTS users (
#        vk_id INTEGER PRIMARY KEY,
#        language TEXT DEFAULT 'en',
#        name TEXT DEFAULT '',
#        last_interaction DATETIME DEFAULT CURRENT_TIMESTAMP,
#        conversation_context TEXT DEFAULT ''
#    )""")
#    c.execute("""CREATE TABLE IF NOT EXISTS schedule (
#        id INTEGER PRIMARY KEY AUTOINCREMENT,
#        user_id INTEGER,
#        subject TEXT,
#        day_of_week INTEGER,
#        start_time TEXT,
#        end_time TEXT,
#        location TEXT DEFAULT '',
#        teacher TEXT DEFAULT '',
#        notes TEXT DEFAULT ''
#    )""")
#    c.execute("""CREATE TABLE IF NOT EXISTS deadlines (
#        id INTEGER PRIMARY KEY AUTOINCREMENT,
#        user_id INTEGER,
#        task TEXT,
#        due_date TEXT,
#        remind_days INTEGER,
#        priority TEXT DEFAULT 'normal',
#        notes TEXT DEFAULT '',
#        done INTEGER DEFAULT 0
#    )""")
#    c.execute("""CREATE TABLE IF NOT EXISTS reminders (
#        key TEXT PRIMARY KEY,
#        value TEXT,
#        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
#    )""")
#    c.execute("""CREATE TABLE IF NOT EXISTS conversations (
#        id INTEGER PRIMARY KEY AUTOINCREMENT,
#        user_id INTEGER,
#        message TEXT,
#        response TEXT,
#        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
#    )""")
#    conn.commit()
#    conn.close()
#
#init_db()
#
## ========== USER MANAGEMENT ==========
#def get_user_lang(user_id):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("SELECT language FROM users WHERE vk_id = ?", (user_id,))
#    row = c.fetchone()
#    conn.close()
#    return row[0] if row else 'en'
#
#def set_user_lang(user_id, lang):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("INSERT OR REPLACE INTO users (vk_id, language) VALUES (?, ?)", (user_id, lang))
#    conn.commit()
#    conn.close()
#
#def get_user_name(user_id):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("SELECT name FROM users WHERE vk_id = ?", (user_id,))
#    row = c.fetchone()
#    conn.close()
#    return row[0] if row else None
#
#def set_user_name(user_id, name):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("UPDATE users SET name = ? WHERE vk_id = ?", (name, user_id))
#    conn.commit()
#    conn.close()
#
#def save_conversation(user_id, message, response):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("INSERT INTO conversations (user_id, message, response) VALUES (?, ?, ?)", (user_id, message, response))
#    conn.commit()
#    conn.close()
#
## ========== SCHEDULE MANAGEMENT ==========
#def add_class(user_id, subject, day, start, end, location='', teacher=''):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("""INSERT INTO schedule (user_id, subject, day_of_week, start_time, end_time, location, teacher) 
#                 VALUES (?,?,?,?,?,?,?)""", (user_id, subject, day, start, end, location, teacher))
#    conn.commit()
#    conn.close()
#
#def get_today_schedule(user_id):
#    today = datetime.now(TIMEZONE).weekday()
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("""SELECT subject, start_time, end_time, location, teacher FROM schedule 
#                 WHERE user_id = ? AND day_of_week = ? ORDER BY start_time""", (user_id, today))
#    rows = c.fetchall()
#    conn.close()
#    return rows
#
#def get_tomorrow_schedule(user_id):
#    tomorrow = (datetime.now(TIMEZONE).weekday() + 1) % 7
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("""SELECT subject, start_time, end_time, location, teacher FROM schedule 
#                 WHERE user_id = ? AND day_of_week = ? ORDER BY start_time""", (user_id, tomorrow))
#    rows = c.fetchall()
#    conn.close()
#    return rows
#
#def get_week_schedule(user_id):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("""SELECT subject, day_of_week, start_time, end_time FROM schedule 
#                 WHERE user_id = ? ORDER BY day_of_week, start_time""", (user_id,))
#    rows = c.fetchall()
#    conn.close()
#    return rows
#
#def find_next_class(user_id):
#    now = datetime.now(TIMEZONE)
#    current_day = now.weekday()
#    current_time = now.strftime("%H:%M")
#    
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("""SELECT subject, day_of_week, start_time, end_time FROM schedule 
#                 WHERE user_id = ? ORDER BY day_of_week, start_time""", (user_id,))
#    classes = c.fetchall()
#    conn.close()
#    
#    # Find next class
#    for subject, day, start, end in classes:
#        if day > current_day or (day == current_day and start > current_time):
#            return {'subject': subject, 'day': day, 'start': start, 'end': end}
#    if classes:
#        first = classes[0]
#        return {'subject': first[0], 'day': first[1], 'start': first[2], 'end': first[3]}
#    return None
#
## ========== DEADLINE MANAGEMENT ==========
#def add_task(user_id, task, due_date, days, priority='normal'):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("""INSERT INTO deadlines (user_id, task, due_date, remind_days, priority, done) 
#                 VALUES (?,?,?,?,?,0)""", (user_id, task, due_date, days, priority))
#    conn.commit()
#    conn.close()
#
#def get_upcoming_tasks(user_id, days=7):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("""SELECT id, task, due_date, priority FROM deadlines 
#                 WHERE user_id = ? AND done = 0 AND date(due_date) <= date('now', '+' || ? || ' days')
#                 ORDER BY due_date""", (user_id, days))
#    rows = c.fetchall()
#    conn.close()
#    return rows
#
#def complete_task(task_id, user_id):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("UPDATE deadlines SET done = 1 WHERE id = ? AND user_id = ?", (task_id, user_id))
#    conn.commit()
#    conn.close()
#
## ========== ICS IMPORT ==========
#def import_ics_from_link(user_id, ics_url):
#    """Download and import ICS calendar from a URL"""
#    try:
#        # Download the ICS file
#        response = requests.get(ics_url, timeout=30)
#        response.raise_for_status()
#        
#        # Parse the ICS content
#        cal = Calendar.from_ical(response.text)
#        count = 0
#        
#        for component in cal.walk():
#            if component.name == "VEVENT":
#                subject = str(component.get('SUMMARY', 'Class'))
#                dtstart = component.get('DTSTART')
#                dtend = component.get('DTEND')
#                
#                if dtstart and dtend:
#                    start = dtstart.dt
#                    end = dtend.dt
#                    
#                    # Handle all-day events
#                    if not isinstance(start, datetime):
#                        start = datetime.combine(start, datetime.min.time())
#                    if not isinstance(end, datetime):
#                        end = datetime.combine(end, datetime.min.time())
#                    
#                    # Add to database
#                    day_of_week = start.weekday()
#                    start_time = start.strftime("%H:%M")
#                    end_time = end.strftime("%H:%M")
#                    
#                    add_class(user_id, subject, day_of_week, start_time, end_time)
#                    count += 1
#        
#        return count
#    except requests.exceptions.RequestException as e:
#        logging.error(f"Failed to download ICS: {e}")
#        return -1
#    except Exception as e:
#        logging.error(f"ICS parsing error: {e}")
#        return 0
#
#def import_ics_from_content(user_id, content):
#    """Import ICS from file content"""
#    try:
#        cal = Calendar.from_ical(content)
#        count = 0
#        for component in cal.walk():
#            if component.name == "VEVENT":
#                subject = str(component.get('SUMMARY', 'Class'))
#                dtstart = component.get('DTSTART')
#                dtend = component.get('DTEND')
#                if dtstart and dtend:
#                    start = dtstart.dt
#                    end = dtend.dt
#                    if not isinstance(start, datetime):
#                        start = datetime.combine(start, datetime.min.time())
#                    if not isinstance(end, datetime):
#                        end = datetime.combine(end, datetime.min.time())
#                    add_class(user_id, subject, start.weekday(), start.strftime("%H:%M"), end.strftime("%H:%M"))
#                    count += 1
#        return count
#    except Exception as e:
#        logging.error(f"ICS import error: {e}")
#        return 0
#
## ========== INTELLIGENT RESPONSES ==========
#class IntelligentAssistant:
#    def __init__(self):
#        self.contexts = defaultdict(dict)
#    
#    def understand_intent(self, text, lang='en'):
#        text_lower = text.lower()
#        
#        # Intent patterns
#        intents = {
#            'greeting': ['hi', 'hello', 'hey', 'привет', 'здравствуй', 'добрый день', 'good morning', 'good afternoon'],
#            'schedule_today': ['what classes', 'what do i have', 'today schedule', 'today\'s classes', 'what\'s today', 'расписание на сегодня', 'что сегодня', 'какие пары сегодня'],
#            'schedule_tomorrow': ['tomorrow', 'завтра', 'tomorrow schedule', 'what\'s tomorrow', 'расписание на завтра'],
#            'schedule_week': ['this week', 'whole week', 'week schedule', 'вся неделя', 'расписание на неделю', 'какая неделя'],
#            'next_class': ['next class', 'next lesson', 'what\'s next', 'следующая пара', 'что дальше', 'следующее занятие'],
#            'add_class': ['add class', 'add course', 'new class', 'добавить пару', 'новая пара', 'добавить занятие'],
#            'add_task': ['add task', 'add deadline', 'new task', 'new deadline', 'добавить задачу', 'добавить дедлайн', 'новая задача'],
#            'my_tasks': ['my tasks', 'my deadlines', 'what tasks', 'pending tasks', 'мои задачи', 'мои дедлайны', 'какие задачи'],
#            'complete_task': ['complete', 'done', 'finish', 'завершить', 'готово', 'выполнено'],
#            'help': ['help', 'what can you do', 'commands', 'помощь', 'что ты умеешь', 'команды'],
#            'thanks': ['thanks', 'thank you', 'спасибо', 'благодарю'],
#            'who_are_you': ['who are you', 'what are you', 'who made you', 'кто ты', 'что ты такое'],
#            'time': ['what time', 'current time', 'сколько времени', 'который час'],
#            'date': ['what date', 'today\'s date', 'какое сегодня число', 'сегодняшняя дата'],
#        }
#        
#        for intent, keywords in intents.items():
#            if any(keyword in text_lower for keyword in keywords):
#                return intent
#        
#        return 'unknown'
#    
#    def generate_response(self, user_id, message, lang='en'):
#        intent = self.understand_intent(message, lang)
#        
#        # Day names
#        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
#        if lang == 'ru':
#            days = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"]
#        
#        # Greeting
#        if intent == 'greeting':
#            name = get_user_name(user_id)
#            if name:
#                if lang == 'ru':
#                    return f"Привет, {name}! 👋 Рад тебя видеть! Чем могу помочь сегодня?"
#                return f"Hello, {name}! 👋 Great to see you! How can I help you today?"
#            else:
#                if lang == 'ru':
#                    return f"Привет! 👋 Я твой личный помощник. Как я могу к тебе обращаться?"
#                return f"Hi there! 👋 I'm your personal assistant. What should I call you?"
#        
#        # Today's schedule
#        if intent == 'schedule_today':
#            classes = get_today_schedule(user_id)
#            if not classes:
#                if lang == 'ru':
#                    return "📭 У тебя сегодня нет пар! Можешь отдохнуть или заняться своими делами. 🎉"
#                return "📭 You have no classes today! You can relax or work on your own projects. 🎉"
#            
#            response = "📚 **Today's Schedule:**\n\n" if lang == 'en' else "📚 **Расписание на сегодня:**\n\n"
#            for subject, start, end, location, teacher in classes:
#                response += f"⏰ {start}-{end} • **{subject}**\n"
#                if location:
#                    response += f"   📍 {location}\n"
#                if teacher:
#                    response += f"   👨‍🏫 {teacher}\n"
#                response += "\n"
#            
#            # Add next class reminder
#            next_class = find_next_class(user_id)
#            if next_class:
#                if lang == 'ru':
#                    response += f"\n💡 Следующая пара: **{next_class['subject']}** в {next_class['start']}"
#                else:
#                    response += f"\n💡 Next class: **{next_class['subject']}** at {next_class['start']}"
#            
#            return response
#        
#        # Tomorrow's schedule
#        if intent == 'schedule_tomorrow':
#            classes = get_tomorrow_schedule(user_id)
#            if not classes:
#                if lang == 'ru':
#                    return "📭 Завтра нет пар! Можешь спокойно отдохнуть. 🌟"
#                return "📭 No classes tomorrow! You can have a relaxing day. 🌟"
#            
#            response = "📚 **Tomorrow's Schedule:**\n\n" if lang == 'en' else "📚 **Расписание на завтра:**\n\n"
#            for subject, start, end, location, teacher in classes:
#                response += f"⏰ {start}-{end} • **{subject}**\n"
#                if location:
#                    response += f"   📍 {location}\n"
#                response += "\n"
#            return response
#        
#        # Week schedule
#        if intent == 'schedule_week':
#            classes = get_week_schedule(user_id)
#            if not classes:
#                if lang == 'ru':
#                    return "📭 Расписание пусто. Добавь пары с помощью /add или отправь ICS файл."
#                return "📭 Your schedule is empty. Add classes with /add or upload an ICS file."
#            
#            response = "📚 **Weekly Schedule:**\n\n" if lang == 'en' else "📚 **Расписание на неделю:**\n\n"
#            current_day = None
#            for subject, day, start, end in classes:
#                if current_day != days[day]:
#                    current_day = days[day]
#                    response += f"\n**{current_day}:**\n"
#                response += f"   • {start}-{end} - {subject}\n"
#            return response
#        
#        # Next class
#        if intent == 'next_class':
#            next_class = find_next_class(user_id)
#            if next_class:
#                if lang == 'ru':
#                    return f"⏰ Следующая пара: **{next_class['subject']}** в {next_class['start']}. {'Не опаздывай! 📚' if next_class['start'] else ''}"
#                return f"⏰ Your next class is **{next_class['subject']}** at {next_class['start']}. {'Don\'t be late! 📚' if next_class['start'] else ''}"
#            else:
#                if lang == 'ru':
#                    return "🎉 У тебя больше нет пар на сегодня! Можешь отдохнуть!"
#                return "🎉 You have no more classes today! Time to relax!"
#        
#        # My tasks
#        if intent == 'my_tasks':
#            tasks = get_upcoming_tasks(user_id)
#            if not tasks:
#                if lang == 'ru':
#                    return "✅ Отлично! У тебя нет pending задач. Продолжай в том же духе! 🎉"
#                return "✅ Great! You have no pending tasks. Keep up the good work! 🎉"
#            
#            response = "📋 **Upcoming Tasks:**\n\n" if lang == 'en' else "📋 **Предстоящие задачи:**\n\n"
#            for tid, task, due_date, priority in tasks:
#                dt = datetime.strptime(due_date, "%Y-%m-%d %H:%M")
#                priority_emoji = "🔴" if priority == 'high' else "🟡" if priority == 'medium' else "🟢"
#                response += f"{priority_emoji} **{task}**\n   ⏰ Due: {dt.strftime('%d.%m.%Y at %H:%M')}\n\n"
#            response += "\n💡 Say 'complete [task name]' when you finish a task!"
#            return response
#        
#        # Help
#        if intent == 'help':
#            if lang == 'ru':
#                return """🤖 **Что я умею:**
#
#📅 **Расписание:**
#• "Что сегодня?" - показать пары на сегодня
#• "Что завтра?" - показать пары на завтра
#• "Что на неделе?" - полное расписание
#• "Следующая пара?" - ближайшее занятие
#• Отправь ICS ссылку или файл - импорт расписания
#
#📝 **Задачи:**
#• "Мои задачи" - список дедлайнов
#• "Добавить задачу [название] до [дата]"
#• "Готово [название]" - отметить выполненное
#
#💬 **Общение:**
#• Просто говори естественно!
#• Я запоминаю контекст разговора
#• Могу давать советы и напоминания
#
#🌍 Я говорю по-русски и по-английски!"""
#            else:
#                return """🤖 **What I can do:**
#
#📅 **Schedule:**
#• "What's today?" - show today's classes
#• "What about tomorrow?" - show tomorrow's schedule
#• "Show this week" - full weekly schedule
#• "What's next?" - next upcoming class
#• Send an ICS link or file - import your timetable
#
#📝 **Tasks:**
#• "My tasks" - list all deadlines
#• "Add task [name] by [date]"
#• "Complete [task name]" - mark as done
#
#💬 **Conversation:**
#• Just speak naturally!
#• I remember conversation context
#• I can give advice and reminders
#
#🌍 I speak both English and Russian!"""
#        
#        # Thanks
#        if intent == 'thanks':
#            if lang == 'ru':
#                return "Всегда пожалуйста! 😊 Рад помочь! Нужна еще какая-нибудь помощь?"
#            return "You're welcome! 😊 Happy to help! Anything else I can do for you?"
#        
#        # Who are you
#        if intent == 'who_are_you':
#            if lang == 'ru':
#                return """🤖 Я твой персональный учебный ассистент!
#
#Я помогаю:
#• Следить за расписанием
#• Управлять задачами и дедлайнами
#• Давать напоминания о парах
#• Отвечать на вопросы
#
#Просто говори со мной как с другом! 💙"""
#            return """🤖 I'm your personal study assistant!
#
#I help you with:
#• Tracking your schedule
#• Managing tasks and deadlines
#• Sending class reminders
#• Answering questions
#
#Just talk to me like a friend! 💙"""
#        
#        # Time
#        if intent == 'time':
#            now = datetime.now(TIMEZONE)
#            if lang == 'ru':
#                return f"🕐 Сейчас {now.strftime('%H:%M')} в Новосибирске."
#            return f"🕐 It's currently {now.strftime('%H:%M')} in Novosibirsk."
#        
#        # Date
#        if intent == 'date':
#            now = datetime.now(TIMEZONE)
#            if lang == 'ru':
#                return f"📅 Сегодня {now.strftime('%d.%m.%Y')}, {days[now.weekday()]}."
#            return f"📅 Today is {now.strftime('%A, %B %d, %Y')}."
#        
#        # Add class (natural language)
#        if 'add class' in message.lower() or 'добавить пару' in message.lower():
#            if lang == 'ru':
#                return "📝 Чтобы добавить пару, отправь:\n`/add <предмет> <день> <начало> <конец>`\n\nДни: 0=Пн, 1=Вт, 2=Ср, 3=Чт, 4=Пт, 5=Сб, 6=Вс\nПример: `/add Математика 1 10:30 12:05`"
#            return "📝 To add a class, send:\n`/add <subject> <day> <start> <end>`\n\nDays: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun\nExample: `/add Mathematics 1 10:30 12:05`"
#        
#        # Add task (natural language)
#        if 'add task' in message.lower() or 'добавить задачу' in message.lower():
#            if lang == 'ru':
#                return "📝 Чтобы добавить задачу, отправь:\n`/deadline <задача> <ГГГГ-ММ-ДД ЧЧ:ММ> <дни>`\nПример: `/deadline Курсовая 2025-12-20 23:59 7`"
#            return "📝 To add a task, send:\n`/deadline <task> <YYYY-MM-DD HH:MM> <days>`\nExample: `/deadline Final project 2025-12-20 23:59 7`"
#        
#        # Unknown - intelligent fallback
#        if lang == 'ru':
#            responses = [
#                f"Я не совсем понял. Можешь перефразировать? 😊\n\nНапример, спроси:\n• 'Что сегодня?'\n• 'Мои задачи'\n• 'Помощь'",
#                f"Хм, интересно... Расскажи подробнее, что ты имеешь в виду? 🤔\n\nЯ могу помочь с расписанием и задачами!",
#                f"Извини, я не совсем уловил суть. Попробуй спросить иначе!\n\nНапример: 'Какие пары сегодня?' или 'Что у меня по задачам?'"
#            ]
#        else:
#            responses = [
#                f"I'm not sure I understood. Could you rephrase that? 😊\n\nTry asking:\n• 'What's today?'\n• 'My tasks'\n• 'Help'",
#                f"Hmm, interesting... Could you tell me more about what you mean? 🤔\n\nI can help with schedules and tasks!",
#                f"Sorry, I didn't quite catch that. Try asking differently!\n\nFor example: 'What classes today?' or 'Show my tasks'"
#            ]
#        return random.choice(responses)
#    
#    def handle_name_intro(self, user_id, message, lang='en'):
#        # Try to extract name from greeting
#        words = message.lower().split()
#        if 'my name is' in message.lower() or 'call me' in message.lower() or 'зовут' in message.lower():
#            for i, word in enumerate(words):
#                if word in ['is', 'me', 'зовут'] and i + 1 < len(words):
#                    name = words[i + 1].capitalize()
#                    set_user_name(user_id, name)
#                    if lang == 'ru':
#                        return f"Приятно познакомиться, {name}! 👋 Теперь я буду знать, как к тебе обращаться. Чем могу помочь?"
#                    return f"Nice to meet you, {name}! 👋 I'll remember your name. How can I help you today?"
#        return None
#
## ========== VK BOT SETUP ==========
#def send_message(vk, user_id, text, keyboard=None):
#    try:
#        if keyboard is None:
#            keyboard = VkKeyboard().get_empty_keyboard()
#        vk.messages.send(user_id=user_id, message=text, random_id=get_random_id(), keyboard=keyboard)
#    except Exception as e:
#        logging.error(f"Send error: {e}")
#
#def get_keyboard(lang='en'):
#    keyboard = VkKeyboard(one_time=False)
#    if lang == 'ru':
#        keyboard.add_button("📅 Что сегодня?", color=VkKeyboardColor.PRIMARY)
#        keyboard.add_button("➕ Добавить пару", color=VkKeyboardColor.POSITIVE)
#        keyboard.add_line()
#        keyboard.add_button("📝 Мои задачи", color=VkKeyboardColor.SECONDARY)
#        keyboard.add_button("➕ Добавить задачу", color=VkKeyboardColor.POSITIVE)
#        keyboard.add_line()
#        keyboard.add_button("❓ Помощь", color=VkKeyboardColor.PRIMARY)
#    else:
#        keyboard.add_button("📅 What's today?", color=VkKeyboardColor.PRIMARY)
#        keyboard.add_button("➕ Add class", color=VkKeyboardColor.POSITIVE)
#        keyboard.add_line()
#        keyboard.add_button("📝 My tasks", color=VkKeyboardColor.SECONDARY)
#        keyboard.add_button("➕ Add task", color=VkKeyboardColor.POSITIVE)
#        keyboard.add_line()
#        keyboard.add_button("❓ Help", color=VkKeyboardColor.PRIMARY)
#    return keyboard.get_keyboard()
#
#def get_task_keyboard(task_id, lang='en'):
#    keyboard = VkKeyboard(inline=True)
#    text = "✅ Complete" if lang == 'en' else "✅ Готово"
#    keyboard.add_button(text, color=VkKeyboardColor.POSITIVE, payload={"cmd": "complete", "tid": task_id})
#    return keyboard.get_keyboard()
#
## ========== COMMAND HANDLERS ==========
#def handle_commands(vk, user_id, text, lang='en'):
#    # /add command
#    if text.startswith('/add'):
#        parts = text.split()
#        if len(parts) == 5:
#            _, subject, day, start, end = parts
#            if day.isdigit() and 0 <= int(day) <= 6:
#                add_class(user_id, subject, int(day), start, end)
#                days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
#                if lang == 'ru':
#                    days = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"]
#                    return f"✅ Добавлена пара: **{subject}** на {days[int(day)]} с {start} до {end}"
#                return f"✅ Added class: **{subject}** on {days[int(day)]} from {start} to {end}"
#        return "❌ Usage: /add <subject> <day(0-6)> <start> <end>" if lang == 'en' else "❌ Использование: /add <предмет> <день> <начало> <конец>"
#    
#    # /deadline command
#    if text.startswith('/deadline'):
#        parts = text.split(maxsplit=3)
#        if len(parts) == 4:
#            _, task, due_date, days = parts
#            if days.isdigit():
#                add_task(user_id, task, due_date, int(days))
#                return "✅ Task added! I'll remind you before the deadline." if lang == 'en' else "✅ Задача добавлена! Я напомню перед дедлайном."
#        return "❌ Usage: /deadline <task> <YYYY-MM-DD HH:MM> <days>" if lang == 'en' else "❌ Использование: /deadline <задача> <ГГГГ-ММ-ДД ЧЧ:ММ> <дни>"
#    
#    return None
#
### ========== MAIN MESSAGE HANDLER ==========
##def handle_message(vk, user_id, text, attachments):
##    # Check for ICS link in message (works with any message containing an ICS URL)
##    if '.ics' in text and ('http://' in text or 'https://' in text):
##        url_match = re.search(r'(https?://[^\s]+\.ics)', text)
##        if url_match:
##            ics_url = url_match.group(1)
##            send_message(vk, user_id, "⏳ Importing schedule from link... Please wait.")
##            count = import_ics_from_link(user_id, ics_url)
##            if count == -1:
##                send_message(vk, user_id, "❌ Failed to download the ICS file. Check if the link is correct.")
##            elif count == 0:
##                send_message(vk, user_id, "⚠️ No classes found in the calendar file.")
##            else:
##                send_message(vk, user_id, f"✅ Successfully imported {count} classes from the link!")
##            return
##    
##    # Check for /ics or /import command
##    if text.startswith('/ics') or text.startswith('/import'):
##        parts = text.split(maxsplit=1)
##        if len(parts) == 2:
##            ics_url = parts[1].strip()
##            if ics_url.startswith(('http://', 'https://')):
##                send_message(vk, user_id, "⏳ Importing schedule from link... Please wait.")
##                count = import_ics_from_link(user_id, ics_url)
##                if count == -1:
##                    send_message(vk, user_id, "❌ Failed to download. Check the link.")
##                elif count == 0:
##                    send_message(vk, user_id, "⚠️ No classes found.")
##                else:
##                    send_message(vk, user_id, f"✅ Imported {count} classes!")
##            else:
##                send_message(vk, user_id, "❌ Please provide a valid HTTP or HTTPS link.")
##        else:
##            send_message(vk, user_id, "📅 Usage: /ics https://example.com/schedule.ics")
##        return
##    
##    # If no ICS link, process normal messages
##    lang = SmartLanguageDetector.detect(text)
##    set_user_lang(user_id, lang)
##    
##    # Handle name introduction
##    name_response = assistant.handle_name_intro(user_id, text, lang)
##    if name_response:
##        send_message(vk, user_id, name_response, get_keyboard(lang))
##        save_conversation(user_id, text, name_response)
##        return
##    
##    # Handle commands
##    cmd_response = handle_commands(vk, user_id, text, lang)
##    if cmd_response:
##        send_message(vk, user_id, cmd_response, get_keyboard(lang))
##        save_conversation(user_id, text, cmd_response)
##        return
##    
##    # Generate intelligent response
##    response = assistant.generate_response(user_id, text, lang)
##    send_message(vk, user_id, response, get_keyboard(lang))
##    save_conversation(user_id, text, response)
#
#def handle_message(vk, user_id, text, attachments):
#    # Check for ICS link in message
#    if '.ics' in text and ('http://' in text or 'https://' in text):
#        url_match = re.search(r'(https?://[^\s]+\.ics)', text)
#        if url_match:
#            ics_url = url_match.group(1)
#            send_message(vk, user_id, "⏳ Importing schedule from link... Please wait.")
#            count = import_ics_from_link(user_id, ics_url)
#            if count == -1:
#                send_message(vk, user_id, "❌ Failed to download the ICS file. Check if the link is correct.")
#            elif count == 0:
#                send_message(vk, user_id, "⚠️ No classes found in the calendar file.")
#            else:
#                lang = get_user_lang(user_id)
#                if lang == 'ru':
#                    send_message(vk, user_id, f"✅ Успешно импортировано {count} пар! 🎉\n\nТеперь я буду напоминать тебе о парах за 60-90 минут до начала!")
#                else:
#                    send_message(vk, user_id, f"✅ Successfully imported {count} classes! 🎉\n\nI'll now remind you about classes 60-90 minutes before they start!")
#            return
#    
#    # Check for /ics or /import command
#    if text.startswith('/ics') or text.startswith('/import'):
#        parts = text.split(maxsplit=1)
#        if len(parts) == 2:
#            ics_url = parts[1].strip()
#            if ics_url.startswith(('http://', 'https://')):
#                send_message(vk, user_id, "⏳ Importing schedule from link... Please wait.")
#                count = import_ics_from_link(user_id, ics_url)
#                if count == -1:
#                    send_message(vk, user_id, "❌ Failed to download. Check the link.")
#                elif count == 0:
#                    send_message(vk, user_id, "⚠️ No classes found.")
#                else:
#                    lang = get_user_lang(user_id)
#                    if lang == 'ru':
#                        send_message(vk, user_id, f"✅ Успешно импортировано {count} пар! 🎉\n\nТеперь я буду напоминать тебе о парах за 60-90 минут до начала!")
#                    else:
#                        send_message(vk, user_id, f"✅ Successfully imported {count} classes! 🎉\n\nI'll now remind you about classes 60-90 minutes before they start!")
#            else:
#                send_message(vk, user_id, "❌ Please provide a valid HTTP or HTTPS link.\n\nExample: /ics https://example.com/schedule.ics")
#        else:
#            lang = get_user_lang(user_id)
#            if lang == 'ru':
#                send_message(vk, user_id, "📥 **Как импортировать расписание:**\n\nОтправь команду с ссылкой:\n`/ics https://example.com/schedule.ics`\n\nИли просто отправь ссылку на ICS файл!\n\n💡 Пример: https://myuniversity.com/timetable.ics")
#            else:
#                send_message(vk, user_id, "📥 **How to import schedule:**\n\nSend command with link:\n`/ics https://example.com/schedule.ics`\n\nOr just send the ICS link directly!\n\n💡 Example: https://myuniversity.com/timetable.ics")
#        return
#    
#    # Handle /help command
#    if text == '/help' or text.lower() == 'help':
#        lang = get_user_lang(user_id)
#        if lang == 'ru':
#            help_text = """📥 **Как импортировать расписание из ICS:**
#
#1️⃣ **По ссылке:**
#   Просто отправь ссылку на ICS файл:
#   `https://example.com/schedule.ics`
#
#2️⃣ **Командой:**
#   `/ics https://example.com/schedule.ics`
#   или
#   `/import https://example.com/schedule.ics`
#
#3️⃣ **Файлом:**
#   Прикрепи ICS файл к сообщению
#
#📌 **Где взять ICS ссылку?**
#• Университетский портал (обычно есть экспорт)
#• Google Календарь → Настройки → Экспорт
#• Любой календарь, поддерживающий ICS формат
#
#💡 После импорта я буду автоматически напоминать о парах за 60-90 минут!
#
#---
#📅 **Другие команды:**
#• "Что сегодня?" - расписание на сегодня
#• "Мои задачи" - список дедлайнов
#• `/add <предмет> <день> <начало> <конец>` - добавить пару
#• `/deadline <задача> <дата> <дни>` - добавить дедлайн"""
#        else:
#            help_text = """📥 **How to import ICS schedule:**
#
#1️⃣ **Via link:**
#   Just send the ICS link:
#   `https://example.com/schedule.ics`
#
#2️⃣ **Command:**
#   `/ics https://example.com/schedule.ics`
#   or
#   `/import https://example.com/schedule.ics`
#
#3️⃣ **File:**
#   Attach an ICS file to the message
#
#📌 **Where to get ICS link?**
#• University portal (usually has export option)
#• Google Calendar → Settings → Export
#• Any calendar that supports ICS format
#
#💡 After import, I'll automatically remind you about classes 60-90 minutes before!
#
#---
#📅 **Other commands:**
#• "What's today?" - today's schedule
#• "My tasks" - list deadlines
#• `/add <subject> <day> <start> <end>` - add a class
#• `/deadline <task> <date> <days>` - add a deadline"""
#        send_message(vk, user_id, help_text, get_keyboard(lang))
#        return
#    
#    # Process normal messages with the assistant (rest of your code)
#    lang = SmartLanguageDetector.detect(text)
#    set_user_lang(user_id, lang)
#    
#    # Handle name introduction
#    name_response = assistant.handle_name_intro(user_id, text, lang)
#    if name_response:
#        send_message(vk, user_id, name_response, get_keyboard(lang))
#        save_conversation(user_id, text, name_response)
#        return
#    
#    # Handle commands
#    cmd_response = handle_commands(vk, user_id, text, lang)
#    if cmd_response:
#        send_message(vk, user_id, cmd_response, get_keyboard(lang))
#        save_conversation(user_id, text, cmd_response)
#        return
#    
#    # Generate intelligent response
#    response = assistant.generate_response(user_id, text, lang)
#    send_message(vk, user_id, response, get_keyboard(lang))
#    save_conversation(user_id, text, response)
#
## ========== REMINDER SYSTEM ==========
#def check_reminders(vk):
#    try:
#        conn = sqlite3.connect("assistant_bot.db")
#        c = conn.cursor()
#        now = datetime.now(TIMEZONE)
#        current_day = now.weekday()
#        
#        c.execute("SELECT DISTINCT user_id FROM schedule")
#        users = c.fetchall()
#        
#        for (user_id,) in users:
#            c.execute("SELECT language FROM users WHERE vk_id = ?", (user_id,))
#            lang_row = c.fetchone()
#            lang = lang_row[0] if lang_row else 'en'
#            
#            c.execute("SELECT subject, start_time FROM schedule WHERE user_id = ? AND day_of_week = ?", (user_id, current_day))
#            classes = c.fetchall()
#            
#            for subject, start_time in classes:
#                hour, minute = map(int, start_time.split(':'))
#                class_time = now.replace(hour=hour, minute=minute, second=0)
#                minutes_until = (class_time - now).total_seconds() / 60
#                
#                if 60 <= minutes_until <= 90:
#                    key = f"reminder_{user_id}_{current_day}_{start_time}"
#                    c.execute("SELECT value FROM reminders WHERE key = ?", (key,))
#                    if not c.fetchone():
#                        if lang == 'ru':
#                            msg = f"🔔 **Напоминание!**\nПара '{subject}' начнется через {int(minutes_until)} минут в {start_time}.\n\nНе опаздывай! 📚"
#                        else:
#                            msg = f"🔔 **Reminder!**\nClass '{subject}' starts in {int(minutes_until)} minutes at {start_time}.\n\nDon't be late! 📚"
#                        
#                        send_message(vk, user_id, msg, get_keyboard(lang))
#                        c.execute("INSERT INTO reminders (key, value) VALUES (?, ?)", (key, "sent"))
#                        conn.commit()
#        
#        conn.close()
#    except Exception as e:
#        logging.error(f"Reminder error: {e}")
#
## ========== MAIN ==========
#scheduler = BackgroundScheduler()
#assistant = IntelligentAssistant()
#
#def main():
#    print("=" * 70)
#    print("🤖 Intelligent Study Assistant Bot")
#    print("=" * 70)
#    print("🎯 Features:")
#    print("   • Natural conversation like a real person")
#    print("   • Remembers context and names")
#    print("   • Schedule and task management")
#    print("   • ICS file import from links")
#    print("   • English & Russian support")
#    print("=" * 70 + "\n")
#    
#    try:
#        vk_session = vk_api.VkApi(token=VK_TOKEN)
#        vk = vk_session.get_api()
#        
#        # Start reminder scheduler
#        scheduler.add_job(lambda: check_reminders(vk), 'interval', minutes=5)
#        scheduler.start()
#        
#        print("✅ Bot is running! Press Ctrl+C to stop\n")
#        
#        longpoll = VkBotLongPoll(vk_session, GROUP_ID)
#        
#        for event in longpoll.listen():
#            if event.type == VkBotEventType.MESSAGE_NEW:
#                try:
#                    msg = event.object.message
#                    user_id = msg["from_id"]
#                    text = msg.get("text", "").strip()
#                    attachments = msg.get("attachments", [])
#                    
#                    # Handle ICS file upload (not link)
#                    ics_files = [att for att in attachments if att["type"] == "doc" and att["doc"]["title"].endswith(".ics")]
#                    if ics_files:
#                        url = ics_files[0]["doc"]["url"]
#                        resp = requests.get(url)
#                        if resp.status_code == 200:
#                            count = import_ics_from_content(user_id, resp.text)
#                            lang = SmartLanguageDetector.detect(text)
#                            if count > 0:
#                                msg_text = f"✅ Successfully imported {count} classes!" if lang == 'en' else f"✅ Успешно импортировано {count} пар!"
#                            else:
#                                msg_text = "❌ No valid events found." if lang == 'en' else "❌ Не найдено событий."
#                            send_message(vk, user_id, msg_text, get_keyboard(lang))
#                        continue
#                    
#                    # Handle button payloads
#                    payload = msg.get("payload")
#                    if payload:
#                        try:
#                            payload = json.loads(payload)
#                            if payload.get("cmd") == "complete":
#                                complete_task(payload["tid"], user_id)
#                                lang = get_user_lang(user_id)
#                                msg_text = "✅ Task completed! Great job!" if lang == 'en' else "✅ Задача выполнена! Отлично!"
#                                send_message(vk, user_id, msg_text, get_keyboard(lang))
#                        except:
#                            pass
#                        continue
#                    
#                    # Handle normal text messages (including ICS links)
#                    if text:
#                        handle_message(vk, user_id, text, attachments)
#                    else:
#                        lang = get_user_lang(user_id)
#                        welcome = "👋 Hello! I'm your study assistant! How can I help you?" if lang == 'en' else "👋 Привет! Я твой учебный ассистент! Чем могу помочь?"
#                        send_message(vk, user_id, welcome, get_keyboard(lang))
#                        
#                except Exception as e:
#                    logging.error(f"Error: {e}")
#                    
#    except KeyboardInterrupt:
#        print("\n🛑 Bot stopped")
#    except Exception as e:
#        print(f"\n❌ Error: {e}")
#
#if __name__ == "__main__":
#    main()



#import logging
#import sqlite3
#import json
#import requests
#from datetime import datetime, timedelta
#import vk_api
#from vk_api.bot_longpoll import VkBotLongPoll, VkBotEventType
#from vk_api.keyboard import VkKeyboard, VkKeyboardColor
#from vk_api.utils import get_random_id
#from icalendar import Calendar
#from apscheduler.schedulers.background import BackgroundScheduler
#import pytz
#import re
#from collections import defaultdict
#import random
#
## ========== CONFIGURATION ==========
#VK_TOKEN = "vk1.a.eZvEbyVQo2aLD4K-r_7DxudJLQ4iNke42CLOnxo-ewzkJhDCjgY-FFImW2JeNulCAByv9bzkSuo_VXZFEV1GbMGoTfjD_TlDUV_pfIIfXU2eJvNsYIVFvVRa7OQxAhzGJPle69aDCxH7jYlu-LbbfSLM-9ZVDiOkmo3zSdgiWYegoSqKJqtGAGoyldsJYC79Fc9up1aNsvk3uJ3NZaE6Xg"
#GROUP_ID = 237363984
#TIMEZONE = pytz.timezone("Asia/Novosibirsk")
#
#logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
#
## ========== SMART LANGUAGE DETECTION ==========
#class SmartLanguageDetector:
#    @staticmethod
#    def detect(text):
#        if not text or len(text.strip()) < 2:
#            return 'en'
#        
#        text_lower = text.lower()
#        
#        # Check for Russian characters (Cyrillic)
#        cyrillic_count = sum(1 for c in text_lower if '\u0400' <= c <= '\u04FF')
#        if cyrillic_count > len(text) * 0.1:
#            return 'ru'
#        
#        # Common Russian words
#        russian_words = ['привет', 'здравствуй', 'расписание', 'помощь', 'спасибо', 'пожалуйста', 'что', 'как', 'где']
#        if any(word in text_lower for word in russian_words):
#            return 'ru'
#        
#        return 'en'
#    
#    @staticmethod
#    def get_name(code):
#        return 'Russian' if code == 'ru' else 'English'
#
## ========== DATABASE WITH CONTEXT MEMORY ==========
#def init_db():
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("""CREATE TABLE IF NOT EXISTS users (
#        vk_id INTEGER PRIMARY KEY,
#        language TEXT DEFAULT 'en',
#        name TEXT DEFAULT '',
#        last_interaction DATETIME DEFAULT CURRENT_TIMESTAMP,
#        conversation_context TEXT DEFAULT ''
#    )""")
#    c.execute("""CREATE TABLE IF NOT EXISTS schedule (
#        id INTEGER PRIMARY KEY AUTOINCREMENT,
#        user_id INTEGER,
#        subject TEXT,
#        day_of_week INTEGER,
#        start_time TEXT,
#        end_time TEXT,
#        location TEXT DEFAULT '',
#        teacher TEXT DEFAULT '',
#        notes TEXT DEFAULT ''
#    )""")
#    c.execute("""CREATE TABLE IF NOT EXISTS deadlines (
#        id INTEGER PRIMARY KEY AUTOINCREMENT,
#        user_id INTEGER,
#        task TEXT,
#        due_date TEXT,
#        remind_days INTEGER,
#        priority TEXT DEFAULT 'normal',
#        notes TEXT DEFAULT '',
#        done INTEGER DEFAULT 0
#    )""")
#    c.execute("""CREATE TABLE IF NOT EXISTS reminders (
#        key TEXT PRIMARY KEY,
#        value TEXT,
#        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
#    )""")
#    c.execute("""CREATE TABLE IF NOT EXISTS conversations (
#        id INTEGER PRIMARY KEY AUTOINCREMENT,
#        user_id INTEGER,
#        message TEXT,
#        response TEXT,
#        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
#    )""")
#    conn.commit()
#    conn.close()
#
#init_db()
#
## ========== USER MANAGEMENT ==========
#def get_user_lang(user_id):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("SELECT language FROM users WHERE vk_id = ?", (user_id,))
#    row = c.fetchone()
#    conn.close()
#    return row[0] if row else 'en'
#
#def set_user_lang(user_id, lang):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("INSERT OR REPLACE INTO users (vk_id, language) VALUES (?, ?)", (user_id, lang))
#    conn.commit()
#    conn.close()
#
#def get_user_name(user_id):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("SELECT name FROM users WHERE vk_id = ?", (user_id,))
#    row = c.fetchone()
#    conn.close()
#    return row[0] if row else None
#
#def set_user_name(user_id, name):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("UPDATE users SET name = ? WHERE vk_id = ?", (name, user_id))
#    conn.commit()
#    conn.close()
#
#def save_conversation(user_id, message, response):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("INSERT INTO conversations (user_id, message, response) VALUES (?, ?, ?)", (user_id, message, response))
#    conn.commit()
#    conn.close()
#
## ========== SCHEDULE MANAGEMENT ==========
#def add_class(user_id, subject, day, start, end, location='', teacher=''):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("""INSERT INTO schedule (user_id, subject, day_of_week, start_time, end_time, location, teacher) 
#                 VALUES (?,?,?,?,?,?,?)""", (user_id, subject, day, start, end, location, teacher))
#    conn.commit()
#    conn.close()
#
#def get_today_schedule(user_id):
#    today = datetime.now(TIMEZONE).weekday()
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("""SELECT subject, start_time, end_time, location, teacher FROM schedule 
#                 WHERE user_id = ? AND day_of_week = ? ORDER BY start_time""", (user_id, today))
#    rows = c.fetchall()
#    conn.close()
#    return rows
#
#def get_tomorrow_schedule(user_id):
#    tomorrow = (datetime.now(TIMEZONE).weekday() + 1) % 7
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("""SELECT subject, start_time, end_time, location, teacher FROM schedule 
#                 WHERE user_id = ? AND day_of_week = ? ORDER BY start_time""", (user_id, tomorrow))
#    rows = c.fetchall()
#    conn.close()
#    return rows
#
#def get_week_schedule(user_id):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("""SELECT subject, day_of_week, start_time, end_time FROM schedule 
#                 WHERE user_id = ? ORDER BY day_of_week, start_time""", (user_id,))
#    rows = c.fetchall()
#    conn.close()
#    return rows
#
#def find_next_class(user_id):
#    now = datetime.now(TIMEZONE)
#    current_day = now.weekday()
#    current_time = now.strftime("%H:%M")
#    
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("""SELECT subject, day_of_week, start_time, end_time FROM schedule 
#                 WHERE user_id = ? ORDER BY day_of_week, start_time""", (user_id,))
#    classes = c.fetchall()
#    conn.close()
#    
#    # Find next class
#    for subject, day, start, end in classes:
#        if day > current_day or (day == current_day and start > current_time):
#            return {'subject': subject, 'day': day, 'start': start, 'end': end}
#    if classes:
#        first = classes[0]
#        return {'subject': first[0], 'day': first[1], 'start': first[2], 'end': first[3]}
#    return None
#
## ========== DEADLINE MANAGEMENT ==========
#def add_task(user_id, task, due_date, days, priority='normal'):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("""INSERT INTO deadlines (user_id, task, due_date, remind_days, priority, done) 
#                 VALUES (?,?,?,?,?,0)""", (user_id, task, due_date, days, priority))
#    conn.commit()
#    conn.close()
#
#def get_upcoming_tasks(user_id, days=7):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("""SELECT id, task, due_date, priority FROM deadlines 
#                 WHERE user_id = ? AND done = 0 AND date(due_date) <= date('now', '+' || ? || ' days')
#                 ORDER BY due_date""", (user_id, days))
#    rows = c.fetchall()
#    conn.close()
#    return rows
#
#def complete_task(task_id, user_id):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("UPDATE deadlines SET done = 1 WHERE id = ? AND user_id = ?", (task_id, user_id))
#    conn.commit()
#    conn.close()
#
## ========== ICS IMPORT ==========
#def import_ics_from_link(user_id, ics_url):
#    """Download and import ICS calendar from a URL"""
#    try:
#        # Download the ICS file
#        response = requests.get(ics_url, timeout=30)
#        response.raise_for_status()
#        
#        # Parse the ICS content
#        cal = Calendar.from_ical(response.text)
#        count = 0
#        
#        for component in cal.walk():
#            if component.name == "VEVENT":
#                subject = str(component.get('SUMMARY', 'Class'))
#                dtstart = component.get('DTSTART')
#                dtend = component.get('DTEND')
#                
#                if dtstart and dtend:
#                    start = dtstart.dt
#                    end = dtend.dt
#                    
#                    # Handle all-day events
#                    if not isinstance(start, datetime):
#                        start = datetime.combine(start, datetime.min.time())
#                    if not isinstance(end, datetime):
#                        end = datetime.combine(end, datetime.min.time())
#                    
#                    # Add to database
#                    day_of_week = start.weekday()
#                    start_time = start.strftime("%H:%M")
#                    end_time = end.strftime("%H:%M")
#                    
#                    add_class(user_id, subject, day_of_week, start_time, end_time)
#                    count += 1
#        
#        return count
#    except requests.exceptions.RequestException as e:
#        logging.error(f"Failed to download ICS: {e}")
#        return -1
#    except Exception as e:
#        logging.error(f"ICS parsing error: {e}")
#        return 0
#
#def import_ics_from_content(user_id, content):
#    """Import ICS from file content"""
#    try:
#        cal = Calendar.from_ical(content)
#        count = 0
#        for component in cal.walk():
#            if component.name == "VEVENT":
#                subject = str(component.get('SUMMARY', 'Class'))
#                dtstart = component.get('DTSTART')
#                dtend = component.get('DTEND')
#                if dtstart and dtend:
#                    start = dtstart.dt
#                    end = dtend.dt
#                    if not isinstance(start, datetime):
#                        start = datetime.combine(start, datetime.min.time())
#                    if not isinstance(end, datetime):
#                        end = datetime.combine(end, datetime.min.time())
#                    add_class(user_id, subject, start.weekday(), start.strftime("%H:%M"), end.strftime("%H:%M"))
#                    count += 1
#        return count
#    except Exception as e:
#        logging.error(f"ICS import error: {e}")
#        return 0
#
## ========== ENHANCED INTELLIGENT RESPONSES ==========
#class IntelligentAssistant:
#    def __init__(self):
#        self.contexts = defaultdict(dict)
#        
#        # Expanded keyword mappings for better understanding
#        self.keyword_mappings = {
#            'schedule': ['schedule', 'timetable', 'classes', 'lessons', 'courses', 'расписание', 'пары', 'занятия'],
#            'today': ['today', 'todays', 'сегодня', 'сегодняшний'],
#            'tomorrow': ['tomorrow', 'завтра', 'завтрашний'],
#            'week': ['week', 'weekly', 'this week', 'whole week', 'неделя', 'еженедельно'],
#            'next': ['next', 'coming up', 'upcoming', 'following', 'следующий', 'ближайший'],
#            'task': ['task', 'tasks', 'deadline', 'deadlines', 'homework', 'assignment', 'задача', 'задачи', 'дедлайн', 'домашка'],
#            'add': ['add', 'create', 'new', 'make', 'добавить', 'создать', 'новый'],
#            'complete': ['complete', 'finish', 'done', 'mark as done', 'завершить', 'готово', 'выполнено'],
#            'help': ['help', 'assist', 'guide', 'помощь', 'помоги', 'подскажи'],
#            'import': ['import', 'upload', 'load', 'импорт', 'загрузить', 'импортировать'],
#            'ics': ['ics', 'icalendar', 'calendar file', 'календарь'],
#        }
#        
#        # Contextual response templates
#        self.conversational_responses = {
#            'en': {
#                'greetings': [
#                    "Hey {name}! 👋 How's your day going?",
#                    "Hi {name}! 👋 Ready to tackle your tasks today?",
#                    "Hello {name}! 👋 What can I help you with?",
#                    "Good to see you, {name}! 👋 Need anything?"
#                ],
#                'schedule_empty': [
#                    "Your schedule looks a bit empty! 📭 Want to import your timetable? Just send me an ICS link or file!",
#                    "No classes yet! 📭 You can import your schedule with /ics <link> or send me an ICS file.",
#                    "📭 Your calendar is waiting! Share your ICS file or link to get started."
#                ],
#                'no_tasks': [
#                    "You're all caught up! 🎉 No pending tasks. Enjoy your free time!",
#                    "Great job! ✅ No deadlines looming. Keep it up!",
#                    "Your task list is empty! 🎉 Want to add something?"
#                ],
#                'task_completed': [
#                    "Excellent work! 🎉 Task completed!",
#                    "Way to go! ✅ Another task done!",
#                    "Great job staying on top of things! 🎉"
#                ],
#                'import_success': [
#                    "Awesome! 🎉 I've added {count} classes to your schedule. I'll remind you before each class!",
#                    "Success! ✅ Imported {count} classes. Your timetable is now ready!",
#                    "Perfect! 📅 Your schedule is now loaded with {count} classes. I'll keep you on track!"
#                ],
#                'help_intro': "Here's how I can help you 📚",
#                'casual': [
#                    "That's interesting! Tell me more about your classes or tasks, and I'll help organize them.",
#                    "I'm here to help with your schedule and deadlines! What would you like to do?",
#                    "Feel free to ask me about your classes, add tasks, or import your timetable!"
#                ]
#            },
#            'ru': {
#                'greetings': [
#                    "Привет, {name}! 👋 Как дела?",
#                    "Здравствуй, {name}! 👋 Готов справляться с задачами?",
#                    "Привет, {name}! 👋 Чем могу помочь?",
#                    "Рад видеть тебя, {name}! 👋 Нужна помощь?"
#                ],
#                'schedule_empty': [
#                    "Твое расписание пусто! 📭 Хочешь импортировать его? Отправь мне ICS ссылку или файл!",
#                    "Пока нет пар! 📭 Ты можешь импортировать расписание командой /ics <ссылка> или отправить ICS файл.",
#                    "📭 Календарь ждет! Поделись ICS файлом или ссылкой, чтобы начать."
#                ],
#                'no_tasks': [
#                    "Ты все успеваешь! 🎉 Нет pending задач. Отдыхай!",
#                    "Отлично! ✅ Нет дедлайнов. Так держать!",
#                    "Список задач пуст! 🎉 Хочешь что-то добавить?"
#                ],
#                'task_completed': [
#                    "Отличная работа! 🎉 Задача выполнена!",
#                    "Молодец! ✅ Еще одна задача готова!",
#                    "Ты на высоте! 🎉 Продолжай в том же духе!"
#                ],
#                'import_success': [
#                    "Отлично! 🎉 Я добавил {count} пар(ы) в расписание. Буду напоминать перед каждой парой!",
#                    "Успех! ✅ Импортировано {count} пар(ы). Твое расписание готово!",
#                    "Идеально! 📅 Расписание загружено с {count} парами. Я помогу все успевать!"
#                ],
#                'help_intro': "Вот чем я могу помочь 📚",
#                'casual': [
#                    "Интересно! Расскажи подробнее о своих парах или задачах, и я помогу все организовать.",
#                    "Я здесь, чтобы помочь с расписанием и дедлайнами! Что хочешь сделать?",
#                    "Спрашивай о парах, добавляй задачи или импортируй расписание!"
#                ]
#            }
#        }
#    
#    def understand_intent(self, text, lang='en'):
#        """Enhanced intent understanding with better comprehension"""
#        text_lower = text.lower()
#        
#        # First, translate to English for better understanding if needed
#        english_text = text_lower
#        if lang == 'ru' and len(text) > 3:
#            # Simple Russian to English mapping for common phrases
#            ru_to_en = {
#                'покажи': 'show', 'расскажи': 'tell', 'что': 'what', 'когда': 'when',
#                'сколько': 'how many', 'есть': 'is there', 'добавь': 'add', 'создай': 'create',
#                'закончил': 'finished', 'сделал': 'done', 'удали': 'delete'
#            }
#            for ru, en in ru_to_en.items():
#                if ru in text_lower:
#                    english_text = english_text.replace(ru, en)
#        
#        # Intent patterns with more natural language variations
#        intents = {
#            'show_today_schedule': ['what classes today', 'what do i have today', 'today\'s schedule', 'show today', 'classes today', 'what today', 'today classes', 'что сегодня', 'какие пары сегодня', 'что у меня сегодня', 'сегодняшнее расписание'],
#            'show_tomorrow_schedule': ['what about tomorrow', 'tomorrow schedule', 'classes tomorrow', 'tomorrow classes', 'what tomorrow', 'завтрашнее расписание', 'что завтра', 'какие пары завтра'],
#            'show_week_schedule': ['this week', 'whole week', 'week schedule', 'show week', 'weekly', 'вся неделя', 'расписание на неделю', 'покажи всю неделю'],
#            'show_next_class': ['what\'s next', 'next class', 'next lesson', 'coming up', 'what next', 'следующая пара', 'что дальше', 'ближайшая пара'],
#            'add_class': ['add class', 'new class', 'add course', 'create class', 'добавить пару', 'новая пара', 'создать пару'],
#            'add_task': ['add task', 'new task', 'add deadline', 'create task', 'добавить задачу', 'новая задача', 'создать задачу'],
#            'show_tasks': ['my tasks', 'show tasks', 'what tasks', 'pending tasks', 'my deadlines', 'мои задачи', 'покажи задачи', 'какие задачи', 'дедлайны'],
#            'complete_task': ['complete', 'done', 'finish', 'mark as done', 'completed', 'готово', 'завершить', 'выполнено', 'сделано'],
#            'import_ics': ['import schedule', 'upload timetable', 'import calendar', 'импорт расписания', 'загрузить расписание', 'как импортировать'],
#            'help': ['help', 'what can you do', 'how to use', 'commands', 'помощь', 'что ты умеешь', 'команды', 'как пользоваться'],
#            'greeting': ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'привет', 'здравствуй', 'добрый день', 'доброе утро'],
#            'thanks': ['thanks', 'thank you', 'appreciate', 'спасибо', 'благодарю'],
#            'who_are_you': ['who are you', 'what are you', 'your name', 'who made you', 'кто ты', 'что ты такое', 'как тебя зовут'],
#            'time': ['what time', 'current time', 'tell time', 'сколько времени', 'который час', 'какое время'],
#            'date': ['what date', 'today date', 'what day', 'какое сегодня число', 'какой день'],
#        }
#        
#        for intent, keywords in intents.items():
#            if any(keyword in english_text for keyword in keywords):
#                return intent
#        
#        return 'casual_talk'
#    
#    def get_conversational_response(self, user_id, message, intent, lang='en'):
#        """Generate natural conversational responses"""
#        name = get_user_name(user_id) or "there"
#        responses = self.conversational_responses[lang]
#        
#        # Handle specific intents with natural responses
#        if intent == 'greeting':
#            return random.choice(responses['greetings']).format(name=name)
#        
#        elif intent == 'show_today_schedule':
#            classes = get_today_schedule(user_id)
#            if not classes:
#                return random.choice(responses['schedule_empty'])
#            
#            days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
#            if lang == 'ru':
#                days = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"]
#            
#            response = f"📚 **Here's what you have today, {name}!**\n\n" if lang == 'en' else f"📚 **Вот что у тебя сегодня, {name}!**\n\n"
#            for subject, start, end, location, teacher in classes:
#                response += f"⏰ {start}-{end} • **{subject}**\n"
#                if location:
#                    response += f"   📍 {location}\n"
#                if teacher:
#                    response += f"   👨‍🏫 {teacher}\n"
#                response += "\n"
#            
#            next_class = find_next_class(user_id)
#            if next_class:
#                if lang == 'ru':
#                    response += f"\n💡 Следующая пара: **{next_class['subject']}** в {next_class['start']}"
#                else:
#                    response += f"\n💡 Your next class is **{next_class['subject']}** at {next_class['start']}"
#            return response
#        
#        elif intent == 'show_tomorrow_schedule':
#            classes = get_tomorrow_schedule(user_id)
#            if not classes:
#                return "📭 No classes tomorrow! Free day! 🎉" if lang == 'en' else "📭 Завтра нет пар! Свободный день! 🎉"
#            
#            response = f"📚 **Tomorrow's schedule for {name}:**\n\n" if lang == 'en' else f"📚 **Расписание на завтра, {name}:**\n\n"
#            for subject, start, end, location, teacher in classes:
#                response += f"⏰ {start}-{end} • **{subject}**\n"
#                if location:
#                    response += f"   📍 {location}\n"
#                response += "\n"
#            return response
#        
#        elif intent == 'show_week_schedule':
#            classes = get_week_schedule(user_id)
#            if not classes:
#                return random.choice(responses['schedule_empty'])
#            
#            days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
#            if lang == 'ru':
#                days = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"]
#            
#            response = f"📚 **{name}'s weekly schedule:**\n\n" if lang == 'en' else f"📚 **Расписание {name} на неделю:**\n\n"
#            current_day = None
#            for subject, day, start, end in classes:
#                if current_day != days[day]:
#                    current_day = days[day]
#                    response += f"\n**{current_day}:**\n"
#                response += f"   • {start}-{end} - {subject}\n"
#            return response
#        
#        elif intent == 'show_next_class':
#            next_class = find_next_class(user_id)
#            if next_class:
#                if lang == 'ru':
#                    return f"⏰ {name}, твоя следующая пара: **{next_class['subject']}** в {next_class['start']}. {random.choice(['Не опаздывай! 📚', 'Будь готов! 💪', 'Удачи на паре! 🎓'])}"
#                return f"⏰ {name}, your next class is **{next_class['subject']}** at {next_class['start']}. {random.choice(['Don\'t be late! 📚', 'Get ready! 💪', 'Good luck in class! 🎓'])}"
#            else:
#                if lang == 'ru':
#                    return f"🎉 Отлично, {name}! У тебя больше нет пар на сегодня. Можешь отдохнуть или заняться своими делами!"
#                return f"🎉 Great news, {name}! No more classes today. Time to relax or work on your own projects!"
#        
#        elif intent == 'show_tasks':
#            tasks = get_upcoming_tasks(user_id)
#            if not tasks:
#                return random.choice(responses['no_tasks'])
#            
#            response = f"📋 **Here's what's on your plate, {name}:**\n\n" if lang == 'en' else f"📋 **Вот что у тебя в планах, {name}:**\n\n"
#            for tid, task, due_date, priority in tasks:
#                dt = datetime.strptime(due_date, "%Y-%m-%d %H:%M")
#                days_left = (dt - datetime.now()).days
#                if days_left <= 1:
#                    urgency = "🔴 URGENT" if lang == 'en' else "🔴 СРОЧНО"
#                elif days_left <= 3:
#                    urgency = "🟡 Coming soon" if lang == 'en' else "🟡 Скоро"
#                else:
#                    urgency = "🟢 On track" if lang == 'en' else "🟢 В процессе"
#                response += f"**{task}**\n   ⏰ {dt.strftime('%d.%m.%Y at %H:%M')}\n   {urgency}\n\n"
#            response += f"\n💡 {random.choice(['You\'ve got this! 💪', 'Keep up the great work! 🌟', 'One task at a time! 📝'])}" if lang == 'en' else f"\n💡 {random.choice(['Ты справишься! 💪', 'Так держать! 🌟', 'По одной задаче за раз! 📝'])}"
#            return response
#        
#        elif intent == 'add_class':
#            if lang == 'ru':
#                return "📝 **Добавляем новую пару, {name}!**\n\nОтправь команду в таком формате:\n`/add <предмет> <день> <начало> <конец>`\n\n📌 **Дни:** 0=Пн, 1=Вт, 2=Ср, 3=Чт, 4=Пт, 5=Сб, 6=Вс\n⏰ **Время:** ЧЧ:ММ\n\n✨ **Пример:** `/add Математика 1 10:30 12:05`"
#            return f"📝 **Adding a new class, {name}!**\n\nSend the command in this format:\n`/add <subject> <day> <start> <end>`\n\n📌 **Days:** 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun\n⏰ **Time:** HH:MM\n\n✨ **Example:** `/add Mathematics 1 10:30 12:05`"
#        
#        elif intent == 'add_task':
#            if lang == 'ru':
#                return f"📝 **Добавляем задачу, {name}!**\n\nОтправь команду:\n`/deadline <задача> <ГГГГ-ММ-ДД ЧЧ:ММ> <дни>`\n\n✨ **Пример:** `/deadline Курсовая работа 2025-12-20 23:59 7`\n\n📌 <дни> - за сколько дней напомнить"
#            return f"📝 **Adding a new task, {name}!**\n\nSend the command:\n`/deadline <task> <YYYY-MM-DD HH:MM> <days>`\n\n✨ **Example:** `/deadline Final project 2025-12-20 23:59 7`\n\n📌 <days> = how many days before to remind you"
#        
#        elif intent == 'import_ics':
#            if lang == 'ru':
#                return f"""📥 **Как импортировать расписание, {name}:**
#
#🎯 **Три простых способа:**
#
#1️⃣ **Просто отправь ссылку:**
#   `https://ваш-университет.ru/расписание.ics`
#
#2️⃣ **Командой с ссылкой:**
#   `/ics https://ваш-университет.ru/расписание.ics`
#   или
#   `/import https://ваш-университет.ru/расписание.ics`
#
#3️⃣ **Прикрепи файл:**
#   Просто прикрепи .ics файл к сообщению
#
#📌 **Где взять ICS ссылку?**
#• Университетский портал (ищи кнопку "Экспорт" или "Скачать")
#• Google Календарь → Настройки → Экспорт календаря
#• Любой календарь, который поддерживает ICS формат
#
#💡 **Что будет после импорта?**
#• Я автоматически добавлю все пары в расписание
#• Буду напоминать за 60-90 минут до каждой пары
#• Смогу отвечать на вопросы о твоем расписании
#
#✨ **Пример готовой ссылки:** 
#`https://raw.githubusercontent.com/example/schedule.ics`"""
#            return f"""📥 **How to import your schedule, {name}:**
#
#🎯 **Three simple ways:**
#
#1️⃣ **Just send the link:**
#   `https://your-university.edu/schedule.ics`
#
#2️⃣ **Command with link:**
#   `/ics https://your-university.edu/schedule.ics`
#   or
#   `/import https://your-university.edu/schedule.ics`
#
#3️⃣ **Attach the file:**
#   Just attach an .ics file to your message
#
#📌 **Where to get ICS link?**
#• University portal (look for "Export" or "Download" button)
#• Google Calendar → Settings → Export calendar
#• Any calendar that supports ICS format
#
#💡 **What happens after import?**
#• I'll automatically add all classes to your schedule
#• I'll remind you 60-90 minutes before each class
#• I can answer questions about your timetable
#
#✨ **Example link:** 
#`https://raw.githubusercontent.com/example/schedule.ics`"""
#        
#        elif intent == 'complete_task':
#            if lang == 'ru':
#                return f"📝 Чтобы отметить задачу как выполненную, {name}, просто скажи: 'Я сделал(а) [название задачи]' или нажми кнопку '✅ Готово' под задачей!"
#            return f"📝 To mark a task as complete, {name}, just say: 'I finished [task name]' or click the '✅ Complete' button under the task!"
#        
#        elif intent == 'help':
#            help_text = responses['help_intro'] + "\n\n"
#            if lang == 'ru':
#                help_text += """📅 **Расписание:**
#• "Что сегодня?" - сегодняшние пары
#• "Что завтра?" - завтрашние пары
#• "Что на неделе?" - всё расписание
#• "Что дальше?" - следующая пара
#
#📥 **Импорт расписания:**
#• Отправь ICS ссылку или файл
#• Используй /ics <ссылка>
#
#📝 **Задачи:**
#• "Мои задачи" - список дедлайнов
#• /deadline <задача> <дата> <дни>
#
#💬 **Просто говори естественно!**
#Я понимаю разговорный язык и всегда рад помочь! 🌟"""
#            else:
#                help_text += """📅 **Schedule:**
#• "What's today?" - today's classes
#• "What about tomorrow?" - tomorrow's schedule
#• "Show this week" - full weekly schedule
#• "What's next?" - next upcoming class
#
#📥 **Import schedule:**
#• Send an ICS link or file
#• Use /ics <link>
#
#📝 **Tasks:**
#• "My tasks" - list deadlines
#• /deadline <task> <date> <days>
#
#💡 **Just speak naturally!**
#I understand conversational language and I'm always here to help! 🌟"""
#            return help_text
#        
#        elif intent == 'thanks':
#            if lang == 'ru':
#                return f"Всегда пожалуйста, {name}! 😊 Рад, что могу помочь. Обращайся, если что-то понадобится!"
#            return f"You're very welcome, {name}! 😊 Happy to help. Let me know if you need anything else!"
#        
#        elif intent == 'who_are_you':
#            if lang == 'ru':
#                return f"""🤖 **Привет, {name}! Я твой персональный учебный ассистент!**
#
#💪 **Что я умею:**
#• 📅 Следить за расписанием и напоминать о парах
#• 📝 Управлять задачами и дедлайнами
#• 🔔 Отправлять напоминания за 60-90 минут
#• 💬 Отвечать на вопросы простым языком
#
#🎯 **Моя цель:** Помогать тебе ничего не забывать и все успевать!
#
#✨ **Просто говори со мной как с другом!**"""
#            return f"""🤖 **Hi {name}! I'm your personal study assistant!**
#
#💪 **What I can do:**
#• 📅 Track your schedule and remind you about classes
#• 📝 Manage your tasks and deadlines
#• 🔔 Send reminders 60-90 minutes before class
#• 💬 Answer questions in plain language
#
#🎯 **My goal:** Help you stay on top of everything!
#
#✨ **Just talk to me like a friend!**"""
#        
#        elif intent == 'casual_talk':
#            return random.choice(responses['casual'])
#        
#        elif intent == 'time':
#            now = datetime.now(TIMEZONE)
#            if lang == 'ru':
#                return f"🕐 Сейчас {now.strftime('%H:%M')}, {name}. {random.choice(['Успеваешь по расписанию?', 'Как дела с задачами?', 'Все под контролем?'])}"
#            return f"🕐 It's {now.strftime('%H:%M')}, {name}. {random.choice(['Are you on schedule?', 'How are your tasks coming along?', 'Everything under control?'])}"
#        
#        elif intent == 'date':
#            now = datetime.now(TIMEZONE)
#            if lang == 'ru':
#                return f"📅 Сегодня {now.strftime('%d.%m.%Y')}, {name}. {random.choice(['Хорошего дня!', 'Удачной учебы!', 'Продуктивного дня!'])}"
#            return f"📅 Today is {now.strftime('%A, %B %d, %Y')}, {name}. {random.choice(['Have a great day!', 'Good luck with your studies!', 'Make it productive!'])}"
#        
#        else:
#            return random.choice(responses['casual'])
#    
#    def generate_response(self, user_id, message, lang='en'):
#        """Main response generator with enhanced comprehension"""
#        intent = self.understand_intent(message, lang)
#        return self.get_conversational_response(user_id, message, intent, lang)
#    
#    def handle_name_intro(self, user_id, message, lang='en'):
#        # Try to extract name from greeting
#        words = message.lower().split()
#        if 'my name is' in message.lower() or 'call me' in message.lower() or 'зовут' in message.lower():
#            for i, word in enumerate(words):
#                if word in ['is', 'me', 'зовут'] and i + 1 < len(words):
#                    name = words[i + 1].capitalize()
#                    set_user_name(user_id, name)
#                    if lang == 'ru':
#                        return f"Приятно познакомиться, {name}! 👋 Теперь я буду знать, как к тебе обращаться. Чем могу помочь?"
#                    return f"Nice to meet you, {name}! 👋 I'll remember your name. How can I help you today?"
#        return None
#
## ========== VK BOT SETUP ==========
#def send_message(vk, user_id, text, keyboard=None):
#    try:
#        if keyboard is None:
#            keyboard = VkKeyboard().get_empty_keyboard()
#        vk.messages.send(user_id=user_id, message=text, random_id=get_random_id(), keyboard=keyboard)
#    except Exception as e:
#        logging.error(f"Send error: {e}")
#
#def get_keyboard(lang='en'):
#    keyboard = VkKeyboard(one_time=False)
#    if lang == 'ru':
#        keyboard.add_button("📅 Что сегодня?", color=VkKeyboardColor.PRIMARY)
#        keyboard.add_button("➕ Добавить пару", color=VkKeyboardColor.POSITIVE)
#        keyboard.add_line()
#        keyboard.add_button("📝 Мои задачи", color=VkKeyboardColor.SECONDARY)
#        keyboard.add_button("➕ Добавить задачу", color=VkKeyboardColor.POSITIVE)
#        keyboard.add_line()
#        keyboard.add_button("📥 Как импортировать?", color=VkKeyboardColor.PRIMARY)
#        keyboard.add_button("❓ Помощь", color=VkKeyboardColor.SECONDARY)
#    else:
#        keyboard.add_button("📅 What's today?", color=VkKeyboardColor.PRIMARY)
#        keyboard.add_button("➕ Add class", color=VkKeyboardColor.POSITIVE)
#        keyboard.add_line()
#        keyboard.add_button("📝 My tasks", color=VkKeyboardColor.SECONDARY)
#        keyboard.add_button("➕ Add task", color=VkKeyboardColor.POSITIVE)
#        keyboard.add_line()
#        keyboard.add_button("📥 How to import?", color=VkKeyboardColor.PRIMARY)
#        keyboard.add_button("❓ Help", color=VkKeyboardColor.SECONDARY)
#    return keyboard.get_keyboard()
#
## ========== COMMAND HANDLERS ==========
#def handle_commands(vk, user_id, text, lang='en'):
#    # /add command
#    if text.startswith('/add'):
#        parts = text.split()
#        if len(parts) == 5:
#            _, subject, day, start, end = parts
#            if day.isdigit() and 0 <= int(day) <= 6:
#                add_class(user_id, subject, int(day), start, end)
#                days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
#                if lang == 'ru':
#                    days = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"]
#                    return f"✅ Добавлена пара: **{subject}** на {days[int(day)]} с {start} до {end}"
#                return f"✅ Added class: **{subject}** on {days[int(day)]} from {start} to {end}"
#        return "❌ Usage: /add <subject> <day(0-6)> <start> <end>" if lang == 'en' else "❌ Использование: /add <предмет> <день> <начало> <конец>"
#    
#    # /deadline command
#    if text.startswith('/deadline'):
#        parts = text.split(maxsplit=3)
#        if len(parts) == 4:
#            _, task, due_date, days = parts
#            if days.isdigit():
#                add_task(user_id, task, due_date, int(days))
#                return "✅ Task added! I'll remind you before the deadline." if lang == 'en' else "✅ Задача добавлена! Я напомню перед дедлайном."
#        return "❌ Usage: /deadline <task> <YYYY-MM-DD HH:MM> <days>" if lang == 'en' else "❌ Использование: /deadline <задача> <ГГГГ-ММ-ДД ЧЧ:ММ> <дни>"
#    
#    return None
#
## ========== MAIN MESSAGE HANDLER ==========
#def handle_message(vk, user_id, text, attachments):
#    # Check for ICS link in message
#    if '.ics' in text and ('http://' in text or 'https://' in text):
#        url_match = re.search(r'(https?://[^\s]+\.ics)', text)
#        if url_match:
#            ics_url = url_match.group(1)
#            send_message(vk, user_id, "⏳ Importing schedule from link... Please wait.")
#            count = import_ics_from_link(user_id, ics_url)
#            if count == -1:
#                send_message(vk, user_id, "❌ Failed to download the ICS file. Check if the link is correct.")
#            elif count == 0:
#                send_message(vk, user_id, "⚠️ No classes found in the calendar file.")
#            else:
#                lang = get_user_lang(user_id)
#                name = get_user_name(user_id) or "there"
#                if lang == 'ru':
#                    send_message(vk, user_id, f"✅ Успешно импортировано {count} пар! 🎉\n\nТеперь я буду напоминать тебе о парах за 60-90 минут до начала, {name if name != 'there' else ''}!")
#                else:
#                    send_message(vk, user_id, f"✅ Successfully imported {count} classes! 🎉\n\nI'll now remind you about classes 60-90 minutes before they start, {name if name != 'there' else ''}!")
#            return
#    
#    # Check for /ics or /import command
#    if text.startswith('/ics') or text.startswith('/import'):
#        parts = text.split(maxsplit=1)
#        if len(parts) == 2:
#            ics_url = parts[1].strip()
#            if ics_url.startswith(('http://', 'https://')):
#                send_message(vk, user_id, "⏳ Importing schedule from link... Please wait.")
#                count = import_ics_from_link(user_id, ics_url)
#                if count == -1:
#                    send_message(vk, user_id, "❌ Failed to download. Check the link.")
#                elif count == 0:
#                    send_message(vk, user_id, "⚠️ No classes found.")
#                else:
#                    lang = get_user_lang(user_id)
#                    name = get_user_name(user_id) or "there"
#                    if lang == 'ru':
#                        send_message(vk, user_id, f"✅ Успешно импортировано {count} пар! 🎉\n\nТеперь я буду напоминать тебе о парах за 60-90 минут до начала, {name if name != 'there' else ''}!")
#                    else:
#                        send_message(vk, user_id, f"✅ Successfully imported {count} classes! 🎉\n\nI'll now remind you about classes 60-90 minutes before they start, {name if name != 'there' else ''}!")
#            else:
#                send_message(vk, user_id, "❌ Please provide a valid HTTP or HTTPS link.\n\nExample: /ics https://example.com/schedule.ics")
#        else:
#            lang = get_user_lang(user_id)
#            name = get_user_name(user_id) or ""
#            if lang == 'ru':
#                send_message(vk, user_id, f"📥 **Как импортировать расписание, {name if name else 'друг'}:**\n\nОтправь команду с ссылкой:\n`/ics https://example.com/schedule.ics`\n\nИли просто отправь ссылку на ICS файл!\n\n💡 Пример: https://myuniversity.com/timetable.ics\n\n✨ **Где взять ссылку?**\n• Университетский портал (кнопка 'Экспорт')\n• Google Календарь → Настройки\n• Любой календарь с ICS форматом")
#            else:
#                send_message(vk, user_id, f"📥 **How to import your schedule, {name if name else 'friend'}:**\n\nSend command with link:\n`/ics https://example.com/schedule.ics`\n\nOr just send the ICS link directly!\n\n💡 Example: https://myuniversity.com/timetable.ics\n\n✨ **Where to get the link?**\n• University portal (look for 'Export' button)\n• Google Calendar → Settings\n• Any calendar with ICS format")
#        return
#    
#    # Process normal messages with the assistant
#    lang = SmartLanguageDetector.detect(text)
#    set_user_lang(user_id, lang)
#    
#    # Handle name introduction
#    name_response = assistant.handle_name_intro(user_id, text, lang)
#    if name_response:
#        send_message(vk, user_id, name_response, get_keyboard(lang))
#        save_conversation(user_id, text, name_response)
#        return
#    
#    # Handle commands
#    cmd_response = handle_commands(vk, user_id, text, lang)
#    if cmd_response:
#        send_message(vk, user_id, cmd_response, get_keyboard(lang))
#        save_conversation(user_id, text, cmd_response)
#        return
#    
#    # Generate intelligent response
#    response = assistant.generate_response(user_id, text, lang)
#    send_message(vk, user_id, response, get_keyboard(lang))
#    save_conversation(user_id, text, response)
#
## ========== REMINDER SYSTEM ==========
#def check_reminders(vk):
#    try:
#        conn = sqlite3.connect("assistant_bot.db")
#        c = conn.cursor()
#        now = datetime.now(TIMEZONE)
#        current_day = now.weekday()
#        
#        c.execute("SELECT DISTINCT user_id FROM schedule")
#        users = c.fetchall()
#        
#        for (user_id,) in users:
#            c.execute("SELECT language, name FROM users WHERE vk_id = ?", (user_id,))
#            user_data = c.fetchone()
#            lang = user_data[0] if user_data else 'en'
#            name = user_data[1] if user_data and user_data[1] else ''
#            
#            c.execute("SELECT subject, start_time FROM schedule WHERE user_id = ? AND day_of_week = ?", (user_id, current_day))
#            classes = c.fetchall()
#            
#            for subject, start_time in classes:
#                hour, minute = map(int, start_time.split(':'))
#                class_time = now.replace(hour=hour, minute=minute, second=0)
#                minutes_until = (class_time - now).total_seconds() / 60
#                
#                if 60 <= minutes_until <= 90:
#                    key = f"reminder_{user_id}_{current_day}_{start_time}"
#                    c.execute("SELECT value FROM reminders WHERE key = ?", (key,))
#                    if not c.fetchone():
#                        if lang == 'ru':
#                            msg = f"🔔 **Напоминание, {name if name else 'друг'}!**\n\nПара '{subject}' начнется через {int(minutes_until)} минут в {start_time}.\n\n{random.choice(['Не опаздывай! 📚', 'Будь готов! 💪', 'Удачи на паре! 🎓', 'Соберись! 🌟'])}"
#                        else:
#                            msg = f"🔔 **Reminder, {name if name else 'friend'}!**\n\nClass '{subject}' starts in {int(minutes_until)} minutes at {start_time}.\n\n{random.choice(['Don\'t be late! 📚', 'Get ready! 💪', 'Good luck in class! 🎓', 'You got this! 🌟'])}"
#                        
#                        send_message(vk, user_id, msg, get_keyboard(lang))
#                        c.execute("INSERT INTO reminders (key, value) VALUES (?, ?)", (key, "sent"))
#                        conn.commit()
#        
#        conn.close()
#    except Exception as e:
#        logging.error(f"Reminder error: {e}")
#
## ========== MAIN ==========
#scheduler = BackgroundScheduler()
#assistant = IntelligentAssistant()
#
#def main():
#    print("=" * 70)
#    print("🤖 Intelligent Study Assistant Bot - Enhanced Version")
#    print("=" * 70)
#    print("🎯 Features:")
#    print("   • Natural conversation like a real person")
#    print("   • Understands context and intent")
#    print("   • Smart schedule and task management")
#    print("   • Easy ICS import with instructions")
#    print("   • English & Russian support")
#    print("=" * 70 + "\n")
#    
#    try:
#        vk_session = vk_api.VkApi(token=VK_TOKEN)
#        vk = vk_session.get_api()
#        
#        # Start reminder scheduler
#        scheduler.add_job(lambda: check_reminders(vk), 'interval', minutes=5)
#        scheduler.start()
#        
#        print("✅ Bot is running! Press Ctrl+C to stop\n")
#        
#        longpoll = VkBotLongPoll(vk_session, GROUP_ID)
#        
#        for event in longpoll.listen():
#            if event.type == VkBotEventType.MESSAGE_NEW:
#                try:
#                    msg = event.object.message
#                    user_id = msg["from_id"]
#                    text = msg.get("text", "").strip()
#                    attachments = msg.get("attachments", [])
#                    
#                    # Handle ICS file upload (not link)
#                    ics_files = [att for att in attachments if att["type"] == "doc" and att["doc"]["title"].endswith(".ics")]
#                    if ics_files:
#                        url = ics_files[0]["doc"]["url"]
#                        resp = requests.get(url)
#                        if resp.status_code == 200:
#                            count = import_ics_from_content(user_id, resp.text)
#                            lang = SmartLanguageDetector.detect(text)
#                            name = get_user_name(user_id) or "there"
#                            if count > 0:
#                                if lang == 'ru':
#                                    msg_text = f"✅ Успешно импортировано {count} пар! 🎉\n\nЯ буду напоминать тебе о парах, {name if name != 'there' else ''}!"
#                                else:
#                                    msg_text = f"✅ Successfully imported {count} classes! 🎉\n\nI'll remind you about your classes, {name if name != 'there' else ''}!"
#                            else:
#                                msg_text = "❌ No valid events found." if lang == 'en' else "❌ Не найдено событий."
#                            send_message(vk, user_id, msg_text, get_keyboard(lang))
#                        continue
#                    
#                    # Handle button payloads
#                    payload = msg.get("payload")
#                    if payload:
#                        try:
#                            payload = json.loads(payload)
#                            if payload.get("cmd") == "complete":
#                                complete_task(payload["tid"], user_id)
#                                lang = get_user_lang(user_id)
#                                name = get_user_name(user_id) or "there"
#                                msg_text = f"✅ Great job, {name if name != 'there' else ''}! Task completed! 🎉" if lang == 'en' else f"✅ Отличная работа, {name if name != 'there' else ''}! Задача выполнена! 🎉"
#                                send_message(vk, user_id, msg_text, get_keyboard(lang))
#                        except:
#                            pass
#                        continue
#                    
#                    # Handle normal text messages (including ICS links)
#                    if text:
#                        handle_message(vk, user_id, text, attachments)
#                    else:
#                        lang = get_user_lang(user_id)
#                        name = get_user_name(user_id) or ""
#                        if lang == 'ru':
#                            welcome = f"👋 Привет, {name if name else 'друг'}! Я твой учебный ассистент. 📚\n\nСпроси 'Помощь' или 'Как импортировать расписание', чтобы начать!"
#                        else:
#                            welcome = f"👋 Hello, {name if name else 'friend'}! I'm your study assistant. 📚\n\nAsk 'Help' or 'How to import schedule' to get started!"
#                        send_message(vk, user_id, welcome, get_keyboard(lang))
#                        
#                except Exception as e:
#                    logging.error(f"Error: {e}")
#                    
#    except KeyboardInterrupt:
#        print("\n🛑 Bot stopped")
#    except Exception as e:
#        print(f"\n❌ Error: {e}")
#
#if __name__ == "__main__":
#    main()



#import logging
#import sqlite3
#import json
#import requests
#from datetime import datetime, timedelta
#import vk_api
#from vk_api.bot_longpoll import VkBotLongPoll, VkBotEventType
#from vk_api.keyboard import VkKeyboard, VkKeyboardColor
#from vk_api.utils import get_random_id
#from icalendar import Calendar
#from apscheduler.schedulers.background import BackgroundScheduler
#import pytz
#import re
#from collections import defaultdict
#import random
## Try to import language detection libraries
#try:
#    from langdetect import detect, detect_langs
#    from langdetect.lang_detect_exception import LangDetectException
#
#    LANGDETECT_AVAILABLE = True
#except ImportError:
#    LANGDETECT_AVAILABLE = False
#    print("⚠️ langdetect not installed. Run: pip install langdetect")
#try:
#    from deep_translator import GoogleTranslator
#    TRANSLATOR_AVAILABLE = True
#except ImportError:
#
#    TRANSLATOR_AVAILABLE = False
#    print("⚠️ deep-translator not installed. Run: pip install deep-translator")
## ========== CONFIGURATION ==========
#VK_TOKEN = "vk1.a.eZvEbyVQo2aLD4K-r_7DxudJLQ4iNke42CLOnxo-ewzkJhDCjgY-FFImW2JeNulCAByv9bzkSuo_VXZFEV1GbMGoTfjD_TlDUV_pfIIfXU2eJvNsYIVFvVRa7OQxAhzGJPle69aDCxH7jYlu-LbbfSLM-9ZVDiOkmo3zSdgiWYegoSqKJqtGAGoyldsJYC79Fc9up1aNsvk3uJ3NZaE6Xg"
#GROUP_ID = 237363984
#TIMEZONE = pytz.timezone("Asia/Novosibirsk")
#
#logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
## ========== UNIVERSAL LANGUAGE DETECTION ==========
#class UniversalLanguageDetector:
#
#    """Detects ANY language from user input"""
#    
#
#    # Common language codes and their native names
#    LANGUAGE_NAMES = {
#        'en': 'English', 'ru': 'Russian', 'es': 'Spanish', 'fr': 'French',
#        'de': 'German', 'it': 'Italian', 'pt': 'Portuguese', 'zh-cn': 'Chinese',
#        'zh-tw': 'Chinese', 'ja': 'Japanese', 'ko': 'Korean', 'ar': 'Arabic',
#        'hi': 'Hindi', 'tr': 'Turkish', 'nl': 'Dutch', 'pl': 'Polish',
#        'uk': 'Ukrainian', 'vi': 'Vietnamese', 'th': 'Thai', 'id': 'Indonesian',
#        'ms': 'Malay', 'fa': 'Persian', 'he': 'Hebrew', 'sv': 'Swedish',
#        'no': 'Norwegian', 'da': 'Danish', 'fi': 'Finnish', 'el': 'Greek',
#        'cs': 'Czech', 'hu': 'Hungarian', 'ro': 'Romanian', 'bg': 'Bulgarian',
#        'sr': 'Serbian', 'hr': 'Croatian', 'sk': 'Slovak', 'sl': 'Slovenian',
#        'lt': 'Lithuanian', 'lv': 'Latvian', 'et': 'Estonian', 'ca': 'Catalan',
#        'gl': 'Galician', 'eu': 'Basque', 'af': 'Afrikaans', 'sw': 'Swahili'
#    }
#    
#    # Unicode ranges for script detection (fallback)
#    SCRIPT_RANGES = {
#        'ru': (('\u0400', '\u04FF'),),  # Cyrillic
#        'zh': (('\u4e00', '\u9fff'),),  # Chinese
#        'ja': (('\u3040', '\u309f'), ('\u30a0', '\u30ff')),  # Japanese
#        'ko': (('\uac00', '\ud7af'),),  # Korean
#        'ar': (('\u0600', '\u06ff'),),  # Arabic
#        'he': (('\u0590', '\u05ff'),),  # Hebrew
#        'th': (('\u0e00', '\u0e7f'),),  # Thai
#        'hi': (('\u0900', '\u097f'),),  # Devanagari
#        'el': (('\u0370', '\u03ff'),),  # Greek
#    }
#    
#    @staticmethod
#    def detect(text):
#        """Detect language from ANY text"""
#        if not text or len(text.strip()) < 2:
#            return 'en'
#        
#        # Method 1: Use langdetect library (most accurate)
#        if LANGDETECT_AVAILABLE:
#            try:
#                # Clean the text
#                clean_text = re.sub(r'[^\w\s\u0400-\u04FF\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u0600-\u06ff\u0900-\u097f\u0370-\u03ff]', ' ', text)
#                candidates = detect_langs(clean_text)
#                if candidates:
#                    best = candidates[0]
#                    lang_code = best.lang.split('-')[0]
#                    if best.prob > 0.5:  # Confidence threshold
#                        return lang_code
#            except LangDetectException:
#                pass
#            except Exception as e:
#                logging.debug(f"Langdetect error: {e}")
#        
#        # Method 2: Script-based detection
#        for lang, ranges in UniversalLanguageDetector.SCRIPT_RANGES.items():
#            match_count = 0
#            for start, end in ranges:
#                match_count += sum(1 for c in text if start <= c <= end)
#            if match_count > len(text) * 0.1:  # At least 10% matches
#                return lang
#        
#        # Method 3: Check for common words in various languages
#        language_indicators = {
#            'es': ['el', 'la', 'los', 'las', 'y', 'en', 'por', 'para', 'con', 'como'],
#            'fr': ['le', 'la', 'les', 'et', 'en', 'pour', 'par', 'avec', 'que', 'est'],
#            'de': ['der', 'die', 'und', 'in', 'auf', 'mit', 'für', 'ist', 'nicht'],
#            'it': ['il', 'la', 'e', 'in', 'per', 'con', 'che', 'è', 'sono'],
#            'pt': ['o', 'a', 'os', 'as', 'e', 'em', 'por', 'para', 'com', 'como'],
#            'nl': ['de', 'het', 'een', 'en', 'van', 'niet', 'op', 'zijn'],
#            'pl': ['się', 'na', 'i', 'nie', 'w', 'z', 'do', 'jest'],
#            'tr': ['ve', 'bir', 'bu', 'için', 'ile', 'de', 'mi', 'var'],
#            'vi': ['và', 'của', 'một', 'không', 'có', 'tôi', 'bạn'],
#        }
#        
#        text_lower = text.lower()
#        for lang, words in language_indicators.items():
#            matches = sum(1 for word in words if word in text_lower)
#            if matches >= 2:  # At least 2 common words
#                return lang
#        
#        # Default to English for unknown
#        return 'en'
#    
#    @staticmethod
#    def get_language_name(code):
#        """Get human-readable language name"""
#        code = code.split('-')[0].lower()
#        return UniversalLanguageDetector.LANGUAGE_NAMES.get(code, code.upper())
## ========== TRANSLATION MANAGER ==========
#class TranslationManager:
#    def __init__(self):
#        self.translator = None
#
#        if TRANSLATOR_AVAILABLE:
#            try:
#                self.translator = GoogleTranslator()
#                print("✅ Google Translate initialized for universal language support")
#            except Exception as e:
#                print(f"⚠️ Translation init failed: {e}")
#    
#    def translate(self, text, target_lang='en'):
#        """Translate text to target language"""
#        if not text or target_lang == 'en' or not self.translator:
#            return text
#        
#        try:
#            translator = GoogleTranslator(source='auto', target=target_lang)
#            result = translator.translate(text)
#            return result if result else text
#        except Exception as e:
#            logging.error(f"Translation error: {e}")
#            return text
## Initialize translator
#translator_manager = TranslationManager()
#language_detector = UniversalLanguageDetector()
## ========== DATABASE WITH CONTEXT MEMORY ==========
#
#def init_db():
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#
#    c.execute("""CREATE TABLE IF NOT EXISTS users (
#        vk_id INTEGER PRIMARY KEY,
#        language TEXT DEFAULT 'en',
#        name TEXT DEFAULT '',
#        last_interaction DATETIME DEFAULT CURRENT_TIMESTAMP,
#        conversation_context TEXT DEFAULT ''
#    )""")
#    c.execute("""CREATE TABLE IF NOT EXISTS schedule (
#        id INTEGER PRIMARY KEY AUTOINCREMENT,
#        user_id INTEGER,
#        subject TEXT,
#        day_of_week INTEGER,
#        start_time TEXT,
#        end_time TEXT,
#        location TEXT DEFAULT '',
#        teacher TEXT DEFAULT '',
#        notes TEXT DEFAULT ''
#    )""")
#    c.execute("""CREATE TABLE IF NOT EXISTS deadlines (
#        id INTEGER PRIMARY KEY AUTOINCREMENT,
#        user_id INTEGER,
#        task TEXT,
#        due_date TEXT,
#        remind_days INTEGER,
#        priority TEXT DEFAULT 'normal',
#        notes TEXT DEFAULT '',
#        done INTEGER DEFAULT 0
#    )""")
#    c.execute("""CREATE TABLE IF NOT EXISTS reminders (
#        key TEXT PRIMARY KEY,
#        value TEXT,
#        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
#    )""")
#    c.execute("""CREATE TABLE IF NOT EXISTS conversations (
#        id INTEGER PRIMARY KEY AUTOINCREMENT,
#        user_id INTEGER,
#        message TEXT,
#        response TEXT,
#        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
#    )""")
#    conn.commit()
#    conn.close()
#init_db()
## ========== USER MANAGEMENT ==========
#def get_user_lang(user_id):
#
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#
#    c.execute("SELECT language FROM users WHERE vk_id = ?", (user_id,))
#    row = c.fetchone()
#    conn.close()
#    return row[0] if row else 'en'
#def set_user_lang(user_id, lang):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("INSERT OR REPLACE INTO users (vk_id, language) VALUES (?, ?)", (user_id, lang))
#
#    conn.commit()
#    conn.close()
#def get_user_name(user_id):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("SELECT name FROM users WHERE vk_id = ?", (user_id,))
#
#    row = c.fetchone()
#    conn.close()
#    return row[0] if row else None
#def set_user_name(user_id, name):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("UPDATE users SET name = ? WHERE vk_id = ?", (name, user_id))
#
#    conn.commit()
#    conn.close()
#def save_conversation(user_id, message, response):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("INSERT INTO conversations (user_id, message, response) VALUES (?, ?, ?)", (user_id, message, response))
#
#    conn.commit()
#    conn.close()
## ========== SCHEDULE MANAGEMENT ==========
#def add_class(user_id, subject, day, start, end, location='', teacher=''):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#
#    c.execute("""INSERT INTO schedule (user_id, subject, day_of_week, start_time, end_time, location, teacher) 
#                 VALUES (?,?,?,?,?,?,?)""", (user_id, subject, day, start, end, location, teacher))
#    conn.commit()
#    conn.close()
#def get_today_schedule(user_id):
#    today = datetime.now(TIMEZONE).weekday()
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#
#    c.execute("""SELECT subject, start_time, end_time, location, teacher FROM schedule 
#                 WHERE user_id = ? AND day_of_week = ? ORDER BY start_time""", (user_id, today))
#    rows = c.fetchall()
#    conn.close()
#    return rows
#def get_tomorrow_schedule(user_id):
#    tomorrow = (datetime.now(TIMEZONE).weekday() + 1) % 7
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#
#    c.execute("""SELECT subject, start_time, end_time, location, teacher FROM schedule 
#                 WHERE user_id = ? AND day_of_week = ? ORDER BY start_time""", (user_id, tomorrow))
#    rows = c.fetchall()
#    conn.close()
#    return rows
#def get_week_schedule(user_id):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("""SELECT subject, day_of_week, start_time, end_time FROM schedule 
#
#                 WHERE user_id = ? ORDER BY day_of_week, start_time""", (user_id,))
#    rows = c.fetchall()
#    conn.close()
#    return rows
#def find_next_class(user_id):
#    now = datetime.now(TIMEZONE)
#    current_day = now.weekday()
#    current_time = now.strftime("%H:%M")
#
#    
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("""SELECT subject, day_of_week, start_time, end_time FROM schedule 
#                 WHERE user_id = ? ORDER BY day_of_week, start_time""", (user_id,))
#    classes = c.fetchall()
#    conn.close()
#    
#    for subject, day, start, end in classes:
#        if day > current_day or (day == current_day and start > current_time):
#            return {'subject': subject, 'day': day, 'start': start, 'end': end}
#    if classes:
#        first = classes[0]
#        return {'subject': first[0], 'day': first[1], 'start': first[2], 'end': first[3]}
#    return None
## ========== DEADLINE MANAGEMENT ==========
#def add_task(user_id, task, due_date, days, priority='normal'):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#
#    c.execute("""INSERT INTO deadlines (user_id, task, due_date, remind_days, priority, done) 
#                 VALUES (?,?,?,?,?,0)""", (user_id, task, due_date, days, priority))
#    conn.commit()
#    conn.close()
#def get_upcoming_tasks(user_id, days=7):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("""SELECT id, task, due_date, priority FROM deadlines 
#
#                 WHERE user_id = ? AND done = 0 AND date(due_date) <= date('now', '+' || ? || ' days')
#                 ORDER BY due_date""", (user_id, days))
#    rows = c.fetchall()
#    conn.close()
#    return rows
#def complete_task(task_id, user_id):
#    conn = sqlite3.connect("assistant_bot.db")
#    c = conn.cursor()
#    c.execute("UPDATE deadlines SET done = 1 WHERE id = ? AND user_id = ?", (task_id, user_id))
#
#    conn.commit()
#    conn.close()
## ========== ICS IMPORT ==========
#def import_ics_from_link(user_id, ics_url):
#    try:
#        response = requests.get(ics_url, timeout=30)
#
#        response.raise_for_status()
#        cal = Calendar.from_ical(response.text)
#        count = 0
#        
#        for component in cal.walk():
#            if component.name == "VEVENT":
#                subject = str(component.get('SUMMARY', 'Class'))
#                dtstart = component.get('DTSTART')
#                dtend = component.get('DTEND')
#                
#                if dtstart and dtend:
#                    start = dtstart.dt
#                    end = dtend.dt
#                    if not isinstance(start, datetime):
#                        start = datetime.combine(start, datetime.min.time())
#                    if not isinstance(end, datetime):
#                        end = datetime.combine(end, datetime.min.time())
#                    
#                    add_class(user_id, subject, start.weekday(), start.strftime("%H:%M"), end.strftime("%H:%M"))
#                    count += 1
#        return count
#    except Exception as e:
#        logging.error(f"ICS import error: {e}")
#        return -1
#def import_ics_from_content(user_id, content):
#    try:
#        cal = Calendar.from_ical(content)
#        count = 0
#
#        for component in cal.walk():
#            if component.name == "VEVENT":
#                subject = str(component.get('SUMMARY', 'Class'))
#                dtstart = component.get('DTSTART')
#                dtend = component.get('DTEND')
#                if dtstart and dtend:
#                    start = dtstart.dt
#                    end = dtend.dt
#                    if not isinstance(start, datetime):
#                        start = datetime.combine(start, datetime.min.time())
#                    if not isinstance(end, datetime):
#                        end = datetime.combine(end, datetime.min.time())
#                    add_class(user_id, subject, start.weekday(), start.strftime("%H:%M"), end.strftime("%H:%M"))
#                    count += 1
#        return count
#    except Exception as e:
#        logging.error(f"ICS import error: {e}")
#        return 0
## ========== UNIVERSAL INTELLIGENT ASSISTANT ==========
#class UniversalAssistant:
#    def __init__(self):
#        self.contexts = defaultdict(dict)
#
#        
#        # Base responses in English (will be translated to any language)
#        self.base_responses = {
#            'greeting': "👋 Hello! I'm your personal study assistant. How can I help you today?",
#            'greeting_with_name': "👋 Hello {name}! Great to see you! How can I help you today?",
#            'schedule_empty': "📭 Your schedule is empty. Would you like to import your timetable? Send me an ICS link or file!",
#            'no_tasks': "✅ You have no pending tasks! Great job keeping up! 🎉",
#            'task_completed': "✅ Great work! Task completed! 🎉",
#            'import_success': "✅ Successfully imported {count} classes! I'll remind you before each class. 🎉",
#            'import_fail': "❌ Failed to import. Please check your link or file.",
#            'next_class': "⏰ Your next class is {subject} at {time}.",
#            'no_more_classes': "🎉 You have no more classes today! Time to relax!",
#            'help_text': """📚 **How I can help you:**
#📅 **Schedule:**
#• Ask "What's today?" for today's classes
#• Ask "What's tomorrow?" for tomorrow's schedule
#• Ask "What's next?" for your next class
#
#📥 **Import Schedule:**
#• Send an ICS link or file
#• Use /ics <your_link>
#📝 **Tasks:**
#
#• Ask "My tasks" to see deadlines
#• Say "I finished [task name]" to complete tasks
#💬 Just speak naturally in any language! I understand and respond in YOUR language! 🌍""",
#
#            'import_instructions': """📥 **How to import your schedule:**
#1️⃣ **Send a link:** Just paste your ICS link
#2️⃣ **Use command:** /ics https://example.com/schedule.ics
#
#3️⃣ **Upload file:** Attach an .ics file
#✨ **Where to get ICS link?**
#
#• University portal (look for "Export")
#• Google Calendar → Settings → Export
#• Any calendar that supports ICS format
#
#💡 I'll automatically remind you about classes 60-90 minutes before they start!"""
#        }
#    
#    def translate_response(self, user_id, text_key, **kwargs):
#
#        """Get response translated to user's language"""
#        user_lang = get_user_lang(user_id)
#        base_text = self.base_responses.get(text_key, text_key)
#        
#        # Format with variables
#        if kwargs:
#            try:
#                base_text = base_text.format(**kwargs)
#            except:
#                pass
#        
#        # Translate to user's language
#        if user_lang and user_lang != 'en':
#            translated = translator_manager.translate(base_text, user_lang)
#            if translated:
#                return translated
#        
#        return base_text
#    
#    def understand_intent_universal(self, text, user_lang='en'):
#        """Understand intent across any language"""
#        # Translate to English for consistent intent detection
#        english_text = text
#        if user_lang != 'en' and TRANSLATOR_AVAILABLE:
#            try:
#                translated = translator_manager.translate(text, 'en')
#                if translated:
#                    english_text = translated.lower()
#            except:
#                english_text = text.lower()
#        else:
#            english_text = text.lower()
#        
#        # Intent patterns in English (universal)
#        intents = {
#            'show_today': ['what classes today', 'today schedule', 'classes today', 'what do i have today', 'today\'s classes', 'show today', 'what today'],
#            'show_tomorrow': ['tomorrow schedule', 'classes tomorrow', 'what tomorrow', 'tomorrow classes', 'show tomorrow'],
#            'show_week': ['this week', 'week schedule', 'whole week', 'weekly schedule', 'show week'],
#            'next_class': ['what\'s next', 'next class', 'next lesson', 'coming up', 'what next', 'following class'],
#            'my_tasks': ['my tasks', 'show tasks', 'what tasks', 'pending tasks', 'my deadlines', 'tasks due'],
#            'add_task': ['add task', 'new task', 'add deadline', 'create task', 'make task'],
#            'add_class': ['add class', 'new class', 'add course', 'create class', 'make class'],
#            'complete_task': ['complete', 'finished', 'done', 'finished task', 'completed', 'task done'],
#            'import_ics': ['import schedule', 'import timetable', 'upload schedule', 'how to import', 'ics import'],
#            'help': ['help', 'what can you do', 'commands', 'how to use', 'assist'],
#            'greeting': ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'],
#            'thanks': ['thanks', 'thank you', 'appreciate', 'good bot'],
#            'who_are_you': ['who are you', 'what are you', 'your name', 'about you'],
#            'time': ['what time', 'current time', 'tell time', 'what\'s the time'],
#            'date': ['what date', 'today date', 'what day', 'today\'s date'],
#        }
#        
#        for intent, keywords in intents.items():
#            if any(keyword in english_text for keyword in keywords):
#                return intent
#        
#        return 'casual'
#    
#    def generate_response(self, user_id, message, user_lang):
#        """Generate response in user's language"""
#        intent = self.understand_intent_universal(message, user_lang)
#        name = get_user_name(user_id)
#        
#        # Handle different intents
#        if intent == 'greeting':
#            if name:
#                return self.translate_response(user_id, 'greeting_with_name', name=name)
#            return self.translate_response(user_id, 'greeting')
#        
#        elif intent == 'show_today':
#            classes = get_today_schedule(user_id)
#            if not classes:
#                return self.translate_response(user_id, 'schedule_empty')
#            
#            # Translate day names to user's language
#            days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
#            if user_lang != 'en':
#                days = [translator_manager.translate(day, user_lang) or day for day in days]
#            
#            response = f"📚 **{self.translate_response(user_id, 'schedule_header') if 'schedule_header' in self.base_responses else 'Your Schedule for Today:'}**\n\n"
#            for subject, start, end, location, teacher in classes:
#                response += f"⏰ {start}-{end} • **{subject}**\n"
#                if location:
#                    response += f"   📍 {location}\n"
#                if teacher:
#                    response += f"   👨‍🏫 {teacher}\n"
#                response += "\n"
#            
#            next_class = find_next_class(user_id)
#            if next_class:
#                next_text = self.translate_response(user_id, 'next_class', subject=next_class['subject'], time=next_class['start'])
#                response += f"\n💡 {next_text}"
#            
#            return response
#        
#        elif intent == 'show_tomorrow':
#            classes = get_tomorrow_schedule(user_id)
#            if not classes:
#                return "📭 No classes tomorrow! Free day! 🎉"
#            
#            response = "📚 **Tomorrow's Schedule:**\n\n"
#            for subject, start, end, location, teacher in classes:
#                response += f"⏰ {start}-{end} • **{subject}**\n"
#                if location:
#                    response += f"   📍 {location}\n"
#                response += "\n"
#            return response
#        
#        elif intent == 'show_week':
#            classes = get_week_schedule(user_id)
#            if not classes:
#                return self.translate_response(user_id, 'schedule_empty')
#            
#            days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
#            if user_lang != 'en':
#                days = [translator_manager.translate(day, user_lang) or day for day in days]
#            
#            response = "📚 **Weekly Schedule:**\n\n"
#            current_day = None
#            for subject, day, start, end in classes:
#                if current_day != days[day]:
#                    current_day = days[day]
#                    response += f"\n**{current_day}:**\n"
#                response += f"   • {start}-{end} - {subject}\n"
#            return response
#        
#        elif intent == 'next_class':
#            next_class = find_next_class(user_id)
#            if next_class:
#                return self.translate_response(user_id, 'next_class', subject=next_class['subject'], time=next_class['start'])
#            return self.translate_response(user_id, 'no_more_classes')
#        
#        elif intent == 'my_tasks':
#            tasks = get_upcoming_tasks(user_id)
#            if not tasks:
#                return self.translate_response(user_id, 'no_tasks')
#            
#            response = "📋 **Your Tasks:**\n\n"
#            for tid, task, due_date, priority in tasks:
#                dt = datetime.strptime(due_date, "%Y-%m-%d %H:%M")
#                response += f"📌 **{task}**\n   ⏰ {dt.strftime('%d.%m.%Y at %H:%M')}\n\n"
#            response += "\n💡 Say 'complete [task name]' when you finish!"
#            return response
#        
#        elif intent == 'import_ics':
#            return self.translate_response(user_id, 'import_instructions')
#        
#        elif intent == 'help':
#            return self.translate_response(user_id, 'help_text')
#        
#        elif intent == 'thanks':
#            if user_lang == 'ru':
#                return f"Всегда пожалуйста, {name if name else 'друг'}! 😊 Рад помочь!"
#            return f"You're welcome, {name if name else 'friend'}! 😊 Happy to help!"
#        
#        elif intent == 'who_are_you':
#            if user_lang == 'ru':
#                return "🤖 Я твой персональный учебный ассистент! Помогаю с расписанием, задачами и напоминаниями. Говори на любом языке - я пойму! 🌍"
#            return "🤖 I'm your personal study assistant! I help with schedules, tasks, and reminders. I understand ANY language! 🌍"
#        
#        elif intent == 'time':
#            now = datetime.now(TIMEZONE)
#            if user_lang == 'ru':
#                return f"🕐 Сейчас {now.strftime('%H:%M')} в Новосибирске."
#            return f"🕐 It's {now.strftime('%H:%M')} in Novosibirsk."
#        
#        elif intent == 'date':
#            now = datetime.now(TIMEZONE)
#            if user_lang == 'ru':
#                return f"📅 Сегодня {now.strftime('%d.%m.%Y')}."
#            return f"📅 Today is {now.strftime('%B %d, %Y')}."
#        
#        elif intent == 'add_class':
#            if user_lang == 'ru':
#                return "📝 Чтобы добавить пару: `/add <предмет> <день> <начало> <конец>`\nДни: 0=Пн до 6=Вс\nПример: `/add Математика 1 10:30 12:05`"
#            return "📝 To add a class: `/add <subject> <day> <start> <end>`\nDays: 0=Mon to 6=Sun\nExample: `/add Mathematics 1 10:30 12:05`"
#        
#        elif intent == 'add_task':
#            if user_lang == 'ru':
#                return "📝 Чтобы добавить задачу: `/deadline <задача> <ГГГГ-ММ-ДД ЧЧ:ММ> <дни>`\nПример: `/deadline Курсовая 2025-12-20 23:59 7`"
#            return "📝 To add a task: `/deadline <task> <YYYY-MM-DD HH:MM> <days>`\nExample: `/deadline Final project 2025-12-20 23:59 7`"
#        
#        else:  # casual conversation
#            casual_responses = [
#                "I'm here to help with your schedule and tasks! What would you like to do? 📚",
#                "Feel free to ask me about your classes, add tasks, or import your timetable! 💫",
#                "I can help you stay organized! Try asking 'What's today?' or 'My tasks' 📅",
#                "Your personal study assistant at your service! What can I help you with? 🌟"
#            ]
#            if user_lang != 'en':
#                translated = translator_manager.translate(random.choice(casual_responses), user_lang)
#                if translated:
#                    return translated
#            return random.choice(casual_responses)
#    
#    def handle_name_intro(self, user_id, message, user_lang='en'):
#        text_lower = message.lower()
#        if 'my name is' in text_lower or 'call me' in text_lower or 'зовут' in text_lower:
#            words = text_lower.split()
#            for i, word in enumerate(words):
#                if word in ['is', 'me', 'зовут'] and i + 1 < len(words):
#                    name = words[i + 1].capitalize()
#                    set_user_name(user_id, name)
#                    if user_lang == 'ru':
#                        return f"Приятно познакомиться, {name}! 👋 Теперь я буду знать, как к тебе обращаться!"
#                    return f"Nice to meet you, {name}! 👋 I'll remember your name!"
#        return None
## ========== VK BOT SETUP ==========
#def send_message(vk, user_id, text, keyboard=None):
#    try:
#        if keyboard is None:
#
#            keyboard = VkKeyboard().get_empty_keyboard()
#        vk.messages.send(user_id=user_id, message=text, random_id=get_random_id(), keyboard=keyboard)
#    except Exception as e:
#        logging.error(f"Send error: {e}")
#def get_keyboard(lang='en'):
#    keyboard = VkKeyboard(one_time=False)
#    
#    # Button texts in user's language
#
#    if lang == 'ru':
#        buttons = ["📅 Что сегодня?", "➕ Добавить пару", "📝 Мои задачи", "➕ Добавить задачу", "📥 Импорт", "❓ Помощь"]
#    else:
#        buttons = ["📅 What's today?", "➕ Add class", "📝 My tasks", "➕ Add task", "📥 Import", "❓ Help"]
#    
#    keyboard.add_button(buttons[0], color=VkKeyboardColor.PRIMARY)
#    keyboard.add_button(buttons[1], color=VkKeyboardColor.POSITIVE)
#    keyboard.add_line()
#    keyboard.add_button(buttons[2], color=VkKeyboardColor.SECONDARY)
#    keyboard.add_button(buttons[3], color=VkKeyboardColor.POSITIVE)
#    keyboard.add_line()
#    keyboard.add_button(buttons[4], color=VkKeyboardColor.PRIMARY)
#    keyboard.add_button(buttons[5], color=VkKeyboardColor.SECONDARY)
#    
#    return keyboard.get_keyboard()
## ========== COMMAND HANDLERS ==========
#def handle_commands(vk, user_id, text, lang='en'):
#    if text.startswith('/add'):
#        parts = text.split()
#
#        if len(parts) == 5:
#            _, subject, day, start, end = parts
#            if day.isdigit() and 0 <= int(day) <= 6:
#                add_class(user_id, subject, int(day), start, end)
#                days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
#                if lang == 'ru':
#                    days = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"]
#                return f"✅ Added: {subject} on {days[int(day)]} from {start} to {end}"
#        return "❌ Usage: /add <subject> <day(0-6)> <start> <end>"
#    
#    if text.startswith('/deadline'):
#        parts = text.split(maxsplit=3)
#        if len(parts) == 4:
#            _, task, due_date, days = parts
#            if days.isdigit():
#                add_task(user_id, task, due_date, int(days))
#                return "✅ Task added! I'll remind you."
#        return "❌ Usage: /deadline <task> <YYYY-MM-DD HH:MM> <days>"
#    
#    return None
## ========== MAIN MESSAGE HANDLER ==========
#def handle_message(vk, user_id, text, attachments):
#    # Detect user's language from their message
#    detected_lang = language_detector.detect(text)
#
#    set_user_lang(user_id, detected_lang)
#    
#    # Check for ICS link
#    if '.ics' in text and ('http://' in text or 'https://' in text):
#        url_match = re.search(r'(https?://[^\s]+\.ics)', text)
#        if url_match:
#            send_message(vk, user_id, "⏳ Importing schedule... Please wait.")
#            count = import_ics_from_link(user_id, url_match.group(1))
#            if count > 0:
#                name = get_user_name(user_id) or ""
#                msg = assistant.translate_response(user_id, 'import_success', count=count)
#                send_message(vk, user_id, msg, get_keyboard(detected_lang))
#            else:
#                send_message(vk, user_id, assistant.translate_response(user_id, 'import_fail'), get_keyboard(detected_lang))
#            return
#    
#    # Check for /ics or /import command
#    if text.startswith('/ics') or text.startswith('/import'):
#        parts = text.split(maxsplit=1)
#        if len(parts) == 2:
#            ics_url = parts[1].strip()
#            if ics_url.startswith(('http://', 'https://')):
#                send_message(vk, user_id, "⏳ Importing schedule... Please wait.")
#                count = import_ics_from_link(user_id, ics_url)
#                if count > 0:
#                    msg = assistant.translate_response(user_id, 'import_success', count=count)
#                    send_message(vk, user_id, msg, get_keyboard(detected_lang))
#                else:
#                    send_message(vk, user_id, assistant.translate_response(user_id, 'import_fail'), get_keyboard(detected_lang))
#            else:
#                send_message(vk, user_id, "❌ Please provide a valid HTTP or HTTPS link.")
#        else:
#            msg = assistant.translate_response(user_id, 'import_instructions')
#            send_message(vk, user_id, msg, get_keyboard(detected_lang))
#        return
#    
#    # Handle name introduction
#    name_response = assistant.handle_name_intro(user_id, text, detected_lang)
#    if name_response:
#        send_message(vk, user_id, name_response, get_keyboard(detected_lang))
#        save_conversation(user_id, text, name_response)
#        return
#    
#    # Handle commands
#    cmd_response = handle_commands(vk, user_id, text, detected_lang)
#    if cmd_response:
#        send_message(vk, user_id, cmd_response, get_keyboard(detected_lang))
#        save_conversation(user_id, text, cmd_response)
#        return
#    
#    # Generate intelligent response in user's language
#    response = assistant.generate_response(user_id, text, detected_lang)
#    send_message(vk, user_id, response, get_keyboard(detected_lang))
#    save_conversation(user_id, text, response)
## ========== REMINDER SYSTEM ==========
#def check_reminders(vk):
#    try:
#        conn = sqlite3.connect("assistant_bot.db")
#
#        c = conn.cursor()
#        now = datetime.now(TIMEZONE)
#        current_day = now.weekday()
#        
#        c.execute("SELECT DISTINCT user_id FROM schedule")
#        users = c.fetchall()
#        
#        for (user_id,) in users:
#            user_lang = get_user_lang(user_id)
#            name = get_user_name(user_id) or ""
#            
#            c.execute("SELECT subject, start_time FROM schedule WHERE user_id = ? AND day_of_week = ?", (user_id, current_day))
#            classes = c.fetchall()
#            
#            for subject, start_time in classes:
#                hour, minute = map(int, start_time.split(':'))
#                class_time = now.replace(hour=hour, minute=minute, second=0)
#                minutes_until = (class_time - now).total_seconds() / 60
#                
#                if 60 <= minutes_until <= 90:
#                    key = f"reminder_{user_id}_{current_day}_{start_time}"
#                    c.execute("SELECT value FROM reminders WHERE key = ?", (key,))
#                    if not c.fetchone():
#                        if user_lang == 'ru':
#                            msg = f"🔔 **Напоминание, {name if name else 'друг'}!**\n\nПара '{subject}' через {int(minutes_until)} минут в {start_time}.\n\nНе опаздывай! 📚"
#                        else:
#                            msg = f"🔔 **Reminder, {name if name else 'friend'}!**\n\nClass '{subject}' starts in {int(minutes_until)} minutes at {start_time}.\n\nDon't be late! 📚"
#                        
#                        send_message(vk, user_id, msg, get_keyboard(user_lang))
#                        c.execute("INSERT INTO reminders (key, value) VALUES (?, ?)", (key, "sent"))
#                        conn.commit()
#        
#        conn.close()
#    except Exception as e:
#        logging.error(f"Reminder error: {e}")
## ========== MAIN ==========
#scheduler = BackgroundScheduler()
#assistant = UniversalAssistant()
#def main():
#
#    print("=" * 70)
#    print("🌍 Universal Study Assistant Bot - ANY Language Support")
#    print("=" * 70)
#
#    print("🎯 Features:")
#    print("   • Understands and responds in ANY language")
#    print("   • Automatic language detection")
#    print("   • Natural conversation")
#    print("   • Schedule and task management")
#    print("   • ICS import with instructions")
#    print("=" * 70 + "\n")
#    
#    print("✅ Supported languages: English, Russian, Spanish, French, German,")
#    print("   Italian, Portuguese, Chinese, Japanese, Korean, Arabic, Hindi,")
#    print("   Turkish, Dutch, Polish, Ukrainian, Vietnamese, Thai, and MORE!")
#    print("=" * 70 + "\n")
#    
#    try:
#        vk_session = vk_api.VkApi(token=VK_TOKEN)
#        vk = vk_session.get_api()
#        
#        scheduler.add_job(lambda: check_reminders(vk), 'interval', minutes=5)
#        scheduler.start()
#        
#        print("✅ Bot is running! Press Ctrl+C to stop\n")
#        
#        longpoll = VkBotLongPoll(vk_session, GROUP_ID)
#        
#        for event in longpoll.listen():
#            if event.type == VkBotEventType.MESSAGE_NEW:
#                try:
#                    msg = event.object.message
#                    user_id = msg["from_id"]
#                    text = msg.get("text", "").strip()
#                    attachments = msg.get("attachments", [])
#                    
#                    # Handle ICS file upload
#                    ics_files = [att for att in attachments if att["type"] == "doc" and att["doc"]["title"].endswith(".ics")]
#                    if ics_files:
#                        url = ics_files[0]["doc"]["url"]
#                        resp = requests.get(url)
#                        if resp.status_code == 200:
#                            count = import_ics_from_content(user_id, resp.text)
#                            lang = language_detector.detect(text)
#                            if count > 0:
#                                msg = assistant.translate_response(user_id, 'import_success', count=count)
#                                send_message(vk, user_id, msg, get_keyboard(lang))
#                            else:
#                                send_message(vk, user_id, assistant.translate_response(user_id, 'import_fail'), get_keyboard(lang))
#                        continue
#                    
#                    # Handle button payloads
#                    payload = msg.get("payload")
#                    if payload:
#                        try:
#                            payload = json.loads(payload)
#                            if payload.get("cmd") == "complete":
#                                complete_task(payload["tid"], user_id)
#                                lang = get_user_lang(user_id)
#                                msg = assistant.translate_response(user_id, 'task_completed')
#                                send_message(vk, user_id, msg, get_keyboard(lang))
#                        except:
#                            pass
#                        continue
#                    
#                    # Handle text messages
#                    if text:
#                        handle_message(vk, user_id, text, attachments)
#                    else:
#                        lang = get_user_lang(user_id)
#                        welcome = assistant.translate_response(user_id, 'greeting')
#                        send_message(vk, user_id, welcome, get_keyboard(lang))
#                        
#                except Exception as e:
#                    logging.error(f"Error: {e}")
#                    
#    except KeyboardInterrupt:
#        print("\n🛑 Bot stopped")
#    except Exception as e:
#        print(f"\n❌ Error: {e}")
#if __name__ == "__main__":
#    main()

  
#import logging
#import sqlite3
#import json
#import requests
#from datetime import datetime, timedelta
#import vk_api
#from vk_api.bot_longpoll import VkBotLongPoll, VkBotEventType
#from vk_api.keyboard import VkKeyboard, VkKeyboardColor
#from vk_api.utils import get_random_id
#from icalendar import Calendar
#from apscheduler.schedulers.background import BackgroundScheduler
#import pytz
#import re
#import random
#from collections import defaultdict
#
## ========== CONFIGURATION ==========
#VK_TOKEN = "vk1.a.eZvEbyVQo2aLD4K-r_7DxudJLQ4iNke42CLOnxo-ewzkJhDCjgY-FFImW2JeNulCAByv9bzkSuo_VXZFEV1GbMGoTfjD_TlDUV_pfIIfXU2eJvNsYIVFvVRa7OQxAhzGJPle69aDCxH7jYlu-LbbfSLM-9ZVDiOkmo3zSdgiWYegoSqKJqtGAGoyldsJYC79Fc9up1aNsvk3uJ3NZaE6Xg"
#GROUP_ID = 237363984
#TIMEZONE = pytz.timezone("Asia/Novosibirsk")
#
#logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
#
## ========== DATABASE SETUP ==========
#def init_db():
#    conn = sqlite3.connect("assistant.db")
#    c = conn.cursor()
#    c.execute("""CREATE TABLE IF NOT EXISTS users (
#        vk_id INTEGER PRIMARY KEY,
#        name TEXT DEFAULT '',
#        language TEXT DEFAULT 'en',
#        reminder_offset INTEGER DEFAULT 75,
#        timezone TEXT DEFAULT 'Asia/Novosibirsk'
#    )""")
#    c.execute("""CREATE TABLE IF NOT EXISTS schedule (
#        id INTEGER PRIMARY KEY AUTOINCREMENT,
#        user_id INTEGER,
#        subject TEXT,
#        day INTEGER,
#        start_time TEXT,
#        end_time TEXT,
#        location TEXT DEFAULT '',
#        teacher TEXT DEFAULT '',
#        color TEXT DEFAULT ''
#    )""")
#    c.execute("""CREATE TABLE IF NOT EXISTS tasks (
#        id INTEGER PRIMARY KEY AUTOINCREMENT,
#        user_id INTEGER,
#        task TEXT,
#        due_date TEXT,
#        remind_days INTEGER,
#        priority TEXT DEFAULT 'normal',
#        category TEXT DEFAULT 'general',
#        done INTEGER DEFAULT 0
#    )""")
#    c.execute("""CREATE TABLE IF NOT EXISTS study_sessions (
#        id INTEGER PRIMARY KEY AUTOINCREMENT,
#        user_id INTEGER,
#        subject TEXT,
#        duration INTEGER,
#        date TEXT,
#        notes TEXT DEFAULT ''
#    )""")
#    c.execute("""CREATE TABLE IF NOT EXISTS reminders (
#        key TEXT PRIMARY KEY,
#        sent INTEGER DEFAULT 1,
#        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
#    )""")
#    conn.commit()
#    conn.close()
#
#init_db()
#
## ========== HELPER FUNCTIONS ==========
#def get_user_name(user_id):
#    conn = sqlite3.connect("assistant.db")
#    c = conn.cursor()
#    c.execute("SELECT name FROM users WHERE vk_id = ?", (user_id,))
#    row = c.fetchone()
#    conn.close()
#    return row[0] if row and row[0] else None
#
#def set_user_name(user_id, name):
#    conn = sqlite3.connect("assistant.db")
#    c = conn.cursor()
#    c.execute("INSERT OR REPLACE INTO users (vk_id, name) VALUES (?, ?)", (user_id, name))
#    conn.commit()
#    conn.close()
#
#def get_user_reminder_offset(user_id):
#    conn = sqlite3.connect("assistant.db")
#    c = conn.cursor()
#    c.execute("SELECT reminder_offset FROM users WHERE vk_id = ?", (user_id,))
#    row = c.fetchone()
#    conn.close()
#    return row[0] if row else 75
#
#def set_user_reminder_offset(user_id, minutes):
#    conn = sqlite3.connect("assistant.db")
#    c = conn.cursor()
#    c.execute("UPDATE users SET reminder_offset = ? WHERE vk_id = ?", (minutes, user_id))
#    conn.commit()
#    conn.close()
#
#def detect_language(text):
#    if not text:
#        return 'en'
#    cyrillic = sum(1 for c in text if '\u0400' <= c <= '\u04FF')
#    if cyrillic > len(text) * 0.1:
#        return 'ru'
#    return 'en'
#
## ========== SCHEDULE FUNCTIONS ==========
#def add_class(user_id, subject, day, start, end, location='', teacher=''):
#    conn = sqlite3.connect("assistant.db")
#    c = conn.cursor()
#    c.execute("INSERT INTO schedule (user_id, subject, day, start_time, end_time, location, teacher) VALUES (?,?,?,?,?,?,?)",
#              (user_id, subject, day, start, end, location, teacher))
#    conn.commit()
#    conn.close()
#
#def get_today_classes(user_id):
#    today = datetime.now(TIMEZONE).weekday()
#    conn = sqlite3.connect("assistant.db")
#    c = conn.cursor()
#    c.execute("SELECT subject, start_time, end_time, location, teacher FROM schedule WHERE user_id = ? AND day = ? ORDER BY start_time", 
#              (user_id, today))
#    rows = c.fetchall()
#    conn.close()
#    return rows
#
#def get_tomorrow_classes(user_id):
#    tomorrow = (datetime.now(TIMEZONE).weekday() + 1) % 7
#    conn = sqlite3.connect("assistant.db")
#    c = conn.cursor()
#    c.execute("SELECT subject, start_time, end_time, location, teacher FROM schedule WHERE user_id = ? AND day = ? ORDER BY start_time", 
#              (user_id, tomorrow))
#    rows = c.fetchall()
#    conn.close()
#    return rows
#
#def get_week_schedule(user_id):
#    conn = sqlite3.connect("assistant.db")
#    c = conn.cursor()
#    c.execute("SELECT subject, day, start_time, end_time FROM schedule WHERE user_id = ? ORDER BY day, start_time", (user_id,))
#    rows = c.fetchall()
#    conn.close()
#    return rows
#
#def get_next_class(user_id):
#    now = datetime.now(TIMEZONE)
#    current_day = now.weekday()
#    current_time = now.strftime("%H:%M")
#    
#    conn = sqlite3.connect("assistant.db")
#    c = conn.cursor()
#    c.execute("SELECT subject, day, start_time, location, teacher FROM schedule WHERE user_id = ? ORDER BY day, start_time", (user_id,))
#    classes = c.fetchall()
#    conn.close()
#    
#    for subject, day, start, location, teacher in classes:
#        if day > current_day or (day == current_day and start > current_time):
#            return subject, start, day, location, teacher
#    if classes:
#        return classes[0][0], classes[0][2], classes[0][1], classes[0][3], classes[0][4]
#    return None, None, None, None, None
#
#def get_class_count(user_id):
#    conn = sqlite3.connect("assistant.db")
#    c = conn.cursor()
#    c.execute("SELECT COUNT(*) FROM schedule WHERE user_id = ?", (user_id,))
#    count = c.fetchone()[0]
#    conn.close()
#    return count
#
#def get_upcoming_week_classes(user_id):
#    conn = sqlite3.connect("assistant.db")
#    c = conn.cursor()
#    now = datetime.now(TIMEZONE)
#    current_day = now.weekday()
#    c.execute("SELECT subject, day, start_time FROM schedule WHERE user_id = ? AND day >= ? ORDER BY day, start_time LIMIT 5", 
#              (user_id, current_day))
#    rows = c.fetchall()
#    conn.close()
#    return rows
#
## ========== TASK FUNCTIONS ==========
#def add_task(user_id, task, due_date, remind_days, priority='normal', category='general'):
#    conn = sqlite3.connect("assistant.db")
#    c = conn.cursor()
#    c.execute("INSERT INTO tasks (user_id, task, due_date, remind_days, priority, category, done) VALUES (?,?,?,?,?,?,0)",
#              (user_id, task, due_date, remind_days, priority, category))
#    conn.commit()
#    conn.close()
#
#def get_tasks(user_id, category=None):
#    conn = sqlite3.connect("assistant.db")
#    c = conn.cursor()
#    if category:
#        c.execute("SELECT id, task, due_date, remind_days, priority FROM tasks WHERE user_id = ? AND done = 0 AND category = ? ORDER BY due_date", 
#                  (user_id, category))
#    else:
#        c.execute("SELECT id, task, due_date, remind_days, priority FROM tasks WHERE user_id = ? AND done = 0 ORDER BY due_date", (user_id,))
#    rows = c.fetchall()
#    conn.close()
#    return rows
#
#def get_tasks_by_priority(user_id):
#    conn = sqlite3.connect("assistant.db")
#    c = conn.cursor()
#    c.execute("SELECT id, task, due_date, priority FROM tasks WHERE user_id = ? AND done = 0 ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END, due_date", 
#              (user_id,))
#    rows = c.fetchall()
#    conn.close()
#    return rows
#
#def complete_task(task_id, user_id):
#    conn = sqlite3.connect("assistant.db")
#    c = conn.cursor()
#    c.execute("UPDATE tasks SET done = 1 WHERE id = ? AND user_id = ?", (task_id, user_id))
#    conn.commit()
#    conn.close()
#
#def get_task_stats(user_id):
#    conn = sqlite3.connect("assistant.db")
#    c = conn.cursor()
#    c.execute("SELECT COUNT(*) FROM tasks WHERE user_id = ? AND done = 0", (user_id,))
#    pending = c.fetchone()[0]
#    c.execute("SELECT COUNT(*) FROM tasks WHERE user_id = ? AND done = 1", (user_id,))
#    completed = c.fetchone()[0]
#    conn.close()
#    return pending, completed
#
## ========== STUDY SESSION FUNCTIONS ==========
#def add_study_session(user_id, subject, duration, notes=''):
#    conn = sqlite3.connect("assistant.db")
#    c = conn.cursor()
#    today = datetime.now(TIMEZONE).strftime("%Y-%m-%d")
#    c.execute("INSERT INTO study_sessions (user_id, subject, duration, date, notes) VALUES (?,?,?,?,?)",
#              (user_id, subject, duration, today, notes))
#    conn.commit()
#    conn.close()
#
#def get_today_study_time(user_id):
#    conn = sqlite3.connect("assistant.db")
#    c = conn.cursor()
#    today = datetime.now(TIMEZONE).strftime("%Y-%m-%d")
#    c.execute("SELECT SUM(duration) FROM study_sessions WHERE user_id = ? AND date = ?", (user_id, today))
#    total = c.fetchone()[0]
#    conn.close()
#    return total or 0
#
#def get_weekly_study_time(user_id):
#    conn = sqlite3.connect("assistant.db")
#    c = conn.cursor()
#    week_ago = (datetime.now(TIMEZONE) - timedelta(days=7)).strftime("%Y-%m-%d")
#    c.execute("SELECT SUM(duration) FROM study_sessions WHERE user_id = ? AND date >= ?", (user_id, week_ago))
#    total = c.fetchone()[0]
#    conn.close()
#    return total or 0
#
## ========== ICS IMPORT ==========
#def import_ics(user_id, url):
#    try:
#        resp = requests.get(url, timeout=30)
#        cal = Calendar.from_ical(resp.text)
#        count = 0
#        for component in cal.walk():
#            if component.name == "VEVENT":
#                subject = str(component.get('SUMMARY', 'Class'))
#                dtstart = component.get('DTSTART').dt
#                dtend = component.get('DTEND').dt
#                location = str(component.get('LOCATION', ''))
#                if not isinstance(dtstart, datetime):
#                    dtstart = datetime.combine(dtstart, datetime.min.time())
#                add_class(user_id, subject, dtstart.weekday(), dtstart.strftime("%H:%M"), dtend.strftime("%H:%M"), location, '')
#                count += 1
#        return count
#    except Exception as e:
#        logging.error(f"ICS import error: {e}")
#        return -1
#
## ========== RESPONSES ==========
#RESPONSES = {
#    'en': {
#        'no_name': "Hey there! 👋 I'm your personal assistant. What's your name?",
#        'got_name': "Nice to meet you, {name}! 👋 I'm here to help with your schedule, tasks, and time management. What can I do for you today?",
#        'today_classes': "📅 **Today's Schedule, {name}:**\n\n{classes}\n{I'll remind you before each class! ⏰'}",
#        'no_classes': "🎉 You have no classes today, {name}! Free day! Need help with tasks or study planning?",
#        'tomorrow_classes': "📅 **Tomorrow's Schedule, {name}:**\n\n{classes}",
#        'no_tomorrow': "🎉 No classes tomorrow, {name}! Enjoy your day off!",
#        'week_schedule': "📅 **Weekly Schedule, {name}:**\n\n{schedule}",
#        'next_class': "⏰ {name}, your next class is **{subject}** at {time}.\n📍 {location}\n👨‍🏫 {teacher}\n\nThat's in about {minutes} minutes!",
#        'no_next': "🎉 You're all done with classes for today, {name}! Time to relax or study!",
#        'tasks': "📋 **Your Tasks, {name}:**\n\n{tasks}\n\n💡 Tip: Say 'Done [task]' when you complete something!",
#        'no_tasks': "✅ Great job, {name}! You have no pending tasks. All caught up! 🎉",
#        'task_added': "✅ Got it, {name}! I've added '{task}' to your {category} tasks (Priority: {priority}). I'll remind you {days} day(s) before.",
#        'task_done': "🎉 Awesome work, {name}! I've marked '{task}' as complete. {remaining} task(s) left!",
#        'import_success': "🎉 Perfect! I've imported {count} classes into your schedule, {name}.\n\n✅ Your timetable is ready!\n⏰ I'll remind you 60-90 minutes before each class!\n📅 Ask 'What's today?' to see your schedule.",
#        'import_fail': "❌ Hmm, that link didn't work, {name}. Make sure it's a valid ICS file link.\n\nTry: /ics https://example.com/schedule.ics",
#        'import_instructions': "📥 **How to Import Your Schedule, {name}:**\n\n**Method 1 - Send a link:**\nJust send me any ICS link\n\n**Method 2 - Use command:**\n`/ics https://your-link.ics`\n\n**Method 3 - Upload file:**\nAttach an .ics file\n\n**Where to get ICS links?**\n• University portal (Export button)\n• Google Calendar → Settings → Export\n• Any calendar app\n\n**What happens next?**\n✅ I add all your classes\n✅ I remind you 60-90 minutes before\n✅ You can ask about your schedule anytime!",
#        'stats': "📊 **Your Study Stats, {name}:**\n\n📚 Total Classes: {total_classes}\n✅ Pending Tasks: {pending_tasks}\n🎯 Completed Tasks: {completed_tasks}\n⏱️ Today's Study Time: {today_study} min\n📈 Weekly Study Time: {weekly_study} min\n\nKeep up the great work! 💪",
#        'study_logged': "📝 Got it, {name}! I've logged {duration} minutes of studying for {subject}. Total today: {total} minutes. Keep going! 💪",
#        'reminder_set': "⏰ I'll remind you {minutes} minutes before your classes, {name}! You can change this anytime.",
#        'priority_tasks': "📋 **Tasks by Priority, {name}:**\n\n🔴 HIGH PRIORITY:\n{high}\n🟡 MEDIUM PRIORITY:\n{medium}\n🟢 LOW PRIORITY:\n{low}",
#        'upcoming_classes': "📅 **Upcoming Classes This Week, {name}:**\n\n{classes}\n\nI'll remind you before each one! ⏰",
#        'help': """🤖 **What I Can Do For You, {name}:**
#
#📅 **SCHEDULE**
#• "What's today?" - Today's classes
#• "What's tomorrow?" - Tomorrow's classes
#• "What's this week?" - Full week schedule
#• "What's next?" - Next class
#• Send ICS link - Import timetable
#
#📝 **TASKS**
#• "My tasks" - See all tasks
#• "Priority tasks" - Sort by priority
#• /task "Task" 2025-12-20 23:59 7 high study
#• "Done [task]" - Mark complete
#
#📊 **STATISTICS**
#• "My stats" - View progress
#• "Study 30 math" - Log study time
#
#⏰ **REMINDERS**
#• Automatic 60-90 min before class
#• Task reminders before deadlines
#
#💬 Just tell me what you need naturally!""",
#        'sorry': "Sorry, {name}, I didn't quite get that. Try asking for 'help' or rephrase! 😊",
#        'thanks': "You're welcome, {name}! 😊 Anything else I can help with?",
#        'greeting': "Hey {name}! 👋 Good to see you. How can I help with your time management today?",
#        'time': "🕐 It's {time}, {name}. What's on your schedule?",
#        'joke': "😂 Here's a joke for you, {name}: {joke}",
#        'advice': "💡 Time management tip, {name}: {advice}"
#    },
#    'ru': {
#        'no_name': "Привет! 👋 Я твой помощник. Как тебя зовут?",
#        'got_name': "Приятно познакомиться, {name}! 👋 Я помогу с расписанием, задачами и тайм-менеджментом. Чем могу помочь?",
#        'today_classes': "📅 **Расписание на сегодня, {name}:**\n\n{classes}\nЯ напомню перед каждой парой! ⏰",
#        'no_classes': "🎉 У тебя сегодня нет пар, {name}! Свободный день! Нужна помощь с задачами?",
#        'tomorrow_classes': "📅 **Расписание на завтра, {name}:**\n\n{classes}",
#        'no_tomorrow': "🎉 Завтра нет пар, {name}! Отдыхай!",
#        'week_schedule': "📅 **Расписание на неделю, {name}:**\n\n{schedule}",
#        'next_class': "⏰ {name}, следующая пара: **{subject}** в {time}.\n📍 {location}\n👨‍🏫 {teacher}\n\nЧерез {minutes} минут!",
#        'no_next': "🎉 На сегодня пар больше нет, {name}! Время отдыхать или учиться!",
#        'tasks': "📋 **Твои задачи, {name}:**\n\n{tasks}\n\n💡 Скажи 'Готово [задача]' когда сделаешь!",
#        'no_tasks': "✅ Отлично, {name}! Нет pending задач. Ты всё успел! 🎉",
#        'task_added': "✅ Понял, {name}! Добавил '{task}' в {category} (Приоритет: {priority}). Напомню за {days} дн.",
#        'task_done': "🎉 Молодец, {name}! Отметил '{task}' как готово. Осталось {remaining} задач(и)!",
#        'import_success': "🎉 Отлично! Импортировал {count} пар(ы) в расписание, {name}.\n\n✅ Расписание готово!\n⏰ Напомню за 60-90 минут до каждой пары!\n📅 Спроси 'Что сегодня?' чтобы увидеть расписание.",
#        'import_fail': "❌ Хм, ссылка не работает, {name}. Убедись, что это правильная ICS ссылка.\n\nПример: /ics https://example.com/schedule.ics",
#        'import_instructions': "📥 **Как импортировать расписание, {name}:**\n\n**Способ 1 - Отправь ссылку:**\nПросто отправь ICS ссылку\n\n**Способ 2 - Команда:**\n`/ics https://ссылка.ics`\n\n**Способ 3 - Файл:**\nПрикрепи .ics файл\n\n**Где взять ICS ссылку?**\n• Университетский портал (кнопка 'Экспорт')\n• Google Календарь → Настройки\n• Любое приложение-календарь\n\n**Что будет?**\n✅ Добавлю все пары\n✅ Напомню за 60-90 минут\n✅ Можешь спросить о расписании!",
#        'stats': "📊 **Твоя статистика, {name}:**\n\n📚 Всего пар: {total_classes}\n✅ Ожидающих задач: {pending_tasks}\n🎯 Выполненных задач: {completed_tasks}\n⏱️ Учился сегодня: {today_study} мин\n📈 За неделю: {weekly_study} мин\n\nТак держать! 💪",
#        'study_logged': "📝 Записал, {name}! {duration} минут учебы по {subject}. Сегодня уже {total} минут. Продолжай! 💪",
#        'reminder_set': "⏰ Буду напоминать за {minutes} минут до пар, {name}! Можешь изменить это в любой момент.",
#        'priority_tasks': "📋 **Задачи по приоритету, {name}:**\n\n🔴 ВЫСОКИЙ:\n{high}\n🟡 СРЕДНИЙ:\n{medium}\n🟢 НИЗКИЙ:\n{low}",
#        'upcoming_classes': "📅 **Ближайшие пары на неделе, {name}:**\n\n{classes}\n\nЯ напомню перед каждой! ⏰",
#        'help': """🤖 **Что я умею, {name}:**
#
#📅 **РАСПИСАНИЕ**
#• "Что сегодня?" - пары на сегодня
#• "Что завтра?" - пары на завтра
#• "Что на неделе?" - всё расписание
#• "Что дальше?" - следующую пару
#• Отправь ICS ссылку - импорт
#
#📝 **ЗАДАЧИ**
#• "Мои задачи" - список дел
#• "Приоритет задач" - сортировка
#• /task "Задача" 2025-12-20 23:59 7 high учеба
#• "Готово [задача]" - отметить
#
#📊 **СТАТИСТИКА**
#• "Моя статистика" - прогресс
#• "Учился 30 математика" - записать время
#
#⏰ **НАПОМИНАНИЯ**
#• Автоматически за 60-90 минут
#• Напоминания о дедлайнах
#
#💬 Просто скажи, что нужно!""",
#        'sorry': "Извини, {name}, я не понял. Попробуй спросить 'помощь' или перефразируй! 😊",
#        'thanks': "Пожалуйста, {name}! 😊 Ещё что-то нужно?",
#        'greeting': "Привет {name}! 👋 Рад тебя видеть. Как помочь с тайм-менеджментом сегодня?",
#        'time': "🕐 Сейчас {time}, {name}. Что в планах?",
#        'joke': "😂 Шутка для тебя, {name}: {joke}",
#        'advice': "💡 Совет по тайм-менеджменту, {name}: {advice}"
#    }
#}
#
## Jokes and advice
#JOKES = {
#    'en': ["Why don't scientists trust atoms? They make up everything!",
#           "What do you call a fake noodle? An impasta!",
#           "Why did the scarecrow win an award? He was outstanding in his field!"],
#    'ru': ["Почему программисты путают Хэллоуин с Рождеством? 31 Oct = 25 Dec!",
#           "Как называется ложная лапша? Паста-фальшивка!",
#           "Что говорит один ноль другому? Без тебя я просто пустое место!"]
#}
#
#ADVICE = {
#    'en': ["Break large tasks into smaller chunks - they feel less overwhelming!",
#           "Use the 2-minute rule: if it takes less than 2 minutes, do it immediately!",
#           "Schedule your most important tasks for your peak energy hours!",
#           "Take a 5-minute break every 25 minutes of focused work (Pomodoro)!",
#           "Review your schedule each morning - it sets you up for success!"],
#    'ru': ["Разбивай большие задачи на маленькие - так их легче выполнять!",
#           "Правило 2 минут: если дело занимает меньше 2 минут, сделай сразу!",
#           "Планируй важные задачи на часы пиковой энергии!",
#           "Делай 5-минутный перерыв каждые 25 минут работы (Помидор)!",
#           "Просматривай расписание каждое утро - это настраивает на успех!"]
#}
#
## ========== BOT FUNCTIONS ==========
#def send_message(vk, user_id, text, keyboard=None):
#    try:
#        if not keyboard:
#            keyboard = VkKeyboard().get_empty_keyboard()
#        vk.messages.send(user_id=user_id, message=text, random_id=get_random_id(), keyboard=keyboard)
#    except Exception as e:
#        logging.error(f"Send error: {e}")
#
#def get_main_keyboard(lang='en'):
#    keyboard = VkKeyboard(one_time=False)
#    if lang == 'ru':
#        keyboard.add_button("📅 Что сегодня?", color=VkKeyboardColor.PRIMARY)
#        keyboard.add_button("📅 Что завтра?", color=VkKeyboardColor.PRIMARY)
#        keyboard.add_line()
#        keyboard.add_button("⏰ Что дальше?", color=VkKeyboardColor.SECONDARY)
#        keyboard.add_button("📝 Мои задачи", color=VkKeyboardColor.SECONDARY)
#        keyboard.add_line()
#        keyboard.add_button("📊 Статистика", color=VkKeyboardColor.POSITIVE)
#        keyboard.add_button("📥 Импорт", color=VkKeyboardColor.POSITIVE)
#        keyboard.add_line()
#        keyboard.add_button("❓ Помощь", color=VkKeyboardColor.PRIMARY)
#    else:
#        keyboard.add_button("📅 What's today?", color=VkKeyboardColor.PRIMARY)
#        keyboard.add_button("📅 What's tomorrow?", color=VkKeyboardColor.PRIMARY)
#        keyboard.add_line()
#        keyboard.add_button("⏰ What's next?", color=VkKeyboardColor.SECONDARY)
#        keyboard.add_button("📝 My tasks", color=VkKeyboardColor.SECONDARY)
#        keyboard.add_line()
#        keyboard.add_button("📊 Statistics", color=VkKeyboardColor.POSITIVE)
#        keyboard.add_button("📥 Import", color=VkKeyboardColor.POSITIVE)
#        keyboard.add_line()
#        keyboard.add_button("❓ Help", color=VkKeyboardColor.PRIMARY)
#    return keyboard.get_keyboard()
#
## ========== MESSAGE HANDLER ==========
#def handle_message(vk, user_id, text, attachments):
#    lang = detect_language(text)
#    name = get_user_name(user_id)
#    
#    # First time user
#    if not name and not any(word in text.lower() for word in ['my name is', 'call me', 'меня зовут', 'зовут']):
#        send_message(vk, user_id, RESPONSES[lang]['no_name'], get_main_keyboard(lang))
#        return
#    
#    # Extract name
#    name_match = re.search(r'(?:my name is|call me|меня зовут|зовут)\s+([A-Za-zА-Яа-я]+)', text, re.IGNORECASE)
#    if name_match and not name:
#        name = name_match.group(1).capitalize()
#        set_user_name(user_id, name)
#        send_message(vk, user_id, RESPONSES[lang]['got_name'].format(name=name), get_main_keyboard(lang))
#        return
#    
#    # ICS Import
#    if '.ics' in text and ('http://' in text or 'https://' in text):
#        url_match = re.search(r'(https?://[^\s]+\.ics)', text)
#        if url_match:
#            send_message(vk, user_id, "⏳ Importing your schedule... Please wait.", get_main_keyboard(lang))
#            count = import_ics(user_id, url_match.group(1))
#            if count > 0:
#                send_message(vk, user_id, RESPONSES[lang]['import_success'].format(count=count, name=name), get_main_keyboard(lang))
#            else:
#                send_message(vk, user_id, RESPONSES[lang]['import_fail'].format(name=name), get_main_keyboard(lang))
#        return
#    
#    # /ics command
#    if text.startswith('/ics'):
#        parts = text.split(maxsplit=1)
#        if len(parts) == 2:
#            ics_url = parts[1].strip()
#            if ics_url.startswith(('http://', 'https://')):
#                send_message(vk, user_id, "⏳ Importing your schedule... Please wait.", get_main_keyboard(lang))
#                count = import_ics(user_id, ics_url)
#                if count > 0:
#                    send_message(vk, user_id, RESPONSES[lang]['import_success'].format(count=count, name=name), get_main_keyboard(lang))
#                else:
#                    send_message(vk, user_id, RESPONSES[lang]['import_fail'].format(name=name), get_main_keyboard(lang))
#            else:
#                send_message(vk, user_id, "❌ Please provide a valid HTTP or HTTPS link.", get_main_keyboard(lang))
#        else:
#            send_message(vk, user_id, RESPONSES[lang]['import_instructions'].format(name=name), get_main_keyboard(lang))
#        return
#    
#    # Import button
#    if text in ["📥 Import", "📥 Импорт"] or "how to import" in text.lower() or "как импортировать" in text.lower():
#        send_message(vk, user_id, RESPONSES[lang]['import_instructions'].format(name=name), get_main_keyboard(lang))
#        return
#    
#    # /task command
#    if text.startswith('/task'):
#        parts = text.split(maxsplit=4)
#        if len(parts) >= 4:
#            _, task, due_date, days = parts[0], parts[1], parts[2], parts[3]
#            priority = parts[4] if len(parts) > 4 else 'normal'
#            category = parts[5] if len(parts) > 5 else 'general'
#            if days.isdigit():
#                add_task(user_id, task, due_date, int(days), priority, category)
#                send_message(vk, user_id, RESPONSES[lang]['task_added'].format(name=name, task=task, days=days, priority=priority, category=category), get_main_keyboard(lang))
#            else:
#                send_message(vk, user_id, "Format: /task 'Task name' 2025-12-20 23:59 7 [priority] [category]", get_main_keyboard(lang))
#        else:
#            send_message(vk, user_id, "Format: /task 'Task name' YYYY-MM-DD HH:MM days [priority] [category]", get_main_keyboard(lang))
#        return
#    
#    # Study logging
#    study_match = re.search(r'(?:study|studied|учился|занимался)\s+(\d+)\s+(?:minutes?|min|минут?)\s+(?:for\s+)?(.+?)(?:\.|$)', text, re.IGNORECASE)
#    if study_match:
#        duration = int(study_match.group(1))
#        subject = study_match.group(2).strip()
#        add_study_session(user_id, subject, duration)
#        total = get_today_study_time(user_id)
#        send_message(vk, user_id, RESPONSES[lang]['study_logged'].format(name=name, duration=duration, subject=subject, total=total), get_main_keyboard(lang))
#        return
#    
#    text_lower = text.lower()
#    
#    # Today's schedule
#    if any(word in text_lower for word in ['today', 'сегодня', "what's today", 'что сегодня']):
#        classes = get_today_classes(user_id)
#        if classes:
#            days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
#            if lang == 'ru':
#                days = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"]
#            class_list = ""
#            for subj, start, end, loc, teacher in classes:
#                class_list += f"⏰ {start}-{end} • **{subj}**\n"
#                if loc:
#                    class_list += f"   📍 {loc}\n"
#                if teacher:
#                    class_list += f"   👨‍🏫 {teacher}\n"
#                class_list += "\n"
#            send_message(vk, user_id, RESPONSES[lang]['today_classes'].format(name=name, classes=class_list), get_main_keyboard(lang))
#        else:
#            send_message(vk, user_id, RESPONSES[lang]['no_classes'].format(name=name), get_main_keyboard(lang))
#        return
#    
#    # Tomorrow's schedule
#    if any(word in text_lower for word in ['tomorrow', 'завтра', "what's tomorrow", 'что завтра']):
#        classes = get_tomorrow_classes(user_id)
#        if classes:
#            class_list = ""
#            for subj, start, end, loc, teacher in classes:
#                class_list += f"⏰ {start}-{end} • **{subj}**\n"
#                if loc:
#                    class_list += f"   📍 {loc}\n"
#                class_list += "\n"
#            send_message(vk, user_id, RESPONSES[lang]['tomorrow_classes'].format(name=name, classes=class_list), get_main_keyboard(lang))
#        else:
#            send_message(vk, user_id, RESPONSES[lang]['no_tomorrow'].format(name=name), get_main_keyboard(lang))
#        return
#    
#    # Week schedule
#    if any(word in text_lower for word in ['week', 'weekly', 'this week', 'неделя', 'на неделе']):
#        classes = get_week_schedule(user_id)
#        if classes:
#            days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
#            if lang == 'ru':
#                days = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"]
#            schedule = ""
#            current_day = None
#            for subj, day, start, end in classes:
#                if current_day != days[day]:
#                    current_day = days[day]
#                    schedule += f"\n**{current_day}:**\n"
#                schedule += f"   • {start}-{end} - {subj}\n"
#            send_message(vk, user_id, RESPONSES[lang]['week_schedule'].format(name=name, schedule=schedule), get_main_keyboard(lang))
#        else:
#            send_message(vk, user_id, RESPONSES[lang]['no_classes'].format(name=name), get_main_keyboard(lang))
#        return
#    
#    # Upcoming classes
#    if any(word in text_lower for word in ['upcoming', 'coming up', 'ближайшие']):
#        classes = get_upcoming_week_classes(user_id)
#        if classes:
#            days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
#            if lang == 'ru':
#                days = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"]
#            class_list = ""
#            for subj, day, start in classes:
#                class_list += f"• {days[day]} at {start} - {subj}\n"
#            send_message(vk, user_id, RESPONSES[lang]['upcoming_classes'].format(name=name, classes=class_list), get_main_keyboard(lang))
#        else:
#            send_message(vk, user_id, RESPONSES[lang]['no_classes'].format(name=name), get_main_keyboard(lang))
#        return
#    
#    # Next class
#    if any(word in text_lower for word in ['next', "what's next", 'дальше', 'следующая']):
#        subject, time, day, location, teacher = get_next_class(user_id)
#        if subject:
#            now = datetime.now(TIMEZONE)
#            hour, minute = map(int, time.split(':'))
#            class_time = now.replace(hour=hour, minute=minute, second=0)
#            minutes = int((class_time - now).total_seconds() / 60)
#            send_message(vk, user_id, RESPONSES[lang]['next_class'].format(name=name, subject=subject, time=time, minutes=minutes, location=location or 'Not specified', teacher=teacher or 'Not specified'), get_main_keyboard(lang))
#        else:
#            send_message(vk, user_id, RESPONSES[lang]['no_next'].format(name=name), get_main_keyboard(lang))
#        return
#    
#    # My tasks
#    if any(word in text_lower for word in ['tasks', 'task', 'deadlines', 'задачи', 'дела', 'дедлайны']) and 'priority' not in text_lower:
#        tasks = get_tasks(user_id)
#        if tasks:
#            task_list = ""
#            for tid, task, due_date, days, priority in tasks:
#                dt = datetime.strptime(due_date, "%Y-%m-%d %H:%M")
#                priority_icon = "🔴" if priority == 'high' else "🟡" if priority == 'medium' else "🟢"
#                task_list += f"{priority_icon} **{task}**\n   ⏰ {dt.strftime('%d.%m.%Y %H:%M')}\n\n"
#            send_message(vk, user_id, RESPONSES[lang]['tasks'].format(name=name, tasks=task_list), get_main_keyboard(lang))
#        else:
#            send_message(vk, user_id, RESPONSES[lang]['no_tasks'].format(name=name), get_main_keyboard(lang))
#        return
#    
#    # Priority tasks
#    if 'priority tasks' in text_lower or 'priority' in text_lower or 'приоритет' in text_lower:
#        tasks = get_tasks_by_priority(user_id)
#        if tasks:
#            high = ""
#            medium = ""
#            low = ""
#            for tid, task, due_date, priority in tasks:
#                dt = datetime.strptime(due_date, "%Y-%m-%d %H:%M")
#                task_line = f"• {task} (due {dt.strftime('%d.%m.%Y')})\n"
#                if priority == 'high':
#                    high += task_line
#                elif priority == 'medium':
#                    medium += task_line
#                else:
#                    low += task_line
#            send_message(vk, user_id, RESPONSES[lang]['priority_tasks'].format(name=name, high=high or 'None', medium=medium or 'None', low=low or 'None'), get_main_keyboard(lang))
#        else:
#            send_message(vk, user_id, RESPONSES[lang]['no_tasks'].format(name=name), get_main_keyboard(lang))
#        return
#    
#    # Statistics
#    if any(word in text_lower for word in ['statistics', 'stats', 'статистика', 'прогресс']):
#        total_classes = get_class_count(user_id)
#        pending, completed = get_task_stats(user_id)
#        today_study = get_today_study_time(user_id)
#        weekly_study = get_weekly_study_time(user_id)
#        send_message(vk, user_id, RESPONSES[lang]['stats'].format(name=name, total_classes=total_classes, pending_tasks=pending, completed_tasks=completed, today_study=today_study, weekly_study=weekly_study), get_main_keyboard(lang))
#        return
#    
#    # Complete task
#    done_match = re.search(r'(?:done|finished|complete|готово|сделал|выполнил)\s+(.+?)(?:\.|$)', text, re.IGNORECASE)
#    if done_match:
#        task_name = done_match.group(1).strip()
#        tasks = get_tasks(user_id)
#        for tid, task, due_date, days, priority in tasks:
#            if task_name.lower() in task.lower() or task.lower() in task_name.lower():
#                complete_task(tid, user_id)
#                remaining = len(tasks) - 1
#                send_message(vk, user_id, RESPONSES[lang]['task_done'].format(name=name, task=task, remaining=remaining), get_main_keyboard(lang))
#                return
#        send_message(vk, user_id, f"Hmm, I couldn't find a task named '{task_name}', {name}. Can you check the name?", get_main_keyboard(lang))
#        return
#    
#    # Help
#    if any(word in text_lower for word in ['help', 'помощь', 'what can you do', 'команды']):
#        send_message(vk, user_id, RESPONSES[lang]['help'].format(name=name), get_main_keyboard(lang))
#        return
#    
#    # Thanks
#    if any(word in text_lower for word in ['thanks', 'thank you', 'спасибо']):
#        send_message(vk, user_id, RESPONSES[lang]['thanks'].format(name=name), get_main_keyboard(lang))
#        return
#    
#    # Time
#    if any(word in text_lower for word in ['time', 'время', 'который час']):
#        now = datetime.now(TIMEZONE)
#        send_message(vk, user_id, RESPONSES[lang]['time'].format(name=name, time=now.strftime('%H:%M')), get_main_keyboard(lang))
#        return
#    
#    # Joke
#    if any(word in text_lower for word in ['joke', 'шутка']):
#        joke = random.choice(JOKES[lang])
#        send_message(vk, user_id, RESPONSES[lang]['joke'].format(name=name, joke=joke), get_main_keyboard(lang))
#        return
#    
#    # Advice
#    if any(word in text_lower for word in ['advice', 'tip', 'совет']):
#        advice = random.choice(ADVICE[lang])
#        send_message(vk, user_id, RESPONSES[lang]['advice'].format(name=name, advice=advice), get_main_keyboard(lang))
#        return
#    
#    # Greeting
#    if any(word in text_lower for word in ['hello', 'hi', 'hey', 'привет']):
#        send_message(vk, user_id, RESPONSES[lang]['greeting'].format(name=name), get_main_keyboard(lang))
#        return
#    
#    # Default
#    send_message(vk, user_id, RESPONSES[lang]['sorry'].format(name=name), get_main_keyboard(lang))
#
## ========== REMINDER SYSTEM (60-90 MINUTES BEFORE CLASS) ==========
#def check_reminders(vk):
#    try:
#        conn = sqlite3.connect("assistant.db")
#        c = conn.cursor()
#        now = datetime.now(TIMEZONE)
#        current_day = now.weekday()
#        
#        # Get all users with schedule
#        c.execute("SELECT DISTINCT user_id FROM schedule")
#        users = c.fetchall()
#        
#        for (user_id,) in users:
#            lang = detect_language("")
#            name = get_user_name(user_id) or "friend"
#            offset = get_user_reminder_offset(user_id)
#            
#            # Get today's classes
#            c.execute("SELECT subject, start_time, location, teacher FROM schedule WHERE user_id = ? AND day = ?", (user_id, current_day))
#            classes = c.fetchall()
#            
#            for subject, start_time, location, teacher in classes:
#                hour, minute = map(int, start_time.split(':'))
#                class_time = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
#                minutes_until = (class_time - now).total_seconds() / 60
#                
#                # Check if class is in reminder window (60-90 minutes)
#                if offset - 15 <= minutes_until <= offset + 15:
#                    key = f"reminder_{user_id}_{current_day}_{start_time}"
#                    c.execute("SELECT sent FROM reminders WHERE key = ?", (key,))
#                    if not c.fetchone():
#                        if minutes_until <= 60:
#                            urgency = "🔴 **Starting SOON!** 🔴" if lang == 'en' else "🔴 **Скоро НАЧНЕТСЯ!** 🔴"
#                        else:
#                            urgency = "⏰ **Reminder** ⏰" if lang == 'en' else "⏰ **Напоминание** ⏰"
#                        
#                        msg = f"{urgency}\n\n📚 **{subject}**\n⏰ {start_time}\n"
#                        if location:
#                            msg += f"📍 {location}\n"
#                        if teacher:
#                            msg += f"👨‍🏫 {teacher}\n"
#                        msg += f"\n🕐 In {int(minutes_until)} minutes, {name}!"
#                        msg += "\n\nGet ready! 📖" if lang == 'en' else "\n\nГотовься! 📖"
#                        
#                        send_message(vk, user_id, msg, get_main_keyboard(lang))
#                        c.execute("INSERT INTO reminders (key, sent) VALUES (?, ?)", (key, 1))
#                        conn.commit()
#                        logging.info(f"Sent reminder to {user_id} for {subject} at {start_time}")
#        
#        # Clean old reminders (older than 1 day)
#        c.execute("DELETE FROM reminders WHERE datetime(timestamp) < datetime('now', '-1 day')")
#        conn.commit()
#        conn.close()
#    except Exception as e:
#        logging.error(f"Reminder error: {e}")
#
## ========== MAIN ==========
#scheduler = BackgroundScheduler()
#
#def main():
#    print("=" * 70)
#    print("🤖 Personal Assistant Bot - Time Management Edition")
#    print("=" * 70)
#    print("✅ Features:")
#    print("   • 📅 Schedule management (today/tomorrow/week)")
#    print("   • ⏰ 60-90 minute class reminders")
#    print("   • 📝 Task management with priorities")
#    print("   • 📊 Study time tracking & statistics")
#    print("   • 📥 ICS calendar import")
#    print("   • 💬 Natural conversation")
#    print("=" * 70)
#    
#    try:
#        vk_session = vk_api.VkApi(token=VK_TOKEN)
#        vk = vk_session.get_api()
#        
#        # Start reminder scheduler (checks every 5 minutes)
#        scheduler.add_job(lambda: check_reminders(vk), 'interval', minutes=5)
#        scheduler.start()
#        
#        print("✅ Bot is running!")
#        print("⏰ Reminder system active (checks every 5 minutes)")
#        print("💬 Listening for messages...\n")
#        
#        longpoll = VkBotLongPoll(vk_session, GROUP_ID)
#        
#        for event in longpoll.listen():
#            if event.type == VkBotEventType.MESSAGE_NEW:
#                try:
#                    msg = event.object.message
#                    user_id = msg["from_id"]
#                    text = msg.get("text", "").strip()
#                    attachments = msg.get("attachments", [])
#                    
#                    # Handle file uploads
#                    ics_files = [att for att in attachments if att["type"] == "doc" and att["doc"]["title"].endswith(".ics")]
#                    if ics_files:
#                        url = ics_files[0]["doc"]["url"]
#                        resp = requests.get(url)
#                        if resp.status_code == 200:
#                            count = import_ics(user_id, url)
#                            lang = detect_language(text)
#                            name = get_user_name(user_id) or "friend"
#                            if count > 0:
#                                send_message(vk, user_id, RESPONSES[lang]['import_success'].format(count=count, name=name), get_main_keyboard(lang))
#                            else:
#                                send_message(vk, user_id, RESPONSES[lang]['import_fail'].format(name=name), get_main_keyboard(lang))
#                        continue
#                    
#                    # Handle button payloads
#                    payload = msg.get("payload")
#                    if payload:
#                        try:
#                            payload = json.loads(payload)
#                            if payload.get("cmd") == "complete":
#                                complete_task(payload["tid"], user_id)
#                                lang = detect_language(text)
#                                name = get_user_name(user_id) or "friend"
#                                send_message(vk, user_id, RESPONSES[lang]['task_done'].format(name=name, task="task", remaining=0), get_main_keyboard(lang))
#                        except:
#                            pass
#                        continue
#                    
#                    # Handle messages
#                    if text:
#                        handle_message(vk, user_id, text, attachments)
#                        
#                except Exception as e:
#                    logging.error(f"Error: {e}")
#                    
#    except KeyboardInterrupt:
#        print("\n🛑 Bot stopped")
#        scheduler.shutdown()
#    except Exception as e:
#        print(f"\n❌ Error: {e}")
#
#if __name__ == "__main__":
#    main()



#import logging
#import sqlite3
#import json
#import requests
#from datetime import datetime, timedelta
#import vk_api
#from vk_api.bot_longpoll import VkBotLongPoll, VkBotEventType
#from vk_api.keyboard import VkKeyboard, VkKeyboardColor
#from vk_api.utils import get_random_id
#from icalendar import Calendar
#from apscheduler.schedulers.background import BackgroundScheduler
#import pytz
#import re
#import random
#
## ========== CONFIGURATION ==========
#VK_TOKEN = "vk1.a.eZvEbyVQo2aLD4K-r_7DxudJLQ4iNke42CLOnxo-ewzkJhDCjgY-FFImW2JeNulCAByv9bzkSuo_VXZFEV1GbMGoTfjD_TlDUV_pfIIfXU2eJvNsYIVFvVRa7OQxAhzGJPle69aDCxH7jYlu-LbbfSLM-9ZVDiOkmo3zSdgiWYegoSqKJqtGAGoyldsJYC79Fc9up1aNsvk3uJ3NZaE6Xg"
#GROUP_ID = 237363984
#TIMEZONE = pytz.timezone("Asia/Novosibirsk")
#
#logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
#
## ========== DATABASE SETUP WITH SCHEMA UPDATE ==========
#def init_db():
#    conn = sqlite3.connect("assistant.db")
#    c = conn.cursor()
#    
#    # Create users table
#    c.execute("""CREATE TABLE IF NOT EXISTS users (
#        vk_id INTEGER PRIMARY KEY,
#        name TEXT DEFAULT '',
#        language TEXT DEFAULT 'en',
#        reminder_offset INTEGER DEFAULT 75
#    )""")
#    
#    # Create schedule table with all needed columns
#    c.execute("""CREATE TABLE IF NOT EXISTS schedule (
#        id INTEGER PRIMARY KEY AUTOINCREMENT,
#        user_id INTEGER,
#        subject TEXT,
#        day INTEGER,
#        start_time TEXT,
#        end_time TEXT,
#        location TEXT,
#        teacher TEXT
#    )""")
#    
#    # Create tasks table
#    c.execute("""CREATE TABLE IF NOT EXISTS tasks (
#        id INTEGER PRIMARY KEY AUTOINCREMENT,
#        user_id INTEGER,
#        task TEXT,
#        due_date TEXT,
#        remind_days INTEGER,
#        priority TEXT DEFAULT 'normal',
#        category TEXT DEFAULT 'general',
#        done INTEGER DEFAULT 0
#    )""")
#    
#    # Create study_sessions table
#    c.execute("""CREATE TABLE IF NOT EXISTS study_sessions (
#        id INTEGER PRIMARY KEY AUTOINCREMENT,
#        user_id INTEGER,
#        subject TEXT,
#        duration INTEGER,
#        date TEXT,
#        notes TEXT DEFAULT ''
#    )""")
#    
#    # Create reminders table
#    c.execute("""CREATE TABLE IF NOT EXISTS reminders (
#        key TEXT PRIMARY KEY,
#        sent INTEGER DEFAULT 1,
#        reminder_time DATETIME DEFAULT CURRENT_TIMESTAMP
#    )""")
#    
#    # Create conversations table
#    c.execute("""CREATE TABLE IF NOT EXISTS conversations (
#        id INTEGER PRIMARY KEY AUTOINCREMENT,
#        user_id INTEGER,
#        message TEXT,
#        response TEXT,
#        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
#    )""")
#    
#    conn.commit()
#    
#    # Check and add missing columns to existing tables
#    try:
#        # Check schedule table columns
#        c.execute("PRAGMA table_info(schedule)")
#        columns = [col[1] for col in c.fetchall()]
#        
#        if 'location' not in columns:
#            c.execute("ALTER TABLE schedule ADD COLUMN location TEXT DEFAULT ''")
#        if 'teacher' not in columns:
#            c.execute("ALTER TABLE schedule ADD COLUMN teacher TEXT DEFAULT ''")
#            
#        # Check reminders table columns
#        c.execute("PRAGMA table_info(reminders)")
#        rem_columns = [col[1] for col in c.fetchall()]
#        
#        if 'reminder_time' not in rem_columns and 'timestamp' in rem_columns:
#            c.execute("ALTER TABLE reminders RENAME COLUMN timestamp TO reminder_time")
#        elif 'reminder_time' not in rem_columns and 'timestamp' not in rem_columns:
#            c.execute("ALTER TABLE reminders ADD COLUMN reminder_time DATETIME DEFAULT CURRENT_TIMESTAMP")
#            
#        # Check conversations table
#        c.execute("PRAGMA table_info(conversations)")
#        conv_columns = [col[1] for col in c.fetchall()]
#        
#        if 'created_at' not in conv_columns and 'timestamp' in conv_columns:
#            c.execute("ALTER TABLE conversations RENAME COLUMN timestamp TO created_at")
#        elif 'created_at' not in conv_columns and 'timestamp' not in conv_columns:
#            c.execute("ALTER TABLE conversations ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP")
#            
#    except Exception as e:
#        logging.warning(f"Schema update warning: {e}")
#    
#    conn.commit()
#    conn.close()
#    logging.info("Database initialized successfully")
#
#init_db()
#
## ========== HELPER FUNCTIONS ==========
#def get_user_name(user_id):
#    conn = sqlite3.connect("assistant.db")
#    c = conn.cursor()
#    c.execute("SELECT name FROM users WHERE vk_id = ?", (user_id,))
#    row = c.fetchone()
#    conn.close()
#    return row[0] if row and row[0] else None
#
#def set_user_name(user_id, name):
#    conn = sqlite3.connect("assistant.db")
#    c = conn.cursor()
#    c.execute("INSERT OR REPLACE INTO users (vk_id, name) VALUES (?, ?)", (user_id, name))
#    conn.commit()
#    conn.close()
#
#def detect_language(text):
#    if not text:
#        return 'en'
#    cyrillic = sum(1 for c in text if '\u0400' <= c <= '\u04FF')
#    if cyrillic > len(text) * 0.1:
#        return 'ru'
#    return 'en'
#
## ========== SCHEDULE FUNCTIONS ==========
#def add_class(user_id, subject, day, start, end, location='', teacher=''):
#    conn = sqlite3.connect("assistant.db")
#    c = conn.cursor()
#    c.execute("""INSERT INTO schedule (user_id, subject, day, start_time, end_time, location, teacher) 
#                 VALUES (?,?,?,?,?,?,?)""",
#              (user_id, subject, day, start, end, location, teacher))
#    conn.commit()
#    conn.close()
#    logging.info(f"Added class: {subject} on day {day} at {start}")
#
#def get_today_classes(user_id):
#    today = datetime.now(TIMEZONE).weekday()
#    conn = sqlite3.connect("assistant.db")
#    c = conn.cursor()
#    c.execute("SELECT subject, start_time, end_time, location, teacher FROM schedule WHERE user_id = ? AND day = ? ORDER BY start_time", 
#              (user_id, today))
#    rows = c.fetchall()
#    conn.close()
#    return rows
#
#def get_tomorrow_classes(user_id):
#    tomorrow = (datetime.now(TIMEZONE).weekday() + 1) % 7
#    conn = sqlite3.connect("assistant.db")
#    c = conn.cursor()
#    c.execute("SELECT subject, start_time, end_time, location, teacher FROM schedule WHERE user_id = ? AND day = ? ORDER BY start_time", 
#              (user_id, tomorrow))
#    rows = c.fetchall()
#    conn.close()
#    return rows
#
#def get_next_class(user_id):
#    now = datetime.now(TIMEZONE)
#    current_day = now.weekday()
#    current_time = now.strftime("%H:%M")
#    
#    conn = sqlite3.connect("assistant.db")
#    c = conn.cursor()
#    c.execute("SELECT subject, day, start_time FROM schedule WHERE user_id = ? ORDER BY day, start_time", (user_id,))
#    classes = c.fetchall()
#    conn.close()
#    
#    for subject, day, start in classes:
#        if day > current_day or (day == current_day and start > current_time):
#            return subject, start
#    if classes:
#        return classes[0][0], classes[0][2]
#    return None, None
#
#def get_class_count(user_id):
#    conn = sqlite3.connect("assistant.db")
#    c = conn.cursor()
#    c.execute("SELECT COUNT(*) FROM schedule WHERE user_id = ?", (user_id,))
#    count = c.fetchone()[0]
#    conn.close()
#    return count
#
#def clear_schedule(user_id):
#    conn = sqlite3.connect("assistant.db")
#    c = conn.cursor()
#    c.execute("DELETE FROM schedule WHERE user_id = ?", (user_id,))
#    conn.commit()
#    conn.close()
#
## ========== TASK FUNCTIONS ==========
#def add_task(user_id, task, due_date, remind_days, priority='normal'):
#    conn = sqlite3.connect("assistant.db")
#    c = conn.cursor()
#    c.execute("INSERT INTO tasks (user_id, task, due_date, remind_days, priority, done) VALUES (?,?,?,?,?,0)",
#              (user_id, task, due_date, remind_days, priority))
#    conn.commit()
#    conn.close()
#
#def get_tasks(user_id):
#    conn = sqlite3.connect("assistant.db")
#    c = conn.cursor()
#    c.execute("SELECT id, task, due_date, remind_days, priority FROM tasks WHERE user_id = ? AND done = 0 ORDER BY due_date", (user_id,))
#    rows = c.fetchall()
#    conn.close()
#    return rows
#
#def complete_task(task_id, user_id):
#    conn = sqlite3.connect("assistant.db")
#    c = conn.cursor()
#    c.execute("UPDATE tasks SET done = 1 WHERE id = ? AND user_id = ?", (task_id, user_id))
#    conn.commit()
#    conn.close()
#
#def get_task_stats(user_id):
#    conn = sqlite3.connect("assistant.db")
#    c = conn.cursor()
#    c.execute("SELECT COUNT(*) FROM tasks WHERE user_id = ? AND done = 0", (user_id,))
#    pending = c.fetchone()[0]
#    c.execute("SELECT COUNT(*) FROM tasks WHERE user_id = ? AND done = 1", (user_id,))
#    completed = c.fetchone()[0]
#    conn.close()
#    return pending, completed
#
## ========== ICS IMPORT ==========
#def import_ics_from_link(user_id, url):
#    """Download and import ICS calendar from a URL"""
#    try:
#        logging.info(f"Importing ICS from URL: {url}")
#        
#        # Download the ICS file
#        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
#        response = requests.get(url, timeout=30, headers=headers)
#        response.raise_for_status()
#        
#        # Parse the ICS content
#        cal = Calendar.from_ical(response.text)
#        count = 0
#        
#        for component in cal.walk():
#            if component.name == "VEVENT":
#                subject = str(component.get('SUMMARY', 'Class'))
#                dtstart = component.get('DTSTART')
#                dtend = component.get('DTEND')
#                
#                if dtstart and dtend:
#                    start = dtstart.dt
#                    end = dtend.dt
#                    
#                    if not isinstance(start, datetime):
#                        start = datetime.combine(start, datetime.min.time())
#                    if not isinstance(end, datetime):
#                        end = datetime.combine(end, datetime.min.time())
#                    
#                    location = str(component.get('LOCATION', ''))
#                    day_of_week = start.weekday()
#                    start_time = start.strftime("%H:%M")
#                    end_time = end.strftime("%H:%M")
#                    
#                    add_class(user_id, subject, day_of_week, start_time, end_time, location, '')
#                    count += 1
#        
#        return count
#    except Exception as e:
#        logging.error(f"ICS import error: {e}")
#        return -1
#
## ========== BOT FUNCTIONS ==========
#def send_message(vk, user_id, text, keyboard=None):
#    try:
#        if not keyboard:
#            keyboard = VkKeyboard().get_empty_keyboard()
#        vk.messages.send(user_id=user_id, message=text, random_id=get_random_id(), keyboard=keyboard)
#    except Exception as e:
#        logging.error(f"Send error: {e}")
#
#def get_main_keyboard(lang='en'):
#    keyboard = VkKeyboard(one_time=False)
#    if lang == 'ru':
#        keyboard.add_button("📅 Что сегодня?", color=VkKeyboardColor.PRIMARY)
#        keyboard.add_button("📅 Что завтра?", color=VkKeyboardColor.PRIMARY)
#        keyboard.add_line()
#        keyboard.add_button("⏰ Что дальше?", color=VkKeyboardColor.SECONDARY)
#        keyboard.add_button("📝 Мои задачи", color=VkKeyboardColor.SECONDARY)
#        keyboard.add_line()
#        keyboard.add_button("📥 Импорт", color=VkKeyboardColor.POSITIVE)
#        keyboard.add_button("❓ Помощь", color=VkKeyboardColor.POSITIVE)
#    else:
#        keyboard.add_button("📅 What's today?", color=VkKeyboardColor.PRIMARY)
#        keyboard.add_button("📅 What's tomorrow?", color=VkKeyboardColor.PRIMARY)
#        keyboard.add_line()
#        keyboard.add_button("⏰ What's next?", color=VkKeyboardColor.SECONDARY)
#        keyboard.add_button("📝 My tasks", color=VkKeyboardColor.SECONDARY)
#        keyboard.add_line()
#        keyboard.add_button("📥 Import", color=VkKeyboardColor.POSITIVE)
#        keyboard.add_button("❓ Help", color=VkKeyboardColor.POSITIVE)
#    return keyboard.get_keyboard()
#
## ========== MESSAGE HANDLER ==========
#def handle_message(vk, user_id, text, attachments):
#    lang = detect_language(text)
#    name = get_user_name(user_id)
#    
#    # First time user
#    if not name and not any(word in text.lower() for word in ['my name is', 'call me', 'меня зовут', 'зовут']):
#        send_message(vk, user_id, "Hey there! 👋 I'm your personal assistant. What's your name?", get_main_keyboard(lang))
#        return
#    
#    # Extract name
#    name_match = re.search(r'(?:my name is|call me|меня зовут|зовут)\s+([A-Za-zА-Яа-я]+)', text, re.IGNORECASE)
#    if name_match and not name:
#        name = name_match.group(1).capitalize()
#        set_user_name(user_id, name)
#        send_message(vk, user_id, f"Nice to meet you, {name}! 👋 I'm here to help with your schedule and tasks!", get_main_keyboard(lang))
#        return
#    
#    # Check for ICS link
#    if '.ics' in text and ('http://' in text or 'https://' in text):
#        url_match = re.search(r'(https?://[^\s]+\.ics)', text)
#        if url_match:
#            send_message(vk, user_id, "⏳ Importing your schedule... Please wait.", get_main_keyboard(lang))
#            count = import_ics_from_link(user_id, url_match.group(1))
#            if count > 0:
#                send_message(vk, user_id, f"🎉 Success! I've imported {count} classes into your schedule, {name}!\n\n✅ I'll remind you before each class.\n📅 Ask 'What's today?' to see your schedule!", get_main_keyboard(lang))
#            else:
#                send_message(vk, user_id, f"❌ Couldn't import from that link, {name}. Make sure it's a valid ICS file.", get_main_keyboard(lang))
#        return
#    
#    # /ics command
#    if text.startswith('/ics'):
#        parts = text.split(maxsplit=1)
#        if len(parts) == 2:
#            ics_url = parts[1].strip()
#            if ics_url.startswith(('http://', 'https://')):
#                send_message(vk, user_id, "⏳ Importing your schedule... Please wait.", get_main_keyboard(lang))
#                count = import_ics_from_link(user_id, ics_url)
#                if count > 0:
#                    send_message(vk, user_id, f"🎉 Success! I've imported {count} classes into your schedule, {name}!", get_main_keyboard(lang))
#                else:
#                    send_message(vk, user_id, f"❌ Couldn't import from that link, {name}. Please check the URL.", get_main_keyboard(lang))
#            else:
#                send_message(vk, user_id, "❌ Please provide a valid HTTP or HTTPS link.", get_main_keyboard(lang))
#        else:
#            send_message(vk, user_id, f"📥 To import your schedule, {name}, send me an ICS link like this: /ics https://example.com/schedule.ics", get_main_keyboard(lang))
#        return
#    
#    # Import instructions
#    if text in ["📥 Import", "📥 Импорт"] or "how to import" in text.lower():
#        msg = f"📥 **How to Import Your Schedule, {name}:**\n\n1️⃣ Send me an ICS link (like from your university portal)\n2️⃣ Use command: /ics [your-link]\n3️⃣ Attach an .ics file\n\nI'll automatically add all your classes and remind you before each one! ⏰"
#        send_message(vk, user_id, msg, get_main_keyboard(lang))
#        return
#    
#    # /task command
#    if text.startswith('/task'):
#        parts = text.split(maxsplit=3)
#        if len(parts) == 4:
#            _, task, due_date, days = parts
#            if days.isdigit():
#                add_task(user_id, task, due_date, int(days))
#                send_message(vk, user_id, f"✅ Got it, {name}! I've added '{task}' to your list. I'll remind you {days} day(s) before.", get_main_keyboard(lang))
#            else:
#                send_message(vk, user_id, "Format: /task 'Task name' 2025-12-20 23:59 7", get_main_keyboard(lang))
#        else:
#            send_message(vk, user_id, "Format: /task 'Task name' YYYY-MM-DD HH:MM days", get_main_keyboard(lang))
#        return
#    
#    text_lower = text.lower()
#    
#    # Today's schedule
#    if any(word in text_lower for word in ['today', 'сегодня', "what's today", 'что сегодня']):
#        classes = get_today_classes(user_id)
#        if classes:
#            days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
#            if lang == 'ru':
#                days = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"]
#            class_list = ""
#            for subj, start, end, loc, teacher in classes:
#                class_list += f"⏰ {start}-{end} • **{subj}**\n"
#                if loc:
#                    class_list += f"   📍 {loc}\n"
#                class_list += "\n"
#            send_message(vk, user_id, f"📅 **Today's Schedule, {name}:**\n\n{class_list}I'll remind you before each class! ⏰", get_main_keyboard(lang))
#        else:
#            send_message(vk, user_id, f"🎉 You have no classes today, {name}! Free day!", get_main_keyboard(lang))
#        return
#    
#    # Tomorrow's schedule
#    if any(word in text_lower for word in ['tomorrow', 'завтра', "what's tomorrow", 'что завтра']):
#        classes = get_tomorrow_classes(user_id)
#        if classes:
#            class_list = ""
#            for subj, start, end, loc, teacher in classes:
#                class_list += f"⏰ {start}-{end} • **{subj}**\n"
#                if loc:
#                    class_list += f"   📍 {loc}\n"
#                class_list += "\n"
#            send_message(vk, user_id, f"📅 **Tomorrow's Schedule, {name}:**\n\n{class_list}", get_main_keyboard(lang))
#        else:
#            send_message(vk, user_id, f"🎉 No classes tomorrow, {name}! Enjoy your day off!", get_main_keyboard(lang))
#        return
#    
#    # Next class
#    if any(word in text_lower for word in ['next', "what's next", 'дальше', 'следующая']):
#        subject, time = get_next_class(user_id)
#        if subject:
#            now = datetime.now(TIMEZONE)
#            hour, minute = map(int, time.split(':'))
#            class_time = now.replace(hour=hour, minute=minute, second=0)
#            minutes = int((class_time - now).total_seconds() / 60)
#            if minutes > 0:
#                send_message(vk, user_id, f"⏰ {name}, your next class is **{subject}** at {time}. That's in about {minutes} minutes!", get_main_keyboard(lang))
#            else:
#                send_message(vk, user_id, f"⏰ {name}, your next class is **{subject}** at {time}. Better get ready! 📚", get_main_keyboard(lang))
#        else:
#            send_message(vk, user_id, f"🎉 You're all done with classes for today, {name}! Time to relax!", get_main_keyboard(lang))
#        return
#    
#    # My tasks
#    if any(word in text_lower for word in ['tasks', 'task', 'deadlines', 'задачи', 'дела']):
#        tasks = get_tasks(user_id)
#        if tasks:
#            task_list = ""
#            for tid, task, due_date, days, priority in tasks:
#                dt = datetime.strptime(due_date, "%Y-%m-%d %H:%M")
#                task_list += f"📌 **{task}**\n   ⏰ {dt.strftime('%d.%m.%Y %H:%M')}\n\n"
#            send_message(vk, user_id, f"📋 **Your Tasks, {name}:**\n\n{task_list}💡 Say 'Done [task]' when you complete something!", get_main_keyboard(lang))
#        else:
#            send_message(vk, user_id, f"✅ Great job, {name}! You have no pending tasks. All caught up! 🎉", get_main_keyboard(lang))
#        return
#    
#    # Complete task
#    done_match = re.search(r'(?:done|finished|complete|готово|сделал|выполнил)\s+(.+?)(?:\.|$)', text, re.IGNORECASE)
#    if done_match:
#        task_name = done_match.group(1).strip()
#        tasks = get_tasks(user_id)
#        for tid, task, due_date, days, priority in tasks:
#            if task_name.lower() in task.lower() or task.lower() in task_name.lower():
#                complete_task(tid, user_id)
#                send_message(vk, user_id, f"🎉 Awesome work, {name}! I've marked '{task}' as complete!", get_main_keyboard(lang))
#                return
#        send_message(vk, user_id, f"Hmm, I couldn't find a task named '{task_name}', {name}. Can you check the name?", get_main_keyboard(lang))
#        return
#    
#    # Help
#    if any(word in text_lower for word in ['help', 'помощь', 'what can you do']):
#        help_text = f"""🤖 **What I Can Do For You, {name}:**
#
#📅 **SCHEDULE**
#• "What's today?" - Today's classes
#• "What's tomorrow?" - Tomorrow's classes
#• "What's next?" - Next class
#• Send ICS link - Import your timetable
#
#📝 **TASKS**
#• "My tasks" - See all tasks
#• /task "Task" 2025-12-20 23:59 7
#• "Done [task]" - Mark complete
#
#📥 **IMPORT SCHEDULE**
#• Just send me an ICS link
#• Use /ics [your-link]
#• Click the 📥 Import button
#
#⏰ **REMINDERS**
#• Automatic 60-90 min before class
#
#What would you like help with? 😊"""
#        send_message(vk, user_id, help_text, get_main_keyboard(lang))
#        return
#    
#    # Thanks
#    if any(word in text_lower for word in ['thanks', 'thank you', 'спасибо']):
#        send_message(vk, user_id, f"You're welcome, {name}! 😊 Anything else I can help with?", get_main_keyboard(lang))
#        return
#    
#    # Time
#    if any(word in text_lower for word in ['time', 'время', 'который час']):
#        now = datetime.now(TIMEZONE)
#        send_message(vk, user_id, f"🕐 It's {now.strftime('%H:%M')}, {name}. What's on your schedule?", get_main_keyboard(lang))
#        return
#    
#    # Joke
#    if any(word in text_lower for word in ['joke', 'шутка']):
#        jokes = [
#            "Why don't scientists trust atoms? They make up everything!",
#            "What do you call a fake noodle? An impasta!",
#            "Why did the scarecrow win an award? He was outstanding in his field!"
#        ]
#        send_message(vk, user_id, f"😂 Here's a joke for you, {name}: {random.choice(jokes)}", get_main_keyboard(lang))
#        return
#    
#    # Greeting
#    if any(word in text_lower for word in ['hello', 'hi', 'hey', 'привет']):
#        send_message(vk, user_id, f"Hey {name}! 👋 Good to see you. How can I help today?", get_main_keyboard(lang))
#        return
#    
#    # Default response
#    responses = [
#        f"That's interesting, {name}! How can I help you with that?",
#        f"I see! Would you like me to check your schedule or add a task?",
#        f"Thanks for sharing, {name}! Is there something specific you'd like help with?"
#    ]
#    send_message(vk, user_id, random.choice(responses), get_main_keyboard(lang))
#
## ========== REMINDER SYSTEM ==========
#def check_reminders(vk):
#    try:
#        conn = sqlite3.connect("assistant.db")
#        c = conn.cursor()
#        now = datetime.now(TIMEZONE)
#        current_day = now.weekday()
#        
#        c.execute("SELECT DISTINCT user_id FROM schedule")
#        users = c.fetchall()
#        
#        for (user_id,) in users:
#            name = get_user_name(user_id) or "friend"
#            lang = detect_language("")
#            
#            c.execute("SELECT subject, start_time FROM schedule WHERE user_id = ? AND day = ?", (user_id, current_day))
#            classes = c.fetchall()
#            
#            for subject, start_time in classes:
#                hour, minute = map(int, start_time.split(':'))
#                class_time = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
#                minutes_until = (class_time - now).total_seconds() / 60
#                
#                if 60 <= minutes_until <= 90:
#                    key = f"reminder_{user_id}_{current_day}_{start_time}"
#                    c.execute("SELECT sent FROM reminders WHERE key = ?", (key,))
#                    if not c.fetchone():
#                        msg = f"⏰ **Reminder, {name}!**\n\n📚 {subject}\n🕐 {start_time}\n\nIn {int(minutes_until)} minutes! Get ready! 📖"
#                        send_message(vk, user_id, msg, get_main_keyboard(lang))
#                        c.execute("INSERT INTO reminders (key, sent) VALUES (?, ?)", (key, 1))
#                        conn.commit()
#        
#        conn.close()
#    except Exception as e:
#        logging.error(f"Reminder error: {e}")
#
## ========== MAIN ==========
#scheduler = BackgroundScheduler()
#
#def main():
#    print("=" * 60)
#    print("🤖 Personal Assistant Bot")
#    print("=" * 60)
#    print("✅ Bot starting...")
#    print("✅ Database schema updated")
#    
#    try:
#        vk_session = vk_api.VkApi(token=VK_TOKEN)
#        vk = vk_session.get_api()
#        
#        scheduler.add_job(lambda: check_reminders(vk), 'interval', minutes=5)
#        scheduler.start()
#        
#        print("✅ Bot is running!")
#        print("💬 Listening for messages...\n")
#        
#        longpoll = VkBotLongPoll(vk_session, GROUP_ID)
#        
#        for event in longpoll.listen():#       
#      
import logging
import sqlite3
import json
import requests
from datetime import datetime, timedelta
import vk_api
from vk_api.bot_longpoll import VkBotLongPoll, VkBotEventType
from vk_api.keyboard import VkKeyboard, VkKeyboardColor
from vk_api.utils import get_random_id
from icalendar import Calendar
from apscheduler.schedulers.background import BackgroundScheduler
import pytz
import re
import random
import uuid

# ========== CONFIGURATION ==========
VK_TOKEN = "vk1.a.eZvEbyVQo2aLD4K-r_7DxudJLQ4iNke42CLOnxo-ewzkJhDCjgY-FFImW2JeNulCAByv9bzkSuo_VXZFEV1GbMGoTfjD_TlDUV_pfIIfXU2eJvNsYIVFvVRa7OQxAhzGJPle69aDCxH7jYlu-LbbfSLM-9ZVDiOkmo3zSdgiWYegoSqKJqtGAGoyldsJYC79Fc9up1aNsvk3uJ3NZaE6Xg"
GROUP_ID = 237363984
TIMEZONE = pytz.timezone("Asia/Novosibirsk")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# ========== DATABASE SETUP ==========
def init_db():
    conn = sqlite3.connect("assistant.db")
    c = conn.cursor()
    
    c.execute("""CREATE TABLE IF NOT EXISTS users (
        vk_id INTEGER PRIMARY KEY,
        name TEXT DEFAULT '',
        language TEXT DEFAULT 'en',
        reminder_offset INTEGER DEFAULT 75,
        join_date DATETIME DEFAULT CURRENT_TIMESTAMP
    )""")
    
    c.execute("""CREATE TABLE IF NOT EXISTS schedule (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        subject TEXT,
        day INTEGER,
        start_time TEXT,
        end_time TEXT,
        location TEXT,
        teacher TEXT
    )""")
    
    c.execute("""CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        task TEXT,
        due_date TEXT,
        remind_days INTEGER,
        priority TEXT DEFAULT 'normal',
        category TEXT DEFAULT 'general',
        done INTEGER DEFAULT 0,
        completed_date DATETIME
    )""")
    
    c.execute("""CREATE TABLE IF NOT EXISTS study_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        subject TEXT,
        duration INTEGER,
        date TEXT,
        notes TEXT DEFAULT ''
    )""")
    
    c.execute("""CREATE TABLE IF NOT EXISTS pomodoro_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        subject TEXT,
        duration INTEGER,
        completed_cycles INTEGER,
        date TEXT
    )""")
    
    c.execute("""CREATE TABLE IF NOT EXISTS goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        goal TEXT,
        target INTEGER,
        current INTEGER DEFAULT 0,
        unit TEXT DEFAULT 'hours',
        deadline TEXT,
        created_date TEXT
    )""")
    
    c.execute("""CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE,
        sent INTEGER DEFAULT 1,
        reminder_time DATETIME DEFAULT CURRENT_TIMESTAMP
    )""")
    
    c.execute("""CREATE TABLE IF NOT EXISTS time_blocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        title TEXT,
        start_time TEXT,
        end_time TEXT,
        date TEXT,
        type TEXT DEFAULT 'study'
    )""")
    
    conn.commit()
    conn.close()
    logging.info("Database initialized with all tables")

init_db()

# ========== LANGUAGE SYSTEM (EN, RU, ZH) ==========
RESPONSES = {
    'en': {
        'ask_name': "👋 Hello! I'm your study assistant bot. What's your name?",
        'got_name': "Nice to meet you, {name}! 🎉\n\nI can help you with:\n📅 Schedule management\n📝 Task tracking\n⏱️ Time management\n📊 Progress statistics\n📥 Calendar import\n\nUse /help to see all commands!",
        'help': """🤖 *BOT COMMANDS*

📅 *SCHEDULE*
• "Today" - Today's classes
• "Tomorrow" - Tomorrow's classes
• /add [subj] [day] [start] [end] - Add class
• /ics [url] - Import calendar

📝 *TASKS*
• "Tasks" - View your tasks
• /task [name] [date] [priority] - Add task
• /done [task] - Complete task
• /deadlines - Upcoming deadlines

⏱️ *TIME MANAGEMENT*
• /focus [subj] [min] - Start focus timer
• /pomodoro [subj] - Start Pomodoro
• /stop - Stop timer
• /timeblock - Schedule time block
• /todayplan - Today's plan
• /weekplan - Weekly plan

📊 *STATS & GOALS*
• /stats - Your statistics
• /goal [text] [target] - Set goal
• /goals - View your goals
• /progress - Goal progress

⚙️ *OTHER*
• /language [en/ru/zh] - Change language
• /time - Current time
• /joke - Random joke""",
        'today': "📅 *Today's Schedule*\n\n{classes}",
        'tomorrow': "📅 *Tomorrow's Schedule*\n\n{classes}",
        'no_classes': "🎉 No classes today! Time to study or relax!",
        'tasks_empty': "✅ No pending tasks! Great job!",
        'tasks_list': "📝 *Your Tasks*\n\n{tasks}",
        'task_added': "✅ Task added: {task}\n📅 Due: {due}\n⚡ Priority: {priority}",
        'task_completed': "🎉 Task '{task}' completed! Keep it up!",
        'focus_start': "⏱️ *Focus Mode ON*\n\n📖 {subject}\n⏰ {duration} min\n\nStay focused! I'll notify you when done.",
        'focus_done': "🎉 *Focus Complete!*\n\n📖 {subject}\n⏰ {duration} min\n\nGreat work! Take a 5-min break.",
        'focus_stop': "⏹️ Focus stopped.\nCompleted {elapsed} min.",
        'pomodoro_start': "🍅 *Pomodoro Started!*\n\n{cycles} cycles (25min work + 5min break)\n\nSubject: {subject}",
        'pomodoro_break': "☕ Break time! 5 minutes.",
        'pomodoro_long_break': "☕ Long break! 15 minutes.",
        'pomodoro_done': "🎉 Pomodoro complete! {cycles} cycles done!",
        'stats': """📊 *YOUR STATISTICS*

📝 Tasks: {completed}/{total} completed ({rate}%)
⏱️ Study time: {study_hours}h {study_min}min
📚 Classes: {class_count}
🎯 Goals: {goals_completed}/{goals_total} achieved

📈 Productivity Score: {productivity}%""",
        'goal_set': "🎯 Goal set: {goal}\nTarget: {target} {unit}",
        'no_goals': "No goals set yet. Use /goal to create one!",
        'import_success': "✅ Imported {count} classes!",
        'import_fail': "❌ Import failed: {error}",
        'time': "🕐 Current time: {time}",
        'language_changed': "✅ Language changed to {language}",
        'weekdays': ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        'error': "❌ Something went wrong. Please try again.",
        'importing': "⏳ Importing calendar...",
        'focus_usage': "Usage: /focus [subject] [minutes]\nExample: /focus Math 30\n\nOr use /pomodoro [subject] for Pomodoro technique (4 cycles of 25min)",
        'delete_usage': "Usage: /delete [class_id]\nFind IDs in schedule",
        'class_deleted': "✅ Class deleted!",
        'follow_help': "Try /help for available commands! 🚀"
    },
    'ru': {
        'ask_name': "👋 Привет! Я твой учебный помощник. Как тебя зовут?",
        'got_name': "Приятно познакомиться, {name}! 🎉\n\nЯ помогу с:\n📅 Расписанием\n📝 Задачами\n⏱️ Управлением временем\n📊 Статистикой\n📥 Импортом календаря\n\nИспользуй /help для команд!",
        'help': """🤖 *КОМАНДЫ БОТА*

📅 *РАСПИСАНИЕ*
• "Сегодня" - Пары сегодня
• "Завтра" - Пары завтра
• /add [предмет] [день] [начало] [конец]
• /ics [ссылка] - Импорт календаря

📝 *ЗАДАЧИ*
• "Задачи" - Список задач
• /task [имя] [дата] [приоритет]
• /done [задача] - Выполнить
• /deadlines - Ближайшие сроки

⏱️ *ТАЙМ-МЕНЕДЖМЕНТ*
• /focus [предмет] [мин] - Фокус
• /pomodoro [предмет] - Помодоро
• /stop - Стоп таймер
• /timeblock - Блок времени
• /todayplan - План на сегодня
• /weekplan - План на неделю

📊 *СТАТИСТИКА*
• /stats - Статистика
• /goal [текст] [цель] - Цель
• /goals - Мои цели
• /progress - Прогресс целей

⚙️ *ПРОЧЕЕ*
• /language [en/ru/zh] - Сменить язык
• /time - Время
• /joke - Шутка""",
        'today': "📅 *Расписание на сегодня*\n\n{classes}",
        'tomorrow': "📅 *Расписание на завтра*\n\n{classes}",
        'no_classes': "🎉 Сегодня нет пар! Время учиться или отдыхать!",
        'tasks_empty': "✅ Нет задач! Отличная работа!",
        'tasks_list': "📝 *Твои задачи*\n\n{tasks}",
        'task_added': "✅ Задача добавлена: {task}\n📅 Срок: {due}\n⚡ Приоритет: {priority}",
        'task_completed': "🎉 Задача '{task}' выполнена! Так держать!",
        'focus_start': "⏱️ *Фокус ВКЛ*\n\n📖 {subject}\n⏰ {duration} мин\n\nСосредоточься! Сообщу когда закончишь.",
        'focus_done': "🎉 *Фокус завершён!*\n\n📖 {subject}\n⏰ {duration} мин\n\nОтлично! Сделай перерыв 5 мин.",
        'focus_stop': "⏹️ Фокус остановлен.\nСделано {elapsed} мин.",
        'pomodoro_start': "🍅 *Помодоро запущен!*\n\n{cycles} циклов (25мин работа + 5мин отдых)\n\nПредмет: {subject}",
        'pomodoro_break': "☕ Перерыв! 5 минут.",
        'pomodoro_long_break': "☕ Длинный перерыв! 15 минут.",
        'pomodoro_done': "🎉 Помодоро завершён! {cycles} циклов сделано!",
        'stats': """📊 *ТВОЯ СТАТИСТИКА*

📝 Задачи: {completed}/{total} выполнено ({rate}%)
⏱️ Учёба: {study_hours}ч {study_min}мин
📚 Пары: {class_count}
🎯 Цели: {goals_completed}/{goals_total} достигнуто

📈 Продуктивность: {productivity}%""",
        'goal_set': "🎯 Цель поставлена: {goal}\nЦель: {target} {unit}",
        'no_goals': "Целей пока нет. Используй /goal чтобы создать!",
        'import_success': "✅ Импортировано {count} пар!",
        'import_fail': "❌ Ошибка импорта: {error}",
        'time': "🕐 Текущее время: {time}",
        'language_changed': "✅ Язык изменён на {language}",
        'weekdays': ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
        'error': "❌ Что-то пошло не так. Попробуй снова.",
        'importing': "⏳ Импортирую календарь...",
        'focus_usage': "Использование: /focus [предмет] [минуты]\nПример: /focus Математика 30\n\nИли /pomodoro [предмет] для техники Помодоро (4 цикла по 25 мин)",
        'delete_usage': "Использование: /delete [id_пары]\nНайди ID в расписании",
        'class_deleted': "✅ Пара удалена!",
        'follow_help': "Попробуй /help для списка команд! 🚀"
    },
    'zh': {
        'ask_name': "👋 你好！我是你的学习助手机器人。你叫什么名字？",
        'got_name': "很高兴认识你, {name}! 🎉\n\n我可以帮助你：\n📅 课程表管理\n📝 任务跟踪\n⏱️ 时间管理\n📊 进度统计\n📥 日历导入\n\n使用 /help 查看所有命令！",
        'help': """🤖 *机器人命令*

📅 *课程表*
• "今天" - 今日课程
• "明天" - 明日课程
• /add [科目] [星期] [开始] [结束] - 添加课程
• /ics [链接] - 导入日历

📝 *任务*
• "任务" - 查看任务
• /task [名称] [日期] [优先级] - 添加任务
• /done [任务] - 完成任务
• /deadlines - 即将截止

⏱️ *时间管理*
• /focus [科目] [分钟] - 开始专注
• /pomodoro [科目] - 番茄工作法
• /stop - 停止计时
• /timeblock - 安排时间块
• /todayplan - 今日计划
• /weekplan - 周计划

📊 *统计与目标*
• /stats - 你的统计
• /goal [文字] [目标] - 设定目标
• /goals - 查看目标
• /progress - 目标进度

⚙️ *其他*
• /language [en/ru/zh] - 切换语言
• /time - 当前时间
• /joke - 随机笑话""",
        'today': "📅 *今日课程*\n\n{classes}",
        'tomorrow': "📅 *明日课程*\n\n{classes}",
        'no_classes': "🎉 今天没课！学习或放松的时间！",
        'tasks_empty': "✅ 没有待办任务！做得好！",
        'tasks_list': "📝 *你的任务*\n\n{tasks}",
        'task_added': "✅ 任务已添加: {task}\n📅 截止: {due}\n⚡ 优先级: {priority}",
        'task_completed': "🎉 任务 '{task}' 已完成！继续加油！",
        'focus_start': "⏱️ *专注模式开启*\n\n📖 {subject}\n⏰ {duration} 分钟\n\n保持专注！完成后我会通知你。",
        'focus_done': "🎉 *专注完成！*\n\n📖 {subject}\n⏰ {duration} 分钟\n\n做得好！休息5分钟。",
        'focus_stop': "⏹️ 专注已停止。\n完成 {elapsed} 分钟。",
        'pomodoro_start': "🍅 *番茄工作法开始！*\n\n{cycles} 个周期 (25分钟工作 + 5分钟休息)\n\n科目: {subject}",
        'pomodoro_break': "☕ 休息时间！5分钟。",
        'pomodoro_long_break': "☕ 长时间休息！15分钟。",
        'pomodoro_done': "🎉 番茄工作法完成！{cycles} 个周期完成！",
        'stats': """📊 *你的统计*

📝 任务: {completed}/{total} 已完成 ({rate}%)
⏱️ 学习时间: {study_hours}小时 {study_min}分钟
📚 课程: {class_count}
🎯 目标: {goals_completed}/{goals_total} 已达成

📈 效率评分: {productivity}%""",
        'goal_set': "🎯 目标已设定: {goal}\n目标: {target} {unit}",
        'no_goals': "还没有设定目标。使用 /goal 创建一个！",
        'import_success': "✅ 已导入 {count} 门课程！",
        'import_fail': "❌ 导入失败: {error}",
        'time': "🕐 当前时间: {time}",
        'language_changed': "✅ 语言已切换到{language}",
        'weekdays': ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
        'error': "❌ 出了点问题。请重试。",
        'importing': "⏳ 正在导入日历...",
        'focus_usage': "用法: /focus [科目] [分钟]\n示例: /focus 数学 30\n\n或使用 /pomodoro [科目] 进行番茄工作法 (4个周期，每个25分钟)",
        'delete_usage': "用法: /delete [课程ID]\n在课程表中查找ID",
        'class_deleted': "✅ 课程已删除！",
        'follow_help': "尝试 /help 查看可用命令！🚀"
    }
}

def get_response(user_id, key, **kwargs):
    lang = get_user_language(user_id)
    responses = RESPONSES.get(lang, RESPONSES['en'])
    template = responses.get(key, RESPONSES['en'].get(key, key))
    try:
        return template.format(**kwargs)
    except:
        return template

# ========== HELPER FUNCTIONS ==========
def detect_language(text):
    if not text:
        return 'en'
    # Check for Cyrillic (Russian)
    cyrillic = sum(1 for c in text if '\u0400' <= c <= '\u04FF')
    if cyrillic > len(text) * 0.1:
        return 'ru'
    # Check for Chinese characters
    chinese = sum(1 for c in text if '\u4e00' <= c <= '\u9fff' or '\u3400' <= c <= '\u4dbf')
    if chinese > len(text) * 0.1:
        return 'zh'
    return 'en'

def get_user_name(user_id):
    conn = sqlite3.connect("assistant.db")
    c = conn.cursor()
    c.execute("SELECT name FROM users WHERE vk_id = ?", (user_id,))
    row = c.fetchone()
    conn.close()
    return row[0] if row and row[0] else None

def set_user_name(user_id, name):
    conn = sqlite3.connect("assistant.db")
    c = conn.cursor()
    c.execute("INSERT OR REPLACE INTO users (vk_id, name) VALUES (?, ?)", (user_id, name))
    conn.commit()
    conn.close()

def get_user_language(user_id):
    conn = sqlite3.connect("assistant.db")
    c = conn.cursor()
    c.execute("SELECT language FROM users WHERE vk_id = ?", (user_id,))
    row = c.fetchone()
    conn.close()
    return row[0] if row else 'en'

def set_user_language(user_id, lang):
    conn = sqlite3.connect("assistant.db")
    c = conn.cursor()
    c.execute("UPDATE users SET language = ? WHERE vk_id = ?", (lang, user_id))
    conn.commit()
    conn.close()

# ========== SCHEDULE FUNCTIONS ==========
def add_class(user_id, subject, day, start, end, location='', teacher=''):
    conn = sqlite3.connect("assistant.db")
    c = conn.cursor()
    c.execute("INSERT INTO schedule (user_id, subject, day, start_time, end_time, location, teacher) VALUES (?,?,?,?,?,?,?)",
              (user_id, subject, day, start, end, location, teacher))
    conn.commit()
    conn.close()

def get_today_classes(user_id):
    today = datetime.now(TIMEZONE).weekday()
    conn = sqlite3.connect("assistant.db")
    c = conn.cursor()
    c.execute("SELECT id, subject, start_time, end_time, location FROM schedule WHERE user_id = ? AND day = ? ORDER BY start_time", (user_id, today))
    rows = c.fetchall()
    conn.close()
    return rows

def get_tomorrow_classes(user_id):
    tomorrow = (datetime.now(TIMEZONE).weekday() + 1) % 7
    conn = sqlite3.connect("assistant.db")
    c = conn.cursor()
    c.execute("SELECT id, subject, start_time, end_time, location FROM schedule WHERE user_id = ? AND day = ? ORDER BY start_time", (user_id, tomorrow))
    rows = c.fetchall()
    conn.close()
    return rows

def get_next_class(user_id):
    now = datetime.now(TIMEZONE)
    current_day = now.weekday()
    current_time = now.strftime("%H:%M")
    
    conn = sqlite3.connect("assistant.db")
    c = conn.cursor()
    c.execute("SELECT subject, day, start_time, id FROM schedule WHERE user_id = ? ORDER BY day, start_time", (user_id,))
    classes = c.fetchall()
    conn.close()
    
    for subject, day, start, cid in classes:
        if day > current_day or (day == current_day and start > current_time):
            return subject, start, day
    if classes:
        return classes[0][0], classes[0][2], classes[0][1]
    return None, None, None

def get_class_count(user_id):
    conn = sqlite3.connect("assistant.db")
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM schedule WHERE user_id = ?", (user_id,))
    count = c.fetchone()[0]
    conn.close()
    return count

def delete_class(user_id, class_id):
    conn = sqlite3.connect("assistant.db")
    c = conn.cursor()
    c.execute("DELETE FROM schedule WHERE id = ? AND user_id = ?", (class_id, user_id))
    conn.commit()
    conn.close()

def get_all_classes(user_id):
    conn = sqlite3.connect("assistant.db")
    c = conn.cursor()
    c.execute("SELECT id, subject, day, start_time, end_time FROM schedule WHERE user_id = ? ORDER BY day, start_time", (user_id,))
    rows = c.fetchall()
    conn.close()
    return rows

# ========== TASK FUNCTIONS ==========
def add_task(user_id, task, due_date, remind_days=1, priority='normal'):
    conn = sqlite3.connect("assistant.db")
    c = conn.cursor()
    c.execute("INSERT INTO tasks (user_id, task, due_date, remind_days, priority, done) VALUES (?,?,?,?,?,0)",
              (user_id, task, due_date, remind_days, priority))
    conn.commit()
    conn.close()

def get_tasks(user_id):
    conn = sqlite3.connect("assistant.db")
    c = conn.cursor()
    c.execute("SELECT id, task, due_date, remind_days, priority FROM tasks WHERE user_id = ? AND done = 0 ORDER BY due_date", (user_id,))
    rows = c.fetchall()
    conn.close()
    return rows

def complete_task(user_id, task_id):
    conn = sqlite3.connect("assistant.db")
    c = conn.cursor()
    completed_date = datetime.now(TIMEZONE).strftime("%Y-%m-%d %H:%M:%S")
    c.execute("UPDATE tasks SET done = 1, completed_date = ? WHERE id = ? AND user_id = ?", (completed_date, task_id, user_id))
    conn.commit()
    conn.close()

def get_task_stats(user_id):
    conn = sqlite3.connect("assistant.db")
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM tasks WHERE user_id = ? AND done = 0", (user_id,))
    pending = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM tasks WHERE user_id = ? AND done = 1", (user_id,))
    completed = c.fetchone()[0]
    conn.close()
    return pending, completed

# ========== STUDY FUNCTIONS ==========
def add_study_session(user_id, subject, duration, notes=''):
    conn = sqlite3.connect("assistant.db")
    c = conn.cursor()
    today = datetime.now(TIMEZONE).strftime("%Y-%m-%d")
    c.execute("INSERT INTO study_sessions (user_id, subject, duration, date, notes) VALUES (?,?,?,?,?)",
              (user_id, subject, duration, today, notes))
    conn.commit()
    conn.close()

def get_study_stats(user_id):
    conn = sqlite3.connect("assistant.db")
    c = conn.cursor()
    c.execute("SELECT COALESCE(SUM(duration), 0) FROM study_sessions WHERE user_id = ?", (user_id,))
    total = c.fetchone()[0]
    c.execute("SELECT COALESCE(SUM(duration), 0) FROM study_sessions WHERE user_id = ? AND date >= date('now', '-7 days')", (user_id,))
    weekly = c.fetchone()[0]
    c.execute("SELECT COALESCE(SUM(duration), 0) FROM study_sessions WHERE user_id = ? AND date = date('now')", (user_id,))
    today = c.fetchone()[0]
    conn.close()
    return total, weekly, today

# ========== GOAL FUNCTIONS ==========
def add_goal(user_id, goal, target, unit='hours', deadline=None):
    conn = sqlite3.connect("assistant.db")
    c = conn.cursor()
    today = datetime.now(TIMEZONE).strftime("%Y-%m-%d")
    c.execute("INSERT INTO goals (user_id, goal, target, unit, deadline, created_date) VALUES (?,?,?,?,?,?)",
              (user_id, goal, target, unit, deadline, today))
    conn.commit()
    conn.close()

def get_goals(user_id):
    conn = sqlite3.connect("assistant.db")
    c = conn.cursor()
    c.execute("SELECT id, goal, target, current, unit FROM goals WHERE user_id = ? ORDER BY created_date DESC", (user_id,))
    rows = c.fetchall()
    conn.close()
    return rows

# ========== ICS IMPORT ==========
def import_ics_from_link(user_id, url):
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, timeout=30, headers=headers)
        response.raise_for_status()
        
        cal = Calendar.from_ical(response.text)
        count = 0
        
        for component in cal.walk():
            if component.name == "VEVENT":
                subject = str(component.get('SUMMARY', 'Class'))
                dtstart = component.get('DTSTART')
                dtend = component.get('DTEND')
                
                if dtstart and dtend:
                    start = dtstart.dt
                    end = dtend.dt
                    
                    if not isinstance(start, datetime):
                        start = datetime.combine(start, datetime.min.time())
                    if not isinstance(end, datetime):
                        end = datetime.combine(end, datetime.min.time())
                    
                    location = str(component.get('LOCATION', ''))
                    day_of_week = start.weekday()
                    start_time = start.strftime("%H:%M")
                    end_time = end.strftime("%H:%M")
                    
                    add_class(user_id, subject, day_of_week, start_time, end_time, location)
                    count += 1
        
        return count, None
    except Exception as e:
        return -1, str(e)

# ========== BOT FUNCTIONS ==========
def send_message(vk, user_id, text, keyboard=None):
    try:
        if not keyboard:
            keyboard = VkKeyboard().get_empty_keyboard()
        vk.messages.send(user_id=user_id, message=text[:4096], random_id=get_random_id(), keyboard=keyboard)
    except Exception as e:
        logging.error(f"Send error: {e}")

def get_keyboard(lang='en'):
    keyboard = VkKeyboard(one_time=False)
    
    labels = {
        'en': {
            'today': "📅 Today", 'tomorrow': "📅 Tomorrow", 'tasks': "📝 Tasks",
            'focus': "⏱️ Focus", 'stats': "📊 Stats", 'import': "📥 Import", 'help': "❓ Help"
        },
        'ru': {
            'today': "📅 Сегодня", 'tomorrow': "📅 Завтра", 'tasks': "📝 Задачи",
            'focus': "⏱️ Фокус", 'stats': "📊 Статистика", 'import': "📥 Импорт", 'help': "❓ Помощь"
        },
        'zh': {
            'today': "📅 今天", 'tomorrow': "📅 明天", 'tasks': "📝 任务",
            'focus': "⏱️ 专注", 'stats': "📊 统计", 'import': "📥 导入", 'help': "❓ 帮助"
        }
    }
    
    l = labels.get(lang, labels['en'])
    
    keyboard.add_button(l['today'], color=VkKeyboardColor.PRIMARY)
    keyboard.add_button(l['tomorrow'], color=VkKeyboardColor.PRIMARY)
    keyboard.add_line()
    keyboard.add_button(l['tasks'], color=VkKeyboardColor.SECONDARY)
    keyboard.add_button(l['focus'], color=VkKeyboardColor.SECONDARY)
    keyboard.add_line()
    keyboard.add_button(l['stats'], color=VkKeyboardColor.POSITIVE)
    keyboard.add_button(l['import'], color=VkKeyboardColor.POSITIVE)
    keyboard.add_line()
    keyboard.add_button(l['help'], color=VkKeyboardColor.PRIMARY)
    
    return keyboard.get_keyboard()

# ========== FOCUS/POMODORO TIMER ==========
active_timers = {}

def start_focus_timer(vk, user_id, subject, duration):
    if user_id in active_timers:
        active_timers[user_id]['cancel'] = True
    
    timer_id = str(uuid.uuid4())[:8]
    active_timers[user_id] = {
        'id': timer_id,
        'subject': subject,
        'duration': duration,
        'start_time': datetime.now(TIMEZONE),
        'cancel': False
    }
    
    lang = get_user_language(user_id)
    
    scheduler.add_job(
        complete_focus,
        'date',
        run_date=datetime.now(TIMEZONE) + timedelta(minutes=duration),
        args=[vk, user_id, timer_id, subject, duration],
        id=timer_id
    )
    
    send_message(vk, user_id, get_response(user_id, 'focus_start', subject=subject, duration=duration), get_keyboard(lang))

def start_pomodoro(vk, user_id, subject, cycles=4):
    if user_id in active_timers:
        active_timers[user_id]['cancel'] = True
    
    timer_id = str(uuid.uuid4())[:8]
    active_timers[user_id] = {
        'id': timer_id,
        'subject': subject,
        'cycles': cycles,
        'current_cycle': 0,
        'cancel': False,
        'type': 'pomodoro'
    }
    
    total_duration = cycles * 30
    lang = get_user_language(user_id)
    
    send_message(vk, user_id, get_response(user_id, 'pomodoro_start', subject=subject, cycles=cycles), get_keyboard(lang))
    
    for i in range(cycles):
        break_time = datetime.now(TIMEZONE) + timedelta(minutes=i * 30 + 25)
        
        scheduler.add_job(
            pomodoro_break_reminder,
            'date',
            run_date=break_time,
            args=[vk, user_id, timer_id, i + 1, cycles],
            id=f"{timer_id}_break_{i}"
        )
    
    scheduler.add_job(
        complete_pomodoro,
        'date',
        run_date=datetime.now(TIMEZONE) + timedelta(minutes=total_duration),
        args=[vk, user_id, timer_id, subject, cycles],
        id=f"{timer_id}_complete"
    )

def pomodoro_break_reminder(vk, user_id, timer_id, cycle, total_cycles):
    if user_id not in active_timers or active_timers[user_id].get('cancel'):
        return
    
    current = active_timers[user_id]
    if current['id'] != timer_id:
        return
    
    current['current_cycle'] = cycle
    lang = get_user_language(user_id)
    
    if cycle % 4 == 0:
        send_message(vk, user_id, get_response(user_id, 'pomodoro_long_break'), get_keyboard(lang))
    else:
        send_message(vk, user_id, get_response(user_id, 'pomodoro_break'), get_keyboard(lang))

def complete_focus(vk, user_id, timer_id, subject, duration):
    if user_id not in active_timers:
        return
    
    current = active_timers[user_id]
    if current.get('cancel') or current['id'] != timer_id:
        return
    
    add_study_session(user_id, subject, duration)
    del active_timers[user_id]
    
    send_message(vk, user_id, get_response(user_id, 'focus_done', subject=subject, duration=duration))

def complete_pomodoro(vk, user_id, timer_id, subject, cycles):
    if user_id not in active_timers:
        return
    
    current = active_timers[user_id]
    if current.get('cancel') or current['id'] != timer_id:
        return
    
    total_duration = cycles * 25
    add_study_session(user_id, subject, total_duration, f"Pomodoro: {cycles} cycles")
    del active_timers[user_id]
    
    send_message(vk, user_id, get_response(user_id, 'pomodoro_done', cycles=cycles))

def stop_timer(vk, user_id):
    if user_id not in active_timers:
        return False
    
    current = active_timers[user_id]
    elapsed = int((datetime.now(TIMEZONE) - current['start_time']).total_seconds() / 60)
    current['cancel'] = True
    del active_timers[user_id]
    
    if elapsed > 0:
        add_study_session(user_id, current.get('subject', 'Study'), elapsed, "Stopped early")
    
    send_message(vk, user_id, get_response(user_id, 'focus_stop', elapsed=elapsed))
    return True

# ========== MAIN MESSAGE HANDLER ==========
def handle_message(vk, user_id, text, attachments=[]):
    if not text:
        return
    
    text = text.strip()
    lang = detect_language(text)
    set_user_language(user_id, lang)
    name = get_user_name(user_id)
    text_lower = text.lower()
    
    # First time user
    if not name and not any(word in text_lower for word in ['my name is', 'call me', 'меня зовут', 'зовут', '我叫', '我的名字是']):
        send_message(vk, user_id, get_response(user_id, 'ask_name'), get_keyboard(lang))
        return
    
    # Extract name (EN, RU, ZH)
    name_match = re.search(r'(?:my name is|call me|меня зовут|зовут|我叫|我的名字是|我是)\s+([A-Za-zА-Яа-я\u4e00-\u9fff]+)', text, re.IGNORECASE)
    if name_match and not name:
        name = name_match.group(1).capitalize()
        set_user_name(user_id, name)
        send_message(vk, user_id, get_response(user_id, 'got_name', name=name), get_keyboard(lang))
        return
    
    # ICS link in text
    if '.ics' in text and ('http://' in text or 'https://' in text):
        url_match = re.search(r'(https?://[^\s]+\.ics)', text)
        if url_match:
            send_message(vk, user_id, get_response(user_id, 'importing'))
            count, error = import_ics_from_link(user_id, url_match.group(1))
            if count > 0:
                send_message(vk, user_id, get_response(user_id, 'import_success', count=count), get_keyboard(lang))
            else:
                send_message(vk, user_id, get_response(user_id, 'import_fail', error=error), get_keyboard(lang))
        return
    
    # File attachments
    ics_files = [att for att in attachments if att.get("type") == "doc" and att["doc"]["title"].endswith(".ics")]
    if ics_files:
        url = ics_files[0]["doc"]["url"]
        send_message(vk, user_id, get_response(user_id, 'importing'))
        count, error = import_ics_from_link(user_id, url)
        if count > 0:
            send_message(vk, user_id, get_response(user_id, 'import_success', count=count), get_keyboard(lang))
        else:
            send_message(vk, user_id, get_response(user_id, 'import_fail', error=error), get_keyboard(lang))
        return
    
    # Help
    help_triggers = {
        'en': ['help', '❓ help'],
        'ru': ['помощь', '❓ помощь'],
        'zh': ['帮助', '❓ 帮助']
    }
    
    if any(text in help_triggers.get(lang, []) or w in text_lower for w in ['help', 'помощь', '帮助']):
        send_message(vk, user_id, get_response(user_id, 'help'), get_keyboard(lang))
        return
    
    # Today button triggers
    today_buttons = {'en': '📅 today', 'ru': '📅 сегодня', 'zh': '📅 今天'}
    tomorrow_buttons = {'en': '📅 tomorrow', 'ru': '📅 завтра', 'zh': '📅 明天'}
    tasks_buttons = {'en': '📝 tasks', 'ru': '📝 задачи', 'zh': '📝 任务'}
    focus_buttons = {'en': '⏱️ focus', 'ru': '⏱️ фокус', 'zh': '⏱️ 专注'}
    stats_buttons = {'en': '📊 stats', 'ru': '📊 статистика', 'zh': '📊 统计'}
    import_buttons = {'en': '📥 import', 'ru': '📥 импорт', 'zh': '📥 导入'}
    
    # Today
    if text == today_buttons.get(lang, '') or any(w in text_lower for w in ['today', 'сегодня', '今天']):
        classes = get_today_classes(user_id)
        if classes:
            weekdays = RESPONSES[lang]['weekdays']
            today_name = weekdays[datetime.now(TIMEZONE).weekday()]
            class_list = "\n".join([f"#{cid} ⏰ {s}-{e} • **{subj}**" + (f" ({loc})" if loc else "") for cid, subj, s, e, loc in classes])
            send_message(vk, user_id, f"📅 *{today_name}*\n\n{class_list}", get_keyboard(lang))
        else:
            send_message(vk, user_id, get_response(user_id, 'no_classes'), get_keyboard(lang))
        return
    
    # Tomorrow
    if text == tomorrow_buttons.get(lang, '') or any(w in text_lower for w in ['tomorrow', 'завтра', '明天']):
        classes = get_tomorrow_classes(user_id)
        if classes:
            weekdays = RESPONSES[lang]['weekdays']
            tomorrow_idx = (datetime.now(TIMEZONE).weekday() + 1) % 7
            tomorrow_name = weekdays[tomorrow_idx]
            class_list = "\n".join([f"#{cid} ⏰ {s}-{e} • **{subj}**" for cid, subj, s, e, loc in classes])
            send_message(vk, user_id, f"📅 *{tomorrow_name}*\n\n{class_list}", get_keyboard(lang))
        else:
            send_message(vk, user_id, get_response(user_id, 'no_classes'), get_keyboard(lang))
        return
    
    # Tasks
    if text == tasks_buttons.get(lang, '') or any(w in text_lower for w in ['tasks', 'задачи', '任务']):
        tasks = get_tasks(user_id)
        if tasks:
            priority_icons = {'high': '🔴', 'medium': '🟡', 'low': '🟢', 'normal': '⚪'}
            task_list = "\n".join([f"{priority_icons.get(p, '⚪')} #{tid} **{task}**\n   📅 {due}" for tid, task, due, r, p in tasks[:10]])
            send_message(vk, user_id, get_response(user_id, 'tasks_list', tasks=task_list), get_keyboard(lang))
        else:
            send_message(vk, user_id, get_response(user_id, 'tasks_empty'), get_keyboard(lang))
        return
    
    # Stats
    if text == stats_buttons.get(lang, '') or 'stats' in text_lower or 'статистика' in text_lower or '统计' in text_lower:
        pending, completed = get_task_stats(user_id)
        total = pending + completed
        rate = round((completed / total * 100)) if total > 0 else 0
        total_study, weekly_study, today_study = get_study_stats(user_id)
        study_hours = total_study // 60
        study_min = total_study % 60
        class_count = get_class_count(user_id)
        goals = get_goals(user_id)
        goals_total = len(goals)
        goals_completed = sum(1 for g in goals if g[3] >= g[2])
        productivity = round((rate * 0.5 + min(total_study / 6000 * 100, 100) * 0.3 + min(class_count / 20 * 100, 100) * 0.2))
        
        send_message(vk, user_id, get_response(user_id, 'stats', 
            completed=completed, total=total, rate=rate,
            study_hours=study_hours, study_min=study_min,
            class_count=class_count,
            goals_completed=goals_completed, goals_total=goals_total,
            productivity=productivity
        ), get_keyboard(lang))
        return
    
    # Focus button
    if text == focus_buttons.get(lang, ''):
        send_message(vk, user_id, get_response(user_id, 'focus_usage'), get_keyboard(lang))
        return
    
    # Import button
    if text == import_buttons.get(lang, ''):
        send_message(vk, user_id, "📥 Send me an .ics file or use /ics [url]", get_keyboard(lang))
        return
    
    # /focus command
    if text_lower.startswith('/focus'):
        parts = text.split()
        if len(parts) >= 3:
            subject = parts[1]
            duration = int(parts[2]) if parts[2].isdigit() else 25
            start_focus_timer(vk, user_id, subject, min(duration, 180))
        elif len(parts) == 2:
            start_focus_timer(vk, user_id, parts[1], 25)
        else:
            send_message(vk, user_id, get_response(user_id, 'focus_usage'), get_keyboard(lang))
        return
    
    # /pomodoro command
    if text_lower.startswith('/pomodoro'):
        parts = text.split()
        subject = parts[1] if len(parts) > 1 else 'Study'
        cycles = int(parts[2]) if len(parts) > 2 and parts[2].isdigit() else 4
        start_pomodoro(vk, user_id, subject, min(cycles, 8))
        return
    
    # /stop command
    if text_lower.startswith('/stop'):
        stop_timer(vk, user_id)
        return
    
    # /task command
    if text_lower.startswith('/task'):
        match = re.match(r'/task\s+"([^"]+)"\s+(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?)(?:\s+(high|medium|low))?', text)
        if match:
            task_name = match.group(1)
            due_date = match.group(2)
            priority = match.group(3) or 'normal'
            add_task(user_id, task_name, due_date, 1, priority)
            send_message(vk, user_id, get_response(user_id, 'task_added', task=task_name, due=due_date, priority=priority), get_keyboard(lang))
        else:
            send_message(vk, user_id, 'Format: /task "Task name" 2026-12-31 [priority]', get_keyboard(lang))
        return
    
    # /done command
    if text_lower.startswith('/done'):
        task_id = int(text.split()[1]) if len(text.split()) > 1 and text.split()[1].isdigit() else None
        if task_id:
            complete_task(user_id, task_id)
            send_message(vk, user_id, get_response(user_id, 'task_completed', task=f"#{task_id}"), get_keyboard(lang))
        else:
            send_message(vk, user_id, "Usage: /done [task_id]\nFind IDs in /tasks", get_keyboard(lang))
        return
    
    # /add command
    if text_lower.startswith('/add'):
        parts = text.split()
        if len(parts) >= 5:
            subject = parts[1]
            day = int(parts[2]) if parts[2].isdigit() and 0 <= int(parts[2]) <= 6 else None
            start = parts[3]
            end = parts[4]
            location = ' '.join(parts[5:]) if len(parts) > 5 else ''
            if day is not None:
                add_class(user_id, subject, day, start, end, location)
                send_message(vk, user_id, f"✅ Added: {subject} on day {day} at {start}-{end}", get_keyboard(lang))
            else:
                send_message(vk, user_id, "Day must be 0-6 (0=Mon)", get_keyboard(lang))
        else:
            send_message(vk, user_id, "Format: /add Subject Day StartTime EndTime\nExample: /add Math 0 09:00 10:30", get_keyboard(lang))
        return
    
    # /delete command
    if text_lower.startswith('/delete'):
        parts = text.split()
        if len(parts) > 1 and parts[1].isdigit():
            delete_class(user_id, int(parts[1]))
            send_message(vk, user_id, get_response(user_id, 'class_deleted'), get_keyboard(lang))
        else:
            send_message(vk, user_id, get_response(user_id, 'delete_usage'), get_keyboard(lang))
        return
    
    # /ics command
    if text_lower.startswith('/ics'):
        parts = text.split(maxsplit=1)
        if len(parts) == 2:
            send_message(vk, user_id, get_response(user_id, 'importing'))
            count, error = import_ics_from_link(user_id, parts[1].strip())
            if count > 0:
                send_message(vk, user_id, get_response(user_id, 'import_success', count=count), get_keyboard(lang))
            else:
                send_message(vk, user_id, get_response(user_id, 'import_fail', error=error), get_keyboard(lang))
        else:
            send_message(vk, user_id, "Usage: /ics [url]", get_keyboard(lang))
        return
    
    # /goal command
    if text_lower.startswith('/goal'):
        parts = text.split(maxsplit=2)
        if len(parts) >= 3:
            goal = parts[1]
            target = int(parts[2]) if parts[2].isdigit() else 10
            add_goal(user_id, goal, target)
            send_message(vk, user_id, get_response(user_id, 'goal_set', goal=goal, target=target, unit='hours'), get_keyboard(lang))
        else:
            send_message(vk, user_id, "Usage: /goal [description] [target_hours]", get_keyboard(lang))
        return
    
    # /goals command
    if text_lower == '/goals':
        goals = get_goals(user_id)
        if goals:
            msg = "🎯 *Goals*\n\n"
            for gid, goal, target, current, unit in goals:
                pct = round(current / target * 100) if target > 0 else 0
                bar = "█" * (pct // 10) + "░" * (10 - pct // 10)
                msg += f"*{goal}*\n  {current}/{target} {unit} | {pct}%\n  [{bar}]\n\n"
            send_message(vk, user_id, msg, get_keyboard(lang))
        else:
            send_message(vk, user_id, get_response(user_id, 'no_goals'), get_keyboard(lang))
        return
    
    # /language command
    if text_lower.startswith('/language'):
        parts = text.split()
        if len(parts) > 1 and parts[1].lower() in ['en', 'ru', 'zh']:
            set_user_language(user_id, parts[1].lower())
            lang_names = {'en': 'English', 'ru': 'Русский', 'zh': '中文'}
            send_message(vk, user_id, get_response(user_id, 'language_changed', language=lang_names[parts[1].lower()]), get_keyboard(parts[1].lower()))
        return
    
    # /time command
    if text_lower == '/time':
        now = datetime.now(TIMEZONE)
        send_message(vk, user_id, get_response(user_id, 'time', time=now.strftime("%H:%M")), get_keyboard(lang))
        return
    
    # /joke command
    if text_lower == '/joke':
        jokes = {
            'en': ["Why don't scientists trust atoms? They make up everything!", "Parallel lines have so much in common. It's a shame they'll never meet."],
            'ru': ["Почему программисты путают Хэллоуин с Рождеством? 31 Oct = 25 Dec!", "Колобок повесился."],
            'zh': ["为什么科学家不相信原子？因为它们构成一切！", "平行线有那么多共同点。可惜它们永远不会相遇。"]
        }
        send_message(vk, user_id, f"😂 {random.choice(jokes.get(lang, jokes['en']))}", get_keyboard(lang))
        return
    
    # Greeting
    greetings = {'en': ['hello', 'hi', 'hey'], 'ru': ['привет', 'здравствуй'], 'zh': ['你好', '嗨', '嘿']}
    if any(w in text_lower for w in greetings.get(lang, [])):
        msg = {
            'en': f"👋 Hey {name}! How can I help you today?" if name else "👋 Hello! What's your name?",
            'ru': f"👋 Привет {name}! Чем могу помочь?" if name else "👋 Привет! Как тебя зовут?",
            'zh': f"👋 你好 {name}！今天我能帮你什么？" if name else "👋 你好！你叫什么名字？"
        }
        send_message(vk, user_id, msg.get(lang, msg['en']), get_keyboard(lang))
        return
    
    # Default
    if name:
        responses_list = {
            'en': [f"How can I help, {name}?", f"Hey {name}! Check /stats!", f"What would you like to do?"],
            'ru': [f"Чем помочь, {name}?", f"Привет {name}! Проверь /stats!", f"Что хочешь сделать?"],
            'zh': [f"需要帮助吗, {name}？", f"嘿 {name}！查看 /stats！", f"你想做什么？"]
        }
        send_message(vk, user_id, random.choice(responses_list.get(lang, responses_list['en'])), get_keyboard(lang))
    else:
        send_message(vk, user_id, get_response(user_id, 'ask_name'), get_keyboard(lang))

# ========== REMINDER SYSTEM ==========
def check_reminders(vk):
    try:
        conn = sqlite3.connect("assistant.db")
        c = conn.cursor()
        now = datetime.now(TIMEZONE)
        current_day = now.weekday()
        
        c.execute("SELECT DISTINCT user_id FROM schedule")
        users = c.fetchall()
        
        for (user_id,) in users:
            name = get_user_name(user_id) or "student"
            lang = get_user_language(user_id)
            
            c.execute("SELECT subject, start_time FROM schedule WHERE user_id = ? AND day = ?", (user_id, current_day))
            classes = c.fetchall()
            
            for subject, start_time in classes:
                hour, minute = map(int, start_time.split(':'))
                class_time = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
                minutes_until = (class_time - now).total_seconds() / 60
                
                if 60 <= minutes_until <= 90:
                    key = f"reminder_{user_id}_{current_day}_{start_time}"
                    c.execute("SELECT sent FROM reminders WHERE key = ?", (key,))
                    if not c.fetchone():
                        msgs = {
                            'en': f"⏰ {name}, reminder! {subject} in {int(minutes_until)} min at {start_time}!",
                            'ru': f"⏰ {name}, напоминание! {subject} через {int(minutes_until)} мин в {start_time}!",
                            'zh': f"⏰ {name}，提醒！{subject} 在 {int(minutes_until)} 分钟后 ({start_time})！"
                        }
                        send_message(vk, user_id, msgs.get(lang, msgs['en']))
                        c.execute("INSERT OR IGNORE INTO reminders (key, sent) VALUES (?, 1)", (key,))
                        conn.commit()
        
        conn.close()
    except Exception as e:
        logging.error(f"Reminder error: {e}")

# ========== MAIN ==========
scheduler = BackgroundScheduler()

def main():
    print("=" * 60)
    print("🤖 VITA BOT - Multilingual Study Assistant")
    print("=" * 60)
    print("✅ Features:")
    print("   • Schedule management with reminders")
    print("   • Task tracking with priorities")
    print("   • Focus/Pomodoro timers")
    print("   • Goal setting & tracking")
    print("   • ICS calendar import")
    print("   • Languages: English, Русский, 中文")
    print("=" * 60)
    
    try:
        vk_session = vk_api.VkApi(token=VK_TOKEN)
        vk = vk_session.get_api()
        
        scheduler.add_job(lambda: check_reminders(vk), 'interval', minutes=5)
        scheduler.start()
        
        print("✅ Bot is running!")
        print("💬 Listening for messages...\n")
        
        longpoll = VkBotLongPoll(vk_session, GROUP_ID)
        
        for event in longpoll.listen():
            if event.type == VkBotEventType.MESSAGE_NEW:
                try:
                    msg = event.object.message
                    user_id = msg["from_id"]
                    text = msg.get("text", "").strip()
                    attachments = msg.get("attachments", [])
                    
                    if text or attachments:
                        handle_message(vk, user_id, text, attachments)
                        
                except Exception as e:
                    logging.error(f"Error processing message: {e}")
                    
    except KeyboardInterrupt:
        print("\n🛑 Bot stopped")
        scheduler.shutdown()
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        scheduler.shutdown()

if __name__ == "__main__":
    main()