import { createClient } from "@supabase/supabase-js";

// ==================== CONFIGURATION ====================
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const VK_API_VERSION = "5.199";

// Optimized cache with LRU-like behavior
class TimeAwareCache {
  constructor(maxSize = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = {
      user: 600000,
      classes: 300000,
      tasks: 120000,
      stats: 60000
    };
  }

  get(key, type) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() - item.time > (this.ttl[type] || this.ttl.user)) {
      this.cache.delete(key);
      return null;
    }
    return item.data;
  }

  set(key, data, type) {
    if (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value;
      this.cache.delete(oldest);
    }
    this.cache.set(key, { data, time: Date.now(), type });
  }

  clearUserCache(userId) {
    const prefix = `user_${userId}`;
    for (const key of this.cache.keys()) {
      if (key.includes(prefix)) this.cache.delete(key);
    }
  }
}

const cache = new TimeAwareCache();
const timers = new Map();
const userSessions = new Map();

// ==================== OPTIMIZED LANGUAGE SYSTEM ====================
const LANG_PATTERNS = {
  ru: /[а-яё]/i,
  zh: /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/
};

const detectLanguage = (text) => {
  if (!text) return "en";
  if (LANG_PATTERNS.ru.test(text)) return "ru";
  if (LANG_PATTERNS.zh.test(text)) return "zh";
  return "en";
};

// Compact translation database
const T = {
  en: {
    ask_name: "👋 Hello! What's your name?",
    got_name: "🎉 Nice to meet you, {name}! Type 'Help' to see what I can do.",
    greeting: "👋 Hey {name}! Ready to be productive? Type 'Help' for commands.",
    help: `🤖 *TIME MANAGER*\n\n📅 Schedule • Today • Tomorrow • Next\n/task • /complete • /delete_task\n/study • /stop • /ics • Stats`,
    schedule_empty: "📭 Schedule empty. Use /add or attach .ics file",
    tasks_empty: "✅ No pending tasks! 🎉",
    no_classes_today: "🎉 No classes today!",
    no_classes_tomorrow: "🎉 No classes tomorrow!",
    no_next_class: "🎉 No upcoming classes in 24h!",
    class_added: "✅ Added: {subject} on {day} {start}-{end}",
    class_deleted: "✅ Class {id} deleted",
    class_not_found: "❌ Class #{id} not found",
    task_added: "✅ Task: {title} due {due_date}",
    task_completed: "✅ Task #{id} completed! 🎉",
    task_deleted: "🗑️ Task #{id} deleted",
    task_not_found: "❌ Task #{id} not found",
    timer_start: "⏱️ Focus: {subject} for {duration}min",
    timer_end: "⏰ Great work on {subject}! {duration}min",
    timer_stop: "❌ Stopped {subject} after {elapsed}min",
    import_start: "⏳ Importing calendar...",
    import_done: "✅ Imported {count} classes ({duplicates} duplicates)",
    import_fail: "❌ Import failed: {error}",
    stats: "📊 {total_classes} classes • {completed_done}/{total_tasks} tasks • {total_study}h study",
    weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  },
  ru: {
    ask_name: "👋 Привет! Как тебя зовут?",
    got_name: "🎉 Приятно познакомиться, {name}! Напиши 'Help'",
    greeting: "👋 Привет {name}! Напиши 'Help'",
    help: "🤖 *Помощь*\n\nSchedule • Today • Next\n/task • /complete • /study\n/ics • Stats",
    schedule_empty: "📭 Расписание пусто",
    tasks_empty: "✅ Нет задач! 🎉",
    no_classes_today: "🎉 Сегодня нет пар!",
    no_classes_tomorrow: "🎉 Завтра нет пар!",
    no_next_class: "🎉 Нет пар в ближайшие 24ч",
    class_added: "✅ Добавлено: {subject} в {day} {start}-{end}",
    class_deleted: "✅ Пара {id} удалена",
    class_not_found: "❌ Пара #{id} не найдена",
    task_added: "✅ Задача: {title} до {due_date}",
    task_completed: "✅ Задача #{id} выполнена! 🎉",
    task_deleted: "🗑️ Задача #{id} удалена",
    task_not_found: "❌ Задача #{id} не найдена",
    timer_start: "⏱️ Фокус: {subject} {duration}мин",
    timer_end: "⏰ Отлично! {subject} {duration}мин",
    timer_stop: "❌ Остановлен {subject} ({elapsed}мин)",
    import_start: "⏳ Импорт...",
    import_done: "✅ Импортировано {count} пар ({duplicates} дублей)",
    import_fail: "❌ Ошибка: {error}",
    stats: "📊 {total_classes} пар • {completed_done}/{total_tasks} задач • {total_study}ч учёбы",
    weekdays: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
  },
  zh: {
    ask_name: "👋 你好！你叫什么名字？",
    got_name: "🎉 你好 {name}！输入'Help'查看功能",
    greeting: "👋 你好 {name}！输入'Help'",
    help: "🤖 *帮助*\n\nSchedule • Today • Next\n/task • /complete • /study",
    schedule_empty: "📭 课程表为空",
    tasks_empty: "✅ 没有待办任务！",
    no_classes_today: "🎉 今天没课！",
    no_classes_tomorrow: "🎉 明天没课！",
    no_next_class: "🎉 未来24小时无课",
    class_added: "✅ 已添加：{subject} {start}-{end}",
    class_deleted: "✅ 课程 {id} 已删除",
    class_not_found: "❌ 未找到课程 #{id}",
    task_added: "✅ 任务：{title} 截止 {due_date}",
    task_completed: "✅ 任务 #{id} 已完成！",
    task_deleted: "🗑️ 任务 #{id} 已删除",
    task_not_found: "❌ 未找到任务 #{id}",
    timer_start: "⏱️ 专注：{subject} {duration}分钟",
    timer_end: "⏰ 完成！{subject} {duration}分钟",
    timer_stop: "❌ 停止 {subject}（{elapsed}分钟）",
    import_start: "⏳ 导入中...",
    import_done: "✅ 导入 {count} 门课程",
    import_fail: "❌ 导入失败：{error}",
    stats: "📊 {total_classes}门课 • {completed_done}/{total_tasks}任务 • {total_study}小时",
    weekdays: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
  }
};

const t = (lang, key, params = {}) => {
  let text = T[lang]?.[key] || T.en[key] || key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(`{${k}}`, v);
  }
  return text;
};

// ==================== OPTIMIZED DATABASE FUNCTIONS ====================
const getUser = async (userId) => {
  const cached = cache.get(`user_${userId}`, 'user');
  if (cached) return cached;

  let { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("vk_id", userId)
    .single();

  if (!user) {
    const { data } = await supabase
      .from("users")
      .insert({
        vk_id: userId,
        language: "en",
        reminder_offset: 30,
        total_focus_minutes: 0,
        tasks_completed: 0
      })
      .select()
      .single();
    user = data;
  }

  if (user) cache.set(`user_${userId}`, user, 'user');
  return user;
};

const updateUser = async (userId, updates) => {
  const { error } = await supabase
    .from("users")
    .update(updates)
    .eq("vk_id", userId);
  
  if (!error) cache.clearUserCache(userId);
  return !error;
};

// Batch database operations
const getClasses = async (userId) => {
  const cached = cache.get(`classes_${userId}`, 'classes');
  if (cached) return cached;

  const { data } = await supabase
    .from("schedule")
    .select("id,subject,day,start_time,end_time,location")
    .eq("user_id", userId)
    .order("day")
    .order("start_time");

  const classes = data || [];
  cache.set(`classes_${userId}`, classes, 'classes');
  return classes;
};

const getTasks = async (userId, onlyPending = true) => {
  const cacheKey = `tasks_${userId}_${onlyPending}`;
  const cached = cache.get(cacheKey, 'tasks');
  if (cached) return cached;

  let query = supabase
    .from("tasks")
    .select("id,title,due_date,priority,completed")
    .eq("user_id", userId);
  
  if (onlyPending) query = query.eq("completed", false);
  
  const { data } = await query.order("due_date");
  const tasks = data || [];
  cache.set(cacheKey, tasks, 'tasks');
  return tasks;
};

// Optimized batch insert for ICS import
const batchInsertClasses = async (userId, classes) => {
  if (classes.length === 0) return 0;
  
  const { error } = await supabase
    .from("schedule")
    .insert(classes.map(c => ({ ...c, user_id: userId })));
  
  if (!error) {
    cache.clearUserCache(userId);
    return classes.length;
  }
  return 0;
};

// ==================== HELPER FUNCTIONS ====================
const getDayIndex = () => {
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1;
};

const getCurrentTime = () => {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
};

const filterClassesByDay = (classes, dayIndex) => 
  classes.filter(c => c.day === dayIndex);

const getNextClass = async (userId) => {
  const classes = await getClasses(userId);
  const today = getDayIndex();
  const currentTime = getCurrentTime();
  
  // Today's upcoming classes
  const todayClasses = filterClassesByDay(classes, today);
  const nextToday = todayClasses.find(c => c.start_time > currentTime);
  if (nextToday) return nextToday;
  
  // Tomorrow's first class
  const tomorrow = today === 6 ? 0 : today + 1;
  const tomorrowClasses = filterClassesByDay(classes, tomorrow);
  return tomorrowClasses[0] || null;
};

// ==================== VK API WITH RETRY ====================
const sendVkMessage = async (userId, text, keyboard = null) => {
  const maxRetries = 3;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const params = new URLSearchParams({
        access_token: process.env.VK_TOKEN,
        v: VK_API_VERSION,
        user_id: userId,
        message: text.substring(0, 4096),
        random_id: Date.now() + Math.random()
      });
      
      if (keyboard) params.append("keyboard", keyboard);
      
      const res = await fetch("https://api.vk.com/method/messages.send", {
        method: "POST",
        body: params
      });
      
      const data = await res.json();
      if (data.error?.error_code !== 9) return data; // Not flood wait
      
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    } catch (e) {
      if (i === maxRetries - 1) console.error("Send error:", e);
    }
  }
  return null;
};

const keyboardCache = new Map();
const getKeyboard = (lang) => {
  if (keyboardCache.has(lang)) return keyboardCache.get(lang);
  
  const labels = {
    schedule: { en: "📅 Schedule", ru: "📅 Расписание", zh: "📅 课程表" },
    today: { en: "📋 Today", ru: "📋 Сегодня", zh: "📋 今天" },
    tasks: { en: "📝 Tasks", ru: "📝 Задачи", zh: "📝 任务" },
    next: { en: "⏰ Next", ru: "⏰ Следующая", zh: "⏰ 下节课" },
    stats: { en: "📊 Stats", ru: "📊 Статистика", zh: "📊 统计" },
    help: { en: "❓ Help", ru: "❓ Помощь", zh: "❓ 帮助" }
  };
  
  const keyboard = JSON.stringify({
    one_time: false,
    buttons: [
      [{ action: { type: "text", label: labels.schedule[lang] }, color: "primary" }],
      [{ action: { type: "text", label: labels.today[lang] }, color: "primary" },
       { action: { type: "text", label: labels.next[lang] }, color: "positive" }],
      [{ action: { type: "text", label: labels.tasks[lang] }, color: "positive" }],
      [{ action: { type: "text", label: labels.stats[lang] }, color: "secondary" },
       { action: { type: "text", label: labels.help[lang] }, color: "secondary" }]
    ]
  });
  
  keyboardCache.set(lang, keyboard);
  return keyboard;
};

// ==================== OPTIMIZED ICS IMPORT ====================
const parseICS = (icsContent) => {
  const events = [];
  const veventRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
  const fieldRegex = /^(SUMMARY|DTSTART|DTEND|LOCATION)[^:]*:(.+)$/gm;
  
  let match;
  while ((match = veventRegex.exec(icsContent)) !== null) {
    const block = match[1];
    const event = {};
    
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(block)) !== null) {
      const [, key, value] = fieldMatch;
      event[key] = value.trim();
    }
    
    if (event.SUMMARY && event.DTSTART) {
      events.push(event);
    }
  }
  
  return events;
};

const parseDateTime = (dtstr) => {
  const match = dtstr.match(/(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?/);
  if (!match) return null;
  
  const [, year, month, day, hour = "09", minute = "00"] = match;
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  let weekday = date.getUTCDay();
  weekday = weekday === 0 ? 6 : weekday - 1;
  
  return {
    weekday,
    startTime: `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`,
    endTime: `${(parseInt(hour) + 1).toString().padStart(2, '0')}:${minute.padStart(2, '0')}`
  };
};

const importICS = async (userId, source) => {
  try {
    let icsContent;
    
    if (source.startsWith("http")) {
      const response = await fetch(source);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      icsContent = await response.text();
    } else {
      icsContent = source;
    }
    
    const events = parseICS(icsContent);
    if (events.length === 0) throw new Error("No events found");
    
    const existingClasses = await getClasses(userId);
    const existingSet = new Set(
      existingClasses.map(c => `${c.subject}|${c.day}|${c.start_time}`)
    );
    
    const newClasses = [];
    for (const event of events) {
      const dateInfo = parseDateTime(event.DTSTART);
      if (!dateInfo) continue;
      
      const { weekday, startTime, endTime } = dateInfo;
      const subject = event.SUMMARY.replace(/\\,/g, ",").substring(0, 100);
      const location = (event.LOCATION || "").replace(/\\,/g, ",").substring(0, 200);
      
      const key = `${subject}|${weekday}|${startTime}`;
      if (!existingSet.has(key)) {
        newClasses.push({
          subject,
          day: weekday,
          start_time: startTime,
          end_time: endTime,
          location
        });
        existingSet.add(key);
      }
    }
    
    const imported = await batchInsertClasses(userId, newClasses);
    return { success: true, count: imported, duplicates: events.length - imported };
    
  } catch (error) {
    console.error("Import error:", error);
    return { success: false, error: error.message };
  }
};

// ==================== STUDY TIMER ====================
const startTimer = (userId, subject, duration, sendVkMessage, lang) => {
  if (timers.has(userId)) {
    clearTimeout(timers.get(userId).timeout);
  }
  
  const startTime = Date.now();
  const timeout = setTimeout(async () => {
    await sendVkMessage(userId, t(lang, "timer_end", { subject, duration }));
    await supabase.from("study_sessions").insert({
      user_id: userId,
      subject,
      duration,
      date: new Date().toISOString().split("T")[0]
    });
    timers.delete(userId);
  }, duration * 60 * 1000);
  
  timers.set(userId, { timeout, subject, duration, startTime });
};

// ==================== COMMAND HANDLERS ====================
const commands = {
  "/add": async (msg, userId, lang, send) => {
    const parts = msg.split(/\s+/);
    if (parts.length < 5) {
      await send(t(lang, "class_not_found", { id: "Invalid format. Use: /add subject day start end [location]" }));
      return;
    }
    
    const [, subject, day, startTime, endTime, ...locationParts] = parts;
    const dayNum = parseInt(day);
    if (isNaN(dayNum) || dayNum < 0 || dayNum > 6) {
      await send("❌ Day must be 0-6 (0=Monday)");
      return;
    }
    
    const { error } = await supabase.from("schedule").insert({
      user_id: userId, subject, day: dayNum,
      start_time: startTime, end_time: endTime,
      location: locationParts.join(" ")
    });
    
    if (!error) {
      cache.clearUserCache(userId);
      await send(t(lang, "class_added", { subject, day: T[lang].weekdays[dayNum], start: startTime, end: endTime }));
    }
  },
  
  "/task": async (msg, userId, lang, send) => {
    const match = msg.match(/\/task\s+"([^"]+)"\s+(\d{4}-\d{2}-\d{2})(?:\s+(high|medium|low))?/);
    if (!match) {
      await send('❌ Format: /task "Title" YYYY-MM-DD [high|medium|low]');
      return;
    }
    
    const [, title, dueDate, priority = "normal"] = match;
    const { error } = await supabase.from("tasks").insert({
      user_id: userId, title, due_date: dueDate, priority, completed: false
    });
    
    if (!error) {
      cache.clearUserCache(userId);
      await send(t(lang, "task_added", { title, due_date: dueDate }));
    }
  },
  
  "/study": async (msg, userId, lang, send) => {
    const parts = msg.split(/\s+/);
    if (parts.length < 3) {
      await send("❌ Format: /study subject minutes (5-180)");
      return;
    }
    
    const subject = parts[1];
    const duration = parseInt(parts[2]);
    if (isNaN(duration) || duration < 5 || duration > 180) {
      await send("❌ Duration must be 5-180 minutes");
      return;
    }
    
    startTimer(userId, subject, duration, send, lang);
    await send(t(lang, "timer_start", { subject, duration }));
  },
  
  "/ics": async (msg, userId, lang, send) => {
    const url = msg.split(/\s+/)[1];
    if (!url) {
      await send("❌ Usage: /ics <url>");
      return;
    }
    
    await send(t(lang, "import_start"));
    const result = await importICS(userId, url);
    
    if (result.success) {
      await send(t(lang, "import_done", { count: result.count, duplicates: result.duplicates }));
    } else {
      await send(t(lang, "import_fail", { error: result.error }));
    }
  }
};

// ==================== MAIN PROCESSOR ====================
const processMessage = async (userId, text, userLang) => {
  const msg = text.trim();
  const lower = msg.toLowerCase();
  const send = (msg) => sendVkMessage(userId, msg, getKeyboard(userLang));
  
  // Help
  if (["help", "/help", "помощь", "帮助"].includes(lower)) {
    await send(t(userLang, "help"));
    return;
  }
  
  // Schedule display
  if (["schedule", "расписание", "课程表"].includes(lower)) {
    const classes = await getClasses(userId);
    if (classes.length === 0) {
      await send(t(userLang, "schedule_empty"));
      return;
    }
    
    const byDay = classes.reduce((acc, c) => {
      acc[c.day] = acc[c.day] || [];
      acc[c.day].push(c);
      return acc;
    }, {});
    
    let response = "📅 *Schedule*\n\n";
    for (let d = 0; d < 7; d++) {
      if (byDay[d]) {
        response += `*${T[userLang].weekdays[d]}*\n`;
        for (const c of byDay[d]) {
          response += `  ${c.start_time}-${c.end_time} • ${c.subject}\n`;
        }
        response += "\n";
      }
    }
    await send(response);
    return;
  }
  
  // Today
  if (["today", "сегодня", "今天"].includes(lower)) {
    const classes = await getClasses(userId);
    const today = getDayIndex();
    const todayClasses = filterClassesByDay(classes, today);
    
    if (todayClasses.length === 0) {
      await send(t(userLang, "no_classes_today"));
      return;
    }
    
    const currentTime = getCurrentTime();
    let response = "📋 *Today*\n\n";
    for (const c of todayClasses) {
      const status = c.start_time <= currentTime && c.end_time >= currentTime ? "🟢" : "⏳";
      response += `${status} ${c.start_time}-${c.end_time} • ${c.subject}\n`;
    }
    await send(response);
    return;
  }
  
  // Tasks
  if (["tasks", "задачи", "任务"].includes(lower)) {
    const tasks = await getTasks(userId, true);
    if (tasks.length === 0) {
      await send(t(userLang, "tasks_empty"));
      return;
    }
    
    let response = `📝 *Tasks* (${tasks.length})\n\n`;
    for (const t of tasks.slice(0, 10)) {
      response += `#${t.id} • ${t.title} • Due ${t.due_date}\n`;
    }
    await send(response);
    return;
  }
  
  // Next class
  if (["next", "следующая", "下一个"].includes(lower)) {
    const next = await getNextClass(userId);
    if (!next) {
      await send(t(userLang, "no_next_class"));
      return;
    }
    
    const now = new Date();
    const [h, m] = next.start_time.split(":").map(Number);
    const classTime = new Date();
    classTime.setHours(h, m, 0, 0);
    const mins = Math.max(0, Math.round((classTime - now) / 60000));
    
    await send(`⏰ *Next Class*\n📖 ${next.subject}\n🕐 ${next.start_time}-${next.end_time}\n⏱️ In ${mins} min`);
    return;
  }
  
  // Stats
  if (["stats", "статистика", "统计"].includes(lower)) {
    const [classes, tasks] = await Promise.all([
      getClasses(userId),
      getTasks(userId, false)
    ]);
    const completed = tasks.filter(t => t.completed).length;
    await send(t(userLang, "stats", {
      total_classes: classes.length,
      completed_done: completed,
      total_tasks: tasks.length,
      total_study: "0"
    }));
    return;
  }
  
  // Commands
  for (const [cmd, handler] of Object.entries(commands)) {
    if (lower.startsWith(cmd)) {
      await handler(msg, userId, userLang, send);
      return;
    }
  }
  
  // Delete class/task
  if (lower.startsWith("/delete")) {
    const id = parseInt(msg.split(/\s+/)[1]);
    if (!isNaN(id)) {
      const { error } = await supabase.from("schedule").delete().eq("id", id).eq("user_id", userId);
      if (!error) cache.clearUserCache(userId);
      await send(t(userLang, error ? "class_not_found" : "class_deleted", { id }));
    }
    return;
  }
  
  if (lower.startsWith("/complete")) {
    const id = parseInt(msg.split(/\s+/)[1]);
    if (!isNaN(id)) {
      const { error } = await supabase.from("tasks").update({ completed: true }).eq("id", id).eq("user_id", userId);
      if (!error) cache.clearUserCache(userId);
      await send(t(userLang, error ? "task_not_found" : "task_completed", { id }));
    }
    return;
  }
  
  if (lower === "/stop") {
    const timer = timers.get(userId);
    if (timer) {
      clearTimeout(timer.timeout);
      const elapsed = Math.round((Date.now() - timer.startTime) / 60000);
      timers.delete(userId);
      await send(t(userLang, "timer_stop", { subject: timer.subject, elapsed }));
    }
    return;
  }
  
  // Default greeting
  const user = await getUser(userId);
  if (!user?.name) {
    await send(t(userLang, "ask_name"));
  } else {
    await send(t(userLang, "greeting", { name: user.name }));
  }
};

// ==================== WEBHOOK HANDLER ====================
export async function handler(event) {
  try {
    const body = JSON.parse(event.body);
    
    if (body.type === "confirmation") {
      return { statusCode: 200, body: process.env.VK_CONFIRMATION_TOKEN || "" };
    }
    
    if (body.type === "message_new") {
      const msg = body.object?.message;
      if (!msg) return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      
      const userId = msg.from_id;
      const text = msg.text || "";
      const attachments = msg.attachments || [];
      
      let user = await getUser(userId);
      const detectedLang = detectLanguage(text);
      
      if (user && !user.language && detectedLang !== "en") {
        await updateUser(userId, { language: detectedLang });
        user.language = detectedLang;
      }
      
      const lang = user?.language || detectedLang;
      
      // Handle ICS file attachment
      const icsFile = attachments.find(a => 
        a.type === "doc" && (a.doc?.title?.endsWith(".ics") || a.doc?.ext === "ics")
      );
      
      if (icsFile) {
        await sendVkMessage(userId, t(lang, "import_start"), getKeyboard(lang));
        
        try {
          const response = await fetch(icsFile.doc.url);
          const content = await response.text();
          const result = await importICS(userId, content);
          
          if (result.success) {
            await sendVkMessage(userId, t(lang, "import_done", { 
              count: result.count, 
              duplicates: result.duplicates 
            }), getKeyboard(lang));
          } else {
            await sendVkMessage(userId, t(lang, "import_fail", { error: result.error }), getKeyboard(lang));
          }
        } catch (e) {
          await sendVkMessage(userId, t(lang, "import_fail", { error: e.message }), getKeyboard(lang));
        }
        
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }
      
      await processMessage(userId, text, lang);
    }
    
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    
  } catch (error) {
    console.error("Handler error:", error);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }
}