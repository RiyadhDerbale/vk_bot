// ==================== VITA BOT - COMPLETE PRODUCTION READY ====================
import { createClient } from "@supabase/supabase-js";

// ==================== CONFIGURATION ====================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const VK_TOKEN = process.env.VK_TOKEN;
const VK_CONFIRMATION = process.env.VK_CONFIRMATION_TOKEN;
const VK_API_VERSION = "5.199";

// ==================== SIMPLE IN-MEMORY CACHE ====================
const cache = new Map();
const CACHE_TTL = 60000; // 1 minute

function getCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.time > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

function setCache(key, data) {
  cache.set(key, { data, time: Date.now() });
}

function clearUserCache(userId) {
  for (const key of cache.keys()) {
    if (key.includes(`_${userId}`)) cache.delete(key);
  }
}

// ==================== LANGUAGE SYSTEM ====================
const LANGS = {
  en: {
    welcome_new: "🎉 *Welcome to Vita!*\n\nI'm your AI-powered study assistant. Let's get started!\n\nWhat's your name?",
    welcome_back: "👋 Welcome back, {name}! Ready to be productive today?",
    help: `🤖 *Vita Commands*\n\n📅 *Schedule*\n/add - Add class\n/schedule - View schedule\n/today - Today's classes\n/tomorrow - Tomorrow\n\n📝 *Tasks*\n/task - Add task\n/tasks - View tasks\n/complete - Finish task\n\n⏱️ *Study*\n/focus - Start timer\n/stop - Stop timer\n\n📊 *Other*\n/stats - Statistics\n/upload - Import calendar\n/help - This menu`,
    schedule_title: "📅 *Your Schedule*\n\n",
    schedule_empty: "📭 No classes yet!\n\nUse /add to create your schedule, or /upload to import a calendar.",
    today_title: "📋 *Today's Classes*\n\n",
    today_empty: "🎉 No classes today! Time to study or relax!",
    tasks_title: "📝 *Your Tasks*\n\n",
    tasks_empty: "✅ All caught up! No pending tasks!",
    stats: "📊 *Your Statistics*\n\n📚 Classes: {classes}\n✅ Tasks: {completed}/{total}\n⏱️ Study Time: {focus} hours\n🔥 Streak: {streak} days",
    class_added: "✅ Added: {subject} on {day} at {start}-{end}",
    class_deleted: "✅ Class deleted successfully",
    task_added: "✅ Task added: {title}\n📅 Due: {due}\n⚡ Priority: {priority}",
    task_completed: "✅ Task #{id} marked as done! 🎉",
    focus_start: "⏱️ *Focus Mode ON*\n\n📖 {subject}\n⏰ {duration} minutes\n\nStay focused! I'll notify you when done.",
    focus_complete: "🎉 *Focus Session Complete!*\n\n📖 {subject}\n⏰ {duration} minutes\n\nGreat job! Take a break!",
    focus_stop: "⏹️ Focus session stopped.\n📖 {subject}\n⏱️ {elapsed} minutes completed.",
    import_start: "📥 Importing calendar...",
    import_done: "✅ Imported {count} classes! Use /schedule to view.",
    import_error: "❌ Import failed: {error}",
    weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  },
  ru: {
    welcome_new: "🎉 *Добро пожаловать в Vita!*\n\nЯ ваш AI-помощник по учебе. Давайте начнем!\n\nКак вас зовут?",
    welcome_back: "👋 С возвращением, {name}! Готовы к продуктивному дню?",
    help: `🤖 *Команды Vita*\n\n📅 *Расписание*\n/add - Добавить пару\n/schedule - Расписание\n/today - Сегодня\n/tomorrow - Завтра\n\n📝 *Задачи*\n/task - Добавить задачу\n/tasks - Список задач\n/complete - Завершить\n\n⏱️ *Учеба*\n/focus - Начать таймер\n/stop - Остановить\n\n📊 *Другое*\n/stats - Статистика\n/upload - Импорт\n/help - Помощь`,
    schedule_title: "📅 *Ваше расписание*\n\n",
    schedule_empty: "📭 Расписание пусто!\n\nИспользуйте /add или /upload для импорта.",
    today_title: "📋 *Сегодня*\n\n",
    today_empty: "🎉 Сегодня нет пар! Время учиться или отдыхать!",
    tasks_title: "📝 *Ваши задачи*\n\n",
    tasks_empty: "✅ Всё сделано! Нет активных задач!",
    stats: "📊 *Ваша статистика*\n\n📚 Пары: {classes}\n✅ Задачи: {completed}/{total}\n⏱️ Учёба: {focus} часов\n🔥 Серия: {streak} дней",
    class_added: "✅ Добавлено: {subject} в {day} {start}-{end}",
    class_deleted: "✅ Пара удалена",
    task_added: "✅ Задача: {title}\n📅 До: {due}\n⚡ Приоритет: {priority}",
    task_completed: "✅ Задача #{id} выполнена! 🎉",
    focus_start: "⏱️ *Фокус ВКЛ*\n\n📖 {subject}\n⏰ {duration} минут\n\nСосредоточьтесь! Я сообщу когда закончите.",
    focus_complete: "🎉 *Сессия завершена!*\n\n📖 {subject}\n⏰ {duration} минут\n\nОтличная работа! Отдохните!",
    focus_stop: "⏹️ Фокус остановлен.\n📖 {subject}\n⏱️ {elapsed} минут завершено.",
    import_start: "📥 Импортирую календарь...",
    import_done: "✅ Импортировано {count} пар! Используйте /schedule для просмотра.",
    import_error: "❌ Ошибка импорта: {error}",
    weekdays: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
  }
};

function t(key, lang = 'en', params = {}) {
  let text = LANGS[lang]?.[key] || LANGS.en[key] || key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(`{${k}}`, v);
  }
  return text;
}

function detectLang(text) {
  if (!text) return 'en';
  if (/[а-яё]/i.test(text)) return 'ru';
  return 'en';
}

// ==================== VK API FUNCTIONS ====================
async function vkApi(method, params) {
  try {
    const url = new URL(`https://api.vk.com/method/${method}`);
    url.searchParams.append('v', VK_API_VERSION);
    url.searchParams.append('access_token', VK_TOKEN);

    const formData = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      formData.append(key, typeof value === 'object' ? JSON.stringify(value) : value);
    }

    const response = await fetch(url.toString(), {
      method: 'POST',
      body: formData,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const data = await response.json();
    
    if (data.error) {
      console.error(`VK API Error (${method}):`, data.error);
      return null;
    }
    
    return data.response || data;
  } catch (error) {
    console.error(`VK API call failed (${method}):`, error);
    return null;
  }
}

async function sendMessage(userId, message, keyboard = null) {
  if (message.length > 4000) {
    // Split long messages
    const parts = [];
    while (message.length > 4000) {
      parts.push(message.substring(0, 4000));
      message = message.substring(4000);
    }
    parts.push(message);
    
    for (const part of parts) {
      await vkApi('messages.send', {
        user_id: userId,
        message: part,
        random_id: Math.floor(Math.random() * 1000000),
        ...(keyboard && parts.indexOf(part) === parts.length - 1 ? { keyboard } : {})
      });
    }
    return;
  }

  return vkApi('messages.send', {
    user_id: userId,
    message,
    random_id: Math.floor(Math.random() * 1000000),
    ...(keyboard ? { keyboard } : {})
  });
}

function getKeyboard(lang = 'en') {
  return {
    one_time: false,
    buttons: [
      [
        { action: { type: "text", label: lang === 'ru' ? "📅 Расписание" : "📅 Schedule" }, color: "primary" },
        { action: { type: "text", label: lang === 'ru' ? "📋 Сегодня" : "📋 Today" }, color: "primary" }
      ],
      [
        { action: { type: "text", label: lang === 'ru' ? "📝 Задачи" : "📝 Tasks" }, color: "positive" },
        { action: { type: "text", label: lang === 'ru' ? "⏰ Далее" : "⏰ Next" }, color: "positive" }
      ],
      [
        { action: { type: "text", label: lang === 'ru' ? "⏱️ Фокус" : "⏱️ Focus" }, color: "negative" },
        { action: { type: "text", label: lang === 'ru' ? "📊 Статистика" : "📊 Stats" }, color: "secondary" }
      ],
      [
        { action: { type: "text", label: lang === 'ru' ? "❓ Помощь" : "❓ Help" }, color: "secondary" }
      ]
    ]
  };
}

// ==================== DATABASE FUNCTIONS ====================
async function getUser(userId) {
  const cacheKey = `user_${userId}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  let { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("vk_id", userId)
    .single();

  if (!user) {
    const { data: newUser } = await supabase
      .from("users")
      .insert({
        vk_id: userId,
        language: 'en',
        notify_offset: 60,
        total_focus_minutes: 0,
        tasks_completed: 0,
        streak: 0
      })
      .select()
      .single();
    user = newUser;
  }

  if (user) setCache(cacheKey, user);
  return user;
}

async function updateUser(userId, updates) {
  const { error } = await supabase
    .from("users")
    .update(updates)
    .eq("vk_id", userId);
  
  if (!error) clearUserCache(userId);
  return !error;
}

async function getClasses(userId) {
  const cacheKey = `classes_${userId}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const { data } = await supabase
    .from("schedule")
    .select("*")
    .eq("user_id", userId)
    .order("day")
    .order("start_time");

  const classes = data || [];
  setCache(cacheKey, classes);
  return classes;
}

async function addClass(userId, classData) {
  const { error } = await supabase
    .from("schedule")
    .insert({ user_id: userId, ...classData });
  
  if (!error) clearUserCache(userId);
  return !error;
}

async function deleteClass(userId, classId) {
  const { error } = await supabase
    .from("schedule")
    .delete()
    .eq("id", classId)
    .eq("user_id", userId);
  
  if (!error) clearUserCache(userId);
  return !error;
}

async function getTasks(userId, onlyPending = true) {
  const cacheKey = `tasks_${userId}_${onlyPending}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  let query = supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId);
  
  if (onlyPending) query = query.eq("done", false);
  
  const { data } = await query.order("due_date");
  const tasks = data || [];
  setCache(cacheKey, tasks);
  return tasks;
}

async function addTask(userId, taskData) {
  const { error } = await supabase
    .from("tasks")
    .insert({ user_id: userId, ...taskData });
  
  if (!error) clearUserCache(userId);
  return !error;
}

async function completeTask(userId, taskId) {
  const { error } = await supabase
    .from("tasks")
    .update({ done: true, completed_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("user_id", userId);
  
  if (!error) {
    clearUserCache(userId);
    // Update completion count
    await supabase.rpc('increment_tasks_completed', { user_id_param: userId });
  }
  return !error;
}

async function getStats(userId) {
  const cacheKey = `stats_${userId}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const [classes, tasks, user] = await Promise.all([
    getClasses(userId),
    getTasks(userId, false),
    getUser(userId)
  ]);

  const completed = tasks.filter(t => t.done).length;
  const totalFocus = ((user?.total_focus_minutes || 0) / 60).toFixed(1);

  const stats = {
    classes: classes.length,
    completed,
    total: tasks.length,
    focus: totalFocus,
    streak: user?.streak || 0,
    level: Math.floor((user?.xp || 0) / 1000) + 1,
    xp: user?.xp || 0
  };

  setCache(cacheKey, stats);
  return stats;
}

// ==================== ICS PARSER ====================
function parseICS(icsContent) {
  const events = [];
  const lines = icsContent.split('\n');
  let currentEvent = null;

  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed === 'BEGIN:VEVENT') {
      currentEvent = {};
    } else if (trimmed === 'END:VEVENT') {
      if (currentEvent && currentEvent.summary && currentEvent.dtstart) {
        events.push(currentEvent);
      }
      currentEvent = null;
    } else if (currentEvent) {
      if (trimmed.startsWith('SUMMARY:')) {
        currentEvent.summary = trimmed.substring(8).replace(/\\,/g, ',');
      } else if (trimmed.startsWith('DTSTART')) {
        const match = trimmed.match(/(\d{8}T?\d{4})/);
        if (match) currentEvent.dtstart = match[1];
      } else if (trimmed.startsWith('DTEND')) {
        const match = trimmed.match(/(\d{8}T?\d{4})/);
        if (match) currentEvent.dtend = match[1];
      } else if (trimmed.startsWith('LOCATION:')) {
        currentEvent.location = trimmed.substring(9).replace(/\\,/g, ',');
      }
    }
  }

  return events;
}

function parseICSEvent(event) {
  try {
    // Parse start time
    const startStr = event.dtstart;
    const year = parseInt(startStr.substring(0, 4));
    const month = parseInt(startStr.substring(4, 6)) - 1;
    const day = parseInt(startStr.substring(6, 8));
    const hour = parseInt(startStr.substring(9, 11) || '9');
    const minute = parseInt(startStr.substring(11, 13) || '0');

    const date = new Date(year, month, day, hour, minute);
    let weekday = date.getDay();
    weekday = weekday === 0 ? 6 : weekday - 1; // Convert to 0=Monday

    // Parse end time
    let endHour = (hour + 1) % 24;
    let endMinute = minute;
    
    if (event.dtend) {
      endHour = parseInt(event.dtend.substring(9, 11) || endHour.toString());
      endMinute = parseInt(event.dtend.substring(11, 13) || '0');
    }

    return {
      subject: event.summary,
      day: weekday,
      start_time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
      end_time: `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`,
      location: event.location || null
    };
  } catch (error) {
    console.error("Error parsing ICS event:", error);
    return null;
  }
}

async function importICS(userId, icsContent) {
  try {
    const events = parseICS(icsContent);
    
    if (events.length === 0) {
      return { success: false, error: "No events found in calendar" };
    }

    const existingClasses = await getClasses(userId);
    const existingSet = new Set(
      existingClasses.map(c => `${c.subject}|${c.day}|${c.start_time}`)
    );

    let imported = 0;
    let duplicates = 0;

    for (const event of events) {
      const classData = parseICSEvent(event);
      if (!classData) continue;

      const key = `${classData.subject}|${classData.day}|${classData.start_time}`;
      if (existingSet.has(key)) {
        duplicates++;
        continue;
      }

      const success = await addClass(userId, classData);
      if (success) {
        imported++;
        existingSet.add(key);
      }
    }

    return { success: true, count: imported, duplicates };
  } catch (error) {
    console.error("Import error:", error);
    return { success: false, error: error.message };
  }
}

// ==================== COMMAND HANDLERS ====================
const commands = {
  help: async (userId, lang) => {
    await sendMessage(userId, t('help', lang), getKeyboard(lang));
  },

  schedule: async (userId, lang) => {
    const classes = await getClasses(userId);
    
    if (classes.length === 0) {
      await sendMessage(userId, t('schedule_empty', lang), getKeyboard(lang));
      return;
    }

    const byDay = {};
    for (const cls of classes) {
      if (!byDay[cls.day]) byDay[cls.day] = [];
      byDay[cls.day].push(cls);
    }

    let message = t('schedule_title', lang);
    const weekdays = t('weekdays', lang).split(', ');

    for (let d = 0; d < 7; d++) {
      if (byDay[d]) {
        message += `\n📌 *${weekdays[d]}*\n`;
        for (const cls of byDay[d]) {
          message += `  ${cls.start_time}-${cls.end_time} • ${cls.subject}`;
          if (cls.location) message += ` (${cls.location})`;
          message += '\n';
        }
      }
    }

    await sendMessage(userId, message, getKeyboard(lang));
  },

  today: async (userId, lang) => {
    const now = new Date();
    const dayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const classes = await getClasses(userId);
    const todayClasses = classes.filter(c => c.day === dayIndex);

    if (todayClasses.length === 0) {
      await sendMessage(userId, t('today_empty', lang), getKeyboard(lang));
      return;
    }

    const weekdays = t('weekdays', lang).split(', ');
    let message = `📋 *${weekdays[dayIndex]}*\n\n`;

    for (const cls of todayClasses) {
      const status = cls.start_time <= currentTime && cls.end_time >= currentTime ? '🟢 NOW' : 
                     cls.start_time > currentTime ? '⏳ Upcoming' : '✅ Done';
      message += `${status} ${cls.start_time}-${cls.end_time} • ${cls.subject}\n`;
    }

    await sendMessage(userId, message, getKeyboard(lang));
  },

  tomorrow: async (userId, lang) => {
    const now = new Date();
    const todayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const tomorrowIndex = todayIndex === 6 ? 0 : todayIndex + 1;
    
    const classes = await getClasses(userId);
    const tomorrowClasses = classes.filter(c => c.day === tomorrowIndex);

    const weekdays = t('weekdays', lang).split(', ');

    if (tomorrowClasses.length === 0) {
      await sendMessage(userId, `🎉 No classes on ${weekdays[tomorrowIndex]}!`, getKeyboard(lang));
      return;
    }

    let message = `📅 *${weekdays[tomorrowIndex]}*\n\n`;
    for (const cls of tomorrowClasses) {
      message += `  ${cls.start_time}-${cls.end_time} • ${cls.subject}\n`;
    }

    await sendMessage(userId, message, getKeyboard(lang));
  },

  next: async (userId, lang) => {
    const now = new Date();
    const dayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const classes = await getClasses(userId);
    
    // Find next class today
    const todayClasses = classes.filter(c => c.day === dayIndex && c.start_time > currentTime);
    if (todayClasses.length > 0) {
      const next = todayClasses[0];
      const [h, m] = next.start_time.split(':').map(Number);
      const minsUntil = (h - now.getHours()) * 60 + (m - now.getMinutes());
      await sendMessage(userId, `⏰ *Next Class*\n\n📖 ${next.subject}\n🕐 ${next.start_time}-${next.end_time}\n⏱️ In ${minsUntil} minutes`, getKeyboard(lang));
      return;
    }

    // Find first class tomorrow
    const tomorrowIndex = dayIndex === 6 ? 0 : dayIndex + 1;
    const tomorrowClasses = classes.filter(c => c.day === tomorrowIndex);
    
    if (tomorrowClasses.length > 0) {
      const next = tomorrowClasses[0];
      await sendMessage(userId, `⏰ *Next Class*\n\n📖 ${next.subject}\n📅 Tomorrow at ${next.start_time}`, getKeyboard(lang));
    } else {
      await sendMessage(userId, "🎉 No upcoming classes!", getKeyboard(lang));
    }
  },

  tasks: async (userId, lang) => {
    const tasks = await getTasks(userId, true);

    if (tasks.length === 0) {
      await sendMessage(userId, t('tasks_empty', lang), getKeyboard(lang));
      return;
    }

    let message = t('tasks_title', lang);
    
    const priorityEmoji = { high: '🔴', medium: '🟡', low: '🟢' };
    
    for (const task of tasks.slice(0, 15)) {
      const emoji = priorityEmoji[task.priority] || '⚪';
      const dueDate = new Date(task.due_date);
      const daysLeft = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));
      const dueStr = daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft}d left`;

      message += `${emoji} #${task.id} *${task.task}*\n   📅 ${task.due_date.split('T')[0]} (${dueStr})\n\n`;
    }

    if (tasks.length > 15) {
      message += `\n... and ${tasks.length - 15} more tasks`;
    }

    await sendMessage(userId, message, getKeyboard(lang));
  },

  stats: async (userId, lang) => {
    const stats = await getStats(userId);
    await sendMessage(userId, t('stats', lang, stats), getKeyboard(lang));
  },

  add: async (userId, text, lang) => {
    // /add Subject 0 09:00 10:30 Room 101
    const parts = text.split(/\s+/);
    if (parts.length < 5) {
      await sendMessage(userId, "Format: /add Subject Day StartTime EndTime [Location]\n\nExample: /add Math 0 09:00 10:30 Room 101\n\nDays: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun", getKeyboard(lang));
      return;
    }

    const subject = parts[1];
    const day = parseInt(parts[2]);
    const startTime = parts[3];
    const endTime = parts[4];
    const location = parts.slice(5).join(' ') || null;

    if (isNaN(day) || day < 0 || day > 6) {
      await sendMessage(userId, "Invalid day. Use 0-6 (0=Monday)", getKeyboard(lang));
      return;
    }

    const success = await addClass(userId, { subject, day, start_time: startTime, end_time: endTime, location });
    
    if (success) {
      const weekdays = t('weekdays', lang).split(', ');
      await sendMessage(userId, t('class_added', lang, {
        subject,
        day: weekdays[day],
        start: startTime,
        end: endTime
      }), getKeyboard(lang));
    } else {
      await sendMessage(userId, "❌ Failed to add class. Please try again.", getKeyboard(lang));
    }
  },

  task: async (userId, text, lang) => {
    // /task "Title" YYYY-MM-DD [priority] [duration]
    const match = text.match(/\/task\s*"?([^"]+)"?\s+(\d{4}-\d{2}-\d{2})(?:\s+(high|medium|low))?(?:\s+(\d+))?/i);
    
    if (!match) {
      await sendMessage(userId, 'Format: /task "Title" YYYY-MM-DD [priority] [minutes]\n\nExample: /task "Math Homework" 2026-05-01 high 60\n\nPriority: low, medium, high', getKeyboard(lang));
      return;
    }

    const [, title, dueDate, priority = 'medium', duration] = match;

    const success = await addTask(userId, {
      task: title,
      due_date: dueDate,
      priority,
      estimated_duration: duration ? parseInt(duration) : null,
      done: false
    });

    if (success) {
      await sendMessage(userId, t('task_added', lang, { title, due: dueDate, priority }), getKeyboard(lang));
    } else {
      await sendMessage(userId, "❌ Failed to add task. Please try again.", getKeyboard(lang));
    }
  },

  complete: async (userId, text, lang) => {
    const parts = text.split(/\s+/);
    const taskId = parseInt(parts[1]);

    if (isNaN(taskId)) {
      await sendMessage(userId, "Usage: /complete [task_id]\nFind IDs in your task list with /tasks", getKeyboard(lang));
      return;
    }

    const success = await completeTask(userId, taskId);
    await sendMessage(userId, success ? t('task_completed', lang, { id: taskId }) : "❌ Task not found", getKeyboard(lang));
  },

  delete: async (userId, text, lang) => {
    const parts = text.split(/\s+/);
    const id = parseInt(parts[1]);

    if (isNaN(id)) {
      await sendMessage(userId, "Usage: /delete [id]\nUse /schedule to find class IDs, or /tasks for task IDs", getKeyboard(lang));
      return;
    }

    const success = await deleteClass(userId, id);
    await sendMessage(userId, success ? t('class_deleted', lang) : "❌ Item not found", getKeyboard(lang));
  },

  upload: async (userId, text, lang) => {
    const url = text.split(/\s+/)[1];
    
    if (!url) {
      await sendMessage(userId, "Usage: /upload [calendar_url]\n\nExample: /upload https://example.com/calendar.ics\n\nYou can also attach a .ics file directly.", getKeyboard(lang));
      return;
    }

    await sendMessage(userId, t('import_start', lang));
    
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const icsContent = await response.text();
      const result = await importICS(userId, icsContent);
      
      if (result.success) {
        await sendMessage(userId, t('import_done', lang, { count: result.count }), getKeyboard(lang));
      } else {
        await sendMessage(userId, t('import_error', lang, { error: result.error }), getKeyboard(lang));
      }
    } catch (error) {
      await sendMessage(userId, t('import_error', lang, { error: error.message }), getKeyboard(lang));
    }
  }
};

// ==================== FOCUS TIMER ====================
const activeTimers = new Map();

function startFocusTimer(userId, subject, duration, lang) {
  // Clear existing timer
  if (activeTimers.has(userId)) {
    clearTimeout(activeTimers.get(userId).timeout);
  }

  const startTime = Date.now();
  const timeout = setTimeout(async () => {
    await sendMessage(userId, t('focus_complete', lang, { subject, duration }), getKeyboard(lang));
    
    // Log session
    await supabase.from("study_sessions").insert({
      user_id: userId,
      subject,
      planned_duration: duration,
      actual_duration: duration,
      date: new Date().toISOString().split('T')[0]
    });

    // Update user stats
    const user = await getUser(userId);
    await updateUser(userId, {
      total_focus_minutes: (user?.total_focus_minutes || 0) + duration,
      last_study_date: new Date().toISOString().split('T')[0]
    });

    activeTimers.delete(userId);
  }, duration * 60 * 1000);

  activeTimers.set(userId, { timeout, subject, duration, startTime });
}

function stopFocusTimer(userId) {
  const timer = activeTimers.get(userId);
  if (!timer) return null;

  clearTimeout(timer.timeout);
  const elapsed = Math.round((Date.now() - timer.startTime) / 60000);
  activeTimers.delete(userId);
  return { ...timer, elapsed };
}

// ==================== MAIN MESSAGE HANDLER ====================
async function processMessage(userId, text, attachments = []) {
  const msg = text.trim();
  const lower = msg.toLowerCase();
  
  // Get or create user
  let user = await getUser(userId);
  let userLang = user?.language || detectLang(msg);

  // Auto-detect language
  if (user && !user.language) {
    const detected = detectLang(msg);
    if (detected !== 'en') {
      await updateUser(userId, { language: detected });
      userLang = detected;
    }
  }

  // Handle ICS file attachments
  if (attachments.length > 0) {
    for (const att of attachments) {
      if (att.type === 'doc' && (att.doc?.title?.endsWith('.ics') || att.doc?.ext === 'ics')) {
        await sendMessage(userId, t('import_start', userLang));
        
        try {
          const response = await fetch(att.doc.url);
          const icsContent = await response.text();
          const result = await importICS(userId, icsContent);
          
          if (result.success) {
            await sendMessage(userId, t('import_done', userLang, { count: result.count }), getKeyboard(userLang));
          } else {
            await sendMessage(userId, t('import_error', userLang, { error: result.error }), getKeyboard(userLang));
          }
        } catch (error) {
          await sendMessage(userId, t('import_error', userLang, { error: error.message }), getKeyboard(userLang));
        }
        return;
      }
    }
  }

  // Process commands
  if (lower.startsWith('/')) {
    const cmd = lower.split(/\s+/)[0].substring(1);
    
    if (commands[cmd]) {
      await commands[cmd](userId, msg, userLang);
      return;
    }
  }

  // Natural language triggers
  if (['help', 'помощь'].includes(lower)) {
    await commands.help(userId, userLang);
  } else if (['schedule', 'расписание'].includes(lower)) {
    await commands.schedule(userId, userLang);
  } else if (['today', 'сегодня'].includes(lower)) {
    await commands.today(userId, userLang);
  } else if (['tomorrow', 'завтра'].includes(lower)) {
    await commands.tomorrow(userId, userLang);
  } else if (['next', 'далее', 'следующая'].includes(lower)) {
    await commands.next(userId, userLang);
  } else if (['tasks', 'задачи'].includes(lower)) {
    await commands.tasks(userId, userLang);
  } else if (['stats', 'статистика'].includes(lower)) {
    await commands.stats(userId, userLang);
  } else if (lower.startsWith('focus') || lower.startsWith('фокус')) {
    // Focus command: "focus Math 30"
    const parts = msg.split(/\s+/);
    const subject = parts[1] || 'Study';
    const duration = parseInt(parts[2]) || 25;
    
    if (duration < 5 || duration > 180) {
      await sendMessage(userId, "Duration must be 5-180 minutes", getKeyboard(userLang));
      return;
    }

    startFocusTimer(userId, subject, duration, userLang);
    await sendMessage(userId, t('focus_start', userLang, { subject, duration }), getKeyboard(userLang));
  } else if (lower === 'stop' || lower === 'стоп') {
    const timer = stopFocusTimer(userId);
    if (timer) {
      await sendMessage(userId, t('focus_stop', userLang, { subject: timer.subject, elapsed: timer.elapsed }), getKeyboard(userLang));
    } else {
      await sendMessage(userId, "No active focus session.", getKeyboard(userLang));
    }
  } else {
    // Welcome/new user flow
    if (!user?.name) {
      await sendMessage(userId, t('welcome_new', userLang));
    } else {
      await sendMessage(userId, t('welcome_back', userLang, { name: user.name }), getKeyboard(userLang));
    }
  }
}

// ==================== WEBHOOK HANDLER ====================
export async function handler(event) {
  try {
    const body = JSON.parse(event.body);

    // VK Server confirmation
    if (body.type === 'confirmation') {
      return {
        statusCode: 200,
        body: VK_CONFIRMATION || 'df7d544c'
      };
    }

    // Handle new messages
    if (body.type === 'message_new') {
      const msg = body.object?.message;
      if (!msg || msg.out === 1) {
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }

      const userId = msg.from_id;
      const text = msg.text || '';
      const attachments = msg.attachments || [];

      // Process in background
      processMessage(userId, text, attachments).catch(console.error);

      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };

  } catch (error) {
    console.error("Handler error:", error);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }
}