




import { createClient } from "@supabase/supabase-js";

// ==================== CONFIGURATION ====================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const VK_TOKEN = process.env.VK_TOKEN;
const VK_API_VERSION = "5.199";

// Optimized cache with TTL
const cache = new Map();
const CACHE_TTL = 300000; // 5 minutes

function getCached(key) {
  const item = cache.get(key);
  if (item && Date.now() - item.time < CACHE_TTL) return item.data;
  cache.delete(key);
  return null;
}

function setCached(key, data) {
  cache.set(key, { data, time: Date.now() });
}

function clearCache(userId) {
  for (const key of cache.keys()) {
    if (key.includes(String(userId))) cache.delete(key);
  }
}

// Active timers
const activeTimers = new Map();

// ==================== MULTILINGUAL SUPPORT ====================
const TRANSLATIONS = {
  en: {
    ask_name: "👋 Hello! I'm your time management assistant. What's your name?",
    got_name: "🎉 Nice to meet you, {name}! I'll help you manage your time, schedule, and tasks!",
    greeting: "👋 Hey {name}! Ready to make the most of your time today?",
    help_text: `🤖 **Time Management Assistant - Help**

📅 **SCHEDULE MANAGEMENT**
• "Schedule" - View all classes
• "Today" - Today's classes
• "Tomorrow" - Tomorrow's classes
• /add <subject> <day> <start> <end> [location]
• /delete <id> - Delete class

📝 **TASKS**
• "Tasks" - View pending tasks
• /task "Title" YYYY-MM-DD [priority]
• /complete <id> - Complete task
• /delete_task <id> - Delete task

⏱️ **STUDY TIMER**
• /study <subject> <minutes>
• /stop - Stop timer

⚙️ **SETTINGS**
• /lang en/ru/zh - Change language
• /remind <minutes> - Set reminder

Days: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun`,
    lang_changed: "🌐 Language changed to English!",
    schedule_empty: "📭 Your schedule is empty.",
    tasks_empty: "✅ No pending tasks!",
    class_added: "✅ Class added: {subject} on {day} at {start}-{end}",
    class_deleted: "✅ Class {id} deleted!",
    class_not_found: "❌ Class not found.",
    task_added: "✅ Task added: {title}, due {due_date}",
    task_completed: "✅ Task {id} completed!",
    task_deleted: "🗑️ Task {id} deleted!",
    task_not_found: "❌ Task not found.",
    study_timer_start: "⏱️ Studying {subject} for {duration} minutes!",
    study_timer_end: "⏰ Time's up! Studied {subject} for {duration} minutes!",
    study_timer_cancel: "❌ Timer cancelled.",
    reminder_set: "⏰ Reminder set for {minutes} minutes before class.",
    import_start: "⏳ Importing calendar...",
    import_success: "✅ Imported {count} classes!",
    import_fail: "❌ Import failed: {error}",
    stats_header: "📊 **Your Stats**\n\n",
    unknown: "🤔 Use 'Help' to see commands.",
    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  },
  ru: {
    ask_name: "👋 Привет! Я твой помощник по тайм-менеджменту. Как тебя зовут?",
    got_name: "🎉 Приятно познакомиться, {name}! Я помогу управлять твоим временем!",
    greeting: "👋 Привет {name}! Готов эффективно использовать своё время?",
    help_text: `🤖 **Помощник - Помощь**

📅 **РАСПИСАНИЕ**
• "Schedule" - Все пары
• "Today" - Сегодня
• "Tomorrow" - Завтра
• /add <предмет> <день> <начало> <конец>
• /delete <id> - Удалить

📝 **ЗАДАЧИ**
• "Tasks" - Список задач
• /task "Название" ГГГГ-ММ-ДД
• /complete <id> - Выполнить
• /delete_task <id> - Удалить

⏱️ **ТАЙМЕР**
• /study <предмет> <минуты>
• /stop - Остановить

⚙️ **НАСТРОЙКИ**
• /lang en/ru/zh - Сменить язык
• /remind <минуты> - Напоминания`,
    lang_changed: "🌐 Язык изменён на Русский!",
    schedule_empty: "📭 Расписание пусто.",
    tasks_empty: "✅ Нет активных задач!",
    class_added: "✅ Пара добавлена: {subject} в {day} {start}-{end}",
    class_deleted: "✅ Пара {id} удалена!",
    class_not_found: "❌ Пара не найдена.",
    task_added: "✅ Задача добавлена: {title}, срок {due_date}",
    task_completed: "✅ Задача {id} выполнена!",
    task_deleted: "🗑️ Задача {id} удалена!",
    task_not_found: "❌ Задача не найдена.",
    study_timer_start: "⏱️ Учёба {subject} {duration} минут!",
    study_timer_end: "⏰ Время вышло! {subject} {duration} минут!",
    study_timer_cancel: "❌ Таймер отменён.",
    reminder_set: "⏰ Напоминание за {minutes} минут до пары.",
    import_start: "⏳ Импортирую...",
    import_success: "✅ Импортировано {count} пар!",
    import_fail: "❌ Ошибка: {error}",
    stats_header: "📊 **Статистика**\n\n",
    unknown: "🤔 Напиши 'Help' для команд.",
    days: ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"],
  },
  zh: {
    ask_name: "👋 你好！我是你的时间管理助手。你叫什么名字？",
    got_name: "🎉 很高兴认识你，{name}！我会帮你管理时间和任务！",
    greeting: "👋 你好 {name}！准备好高效利用时间了吗？",
    help_text: `🤖 **时间管理助手 - 帮助**

📅 **课程管理**
• "Schedule" - 所有课程
• "Today" - 今日课程
• "Tomorrow" - 明日课程
• /add <课程> <星期> <开始> <结束>
• /delete <id> - 删除课程

📝 **任务**
• "Tasks" - 查看任务
• /task "任务名" 年-月-日
• /complete <id> - 完成任务
• /delete_task <id> - 删除任务

⏱️ **学习计时器**
• /study <科目> <分钟>
• /stop - 停止计时器

⚙️ **设置**
• /lang en/ru/zh - 切换语言
• /remind <分钟> - 设置提醒`,
    lang_changed: "🌐 语言已切换为中文！",
    schedule_empty: "📭 课程表为空。",
    tasks_empty: "✅ 没有待办任务！",
    class_added: "✅ 课程已添加：{subject} {day} {start}-{end}",
    class_deleted: "✅ 课程 {id} 已删除！",
    class_not_found: "❌ 课程未找到。",
    task_added: "✅ 任务已添加：{title}，截止 {due_date}",
    task_completed: "✅ 任务 {id} 已完成！",
    task_deleted: "🗑️ 任务 {id} 已删除！",
    task_not_found: "❌ 任务未找到。",
    study_timer_start: "⏱️ 学习 {subject} {duration} 分钟！",
    study_timer_end: "⏰ 时间到！学习了 {subject} {duration} 分钟！",
    study_timer_cancel: "❌ 计时器已取消。",
    reminder_set: "⏰ 提醒已设置：课前 {minutes} 分钟提醒。",
    import_start: "⏳ 正在导入...",
    import_success: "✅ 已导入 {count} 节课！",
    import_fail: "❌ 导入失败：{error}",
    stats_header: "📊 **你的统计**\n\n",
    unknown: "🤔 输入'Help'查看命令。",
    days: ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"],
  }
};

// ==================== LANGUAGE DETECTION ====================
function detectLanguage(text) {
  if (!text) return "en";
  
  // Check for Cyrillic characters (Russian)
  if (/[а-яА-ЯёЁ]/.test(text)) return "ru";
  
  // Check for Chinese characters
  if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(text)) return "zh";
  
  // Default to English
  return "en";
}

function getTranslation(lang, key, params = {}) {
  // Ensure lang is valid
  if (!TRANSLATIONS[lang]) lang = "en";
  
  let text = TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key] || key;
  
  // Replace parameters
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(new RegExp(`{${k}}`, "g"), v !== undefined ? v : "");
  }
  
  return text;
}

// ==================== DATABASE FUNCTIONS (Parallelized) ====================
async function getOrCreateUser(userId, detectedLang = "en") {
  const cached = getCached(`user_${userId}`);
  if (cached) return cached;
  
  const { data: existing } = await supabase
    .from("users")
    .select("*")
    .eq("vk_id", userId)
    .single();
  
  if (existing) {
    setCached(`user_${userId}`, existing);
    return existing;
  }
  
  const { data: newUser, error } = await supabase
    .from("users")
    .insert({ 
      vk_id: userId, 
      name: "Student", 
      language: detectedLang, 
      reminder_offset: 30 
    })
    .select()
    .single();
  
  if (error) console.error("Create user error:", error);
  
  setCached(`user_${userId}`, newUser);
  return newUser;
}

async function getUserLanguage(userId) {
  const cached = getCached(`lang_${userId}`);
  if (cached) return cached;
  
  const user = await getOrCreateUser(userId, "en");
  const lang = user?.language || "en";
  setCached(`lang_${userId}`, lang);
  return lang;
}

async function setUserLanguage(userId, language) {
  // Validate language
  if (!["en", "ru", "zh"].includes(language)) return false;
  
  const { error } = await supabase
    .from("users")
    .update({ language })
    .eq("vk_id", userId);
  
  if (!error) {
    clearCache(userId);
    setCached(`lang_${userId}`, language);
  }
  return !error;
}

async function getUserName(userId) {
  const user = await getOrCreateUser(userId, "en");
  return user?.name || "Student";
}

async function setUserName(userId, name) {
  const { error } = await supabase
    .from("users")
    .update({ name })
    .eq("vk_id", userId);
  
  if (!error) clearCache(userId);
  return !error;
}

async function getUserReminderOffset(userId) {
  const user = await getOrCreateUser(userId, "en");
  return user?.reminder_offset || 30;
}

async function setUserReminderOffset(userId, minutes) {
  if (minutes < 5 || minutes > 120) return false;
  
  const { error } = await supabase
    .from("users")
    .update({ reminder_offset: minutes })
    .eq("vk_id", userId);
  
  if (!error) clearCache(userId);
  return !error;
}

// Schedule functions
async function getClasses(userId) {
  const cached = getCached(`schedule_${userId}`);
  if (cached) return cached;
  
  const { data, error } = await supabase
    .from("schedule")
    .select("*")
    .eq("user_id", userId)
    .order("day", { ascending: true })
    .order("start_time", { ascending: true });
  
  const result = error ? [] : (data || []);
  setCached(`schedule_${userId}`, result);
  return result;
}

async function addClass(userId, subject, day, startTime, endTime, location = "") {
  const { error } = await supabase.from("schedule").insert({
    user_id: userId,
    subject,
    day: parseInt(day),
    start_time: startTime,
    end_time: endTime,
    location
  });
  
  if (!error) clearCache(userId);
  return !error;
}

async function deleteClass(classId, userId) {
  const { error } = await supabase
    .from("schedule")
    .delete()
    .eq("id", classId)
    .eq("user_id", userId);
  
  if (!error) clearCache(userId);
  return !error;
}

// Task functions
async function getTasks(userId, onlyPending = true) {
  const cached = getCached(`tasks_${userId}_${onlyPending}`);
  if (cached) return cached;
  
  let query = supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId);
  
  if (onlyPending) query = query.eq("completed", false);
  
  const { data, error } = await query.order("due_date", { ascending: true });
  
  const result = error ? [] : (data || []);
  setCached(`tasks_${userId}_${onlyPending}`, result);
  return result;
}

async function addTask(userId, title, dueDate, priority = "normal") {
  const { error } = await supabase.from("tasks").insert({
    user_id: userId,
    title,
    due_date: dueDate,
    priority,
    completed: false,
    remind_days: 2
  });
  
  if (!error) clearCache(userId);
  return !error;
}

async function completeTask(taskId, userId) {
  const { error } = await supabase
    .from("tasks")
    .update({ completed: true, completed_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("user_id", userId);
  
  if (!error) clearCache(userId);
  return !error;
}

async function deleteTask(taskId, userId) {
  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("user_id", userId);
  
  if (!error) clearCache(userId);
  return !error;
}

// Study sessions
async function addStudySession(userId, subject, duration) {
  const { error } = await supabase.from("study_sessions").insert({
    user_id: userId,
    subject,
    duration,
    date: new Date().toISOString().split("T")[0]
  });
  
  if (!error) clearCache(userId);
  return !error;
}

async function getStudyStats(userId) {
  const { data } = await supabase
    .from("study_sessions")
    .select("duration, date")
    .eq("user_id", userId);
  
  if (!data || data.length === 0) {
    return { total: 0, weekly: 0, today: 0, avg: 0 };
  }
  
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const total = data.reduce((sum, s) => sum + s.duration, 0);
  const weekly = data.filter(s => new Date(s.date) >= weekAgo).reduce((sum, s) => sum + s.duration, 0);
  const todayTotal = data.filter(s => s.date === today).reduce((sum, s) => sum + s.duration, 0);
  const avg = Math.round(weekly / 7);
  
  return { total, weekly, today: todayTotal, avg };
}

// Helper functions
function getTodayIndex() {
  const now = new Date();
  let day = now.getDay();
  // Convert: 0=Sunday -> 6, 1=Monday -> 0, etc.
  return day === 0 ? 6 : day - 1;
}

async function getTodayClasses(userId) {
  const today = getTodayIndex();
  const classes = await getClasses(userId);
  return classes.filter(c => c.day === today);
}

async function getNextClass(userId) {
  const now = new Date();
  const today = getTodayIndex();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  const classes = await getClasses(userId);
  
  // Find next class today
  for (const cls of classes) {
    if (cls.day === today && cls.start_time > currentTime) return cls;
  }
  
  // Find first class next day
  const tomorrow = today === 6 ? 0 : today + 1;
  for (const cls of classes) {
    if (cls.day === tomorrow) return cls;
  }
  
  return null;
}

// ==================== STUDY TIMER ====================
async function startStudyTimer(userId, subject, duration, sendMessageFn) {
  // Clear existing timer
  if (activeTimers.has(userId)) {
    clearTimeout(activeTimers.get(userId).timeout);
    activeTimers.delete(userId);
  }
  
  const timeout = setTimeout(async () => {
    try {
      const lang = await getUserLanguage(userId);
      const msg = getTranslation(lang, "study_timer_end", { subject, duration });
      await sendMessageFn(userId, msg);
      await addStudySession(userId, subject, duration);
      activeTimers.delete(userId);
    } catch (err) {
      console.error("Timer callback error:", err);
    }
  }, duration * 60 * 1000);
  
  activeTimers.set(userId, { timeout, subject, duration });
  return true;
}

// ==================== VK MESSAGING ====================
async function sendMessage(userId, text, keyboard = null) {
  try {
    const params = new URLSearchParams({
      access_token: VK_TOKEN,
      v: VK_API_VERSION,
      user_id: userId,
      message: text.slice(0, 4096),
      random_id: Math.floor(Math.random() * 1000000)
    });
    
    if (keyboard) params.append("keyboard", keyboard);
    
    const response = await fetch("https://api.vk.com/method/messages.send", {
      method: "POST",
      body: params
    });
    
    const data = await response.json();
    if (data.error) console.error("VK API Error:", data.error);
    return data;
  } catch (error) {
    console.error("Send message error:", error);
    return null;
  }
}

function getMainKeyboard(lang) {
  const labels = {
    schedule: lang === 'ru' ? "📅 Расписание" : lang === 'zh' ? "📅 课程表" : "📅 Schedule",
    tasks: lang === 'ru' ? "📝 Задачи" : lang === 'zh' ? "📝 任务" : "📝 Tasks",
    stats: lang === 'ru' ? "📊 Статистика" : lang === 'zh' ? "📊 统计" : "📊 Stats",
    timer: lang === 'ru' ? "⏱️ Таймер" : lang === 'zh' ? "⏱️ 计时器" : "⏱️ Timer",
    help: lang === 'ru' ? "❓ Помощь" : lang === 'zh' ? "❓ 帮助" : "❓ Help"
  };
  
  return JSON.stringify({
    one_time: false,
    buttons: [
      [{ action: { type: "text", label: labels.schedule }, color: "primary" }],
      [{ action: { type: "text", label: labels.tasks }, color: "positive" }],
      [{ action: { type: "text", label: labels.stats }, color: "secondary" }],
      [{ action: { type: "text", label: labels.timer }, color: "secondary" }],
      [{ action: { type: "text", label: labels.help }, color: "secondary" }]
    ]
  });
}

// ==================== ICS IMPORT ====================
async function importICS(userId, urlOrContent, lang) {
  try {
    let content;
    
    if (urlOrContent.startsWith('data:')) {
      // Direct content
      const base64Match = urlOrContent.match(/data:text\/calendar(?:;base64)?,(.+)/);
      if (base64Match) {
        content = decodeURIComponent(base64Match[1]);
      }
    } else if (urlOrContent.startsWith('http')) {
      const response = await fetch(urlOrContent, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (!response.ok) return { success: false, error: `HTTP ${response.status}` };
      content = await response.text();
    } else {
      content = urlOrContent;
    }
    
    if (!content || !content.includes('BEGIN:VCALENDAR')) {
      return { success: false, error: "Invalid ICS format" };
    }
    
    // Parse events
    const events = [];
    const lines = content.split(/\r?\n/);
    let currentEvent = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === 'BEGIN:VEVENT') {
        currentEvent = {};
      } else if (trimmed === 'END:VEVENT' && currentEvent) {
        if (currentEvent.SUMMARY && currentEvent.DTSTART) events.push(currentEvent);
        currentEvent = null;
      } else if (currentEvent) {
        const colonIdx = trimmed.indexOf(':');
        if (colonIdx > 0) {
          let key = trimmed.substring(0, colonIdx).split(';')[0];
          let value = trimmed.substring(colonIdx + 1);
          currentEvent[key] = value;
        }
      }
    }
    
    let imported = 0;
    let duplicates = 0;
    const existingClasses = await getClasses(userId);
    
    for (const event of events) {
      let match = event.DTSTART.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
      if (!match) match = event.DTSTART.match(/(\d{4})(\d{2})(\d{2})/);
      if (!match) continue;
      
      const startDate = new Date(
        parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]),
        match[4] ? parseInt(match[4]) : 9, match[5] ? parseInt(match[5]) : 0
      );
      
      let dayOfWeek = startDate.getDay();
      dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      
      const startTime = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
      
      // End time
      let endHour = startDate.getHours() + 1;
      let endMinute = startDate.getMinutes();
      if (event.DTEND) {
        const endMatch = event.DTEND.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
        if (endMatch) {
          endHour = parseInt(endMatch[4]);
          endMinute = parseInt(endMatch[5]);
        }
      }
      const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
      
      const subject = (event.SUMMARY || 'Class').replace(/\\,/g, ',').trim();
      const location = (event.LOCATION || '').replace(/\\,/g, ',').trim();
      
      const isDuplicate = existingClasses.some(c => 
        c.subject === subject && c.day === dayOfWeek && c.start_time === startTime
      );
      
      if (!isDuplicate) {
        await addClass(userId, subject, dayOfWeek, startTime, endTime, location);
        imported++;
      } else {
        duplicates++;
      }
    }
    
    return { success: true, count: imported, total: events.length, new: imported, duplicates };
  } catch (error) {
    console.error("ICS import error:", error);
    return { success: false, error: error.message };
  }
}

// ==================== MESSAGE PROCESSOR ====================
async function processMessage(userId, text, userLang, userName) {
  const lowerText = text.toLowerCase().trim();
  const t = (key, params = {}) => getTranslation(userLang, key, params);
  
  // ===== LANGUAGE COMMANDS =====
  if (lowerText === "/lang en" || lowerText === "/lang english") {
    await setUserLanguage(userId, "en");
    await sendMessage(userId, t("lang_changed"), getMainKeyboard("en"));
    return;
  }
  if (lowerText === "/lang ru" || lowerText === "/lang russian" || lowerText === "/lang русский") {
    await setUserLanguage(userId, "ru");
    await sendMessage(userId, t("lang_changed"), getMainKeyboard("ru"));
    return;
  }
  if (lowerText === "/lang zh" || lowerText === "/lang chinese" || lowerText === "/lang 中文") {
    await setUserLanguage(userId, "zh");
    await sendMessage(userId, t("lang_changed"), getMainKeyboard("zh"));
    return;
  }
  
  // ===== HELP =====
  if (lowerText === "help" || lowerText === "/help" || lowerText === "помощь" || lowerText === "帮助" ||
      text.includes("❓ Help") || text.includes("❓ Помощь") || text.includes("❓ 帮助")) {
    await sendMessage(userId, t("help_text"), getMainKeyboard(userLang));
    return;
  }
  
  // ===== SCHEDULE =====
  if (lowerText === "schedule" || lowerText === "расписание" || lowerText === "课程表" ||
      text.includes("📅 Schedule") || text.includes("📅 Расписание") || text.includes("📅 课程表")) {
    const classes = await getClasses(userId);
    
    if (classes.length === 0) {
      await sendMessage(userId, t("schedule_empty"), getMainKeyboard(userLang));
      return;
    }
    
    let msg = "📅 **" + (userLang === 'ru' ? "Расписание" : userLang === 'zh' ? "课程表" : "Schedule") + "**\n\n";
    for (const cls of classes) {
      msg += `🆔 ${cls.id} | ${t("days")[cls.day]} | ${cls.start_time}-${cls.end_time}\n`;
      msg += `   📖 ${cls.subject}\n`;
      if (cls.location) msg += `   📍 ${cls.location}\n`;
      msg += `   🗑️ /delete ${cls.id}\n\n`;
    }
    
    await sendMessage(userId, msg, getMainKeyboard(userLang));
    return;
  }
  
  // ===== TODAY =====
  if (lowerText === "today" || lowerText === "сегодня" || lowerText === "今天") {
    const todayClasses = await getTodayClasses(userId);
    
    if (todayClasses.length === 0) {
      await sendMessage(userId, "🎉 " + (userLang === 'ru' ? "Сегодня нет пар!" : userLang === 'zh' ? "今天没课！" : "No classes today!"), getMainKeyboard(userLang));
      return;
    }
    
    let msg = "📋 **" + (userLang === 'ru' ? "Сегодня" : userLang === 'zh' ? "今日课程" : "Today's Classes") + "**\n\n";
    for (const cls of todayClasses) {
      msg += `⏰ ${cls.start_time}-${cls.end_time} • **${cls.subject}**\n`;
      if (cls.location) msg += `   📍 ${cls.location}\n`;
      msg += "\n";
    }
    
    await sendMessage(userId, msg, getMainKeyboard(userLang));
    return;
  }
  
  // ===== TOMORROW =====
  if (lowerText === "tomorrow" || lowerText === "завтра" || lowerText === "明天") {
    const tomorrow = getTodayIndex() === 6 ? 0 : getTodayIndex() + 1;
    const classes = await getClasses(userId);
    const tomorrowClasses = classes.filter(c => c.day === tomorrow);
    
    if (tomorrowClasses.length === 0) {
      await sendMessage(userId, "🎉 " + (userLang === 'ru' ? "Завтра нет пар!" : userLang === 'zh' ? "明天没课！" : "No classes tomorrow!"), getMainKeyboard(userLang));
      return;
    }
    
    let msg = "📅 **" + (userLang === 'ru' ? "Завтра" : userLang === 'zh' ? "明日课程" : "Tomorrow's Classes") + "**\n\n";
    for (const cls of tomorrowClasses) {
      msg += `⏰ ${cls.start_time}-${cls.end_time} • **${cls.subject}**\n`;
      if (cls.location) msg += `   📍 ${cls.location}\n`;
      msg += "\n";
    }
    
    await sendMessage(userId, msg, getMainKeyboard(userLang));
    return;
  }
  
  // ===== NEXT CLASS =====
  if (lowerText === "next" || lowerText === "следующая" || lowerText === "下一节") {
    const nextClass = await getNextClass(userId);
    
    if (nextClass) {
      const now = new Date();
      const [h, m] = nextClass.start_time.split(":").map(Number);
      const classTime = new Date();
      classTime.setHours(h, m, 0, 0);
      const minutes = Math.max(0, Math.round((classTime - now) / 60000));
      
      let msg = "⏰ **" + (userLang === 'ru' ? "Следующая пара" : userLang === 'zh' ? "下一节课" : "Next Class") + "**\n\n";
      msg += `📖 ${nextClass.subject}\n`;
      msg += `📅 ${t("days")[nextClass.day]}\n`;
      msg += `🕐 ${nextClass.start_time}\n`;
      msg += `⏱️ ${minutes} ${userLang === 'ru' ? 'минут' : userLang === 'zh' ? '分钟' : 'minutes'}\n`;
      if (nextClass.location) msg += `📍 ${nextClass.location}\n`;
      
      await sendMessage(userId, msg, getMainKeyboard(userLang));
    } else {
      await sendMessage(userId, "🎉 " + (userLang === 'ru' ? "Нет предстоящих пар!" : userLang === 'zh' ? "没有即将开始的课程！" : "No upcoming classes!"), getMainKeyboard(userLang));
    }
    return;
  }
  
  // ===== ADD CLASS =====
  if (lowerText.startsWith("/add")) {
    const parts = text.split(/\s+/);
    if (parts.length >= 5) {
      const subject = parts[1];
      const day = parseInt(parts[2]);
      const startTime = parts[3];
      const endTime = parts[4];
      const location = parts.slice(5).join(" ");
      
      if (isNaN(day) || day < 0 || day > 6) {
        await sendMessage(userId, "❌ Invalid day. Use 0-6 (0=Monday)", getMainKeyboard(userLang));
        return;
      }
      
      const success = await addClass(userId, subject, day, startTime, endTime, location);
      if (success) {
        await sendMessage(userId, t("class_added", { subject, day: t("days")[day], start: startTime, end: endTime }), getMainKeyboard(userLang));
      } else {
        await sendMessage(userId, "❌ Error adding class", getMainKeyboard(userLang));
      }
    } else {
      await sendMessage(userId, "❌ Format: /add <subject> <day> <start> <end> [location]", getMainKeyboard(userLang));
    }
    return;
  }
  
  // ===== DELETE CLASS =====
  if (lowerText.startsWith("/delete") && !lowerText.includes("task")) {
    const parts = text.split(/\s+/);
    if (parts.length >= 2) {
      const classId = parseInt(parts[1]);
      if (!isNaN(classId)) {
        const success = await deleteClass(classId, userId);
        await sendMessage(userId, success ? t("class_deleted", { id: classId }) : t("class_not_found"), getMainKeyboard(userLang));
      }
    }
    return;
  }
  
  // ===== TASKS =====
  if (lowerText === "tasks" || lowerText === "задачи" || lowerText === "任务" ||
      text.includes("📝 Tasks") || text.includes("📝 Задачи") || text.includes("📝 任务")) {
    const tasks = await getTasks(userId, true);
    
    if (tasks.length === 0) {
      await sendMessage(userId, t("tasks_empty"), getMainKeyboard(userLang));
      return;
    }
    
    let msg = "📝 **" + (userLang === 'ru' ? "Задачи" : userLang === 'zh' ? "任务" : "Tasks") + "**\n\n";
    for (const task of tasks) {
      msg += `🆔 ${task.id} | 📅 ${task.due_date}\n`;
      msg += `   📖 ${task.title}\n`;
      msg += `   🎯 ${task.priority || 'normal'}\n`;
      msg += `   ✅ /complete ${task.id}\n`;
      msg += `   🗑️ /delete_task ${task.id}\n\n`;
    }
    
    await sendMessage(userId, msg, getMainKeyboard(userLang));
    return;
  }
  
  // ===== ADD TASK =====
  if (lowerText.startsWith("/task")) {
    // Parse: /task "Title" YYYY-MM-DD [priority]
    const match = text.match(/\/task\s+"([^"]+)"\s+(\d{4}-\d{2}-\d{2})(?:\s+(high|medium|low))?/);
    
    if (match) {
      const title = match[1];
      const dueDate = match[2];
      const priority = match[3] || "normal";
      
      const success = await addTask(userId, title, dueDate, priority);
      if (success) {
        await sendMessage(userId, t("task_added", { title, due_date: dueDate }), getMainKeyboard(userLang));
      }
    } else {
      await sendMessage(userId, '❌ Format: /task "Title" YYYY-MM-DD [high|medium|low]', getMainKeyboard(userLang));
    }
    return;
  }
  
  // ===== COMPLETE TASK =====
  if (lowerText.startsWith("/complete")) {
    const parts = text.split(/\s+/);
    if (parts.length >= 2) {
      const taskId = parseInt(parts[1]);
      if (!isNaN(taskId)) {
        const success = await completeTask(taskId, userId);
        await sendMessage(userId, success ? t("task_completed", { id: taskId }) : t("task_not_found"), getMainKeyboard(userLang));
      }
    }
    return;
  }
  
  // ===== DELETE TASK =====
  if (lowerText.startsWith("/delete_task")) {
    const parts = text.split(/\s+/);
    if (parts.length >= 2) {
      const taskId = parseInt(parts[1]);
      if (!isNaN(taskId)) {
        const success = await deleteTask(taskId, userId);
        await sendMessage(userId, success ? t("task_deleted", { id: taskId }) : t("task_not_found"), getMainKeyboard(userLang));
      }
    }
    return;
  }
  
  // ===== STUDY TIMER =====
  if (text === "⏱️ Timer" || text === "⏱️ Таймер" || text === "⏱️ 计时器" || lowerText === "/timer") {
    const helpText = userLang === 'ru' 
      ? "⏱️ /study <предмет> <минуты>\nПример: /study Математика 30\n/stop - остановить"
      : userLang === 'zh'
      ? "⏱️ /study <科目> <分钟>\n示例: /study 数学 30\n/stop - 停止"
      : "⏱️ /study <subject> <minutes>\nExample: /study Math 30\n/stop - stop timer";
    await sendMessage(userId, helpText, getMainKeyboard(userLang));
    return;
  }
  
  if (lowerText.startsWith("/study")) {
    const parts = text.split(/\s+/);
    if (parts.length >= 3) {
      const subject = parts[1];
      const duration = parseInt(parts[2]);
      
      if (!isNaN(duration) && duration >= 5 && duration <= 180) {
        await startStudyTimer(userId, subject, duration, sendMessage);
        await sendMessage(userId, t("study_timer_start", { subject, duration }), getMainKeyboard(userLang));
      } else {
        await sendMessage(userId, "❌ Duration must be 5-180 minutes", getMainKeyboard(userLang));
      }
    }
    return;
  }
  
  if (lowerText === "/stop") {
    const timer = activeTimers.get(userId);
    if (timer) {
      clearTimeout(timer.timeout);
      activeTimers.delete(userId);
      await sendMessage(userId, t("study_timer_cancel"), getMainKeyboard(userLang));
    } else {
      await sendMessage(userId, "❌ No active timer", getMainKeyboard(userLang));
    }
    return;
  }
  
  // ===== REMINDER =====
  if (lowerText.startsWith("/remind")) {
    const parts = text.split(/\s+/);
    if (parts.length >= 2) {
      const minutes = parseInt(parts[1]);
      if (!isNaN(minutes) && minutes >= 5 && minutes <= 120) {
        await setUserReminderOffset(userId, minutes);
        await sendMessage(userId, t("reminder_set", { minutes }), getMainKeyboard(userLang));
      }
    } else {
      const offset = await getUserReminderOffset(userId);
      await sendMessage(userId, `⏰ Reminder: ${offset} minutes before class`, getMainKeyboard(userLang));
    }
    return;
  }
  
  // ===== ICS IMPORT =====
  if (lowerText.startsWith("/ics")) {
    const parts = text.split(/\s+/);
    if (parts.length >= 2) {
      await sendMessage(userId, t("import_start"), getMainKeyboard(userLang));
      const result = await importICS(userId, parts[1], userLang);
      
      if (result.success) {
        await sendMessage(userId, t("import_success", { count: result.count }), getMainKeyboard(userLang));
      } else {
        await sendMessage(userId, t("import_fail", { error: result.error || "Unknown error" }), getMainKeyboard(userLang));
      }
    }
    return;
  }
  
  // ===== STATS =====
  if (lowerText === "stats" || lowerText === "статистика" || lowerText === "统计" ||
      text.includes("📊 Stats") || text.includes("📊 Статистика") || text.includes("📊 统计")) {
    const [classes, tasks, studyStats] = await Promise.all([
      getClasses(userId),
      getTasks(userId, false),
      getStudyStats(userId)
    ]);
    
    const completed = tasks.filter(t => t.completed).length;
    const pending = tasks.filter(t => !t.completed).length;
    
    let msg = t("stats_header");
    msg += `📚 Classes: ${classes.length}\n`;
    msg += `📝 Tasks: ${completed} done, ${pending} pending\n`;
    msg += `⏱️ Study time: ${studyStats.total} min total, ${studyStats.weekly} min this week\n`;
    
    await sendMessage(userId, msg, getMainKeyboard(userLang));
    return;
  }
  
  // ===== DEFAULT =====
  await sendMessage(userId, t("greeting", { name: userName }), getMainKeyboard(userLang));
}

// ==================== WEBHOOK HANDLER ====================
export async function handler(event) {
  const startTime = Date.now();
  
  try {
    // Parse body once
    const body = JSON.parse(event.body);
    
    // VK Confirmation - respond immediately
    if (body.type === "confirmation") {
      return { 
        statusCode: 200, 
        body: process.env.VK_CONFIRMATION_TOKEN || "confirm" 
      };
    }
    
    // Send OK response immediately to VK
    // VK requires response within 10 seconds
    // We'll process the message after confirming receipt
    
    // Message Event
    if (body.type === "message_new") {
      const message = body.object?.message;
      if (!message) {
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }
      
      const userId = message.from_id;
      const text = message.text || "";
      const attachments = message.attachments || [];
      
      console.log(`[${userId}] Processing: "${text.substring(0, 100)}"`);
      
      // Fast path: detect language
      const detectedLang = detectLanguage(text);
      
      // Get user data (will create if doesn't exist)
      const user = await getOrCreateUser(userId, detectedLang);
      const userLang = user?.language || detectedLang;
      const userName = user?.name || "Student";
      
      // Check if this is a name introduction
      const namePatterns = [
        /(?:my name is|i'm|i am|call me)\s+([A-Za-z]{2,})/i,
        /(?:меня зовут|я)\s+([А-Яа-я]{2,})/i,
        /(?:我叫|我是)\s+([\u4e00-\u9fff]{1,4})/i
      ];
      
      let nameMatch = null;
      for (const pattern of namePatterns) {
        nameMatch = text.match(pattern);
        if (nameMatch) break;
      }
      
      if (nameMatch && (!userName || userName === "Student")) {
        const newName = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1);
        await setUserName(userId, newName);
        await sendMessage(userId, getTranslation(userLang, "got_name", { name: newName }), getMainKeyboard(userLang));
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }
      
      // Ask for name if not set
      if ((!userName || userName === "Student") && text.length > 0 && !text.startsWith("/")) {
        await sendMessage(userId, getTranslation(userLang, "ask_name"));
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }
      
      // Check for ICS file attachment
      const icsAttachment = attachments.find(a => 
        a.type === "doc" && a.doc?.title?.toLowerCase().endsWith(".ics")
      );
      
      if (icsAttachment) {
        await sendMessage(userId, getTranslation(userLang, "import_start"), getMainKeyboard(userLang));
        try {
          const fileResponse = await fetch(icsAttachment.doc.url);
          const fileContent = await fileResponse.text();
          const result = await importICS(userId, `data:text/calendar,${encodeURIComponent(fileContent)}`, userLang);
          
          if (result.success) {
            await sendMessage(userId, getTranslation(userLang, "import_success", { count: result.count }), getMainKeyboard(userLang));
          } else {
            await sendMessage(userId, getTranslation(userLang, "import_fail", { error: result.error }), getMainKeyboard(userLang));
          }
        } catch (err) {
          await sendMessage(userId, getTranslation(userLang, "import_fail", { error: err.message }), getMainKeyboard(userLang));
        }
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }
      
      // Process the message - use setTimeout to not block the response
      // But since we need to send a response, we do it synchronously for now
      await processMessage(userId, text, userLang, userName);
      
      const processingTime = Date.now() - startTime;
      console.log(`[${userId}] Processed in ${processingTime}ms`);
      
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }
    
    // Other event types
    if (body.type === "check_reminders") {
      // This would be called by a cron job
      console.log("[Cron] Checking reminders...");
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }
    
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    
  } catch (error) {
    console.error("Handler error:", error);
    const processingTime = Date.now() - startTime;
    console.log(`Failed after ${processingTime}ms`);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: error.message }) 
    };
  }
}
