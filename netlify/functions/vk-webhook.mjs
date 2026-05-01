import { createClient } from "@supabase/supabase-js";

// ==================== CONFIGURATION ====================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const VK_TOKEN = process.env.VK_TOKEN;
const VK_API_VERSION = "5.199";

// Simple cache
const cache = new Map();
const CACHE_TTL = 300000;

function getCache(key) {
  const item = cache.get(key);
  if (item && Date.now() - item.time < CACHE_TTL) return item.data;
  cache.delete(key);
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, time: Date.now() });
}

function clearUserCache(userId) {
  for (const key of cache.keys()) {
    if (key.includes(userId)) cache.delete(key);
  }
}

// Active study timers
const timers = new Map();

// ==================== LANGUAGE SYSTEM ====================
function detectLanguage(text) {
  if (!text) return "en";
  if (/[а-яёА-ЯЁ]/.test(text)) return "ru";
  if (/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(text)) return "zh";
  return "en";
}

const T = {
  en: {
    ask_name: "👋 Hello! I'm your time management assistant. What's your name?",
    got_name: "🎉 Nice to meet you, {name}! I'll help you manage your time, schedule, and tasks! Type 'Help' to see what I can do.",
    greeting: "👋 Hey {name}! Ready to make the most of your time today? Type 'Help' for commands.",
    
    help: `🤖 *TIME MANAGEMENT BOT*

📅 *SCHEDULE*
Schedule - View all classes
Today - Today's classes
Tomorrow - Tomorrow's classes
Next - Next upcoming class
/add subject day start end [location] - Add class
/delete id - Delete class

📝 *TASKS*
Tasks - View your tasks
/task "title" YYYY-MM-DD [priority] - Add task
/complete id - Complete task
/delete_task id - Delete task

⏱️ *STUDY TIMER*
/study subject minutes - Start timer
/stop - Stop timer

📊 *STATS*
Stats - View your statistics

⚙️ *SETTINGS*
/remind minutes - Set reminder time (5-120)

📥 *IMPORT*
/ics url - Import calendar from ICS link
Attach .ics file directly

🌐 Days: 0=Mon 1=Tue 2=Wed 3=Thu 4=Fri 5=Sat 6=Sun`,
    
    schedule_empty: "📭 Your schedule is empty. Add classes with /add or import with /ics",
    schedule_header: "📅 *Your Schedule*\n\n",
    schedule_item: "🆔 {id} | {day} | {start}-{end}\n   📖 {subject}\n   📍 {location}\n   🗑️ /delete {id}\n\n",
    
    tasks_empty: "✅ No pending tasks! All caught up!",
    tasks_header: "📝 *Tasks*\n\n",
    tasks_item: "🆔 {id} | 📅 {due_date}\n   📖 {title}\n   🎯 {priority}\n   ✅ /complete {id}\n   🗑️ /delete_task {id}\n\n",
    
    no_classes_today: "🎉 No classes today! Use this time wisely!",
    no_classes_tomorrow: "🎉 No classes tomorrow!",
    no_next_class: "🎉 No upcoming classes!",
    
    class_added: "✅ Class added!\n📖 {subject}\n📅 {day}\n⏰ {start}-{end}\n📍 {location}",
    class_deleted: "✅ Class {id} deleted!",
    class_not_found: "❌ Class not found.",
    
    task_added: "✅ Task added!\n📝 {title}\n📅 Due: {due_date}\n🎯 Priority: {priority}",
    task_completed: "✅ Task {id} completed! 🎉",
    task_deleted: "🗑️ Task {id} deleted!",
    task_not_found: "❌ Task not found.",
    
    timer_start: "⏱️ Timer started!\n📖 {subject}\n⏰ {duration} minutes\nI'll notify you when time's up!",
    timer_end: "⏰ Time's up!\n📖 {subject}\n⏱️ {duration} minutes completed! 🎉",
    timer_stop: "❌ Timer stopped.",
    
    remind_set: "⏰ I'll remind you {minutes} minutes before each class.",
    remind_current: "⏰ Current reminder: {minutes} minutes before class.",
    
    import_start: "⏳ Importing calendar... This may take a moment.",
    import_parsing: "📋 Parsing {count} events from calendar...",
    import_done: "✅ Successfully imported {count} classes!\n\n📊 Summary:\n• Total events found: {total}\n• New classes added: {count}\n• Duplicates skipped: {duplicates}\n\nType 'Schedule' to view your updated schedule!",
    import_fail: "❌ Import failed: {error}",
    import_no_events: "❌ No valid events found in the ICS file. Make sure the file contains calendar events.",
    
    stats: "📊 *Your Stats*\n📚 Classes: {total_classes}\n📝 Tasks: {completed_done}/{total_tasks} done\n⏱️ Study: {study_min} min this week",
    
    unknown: "I don't understand. Type 'Help' to see commands.",
    
    weekdays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    weekdays_short: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  },
  
  ru: {
    ask_name: "👋 Привет! Я твой помощник по тайм-менеджменту. Как тебя зовут?",
    got_name: "🎉 Приятно познакомиться, {name}! Я помогу с расписанием и задачами! Напиши 'Help' чтобы увидеть команды.",
    greeting: "👋 Привет {name}! Готов продуктивно провести день? Напиши 'Help' для списка команд.",
    
    help: `🤖 *БОТ ТАЙМ-МЕНЕДЖМЕНТА*

📅 *РАСПИСАНИЕ*
Schedule - Все пары
Today - Сегодня
Tomorrow - Завтра
Next - Следующая пара
/add предмет день начало конец [место] - Добавить
/delete id - Удалить

📝 *ЗАДАЧИ*
Tasks - Список задач
/task "название" ГГГГ-ММ-ДД [приоритет] - Добавить
/complete id - Выполнить
/delete_task id - Удалить

⏱️ *ТАЙМЕР*
/study предмет минуты - Запустить
/stop - Остановить

📊 *СТАТИСТИКА*
Stats - Посмотреть статистику

⚙️ *НАСТРОЙКИ*
/remind минуты - Напоминание (5-120)

📥 *ИМПОРТ*
/ics ссылка - Импорт из ICS
Прикрепи .ics файл

🌐 Дни: 0=Пн 1=Вт 2=Ср 3=Чт 4=Пт 5=Сб 6=Вс`,
    
    schedule_empty: "📭 Расписание пусто. Добавь пары через /add или импортируй через /ics",
    schedule_header: "📅 *Твоё расписание*\n\n",
    schedule_item: "🆔 {id} | {day} | {start}-{end}\n   📖 {subject}\n   📍 {location}\n   🗑️ /delete {id}\n\n",
    
    tasks_empty: "✅ Нет активных задач! Всё выполнено!",
    tasks_header: "📝 *Задачи*\n\n",
    tasks_item: "🆔 {id} | 📅 {due_date}\n   📖 {title}\n   🎯 {priority}\n   ✅ /complete {id}\n   🗑️ /delete_task {id}\n\n",
    
    no_classes_today: "🎉 Сегодня нет пар! Используй время с умом!",
    no_classes_tomorrow: "🎉 Завтра нет пар!",
    no_next_class: "🎉 Нет предстоящих пар!",
    
    class_added: "✅ Пара добавлена!\n📖 {subject}\n📅 {day}\n⏰ {start}-{end}\n📍 {location}",
    class_deleted: "✅ Пара {id} удалена!",
    class_not_found: "❌ Пара не найдена.",
    
    task_added: "✅ Задача добавлена!\n📝 {title}\n📅 Срок: {due_date}\n🎯 Приоритет: {priority}",
    task_completed: "✅ Задача {id} выполнена! 🎉",
    task_deleted: "🗑️ Задача {id} удалена!",
    task_not_found: "❌ Задача не найдена.",
    
    timer_start: "⏱️ Таймер запущен!\n📖 {subject}\n⏰ {duration} минут\nЯ сообщу когда время выйдет!",
    timer_end: "⏰ Время вышло!\n📖 {subject}\n⏱️ {duration} минут завершено! 🎉",
    timer_stop: "❌ Таймер остановлен.",
    
    remind_set: "⏰ Буду напоминать за {minutes} минут до пары.",
    remind_current: "⏰ Напоминание: за {minutes} минут до пары.",
    
    import_start: "⏳ Импортирую расписание... Это займёт немного времени.",
    import_parsing: "📋 Обрабатываю {count} событий из календаря...",
    import_done: "✅ Успешно импортировано {count} пар!\n\n📊 Сводка:\n• Всего событий: {total}\n• Добавлено новых: {count}\n• Пропущено дубликатов: {duplicates}\n\nНапиши 'Schedule' чтобы посмотреть обновлённое расписание!",
    import_fail: "❌ Ошибка импорта: {error}",
    import_no_events: "❌ Не найдено событий в ICS файле. Убедись что файл содержит события календаря.",
    
    stats: "📊 *Статистика*\n📚 Пары: {total_classes}\n📝 Задачи: {completed_done}/{total_tasks} выполнено\n⏱️ Учёба: {study_min} мин на неделе",
    
    unknown: "Я не понял. Напиши 'Help' для списка команд.",
    
    weekdays: ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"],
    weekdays_short: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
  },
  
  zh: {
    ask_name: "👋 你好！我是你的时间管理助手。你叫什么名字？",
    got_name: "🎉 很高兴认识你，{name}！我会帮你管理时间和任务！输入'Help'查看命令。",
    greeting: "👋 你好 {name}！准备好高效利用时间了吗？输入'Help'查看命令。",
    
    help: `🤖 *时间管理机器人*

📅 *课程表*
Schedule - 查看所有课程
Today - 今日课程
Tomorrow - 明日课程
Next - 下一节课
/add 课程 星期 开始 结束 [地点] - 添加课程
/delete id - 删除课程

📝 *任务*
Tasks - 查看任务
/task "任务名" 年-月-日 [优先级] - 添加任务
/complete id - 完成任务
/delete_task id - 删除任务

⏱️ *计时器*
/study 科目 分钟 - 开始学习
/stop - 停止计时

📊 *统计*
Stats - 查看统计

⚙️ *设置*
/remind 分钟 - 设置提醒 (5-120)

📥 *导入*
/ics 链接 - 从ICS链接导入
直接附加.ics文件

🌐 星期: 0=周一 1=周二 2=周三 3=周四 4=周五 5=周六 6=周日`,
    
    schedule_empty: "📭 课程表为空。使用 /add 添加或 /ics 导入",
    schedule_header: "📅 *你的课程表*\n\n",
    schedule_item: "🆔 {id} | {day} | {start}-{end}\n   📖 {subject}\n   📍 {location}\n   🗑️ /delete {id}\n\n",
    
    tasks_empty: "✅ 没有待办任务！都完成了！",
    tasks_header: "📝 *任务*\n\n",
    tasks_item: "🆔 {id} | 📅 {due_date}\n   📖 {title}\n   🎯 {priority}\n   ✅ /complete {id}\n   🗑️ /delete_task {id}\n\n",
    
    no_classes_today: "🎉 今天没课！好好利用时间！",
    no_classes_tomorrow: "🎉 明天没课！",
    no_next_class: "🎉 没有即将开始的课程！",
    
    class_added: "✅ 课程已添加！\n📖 {subject}\n📅 {day}\n⏰ {start}-{end}\n📍 {location}",
    class_deleted: "✅ 课程 {id} 已删除！",
    class_not_found: "❌ 课程未找到。",
    
    task_added: "✅ 任务已添加！\n📝 {title}\n📅 截止: {due_date}\n🎯 优先级: {priority}",
    task_completed: "✅ 任务 {id} 已完成！🎉",
    task_deleted: "🗑️ 任务 {id} 已删除！",
    task_not_found: "❌ 任务未找到。",
    
    timer_start: "⏱️ 计时器已启动！\n📖 {subject}\n⏰ {duration} 分钟\n时间到时会通知你！",
    timer_end: "⏰ 时间到！\n📖 {subject}\n⏱️ 完成了 {duration} 分钟！🎉",
    timer_stop: "❌ 计时器已停止。",
    
    remind_set: "⏰ 我会在课前 {minutes} 分钟提醒。",
    remind_current: "⏰ 当前提醒: 课前 {minutes} 分钟。",
    
    import_start: "⏳ 正在导入日历... 这可能需要一点时间。",
    import_parsing: "📋 正在处理 {count} 个事件...",
    import_done: "✅ 成功导入 {count} 节课！\n\n📊 摘要:\n• 发现事件: {total}\n• 新增课程: {count}\n• 跳过重复: {duplicates}\n\n输入 'Schedule' 查看更新后的课程表！",
    import_fail: "❌ 导入失败: {error}",
    import_no_events: "❌ ICS文件中没有找到有效事件。请确保文件包含日历事件。",
    
    stats: "📊 *统计*\n📚 课程: {total_classes}\n📝 任务: {completed_done}/{total_tasks} 已完成\n⏱️ 学习: {study_min} 分钟本周",
    
    unknown: "我不明白。输入'Help'查看命令。",
    
    weekdays: ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"],
    weekdays_short: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
  }
};

function t(lang, key, params = {}) {
  if (!T[lang]) lang = "en";
  let text = T[lang][key] || T["en"][key] || key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, "g"), v !== undefined ? String(v) : "");
  }
  return text;
}

// ==================== DATABASE FUNCTIONS ====================
async function getUser(userId) {
  const cached = getCache(`user_${userId}`);
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
        name: null,
        language: "en",
        reminder_offset: 30
      })
      .select()
      .single();
    user = newUser;
  }
  
  if (user) setCache(`user_${userId}`, user);
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

async function getUserLang(userId) {
  const user = await getUser(userId);
  return user?.language || "en";
}

// ===== FIXED: Get classes with proper caching =====
async function getClasses(userId) {
  // Skip cache for now to ensure fresh data after import
  const { data, error } = await supabase
    .from("schedule")
    .select("*")
    .eq("user_id", userId)
    .order("day")
    .order("start_time");
  
  if (error) {
    console.error("Get classes error:", error);
    return [];
  }
  
  const result = data || [];
  console.log(`[DB] Got ${result.length} classes for user ${userId}`);
  
  // Cache the fresh data
  setCache(`classes_${userId}`, result);
  return result;
}

// ===== FIXED: Add class with proper logging =====
async function addClass(userId, subject, day, startTime, endTime, location = "") {
  console.log(`[DB] Adding class: ${subject}, day=${day}, ${startTime}-${endTime}, loc=${location}`);
  
  const { data, error } = await supabase
    .from("schedule")
    .insert({
      user_id: userId,
      subject: subject,
      day: parseInt(day),
      start_time: startTime,
      end_time: endTime,
      location: location || ""
    })
    .select();
  
  if (error) {
    console.error("Add class error:", error);
    return false;
  }
  
  console.log(`[DB] Class added successfully, id=${data?.[0]?.id}`);
  
  // IMPORTANT: Clear cache so next getClasses returns fresh data
  clearUserCache(userId);
  return true;
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
  
  if (onlyPending) query = query.eq("completed", false);
  
  const { data } = await query.order("due_date");
  
  const result = data || [];
  setCache(cacheKey, result);
  return result;
}

async function addTask(userId, title, dueDate, priority = "normal") {
  const { error } = await supabase
    .from("tasks")
    .insert({
      user_id: userId,
      title,
      due_date: dueDate,
      priority,
      completed: false,
      remind_days: 2
    });
  
  if (!error) clearUserCache(userId);
  return !error;
}

async function completeTask(userId, taskId) {
  const { error } = await supabase
    .from("tasks")
    .update({ completed: true, completed_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("user_id", userId);
  
  if (!error) clearUserCache(userId);
  return !error;
}

async function deleteTask(userId, taskId) {
  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("user_id", userId);
  
  if (!error) clearUserCache(userId);
  return !error;
}

async function addStudySession(userId, subject, duration) {
  const { error } = await supabase
    .from("study_sessions")
    .insert({
      user_id: userId,
      subject,
      duration,
      date: new Date().toISOString().split("T")[0]
    });
  
  if (!error) clearUserCache(userId);
  return !error;
}

async function getStudyStats(userId) {
  const { data } = await supabase
    .from("study_sessions")
    .select("duration, date")
    .eq("user_id", userId);
  
  if (!data || data.length === 0) return { total: 0, weekly: 0, today: 0 };
  
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  let total = 0, weekly = 0, todayTotal = 0;
  for (const s of data) {
    total += s.duration;
    if (s.date === today) todayTotal += s.duration;
    if (new Date(s.date) >= weekAgo) weekly += s.duration;
  }
  
  return { total, weekly, today: todayTotal };
}

// ==================== HELPER FUNCTIONS ====================
function getTodayIndex() {
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1;
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
  
  for (const c of classes) {
    if (c.day === today && c.start_time > currentTime) return c;
  }
  
  const tomorrow = today === 6 ? 0 : today + 1;
  for (const c of classes) {
    if (c.day === tomorrow) return c;
  }
  
  return null;
}

function calculateDuration(startTime, endTime) {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

// ==================== VK API ====================
async function sendVkMessage(userId, text, keyboard = null) {
  try {
    const params = new URLSearchParams({
      access_token: VK_TOKEN,
      v: VK_API_VERSION,
      user_id: userId,
      message: text.substring(0, 4096),
      random_id: Math.floor(Math.random() * 1000000)
    });
    
    if (keyboard) params.append("keyboard", keyboard);
    
    const res = await fetch("https://api.vk.com/method/messages.send", {
      method: "POST",
      body: params
    });
    
    const data = await res.json();
    if (data.error) console.error("VK Error:", data.error);
    return data;
  } catch (e) {
    console.error("Send error:", e);
    return null;
  }
}

function getKeyboard(lang) {
  const labels = {
    schedule: lang === "ru" ? "📅 Расписание" : lang === "zh" ? "📅 课程表" : "📅 Schedule",
    today: lang === "ru" ? "📋 Сегодня" : lang === "zh" ? "📋 今天" : "📋 Today",
    tasks: lang === "ru" ? "📝 Задачи" : lang === "zh" ? "📝 任务" : "📝 Tasks",
    stats: lang === "ru" ? "📊 Статистика" : lang === "zh" ? "📊 统计" : "📊 Stats",
    help: lang === "ru" ? "❓ Помощь" : lang === "zh" ? "❓ 帮助" : "❓ Help"
  };
  
  return JSON.stringify({
    one_time: false,
    buttons: [
      [{ action: { type: "text", label: labels.schedule }, color: "primary" }],
      [{ action: { type: "text", label: labels.today }, color: "primary" }],
      [{ action: { type: "text", label: labels.tasks }, color: "positive" }],
      [{ action: { type: "text", label: labels.stats }, color: "secondary" },
       { action: { type: "text", label: labels.help }, color: "secondary" }]
    ]
  });
}

// ==================== FIXED ICS IMPORT ====================
async function importICS(userId, source) {
  console.log(`[ICS] Starting import for user ${userId}`);
  
  try {
    let content;
    
    // Get the ICS content
    if (source.startsWith("http://") || source.startsWith("https://")) {
      console.log(`[ICS] Fetching from URL: ${source}`);
      const res = await fetch(source, { 
        headers: { 
          "User-Agent": "Mozilla/5.0 (compatible; VKBot/1.0)" 
        } 
      });
      if (!res.ok) {
        console.error(`[ICS] HTTP error: ${res.status}`);
        return { success: false, error: `HTTP ${res.status}` };
      }
      content = await res.text();
      console.log(`[ICS] Fetched ${content.length} bytes`);
    } else if (source.startsWith("data:")) {
      console.log(`[ICS] Parsing data URI`);
      const match = source.match(/data:text\/calendar[^,]*,?(.+)/);
      if (match) {
        content = decodeURIComponent(match[1]);
      } else {
        return { success: false, error: "Invalid data URI" };
      }
    } else {
      content = source;
    }
    
    if (!content || !content.includes("BEGIN:VCALENDAR")) {
      console.error(`[ICS] Invalid format. Content starts with: ${content?.substring(0, 100)}`);
      return { success: false, error: "Invalid ICS format - no VCALENDAR found" };
    }
    
    // Parse events
    const events = [];
    const lines = content.split(/\r?\n/);
    let event = null;
    let lineCount = 0;
    
    for (const line of lines) {
      const trimmed = line.trim();
      lineCount++;
      
      if (trimmed === "BEGIN:VEVENT") {
        event = {};
      } else if (trimmed === "END:VEVENT" && event) {
        if (event.SUMMARY && event.DTSTART) {
          events.push(event);
        }
        event = null;
      } else if (event && trimmed.includes(":")) {
        const idx = trimmed.indexOf(":");
        const key = trimmed.substring(0, idx).split(";")[0];
        const value = trimmed.substring(idx + 1);
        event[key] = value;
      }
    }
    
    console.log(`[ICS] Parsed ${events.length} events from ${lineCount} lines`);
    
    if (events.length === 0) {
      return { success: false, error: "No valid events found in ICS file" };
    }
    
    // Get existing classes to check duplicates
    const existingClasses = await getClasses(userId);
    console.log(`[ICS] Existing classes: ${existingClasses.length}`);
    
    let imported = 0;
    let duplicates = 0;
    let errors = 0;
    
    for (const ev of events) {
      try {
        // Parse DTSTART
        let match = ev.DTSTART?.match(/(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?(\d{2})?/);
        if (!match) {
          console.log(`[ICS] Skipping event - no valid DTSTART: ${ev.SUMMARY}`);
          errors++;
          continue;
        }
        
        const year = parseInt(match[1]);
        const month = parseInt(match[2]) - 1;
        const day_of_month = parseInt(match[3]);
        const hour = match[4] ? parseInt(match[4]) : 9;
        const minute = match[5] ? parseInt(match[5]) : 0;
        
        if (isNaN(year) || isNaN(month) || isNaN(day_of_month)) {
          console.log(`[ICS] Invalid date for: ${ev.SUMMARY}`);
          errors++;
          continue;
        }
        
        const startDate = new Date(year, month, day_of_month, hour, minute);
        
        // Convert to day index (0=Mon, 6=Sun)
        let day = startDate.getDay();
        day = day === 0 ? 6 : day - 1;
        
        const startTime = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
        
        // Parse DTEND or default to 1 hour
        let endH = hour + 1;
        let endM = minute;
        const endMatch = ev.DTEND?.match(/(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?/);
        if (endMatch && endMatch[4]) {
          endH = parseInt(endMatch[4]);
          endM = parseInt(endMatch[5]) || 0;
        }
        const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
        
        // Get subject and location
        const subject = (ev.SUMMARY || "Class").replace(/\\,/g, ",").replace(/\\\\/g, "\\").trim();
        const location = (ev.LOCATION || "").replace(/\\,/g, ",").replace(/\\\\/g, "\\").trim();
        
        console.log(`[ICS] Processing: ${subject} | Day ${day} | ${startTime}-${endTime} | ${location}`);
        
        // Check for duplicates
        const isDuplicate = existingClasses.some(c => 
          c.subject === subject && 
          c.day === day && 
          c.start_time === startTime &&
          c.end_time === endTime
        );
        
        if (!isDuplicate) {
          const success = await addClass(userId, subject, day, startTime, endTime, location);
          if (success) {
            imported++;
            console.log(`[ICS] ✅ Imported: ${subject}`);
          } else {
            errors++;
            console.error(`[ICS] ❌ Failed to add: ${subject}`);
          }
        } else {
          duplicates++;
          console.log(`[ICS] ⏭️ Skipped duplicate: ${subject}`);
        }
      } catch (eventError) {
        console.error(`[ICS] Error processing event:`, eventError);
        errors++;
      }
    }
    
    console.log(`[ICS] Import complete: ${imported} new, ${duplicates} skipped, ${errors} errors`);
    
    // Clear cache to ensure fresh data on next query
    clearUserCache(userId);
    
    if (imported === 0 && duplicates === 0) {
      return { success: false, error: "Could not import any classes. Check the ICS format." };
    }
    
    return { 
      success: true, 
      count: imported, 
      total: events.length, 
      duplicates,
      errors 
    };
    
  } catch (e) {
    console.error(`[ICS] Fatal error:`, e);
    return { success: false, error: e.message };
  }
}

// ==================== STUDY TIMER ====================
function startTimer(userId, subject, duration) {
  if (timers.has(userId)) {
    clearTimeout(timers.get(userId).timeout);
    timers.delete(userId);
  }
  
  const timeout = setTimeout(async () => {
    try {
      const lang = await getUserLang(userId);
      await sendVkMessage(userId, t(lang, "timer_end", { subject, duration }));
      await addStudySession(userId, subject, duration);
    } catch (e) {
      console.error("Timer callback error:", e);
    }
    timers.delete(userId);
  }, duration * 60 * 1000);
  
  timers.set(userId, { timeout, subject, duration, startTime: Date.now() });
}

// ==================== MESSAGE PROCESSOR ====================
async function processMessage(userId, text, lang) {
  const msg = text.trim();
  const lower = msg.toLowerCase();
  
  console.log(`[Process] User ${userId}: ${msg.substring(0, 100)}`);
  
  // ===== SET NAME =====
  let nameMatch = msg.match(/^(?:my name is |i'm |i am |call me )([a-zA-Z]{2,20})/i);
  if (!nameMatch) nameMatch = msg.match(/^(?:меня зовут |я )([а-яёА-ЯЁ]{2,20})/i);
  if (!nameMatch) nameMatch = msg.match(/^(?:我叫|我是)([\u4e00-\u9fff]{1,4})/);
  
  if (nameMatch) {
    const name = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1).toLowerCase();
    await updateUser(userId, { name });
    await sendVkMessage(userId, t(lang, "got_name", { name }), getKeyboard(lang));
    return;
  }
  
  // ===== HELP =====
  if (lower === "help" || lower === "/help" || lower === "помощь" || lower === "帮助" || msg.includes("❓")) {
    await sendVkMessage(userId, t(lang, "help"), getKeyboard(lang));
    return;
  }
  
  // ===== SCHEDULE =====
  if (lower === "schedule" || lower === "расписание" || lower === "课程表" || 
      lower === "classes" || lower === "пары" || lower === "课程" || msg.includes("📅")) {
    
    console.log(`[Process] Fetching schedule for user ${userId}`);
    const classes = await getClasses(userId);
    console.log(`[Process] Found ${classes.length} classes`);
    
    if (classes.length === 0) {
      await sendVkMessage(userId, t(lang, "schedule_empty"), getKeyboard(lang));
      return;
    }
    
    const days = T[lang].weekdays;
    let response = t(lang, "schedule_header");
    
    for (const c of classes) {
      response += t(lang, "schedule_item", {
        id: c.id,
        day: days[c.day] || `Day ${c.day}`,
        start: c.start_time,
        end: c.end_time,
        subject: c.subject,
        location: c.location || "—"
      });
    }
    
    response += `\n📊 Total: ${classes.length} classes`;
    
    await sendVkMessage(userId, response, getKeyboard(lang));
    return;
  }
  
  // ===== TODAY =====
  if (lower === "today" || lower === "сегодня" || lower === "今天" || msg.includes("📋")) {
    const classes = await getTodayClasses(userId);
    
    if (classes.length === 0) {
      await sendVkMessage(userId, t(lang, "no_classes_today"), getKeyboard(lang));
      return;
    }
    
    const header = lang === "ru" ? "📋 *Сегодня*" : lang === "zh" ? "📋 *今日课程*" : "📋 *Today's Classes*";
    let response = `${header}\n\n`;
    
    for (const c of classes) {
      response += `⏰ ${c.start_time}-${c.end_time} • *${c.subject}*\n`;
      if (c.location) response += `   📍 ${c.location}\n`;
      response += "\n";
    }
    
    await sendVkMessage(userId, response, getKeyboard(lang));
    return;
  }
  
  // ===== TOMORROW =====
  if (lower === "tomorrow" || lower === "завтра" || lower === "明天") {
    const tomorrow = getTodayIndex() === 6 ? 0 : getTodayIndex() + 1;
    const classes = (await getClasses(userId)).filter(c => c.day === tomorrow);
    
    if (classes.length === 0) {
      await sendVkMessage(userId, t(lang, "no_classes_tomorrow"), getKeyboard(lang));
      return;
    }
    
    const header = lang === "ru" ? "📅 *Завтра*" : lang === "zh" ? "📅 *明日课程*" : "📅 *Tomorrow's Classes*";
    let response = `${header}\n\n`;
    
    for (const c of classes) {
      response += `⏰ ${c.start_time}-${c.end_time} • *${c.subject}*\n`;
      if (c.location) response += `   📍 ${c.location}\n`;
      response += "\n";
    }
    
    await sendVkMessage(userId, response, getKeyboard(lang));
    return;
  }
  
  // ===== NEXT CLASS =====
  if (lower === "next" || lower === "следующая" || lower === "下一节" || lower === "下一个") {
    const next = await getNextClass(userId);
    
    if (!next) {
      await sendVkMessage(userId, t(lang, "no_next_class"), getKeyboard(lang));
      return;
    }
    
    const now = new Date();
    const [h, m] = next.start_time.split(":").map(Number);
    const classTime = new Date();
    classTime.setHours(h, m, 0, 0);
    const mins = Math.max(0, Math.round((classTime - now) / 60000));
    const days = T[lang].weekdays;
    
    const header = lang === "ru" ? "⏰ *Следующая пара*" : lang === "zh" ? "⏰ *下一节课*" : "⏰ *Next Class*";
    let response = `${header}\n\n`;
    response += `📖 ${next.subject}\n`;
    response += `📅 ${days[next.day]} (Day ${next.day})\n`;
    response += `🕐 ${next.start_time} - ${next.end_time}\n`;
    response += `⏱️ ${lang === "ru" ? "Через" : lang === "zh" ? "还有" : "In"} ${mins} ${lang === "ru" ? "мин" : lang === "zh" ? "分钟" : "min"}\n`;
    if (next.location) response += `📍 ${next.location}\n`;
    
    await sendVkMessage(userId, response, getKeyboard(lang));
    return;
  }
  
  // ===== ADD CLASS =====
  if (lower.startsWith("/add")) {
    const parts = msg.split(/\s+/);
    if (parts.length >= 5) {
      const subject = parts[1];
      const day = parseInt(parts[2]);
      const startTime = parts[3];
      const endTime = parts[4];
      const location = parts.slice(5).join(" ");
      
      if (isNaN(day) || day < 0 || day > 6) {
        await sendVkMessage(userId, "❌ Invalid day. Use 0=Mon to 6=Sun", getKeyboard(lang));
        return;
      }
      
      const ok = await addClass(userId, subject, day, startTime, endTime, location);
      if (ok) {
        const days = T[lang].weekdays;
        await sendVkMessage(userId, t(lang, "class_added", {
          subject, day: days[day], start: startTime, end: endTime, location: location || "—"
        }), getKeyboard(lang));
      }
    } else {
      await sendVkMessage(userId, "❌ Format: /add subject day start end [location]", getKeyboard(lang));
    }
    return;
  }
  
  // ===== DELETE CLASS =====
  if (lower.startsWith("/delete") && !lower.includes("task")) {
    const id = parseInt(msg.split(/\s+/)[1]);
    if (!isNaN(id)) {
      const ok = await deleteClass(userId, id);
      await sendVkMessage(userId, t(lang, ok ? "class_deleted" : "class_not_found", { id }), getKeyboard(lang));
    }
    return;
  }
  
  // ===== TASKS =====
  if (lower === "tasks" || lower === "задачи" || lower === "任务" || msg.includes("📝")) {
    const tasks = await getTasks(userId, true);
    
    if (tasks.length === 0) {
      await sendVkMessage(userId, t(lang, "tasks_empty"), getKeyboard(lang));
      return;
    }
    
    let response = t(lang, "tasks_header");
    
    for (const task of tasks) {
      const prio = task.priority || "normal";
      const prioEmoji = prio === "high" ? "🔴" : prio === "medium" ? "🟡" : "🟢";
      response += t(lang, "tasks_item", {
        id: task.id,
        due_date: task.due_date,
        title: task.title,
        priority: `${prioEmoji} ${prio}`
      });
    }
    
    await sendVkMessage(userId, response, getKeyboard(lang));
    return;
  }
  
  // ===== ADD TASK =====
  if (lower.startsWith("/task")) {
    const match = msg.match(/\/task\s+"([^"]+)"\s+(\d{4}-\d{2}-\d{2})(?:\s+(high|medium|low))?/);
    
    if (match) {
      const title = match[1];
      const dueDate = match[2];
      const priority = match[3] || "normal";
      
      await addTask(userId, title, dueDate, priority);
      await sendVkMessage(userId, t(lang, "task_added", { title, due_date: dueDate, priority }), getKeyboard(lang));
    } else {
      await sendVkMessage(userId, '❌ Format: /task "Title" YYYY-MM-DD [high|medium|low]', getKeyboard(lang));
    }
    return;
  }
  
  // ===== COMPLETE TASK =====
  if (lower.startsWith("/complete")) {
    const id = parseInt(msg.split(/\s+/)[1]);
    if (!isNaN(id)) {
      const ok = await completeTask(userId, id);
      await sendVkMessage(userId, t(lang, ok ? "task_completed" : "task_not_found", { id }), getKeyboard(lang));
    }
    return;
  }
  
  // ===== DELETE TASK =====
  if (lower.startsWith("/delete_task")) {
    const id = parseInt(msg.split(/\s+/)[1]);
    if (!isNaN(id)) {
      const ok = await deleteTask(userId, id);
      await sendVkMessage(userId, t(lang, ok ? "task_deleted" : "task_not_found", { id }), getKeyboard(lang));
    }
    return;
  }
  
  // ===== STUDY TIMER =====
  if (lower.startsWith("/study")) {
    const parts = msg.split(/\s+/);
    if (parts.length >= 3) {
      const subject = parts[1];
      const duration = parseInt(parts[2]);
      
      if (!isNaN(duration) && duration >= 5 && duration <= 180) {
        startTimer(userId, subject, duration);
        await sendVkMessage(userId, t(lang, "timer_start", { subject, duration }), getKeyboard(lang));
      } else {
        await sendVkMessage(userId, "❌ Duration: 5-180 minutes", getKeyboard(lang));
      }
    } else {
      await sendVkMessage(userId, "❌ Format: /study subject minutes", getKeyboard(lang));
    }
    return;
  }
  
  if (lower === "/stop") {
    const timer = timers.get(userId);
    if (timer) {
      clearTimeout(timer.timeout);
      timers.delete(userId);
      await sendVkMessage(userId, t(lang, "timer_stop"), getKeyboard(lang));
    } else {
      await sendVkMessage(userId, "❌ No active timer", getKeyboard(lang));
    }
    return;
  }
  
  // ===== REMINDER =====
  if (lower.startsWith("/remind")) {
    const mins = parseInt(msg.split(/\s+/)[1]);
    if (!isNaN(mins) && mins >= 5 && mins <= 120) {
      await updateUser(userId, { reminder_offset: mins });
      await sendVkMessage(userId, t(lang, "remind_set", { minutes: mins }), getKeyboard(lang));
    } else {
      const user = await getUser(userId);
      await sendVkMessage(userId, t(lang, "remind_current", { minutes: user?.reminder_offset || 30 }), getKeyboard(lang));
    }
    return;
  }
  
  // ===== ICS IMPORT =====
  if (lower.startsWith("/ics")) {
    const url = msg.split(/\s+/)[1];
    if (url) {
      await sendVkMessage(userId, t(lang, "import_start"), getKeyboard(lang));
      
      const result = await importICS(userId, url);
      
      if (result.success && result.count > 0) {
        await sendVkMessage(userId, t(lang, "import_done", { 
          count: result.count, 
          total: result.total, 
          duplicates: result.duplicates 
        }), getKeyboard(lang));
        
        // Auto-show the schedule after successful import
        setTimeout(async () => {
          const classes = await getClasses(userId);
          if (classes.length > 0) {
            const days = T[lang].weekdays;
            let schedule = t(lang, "schedule_header");
            for (const c of classes.slice(0, 10)) {
              schedule += t(lang, "schedule_item", {
                id: c.id,
                day: days[c.day] || `Day ${c.day}`,
                start: c.start_time,
                end: c.end_time,
                subject: c.subject,
                location: c.location || "—"
              });
            }
            if (classes.length > 10) {
              schedule += `\n... and ${classes.length - 10} more classes. Type 'Schedule' to see all.`;
            }
            await sendVkMessage(userId, schedule, getKeyboard(lang));
          }
        }, 1000);
        
      } else if (result.success && result.count === 0) {
        await sendVkMessage(userId, `⚠️ All ${result.total} events were duplicates. Your schedule is already up to date!`, getKeyboard(lang));
      } else {
        await sendVkMessage(userId, t(lang, "import_fail", { error: result.error }), getKeyboard(lang));
      }
    } else {
      await sendVkMessage(userId, "❌ Usage: /ics <url>\nExample: /ics https://example.com/calendar.ics", getKeyboard(lang));
    }
    return;
  }
  
  // ===== STATS =====
  if (lower === "stats" || lower === "статистика" || lower === "统计" || msg.includes("📊")) {
    const [classes, tasks, study] = await Promise.all([
      getClasses(userId),
      getTasks(userId, false),
      getStudyStats(userId)
    ]);
    
    const done = tasks.filter(t => t.completed).length;
    
    await sendVkMessage(userId, t(lang, "stats", {
      total_classes: classes.length,
      completed_done: done,
      total_tasks: tasks.length,
      study_min: study.weekly
    }), getKeyboard(lang));
    return;
  }
  
  // ===== DEFAULT =====
  const user = await getUser(userId);
  const name = user?.name;
  
  if (!name || name === "Student") {
    await sendVkMessage(userId, t(lang, "ask_name"));
  } else {
    await sendVkMessage(userId, t(lang, "greeting", { name }), getKeyboard(lang));
  }
}

// ==================== WEBHOOK HANDLER ====================
export async function handler(event) {
  try {
    const body = JSON.parse(event.body);
    
    if (body.type === "confirmation") {
      return {
        statusCode: 200,
        body: process.env.VK_CONFIRMATION_TOKEN || ""
      };
    }
    
    if (body.type === "message_new") {
      const msg = body.object?.message;
      if (!msg) {
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }
      
      const userId = msg.from_id;
      const text = msg.text || "";
      const attachments = msg.attachments || [];
      
      console.log(`[${userId}] ${text.substring(0, 100)}`);
      
      const detectedLang = detectLanguage(text);
      let user = await getUser(userId);
      
      if (user && user.language !== detectedLang && text.length > 0) {
        await updateUser(userId, { language: detectedLang });
        user.language = detectedLang;
      }
      
      const lang = user?.language || detectedLang;
      const userName = user?.name;
      
      // Check for ICS file attachment
      const icsFile = attachments.find(a => 
        a.type === "doc" && a.doc?.title?.toLowerCase().includes(".ics")
      );
      
      if (icsFile) {
        console.log(`[${userId}] ICS file attached: ${icsFile.doc.title}`);
        await sendVkMessage(userId, t(lang, "import_start"), getKeyboard(lang));
        
        try {
          const res = await fetch(icsFile.doc.url);
          const content = await res.text();
          console.log(`[${userId}] ICS file content length: ${content.length}`);
          
          const result = await importICS(userId, `data:text/calendar,${encodeURIComponent(content)}`);
          
          if (result.success && result.count > 0) {
            await sendVkMessage(userId, t(lang, "import_done", { 
              count: result.count, 
              total: result.total, 
              duplicates: result.duplicates 
            }), getKeyboard(lang));
            
            // Auto-show imported classes
            setTimeout(async () => {
              const classes = await getClasses(userId);
              if (classes.length > 0) {
                let schedule = `📅 *Imported Classes (${classes.length} total)*\n\n`;
                const days = T[lang].weekdays;
                for (const c of classes.slice(0, 15)) {
                  schedule += `🆔 ${c.id} | ${days[c.day] || `Day ${c.day}`} | ${c.start_time}-${c.end_time}\n   📖 ${c.subject}\n\n`;
                }
                if (classes.length > 15) {
                  schedule += `... and ${classes.length - 15} more. Type 'Schedule' to see all.`;
                }
                await sendVkMessage(userId, schedule, getKeyboard(lang));
              }
            }, 1000);
            
          } else if (result.count === 0 && result.duplicates > 0) {
            await sendVkMessage(userId, `⚠️ All ${result.total} events were already in your schedule!`, getKeyboard(lang));
          } else {
            await sendVkMessage(userId, t(lang, "import_fail", { error: result.error || "Unknown error" }), getKeyboard(lang));
          }
        } catch (e) {
          console.error("ICS file error:", e);
          await sendVkMessage(userId, t(lang, "import_fail", { error: e.message }), getKeyboard(lang));
        }
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }
      
      // Handle name detection
      if ((!userName || userName === "Student") && text.length > 0 && !text.startsWith("/")) {
        const nameFromMsg = detectName(text);
        if (nameFromMsg) {
          await updateUser(userId, { name: nameFromMsg });
          await sendVkMessage(userId, t(lang, "got_name", { name: nameFromMsg }), getKeyboard(lang));
        } else {
          await sendVkMessage(userId, t(lang, "ask_name"));
        }
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }
      
      await processMessage(userId, text, lang);
      
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }
    
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    
  } catch (error) {
    console.error("Handler error:", error);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }
}

function detectName(text) {
  let match = text.match(/(?:my name is |i'm |i am |call me )([a-zA-Z]{2,20})/i);
  if (match) return match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
  
  match = text.match(/(?:меня зовут |я )([а-яёА-ЯЁ]{2,20})/i);
  if (match) {
    const name = match[1].toLowerCase();
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  
  match = text.match(/(?:我叫|我是)([\u4e00-\u9fff]{1,4})/);
  if (match) return match[1];
  
  return null;
}