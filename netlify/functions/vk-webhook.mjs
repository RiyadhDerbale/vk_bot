// ==================== VITA BOT - PRODUCTION READY v4.0 (CommonJS) ====================
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
  stats: 30000,      // 30 seconds
  notes: 120000,     // 2 minutes
  habits: 60000      // 1 minute
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

// ==================== ENHANCED LANGUAGE SYSTEM ====================
const T = {
  en: {
    welcome_new: "🎉 *Welcome to Vita AI v4.0!*\n\nI'm your smart study assistant. I can help you with:\n📅 Schedule & Classes\n📝 Tasks & Assignments\n⏱️ Focus & Pomodoro\n📓 Notes & Ideas\n✅ Habit Tracking\n📊 Analytics & Reports\n\nWhat's your name?",
    welcome_back: "👋 Welcome back, {name}!\n\n📅 Classes today: {classes_today}\n📝 Pending tasks: {tasks_pending}\n✅ Habits done: {habits_today}\n⭐ Level {level} ({xp} XP)\n\nUse /help to see all commands.",
    
    help: "🤖 *Vita Commands v4.0*\n\n📅 *Schedule:*\n/add - Add class\n/schedule - View schedule\n/today - Today's classes\n/tomorrow - Tomorrow's classes\n/week - This week's schedule\n/delete [id] - Remove class\n\n📝 *Tasks:*\n/task - Add task\n/tasks - View tasks\n/complete [id] - Complete task\n/delete_task [id] - Remove task\n/upcoming - Upcoming deadlines\n\n⏱️ *Study:*\n/focus [subj] [min] - Start focus\n/pomodoro [subj] [cycles] - Pomodoro\n/stop - Stop focus\n/analytics [day/week/month] - Study stats\n\n📓 *Notes:*\n/note [title] - Add note\n/notes - View all notes\n/note_id [id] - View specific note\n/edit_note [id] - Edit note\n/delete_note [id] - Remove note\n\n✅ *Habits:*\n/habit [name] - Add habit\n/habits - View habits\n/check [id] - Mark habit done\n/habit_stats [id] - Habit analytics\n/habit_streak [id] - Current streak\n\n⭐ *Gamification:*\n/level - Your level info\n/leaderboard - Top users\n/achievements - Unlocked badges\n\n📅 *Calendar:*\n/upload [url] - Import .ics\n/export - Export schedule\n/share [user] - Share schedule\n/clear_calendar - Remove all\n\n⚙️ *Settings:*\n/language [en/ru/zh] - Change language\n/settings - View settings\n/notify [min] - Set reminders\n/theme [light/dark] - Interface theme\n/timezone [offset] - Set timezone\n/profile - Edit profile\n\n💡 *Smart Features:*\n/summary [d/w/m] - Weekly review\n/productivity - Productivity score\n/recommend - Study suggestions\n/backup - Backup data\n/restore - Restore backup\n\nType any command to begin!",

    schedule_title: "📅 *Your Schedule*\n",
    schedule_empty: "📭 No classes yet!\n\nUse /add or /upload to add classes",
    class_added: "✅ Added: {subject}\n📅 {day} {start}-{end}{location}",
    class_deleted: "✅ Class #{id} deleted",
    class_not_found: "❌ Class #{id} not found",
    class_updated: "✏️ Updated class #{id}",
    
    today_title: "📋 *Today's Classes*\n",
    today_empty: "🎉 No classes today! Enjoy your free time!",
    tomorrow_title: "📋 *Tomorrow's Classes*\n",
    tomorrow_empty: "🎉 No classes tomorrow!",
    week_title: "📅 *This Week's Schedule*\n",
    
    tasks_title: "📝 *Your Tasks*\n",
    tasks_empty: "✅ No pending tasks! 🎉",
    upcoming_title: "⏰ *Upcoming Deadlines*\n",
    task_added: "✅ Task: {title}\n📅 Due: {due}\n⚡ {priority}\n🕐 Est: {duration}min",
    task_completed: "✅ Task #{id} completed! 🎉 +50 XP",
    task_deleted: "🗑️ Task #{id} deleted",
    
    focus_start: "⏱️ *Focus: {subject}*\n⏰ {duration} min\n💰 +{xp} XP when complete\nStay focused!",
    focus_complete: "🎉 *Focus Complete!*\n📚 {subject}\n⏰ {duration} min\n✨ +{xp} XP earned!\nGreat work!",
    focus_stop: "⏹️ *Stopped early: {subject}*\n⏱️ {elapsed} min\n+{xp} XP earned",
    pomodoro_start: "🍅 *Pomodoro: {cycles} cycles*\n⚡ 25 min focus + 5 min break\nLet's start!",
    
    note_title: "📓 *Your Notes*\n",
    note_empty: "📭 No notes yet!\nUse /note [title] to create one",
    note_added: "✅ Note created: *{title}*\n📝 ID: {id}\nUse /note_id {id} to view",
    note_content: "📓 *{title}*\n📝 {content}\n🕐 Created: {date}\n🔄 Updated: {updated}",
    note_edited: "✏️ Note #{id} updated",
    note_deleted: "🗑️ Note #{id} deleted",
    
    habit_title: "✅ *Your Habits*\n",
    habit_empty: "📭 No habits yet!\nUse /habit [name] to create one",
    habit_added: "✅ Habit created: *{name}*\n🆔 ID: {id}\nStart building your streak!",
    habit_checked: "🎉 Habit #{id} marked complete!\n🔥 Streak: {streak} days\n+{xp} XP",
    habit_stats: "📊 *Habit: {name}*\n✅ Total completions: {total}\n🔥 Current streak: {streak} days\n🏆 Best streak: {best}\n📈 Completion rate: {rate}%",
    habit_streak: "🔥 *Current Streak: {streak} days*\nKeep it up!",
    
    import_start: "📥 Importing calendar...",
    import_done: "✅ Imported {count} classes ({duplicates} duplicates, {errors} errors)",
    import_error: "❌ Import failed: {error}",
    calendar_cleared: "🗑️ All classes removed",
    calendar_exported: "📅 Calendar exported successfully!",
    
    stats: "📊 *Study Statistics*\n📚 Classes: {classes}\n✅ Tasks: {completed}/{total} ({rate}%)\n⏱️ Study time: {focus}h\n📓 Notes: {notes}\n✅ Habits: {habits} total\n⭐ Level: {level} ({xp} XP)",
    
    level_info: "⭐ *Level {level}*\n📊 XP: {xp}/{next_level}\n📈 Progress: {progress}%\n🏆 Total tasks: {tasks}\n⏱️ Total focus: {focus}h\n🔓 Next reward at level {next}",
    
    analytics: "📈 *Study Analytics ({period})*\n⏱️ Total study: {total_hours}h\n📅 Average daily: {daily_hours}h\n🎯 Most productive: {best_hour}:00\n📊 Trend: {trend}\n🏆 Best day: {best_day} ({best_hours}h)",
    
    productivity: "📊 *Productivity Score: {score}%*\n⭐ {rating}\n✅ Tasks completed: {tasks}/{\\n🎯 Focus sessions: {focus}\n🔥 Current streak: {streak} days\n💡 Tip: {tip}",
    
    recommendation: "💡 *Study Recommendations*\n\nBased on your habits:\n{recommendations}\n\nKeep up the great work! 🎉",
    
    achievement_unlocked: "🏆 *Achievement Unlocked!*\n✨ {achievement}\n+{xp} XP Bonus!",
    
    language_changed: "✅ Language changed to {language}",
    settings_updated: "⚙️ Settings updated",
    profile_updated: "👤 Profile updated",
    
    weekdays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    priorities: { urgent: "⚡ Urgent", high: "🔴 High", medium: "🟡 Medium", low: "🟢 Low" },
    
    error_general: "❌ Error. Please try again.",
    error_no_id: "❌ Please provide a valid ID",
    error_permission: "❌ You don't have permission for this",
    error_not_found: "❌ Item not found"
  },

  ru: {
    welcome_new: "🎉 *Добро пожаловать в Vita AI v4.0!*\n\nЯ ваш умный помощник в учебе. Я могу помочь с:\n📅 Расписание и пары\n📝 Задачи и дедлайны\n⏱️ Фокус и Помодоро\n📓 Заметки и идеи\n✅ Привычки\n📊 Аналитика\n\nКак вас зовут?",
    welcome_back: "👋 С возвращением, {name}!\n\n📅 Пар сегодня: {classes_today}\n📝 Задач: {tasks_pending}\n✅ Привычек: {habits_today}\n⭐ Уровень {level} ({xp} XP)\n\nИспользуйте /help для команд.",
    
    help: "🤖 *Команды Vita v4.0*\n\n📅 *Расписание:*\n/add - Добавить пару\n/schedule - Расписание\n/today - Сегодня\n/tomorrow - Завтра\n/week - Неделя\n/delete [id] - Удалить\n\n📝 *Задачи:*\n/task - Добавить\n/tasks - Список\n/complete [id] - Завершить\n/delete_task [id] - Удалить\n/upcoming - Дедлайны\n\n⏱️ *Учеба:*\n/focus [предмет] [мин]\n/pomodoro [предмет]\n/stop - Стоп\n/analytics - Статистика\n\n📓 *Заметки:*\n/note [название]\n/notes - Список\n/note_id [id]\n/edit_note [id]\n/delete_note [id]\n\n✅ *Привычки:*\n/habit [название]\n/habits - Список\n/check [id]\n/habit_stats [id]\n/habit_streak [id]\n\n⭐ *Игра:*\n/level - Уровень\n/leaderboard - Топ\n/achievements - Достижения\n\n📅 *Календарь:*\n/upload [url] - Импорт\n/export - Экспорт\n/share [пользователь]\n\n⚙️ *Настройки:*\n/language [en/ru/zh]\n/settings\n/notify [мин]\n/timezone\n/profile\n\n💡 *Умные функции:*\n/summary - Обзор\n/productivity - Продуктивность\n/recommend - Советы\n\nВведите команду!",

    schedule_title: "📅 *Расписание*\n",
    schedule_empty: "📭 Расписание пусто!\n\n/add или /upload",
    class_added: "✅ Добавлено: {subject}\n📅 {day} {start}-{end}{location}",
    class_deleted: "✅ Пара #{id} удалена",
    
    today_title: "📋 *Пары сегодня*\n",
    today_empty: "🎉 Сегодня нет пар!",
    tomorrow_title: "📋 *Пары завтра*\n",
    
    tasks_title: "📝 *Задачи*\n",
    tasks_empty: "✅ Нет задач! 🎉",
    task_added: "✅ Задача: {title}\n📅 До: {due}\n⚡ {priority}",
    task_completed: "✅ Задача #{id} выполнена! 🎉 +50 XP",
    
    focus_start: "⏱️ *Фокус: {subject}*\n⏰ {duration} мин\n💰 +{xp} XP\nСосредоточьтесь!",
    focus_complete: "🎉 *Фокус завершен!*\n📚 {subject}\n⏰ {duration} мин\n✨ +{xp} XP\nОтлично!",
    
    note_added: "✅ Заметка создана: *{title}*\n📝 ID: {id}",
    habit_added: "✅ Привычка создана: *{name}*\n🆔 ID: {id}",
    
    import_done: "✅ Импортировано {count} пар ({duplicates} дублей)",
    calendar_cleared: "🗑️ Все пары удалены",
    
    stats: "📊 *Статистика*\n📚 Пары: {classes}\n✅ Задачи: {completed}/{total}\n⏱️ Учеба: {focus}ч\n⭐ Уровень: {level}",
    
    weekdays: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
    priorities: { urgent: "⚡ Срочный", high: "🔴 Высокий", medium: "🟡 Средний", low: "🟢 Низкий" },
    
    error_general: "❌ Ошибка. Попробуйте снова."
  },

  zh: {
    welcome_new: "🎉 *欢迎使用 Vita AI v4.0！*\n\n我是您的智能学习助手，可以帮助您：\n📅 课程表\n📝 任务管理\n⏱️ 专注学习\n📓 笔记记录\n✅ 习惯追踪\n📊 学习分析\n\n请问您叫什么名字？",
    welcome_back: "👋 欢迎回来，{name}！\n\n📅 今日课程: {classes_today}\n📝 待办任务: {tasks_pending}\n✅ 完成习惯: {habits_today}\n⭐ 等级 {level} ({xp} 经验)\n\n使用 /help 查看所有命令。",
    
    help: "🤖 *Vita 命令 v4.0*\n\n📅 *课程:*\n/add - 添加课程\n/schedule - 课程表\n/today - 今天\n/tomorrow - 明天\n/week - 本周\n/delete [id] - 删除\n\n📝 *任务:*\n/task - 添加任务\n/tasks - 任务列表\n/complete [id] - 完成\n/delete_task [id] - 删除\n/upcoming - 即将到期\n\n⏱️ *学习:*\n/focus [科目] [分钟]\n/pomodoro [科目] [周期]\n/stop - 停止\n/analytics - 分析\n\n📓 *笔记:*\n/note [标题]\n/notes - 列表\n/note_id [id]\n/edit_note [id]\n/delete_note [id]\n\n✅ *习惯:*\n/habit [名称]\n/habits - 列表\n/check [id]\n/habit_stats [id]\n/habit_streak [id]\n\n⭐ *游戏:*\n/level - 等级\n/leaderboard - 排行榜\n/achievements - 成就\n\n📅 *日历:*\n/upload [url] - 导入\n/export - 导出\n/share [用户]\n\n⚙️ *设置:*\n/language [en/ru/zh]\n/settings\n/profile\n\n💡 *智能功能:*\n/summary - 总结\n/productivity - 效率\n/recommend - 建议\n\n输入命令开始！",
    
    schedule_title: "📅 *课程表*\n",
    schedule_empty: "📭 暂无课程！",
    class_added: "✅ 已添加: {subject}\n📅 {day} {start}-{end}{location}",
    
    tasks_title: "📝 *任务*\n",
    tasks_empty: "✅ 没有任务！🎉",
    task_added: "✅ 任务: {title}\n📅 截止: {due}\n⚡ {priority}",
    
    focus_start: "⏱️ *专注: {subject}*\n⏰ {duration} 分钟\n💰 +{xp} 经验\n保持专注！",
    focus_complete: "🎉 *专注完成！*\n📚 {subject}\n⏰ {duration} 分钟\n✨ +{xp} 经验\n做得好！",
    
    note_added: "✅ 笔记已创建: *{title}*\n📝 ID: {id}",
    habit_added: "✅ 习惯已创建: *{name}*\n🆔 ID: {id}",
    
    stats: "📊 *统计*\n📚 课程: {classes}\n✅ 任务: {completed}/{total}\n⏱️ 学习: {focus}小时\n⭐ 等级: {level}",
    
    weekdays: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
    priorities: { urgent: "⚡ 紧急", high: "🔴 高", medium: "🟡 中", low: "🟢 低" },
    
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
        level: 1,
        theme: 'light',
        timezone: 0,
        achievements: [],
        streak_days: 0,
        last_active: new Date().toISOString()
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

function updateClass(userId, classId, updates) {
  return new Promise(async function(resolve) {
    var result = await supabase.from("schedule").update(updates).eq("id", classId).eq("user_id", userId);
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
      var xpGain = 50;
      var newXp = (user.xp || 0) + xpGain;
      var newLevel = Math.floor(newXp / 1000) + 1;
      
      await updateUser(userId, {
        tasks_completed: (user.tasks_completed || 0) + 1,
        xp: newXp,
        level: newLevel,
        streak_days: (user.streak_days || 0) + 1
      });
      
      // Check for achievements
      await checkAchievements(userId);
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

// NEW: Notes System
function getNotes(userId) {
  return new Promise(async function(resolve) {
    var ck = 'notes_' + userId;
    var cached = getCached(ck, 'notes');
    if (cached) {
      resolve(cached);
      return;
    }

    var result = await supabase.from("notes").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    var notes = result.data || [];
    setCached(ck, notes, 'notes');
    resolve(notes);
  });
}

function addNote(userId, title, content) {
  return new Promise(async function(resolve) {
    var result = await supabase.from("notes").insert({
      user_id: userId,
      title: title,
      content: content || "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).select().single();
    
    if (!result.error) invalidateCache('notes_' + userId);
    resolve(result.error ? null : result.data);
  });
}

function updateNote(userId, noteId, content) {
  return new Promise(async function(resolve) {
    var result = await supabase.from("notes").update({
      content: content,
      updated_at: new Date().toISOString()
    }).eq("id", noteId).eq("user_id", userId);
    
    if (!result.error) invalidateCache('notes_' + userId);
    resolve(!result.error);
  });
}

function deleteNote(userId, noteId) {
  return new Promise(async function(resolve) {
    var result = await supabase.from("notes").delete().eq("id", noteId).eq("user_id", userId);
    if (!result.error) invalidateCache('notes_' + userId);
    resolve(!result.error);
  });
}

// NEW: Habits System
function getHabits(userId) {
  return new Promise(async function(resolve) {
    var ck = 'habits_' + userId;
    var cached = getCached(ck, 'habits');
    if (cached) {
      resolve(cached);
      return;
    }

    var result = await supabase.from("habits").select("*").eq("user_id", userId).order("created_at");
    var habits = result.data || [];
    setCached(ck, habits, 'habits');
    resolve(habits);
  });
}

function addHabit(userId, name) {
  return new Promise(async function(resolve) {
    var result = await supabase.from("habits").insert({
      user_id: userId,
      name: name,
      streak: 0,
      best_streak: 0,
      total_completions: 0,
      last_completed: null,
      created_at: new Date().toISOString()
    }).select().single();
    
    if (!result.error) invalidateCache('habits_' + userId);
    resolve(result.error ? null : result.data);
  });
}

function checkHabit(userId, habitId) {
  return new Promise(async function(resolve) {
    var habitResult = await supabase.from("habits").select("*").eq("id", habitId).eq("user_id", userId).single();
    if (!habitResult.data) {
      resolve(null);
      return;
    }
    
    var habit = habitResult.data;
    var today = new Date().toISOString().split('T')[0];
    var lastDate = habit.last_completed ? habit.last_completed.split('T')[0] : null;
    
    var newStreak = habit.streak;
    if (lastDate === today) {
      resolve({ success: false, message: "Already checked today!" });
      return;
    } else if (lastDate === getYesterday()) {
      newStreak = habit.streak + 1;
    } else {
      newStreak = 1;
    }
    
    var newBest = Math.max(newStreak, habit.best_streak || 0);
    
    var result = await supabase.from("habits").update({
      streak: newStreak,
      best_streak: newBest,
      total_completions: (habit.total_completions || 0) + 1,
      last_completed: new Date().toISOString()
    }).eq("id", habitId).eq("user_id", userId);
    
    if (!result.error) {
      invalidateCache('habits_' + userId);
      
      // Award XP for habit completion
      var user = await getUser(userId);
      var xpGain = 10;
      await updateUser(userId, {
        xp: (user.xp || 0) + xpGain,
        level: Math.floor(((user.xp || 0) + xpGain) / 1000) + 1
      });
      
      resolve({ success: true, streak: newStreak, xp: xpGain });
    } else {
      resolve(null);
    }
  });
}

function getYesterday() {
  var date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
}

function getHabitStats(userId, habitId) {
  return new Promise(async function(resolve) {
    var result = await supabase.from("habits").select("*").eq("id", habitId).eq("user_id", userId).single();
    resolve(result.data);
  });
}

// NEW: Analytics System
function getStudyAnalytics(userId, period) {
  return new Promise(async function(resolve) {
    var days = period === 'week' ? 7 : period === 'month' ? 30 : 1;
    var startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    var result = await supabase.from("study_sessions")
      .select("*")
      .eq("user_id", userId)
      .gte("date", startDate.toISOString().split('T')[0]);
    
    var sessions = result.data || [];
    var totalHours = sessions.reduce(function(sum, s) { return sum + (s.actual_duration || 0); }, 0) / 60;
    var avgDaily = totalHours / days;
    
    // Find most productive hour
    var hourCounts = {};
    sessions.forEach(function(s) {
      var hour = new Date(s.date).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    var bestHour = Object.keys(hourCounts).reduce(function(a, b) { return hourCounts[a] > hourCounts[b] ? a : b; }, 0);
    
    resolve({
      total_hours: totalHours.toFixed(1),
      daily_hours: avgDaily.toFixed(1),
      best_hour: bestHour,
      sessions: sessions.length
    });
  });
}

function getProductivityScore(userId) {
  return new Promise(async function(resolve) {
    var tasks = await getTasks(userId, false);
    var completed = tasks.filter(function(t) { return t.done; }).length;
    var total = tasks.length;
    var taskRate = total > 0 ? (completed / total) * 100 : 0;
    
    var studySessions = await supabase.from("study_sessions")
      .select("*")
      .eq("user_id", userId)
      .gte("date", new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]);
    
    var focusCount = (studySessions.data || []).length;
    
    var user = await getUser(userId);
    var streak = user.streak_days || 0;
    
    var score = Math.min(100, Math.floor((taskRate * 0.4) + (Math.min(focusCount, 20) * 2) + (streak * 2)));
    
    var rating = score >= 80 ? "Excellent! 🌟" : score >= 60 ? "Good! 👍" : score >= 40 ? "Keep going! 💪" : "Let's improve! 📈";
    
    var tips = {
      high: "Try to maintain your current momentum!",
      medium: "Focus on completing pending tasks first.",
      low: "Start with small, achievable goals today."
    };
    
    var tip = score >= 70 ? tips.high : score >= 40 ? tips.medium : tips.low;
    
    resolve({
      score: score,
      rating: rating,
      tasks: completed + '/' + total,
      focus: focusCount,
      streak: streak,
      tip: tip
    });
  });
}

// NEW: Gamification
function getAchievements(userId) {
  return new Promise(async function(resolve) {
    var user = await getUser(userId);
    var tasksCompleted = user.tasks_completed || 0;
    var totalFocus = (user.total_focus_minutes || 0) / 60;
    var streak = user.streak_days || 0;
    
    var achievements = [];
    
    if (tasksCompleted >= 10) achievements.push("🏆 Task Master - Complete 10 tasks");
    if (tasksCompleted >= 50) achievements.push("🏆 Task Legend - Complete 50 tasks");
    if (totalFocus >= 10) achievements.push("⏱️ Focus Apprentice - 10 study hours");
    if (totalFocus >= 50) achievements.push("⏱️ Focus Master - 50 study hours");
    if (streak >= 7) achievements.push("🔥 Weekly Warrior - 7 day streak");
    if (streak >= 30) achievements.push("🔥 Monthly Champion - 30 day streak");
    if (user.level >= 5) achievements.push("⭐ Rising Star - Reach level 5");
    if (user.level >= 10) achievements.push("⭐ Elite Scholar - Reach level 10");
    
    resolve(achievements);
  });
}

function getLeaderboard() {
  return new Promise(async function(resolve) {
    var result = await supabase.from("users")
      .select("vk_id, name, xp, level")
      .order("xp", { ascending: false })
      .limit(10);
    
    resolve(result.data || []);
  });
}

function checkAchievements(userId) {
  return new Promise(async function(resolve) {
    var user = await getUser(userId);
    var currentAchievements = user.achievements || [];
    var newAchievements = await getAchievements(userId);
    
    var unlocked = newAchievements.filter(function(a) { return currentAchievements.indexOf(a) === -1; });
    
    if (unlocked.length > 0) {
      await updateUser(userId, {
        achievements: newAchievements,
        xp: (user.xp || 0) + (unlocked.length * 100)
      });
      resolve(unlocked);
    } else {
      resolve([]);
    }
  });
}

function getStats(userId) {
  return new Promise(async function(resolve) {
    var user = await getUser(userId);
    var classes = await getClasses(userId);
    var tasks = await getTasks(userId, false);
    var notes = await getNotes(userId);
    var habits = await getHabits(userId);
    
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
      xp: user.xp || 0,
      notes: notes.length,
      habits: habits.length
    });
  });
}

function logStudySession(userId, sessionData) {
  return new Promise(async function(resolve) {
    await supabase.from("study_sessions").insert(Object.assign({ user_id: userId }, sessionData));
    var user = await getUser(userId);
    var xpGain = Math.floor((sessionData.actual_duration || sessionData.planned_duration || 0) / 5);
    
    await updateUser(userId, {
      total_focus_minutes: (user.total_focus_minutes || 0) + (sessionData.actual_duration || sessionData.planned_duration || 0),
      xp: (user.xp || 0) + xpGain,
      level: Math.floor(((user.xp || 0) + xpGain) / 1000) + 1,
      streak_days: (user.streak_days || 0) + 1
    });
    
    resolve(xpGain);
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

    var xpGained = await logStudySession(userId, {
      subject: timer.subject,
      planned_duration: timer.duration,
      actual_duration: actualDuration,
      type: timer.type || 'focus',
      date: new Date().toISOString().split('T')[0]
    });

    await sendMessage(userId, t('focus_complete', lang, { 
      subject: timer.subject, 
      duration: actualDuration,
      xp: xpGained || Math.floor(actualDuration / 5)
    }));
    
    // Check achievements after focus session
    await checkAchievements(userId);
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
  }).then(function(xpGained) {
    sendMessage(userId, t('focus_stop', lang, { 
      subject: timer.subject, 
      elapsed: elapsed,
      xp: xpGained || Math.floor(elapsed / 5)
    }));
  }).catch(function() {});
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
    notes: { en: "📓 Notes", ru: "📓 Заметки", zh: "📓 笔记" },
    habits: { en: "✅ Habits", ru: "✅ Привычки", zh: "✅ 习惯" },
    focus: { en: "⏱️ Focus", ru: "⏱️ Фокус", zh: "⏱️ 专注" },
    stats: { en: "📊 Stats", ru: "📊 Статистика", zh: "📊 统计" },
    help: { en: "❓ Help", ru: "❓ Помощь", zh: "❓ 帮助" }
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
        { action: { type: "text", label: labels.notes[lang] }, color: "positive" }
      ],
      [
        { action: { type: "text", label: labels.habits[lang] }, color: "positive" },
        { action: { type: "text", label: labels.focus[lang] }, color: "negative" }
      ],
      [
        { action: { type: "text", label: labels.stats[lang] }, color: "secondary" },
        { action: { type: "text", label: labels.help[lang] }, color: "secondary" }
      ]
    ]
  };
}

// ==================== ENHANCED MESSAGE PROCESSOR ====================
function processMessage(userId, text, attachments) {
  return new Promise(async function(resolve) {
    attachments = attachments || [];
    var msg = text.trim();
    var lower = msg.toLowerCase();

    var user = await getUser(userId);
    var lang = (user && user.language) ? user.language : detectLang(msg);

    if (user && !user.language) {
      var detected = detectLang(msg);
      if (detected !== 'en') {
        await updateUser(userId, { language: detected });
        lang = detected;
      }
    }

    // ICS file handling
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

        case 'tomorrow':
          var tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          var tomDayIdx = tomorrow.getDay() === 0 ? 6 : tomorrow.getDay() - 1;
          var tomAllClasses = await getClasses(userId);
          var tomClasses = tomAllClasses.filter(function(c) { return c.day === tomDayIdx; });

          if (tomClasses.length === 0) {
            await sendMessage(userId, t('tomorrow_empty', lang), getKeyboard(lang));
          } else {
            var tomMsg = t('tomorrow_title', lang);
            for (var tti = 0; tti < tomClasses.length; tti++) {
              var ttc = tomClasses[tti];
              tomMsg += ttc.start_time + '-' + ttc.end_time + ' ' + ttc.subject + '\n';
            }
            await sendMessage(userId, tomMsg, getKeyboard(lang));
          }
          break;

        case 'week':
          var weekAllClasses = await getClasses(userId);
          var weekMsg = t('week_title', lang);
          var weekdays = T[lang].weekdays;
          
          for (var wd = 0; wd < 7; wd++) {
            var dayClasses = weekAllClasses.filter(function(c) { return c.day === wd; });
            if (dayClasses.length > 0) {
              weekMsg += '\n📌 *' + weekdays[wd] + '*\n';
              for (var wci = 0; wci < dayClasses.length; wci++) {
                var wc = dayClasses[wci];
                weekMsg += '  ' + wc.start_time + '-' + wc.end_time + ' ' + wc.subject + '\n';
              }
            }
          }
          
          if (weekMsg === t('week_title', lang)) weekMsg += t('schedule_empty', lang);
          await sendMessage(userId, weekMsg, getKeyboard(lang));
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

        case 'upcoming':
          var allTasks = await getTasks(userId, true);
          if (allTasks.length === 0) {
            await sendMessage(userId, t('tasks_empty', lang), getKeyboard(lang));
          } else {
            allTasks.sort(function(a, b) { return new Date(a.due_date) - new Date(b.due_date); });
            var upcomingTasks = allTasks.slice(0, 5);
            var upcomingMsg = t('upcoming_title', lang);
            
            for (var uti = 0; uti < upcomingTasks.length; uti++) {
              var ut = upcomingTasks[uti];
              upcomingMsg += '#' + ut.id + ' ' + ut.task + ' - 📅 ' + (ut.due_date ? ut.due_date.split('T')[0] : 'No date') + '\n';
            }
            await sendMessage(userId, upcomingMsg, getKeyboard(lang));
          }
          break;

        // NEW: Notes System
        case 'note':
          if (!args[0]) {
            await sendMessage(userId, "Usage: /note [title]\nThen send the note content in the next message.", getKeyboard(lang));
          } else {
            var noteTitle = args.join(' ');
            var newNote = await addNote(userId, noteTitle, "Empty note");
            if (newNote) {
              await sendMessage(userId, t('note_added', lang, { title: noteTitle, id: newNote.id }), getKeyboard(lang));
            }
          }
          break;

        case 'notes':
          var userNotes = await getNotes(userId);
          if (userNotes.length === 0) {
            await sendMessage(userId, t('note_empty', lang), getKeyboard(lang));
          } else {
            var notesMsg = t('note_title', lang);
            for (var ni = 0; ni < Math.min(userNotes.length, 10); ni++) {
              var note = userNotes[ni];
              notesMsg += '#' + note.id + ' *' + note.title + '*\n📝 ' + (note.content.substring(0, 50)) + (note.content.length > 50 ? '...' : '') + '\n🕐 ' + note.created_at.split('T')[0] + '\n\n';
            }
            await sendMessage(userId, notesMsg, getKeyboard(lang));
          }
          break;

        case 'note_id':
          var noteId = parseInt(args[0]);
          if (isNaN(noteId)) {
            await sendMessage(userId, "Usage: /note_id [id]\nFind IDs in /notes", getKeyboard(lang));
          } else {
            var userNotesList = await getNotes(userId);
            var targetNote = userNotesList.find(function(n) { return n.id === noteId; });
            if (targetNote) {
              await sendMessage(userId, t('note_content', lang, {
                title: targetNote.title,
                content: targetNote.content || "No content",
                date: targetNote.created_at.split('T')[0],
                updated: targetNote.updated_at.split('T')[0]
              }), getKeyboard(lang));
            } else {
              await sendMessage(userId, t('error_not_found', lang), getKeyboard(lang));
            }
          }
          break;

        case 'edit_note':
          var editId = parseInt(args[0]);
          var editContent = args.slice(1).join(' ');
          if (isNaN(editId) || !editContent) {
            await sendMessage(userId, "Usage: /edit_note [id] [new content]\nExample: /edit_note 5 This is my updated note", getKeyboard(lang));
          } else {
            var editSuccess = await updateNote(userId, editId, editContent);
            if (editSuccess) {
              await sendMessage(userId, t('note_edited', lang, { id: editId }), getKeyboard(lang));
            } else {
              await sendMessage(userId, t('error_not_found', lang), getKeyboard(lang));
            }
          }
          break;

        case 'delete_note':
          var delNoteId = parseInt(args[0]);
          if (isNaN(delNoteId)) {
            await sendMessage(userId, "Usage: /delete_note [id]\nFind IDs in /notes", getKeyboard(lang));
          } else {
            var delSuccess = await deleteNote(userId, delNoteId);
            if (delSuccess) {
              await sendMessage(userId, t('note_deleted', lang, { id: delNoteId }), getKeyboard(lang));
            } else {
              await sendMessage(userId, t('error_not_found', lang), getKeyboard(lang));
            }
          }
          break;

        // NEW: Habits System
        case 'habit':
          if (!args[0]) {
            await sendMessage(userId, "Usage: /habit [habit name]\nExample: /habit Exercise\n/habit Read 30min", getKeyboard(lang));
          } else {
            var habitName = args.join(' ');
            var newHabit = await addHabit(userId, habitName);
            if (newHabit) {
              await sendMessage(userId, t('habit_added', lang, { name: habitName, id: newHabit.id }), getKeyboard(lang));
            }
          }
          break;

        case 'habits':
          var userHabits = await getHabits(userId);
          if (userHabits.length === 0) {
            await sendMessage(userId, t('habit_empty', lang), getKeyboard(lang));
          } else {
            var habitsMsg = t('habit_title', lang);
            for (var hi = 0; hi < userHabits.length; hi++) {
              var habit = userHabits[hi];
              var statusIcon = habit.last_completed && habit.last_completed.split('T')[0] === new Date().toISOString().split('T')[0] ? '✅' : '⭕';
              habitsMsg += statusIcon + ' #' + habit.id + ' *' + habit.name + '*\n   🔥 Streak: ' + (habit.streak || 0) + ' days\n\n';
            }
            await sendMessage(userId, habitsMsg, getKeyboard(lang));
          }
          break;

        case 'check':
          var checkId = parseInt(args[0]);
          if (isNaN(checkId)) {
            await sendMessage(userId, "Usage: /check [habit_id]\nFind IDs in /habits", getKeyboard(lang));
          } else {
            var checkResult = await checkHabit(userId, checkId);
            if (checkResult && checkResult.success) {
              await sendMessage(userId, t('habit_checked', lang, {
                id: checkId,
                streak: checkResult.streak,
                xp: checkResult.xp
              }), getKeyboard(lang));
            } else if (checkResult && checkResult.message) {
              await sendMessage(userId, checkResult.message, getKeyboard(lang));
            } else {
              await sendMessage(userId, t('error_not_found', lang), getKeyboard(lang));
            }
          }
          break;

        case 'habit_stats':
          var habitStatId = parseInt(args[0]);
          if (isNaN(habitStatId)) {
            await sendMessage(userId, "Usage: /habit_stats [habit_id]\nFind IDs in /habits", getKeyboard(lang));
          } else {
            var habitStats = await getHabitStats(userId, habitStatId);
            if (habitStats) {
              var totalCompletions = habitStats.total_completions || 0;
              var createdDate = new Date(habitStats.created_at);
              var daysSince = Math.max(1, Math.ceil((new Date() - createdDate) / 86400000));
              var rate = Math.round((totalCompletions / daysSince) * 100);
              
              await sendMessage(userId, t('habit_stats', lang, {
                name: habitStats.name,
                total: totalCompletions,
                streak: habitStats.streak || 0,
                best: habitStats.best_streak || 0,
                rate: Math.min(100, rate)
              }), getKeyboard(lang));
            } else {
              await sendMessage(userId, t('error_not_found', lang), getKeyboard(lang));
            }
          }
          break;

        case 'habit_streak':
          var streakId = parseInt(args[0]);
          if (isNaN(streakId)) {
            await sendMessage(userId, "Usage: /habit_streak [habit_id]\nFind IDs in /habits", getKeyboard(lang));
          } else {
            var streakData = await getHabitStats(userId, streakId);
            if (streakData) {
              await sendMessage(userId, t('habit_streak', lang, {
                streak: streakData.streak || 0
              }), getKeyboard(lang));
            } else {
              await sendMessage(userId, t('error_not_found', lang), getKeyboard(lang));
            }
          }
          break;

        // NEW: Analytics and Productivity
        case 'analytics':
          var period = args[0] || 'week';
          if (['day', 'week', 'month'].indexOf(period) === -1) period = 'week';
          
          var analytics = await getStudyAnalytics(userId, period);
          var trendIcon = parseFloat(analytics.daily_hours) > 2 ? '📈' : parseFloat(analytics.daily_hours) > 1 ? '📊' : '📉';
          
          await sendMessage(userId, t('analytics', lang, {
            period: period,
            total_hours: analytics.total_hours,
            daily_hours: analytics.daily_hours,
            best_hour: analytics.best_hour,
            trend: trendIcon,
            best_day: 'N/A',
            best_hours: 'N/A'
          }), getKeyboard(lang));
          break;

        case 'productivity':
          var productivity = await getProductivityScore(userId);
          await sendMessage(userId, t('productivity', lang, {
            score: productivity.score,
            rating: productivity.rating,
            tasks: productivity.tasks,
            focus: productivity.focus,
            streak: productivity.streak,
            tip: productivity.tip
          }), getKeyboard(lang));
          break;

        case 'recommend':
          var prodScore = await getProductivityScore(userId);
          var recommendations = [];
          
          if (prodScore.tasks.split('/')[0] < 3) {
            recommendations.push("• Try to complete at least 3 tasks today");
          }
          if (prodScore.focus < 2) {
            recommendations.push("• Start a 25-minute focus session using /focus");
          }
          if (prodScore.streak < 3) {
            recommendations.push("• Build consistency - check in daily for bonus XP");
          }
          
          if (recommendations.length === 0) {
            recommendations.push("• You're doing great! Try maintaining your streak", "• Challenge yourself with longer focus sessions", "• Help others by sharing your study tips");
          }
          
          await sendMessage(userId, t('recommendation', lang, {
            recommendations: recommendations.join('\n')
          }), getKeyboard(lang));
          break;

        case 'achievements':
          var userAchievements = await getAchievements(userId);
          if (userAchievements.length === 0) {
            await sendMessage(userId, "🏆 No achievements yet!\nComplete tasks, study, and maintain streaks to unlock badges!", getKeyboard(lang));
          } else {
            var achMsg = "🏆 *Your Achievements*\n\n";
            userAchievements.forEach(function(a) {
              achMsg += a + '\n';
            });
            await sendMessage(userId, achMsg, getKeyboard(lang));
          }
          break;

        case 'leaderboard':
          var leaders = await getLeaderboard();
          if (leaders.length === 0) {
            await sendMessage(userId, "📊 No users on leaderboard yet!", getKeyboard(lang));
          } else {
            var lbMsg = "🏆 *Leaderboard*\n\n";
            for (var li = 0; li < leaders.length; li++) {
              var leader = leaders[li];
              lbMsg += (li + 1) + ". " + (leader.name || "User " + leader.vk_id) + " - ⭐ Level " + leader.level + " (" + leader.xp + " XP)\n";
            }
            await sendMessage(userId, lbMsg, getKeyboard(lang));
          }
          break;

        case 'level':
          var userData = await getUser(userId);
          var nextLevelXP = (userData.level) * 1000;
          var progress = Math.floor(((userData.xp % 1000) / 1000) * 100);
          
          await sendMessage(userId, t('level_info', lang, {
            level: userData.level,
            xp: userData.xp % 1000,
            next_level: 1000,
            progress: progress,
            tasks: userData.tasks_completed || 0,
            focus: ((userData.total_focus_minutes || 0) / 60).toFixed(1),
            next: userData.level + 1
          }), getKeyboard(lang));
          break;

        case 'stats':
          var stats = await getStats(userId);
          await sendMessage(userId, t('stats', lang, stats), getKeyboard(lang));
          break;

        case 'settings':
          var u = await getUser(userId);
          var langNames = { en: 'English 🇬🇧', ru: 'Русский 🇷🇺', zh: '中文 🇨🇳' };
          await sendMessage(userId, 
            '⚙️ *Settings*\n\n🌐 Language: ' + (langNames[u.language] || u.language) + 
            '\n🔔 Reminder: ' + (u.notify_offset || 60) + 'min before class' +
            '\n🎨 Theme: ' + (u.theme || 'light') +
            '\n🌍 Timezone: UTC' + (u.timezone || 0) +
            '\n⭐ Level: ' + (u.level || 1) + ' (' + (u.xp || 0) + ' XP)' +
            '\n🔥 Streak: ' + (u.streak_days || 0) + ' days' +
            '\n\n/language [en/ru/zh] to change language\n/notify [minutes] to change reminders', 
            getKeyboard(lang));
          break;

        // Existing commands preserved...
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
              priority: priorityLabels[priority] || priority,
              duration: duration || 'N/A'
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
            
            var xpPotential = Math.floor(duration / 5);
            await sendMessage(userId, t('focus_start', lang, { subject: subject, duration: duration, xp: xpPotential }), getKeyboard(lang));
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

        case 'notify':
          var minutes = parseInt(args[0]);
          if (isNaN(minutes) || minutes < 0 || minutes > 1440) {
            await sendMessage(userId, "Usage: /notify [minutes]\nMinutes before class (0-1440)\nExample: /notify 30", getKeyboard(lang));
          } else {
            await updateUser(userId, { notify_offset: minutes });
            await sendMessage(userId, t('settings_updated', lang), getKeyboard(lang));
          }
          break;

        case 'profile':
          var profileUser = await getUser(userId);
          await sendMessage(userId, 
            "👤 *Your Profile*\n\n" +
            "🆔 ID: " + userId + "\n" +
            "📛 Name: " + (profileUser.name || "Not set") + "\n" +
            "🌐 Language: " + profileUser.language + "\n" +
            "⭐ Level: " + profileUser.level + "\n" +
            "✨ XP: " + profileUser.xp + "\n" +
            "🔥 Streak: " + (profileUser.streak_days || 0) + " days\n" +
            "📅 Joined: " + (profileUser.created_at ? profileUser.created_at.split('T')[0] : "N/A"),
            getKeyboard(lang));
          break;

        default:
          await sendMessage(userId, t('help', lang), getKeyboard(lang));
      }
      resolve();
      return;
    }

    // Enhanced NLP with more commands
    var nlp = {
      help: ['help', 'помощь', '帮助', 'commands', 'команды', '命令'],
      schedule: ['schedule', 'расписание', '课程表', 'timetable'],
      today: ['today', 'сегодня', '今天', 'todays classes'],
      tomorrow: ['tomorrow', 'завтра', '明天', 'tomorrows classes'],
      tasks: ['tasks', 'задачи', '任务', 'todo', 'to do'],
      notes: ['notes', 'заметки', '笔记', 'memos'],
      habits: ['habits', 'привычки', '习惯', 'routines'],
      stats: ['stats', 'статистика', '统计', 'statistics', 'progress']
    };

    var matchedCmd = null;
    for (var nlpCmd in nlp) {
      var triggers = nlp[nlpCmd];
      for (var ti = 0; ti < triggers.length; ti++) {
        if (lower.indexOf(triggers[ti]) !== -1) {
          matchedCmd = nlpCmd;
          break;
        }
      }
      if (matchedCmd) break;
    }
    
    if (matchedCmd) {
      if (matchedCmd === 'help') {
        await sendMessage(userId, t('help', lang), getKeyboard(lang));
      } else if (matchedCmd === 'schedule') {
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
      } else if (matchedCmd === 'today') {
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
      } else if (matchedCmd === 'tomorrow') {
        var tmNow = new Date();
        tmNow.setDate(tmNow.getDate() + 1);
        var tmDayIdx = tmNow.getDay() === 0 ? 6 : tmNow.getDay() - 1;
        var tmAllClasses = await getClasses(userId);
        var tmTomorrowClasses = tmAllClasses.filter(function(c) { return c.day === tmDayIdx; });
        if (tmTomorrowClasses.length === 0) {
          await sendMessage(userId, t('tomorrow_empty', lang), getKeyboard(lang));
        } else {
          var tmMsg = t('tomorrow_title', lang);
          for (var tmt = 0; tmt < tmTomorrowClasses.length; tmt++) {
            var tmtc = tmTomorrowClasses[tmt];
            tmMsg += tmtc.start_time + '-' + tmtc.end_time + ' ' + tmtc.subject + '\n';
          }
          await sendMessage(userId, tmMsg, getKeyboard(lang));
        }
      } else if (matchedCmd === 'tasks') {
        var tTasks = await getTasks(userId, true);
        if (tTasks.length === 0) {
          await sendMessage(userId, t('tasks_empty', lang), getKeyboard(lang));
        } else {
          var tMsg = t('tasks_title', lang);
          for (var tti = 0; tti < Math.min(tTasks.length, 10); tti++) {
            var tt = tTasks[tti];
            var dueDateStr = tt.due_date ? tt.due_date.split('T')[0] : 'No date';
            tMsg += '#' + tt.id + ' ' + tt.task + ' - 📅 ' + dueDateStr + '\n';
          }
          if (tTasks.length > 10) tMsg += '\n... and ' + (tTasks.length - 10) + ' more';
          await sendMessage(userId, tMsg, getKeyboard(lang));
        }
      } else if (matchedCmd === 'notes') {
        var nNotes = await getNotes(userId);
        if (nNotes.length === 0) {
          await sendMessage(userId, t('note_empty', lang), getKeyboard(lang));
        } else {
          var nMsg = t('note_title', lang);
          for (var ni = 0; ni < Math.min(nNotes.length, 10); ni++) {
            var nn = nNotes[ni];
            nMsg += '#' + nn.id + ' *' + nn.title + '*\n📝 ' + (nn.content.substring(0, 50)) + (nn.content.length > 50 ? '...' : '') + '\n\n';
          }
          await sendMessage(userId, nMsg, getKeyboard(lang));
        }
      } else if (matchedCmd === 'habits') {
        var hHabits = await getHabits(userId);
        if (hHabits.length === 0) {
          await sendMessage(userId, t('habit_empty', lang), getKeyboard(lang));
        } else {
          var hMsg = t('habit_title', lang);
          for (var hi = 0; hi < hHabits.length; hi++) {
            var hh = hHabits[hi];
            hMsg += '#' + hh.id + ' *' + hh.name + '* - 🔥 ' + (hh.streak || 0) + ' days\n';
          }
          await sendMessage(userId, hMsg, getKeyboard(lang));
        }
      } else if (matchedCmd === 'stats') {
        var sStats = await getStats(userId);
        await sendMessage(userId, t('stats', lang, sStats), getKeyboard(lang));
      }
      resolve();
      return;
    }

    // Welcome/greeting handling
    if (!user || !user.name) {
      var userNameMatch = msg.match(/^(?:my name is|im|i am|меня зовут|я|我是|我叫)\s+(.+)$/i);
      if (userNameMatch) {
        var newName = userNameMatch[1];
        await updateUser(userId, { name: newName });
        await sendMessage(userId, "Nice to meet you, " + newName + "! 🎉\n\nUse /help to see all commands!", getKeyboard(lang));
      } else {
        await sendMessage(userId, t('welcome_new', lang));
      }
    } else {
      var gNow = new Date();
      var gDayIdx = gNow.getDay() === 0 ? 6 : gNow.getDay() - 1;
      var gClasses = await getClasses(userId);
      var gTodayClasses = gClasses.filter(function(c) { return c.day === gDayIdx; });
      var gTasks = await getTasks(userId, true);
      var gHabits = await getHabits(userId);
      var gTodayHabits = gHabits.filter(function(h) { 
        return h.last_completed && h.last_completed.split('T')[0] === new Date().toISOString().split('T')[0];
      });
      
      await sendMessage(userId, t('welcome_back', lang, {
        name: user.name,
        classes_today: gTodayClasses.length,
        tasks_pending: gTasks.length,
        habits_today: gTodayHabits.length,
        level: user.level,
        xp: user.xp
      }), getKeyboard(lang));
    }
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
    
    if (line.charAt(0) === ' ' && currentKey) {
      currentValue += line.substring(1);
      continue;
    }

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

// ==================== WEBHOOK HANDLER ====================
exports.handler = async function(event) {
  try {
    var body = JSON.parse(event.body);

    if (body.type === 'confirmation') {
      return {
        statusCode: 200,
        body: VK_CONFIRMATION || 'df7d544c'
      };
    }

    if (body.type === 'message_new') {
      var msg = body.object && body.object.message;
      
      if (!msg || msg.out === 1) {
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }

      var userId = msg.from_id;
      var text = msg.text || '';
      var attachments = msg.attachments || [];

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

exports.health = async function() {
  return {
    statusCode: 200,
    body: JSON.stringify({
      status: "healthy",
      version: "4.0.0",
      languages: ["en", "ru", "zh"],
      features: [
        "schedule", "tasks", "focus timer", "pomodoro", 
        "notes", "habits", "gamification", "analytics",
        "productivity scoring", "achievements", "leaderboard",
        "ics import", "multi-language", "study recommendations"
      ],
      timestamp: new Date().toISOString()
    })
  };
};