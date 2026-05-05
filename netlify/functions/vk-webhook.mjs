

// ==================== VITA BOT - PRODUCTION READY v3.0 ====================
import { createClient } from "@supabase/supabase-js";

// ==================== CONFIGURATION ====================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const VK_TOKEN = process.env.VK_TOKEN;
const VK_CONFIRMATION = process.env.VK_CONFIRMATION_TOKEN;
const VK_API_VERSION = "5.199";

// ==================== CACHE SYSTEM ====================
const memoryCache = new Map();
const CACHE_TTL = {
  user: 300000,
  classes: 120000,
  tasks: 60000,
  stats: 30000
};

function getCached(key, type = 'default') {
  const item = memoryCache.get(key);
  if (!item) return null;
  if (Date.now() - item.time > (CACHE_TTL[type] || 60000)) {
    memoryCache.delete(key);
    return null;
  }
  return item.data;
}

function setCached(key, data, type = 'default') {
  memoryCache.set(key, { data, time: Date.now(), type });
}

function invalidateCache(pattern) {
  for (const key of memoryCache.keys()) {
    if (key.includes(pattern)) memoryCache.delete(key);
  }
}

// ==================== LANGUAGE SYSTEM ====================
const T = {
  en: {
    welcome_new: "🎉 *Welcome to Vita AI!*\n\nI'm your study assistant. I can help you manage schedules, tasks, and study sessions.\n\nWhat's your name?",
    welcome_back: "👋 Welcome back, {name}!\n\n📅 Classes today: {classes_today}\n📝 Pending tasks: {tasks_pending}\n\nUse /help to see commands.",
    
    help: `🤖 *Vita Commands*

📅 *Schedule:*
/add - Add class
/schedule - View schedule
/today - Today's classes
/tomorrow - Tomorrow's classes
/delete [id] - Remove class

📝 *Tasks:*
/task - Add task
/tasks - View tasks
/complete [id] - Complete task
/delete_task [id] - Remove task

⏱️ *Study:*
/focus [subj] [min] - Start focus
/pomodoro [subj] [cycles] - Pomodoro
/stop - Stop focus

📅 *Calendar:*
/upload [url] - Import .ics file
/clear_calendar - Remove all classes

⚙️ *Settings:*
/language [en/ru/zh] - Change language
/settings - View settings
/stats - Statistics

Type any command to begin!`,

    schedule_title: "📅 *Your Schedule*\n",
    schedule_empty: "📭 No classes yet!\n\nUse /add or /upload",
    class_added: "✅ Added: {subject}\n📅 {day} {start}-{end}{location}",
    class_deleted: "✅ Class #{id} deleted",
    class_not_found: "❌ Class #{id} not found",
    
    today_title: "📋 *Today*\n",
    today_empty: "🎉 No classes today!",
    
    tasks_title: "📝 *Your Tasks*\n",
    tasks_empty: "✅ No pending tasks! 🎉",
    task_added: "✅ Task: {title}\n📅 Due: {due}\n⚡ {priority}",
    task_completed: "✅ Task #{id} completed! 🎉",
    task_deleted: "🗑️ Task #{id} deleted",
    
    focus_start: "⏱️ *Focus: {subject}*\n⏰ {duration} min\nStay focused!",
    focus_complete: "🎉 *Done! {subject}*\n⏰ {duration} min\nGreat work!",
    focus_stop: "⏹️ *Stopped: {subject}*\n⏱️ {elapsed} min",
    pomodoro_start: "🍅 *Pomodoro: {cycles} cycles*\nFocus!",
    
    import_start: "📥 Importing calendar...",
    import_done: "✅ Imported {count} classes ({duplicates} duplicates)",
    import_error: "❌ Import failed: {error}",
    calendar_cleared: "🗑️ All classes removed",
    
    stats: "📊 *Stats*\n📚 Classes: {classes}\n✅ Tasks: {completed}/{total} ({rate}%)\n⏱️ Study: {focus}h\n⭐ Level: {level} ({xp} XP)",
    
    language_changed: "✅ Language: {language}",
    
    weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    priorities: { high: "🔴 High", medium: "🟡 Medium", low: "🟢 Low", urgent: "⚡ Urgent" },
    
    error_general: "❌ Error. Please try again."
  },

  ru: {
    welcome_new: "🎉 *Добро пожаловать в Vita AI!*\n\nЯ ваш помощник по учебе. Помогу с расписанием, задачами и учебой.\n\nКак вас зовут?",
    welcome_back: "👋 С возвращением, {name}!\n\n📅 Пар сегодня: {classes_today}\n📝 Задач: {tasks_pending}\n\nИспользуйте /help для списка команд.",
    
    help: `🤖 *Команды Vita*

📅 *Расписание:*
/add - Добавить пару
/schedule - Расписание
/today - Сегодня
/tomorrow - Завтра
/delete [id] - Удалить

📝 *Задачи:*
/task - Добавить
/tasks - Список
/complete [id] - Завершить
/delete_task [id] - Удалить

⏱️ *Учеба:*
/focus [предмет] [мин] - Фокус
/pomodoro [предмет] [циклы]
/stop - Стоп

📅 *Календарь:*
/upload [url] - Импорт .ics
/clear_calendar - Очистить

⚙️ *Настройки:*
/language [en/ru/zh] - Язык
/settings - Настройки
/stats - Статистика

Введите команду!`,

    schedule_title: "📅 *Расписание*\n",
    schedule_empty: "📭 Расписание пусто!\n\nИспользуйте /add или /upload",
    class_added: "✅ Добавлено: {subject}\n📅 {day} {start}-{end}{location}",
    class_deleted: "✅ Пара #{id} удалена",
    class_not_found: "❌ Пара #{id} не найдена",
    
    today_title: "📋 *Сегодня*\n",
    today_empty: "🎉 Сегодня нет пар!",
    
    tasks_title: "📝 *Задачи*\n",
    tasks_empty: "✅ Нет задач! 🎉",
    task_added: "✅ Задача: {title}\n📅 До: {due}\n⚡ {priority}",
    task_completed: "✅ Задача #{id} выполнена! 🎉",
    task_deleted: "🗑️ Задача #{id} удалена",
    
    focus_start: "⏱️ *Фокус: {subject}*\n⏰ {duration} мин\nСосредоточьтесь!",
    focus_complete: "🎉 *Готово: {subject}*\n⏰ {duration} мин\nОтлично!",
    focus_stop: "⏹️ *Стоп: {subject}*\n⏱️ {elapsed} мин",
    pomodoro_start: "🍅 *Помодоро: {cycles} цикла*\nФокус!",
    
    import_start: "📥 Импорт календаря...",
    import_done: "✅ Импортировано {count} пар ({duplicates} дублей)",
    import_error: "❌ Ошибка импорта: {error}",
    calendar_cleared: "🗑️ Все пары удалены",
    
    stats: "📊 *Статистика*\n📚 Пары: {classes}\n✅ Задачи: {completed}/{total} ({rate}%)\n⏱️ Учеба: {focus}ч\n⭐ Уровень: {level} ({xp} XP)",
    
    language_changed: "✅ Язык: {language}",
    
    weekdays: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
    priorities: { high: "🔴 Высокий", medium: "🟡 Средний", low: "🟢 Низкий", urgent: "⚡ Срочный" },
    
    error_general: "❌ Ошибка. Попробуйте снова."
  },

  zh: {
    welcome_new: "🎉 *欢迎使用 Vita AI！*\n\n我是您的学习助手，帮您管理课程表、任务和学习。\n\n请问您叫什么名字？",
    welcome_back: "👋 欢迎回来, {name}！\n\n📅 今日课程: {classes_today}\n📝 待办任务: {tasks_pending}\n\n使用 /help 查看命令。",
    
    help: `🤖 *Vita 命令*

📅 *课程:*
/add - 添加课程
/schedule - 课程表
/today - 今天
/tomorrow - 明天
/delete [id] - 删除

📝 *任务:*
/task - 添加任务
/tasks - 任务列表
/complete [id] - 完成
/delete_task [id] - 删除

⏱️ *学习:*
/focus [科目] [分钟] - 专注
/pomodoro [科目] [周期]
/stop - 停止

📅 *日历:*
/upload [url] - 导入.ics
/clear_calendar - 清空

⚙️ *设置:*
/language [en/ru/zh] - 语言
/settings - 设置
/stats - 统计

输入命令开始！`,

    schedule_title: "📅 *课程表*\n",
    schedule_empty: "📭 暂无课程！\n\n使用 /add 或 /upload",
    class_added: "✅ 已添加: {subject}\n📅 {day} {start}-{end}{location}",
    class_deleted: "✅ 课程 #{id} 已删除",
    class_not_found: "❌ 未找到课程 #{id}",
    
    today_title: "📋 *今天*\n",
    today_empty: "🎉 今天没课！",
    
    tasks_title: "📝 *任务*\n",
    tasks_empty: "✅ 没有任务！🎉",
    task_added: "✅ 任务: {title}\n📅 截止: {due}\n⚡ {priority}",
    task_completed: "✅ 任务 #{id} 已完成！🎉",
    task_deleted: "🗑️ 任务 #{id} 已删除",
    
    focus_start: "⏱️ *专注: {subject}*\n⏰ {duration} 分钟\n保持专注！",
    focus_complete: "🎉 *完成: {subject}*\n⏰ {duration} 分钟\n做得好！",
    focus_stop: "⏹️ *停止: {subject}*\n⏱️ {elapsed} 分钟",
    pomodoro_start: "🍅 *番茄钟: {cycles} 周期*\n专注！",
    
    import_start: "📥 导入日历中...",
    import_done: "✅ 已导入 {count} 门课程 ({duplicates} 重复)",
    import_error: "❌ 导入失败: {error}",
    calendar_cleared: "🗑️ 所有课程已清空",
    
    stats: "📊 *统计*\n📚 课程: {classes}\n✅ 任务: {completed}/{total} ({rate}%)\n⏱️ 学习: {focus}小时\n⭐ 等级: {level} ({xp} XP)",
    
    language_changed: "✅ 语言: {language}",
    
    weekdays: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
    priorities: { high: "🔴 高", medium: "🟡 中", low: "🟢 低", urgent: "⚡ 紧急" },
    
    error_general: "❌ 错误。请重试。"
  }
};

function t(key, lang = 'en', params = {}) {
  let text = T[lang]?.[key] || T.en[key] || key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(new RegExp(`{${k}}`, 'g'), v);
  }
  return text;
}

function detectLang(text) {
  if (!text) return 'en';
  if (/[а-яё]/i.test(text)) return 'ru';
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
  return 'en';
}

// ==================== VK API ====================
async function vkApi(method, params) {
  try {
    const url = new URL(`https://api.vk.com/method/${method}`);
    url.searchParams.append('v', VK_API_VERSION);
    url.searchParams.append('access_token', VK_TOKEN);

    const formData = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      formData.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }

    const response = await fetch(url.toString(), {
      method: 'POST',
      body: formData
    });

    const data = await response.json();
    
    if (data.error) {
      if (data.error.error_code === 9) {
        // Rate limit - wait and retry once
        await new Promise(r => setTimeout(r, 1000));
        const retryResponse = await fetch(url.toString(), { method: 'POST', body: formData });
        const retryData = await retryResponse.json();
        if (!retryData.error) return retryData.response || retryData;
      }
      console.error(`VK API Error (${method}):`, data.error.error_msg);
      return null;
    }
    
    return data.response || data;
  } catch (error) {
    console.error(`VK API failed (${method}):`, error.message);
    return null;
  }
}

async function sendMessage(userId, message, keyboard = null) {
  // VK message limit is 4096 characters
  if (message.length > 4000) {
    const chunks = [];
    let remaining = message;
    
    while (remaining.length > 4000) {
      let splitAt = remaining.lastIndexOf('\n', 4000);
      if (splitAt === -1 || splitAt < 2000) splitAt = 4000;
      chunks.push(remaining.substring(0, splitAt));
      remaining = remaining.substring(splitAt);
    }
    chunks.push(remaining);
    
    for (let i = 0; i < chunks.length; i++) {
      await vkApi('messages.send', {
        user_id: userId,
        message: chunks[i],
        random_id: Math.floor(Math.random() * 1000000)
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
        { action: { type: "text", label: { en: "📅 Schedule", ru: "📅 Расписание", zh: "📅 课程表" }[lang] }, color: "primary" },
        { action: { type: "text", label: { en: "📋 Today", ru: "📋 Сегодня", zh: "📋 今天" }[lang] }, color: "primary" }
      ],
      [
        { action: { type: "text", label: { en: "📝 Tasks", ru: "📝 Задачи", zh: "📝 任务" }[lang] }, color: "positive" },
        { action: { type: "text", label: { en: "⏰ Next", ru: "⏰ Далее", zh: "⏰ 下节课" }[lang] }, color: "positive" }
      ],
      [
        { action: { type: "text", label: { en: "⏱️ Focus", ru: "⏱️ Фокус", zh: "⏱️ 专注" }[lang] }, color: "negative" },
        { action: { type: "text", label: { en: "📊 Stats", ru: "📊 Статистика", zh: "📊 统计" }[lang] }, color: "secondary" }
      ],
      [
        { action: { type: "text", label: { en: "❓ Help", ru: "❓ Помощь", zh: "❓ 帮助" }[lang] }, color: "secondary" },
        { action: { type: "text", label: { en: "⚙️ Settings", ru: "⚙️ Настройки", zh: "⚙️ 设置" }[lang] }, color: "secondary" }
      ]
    ]
  };
}

// ==================== DATABASE FUNCTIONS ====================
async function getUser(userId) {
  const ck = `user_${userId}`;
  const cached = getCached(ck, 'user');
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
        language: 'en',
        notify_offset: 60,
        total_focus_minutes: 0,
        tasks_completed: 0,
        xp: 0,
        level: 1
      })
      .select()
      .single();
    
    if (newUser) {
      setCached(ck, newUser, 'user');
    }
    return newUser;
  }

  setCached(ck, user, 'user');
  return user;
}

async function updateUser(userId, updates) {
  const { error } = await supabase
    .from("users")
    .update(updates)
    .eq("vk_id", userId);
  
  if (!error) invalidateCache(`user_${userId}`);
  return !error;
}

async function getClasses(userId) {
  const ck = `classes_${userId}`;
  const cached = getCached(ck, 'classes');
  if (cached) return cached;

  const { data } = await supabase
    .from("schedule")
    .select("*")
    .eq("user_id", userId)
    .order("day")
    .order("start_time");

  const classes = data || [];
  setCached(ck, classes, 'classes');
  return classes;
}

async function addClass(userId, classData) {
  const { error } = await supabase
    .from("schedule")
    .insert({ user_id: userId, ...classData });
  
  if (!error) invalidateCache(`classes_${userId}`);
  return !error;
}

async function deleteClass(userId, classId) {
  const { error } = await supabase
    .from("schedule")
    .delete()
    .eq("id", classId)
    .eq("user_id", userId);
  
  if (!error) invalidateCache(`classes_${userId}`);
  return !error;
}

async function clearAllClasses(userId) {
  const { error } = await supabase
    .from("schedule")
    .delete()
    .eq("user_id", userId);
  
  if (!error) invalidateCache(`classes_${userId}`);
  return !error;
}

async function getTasks(userId, onlyPending = true) {
  const ck = `tasks_${userId}_${onlyPending}`;
  const cached = getCached(ck, 'tasks');
  if (cached) return cached;

  let query = supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId);
  
  if (onlyPending) query = query.eq("done", false);
  
  const { data } = await query.order("due_date");
  const tasks = data || [];
  setCached(ck, tasks, 'tasks');
  return tasks;
}

async function addTask(userId, taskData) {
  const { error } = await supabase
    .from("tasks")
    .insert({ user_id: userId, ...taskData });
  
  if (!error) invalidateCache(`tasks_${userId}`);
  return !error;
}

async function completeTask(userId, taskId) {
  const { data: task } = await supabase
    .from("tasks")
    .select("id")
    .eq("id", taskId)
    .eq("user_id", userId)
    .single();

  if (!task) return false;

  const { error } = await supabase
    .from("tasks")
    .update({ done: true, completed_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("user_id", userId);
  
  if (!error) {
    invalidateCache(`tasks_${userId}`);
    
    // Update user stats
    const user = await getUser(userId);
    await updateUser(userId, {
      tasks_completed: (user.tasks_completed || 0) + 1,
      xp: (user.xp || 0) + 50,
      level: Math.floor(((user.xp || 0) + 50) / 1000) + 1
    });
  }
  
  return !error;
}

async function deleteTask(userId, taskId) {
  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("user_id", userId);
  
  if (!error) invalidateCache(`tasks_${userId}`);
  return !error;
}

async function getStats(userId) {
  const user = await getUser(userId);
  const classes = await getClasses(userId);
  const tasks = await getTasks(userId, false);
  
  const completed = tasks.filter(t => t.done).length;
  const total = tasks.length;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  return {
    classes: classes.length,
    completed,
    total,
    rate,
    focus: ((user?.total_focus_minutes || 0) / 60).toFixed(1),
    level: user?.level || 1,
    xp: user?.xp || 0
  };
}

async function logStudySession(userId, sessionData) {
  await supabase
    .from("study_sessions")
    .insert({ user_id: userId, ...sessionData });
  
  const user = await getUser(userId);
  await updateUser(userId, {
    total_focus_minutes: (user.total_focus_minutes || 0) + (sessionData.actual_duration || sessionData.planned_duration || 0)
  });
}

// ==================== ICS PARSER ====================
function parseICS(content) {
  const events = [];
  const lines = content.split(/\r?\n/);
  let event = null;
  let currentKey = '';
  let currentValue = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Continuation line (starts with space)
    if (line.startsWith(' ') && currentKey) {
      currentValue += line.substring(1);
      continue;
    }

    // Save previous property
    if (currentKey && event) {
      event[currentKey] = currentValue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      currentKey = '';
      continue;
    }

    if (trimmed === 'BEGIN:VEVENT') {
      event = {};
    } else if (trimmed === 'END:VEVENT') {
      if (event && event.SUMMARY && event.DTSTART) {
        events.push(event);
      }
      event = null;
    } else if (event) {
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx > 0) {
        currentKey = trimmed.substring(0, colonIdx).split(';')[0];
        currentValue = trimmed.substring(colonIdx + 1)
          .replace(/\\,/g, ',')
          .replace(/\\n/g, '\n')
          .replace(/\\\\/g, '\\');
      }
    }
  }

  return events;
}

function parseICSEvent(evt) {
  try {
    const dtstart = evt.DTSTART || '';
    
    let year, month, day, hour = 9, minute = 0;
    
    // Try format: 20260422T093000
    const match = dtstart.match(/(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?/);
    if (!match) return null;
    
    year = parseInt(match[1]);
    month = parseInt(match[2]) - 1;
    day = parseInt(match[3]);
    hour = parseInt(match[4] || '9');
    minute = parseInt(match[5] || '0');

    const date = new Date(year, month, day);
    let weekday = date.getDay();
    weekday = weekday === 0 ? 6 : weekday - 1;

    // End time
    let endHour = (hour + 1) % 24;
    let endMinute = minute;
    
    if (evt.DTEND) {
      const endMatch = evt.DTEND.match(/(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?/);
      if (endMatch) {
        endHour = parseInt(endMatch[4] || String(endHour));
        endMinute = parseInt(endMatch[5] || '0');
      }
    }

    return {
      subject: (evt.SUMMARY || 'Untitled').substring(0, 200),
      day: weekday,
      start_time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      end_time: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
      location: evt.LOCATION?.substring(0, 200) || null
    };
  } catch {
    return null;
  }
}

async function importICSFile(userId, content) {
  const events = parseICS(content);
  
  if (events.length === 0) {
    return { success: false, error: "No valid events found" };
  }

  const existingClasses = await getClasses(userId);
  const existingSet = new Set(
    existingClasses.map(c => `${c.subject}|${c.day}|${c.start_time}`)
  );

  let imported = 0;
  let duplicates = 0;
  let errors = 0;

  for (const evt of events) {
    const classData = parseICSEvent(evt);
    if (!classData) {
      errors++;
      continue;
    }

    const key = `${classData.subject}|${classData.day}|${classData.start_time}`;
    if (existingSet.has(key)) {
      duplicates++;
      continue;
    }

    if (await addClass(userId, classData)) {
      imported++;
      existingSet.add(key);
    } else {
      errors++;
    }
  }

  return { success: true, count: imported, duplicates, errors, total: events.length };
}

// ==================== FOCUS TIMER ====================
const focusTimers = new Map();

async function completeFocus(userId, lang) {
  const timer = focusTimers.get(userId);
  if (!timer) return;

  if (timer.timeout) clearTimeout(timer.timeout);
  if (timer.pomodoroInterval) clearInterval(timer.pomodoroInterval);

  const actualDuration = Math.round((Date.now() - timer.startTime) / 60000);
  focusTimers.delete(userId);

  await logStudySession(userId, {
    subject: timer.subject,
    planned_duration: timer.duration,
    actual_duration: actualDuration,
    type: timer.type || 'focus',
    date: new Date().toISOString().split('T')[0]
  });

  await sendMessage(userId, t('focus_complete', lang, {
    subject: timer.subject,
    duration: actualDuration
  }));
}

function stopFocusTimer(userId, lang) {
  const timer = focusTimers.get(userId);
  if (!timer) return;

  if (timer.timeout) clearTimeout(timer.timeout);
  if (timer.pomodoroInterval) clearInterval(timer.pomodoroInterval);

  const elapsed = Math.round((Date.now() - timer.startTime) / 60000);
  focusTimers.delete(userId);

  logStudySession(userId, {
    subject: timer.subject,
    planned_duration: timer.duration,
    actual_duration: elapsed,
    type: timer.type || 'focus',
    date: new Date().toISOString().split('T')[0]
  }).catch(() => {});

  sendMessage(userId, t('focus_stop', lang, {
    subject: timer.subject,
    elapsed
  }));
}

// ==================== MAIN PROCESSOR ====================
async function processMessage(userId, text, attachments = []) {
  const msg = text.trim();
  const lower = msg.toLowerCase();

  // Get user and detect language
  let user = await getUser(userId);
  let lang = user?.language || detectLang(msg);

  // Auto-detect and save language
  if (!user?.language) {
    const detected = detectLang(msg);
    if (detected !== 'en') {
      await updateUser(userId, { language: detected });
      lang = detected;
    }
  }

  // Handle ICS file attachment
  if (attachments.length > 0) {
    for (const att of attachments) {
      if (att.type === 'doc') {
        const doc = att.doc;
        if (doc?.title?.endsWith('.ics') || doc?.ext === 'ics') {
          await sendMessage(userId, t('import_start', lang));
          try {
            const response = await fetch(doc.url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const content = await response.text();
            const result = await importICSFile(userId, content);
            
            if (result.success) {
              await sendMessage(userId, t('import_done', lang, result), getKeyboard(lang));
            } else {
              await sendMessage(userId, t('import_error', lang, { error: result.error }), getKeyboard(lang));
            }
          } catch (error) {
            await sendMessage(userId, t('import_error', lang, { error: error.message }), getKeyboard(lang));
          }
          return;
        }
      }
    }
  }

  // Process commands
  if (lower.startsWith('/')) {
    const cmd = lower.split(/\s+/)[0].substring(1);
    const parts = msg.split(/\s+/);
    const args = parts.slice(1);

    switch (cmd) {
      case 'help':
        await sendMessage(userId, t('help', lang), getKeyboard(lang));
        break;

      case 'schedule':
        const classes = await getClasses(userId);
        if (classes.length === 0) {
          await sendMessage(userId, t('schedule_empty', lang), getKeyboard(lang));
        } else {
          const byDay = {};
          for (const c of classes) {
            if (!byDay[c.day]) byDay[c.day] = [];
            byDay[c.day].push(c);
          }
          
          const weekdays = T[lang].weekdays;
          let msg = t('schedule_title', lang);
          for (let d = 0; d < 7; d++) {
            if (byDay[d]) {
              msg += `\n📌 *${weekdays[d]}*\n`;
              for (const c of byDay[d]) {
                msg += `  #${c.id} ${c.start_time}-${c.end_time} ${c.subject}`;
                if (c.location) msg += ` (${c.location})`;
                msg += '\n';
              }
            }
          }
          await sendMessage(userId, msg, getKeyboard(lang));
        }
        break;

      case 'today':
        const now = new Date();
        const dayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1;
        const allClasses = await getClasses(userId);
        const todayClasses = allClasses.filter(c => c.day === dayIdx);

        if (todayClasses.length === 0) {
          await sendMessage(userId, t('today_empty', lang), getKeyboard(lang));
        } else {
          const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
          let msg = t('today_title', lang);
          for (const c of todayClasses) {
            const status = c.start_time <= currentTime && c.end_time >= currentTime ? '🟢' :
                          c.start_time > currentTime ? '⏳' : '✅';
            msg += `${status} ${c.start_time}-${c.end_time} ${c.subject}\n`;
          }
          await sendMessage(userId, msg, getKeyboard(lang));
        }
        break;

      case 'tasks':
        const tasks = await getTasks(userId, true);
        if (tasks.length === 0) {
          await sendMessage(userId, t('tasks_empty', lang), getKeyboard(lang));
        } else {
          const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
          tasks.sort((a, b) => (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2));
          
          const emoji = { urgent: '⚡', high: '🔴', medium: '🟡', low: '🟢' };
          let msg = t('tasks_title', lang);
          
          for (const task of tasks.slice(0, 10)) {
            const dueDate = new Date(task.due_date);
            const daysLeft = Math.ceil((dueDate - new Date()) / 86400000);
            const dueStr = daysLeft === 0 ? '⚠️ Today' : daysLeft === 1 ? '📅 Tomorrow' : 
                          daysLeft < 0 ? '❗ Overdue' : `${daysLeft}d left`;
            
            msg += `${emoji[task.priority] || '⚪'} #${task.id} *${task.task}*\n`;
            msg += `   📅 ${task.due_date?.split('T')[0]} (${dueStr})\n\n`;
          }
          
          if (tasks.length > 10) msg += `... and ${tasks.length - 10} more`;
          await sendMessage(userId, msg, getKeyboard(lang));
        }
        break;

      case 'stats':
        const stats = await getStats(userId);
        await sendMessage(userId, t('stats', lang, stats), getKeyboard(lang));
        break;

      case 'settings':
        const u = await getUser(userId);
        const langNames = { en: 'English 🇬🇧', ru: 'Русский 🇷🇺', zh: '中文 🇨🇳' };
        await sendMessage(userId, 
          `⚙️ *Settings*\n\n🌐 Language: ${langNames[u.language] || u.language}\n🔔 Reminder: ${u.notify_offset || 60}min\n⭐ Level: ${u.level || 1} (${u.xp || 0} XP)\n\n/language [en/ru/zh] to change`, 
          getKeyboard(lang));
        break;

      case 'add':
        if (parts.length < 5) {
          await sendMessage(userId, 
            "Format: /add Subject Day StartTime EndTime [Location]\n\nDays: 0=Mon 1=Tue 2=Wed 3=Thu 4=Fri 5=Sat 6=Sun\n\nExample: /add Math 0 09:00 10:30 Room 101", 
            getKeyboard(lang));
        } else {
          const day = parseInt(parts[2]);
          if (isNaN(day) || day < 0 || day > 6) {
            await sendMessage(userId, "❌ Day must be 0-6 (0=Monday)", getKeyboard(lang));
          } else {
            const success = await addClass(userId, {
              subject: parts[1],
              day,
              start_time: parts[3],
              end_time: parts[4],
              location: args.slice(3).join(' ') || null
            });
            if (success) {
              const weekdays = T[lang].weekdays;
              await sendMessage(userId, t('class_added', lang, {
                subject: parts[1],
                day: weekdays[day],
                start: parts[3],
                end: parts[4],
                location: args[3] ? ` (${args.slice(3).join(' ')})` : ''
              }), getKeyboard(lang));
            }
          }
        }
        break;

      case 'task':
        const taskMatch = msg.match(/\/task\s*"([^"]+)"\s+(\d{4}-\d{2}-\d{2})(?:\s+(urgent|high|medium|low))?(?:\s+(\d+))?/i);
        if (!taskMatch) {
          await sendMessage(userId, 
            'Format: /task "Title" YYYY-MM-DD [priority] [minutes]\n\nExample: /task "Math Homework" 2026-05-01 high 60\n\nPriorities: urgent, high, medium, low', 
            getKeyboard(lang));
        } else {
          const [, title, dueDate, priority = 'medium', duration] = taskMatch;
          await addTask(userId, {
            task: title,
            due_date: dueDate,
            priority,
            estimated_duration: duration ? parseInt(duration) : null,
            done: false
          });
          const priorityLabels = T[lang].priorities;
          await sendMessage(userId, t('task_added', lang, {
            title,
            due: dueDate,
            priority: priorityLabels[priority] || priority
          }), getKeyboard(lang));
        }
        break;

      case 'complete':
        const taskId = parseInt(args[0]);
        if (isNaN(taskId)) {
          await sendMessage(userId, "Usage: /complete [task_id]\nFind IDs in /tasks", getKeyboard(lang));
        } else {
          const success = await completeTask(userId, taskId);
          await sendMessage(userId, 
            success ? t('task_completed', lang, { id: taskId }) : t('error_general', lang), 
            getKeyboard(lang));
        }
        break;

      case 'delete':
        const delId = parseInt(args[0]);
        if (isNaN(delId)) {
          await sendMessage(userId, "Usage: /delete [class_id]\nFind IDs in /schedule", getKeyboard(lang));
        } else {
          await deleteClass(userId, delId);
          await sendMessage(userId, t('class_deleted', lang, { id: delId }), getKeyboard(lang));
        }
        break;

      case 'delete_task':
        const dtId = parseInt(args[0]);
        if (isNaN(dtId)) {
          await sendMessage(userId, "Usage: /delete_task [task_id]\nFind IDs in /tasks", getKeyboard(lang));
        } else {
          await deleteTask(userId, dtId);
          await sendMessage(userId, t('task_deleted', lang, { id: dtId }), getKeyboard(lang));
        }
        break;

      case 'upload':
        if (!args[0]) {
          await sendMessage(userId, 
            "Usage: /upload [calendar_url]\n\nOr attach .ics file directly to message\n\nExample: /upload https://example.com/calendar.ics", 
            getKeyboard(lang));
        } else {
          await sendMessage(userId, t('import_start', lang));
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);
            const response = await fetch(args[0], { signal: controller.signal });
            clearTimeout(timeout);
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const content = await response.text();
            const result = await importICSFile(userId, content);
            
            if (result.success) {
              await sendMessage(userId, t('import_done', lang, result), getKeyboard(lang));
            } else {
              await sendMessage(userId, t('import_error', lang, { error: result.error }), getKeyboard(lang));
            }
          } catch (error) {
            await sendMessage(userId, t('import_error', lang, { error: error.message }), getKeyboard(lang));
          }
        }
        break;

      case 'clear_calendar':
        await clearAllClasses(userId);
        await sendMessage(userId, t('calendar_cleared', lang), getKeyboard(lang));
        break;

      case 'focus':
        if (focusTimers.has(userId)) {
          await sendMessage(userId, "Already in focus mode! Use /stop to end.", getKeyboard(lang));
        } else {
          const subject = args[0] || 'Study';
          const duration = Math.min(Math.max(parseInt(args[1]) || 25, 5), 180);
          
          const timer = {
            subject,
            duration,
            startTime: Date.now(),
            type: 'focus'
          };
          
          timer.timeout = setTimeout(() => completeFocus(userId, lang), duration * 60000);
          focusTimers.set(userId, timer);
          
          await sendMessage(userId, t('focus_start', lang, { subject, duration }), getKeyboard(lang));
        }
        break;

      case 'pomodoro':
        if (focusTimers.has(userId)) {
          await sendMessage(userId, "Already in focus mode! Use /stop to end.", getKeyboard(lang));
        } else {
          const pSubject = args[0] || 'Study';
          const cycles = Math.min(Math.max(parseInt(args[1]) || 4, 1), 8);
          const pDuration = cycles * 30; // 25min work + 5min break
          
          const timer = {
            subject: pSubject,
            duration: pDuration,
            startTime: Date.now(),
            type: 'pomodoro',
            pomodoroInterval: null
          };
          
          timer.timeout = setTimeout(() => completeFocus(userId, lang), pDuration * 60000);
          
          // Break reminders every 30 minutes
          let cycleCount = 0;
          timer.pomodoroInterval = setInterval(async () => {
            cycleCount++;
            if (cycleCount >= cycles) {
              clearInterval(timer.pomodoroInterval);
              return;
            }
            await sendMessage(userId, 
              cycleCount % 4 === 0 ? "☕ *Long Break!* 15 min" : "☕ *Short Break* 5 min", 
              getKeyboard(lang));
          }, 30 * 60000);
          
          focusTimers.set(userId, timer);
          await sendMessage(userId, t('pomodoro_start', lang, { cycles }), getKeyboard(lang));
        }
        break;

      case 'stop':
        if (!focusTimers.has(userId)) {
          await sendMessage(userId, "No active focus session.", getKeyboard(lang));
        } else {
          stopFocusTimer(userId, lang);
        }
        break;

      case 'language':
        const newLang = args[0]?.toLowerCase();
        if (!['en', 'ru', 'zh'].includes(newLang)) {
          await sendMessage(userId, "Supported: en, ru, zh\nExample: /language zh", getKeyboard(lang));
        } else {
          await updateUser(userId, { language: newLang });
          await sendMessage(userId, t('language_changed', newLang, { language: newLang }), getKeyboard(newLang));
        }
        break;

      default:
        await sendMessage(userId, t('help', lang), getKeyboard(lang));
    }
    return;
  }

  // Natural language triggers
  const nlp = {
    help: ['help', 'помощь', '帮助'],
    schedule: ['schedule', 'расписание', '课程表'],
    today: ['today', 'сегодня', '今天'],
    tomorrow: ['tomorrow', 'завтра', '明天'],
    tasks: ['tasks', 'задачи', '任务'],
    stats: ['stats', 'статистика', '统计'],
    settings: ['settings', 'настройки', '设置']
  };

  for (const [cmd, triggers] of Object.entries(nlp)) {
    if (triggers.some(t => lower.includes(t))) {
      if (cmd === 'help') {
        await sendMessage(userId, t('help', lang), getKeyboard(lang));
        return;
      }
      if (cmd === 'schedule') {
        const classes = await getClasses(userId);
        if (classes.length === 0) {
          await sendMessage(userId, t('schedule_empty', lang), getKeyboard(lang));
        } else {
          // Same schedule display logic
          const byDay = {};
          for (const c of classes) {
            if (!byDay[c.day]) byDay[c.day] = [];
            byDay[c.day].push(c);
          }
          const weekdays = T[lang].weekdays;
          let msg = t('schedule_title', lang);
          for (let d = 0; d < 7; d++) {
            if (byDay[d]) {
              msg += `\n📌 *${weekdays[d]}*\n`;
              for (const c of byDay[d]) {
                msg += `  ${c.start_time}-${c.end_time} ${c.subject}\n`;
              }
            }
          }
          await sendMessage(userId, msg, getKeyboard(lang));
        }
        return;
      }
      if (cmd === 'today') {
        const now = new Date();
        const dayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1;
        const allClasses = await getClasses(userId);
        const todayClasses = allClasses.filter(c => c.day === dayIdx);
        if (todayClasses.length === 0) {
          await sendMessage(userId, t('today_empty', lang), getKeyboard(lang));
        } else {
          let msg = t('today_title', lang);
          for (const c of todayClasses) {
            msg += `${c.start_time}-${c.end_time} ${c.subject}\n`;
          }
          await sendMessage(userId, msg, getKeyboard(lang));
        }
        return;
      }
      if (cmd === 'tasks') {
        const tasks = await getTasks(userId, true);
        if (tasks.length === 0) {
          await sendMessage(userId, t('tasks_empty', lang), getKeyboard(lang));
        } else {
          let msg = t('tasks_title', lang);
          for (const task of tasks.slice(0, 10)) {
            msg += `#${task.id} ${task.task}\n📅 ${task.due_date?.split('T')[0]}\n\n`;
          }
          await sendMessage(userId, msg, getKeyboard(lang));
        }
        return;
      }
      if (cmd === 'stats') {
        const stats = await getStats(userId);
        await sendMessage(userId, t('stats', lang, stats), getKeyboard(lang));
        return;
      }
      if (cmd === 'settings') {
        const u = await getUser(userId);
        const langNames = { en: 'English', ru: 'Русский', zh: '中文' };
        await sendMessage(userId, 
          `⚙️ *Settings*\n\n🌐 Language: ${langNames[u.language] || u.language}\n⭐ Level: ${u.level || 1}`,
          getKeyboard(lang));
        return;
      }
    }
  }

  // Default greeting
  if (!user?.name) {
    await sendMessage(userId, t('welcome_new', lang));
  } else {
    const now = new Date();
    const dayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const classes = await getClasses(userId);
    const todayClasses = classes.filter(c => c.day === dayIdx);
    const tasks = await getTasks(userId, true);
    
    await sendMessage(userId, t('welcome_back', lang, {
      name: user.name,
      classes_today: todayClasses.length,
      tasks_pending: tasks.length
    }), getKeyboard(lang));
  }
}

// ==================== WEBHOOK HANDLER ====================
export async function handler(event) {
  try {
    const body = JSON.parse(event.body);

    // VK confirmation
    if (body.type === 'confirmation') {
      return {
        statusCode: 200,
        body: VK_CONFIRMATION || 'df7d544c'
      };
    }

    // New message
    if (body.type === 'message_new') {
      const msg = body.object?.message;
      
      // Ignore outgoing messages
      if (!msg || msg.out === 1) {
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }

      const userId = msg.from_id;
      const text = msg.text || '';
      const attachments = msg.attachments || [];

      // Process async - don't block response
      processMessage(userId, text, attachments).catch(err => {
        console.error('Process error:', err);
      });

      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };

  } catch (error) {
    console.error('Handler error:', error);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }
}