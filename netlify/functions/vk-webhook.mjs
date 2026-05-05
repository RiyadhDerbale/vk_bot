// ==================== VITA BOT - PRODUCTION READY v3.0 (CommonJS) ====================
const { createClient } = require("@supabase/supabase-js");

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
  user: 300000,      // 5 minutes
  classes: 120000,   // 2 minutes
  tasks: 60000,      // 1 minute
  stats: 30000       // 30 seconds
};

function getCached(key, type) {
  type = type || 'default';
  var item = memoryCache.get(key);
  if (!item) return null;
  if (Date.now() - item.time > (CACHE_TTL[type] || 60000)) {
    memoryCache.delete(key);
    return null;
  }
  return item.data;
}

function setCached(key, data, type) {
  type = type || 'default';
  memoryCache.set(key, { data: data, time: Date.now(), type: type });
}

function invalidateCache(pattern) {
  var keys = memoryCache.keys();
  for (var key of keys) {
    if (key.indexOf(pattern) !== -1) memoryCache.delete(key);
  }
}

// ==================== LANGUAGE SYSTEM ====================
const T = {
  en: {
    welcome_new: "🎉 *Welcome to Vita AI!*\n\nI'm your study assistant. I can help you manage schedules, tasks, and study sessions.\n\nWhat's your name?",
    welcome_back: "👋 Welcome back, {name}!\n\n📅 Classes today: {classes_today}\n📝 Pending tasks: {tasks_pending}\n\nUse /help to see commands.",
    
    help: "🤖 *Vita Commands*\n\n📅 *Schedule:*\n/add - Add class\n/schedule - View schedule\n/today - Today's classes\n/tomorrow - Tomorrow's classes\n/delete [id] - Remove class\n\n📝 *Tasks:*\n/task - Add task\n/tasks - View tasks\n/complete [id] - Complete task\n/delete_task [id] - Remove task\n\n⏱️ *Study:*\n/focus [subj] [min] - Start focus\n/pomodoro [subj] [cycles] - Pomodoro\n/stop - Stop focus\n\n📅 *Calendar:*\n/upload [url] - Import .ics file\n/clear_calendar - Remove all classes\n\n⚙️ *Settings:*\n/language [en/ru/zh] - Change language\n/settings - View settings\n/stats - Statistics\n\nType any command to begin!",

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
    
    help: "🤖 *Команды Vita*\n\n📅 *Расписание:*\n/add - Добавить пару\n/schedule - Расписание\n/today - Сегодня\n/tomorrow - Завтра\n/delete [id] - Удалить\n\n📝 *Задачи:*\n/task - Добавить\n/tasks - Список\n/complete [id] - Завершить\n/delete_task [id] - Удалить\n\n⏱️ *Учеба:*\n/focus [предмет] [мин] - Фокус\n/pomodoro [предмет] [циклы]\n/stop - Стоп\n\n📅 *Календарь:*\n/upload [url] - Импорт .ics\n/clear_calendar - Очистить\n\n⚙️ *Настройки:*\n/language [en/ru/zh] - Язык\n/settings - Настройки\n/stats - Статистика\n\nВведите команду!",

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
    
    help: "🤖 *Vita 命令*\n\n📅 *课程:*\n/add - 添加课程\n/schedule - 课程表\n/today - 今天\n/tomorrow - 明天\n/delete [id] - 删除\n\n📝 *任务:*\n/task - 添加任务\n/tasks - 任务列表\n/complete [id] - 完成\n/delete_task [id] - 删除\n\n⏱️ *学习:*\n/focus [科目] [分钟] - 专注\n/pomodoro [科目] [周期]\n/stop - 停止\n\n📅 *日历:*\n/upload [url] - 导入.ics\n/clear_calendar - 清空\n\n⚙️ *设置:*\n/language [en/ru/zh] - 语言\n/settings - 设置\n/stats - 统计\n\n输入命令开始！",

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

function t(key, lang, params) {
  lang = lang || 'en';
  params = params || {};
  var text = (T[lang] && T[lang][key]) ? T[lang][key] : (T.en[key] || key);
  for (var k in params) {
    text = text.split('{' + k + '}').join(params[k]);
  }
  return text;
}

function detectLang(text) {
  if (!text) return 'en';
  if (/[а-яё]/i.test(text)) return 'ru';
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
  return 'en';
}

// ==================== VK API FUNCTIONS ====================
function vkApi(method, params) {
  return new Promise(async function(resolve) {
    try {
      var url = new URL('https://api.vk.com/method/' + method);
      url.searchParams.append('v', VK_API_VERSION);
      url.searchParams.append('access_token', VK_TOKEN);

      var formData = new URLSearchParams();
      for (var key in params) {
        var value = params[key];
        formData.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
      }

      var response = await fetch(url.toString(), {
        method: 'POST',
        body: formData
      });

      var data = await response.json();
      
      if (data.error) {
        // Rate limit - retry once
        if (data.error.error_code === 9) {
          await new Promise(function(r) { setTimeout(r, 1000); });
          var retryResponse = await fetch(url.toString(), { method: 'POST', body: formData });
          var retryData = await retryResponse.json();
          if (!retryData.error) {
            resolve(retryData.response || retryData);
            return;
          }
        }
        console.error('VK API Error (' + method + '):', data.error.error_msg);
        resolve(null);
        return;
      }
      
      resolve(data.response || data);
    } catch (error) {
      console.error('VK API failed (' + method + '):', error.message);
      resolve(null);
    }
  });
}

function sendMessage(userId, message, keyboard) {
  return new Promise(async function(resolve) {
    // VK message limit is 4096 characters
    if (message.length > 4000) {
      var chunks = [];
      var remaining = message;
      
      while (remaining.length > 4000) {
        var splitAt = remaining.lastIndexOf('\n', 4000);
        if (splitAt === -1 || splitAt < 2000) splitAt = 4000;
        chunks.push(remaining.substring(0, splitAt));
        remaining = remaining.substring(splitAt);
      }
      chunks.push(remaining);
      
      for (var i = 0; i < chunks.length; i++) {
        await vkApi('messages.send', {
          user_id: userId,
          message: chunks[i],
          random_id: Math.floor(Math.random() * 1000000)
        });
      }
      resolve();
      return;
    }

    var params = {
      user_id: userId,
      message: message,
      random_id: Math.floor(Math.random() * 1000000)
    };
    
    if (keyboard) {
      params.keyboard = keyboard;
    }
    
    var result = await vkApi('messages.send', params);
    resolve(result);
  });
}

function getKeyboard(lang) {
  lang = lang || 'en';
  var labels = {
    schedule: { en: "📅 Schedule", ru: "📅 Расписание", zh: "📅 课程表" },
    today: { en: "📋 Today", ru: "📋 Сегодня", zh: "📋 今天" },
    tasks: { en: "📝 Tasks", ru: "📝 Задачи", zh: "📝 任务" },
    next: { en: "⏰ Next", ru: "⏰ Далее", zh: "⏰ 下节课" },
    focus: { en: "⏱️ Focus", ru: "⏱️ Фокус", zh: "⏱️ 专注" },
    stats: { en: "📊 Stats", ru: "📊 Статистика", zh: "📊 统计" },
    help: { en: "❓ Help", ru: "❓ Помощь", zh: "❓ 帮助" },
    settings: { en: "⚙️ Settings", ru: "⚙️ Настройки", zh: "⚙️ 设置" }
  };

  return {
    one_time: false,
    buttons: [
      [
        { action: { type: "text", label: labels.schedule[lang] }, color: "primary" },
        { action: { type: "text", label: labels.today[lang] }, color: "primary" }
      ],
      [
        { action: { type: "text", label: labels.tasks[lang] }, color: "positive" },
        { action: { type: "text", label: labels.next[lang] }, color: "positive" }
      ],
      [
        { action: { type: "text", label: labels.focus[lang] }, color: "negative" },
        { action: { type: "text", label: labels.stats[lang] }, color: "secondary" }
      ],
      [
        { action: { type: "text", label: labels.help[lang] }, color: "secondary" },
        { action: { type: "text", label: labels.settings[lang] }, color: "secondary" }
      ]
    ]
  };
}

// ==================== DATABASE FUNCTIONS ====================
function getUser(userId) {
  return new Promise(async function(resolve) {
    var ck = 'user_' + userId;
    var cached = getCached(ck, 'user');
    if (cached) {
      resolve(cached);
      return;
    }

    var result = await supabase.from("users").select("*").eq("vk_id", userId).single();
    var user = result.data;

    if (!user) {
      var insertResult = await supabase.from("users").insert({
        vk_id: userId,
        language: 'en',
        notify_offset: 60,
        total_focus_minutes: 0,
        tasks_completed: 0,
        xp: 0,
        level: 1
      }).select().single();
      
      if (insertResult.data) {
        setCached(ck, insertResult.data, 'user');
        resolve(insertResult.data);
        return;
      }
      resolve(null);
      return;
    }

    setCached(ck, user, 'user');
    resolve(user);
  });
}

function updateUser(userId, updates) {
  return new Promise(async function(resolve) {
    var result = await supabase.from("users").update(updates).eq("vk_id", userId);
    if (!result.error) invalidateCache('user_' + userId);
    resolve(!result.error);
  });
}

function getClasses(userId) {
  return new Promise(async function(resolve) {
    var ck = 'classes_' + userId;
    var cached = getCached(ck, 'classes');
    if (cached) {
      resolve(cached);
      return;
    }

    var result = await supabase.from("schedule").select("*").eq("user_id", userId).order("day").order("start_time");
    var classes = result.data || [];
    setCached(ck, classes, 'classes');
    resolve(classes);
  });
}

function addClass(userId, classData) {
  return new Promise(async function(resolve) {
    var result = await supabase.from("schedule").insert(Object.assign({ user_id: userId }, classData));
    if (!result.error) invalidateCache('classes_' + userId);
    resolve(!result.error);
  });
}

function deleteClass(userId, classId) {
  return new Promise(async function(resolve) {
    var result = await supabase.from("schedule").delete().eq("id", classId).eq("user_id", userId);
    if (!result.error) invalidateCache('classes_' + userId);
    resolve(!result.error);
  });
}

function clearAllClasses(userId) {
  return new Promise(async function(resolve) {
    var result = await supabase.from("schedule").delete().eq("user_id", userId);
    if (!result.error) invalidateCache('classes_' + userId);
    resolve(!result.error);
  });
}

function getTasks(userId, onlyPending) {
  return new Promise(async function(resolve) {
    if (onlyPending === undefined) onlyPending = true;
    var ck = 'tasks_' + userId + '_' + onlyPending;
    var cached = getCached(ck, 'tasks');
    if (cached) {
      resolve(cached);
      return;
    }

    var query = supabase.from("tasks").select("*").eq("user_id", userId);
    if (onlyPending) query = query.eq("done", false);
    
    var result = await query.order("due_date");
    var tasks = result.data || [];
    setCached(ck, tasks, 'tasks');
    resolve(tasks);
  });
}

function addTask(userId, taskData) {
  return new Promise(async function(resolve) {
    var result = await supabase.from("tasks").insert(Object.assign({ user_id: userId }, taskData));
    if (!result.error) invalidateCache('tasks_' + userId);
    resolve(!result.error);
  });
}

function completeTask(userId, taskId) {
  return new Promise(async function(resolve) {
    var taskResult = await supabase.from("tasks").select("id").eq("id", taskId).eq("user_id", userId).single();
    if (!taskResult.data) {
      resolve(false);
      return;
    }

    var result = await supabase.from("tasks").update({ done: true, completed_at: new Date().toISOString() }).eq("id", taskId).eq("user_id", userId);
    
    if (!result.error) {
      invalidateCache('tasks_' + userId);
      var user = await getUser(userId);
      await updateUser(userId, {
        tasks_completed: (user.tasks_completed || 0) + 1,
        xp: (user.xp || 0) + 50,
        level: Math.floor(((user.xp || 0) + 50) / 1000) + 1
      });
    }
    
    resolve(!result.error);
  });
}

function deleteTask(userId, taskId) {
  return new Promise(async function(resolve) {
    var result = await supabase.from("tasks").delete().eq("id", taskId).eq("user_id", userId);
    if (!result.error) invalidateCache('tasks_' + userId);
    resolve(!result.error);
  });
}

function getStats(userId) {
  return new Promise(async function(resolve) {
    var user = await getUser(userId);
    var classes = await getClasses(userId);
    var tasks = await getTasks(userId, false);
    
    var completed = tasks.filter(function(t) { return t.done; }).length;
    var total = tasks.length;
    var rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    resolve({
      classes: classes.length,
      completed: completed,
      total: total,
      rate: rate,
      focus: ((user.total_focus_minutes || 0) / 60).toFixed(1),
      level: user.level || 1,
      xp: user.xp || 0
    });
  });
}

function logStudySession(userId, sessionData) {
  return new Promise(async function(resolve) {
    await supabase.from("study_sessions").insert(Object.assign({ user_id: userId }, sessionData));
    var user = await getUser(userId);
    await updateUser(userId, {
      total_focus_minutes: (user.total_focus_minutes || 0) + (sessionData.actual_duration || sessionData.planned_duration || 0)
    });
    resolve();
  });
}

// ==================== ICS PARSER ====================
function parseICS(content) {
  var events = [];
  var lines = content.split(/\r?\n/);
  var event = null;
  var currentKey = '';
  var currentValue = '';

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    
    // Continuation line (starts with space)
    if (line.charAt(0) === ' ' && currentKey) {
      currentValue += line.substring(1);
      continue;
    }

    // Save previous property
    if (currentKey && event) {
      event[currentKey] = currentValue;
    }

    var trimmed = line.trim();
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
      var colonIdx = trimmed.indexOf(':');
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
    var dtstart = evt.DTSTART || '';
    
    var year, month, day, hour = 9, minute = 0;
    
    var match = dtstart.match(/(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?/);
    if (!match) return null;
    
    year = parseInt(match[1]);
    month = parseInt(match[2]) - 1;
    day = parseInt(match[3]);
    hour = parseInt(match[4] || '9');
    minute = parseInt(match[5] || '0');

    var date = new Date(year, month, day);
    var weekday = date.getDay();
    weekday = weekday === 0 ? 6 : weekday - 1;

    var endHour = (hour + 1) % 24;
    var endMinute = minute;
    
    if (evt.DTEND) {
      var endMatch = evt.DTEND.match(/(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?/);
      if (endMatch) {
        endHour = parseInt(endMatch[4] || String(endHour));
        endMinute = parseInt(endMatch[5] || '0');
      }
    }

    return {
      subject: (evt.SUMMARY || 'Untitled').substring(0, 200),
      day: weekday,
      start_time: String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0'),
      end_time: String(endHour).padStart(2, '0') + ':' + String(endMinute).padStart(2, '0'),
      location: evt.LOCATION ? evt.LOCATION.substring(0, 200) : null
    };
  } catch (e) {
    return null;
  }
}

function importICSFile(userId, content) {
  return new Promise(async function(resolve) {
    var events = parseICS(content);
    
    if (events.length === 0) {
      resolve({ success: false, error: "No valid events found" });
      return;
    }

    var existingClasses = await getClasses(userId);
    var existingSet = new Set(
      existingClasses.map(function(c) { return c.subject + '|' + c.day + '|' + c.start_time; })
    );

    var imported = 0;
    var duplicates = 0;
    var errors = 0;

    for (var i = 0; i < events.length; i++) {
      var classData = parseICSEvent(events[i]);
      if (!classData) {
        errors++;
        continue;
      }

      var key = classData.subject + '|' + classData.day + '|' + classData.start_time;
      if (existingSet.has(key)) {
        duplicates++;
        continue;
      }

      var success = await addClass(userId, classData);
      if (success) {
        imported++;
        existingSet.add(key);
      } else {
        errors++;
      }
    }

    resolve({ success: true, count: imported, duplicates: duplicates, errors: errors, total: events.length });
  });
}

// ==================== FOCUS TIMER ====================
var focusTimers = new Map();

function completeFocus(userId, lang) {
  return new Promise(async function(resolve) {
    var timer = focusTimers.get(userId);
    if (!timer) { resolve(); return; }

    if (timer.timeout) clearTimeout(timer.timeout);
    if (timer.pomodoroInterval) clearInterval(timer.pomodoroInterval);

    var actualDuration = Math.round((Date.now() - timer.startTime) / 60000);
    focusTimers.delete(userId);

    await logStudySession(userId, {
      subject: timer.subject,
      planned_duration: timer.duration,
      actual_duration: actualDuration,
      type: timer.type || 'focus',
      date: new Date().toISOString().split('T')[0]
    });

    await sendMessage(userId, t('focus_complete', lang, { subject: timer.subject, duration: actualDuration }));
    resolve();
  });
}

function stopFocusTimer(userId, lang) {
  var timer = focusTimers.get(userId);
  if (!timer) return;

  if (timer.timeout) clearTimeout(timer.timeout);
  if (timer.pomodoroInterval) clearInterval(timer.pomodoroInterval);

  var elapsed = Math.round((Date.now() - timer.startTime) / 60000);
  focusTimers.delete(userId);

  logStudySession(userId, {
    subject: timer.subject,
    planned_duration: timer.duration,
    actual_duration: elapsed,
    type: timer.type || 'focus',
    date: new Date().toISOString().split('T')[0]
  }).catch(function() {});

  sendMessage(userId, t('focus_stop', lang, { subject: timer.subject, elapsed: elapsed }));
}

// ==================== MAIN MESSAGE PROCESSOR ====================
function processMessage(userId, text, attachments) {
  return new Promise(async function(resolve) {
    attachments = attachments || [];
    var msg = text.trim();
    var lower = msg.toLowerCase();

    // Get user and detect language
    var user = await getUser(userId);
    var lang = (user && user.language) ? user.language : detectLang(msg);

    // Auto-detect and save language
    if (user && !user.language) {
      var detected = detectLang(msg);
      if (detected !== 'en') {
        await updateUser(userId, { language: detected });
        lang = detected;
      }
    }

    // Handle ICS file attachment
    if (attachments.length > 0) {
      for (var ai = 0; ai < attachments.length; ai++) {
        var att = attachments[ai];
        if (att.type === 'doc') {
          var doc = att.doc;
          if (doc && (doc.title && doc.title.endsWith('.ics')) || (doc.ext === 'ics')) {
            await sendMessage(userId, t('import_start', lang));
            try {
              var response = await fetch(doc.url);
              if (!response.ok) throw new Error('HTTP ' + response.status);
              var content = await response.text();
              var result = await importICSFile(userId, content);
              
              if (result.success) {
                await sendMessage(userId, t('import_done', lang, result), getKeyboard(lang));
              } else {
                await sendMessage(userId, t('import_error', lang, { error: result.error }), getKeyboard(lang));
              }
            } catch (error) {
              await sendMessage(userId, t('import_error', lang, { error: error.message }), getKeyboard(lang));
            }
            resolve();
            return;
          }
        }
      }
    }

    // Process commands
    if (lower.charAt(0) === '/') {
      var cmd = lower.split(/\s+/)[0].substring(1);
      var parts = msg.split(/\s+/);
      var args = parts.slice(1);

      switch (cmd) {
        case 'help':
          await sendMessage(userId, t('help', lang), getKeyboard(lang));
          break;

        case 'schedule':
          var classes = await getClasses(userId);
          if (classes.length === 0) {
            await sendMessage(userId, t('schedule_empty', lang), getKeyboard(lang));
          } else {
            var byDay = {};
            for (var ci = 0; ci < classes.length; ci++) {
              var c = classes[ci];
              if (!byDay[c.day]) byDay[c.day] = [];
              byDay[c.day].push(c);
            }
            
            var weekdays = T[lang].weekdays;
            var scheduleMsg = t('schedule_title', lang);
            for (var d = 0; d < 7; d++) {
              if (byDay[d]) {
                scheduleMsg += '\n📌 *' + weekdays[d] + '*\n';
                for (var cj = 0; cj < byDay[d].length; cj++) {
                  var cls = byDay[d][cj];
                  scheduleMsg += '  #' + cls.id + ' ' + cls.start_time + '-' + cls.end_time + ' ' + cls.subject;
                  if (cls.location) scheduleMsg += ' (' + cls.location + ')';
                  scheduleMsg += '\n';
                }
              }
            }
            await sendMessage(userId, scheduleMsg, getKeyboard(lang));
          }
          break;

        case 'today':
          var now = new Date();
          var dayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1;
          var allClasses = await getClasses(userId);
          var todayClasses = allClasses.filter(function(c) { return c.day === dayIdx; });

          if (todayClasses.length === 0) {
            await sendMessage(userId, t('today_empty', lang), getKeyboard(lang));
          } else {
            var currentTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
            var todayMsg = t('today_title', lang);
            for (var ti = 0; ti < todayClasses.length; ti++) {
              var tc = todayClasses[ti];
              var status = tc.start_time <= currentTime && tc.end_time >= currentTime ? '🟢' :
                          tc.start_time > currentTime ? '⏳' : '✅';
              todayMsg += status + ' ' + tc.start_time + '-' + tc.end_time + ' ' + tc.subject + '\n';
            }
            await sendMessage(userId, todayMsg, getKeyboard(lang));
          }
          break;

        case 'tasks':
          var tasks = await getTasks(userId, true);
          if (tasks.length === 0) {
            await sendMessage(userId, t('tasks_empty', lang), getKeyboard(lang));
          } else {
            var priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
            tasks.sort(function(a, b) {
              return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
            });
            
            var emoji = { urgent: '⚡', high: '🔴', medium: '🟡', low: '🟢' };
            var tasksMsg = t('tasks_title', lang);
            
            for (var ti = 0; ti < Math.min(tasks.length, 10); ti++) {
              var task = tasks[ti];
              var dueDate = new Date(task.due_date);
              var daysLeft = Math.ceil((dueDate - new Date()) / 86400000);
              var dueStr = daysLeft === 0 ? '⚠️ Today' : daysLeft === 1 ? '📅 Tomorrow' : 
                          daysLeft < 0 ? '❗ Overdue' : daysLeft + 'd left';
              
              tasksMsg += (emoji[task.priority] || '⚪') + ' #' + task.id + ' *' + task.task + '*\n';
              tasksMsg += '   📅 ' + (task.due_date ? task.due_date.split('T')[0] : 'N/A') + ' (' + dueStr + ')\n\n';
            }
            
            if (tasks.length > 10) tasksMsg += '... and ' + (tasks.length - 10) + ' more';
            await sendMessage(userId, tasksMsg, getKeyboard(lang));
          }
          break;

        case 'stats':
          var stats = await getStats(userId);
          await sendMessage(userId, t('stats', lang, stats), getKeyboard(lang));
          break;

        case 'settings':
          var u = await getUser(userId);
          var langNames = { en: 'English 🇬🇧', ru: 'Русский 🇷🇺', zh: '中文 🇨🇳' };
          await sendMessage(userId, 
            '⚙️ *Settings*\n\n🌐 Language: ' + (langNames[u.language] || u.language) + '\n🔔 Reminder: ' + (u.notify_offset || 60) + 'min\n⭐ Level: ' + (u.level || 1) + ' (' + (u.xp || 0) + ' XP)\n\n/language [en/ru/zh] to change', 
            getKeyboard(lang));
          break;

        case 'add':
          if (parts.length < 5) {
            await sendMessage(userId, 
              "Format: /add Subject Day StartTime EndTime [Location]\n\nDays: 0=Mon 1=Tue 2=Wed 3=Thu 4=Fri 5=Sat 6=Sun\n\nExample: /add Math 0 09:00 10:30 Room 101", 
              getKeyboard(lang));
          } else {
            var day = parseInt(parts[2]);
            if (isNaN(day) || day < 0 || day > 6) {
              await sendMessage(userId, "❌ Day must be 0-6 (0=Monday)", getKeyboard(lang));
            } else {
              var success = await addClass(userId, {
                subject: parts[1],
                day: day,
                start_time: parts[3],
                end_time: parts[4],
                location: args.slice(3).join(' ') || null
              });
              if (success) {
                var wdays = T[lang].weekdays;
                await sendMessage(userId, t('class_added', lang, {
                  subject: parts[1],
                  day: wdays[day],
                  start: parts[3],
                  end: parts[4],
                  location: args[3] ? ' (' + args.slice(3).join(' ') + ')' : ''
                }), getKeyboard(lang));
              }
            }
          }
          break;

        case 'task':
          var taskMatch = msg.match(/\/task\s*"([^"]+)"\s+(\d{4}-\d{2}-\d{2})(?:\s+(urgent|high|medium|low))?(?:\s+(\d+))?/i);
          if (!taskMatch) {
            await sendMessage(userId, 
              'Format: /task "Title" YYYY-MM-DD [priority] [minutes]\n\nExample: /task "Math Homework" 2026-05-01 high 60\n\nPriorities: urgent, high, medium, low', 
              getKeyboard(lang));
          } else {
            var title = taskMatch[1];
            var dueDate = taskMatch[2];
            var priority = taskMatch[3] || 'medium';
            var duration = taskMatch[4];
            await addTask(userId, {
              task: title,
              due_date: dueDate,
              priority: priority,
              estimated_duration: duration ? parseInt(duration) : null,
              done: false
            });
            var priorityLabels = T[lang].priorities;
            await sendMessage(userId, t('task_added', lang, {
              title: title,
              due: dueDate,
              priority: priorityLabels[priority] || priority
            }), getKeyboard(lang));
          }
          break;

        case 'complete':
          var taskId = parseInt(args[0]);
          if (isNaN(taskId)) {
            await sendMessage(userId, "Usage: /complete [task_id]\nFind IDs in /tasks", getKeyboard(lang));
          } else {
            var compSuccess = await completeTask(userId, taskId);
            await sendMessage(userId, 
              compSuccess ? t('task_completed', lang, { id: taskId }) : t('error_general', lang), 
              getKeyboard(lang));
          }
          break;

        case 'delete':
          var delId = parseInt(args[0]);
          if (isNaN(delId)) {
            await sendMessage(userId, "Usage: /delete [class_id]\nFind IDs in /schedule", getKeyboard(lang));
          } else {
            await deleteClass(userId, delId);
            await sendMessage(userId, t('class_deleted', lang, { id: delId }), getKeyboard(lang));
          }
          break;

        case 'delete_task':
          var dtId = parseInt(args[0]);
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
              var controller = new AbortController();
              var timeout = setTimeout(function() { controller.abort(); }, 15000);
              var response = await fetch(args[0], { signal: controller.signal });
              clearTimeout(timeout);
              
              if (!response.ok) throw new Error('HTTP ' + response.status);
              
              var icsContent = await response.text();
              var importResult = await importICSFile(userId, icsContent);
              
              if (importResult.success) {
                await sendMessage(userId, t('import_done', lang, importResult), getKeyboard(lang));
              } else {
                await sendMessage(userId, t('import_error', lang, { error: importResult.error }), getKeyboard(lang));
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
            var subject = args[0] || 'Study';
            var duration = Math.min(Math.max(parseInt(args[1]) || 25, 5), 180);
            
            var timer = {
              subject: subject,
              duration: duration,
              startTime: Date.now(),
              type: 'focus'
            };
            
            timer.timeout = setTimeout(function() { completeFocus(userId, lang); }, duration * 60000);
            focusTimers.set(userId, timer);
            
            await sendMessage(userId, t('focus_start', lang, { subject: subject, duration: duration }), getKeyboard(lang));
          }
          break;

        case 'pomodoro':
          if (focusTimers.has(userId)) {
            await sendMessage(userId, "Already in focus mode! Use /stop to end.", getKeyboard(lang));
          } else {
            var pSubject = args[0] || 'Study';
            var cycles = Math.min(Math.max(parseInt(args[1]) || 4, 1), 8);
            var pDuration = cycles * 30;
            
            var pomodoroTimer = {
              subject: pSubject,
              duration: pDuration,
              startTime: Date.now(),
              type: 'pomodoro',
              pomodoroInterval: null
            };
            
            pomodoroTimer.timeout = setTimeout(function() { completeFocus(userId, lang); }, pDuration * 60000);
            
            var cycleCount = 0;
            pomodoroTimer.pomodoroInterval = setInterval(async function() {
              cycleCount++;
              if (cycleCount >= cycles) {
                clearInterval(pomodoroTimer.pomodoroInterval);
                return;
              }
              await sendMessage(userId, 
                cycleCount % 4 === 0 ? "☕ *Long Break!* 15 min" : "☕ *Short Break* 5 min", 
                getKeyboard(lang));
            }, 30 * 60000);
            
            focusTimers.set(userId, pomodoroTimer);
            await sendMessage(userId, t('pomodoro_start', lang, { cycles: cycles }), getKeyboard(lang));
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
          var newLang = args[0] ? args[0].toLowerCase() : '';
          if (['en', 'ru', 'zh'].indexOf(newLang) === -1) {
            await sendMessage(userId, "Supported: en, ru, zh\nExample: /language zh", getKeyboard(lang));
          } else {
            await updateUser(userId, { language: newLang });
            await sendMessage(userId, t('language_changed', newLang, { language: newLang }), getKeyboard(newLang));
          }
          break;

        default:
          await sendMessage(userId, t('help', lang), getKeyboard(lang));
      }
      resolve();
      return;
    }

    // Natural language triggers
    var nlp = {
      help: ['help', 'помощь', '帮助'],
      schedule: ['schedule', 'расписание', '课程表'],
      today: ['today', 'сегодня', '今天'],
      tasks: ['tasks', 'задачи', '任务'],
      stats: ['stats', 'статистика', '统计']
    };

    for (var nlpCmd in nlp) {
      var triggers = nlp[nlpCmd];
      var matched = false;
      for (var ti = 0; ti < triggers.length; ti++) {
        if (lower.indexOf(triggers[ti]) !== -1) {
          matched = true;
          break;
        }
      }
      
      if (matched) {
        if (nlpCmd === 'help') {
          await sendMessage(userId, t('help', lang), getKeyboard(lang));
        } else if (nlpCmd === 'schedule') {
          var sClasses = await getClasses(userId);
          if (sClasses.length === 0) {
            await sendMessage(userId, t('schedule_empty', lang), getKeyboard(lang));
          } else {
            var sByDay = {};
            for (var si = 0; si < sClasses.length; si++) {
              var sc = sClasses[si];
              if (!sByDay[sc.day]) sByDay[sc.day] = [];
              sByDay[sc.day].push(sc);
            }
            var sWeekdays = T[lang].weekdays;
            var sMsg = t('schedule_title', lang);
            for (var sd = 0; sd < 7; sd++) {
              if (sByDay[sd]) {
                sMsg += '\n📌 *' + sWeekdays[sd] + '*\n';
                for (var sj = 0; sj < sByDay[sd].length; sj++) {
                  var scls = sByDay[sd][sj];
                  sMsg += '  ' + scls.start_time + '-' + scls.end_time + ' ' + scls.subject + '\n';
                }
              }
            }
            await sendMessage(userId, sMsg, getKeyboard(lang));
          }
        } else if (nlpCmd === 'today') {
          var tNow = new Date();
          var tDayIdx = tNow.getDay() === 0 ? 6 : tNow.getDay() - 1;
          var tAllClasses = await getClasses(userId);
          var tTodayClasses = tAllClasses.filter(function(c) { return c.day === tDayIdx; });
          if (tTodayClasses.length === 0) {
            await sendMessage(userId, t('today_empty', lang), getKeyboard(lang));
          } else {
            var tMsg = t('today_title', lang);
            for (var tti = 0; tti < tTodayClasses.length; tti++) {
              var ttc = tTodayClasses[tti];
              tMsg += ttc.start_time + '-' + ttc.end_time + ' ' + ttc.subject + '\n';
            }
            await sendMessage(userId, tMsg, getKeyboard(lang));
          }
        } else if (nlpCmd === 'tasks') {
          var tTasks = await getTasks(userId, true);
          if (tTasks.length === 0) {
            await sendMessage(userId, t('tasks_empty', lang), getKeyboard(lang));
          } else {
            var tMsg = t('tasks_title', lang);
            for (var tti = 0; tti < Math.min(tTasks.length, 10); tti++) {
              var tt = tTasks[tti];
              tMsg += '#' + tt.id + ' ' + tt.task + '\n📅 ' + (tt.due_date ? tt.due_date.split('T')[0] : 'N/A') + '\n\n';
            }
            await sendMessage(userId, tMsg, getKeyboard(lang));
          }
        } else if (nlpCmd === 'stats') {
          var tStats = await getStats(userId);
          await sendMessage(userId, t('stats', lang, tStats), getKeyboard(lang));
        }
        resolve();
        return;
      }
    }

    // Default greeting
    if (!user || !user.name) {
      await sendMessage(userId, t('welcome_new', lang));
    } else {
      var gNow = new Date();
      var gDayIdx = gNow.getDay() === 0 ? 6 : gNow.getDay() - 1;
      var gClasses = await getClasses(userId);
      var gTodayClasses = gClasses.filter(function(c) { return c.day === gDayIdx; });
      var gTasks = await getTasks(userId, true);
      
      await sendMessage(userId, t('welcome_back', lang, {
        name: user.name,
        classes_today: gTodayClasses.length,
        tasks_pending: gTasks.length
      }), getKeyboard(lang));
    }
    resolve();
  });
}

// ==================== WEBHOOK HANDLER ====================
exports.handler = async function(event) {
  try {
    var body = JSON.parse(event.body);

    // VK Server confirmation
    if (body.type === 'confirmation') {
      return {
        statusCode: 200,
        body: VK_CONFIRMATION || 'df7d544c'
      };
    }

    // Handle new message
    if (body.type === 'message_new') {
      var msg = body.object && body.object.message;
      
      // Ignore outgoing messages
      if (!msg || msg.out === 1) {
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }

      var userId = msg.from_id;
      var text = msg.text || '';
      var attachments = msg.attachments || [];

      // Process async
      processMessage(userId, text, attachments).catch(function(err) {
        console.error('Process error:', err);
      });

      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };

  } catch (error) {
    console.error('Handler error:', error);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }
};

// Health check
exports.health = async function() {
  return {
    statusCode: 200,
    body: JSON.stringify({
      status: "healthy",
      version: "3.0.0",
      languages: ["en", "ru", "zh"],
      timestamp: new Date().toISOString()
    })
  };
};