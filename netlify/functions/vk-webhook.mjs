import { createClient } from "@supabase/supabase-js";

// ==================== CONFIGURATION ====================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const VK_TOKEN = process.env.VK_TOKEN;
const VK_API_VERSION = "5.199";

const cache = new Map();
const CACHE_TTL = {
  user: 600000,
  classes: 300000,
  tasks: 120000,
  stats: 60000
};

function getCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  const ttl = CACHE_TTL[item.type] || CACHE_TTL.user;
  if (Date.now() - item.time < ttl) return item.data;
  cache.delete(key);
  return null;
}

function setCache(key, data, type = 'user') {
  cache.set(key, { data, time: Date.now(), type });
}

function clearUserCache(userId) {
  for (const key of cache.keys()) {
    if (key.includes(userId)) cache.delete(key);
  }
}

const timers = new Map();
const userSessions = new Map();

// ==================== LANGUAGE SYSTEM ====================
function detectLanguage(text) {
  if (!text) return "en";
  if (/[а-яёА-ЯЁ]/.test(text)) return "ru";
  if (/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(text)) return "zh";
  return "en";
}

const T = {
  en: {
    ask_name: "👋 Hello! I'm your intelligent time management assistant. What's your name?",
    got_name: "🎉 Nice to meet you, {name}! I'll help you manage your time, track your schedule, and boost your productivity! Type 'Help' to see everything I can do.",
    greeting: "👋 Hey {name}! Ready to make today productive? I remember your schedule and tasks. Type 'Help' for commands.",
    help: `🤖 *YOUR INTELLIGENT TIME MANAGER*

📅 *SMART SCHEDULE*
• Schedule - View all classes
• Today - What's happening today
• Tomorrow - Tomorrow's classes
• Next - Your next class with countdown
• /add subject day start end [location] - Add class
• /delete id - Delete class

📝 *TASK MANAGEMENT*
• Tasks - View pending tasks
• /task "title" YYYY-MM-DD [high|medium|low] - Add task
• /complete id - Mark task as done
• /delete_task id - Delete task

⏱️ *FOCUS TIMER*
• /study subject minutes - Start focused session
• /stop - Stop current timer

📊 *INSIGHTS*
• Stats - Complete productivity report

📥 *IMPORT*
• /ics url - Import from link
• Attach .ics file directly

💡 *PRO TIPS*
• I learn your routine over time
• Ask me "What's next?" anytime`,
    schedule_empty: "📭 Your schedule is empty. Let's build it!\n\nUse /add to manually add classes\nUse /ics to import from Google Calendar\nOr attach an .ics file directly",
    tasks_empty: "✅ No pending tasks! Great job staying on top of things! 🎉",
    no_classes_today: "🎉 No classes today! Perfect day for catching up on tasks!",
    no_classes_tomorrow: "🎉 No classes tomorrow! Time to plan something productive or relax!",
    no_next_class: "🎉 No upcoming classes in the next 24 hours!",
    class_added: "✅ Class added!\n📖 {subject}\n📅 {day}\n⏰ {start} - {end}\n⏱️ {duration} min\n📍 {location}",
    class_deleted: "✅ Class {id} deleted!",
    class_not_found: "❌ Class #{id} not found.",
    task_added: "✅ Task created!\n📝 {title}\n📅 Due: {due_date} ({days_until} days left)\n🎯 Priority: {priority}",
    task_completed: "✅ Task #{id} completed! 🎉",
    task_deleted: "🗑️ Task #{id} removed.",
    task_not_found: "❌ Task #{id} not found.",
    timer_start: "⏱️ *Focus Session Started!*\n📖 {subject}\n⏰ {duration} minutes\n🎯 Ends at: {end_time}",
    timer_end: "⏰ *Great Work!*\n📖 {subject}\n⏱️ {duration} minutes",
    timer_stop: "❌ Timer stopped.\n📖 {subject}\n⏱️ {elapsed} minutes",
    remind_set: "⏰ Reminder set to {minutes} minutes before class.",
    quiet_mode_on: "🔕 Quiet mode activated for 2 hours.",
    quiet_mode_off: "🔔 Notifications resumed!",
    import_start: "⏳ Analyzing your calendar...",
    import_done: "✅ Calendar imported!\n📊 New classes: {count}\n🔄 Duplicates skipped: {duplicates}",
    import_fail: "❌ Import failed: {error}\n\n💡 Try downloading the .ics file and attaching it directly.",
    import_schedule_header: "📅 *Your Schedule*\n\n",
    stats: "📊 *YOUR STATS*\n\n📚 Classes: {total_classes}\n📝 Tasks completed: {completed_done}/{total_tasks}\n⏱️ Study time: {total_study}h",
    weekdays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
  },
  ru: {
    ask_name: "👋 Привет! Я твой интеллектуальный помощник по тайм-менеджменту. Как тебя зовут?",
    got_name: "🎉 Приятно познакомиться, {name}! Я помогу управлять временем, отслеживать расписание и повысить продуктивность! Напиши 'Help' чтобы увидеть всё, что я умею.",
    greeting: "👋 Привет {name}! Готов сделать сегодня продуктивным? Я помню твоё расписание и задачи. Напиши 'Help' для команд.",
    help: `🤖 *ТВОЙ УМНЫЙ ТАЙМ-МЕНЕДЖЕР*

📅 *УМНОЕ РАСПИСАНИЕ*
• Schedule - Все пары
• Today - Что сегодня
• Tomorrow - Пары завтра
• Next - Следующая пара
• /add предмет день начало конец [место] - Добавить
• /delete id - Удалить

📝 *ЗАДАЧИ*
• Tasks - Активные задачи
• /task "название" ГГГГ-ММ-ДД [high|medium|low] - Добавить
• /complete id - Выполнить
• /delete_task id - Удалить

⏱️ *ТАЙМЕР*
• /study предмет минуты - Начать
• /stop - Остановить

📥 *ИМПОРТ*
• /ics ссылка - Импорт по ссылке
• Прикрепи .ics файл`,
    schedule_empty: "📭 Расписание пусто. Давай создадим его!\n\nИспользуй /add для добавления\nИспользуй /ics для импорта\nИли прикрепи .ics файл",
    tasks_empty: "✅ Нет активных задач! Отличная работа! 🎉",
    no_classes_today: "🎉 Сегодня нет пар! Отличный день!",
    no_classes_tomorrow: "🎉 Завтра нет пар!",
    no_next_class: "🎉 Нет пар в ближайшие 24 часа!",
    class_added: "✅ Пара добавлена!\n📖 {subject}\n📅 {day}\n⏰ {start} - {end}\n⏱️ {duration} мин\n📍 {location}",
    class_deleted: "✅ Пара {id} удалена!",
    class_not_found: "❌ Пара #{id} не найдена.",
    task_added: "✅ Задача создана!\n📝 {title}\n📅 Срок: {due_date} (осталось {days_until} дн.)\n🎯 Приоритет: {priority}",
    task_completed: "✅ Задача #{id} выполнена! 🎉",
    task_deleted: "🗑️ Задача #{id} удалена.",
    task_not_found: "❌ Задача #{id} не найдена.",
    timer_start: "⏱️ *Фокус-сессия началась!*\n📖 {subject}\n⏰ {duration} минут\n🎯 Окончание: {end_time}",
    timer_end: "⏰ *Отличная работа!*\n📖 {subject}\n⏱️ {duration} минут",
    timer_stop: "❌ Таймер остановлен.\n📖 {subject}\n⏱️ {elapsed} минут",
    remind_set: "⏰ Напоминание за {minutes} минут до пары.",
    quiet_mode_on: "🔕 Режим тишины на 2 часа.",
    quiet_mode_off: "🔔 Уведомления возобновлены!",
    import_start: "⏳ Анализирую календарь...",
    import_done: "✅ Календарь импортирован!\n📊 Новых пар: {count}\n🔄 Пропущено дублей: {duplicates}",
    import_fail: "❌ Ошибка импорта: {error}\n\n💡 Попробуй скачать .ics файл и прикрепить его напрямую.",
    import_schedule_header: "📅 *Расписание*\n\n",
    stats: "📊 *СТАТИСТИКА*\n\n📚 Всего пар: {total_classes}\n📝 Выполнено задач: {completed_done}/{total_tasks}\n⏱️ Учёба: {total_study}ч",
    weekdays: ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"]
  },
  zh: {
    ask_name: "👋 你好！我是你的智能时间管理助手。你叫什么名字？",
    got_name: "🎉 很高兴认识你，{name}！我会帮你管理时间、追踪课程表、提高效率！输入'Help'查看所有功能。",
    greeting: "👋 你好 {name}！准备让今天高效吗？输入'Help'查看命令。",
    help: `🤖 *你的智能时间管理器*

📅 *课程表*
• Schedule - 查看课程
• Today - 今日课程
• Tomorrow - 明日课程
• Next - 下节课
• /add 课程 星期 开始 结束 [地点] - 添加

📝 *任务*
• Tasks - 待办任务
• /task "任务名" 年-月-日 [high|medium|low] - 添加

📥 *导入*
• /ics 链接 - 从链接导入
• 直接附加.ics文件`,
    schedule_empty: "📭 课程表为空。使用 /add 添加或导入.ics文件",
    tasks_empty: "✅ 没有待办任务！🎉",
    no_classes_today: "🎉 今天没课！",
    no_classes_tomorrow: "🎉 明天没课！",
    no_next_class: "🎉 未来24小时没有课程！",
    class_added: "✅ 课程添加成功！\n📖 {subject}\n📅 {day}\n⏰ {start} - {end}",
    class_deleted: "✅ 课程 {id} 已删除！",
    class_not_found: "❌ 课程 #{id} 未找到。",
    task_added: "✅ 任务已创建！\n📝 {title}\n📅 截止: {due_date}",
    task_completed: "✅ 任务 #{id} 已完成！🎉",
    task_deleted: "🗑️ 任务 #{id} 已删除。",
    task_not_found: "❌ 任务 #{id} 未找到。",
    timer_start: "⏱️ *专注开始！*\n📖 {subject}\n⏰ {duration} 分钟",
    timer_end: "⏰ *太棒了！*\n📖 {subject}\n⏱️ {duration} 分钟",
    timer_stop: "❌ 计时器已停止。\n📖 {subject}\n⏱️ {elapsed} 分钟",
    remind_set: "⏰ 提醒设置为课前{minutes}分钟。",
    quiet_mode_on: "🔕 静音模式2小时。",
    quiet_mode_off: "🔔 通知已恢复！",
    import_start: "⏳ 正在分析日历...",
    import_done: "✅ 日历已导入！\n📊 新课程: {count}\n🔄 跳过重复: {duplicates}",
    import_fail: "❌ 导入失败: {error}",
    import_schedule_header: "📅 *课程表*\n\n",
    stats: "📊 *统计*\n\n📚 课程: {total_classes}\n📝 任务: {completed_done}/{total_tasks}\n⏱️ 学习: {total_study}时",
    weekdays: ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"]
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
  
  const { data: user } = await supabase
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
        reminder_offset: 30,
        quiet_mode: false,
        total_focus_minutes: 0,
        tasks_completed: 0
      })
      .select()
      .single();
    user = newUser;
  }
  
  if (user) setCache(`user_${userId}`, user, 'user');
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
  
  return data || [];
}

async function addClass(userId, subject, day, startTime, endTime, location = "") {
  const { data, error } = await supabase
    .from("schedule")
    .insert({
      user_id: userId,
      subject: subject,
      day: day,
      start_time: startTime,
      end_time: endTime,
      location: location || ""
    })
    .select();
  
  if (error) {
    console.error("Add class error:", error);
    return false;
  }
  
  console.log("Added class:", data[0]);
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
  let query = supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId);
  
  if (onlyPending) query = query.eq("completed", false);
  
  const { data } = await query.order("due_date");
  return data || [];
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
      created_at: new Date().toISOString()
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
  await supabase
    .from("study_sessions")
    .insert({
      user_id: userId,
      subject,
      duration,
      date: new Date().toISOString().split("T")[0],
      timestamp: new Date().toISOString()
    });
}

async function getStudyStats(userId) {
  const { data } = await supabase
    .from("study_sessions")
    .select("duration")
    .eq("user_id", userId);
  
  if (!data || data.length === 0) return { total: 0 };
  
  const total = data.reduce((sum, s) => sum + s.duration, 0);
  return { total };
}

// ==================== HELPER FUNCTIONS ====================
function getTodayIndex() {
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1;
}

function getCurrentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

async function getTodayClasses(userId) {
  const today = getTodayIndex();
  const classes = await getClasses(userId);
  return classes.filter(c => c.day === today);
}

async function getTomorrowClasses(userId) {
  const tomorrow = getTodayIndex() === 6 ? 0 : getTodayIndex() + 1;
  const classes = await getClasses(userId);
  return classes.filter(c => c.day === tomorrow);
}

async function getNextClass(userId) {
  const today = getTodayIndex();
  const currentTime = getCurrentTime();
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
    next: lang === "ru" ? "⏰ Следующая" : lang === "zh" ? "⏰ 下节课" : "⏰ Next",
    stats: lang === "ru" ? "📊 Статистика" : lang === "zh" ? "📊 统计" : "📊 Stats",
    help: lang === "ru" ? "❓ Помощь" : lang === "zh" ? "❓ 帮助" : "❓ Help"
  };
  
  return JSON.stringify({
    one_time: false,
    buttons: [
      [{ action: { type: "text", label: labels.schedule }, color: "primary" }],
      [{ action: { type: "text", label: labels.today }, color: "primary" },
       { action: { type: "text", label: labels.next }, color: "positive" }],
      [{ action: { type: "text", label: labels.tasks }, color: "positive" }],
      [{ action: { type: "text", label: labels.stats }, color: "secondary" },
       { action: { type: "text", label: labels.help }, color: "secondary" }]
    ]
  });
}

// ==================== ICS IMPORT - SIMPLE AND RELIABLE ====================
async function importICS(userId, source) {
  console.log("=== ICS IMPORT STARTED ===");
  console.log("User ID:", userId);
  console.log("Source type:", typeof source);
  
  try {
    let icsContent;
    
    // Step 1: Get the ICS content
    if (source.startsWith("http://") || source.startsWith("https://")) {
      console.log("Fetching URL:", source);
      const response = await fetch(source);
      if (!response.ok) {
        return { success: false, error: `Cannot access URL (HTTP ${response.status})` };
      }
      icsContent = await response.text();
      console.log("Downloaded content length:", icsContent.length);
    } else {
      // Assume it's raw ICS content (from file attachment)
      icsContent = source;
      console.log("Using raw content, length:", icsContent.length);
    }
    
    // Step 2: Parse events using simple string operations
    const events = [];
    
    // Split by VEVENT
    const veventBlocks = icsContent.split("BEGIN:VEVENT");
    
    for (let i = 1; i < veventBlocks.length; i++) {
      const block = veventBlocks[i].split("END:VEVENT")[0];
      
      // Extract fields using simple string matching
      let summary = "";
      let dtstart = "";
      let dtend = "";
      let location = "";
      
      const summaryMatch = block.match(/SUMMARY[^:]*:(.+)/);
      if (summaryMatch) summary = summaryMatch[1].trim();
      
      const dtstartMatch = block.match(/DTSTART[^:]*:(\d+T?\d*)/);
      if (dtstartMatch) dtstart = dtstartMatch[1];
      
      const dtendMatch = block.match(/DTEND[^:]*:(\d+T?\d*)/);
      if (dtendMatch) dtend = dtendMatch[1];
      
      const locationMatch = block.match(/LOCATION[^:]*:(.+)/);
      if (locationMatch) location = locationMatch[1].trim();
      
      if (summary && dtstart) {
        events.push({ summary, dtstart, dtend, location });
        console.log("Parsed event:", summary);
      }
    }
    
    console.log("Total events parsed:", events.length);
    
    if (events.length === 0) {
      return { success: false, error: "No events found in the calendar" };
    }
    
    // Step 3: Import events to database
    let imported = 0;
    let duplicates = 0;
    
    for (const event of events) {
      // Parse date and time
      const dateMatch = event.dtstart.match(/(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?/);
      if (!dateMatch) {
        console.log("Cannot parse date:", event.dtstart);
        continue;
      }
      
      const year = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]) - 1;
      const day = parseInt(dateMatch[3]);
      const hour = dateMatch[4] ? parseInt(dateMatch[4]) : 9;
      const minute = dateMatch[5] ? parseInt(dateMatch[5]) : 0;
      
      const startDate = new Date(year, month, day, hour, minute);
      
      // Convert to weekday (0=Mon, 6=Sun)
      let weekday = startDate.getDay();
      weekday = weekday === 0 ? 6 : weekday - 1;
      
      const startTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      
      // Parse end time
      let endHour = hour + 1;
      let endMinute = minute;
      
      if (event.dtend) {
        const endMatch = event.dtend.match(/(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?/);
        if (endMatch && endMatch[4]) {
          endHour = parseInt(endMatch[4]);
          endMinute = endMatch[5] ? parseInt(endMatch[5]) : 0;
        }
      }
      
      const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
      
      // Clean up text
      const subject = event.summary.replace(/\\,/g, ",").replace(/\\;/g, ";").trim();
      const location = event.location.replace(/\\,/g, ",").replace(/\\;/g, ";").trim();
      
      console.log(`Importing: ${subject} on day ${weekday} at ${startTime}-${endTime}`);
      
      // Check for duplicate
      const existingClasses = await getClasses(userId);
      const isDuplicate = existingClasses.some(c => 
        c.subject === subject && 
        c.day === weekday && 
        c.start_time === startTime
      );
      
      if (isDuplicate) {
        console.log("Duplicate, skipping");
        duplicates++;
        continue;
      }
      
      // Insert into database
      const { error } = await supabase
        .from("schedule")
        .insert({
          user_id: userId,
          subject: subject,
          day: weekday,
          start_time: startTime,
          end_time: endTime,
          location: location
        });
      
      if (error) {
        console.error("Insert error:", error);
      } else {
        console.log("Successfully inserted");
        imported++;
      }
    }
    
    console.log(`Import complete: ${imported} new, ${duplicates} duplicates`);
    clearUserCache(userId);
    
    return { success: true, count: imported, duplicates };
    
  } catch (error) {
    console.error("Import error:", error);
    return { success: false, error: error.message };
  }
}

// ==================== STUDY TIMER ====================
function startTimer(userId, subject, duration) {
  if (timers.has(userId)) {
    clearTimeout(timers.get(userId).timeout);
  }
  
  const startTime = Date.now();
  const endTime = new Date(startTime + duration * 60 * 1000);
  
  const timeout = setTimeout(async () => {
    try {
      const lang = await getUserLang(userId);
      await sendVkMessage(userId, t(lang, "timer_end", { subject, duration }));
      await addStudySession(userId, subject, duration);
    } catch (e) {
      console.error("Timer error:", e);
    }
    timers.delete(userId);
  }, duration * 60 * 1000);
  
  timers.set(userId, { timeout, subject, duration, startTime });
}

// ==================== MESSAGE PROCESSOR ====================
async function processMessage(userId, text, lang) {
  const msg = text.trim();
  const lower = msg.toLowerCase();
  
  // Name detection
  let nameMatch = msg.match(/^(?:my name is |i'm |i am |call me )([a-zA-Z]{2,20})/i);
  if (!nameMatch) nameMatch = msg.match(/^(?:меня зовут |я )([а-яёА-ЯЁ]{2,20})/i);
  if (!nameMatch) nameMatch = msg.match(/^(?:我叫|我是)([\u4e00-\u9fff]{1,4})/);
  
  if (nameMatch) {
    const name = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1).toLowerCase();
    await updateUser(userId, { name });
    await sendVkMessage(userId, t(lang, "got_name", { name }), getKeyboard(lang));
    return;
  }
  
  // Help
  if (lower === "help" || lower === "/help" || lower === "помощь" || lower === "帮助") {
    await sendVkMessage(userId, t(lang, "help"), getKeyboard(lang));
    return;
  }
  
  // Schedule
  if (lower === "schedule" || lower === "расписание" || lower === "课程表") {
    const classes = await getClasses(userId);
    
    if (classes.length === 0) {
      await sendVkMessage(userId, t(lang, "schedule_empty"), getKeyboard(lang));
      return;
    }
    
    const days = T[lang].weekdays;
    let response = `📅 *Schedule*\n\n`;
    
    for (let d = 0; d < 7; d++) {
      const dayClasses = classes.filter(c => c.day === d);
      if (dayClasses.length > 0) {
        response += `*${days[d]}*\n`;
        for (const c of dayClasses) {
          response += `  🆔 ${c.id} | ⏰ ${c.start_time}-${c.end_time} | 📖 ${c.subject}`;
          if (c.location) response += ` | 📍 ${c.location}`;
          response += `\n`;
        }
        response += `\n`;
      }
    }
    
    await sendVkMessage(userId, response, getKeyboard(lang));
    return;
  }
  
  // Today
  if (lower === "today" || lower === "сегодня" || lower === "今天") {
    const classes = await getTodayClasses(userId);
    
    if (classes.length === 0) {
      await sendVkMessage(userId, t(lang, "no_classes_today"), getKeyboard(lang));
      return;
    }
    
    const currentTime = getCurrentTime();
    let response = `📋 *Today's Classes*\n\n`;
    
    for (const c of classes) {
      const status = c.start_time <= currentTime && c.end_time >= currentTime ? "🟢 NOW" :
                     c.start_time > currentTime ? "⏳" : "✅";
      response += `${status} ${c.start_time}-${c.end_time} • *${c.subject}*\n`;
      if (c.location) response += `   📍 ${c.location}\n`;
      response += `\n`;
    }
    
    await sendVkMessage(userId, response, getKeyboard(lang));
    return;
  }
  
  // Tomorrow
  if (lower === "tomorrow" || lower === "завтра" || lower === "明天") {
    const classes = await getTomorrowClasses(userId);
    
    if (classes.length === 0) {
      await sendVkMessage(userId, t(lang, "no_classes_tomorrow"), getKeyboard(lang));
      return;
    }
    
    let response = `📅 *Tomorrow's Classes*\n\n`;
    for (const c of classes) {
      response += `⏰ ${c.start_time}-${c.end_time} • *${c.subject}*\n`;
      if (c.location) response += `   📍 ${c.location}\n`;
      response += `\n`;
    }
    
    await sendVkMessage(userId, response, getKeyboard(lang));
    return;
  }
  
  // Next class
  if (lower === "next" || lower === "следующая" || lower === "下一个") {
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
    
    let response = `⏰ *Next Class*\n\n`;
    response += `📖 ${next.subject}\n`;
    response += `📅 ${days[next.day]}\n`;
    response += `🕐 ${next.start_time} - ${next.end_time}\n`;
    response += `⏱️ In ${mins} min\n`;
    if (next.location) response += `📍 ${next.location}\n`;
    
    await sendVkMessage(userId, response, getKeyboard(lang));
    return;
  }
  
  // Add class
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
      
      const duration = calculateDuration(startTime, endTime);
      const ok = await addClass(userId, subject, day, startTime, endTime, location);
      
      if (ok) {
        const days = T[lang].weekdays;
        await sendVkMessage(userId, t(lang, "class_added", {
          subject, day: days[day], start: startTime, end: endTime,
          duration, location: location || "—"
        }), getKeyboard(lang));
      } else {
        await sendVkMessage(userId, "❌ Error adding class", getKeyboard(lang));
      }
    } else {
      await sendVkMessage(userId, "❌ Format: /add subject day start end [location]\nExample: /add Math 1 10:30 12:05 Room_101", getKeyboard(lang));
    }
    return;
  }
  
  // Delete class
  if (lower.startsWith("/delete") && !lower.includes("task")) {
    const id = parseInt(msg.split(/\s+/)[1]);
    if (!isNaN(id)) {
      const ok = await deleteClass(userId, id);
      await sendVkMessage(userId, t(lang, ok ? "class_deleted" : "class_not_found", { id }), getKeyboard(lang));
    }
    return;
  }
  
  // Tasks
  if (lower === "tasks" || lower === "задачи" || lower === "任务") {
    const tasks = await getTasks(userId, true);
    
    if (tasks.length === 0) {
      await sendVkMessage(userId, t(lang, "tasks_empty"), getKeyboard(lang));
      return;
    }
    
    let response = `📝 *Tasks* (${tasks.length} pending)\n\n`;
    
    for (const task of tasks) {
      const prio = task.priority || "normal";
      const prioEmoji = prio === "high" ? "🔴" : prio === "medium" ? "🟡" : "🟢";
      
      response += `🆔 ${task.id} | ${prioEmoji} ${prio}\n`;
      response += `   📖 ${task.title}\n`;
      response += `   📅 ${task.due_date}\n`;
      response += `   ✅ /complete ${task.id} | 🗑️ /delete_task ${task.id}\n\n`;
    }
    
    await sendVkMessage(userId, response, getKeyboard(lang));
    return;
  }
  
  // Add task
  if (lower.startsWith("/task")) {
    const match = msg.match(/\/task\s+"([^"]+)"\s+(\d{4}-\d{2}-\d{2})(?:\s+(high|medium|low))?/);
    
    if (match) {
      const title = match[1];
      const dueDate = match[2];
      const priority = match[3] || "normal";
      
      const dueDateTime = new Date(dueDate);
      const daysUntil = Math.ceil((dueDateTime - new Date()) / (1000 * 60 * 60 * 24));
      
      await addTask(userId, title, dueDate, priority);
      await sendVkMessage(userId, t(lang, "task_added", { title, due_date: dueDate, priority, days_until: daysUntil }), getKeyboard(lang));
    } else {
      await sendVkMessage(userId, '❌ Format: /task "Title" YYYY-MM-DD [high|medium|low]', getKeyboard(lang));
    }
    return;
  }
  
  // Complete task
  if (lower.startsWith("/complete")) {
    const id = parseInt(msg.split(/\s+/)[1]);
    if (!isNaN(id)) {
      const ok = await completeTask(userId, id);
      await sendVkMessage(userId, t(lang, ok ? "task_completed" : "task_not_found", { id }), getKeyboard(lang));
    }
    return;
  }
  
  // Delete task
  if (lower.startsWith("/delete_task")) {
    const id = parseInt(msg.split(/\s+/)[1]);
    if (!isNaN(id)) {
      const ok = await deleteTask(userId, id);
      await sendVkMessage(userId, t(lang, ok ? "task_deleted" : "task_not_found", { id }), getKeyboard(lang));
    }
    return;
  }
  
  // Study timer
  if (lower.startsWith("/study")) {
    const parts = msg.split(/\s+/);
    if (parts.length >= 3) {
      const subject = parts[1];
      const duration = parseInt(parts[2]);
      
      if (!isNaN(duration) && duration >= 5 && duration <= 180) {
        startTimer(userId, subject, duration);
        const endTime = new Date(Date.now() + duration * 60000);
        const endTimeStr = `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`;
        await sendVkMessage(userId, t(lang, "timer_start", { subject, duration, end_time: endTimeStr }), getKeyboard(lang));
      } else {
        await sendVkMessage(userId, "❌ Duration: 5-180 minutes", getKeyboard(lang));
      }
    }
    return;
  }
  
  if (lower === "/stop") {
    const timer = timers.get(userId);
    if (timer) {
      clearTimeout(timer.timeout);
      const elapsed = Math.round((Date.now() - timer.startTime) / 60000);
      timers.delete(userId);
      await sendVkMessage(userId, t(lang, "timer_stop", { subject: timer.subject, elapsed }), getKeyboard(lang));
    } else {
      await sendVkMessage(userId, "❌ No active timer", getKeyboard(lang));
    }
    return;
  }
  
  // Settings
  if (lower.startsWith("/remind")) {
    const mins = parseInt(msg.split(/\s+/)[1]);
    if (!isNaN(mins) && mins >= 5 && mins <= 120) {
      await updateUser(userId, { reminder_offset: mins });
      await sendVkMessage(userId, t(lang, "remind_set", { minutes: mins }), getKeyboard(lang));
    }
    return;
  }
  
  if (lower === "/quiet") {
    await updateUser(userId, { quiet_mode: true });
    await sendVkMessage(userId, t(lang, "quiet_mode_on"), getKeyboard(lang));
    return;
  }
  
  if (lower === "/unquiet") {
    await updateUser(userId, { quiet_mode: false });
    await sendVkMessage(userId, t(lang, "quiet_mode_off"), getKeyboard(lang));
    return;
  }
  
  // ICS import
  if (lower.startsWith("/ics")) {
    const url = msg.split(/\s+/)[1];
    if (url) {
      await sendVkMessage(userId, t(lang, "import_start"), getKeyboard(lang));
      
      const result = await importICS(userId, url);
      
      if (result.success) {
        await sendVkMessage(userId, t(lang, "import_done", { 
          count: result.count, 
          duplicates: result.duplicates || 0
        }), getKeyboard(lang));
        
        // Show schedule after import
        setTimeout(async () => {
          const classes = await getClasses(userId);
          if (classes.length > 0) {
            const days = T[lang].weekdays;
            let scheduleMsg = t(lang, "import_schedule_header");
            
            for (let d = 0; d < 7; d++) {
              const dayClasses = classes.filter(c => c.day === d);
              if (dayClasses.length > 0) {
                scheduleMsg += `\n*${days[d]}*\n`;
                for (const c of dayClasses) {
                  scheduleMsg += `  ⏰ ${c.start_time}-${c.end_time} | 📖 ${c.subject}`;
                  if (c.location) scheduleMsg += ` | 📍 ${c.location}`;
                  scheduleMsg += `\n`;
                }
              }
            }
            
            await sendVkMessage(userId, scheduleMsg, getKeyboard(lang));
          }
        }, 2000);
        
      } else {
        await sendVkMessage(userId, t(lang, "import_fail", { error: result.error }), getKeyboard(lang));
      }
    } else {
      await sendVkMessage(userId, "❌ Usage: /ics <url>", getKeyboard(lang));
    }
    return;
  }
  
  // Stats
  if (lower === "stats" || lower === "статистика" || lower === "统计") {
    const [classes, tasks, study] = await Promise.all([
      getClasses(userId),
      getTasks(userId, false),
      getStudyStats(userId)
    ]);
    
    const completed = tasks.filter(t => t.completed).length;
    
    await sendVkMessage(userId, t(lang, "stats", {
      total_classes: classes.length,
      completed_done: completed,
      total_tasks: tasks.length,
      total_study: Math.round((study.total || 0) / 60)
    }), getKeyboard(lang));
    return;
  }
  
  // Default greeting
  const user = await getUser(userId);
  const name = user?.name;
  
  if (!name) {
    await sendVkMessage(userId, t(lang, "ask_name"));
  } else {
    const todayClasses = await getTodayClasses(userId);
    const pendingTasks = await getTasks(userId, true);
    const nextClass = await getNextClass(userId);
    
    let greeting = t(lang, "greeting", { name });
    
    if (todayClasses.length > 0) {
      greeting += `\n\n📅 You have ${todayClasses.length} class(es) today.`;
    }
    if (nextClass) {
      const [h, m] = nextClass.start_time.split(":").map(Number);
      const classTime = new Date();
      classTime.setHours(h, m, 0, 0);
      const mins = Math.round((classTime - new Date()) / 60000);
      if (mins > 0 && mins < 60) {
        greeting += `\n⏰ Next class: ${nextClass.subject} in ${mins} minutes!`;
      }
    }
    if (pendingTasks.length > 0) {
      const highPriority = pendingTasks.filter(t => t.priority === "high").length;
      if (highPriority > 0) {
        greeting += `\n🔴 ${highPriority} high-priority task(s) pending.`;
      }
    }
    
    greeting += `\n\nType 'Help' to see all commands.`;
    
    await sendVkMessage(userId, greeting, getKeyboard(lang));
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
      
      console.log(`Message from ${userId}: ${text.substring(0, 50)}`);
      
      const detectedLang = detectLanguage(text);
      let user = await getUser(userId);
      
      if (user && user.language !== detectedLang && text.length > 0) {
        await updateUser(userId, { language: detectedLang });
        user.language = detectedLang;
      }
      
      const lang = user?.language || detectedLang;
      
      // Handle ICS file attachment
      const icsFile = attachments.find(a => {
        if (a.type === "doc") {
          const title = (a.doc?.title || "").toLowerCase();
          const ext = (a.doc?.ext || "").toLowerCase();
          return title.endsWith(".ics") || ext === "ics";
        }
        return false;
      });
      
      if (icsFile) {
        console.log("ICS file detected:", icsFile.doc?.title);
        
        await sendVkMessage(userId, t(lang, "import_start"), getKeyboard(lang));
        
        try {
          // Download the file
          const response = await fetch(icsFile.doc.url);
          const content = await response.text();
          
          console.log("File downloaded, length:", content.length);
          
          // Import the content
          const result = await importICS(userId, content);
          
          if (result.success) {
            await sendVkMessage(userId, t(lang, "import_done", { 
              count: result.count, 
              duplicates: result.duplicates || 0
            }), getKeyboard(lang));
            
            // Show schedule
            setTimeout(async () => {
              const classes = await getClasses(userId);
              if (classes.length > 0) {
                const days = T[lang].weekdays;
                let scheduleMsg = t(lang, "import_schedule_header");
                
                for (let d = 0; d < 7; d++) {
                  const dayClasses = classes.filter(c => c.day === d);
                  if (dayClasses.length > 0) {
                    scheduleMsg += `\n*${days[d]}*\n`;
                    for (const c of dayClasses) {
                      scheduleMsg += `  ⏰ ${c.start_time}-${c.end_time} | 📖 ${c.subject}`;
                      if (c.location) scheduleMsg += ` | 📍 ${c.location}`;
                      scheduleMsg += `\n`;
                    }
                  }
                }
                
                await sendVkMessage(userId, scheduleMsg, getKeyboard(lang));
              }
            }, 2000);
            
          } else {
            await sendVkMessage(userId, t(lang, "import_fail", { error: result.error }), getKeyboard(lang));
          }
        } catch (e) {
          console.error("File import error:", e);
          await sendVkMessage(userId, t(lang, "import_fail", { error: e.message }), getKeyboard(lang));
        }
        
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }
      
      // Process text message
      await processMessage(userId, text, lang);
      
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }
    
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    
  } catch (error) {
    console.error("Handler error:", error);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }
}