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
    
    import_start: "⏳ Downloading and parsing calendar file...",
    import_parsing: "📋 Found {count} events. Importing to your schedule...",
    import_done: "✅ Successfully imported {count} classes!\n\n📊 Summary:\n• Total events: {total}\n• New classes: {count}\n• Duplicates: {duplicates}\n\nType 'Schedule' to view!",
    import_fail: "❌ Import failed: {error}",
    import_no_events: "❌ No valid events found in the file.",
    
    stats: "📊 *Your Stats*\n📚 Classes: {total_classes}\n📝 Tasks: {completed_done}/{total_tasks} done\n⏱️ Study: {study_min} min this week",
    
    unknown: "I don't understand. Type 'Help' to see commands.",
    
    weekdays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
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
    
    import_start: "⏳ Скачиваю и обрабатываю файл календаря...",
    import_parsing: "📋 Найдено {count} событий. Импортирую в расписание...",
    import_done: "✅ Успешно импортировано {count} пар!\n\n📊 Сводка:\n• Всего событий: {total}\n• Новых пар: {count}\n• Дубликатов: {duplicates}\n\nНапиши 'Schedule' чтобы посмотреть!",
    import_fail: "❌ Ошибка импорта: {error}",
    import_no_events: "❌ В файле не найдено событий.",
    
    stats: "📊 *Статистика*\n📚 Пары: {total_classes}\n📝 Задачи: {completed_done}/{total_tasks} выполнено\n⏱️ Учёба: {study_min} мин на неделе",
    
    unknown: "Я не понял. Напиши 'Help' для списка команд.",
    
    weekdays: ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"],
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
    
    import_start: "⏳ 正在下载和解析日历文件...",
    import_parsing: "📋 找到 {count} 个事件。正在导入...",
    import_done: "✅ 成功导入 {count} 节课！\n\n📊 摘要:\n• 总事件: {total}\n• 新增: {count}\n• 重复: {duplicates}\n\n输入 'Schedule' 查看！",
    import_fail: "❌ 导入失败: {error}",
    import_no_events: "❌ 文件中没有找到有效事件。",
    
    stats: "📊 *统计*\n📚 课程: {total_classes}\n📝 任务: {completed_done}/{total_tasks} 已完成\n⏱️ 学习: {study_min} 分钟本周",
    
    unknown: "我不明白。输入'Help'查看命令。",
    
    weekdays: ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"],
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

async function getClasses(userId) {
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
  setCache(`classes_${userId}`, result);
  return result;
}

async function addClass(userId, subject, day, startTime, endTime, location = "") {
  console.log(`[DB] Adding: ${subject} | Day ${day} | ${startTime}-${endTime}`);
  
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
    console.error("[DB] Insert error:", error);
    return false;
  }
  
  console.log(`[DB] Inserted with ID: ${data?.[0]?.id}`);
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

// ==================== FIXED ICS PARSER ====================
function parseICSContent(content) {
  const events = [];
  
  // Normalize line endings
  content = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  
  // Unfold folded lines (lines starting with space/tab are continuations)
  const unfoldedLines = [];
  for (const line of content.split("\n")) {
    if (line.match(/^[ \t]/) && unfoldedLines.length > 0) {
      // This is a continuation of the previous line
      unfoldedLines[unfoldedLines.length - 1] += line.substring(1);
    } else {
      unfoldedLines.push(line);
    }
  }
  
  let currentEvent = null;
  let inEvent = false;
  
  for (const line of unfoldedLines) {
    const trimmed = line.trim();
    
    if (trimmed === "BEGIN:VEVENT") {
      currentEvent = {};
      inEvent = true;
    } else if (trimmed === "END:VEVENT") {
      if (currentEvent && currentEvent.DTSTART) {
        events.push(currentEvent);
      }
      currentEvent = null;
      inEvent = false;
    } else if (inEvent && currentEvent) {
      const colonIndex = trimmed.indexOf(":");
      if (colonIndex > 0) {
        let key = trimmed.substring(0, colonIndex);
        let value = trimmed.substring(colonIndex + 1);
        
        // Remove parameters from key (like DTSTART;VALUE=DATE)
        const semicolonIndex = key.indexOf(";");
        if (semicolonIndex > 0) {
          key = key.substring(0, semicolonIndex);
        }
        
        // Handle escaped characters
        value = value.replace(/\\,/g, ",").replace(/\\n/g, "\n").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
        
        currentEvent[key] = value;
      }
    }
  }
  
  return events;
}

function parseICSTimestamp(ts) {
  if (!ts) return null;
  
  // Try different ICS date formats
  // Format 1: 20240115T090000Z
  let match = ts.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  if (match) {
    return new Date(Date.UTC(
      parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]),
      parseInt(match[4]), parseInt(match[5]), parseInt(match[6])
    ));
  }
  
  // Format 2: 20240115T090000
  match = ts.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (match) {
    return new Date(
      parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]),
      parseInt(match[4]), parseInt(match[5]), parseInt(match[6])
    );
  }
  
  // Format 3: 20240115 (date only)
  match = ts.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (match) {
    return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
  }
  
  return null;
}

// ==================== FIXED ICS IMPORT ====================
async function importICS(userId, source) {
  console.log(`[ICS] Starting import from: ${typeof source === 'string' ? source.substring(0, 100) : 'unknown'}`);
  
  try {
    let content = "";
    
    // Fetch content from URL
    if (source.startsWith("http://") || source.startsWith("https://")) {
      console.log(`[ICS] Fetching URL...`);
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      try {
        const res = await fetch(source, {
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/calendar,text/plain,*/*"
          }
        });
        clearTimeout(timeout);
        
        if (!res.ok) {
          console.error(`[ICS] HTTP ${res.status}: ${res.statusText}`);
          return { success: false, error: `HTTP error ${res.status}. Please check the URL and try again.` };
        }
        
        const contentType = res.headers.get("content-type") || "";
        console.log(`[ICS] Content-Type: ${contentType}`);
        
        content = await res.text();
        console.log(`[ICS] Downloaded ${content.length} bytes`);
        
      } catch (fetchError) {
        clearTimeout(timeout);
        if (fetchError.name === "AbortError") {
          return { success: false, error: "Request timed out. The server took too long to respond." };
        }
        throw fetchError;
      }
    }
    // Parse data URI
    else if (source.startsWith("data:")) {
      console.log(`[ICS] Parsing data URI...`);
      const match = source.match(/data:text\/calendar[^,]*,?(.+)/);
      if (match) {
        content = decodeURIComponent(match[1]);
        console.log(`[ICS] Decoded ${content.length} bytes from data URI`);
      } else {
        return { success: false, error: "Invalid data URI format." };
      }
    }
    // Raw content
    else {
      content = source;
      console.log(`[ICS] Using raw content (${content.length} bytes)`);
    }
    
    // Validate content
    if (!content || content.length < 10) {
      return { success: false, error: "File is empty or too small." };
    }
    
    if (!content.includes("BEGIN:VCALENDAR")) {
      // Check if it's HTML (common error)
      if (content.includes("<!DOCTYPE") || content.includes("<html")) {
        return { success: false, error: "URL returned a webpage, not a calendar file. Make sure you use a direct .ics link." };
      }
      console.error(`[ICS] Content preview: ${content.substring(0, 200)}`);
      return { success: false, error: "Not a valid ICS calendar file (missing VCALENDAR)." };
    }
    
    // Parse events
    const events = parseICSContent(content);
    console.log(`[ICS] Parsed ${events.length} events`);
    
    if (events.length === 0) {
      return { success: false, error: "No calendar events found in the file." };
    }
    
    // Get existing classes for duplicate check
    const existingClasses = await getClasses(userId);
    console.log(`[ICS] Existing classes in DB: ${existingClasses.length}`);
    
    let imported = 0;
    let duplicates = 0;
    let skipped = 0;
    
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      
      try {
        const startDate = parseICSTimestamp(ev.DTSTART);
        if (!startDate || isNaN(startDate.getTime())) {
          console.log(`[ICS] Skipping event ${i+1}: invalid DTSTART="${ev.DTSTART}"`);
          skipped++;
          continue;
        }
        
        // Convert to day index (0=Mon, 6=Sun)
        let day = startDate.getDay();
        day = day === 0 ? 6 : day - 1;
        
        const startTime = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
        
        // Parse end time
        let endDate = null;
        if (ev.DTEND) {
          endDate = parseICSTimestamp(ev.DTEND);
        }
        
        // If no end time, default to 1 hour later
        if (!endDate || isNaN(endDate.getTime())) {
          endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
        }
        
        // If end time is before start time, add 1 hour
        if (endDate <= startDate) {
          endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
        }
        
        const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
        
        // Get subject (clean up)
        let subject = ev.SUMMARY || "Untitled Class";
        subject = subject.replace(/\\,/g, ",").replace(/\\n/g, " ").replace(/\\\\/g, "\\").trim();
        
        if (!subject || subject.length === 0) {
          subject = "Class";
        }
        
        // Get location
        let location = (ev.LOCATION || ev.DESCRIPTION || "").replace(/\\,/g, ",").replace(/\\n/g, " ").trim();
        
        console.log(`[ICS] Event ${i+1}: "${subject}" | Day ${day} | ${startTime}-${endTime} | ${location}`);
        
        // Check for duplicate
        const isDuplicate = existingClasses.some(c => 
          c.subject === subject && 
          c.day === day && 
          c.start_time === startTime
        );
        
        if (isDuplicate) {
          duplicates++;
          console.log(`[ICS]   -> Duplicate, skipped`);
          continue;
        }
        
        // Add to database
        const success = await addClass(userId, subject, day, startTime, endTime, location);
        
        if (success) {
          imported++;
          console.log(`[ICS]   -> Imported successfully`);
        } else {
          skipped++;
          console.log(`[ICS]   -> Database insert failed`);
        }
        
      } catch (eventError) {
        console.error(`[ICS] Error processing event ${i+1}:`, eventError.message);
        skipped++;
      }
    }
    
    console.log(`[ICS] Import complete: ${imported} new, ${duplicates} skipped (dupes), ${skipped} errors`);
    
    // Clear cache to ensure fresh data
    clearUserCache(userId);
    
    return {
      success: imported > 0,
      count: imported,
      total: events.length,
      duplicates: duplicates,
      errors: skipped
    };
    
  } catch (e) {
    console.error(`[ICS] Fatal error:`, e.message);
    console.error(`[ICS] Stack:`, e.stack);
    return { success: false, error: `${e.message}. Please try again or use a different calendar file.` };
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
      lower === "classes" || msg.includes("📅")) {
    const classes = await getClasses(userId);
    
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
    
    response += `📊 Total: ${classes.length} classes`;
    
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
  if (lower === "next" || lower === "следующая" || lower === "下一节") {
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
    response += `📅 ${days[next.day]}\n`;
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
      } else {
        await sendVkMessage(userId, "❌ Error adding class. Please try again.", getKeyboard(lang));
      }
    } else {
      await sendVkMessage(userId, "❌ Format: /add subject day start end [location]\nExample: /add Math 1 10:30 12:05 Room_101", getKeyboard(lang));
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
      await sendVkMessage(userId, '❌ Format: /task "Title" YYYY-MM-DD [high|medium|low]\nExample: /task "Final Project" 2025-12-20 high', getKeyboard(lang));
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
      await sendVkMessage(userId, "❌ Format: /study subject minutes\nExample: /study Math 30", getKeyboard(lang));
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
  
  // ===== ICS IMPORT VIA LINK =====
  if (lower.startsWith("/ics")) {
    const url = msg.split(/\s+/)[1];
    
    if (!url) {
      await sendVkMessage(userId, "❌ Usage: /ics <url>\nExample: /ics https://example.com/calendar.ics\n\nOr attach a .ics file directly.", getKeyboard(lang));
      return;
    }
    
    // Validate URL
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      await sendVkMessage(userId, "❌ Please provide a valid URL starting with http:// or https://", getKeyboard(lang));
      return;
    }
    
    await sendVkMessage(userId, t(lang, "import_start"), getKeyboard(lang));
    
    const result = await importICS(userId, url);
    
    if (result.success) {
      await sendVkMessage(userId, t(lang, "import_done", {
        count: result.count,
        total: result.total,
        duplicates: result.duplicates
      }), getKeyboard(lang));
      
      // Auto-show schedule after import
      setTimeout(async () => {
        const classes = await getClasses(userId);
        if (classes.length > 0) {
          const days = T[lang].weekdays;
          let schedule = "📅 *Your Updated Schedule*\n\n";
          for (const c of classes.slice(0, 20)) {
            schedule += `🆔 ${c.id} | ${days[c.day]} | ${c.start_time}-${c.end_time}\n   📖 ${c.subject}\n\n`;
          }
          if (classes.length > 20) {
            schedule += `... and ${classes.length - 20} more. Type 'Schedule' for full view.`;
          }
          await sendVkMessage(userId, schedule, getKeyboard(lang));
        }
      }, 1500);
      
    } else {
      await sendVkMessage(userId, t(lang, "import_fail", { error: result.error }), getKeyboard(lang));
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
    
    // VK confirmation
    if (body.type === "confirmation") {
      return {
        statusCode: 200,
        body: process.env.VK_CONFIRMATION_TOKEN || ""
      };
    }
    
    // New message
    if (body.type === "message_new") {
      const msg = body.object?.message;
      if (!msg) {
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }
      
      const userId = msg.from_id;
      const text = msg.text || "";
      const attachments = msg.attachments || [];
      
      console.log(`[${userId}] ${text.substring(0, 100)}`);
      
      // Detect language
      const detectedLang = detectLanguage(text);
      let user = await getUser(userId);
      
      if (user && user.language !== detectedLang && text.length > 0) {
        await updateUser(userId, { language: detectedLang });
        user.language = detectedLang;
      }
      
      const lang = user?.language || detectedLang;
      const userName = user?.name;
      
      // ===== ICS FILE ATTACHMENT =====
      const icsFile = attachments.find(a => 
        a.type === "doc" && (
          a.doc?.title?.toLowerCase().includes(".ics") ||
          a.doc?.ext === "ics"
        )
      );
      
      if (icsFile) {
        console.log(`[${userId}] ICS file: ${icsFile.doc.title} (${icsFile.doc.size} bytes)`);
        
        await sendVkMessage(userId, t(lang, "import_start"), getKeyboard(lang));
        
        try {
          const res = await fetch(icsFile.doc.url);
          if (!res.ok) {
            throw new Error(`Failed to download file (HTTP ${res.status})`);
          }
          
          const content = await res.text();
          console.log(`[${userId}] File content: ${content.length} bytes`);
          
          const result = await importICS(userId, `data:text/calendar,${encodeURIComponent(content)}`);
          
          if (result.success) {
            await sendVkMessage(userId, t(lang, "import_done", {
              count: result.count,
              total: result.total,
              duplicates: result.duplicates
            }), getKeyboard(lang));
            
            // Show schedule
            setTimeout(async () => {
              const classes = await getClasses(userId);
              if (classes.length > 0) {
                let schedule = "📅 *Imported Classes*\n\n";
                const days = T[lang].weekdays;
                for (const c of classes.slice(0, 20)) {
                  schedule += `🆔 ${c.id} | ${days[c.day]} | ${c.start_time}-${c.end_time}\n   📖 ${c.subject}\n\n`;
                }
                await sendVkMessage(userId, schedule, getKeyboard(lang));
              }
            }, 1000);
            
          } else {
            await sendVkMessage(userId, t(lang, "import_fail", { error: result.error }), getKeyboard(lang));
          }
        } catch (e) {
          console.error("File import error:", e);
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
      
      // Process message
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
  // English
  let match = text.match(/(?:my name is |i'm |i am |call me )([a-zA-Z]{2,20})/i);
  if (match) return match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
  
  // Russian
  match = text.match(/(?:меня зовут |я )([а-яёА-ЯЁ]{2,20})/i);
  if (match) {
    const name = match[1].toLowerCase();
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  
  // Chinese
  match = text.match(/(?:我叫|我是)([\u4e00-\u9fff]{1,4})/);
  if (match) return match[1];
  
  return null;
}