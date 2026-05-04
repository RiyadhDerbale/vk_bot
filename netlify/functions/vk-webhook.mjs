

// ==================== VITA BOT - MULTI-LANGUAGE WITH ENHANCED FEATURES ====================
import { createClient } from "@supabase/supabase-js";

// ==================== CONFIGURATION ====================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const VK_TOKEN = process.env.VK_TOKEN;
const VK_CONFIRMATION = process.env.VK_CONFIRMATION_TOKEN;
const VK_API_VERSION = "5.199";

// ==================== ENHANCED CACHE SYSTEM ====================
class CacheManager {
  constructor() {
    this.cache = new Map();
    this.ttl = {
      user: 300000,      // 5 minutes
      classes: 120000,   // 2 minutes
      tasks: 60000,      // 1 minute
      stats: 30000,      // 30 seconds
      ics: 60000         // 1 minute
    };
    this.maxSize = 1000;
    this.hits = 0;
    this.misses = 0;
  }

  get(key, type = 'default') {
    const item = this.cache.get(key);
    if (!item) {
      this.misses++;
      return null;
    }
    if (Date.now() - item.time > (this.ttl[type] || 60000)) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    this.hits++;
    return item.data;
  }

  set(key, data, type = 'default') {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, { data, time: Date.now(), type });
  }

  invalidate(pattern) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) this.cache.delete(key);
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: ((this.hits / (this.hits + this.misses || 1)) * 100).toFixed(1) + '%'
    };
  }
}

const cache = new CacheManager();

// ==================== COMPLETE LANGUAGE SYSTEM ====================
const LANGS = {
  en: {
    // Welcome & Onboarding
    welcome_new: "🎉 *Welcome to Vita AI!*\n\nI'm your intelligent study companion.\n\n✨ *Features:*\n• Schedule management\n• Task tracking with deadlines\n• Focus timer with Pomodoro\n• Calendar import (.ics)\n• Multi-language support\n• Study analytics\n\nWhat's your name?",
    welcome_back: "👋 Welcome back, {name}!\n\n📅 Classes today: {classes_today}\n📝 Pending tasks: {tasks_pending}\n🔥 Streak: {streak} days\n\nReady to be productive?",
    
    // Help & Commands
    help: `🤖 *Vita AI Commands*

📅 *Schedule Management*
/add - Add a class
/schedule - View full schedule
/today - Today's classes
/tomorrow - Tomorrow's classes
/next - Next upcoming class
/delete [id] - Remove class
/edit [id] - Edit class

📝 *Task Management*
/task - Add new task
/tasks - View all tasks
/complete [id] - Mark task done
/delete_task [id] - Remove task
/deadlines - Upcoming deadlines

📅 *Calendar Import*
/upload [url] - Import from URL
/ics - Import attached .ics file
/calendar_status - View import history
/clear_calendar - Remove all classes

⏱️ *Focus & Study*
/focus [subject] [minutes] - Start focus
/pomodoro [subject] [cycles] - Pomodoro mode
/stop - Stop focus session
/study_stats - Study session history

📊 *Analytics*
/stats - Quick statistics
/analytics - Detailed analytics
/weekly_report - Weekly summary
/productivity - Productivity score

⚙️ *Settings*
/settings - View settings
/language [en/ru/zh] - Change language
/timezone - Set timezone
/notifications - Reminder settings

🧠 *AI Features*
/optimize - Optimize schedule
/tips - Study tips
/summarize - Summarize schedule

👥 *Social*
/group_create [name] - Create study group
/group_join [code] - Join group
/group_members - View members

Type any command to begin!`,

    // Schedule
    schedule_title: "📅 *Your Schedule*\n\n",
    schedule_empty: "📭 No classes yet!\n\n• Use /add to create classes\n• Use /upload to import calendar\n• Attach .ics file directly",
    class_added: "✅ Added: {subject}\n📅 {day} {start}-{end}{location}",
    class_deleted: "✅ Class #{id} deleted",
    class_edited: "✅ Class #{id} updated",
    class_not_found: "❌ Class #{id} not found",
    
    // Today/Tomorrow
    today_title: "📋 *Today's Schedule* ({date})\n\n",
    today_empty: "🎉 No classes today!\n\n💡 Tip: Use free time for focused study!",
    tomorrow_title: "📅 *Tomorrow's Schedule* ({date})\n\n",
    tomorrow_empty: "🎉 No classes tomorrow!",
    
    // Tasks
    tasks_title: "📝 *Your Tasks*\n\n",
    tasks_empty: "✅ All caught up! No pending tasks! 🎉",
    task_added: "✅ Task added!\n📌 {title}\n📅 Due: {due}\n⚡ Priority: {priority}\n⏱️ Estimated: {duration}min",
    task_completed: "✅ Task #{id} completed! 🎉\n\nKeep up the momentum!",
    task_deleted: "🗑️ Task #{id} deleted",
    deadlines_title: "⚠️ *Upcoming Deadlines*\n\n",
    
    // Focus & Study
    focus_start: "⏱️ *Focus Mode Activated!*\n\n📖 {subject}\n⏰ {duration} minutes\n🍅 {type}\n\nMinimize distractions and concentrate!",
    focus_complete: "🎉 *Focus Session Complete!*\n\n📖 {subject}\n⏰ {duration} minutes\n💪 Great work! Take a 5-min break.",
    focus_stop: "⏹️ *Focus Stopped*\n\n📖 {subject}\n⏱️ Completed: {elapsed}min\n\nDon't worry, every minute counts!",
    pomodoro_start: "🍅 *Pomodoro Started!*\n\n{cycles} cycles of 25min work + 5min break\n\nStay focused!",
    pomodoro_break: "☕ *Break Time!*\n\n5-minute break. Stretch and hydrate!",
    pomodoro_complete: "🎉 *Pomodoro Complete!*\n\n{cycles} cycles finished!\n\nExcellent work! 🏆",
    
    // Calendar Import
    import_start: "📥 *Importing Calendar...*\n\nPlease wait while I process your file...",
    import_done: "✅ *Import Complete!*\n\n📚 New classes: {count}\n🔄 Duplicates: {duplicates}\n❌ Errors: {errors}\n\nUse /schedule to view!",
    import_error: "❌ *Import Failed*\n\nError: {error}\n\nTips:\n• Ensure URL is public\n• Check file format (.ics)\n• Try downloading and attaching file",
    import_progress: "📥 Processing: {current}/{total} events...",
    calendar_cleared: "🗑️ All classes cleared. Use /upload to import new calendar.",
    
    // Statistics & Analytics
    stats: "📊 *Quick Statistics*\n\n📚 Classes: {classes}\n✅ Tasks: {completed}/{total} ({rate}%)\n⏱️ Study Time: {focus}h\n🔥 Streak: {streak} days\n⭐ Level: {level} ({xp} XP)",
    analytics_title: "📈 *Detailed Analytics*\n\n",
    analytics_line: "📚 Total Classes: {total_classes}\n✅ Tasks Completed: {completed_tasks}\n⏱️ Total Focus: {total_focus}h\n📊 Avg Daily Focus: {avg_focus}h\n🔥 Best Streak: {best_streak} days\n📈 Productivity: {productivity}%\n🏆 Achievements: {achievements}",
    weekly_report: "📊 *Weekly Report*\n\n📅 {week_start} - {week_end}\n\n📚 Classes: {classes}\n✅ Tasks: {tasks}\n⏱️ Focus: {focus}h\n📈 Trend: {trend}",
    productivity_score: "📈 *Productivity Score: {score}%*\n\n{bar}\n\n💪 Keep improving!",
    
    // Settings
    settings: "⚙️ *Settings*\n\n🌐 Language: {language}\n🕐 Timezone: {timezone}\n🔔 Reminders: {reminder_offset}min before\n📊 Level: {level} ({xp} XP)",
    language_changed: "✅ Language changed to {language}!",
    timezone_set: "✅ Timezone set to {timezone}",
    
    // AI Features
    optimize_result: "🧠 *Schedule Optimization*\n\n{analysis}\n\n💡 Tip: {tip}",
    study_tip: "💡 *Study Tip*\n\n{tip}",
    
    // Study Groups
    group_created: "👥 *Study Group Created!*\n\nName: {name}\nCode: *{code}*\n\nShare this code to invite members!",
    group_joined: "✅ Joined *{name}*!\n\nMembers: {count}\n\nHappy studying together! 🎓",
    group_members: "👥 *{name} - Members*\n\n{members}",
    
    // Achievements
    achievement_unlocked: "🏆 *Achievement Unlocked!*\n\n{name}\n{description}\n\n+{xp} XP! 🎉",
    
    // Time & Date
    weekdays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    priorities: { high: "🔴 High", medium: "🟡 Medium", low: "🟢 Low", urgent: "⚡ Urgent" },
    
    // Errors
    error_general: "❌ Something went wrong. Please try again.",
    rate_limit: "⏳ Please wait a moment before sending another command.",
    invalid_format: "❌ Invalid format. Use /help to see command syntax."
  },

  ru: {
    welcome_new: "🎉 *Добро пожаловать в Vita AI!*\n\nЯ ваш интеллектуальный помощник по учебе.\n\n✨ *Возможности:*\n• Управление расписанием\n• Отслеживание задач\n• Таймер фокусировки\n• Импорт календаря (.ics)\n• Поддержка языков\n• Аналитика учебы\n\nКак вас зовут?",
    welcome_back: "👋 С возвращением, {name}!\n\n📅 Пар сегодня: {classes_today}\n📝 Задач: {tasks_pending}\n🔥 Серия: {streak} дней\n\nГотовы к продуктивному дню?",
    
    help: `🤖 *Команды Vita AI*

📅 *Расписание*
/add - Добавить пару
/schedule - Расписание
/today - Сегодня
/tomorrow - Завтра
/next - Следующая пара
/delete [id] - Удалить
/edit [id] - Изменить

📝 *Задачи*
/task - Добавить задачу
/tasks - Список задач
/complete [id] - Завершить
/delete_task [id] - Удалить
/deadlines - Ближайшие сроки

📅 *Импорт*
/upload [url] - Импорт по URL
/ics - Импорт файла .ics
/calendar_status - История
/clear_calendar - Очистить

⏱️ *Фокус*
/focus [предмет] [мин] - Начать
/pomodoro [предмет] [циклы] - Помодоро
/stop - Остановить
/study_stats - История сессий

📊 *Аналитика*
/stats - Статистика
/analytics - Подробно
/weekly_report - За неделю
/productivity - Продуктивность

⚙️ *Настройки*
/settings - Настройки
/language [en/ru/zh] - Язык
/timezone - Часовой пояс
/notifications - Напоминания

🧠 *AI*
/optimize - Оптимизация
/tips - Советы
/summarize - Обзор

👥 *Группы*
/group_create [имя] - Создать
/group_join [код] - Войти
/group_members - Участники

Введите команду для начала!`,

    schedule_title: "📅 *Ваше расписание*\n\n",
    schedule_empty: "📭 Расписание пусто!\n\n• /add - добавить пары\n• /upload - импорт календаря\n• Прикрепите .ics файл",
    class_added: "✅ Добавлено: {subject}\n📅 {day} {start}-{end}{location}",
    class_deleted: "✅ Пара #{id} удалена",
    class_edited: "✅ Пара #{id} обновлена",
    class_not_found: "❌ Пара #{id} не найдена",
    
    today_title: "📋 *Расписание на сегодня* ({date})\n\n",
    today_empty: "🎉 Сегодня нет пар!\n\n💡 Совет: Используйте время для учебы!",
    tomorrow_title: "📅 *Расписание на завтра* ({date})\n\n",
    tomorrow_empty: "🎉 Завтра нет пар!",
    
    tasks_title: "📝 *Ваши задачи*\n\n",
    tasks_empty: "✅ Всё сделано! Нет активных задач! 🎉",
    task_added: "✅ Задача добавлена!\n📌 {title}\n📅 До: {due}\n⚡ Приоритет: {priority}\n⏱️ Оценка: {duration}мин",
    task_completed: "✅ Задача #{id} выполнена! 🎉\n\nПродолжайте в том же духе!",
    task_deleted: "🗑️ Задача #{id} удалена",
    deadlines_title: "⚠️ *Ближайшие сроки*\n\n",
    
    focus_start: "⏱️ *Режим фокуса!*\n\n📖 {subject}\n⏰ {duration} минут\n🍅 {type}\n\nМинимизируйте отвлечения!",
    focus_complete: "🎉 *Фокус завершен!*\n\n📖 {subject}\n⏰ {duration} минут\n💪 Отлично! Сделайте перерыв 5 мин.",
    focus_stop: "⏹️ *Фокус остановлен*\n\n📖 {subject}\n⏱️ Завершено: {elapsed}мин\n\nКаждая минута важна!",
    pomodoro_start: "🍅 *Помодоро запущен!*\n\n{cycles} циклов: 25мин работы + 5мин отдых\n\nСосредоточьтесь!",
    pomodoro_break: "☕ *Перерыв!*\n\n5 минут. Разомнитесь!",
    pomodoro_complete: "🎉 *Помодоро завершен!*\n\n{cycles} циклов!\n\nОтличная работа! 🏆",
    
    import_start: "📥 *Импорт календаря...*\n\nОбрабатываю файл...",
    import_done: "✅ *Импорт завершен!*\n\n📚 Новых пар: {count}\n🔄 Дублей: {duplicates}\n❌ Ошибок: {errors}\n\nИспользуйте /schedule для просмотра!",
    import_error: "❌ *Ошибка импорта*\n\nОшибка: {error}\n\nСоветы:\n• Проверьте URL\n• Формат файла (.ics)\n• Скачайте и прикрепите файл",
    import_progress: "📥 Обработка: {current}/{total} событий...",
    calendar_cleared: "🗑️ Все пары удалены. Используйте /upload для импорта.",
    
    stats: "📊 *Статистика*\n\n📚 Пары: {classes}\n✅ Задачи: {completed}/{total} ({rate}%)\n⏱️ Учеба: {focus}ч\n🔥 Серия: {streak} дней\n⭐ Уровень: {level} ({xp} XP)",
    analytics_title: "📈 *Подробная аналитика*\n\n",
    analytics_line: "📚 Всего пар: {total_classes}\n✅ Задач: {completed_tasks}\n⏱️ Фокус: {total_focus}ч\n📊 Среднее в день: {avg_focus}ч\n🔥 Лучшая серия: {best_streak} дн\n📈 Продуктивность: {productivity}%\n🏆 Достижения: {achievements}",
    weekly_report: "📊 *Недельный отчет*\n\n📅 {week_start} - {week_end}\n\n📚 Пары: {classes}\n✅ Задачи: {tasks}\n⏱️ Фокус: {focus}ч\n📈 Тренд: {trend}",
    productivity_score: "📈 *Продуктивность: {score}%*\n\n{bar}\n\n💪 Продолжайте улучшаться!",
    
    settings: "⚙️ *Настройки*\n\n🌐 Язык: {language}\n🕐 Часовой пояс: {timezone}\n🔔 Напоминания: за {reminder_offset}мин\n📊 Уровень: {level} ({xp} XP)",
    language_changed: "✅ Язык изменен на {language}!",
    timezone_set: "✅ Часовой пояс: {timezone}",
    
    optimize_result: "🧠 *Оптимизация расписания*\n\n{analysis}\n\n💡 Совет: {tip}",
    study_tip: "💡 *Совет по учебе*\n\n{tip}",
    
    group_created: "👥 *Группа создана!*\n\nНазвание: {name}\nКод: *{code}*\n\nПоделитесь кодом с друзьями!",
    group_joined: "✅ Вы вступили в *{name}*!\n\nУчастников: {count}\n\nУдачной учебы! 🎓",
    group_members: "👥 *{name} - Участники*\n\n{members}",
    
    achievement_unlocked: "🏆 *Достижение!*\n\n{name}\n{description}\n\n+{xp} XP! 🎉",
    
    weekdays: ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"],
    months: ["Января", "Февраля", "Марта", "Апреля", "Мая", "Июня", "Июля", "Августа", "Сентября", "Октября", "Ноября", "Декабря"],
    priorities: { high: "🔴 Высокий", medium: "🟡 Средний", low: "🟢 Низкий", urgent: "⚡ Срочный" },
    
    error_general: "❌ Что-то пошло не так. Попробуйте еще раз.",
    rate_limit: "⏳ Подождите немного перед следующей командой.",
    invalid_format: "❌ Неверный формат. Используйте /help для справки."
  },

  zh: {
    welcome_new: "🎉 *欢迎使用 Vita AI！*\n\n我是您的智能学习助手。\n\n✨ *功能：*\n• 课程表管理\n• 任务跟踪\n• 专注计时器\n• 日历导入 (.ics)\n• 多语言支持\n• 学习分析\n\n请问您叫什么名字？",
    welcome_back: "👋 欢迎回来, {name}！\n\n📅 今日课程: {classes_today}\n📝 待办任务: {tasks_pending}\n🔥 连续天数: {streak}天\n\n准备开始高效学习了吗？",
    
    help: `🤖 *Vita AI 命令*

📅 *课程管理*
/add - 添加课程
/schedule - 查看课程表
/today - 今日课程
/tomorrow - 明日课程
/next - 下一节课
/delete [id] - 删除课程
/edit [id] - 编辑课程

📝 *任务管理*
/task - 添加任务
/tasks - 查看任务
/complete [id] - 完成任务
/delete_task [id] - 删除任务
/deadlines - 即将截止

📅 *日历导入*
/upload [url] - 从URL导入
/ics - 导入.ics文件
/calendar_status - 导入历史
/clear_calendar - 清空课程

⏱️ *专注学习*
/focus [科目] [分钟] - 开始专注
/pomodoro [科目] [周期] - 番茄钟模式
/stop - 停止
/study_stats - 学习历史

📊 *数据分析*
/stats - 快速统计
/analytics - 详细分析
/weekly_report - 周报
/productivity - 效率评分

⚙️ *设置*
/settings - 查看设置
/language [en/ru/zh] - 切换语言
/timezone - 设置时区
/notifications - 提醒设置

🧠 *AI功能*
/optimize - 优化课程表
/tips - 学习建议
/summarize - 课程总结

👥 *学习小组*
/group_create [名称] - 创建小组
/group_join [代码] - 加入小组
/group_members - 查看成员

输入命令开始使用！`,

    schedule_title: "📅 *您的课程表*\n\n",
    schedule_empty: "📭 暂无课程！\n\n• 使用 /add 添加课程\n• 使用 /upload 导入日历\n• 直接附加 .ics 文件",
    class_added: "✅ 已添加: {subject}\n📅 {day} {start}-{end}{location}",
    class_deleted: "✅ 课程 #{id} 已删除",
    class_edited: "✅ 课程 #{id} 已更新",
    class_not_found: "❌ 未找到课程 #{id}",
    
    today_title: "📋 *今日课程* ({date})\n\n",
    today_empty: "🎉 今天没有课！\n\n💡 提示：利用空闲时间专注学习！",
    tomorrow_title: "📅 *明日课程* ({date})\n\n",
    tomorrow_empty: "🎉 明天没有课！",
    
    tasks_title: "📝 *您的任务*\n\n",
    tasks_empty: "✅ 全部完成！没有待办任务！🎉",
    task_added: "✅ 任务已添加！\n📌 {title}\n📅 截止: {due}\n⚡ 优先级: {priority}\n⏱️ 预计: {duration}分钟",
    task_completed: "✅ 任务 #{id} 已完成！🎉\n\n继续加油！",
    task_deleted: "🗑️ 任务 #{id} 已删除",
    deadlines_title: "⚠️ *即将截止*\n\n",
    
    focus_start: "⏱️ *专注模式启动！*\n\n📖 {subject}\n⏰ {duration} 分钟\n🍅 {type}\n\n减少干扰，集中注意力！",
    focus_complete: "🎉 *专注完成！*\n\n📖 {subject}\n⏰ {duration} 分钟\n💪 做得好！休息5分钟。",
    focus_stop: "⏹️ *专注已停止*\n\n📖 {subject}\n⏱️ 已完成: {elapsed}分钟\n\n每一分钟都很重要！",
    pomodoro_start: "🍅 *番茄钟开始！*\n\n{cycles} 个周期: 25分钟工作 + 5分钟休息\n\n保持专注！",
    pomodoro_break: "☕ *休息时间！*\n\n5分钟休息。伸展一下！",
    pomodoro_complete: "🎉 *番茄钟完成！*\n\n{cycles} 个周期！\n\n优秀！🏆",
    
    import_start: "📥 *正在导入日历...*\n\n请稍候，正在处理您的文件...",
    import_done: "✅ *导入完成！*\n\n📚 新课程: {count}\n🔄 重复: {duplicates}\n❌ 错误: {errors}\n\n使用 /schedule 查看！",
    import_error: "❌ *导入失败*\n\n错误: {error}\n\n提示：\n• 确保URL可访问\n• 检查文件格式 (.ics)\n• 尝试下载后附加文件",
    import_progress: "📥 处理中: {current}/{total} 个事件...",
    calendar_cleared: "🗑️ 所有课程已清空。使用 /upload 导入新日历。",
    
    stats: "📊 *快速统计*\n\n📚 课程: {classes}\n✅ 任务: {completed}/{total} ({rate}%)\n⏱️ 学习时间: {focus}小时\n🔥 连续: {streak}天\n⭐ 等级: {level} ({xp} XP)",
    analytics_title: "📈 *详细分析*\n\n",
    analytics_line: "📚 总课程: {total_classes}\n✅ 完成任务: {completed_tasks}\n⏱️ 总专注: {total_focus}小时\n📊 日均专注: {avg_focus}小时\n🔥 最佳连续: {best_streak}天\n📈 效率: {productivity}%\n🏆 成就: {achievements}",
    weekly_report: "📊 *周报*\n\n📅 {week_start} - {week_end}\n\n📚 课程: {classes}\n✅ 任务: {tasks}\n⏱️ 专注: {focus}小时\n📈 趋势: {trend}",
    productivity_score: "📈 *效率评分: {score}%*\n\n{bar}\n\n💪 继续提升！",
    
    settings: "⚙️ *设置*\n\n🌐 语言: {language}\n🕐 时区: {timezone}\n🔔 提醒: 提前{reminder_offset}分钟\n📊 等级: {level} ({xp} XP)",
    language_changed: "✅ 语言已切换为{language}！",
    timezone_set: "✅ 时区已设置为{timezone}",
    
    optimize_result: "🧠 *课程表优化*\n\n{analysis}\n\n💡 建议: {tip}",
    study_tip: "💡 *学习建议*\n\n{tip}",
    
    group_created: "👥 *学习小组已创建！*\n\n名称: {name}\n代码: *{code}*\n\n分享代码邀请成员！",
    group_joined: "✅ 已加入 *{name}*！\n\n成员: {count}\n\n一起学习吧！🎓",
    group_members: "👥 *{name} - 成员*\n\n{members}",
    
    achievement_unlocked: "🏆 *成就解锁！*\n\n{name}\n{description}\n\n+{xp} XP！🎉",
    
    weekdays: ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"],
    months: ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"],
    priorities: { high: "🔴 高", medium: "🟡 中", low: "🟢 低", urgent: "⚡ 紧急" },
    
    error_general: "❌ 出现错误。请重试。",
    rate_limit: "⏳ 请稍后再试。",
    invalid_format: "❌ 格式无效。使用 /help 查看命令语法。"
  }
};

function t(key, lang = 'en', params = {}) {
  let text = LANGS[lang]?.[key] || LANGS.en[key] || key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(new RegExp(`{${k}}`, 'g'), v);
  }
  return text;
}

function detectLang(text) {
  if (!text) return 'en';
  if (/[а-яё]/i.test(text)) return 'ru';
  if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(text)) return 'zh';
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
    console.error(`VK API failed (${method}):`, error);
    return null;
  }
}

async function sendMessage(userId, message, keyboard = null) {
  if (message.length > 4000) {
    const parts = [];
    let remaining = message;
    while (remaining.length > 4000) {
      let splitAt = remaining.lastIndexOf('\n', 4000);
      if (splitAt === -1 || splitAt < 2000) splitAt = 4000;
      parts.push(remaining.substring(0, splitAt));
      remaining = remaining.substring(splitAt);
    }
    parts.push(remaining);
    
    for (let i = 0; i < parts.length; i++) {
      await vkApi('messages.send', {
        user_id: userId,
        message: parts[i],
        random_id: Math.floor(Math.random() * 1000000),
        ...(i === parts.length - 1 && keyboard ? { keyboard } : {})
      });
      if (i < parts.length - 1) await new Promise(r => setTimeout(r, 300));
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
  const labels = {
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
async function getUser(userId) {
  const ck = `user_${userId}`;
  const cached = cache.get(ck, 'user');
  if (cached) return cached;

  let { data: user } = await supabase.from("users").select("*").eq("vk_id", userId).single();
  
  if (!user) {
    const { data: newUser } = await supabase.from("users").insert({
      vk_id: userId, language: 'en', notify_offset: 60,
      total_focus_minutes: 0, tasks_completed: 0, streak: 0, xp: 0, level: 1
    }).select().single();
    user = newUser;
  }

  if (user) cache.set(ck, user, 'user');
  return user;
}

async function updateUser(userId, updates) {
  const { error } = await supabase.from("users").update(updates).eq("vk_id", userId);
  if (!error) cache.invalidate(`user_${userId}`);
  return !error;
}

async function getClasses(userId) {
  const ck = `classes_${userId}`;
  const cached = cache.get(ck, 'classes');
  if (cached) return cached;

  const { data } = await supabase.from("schedule").select("*").eq("user_id", userId).order("day").order("start_time");
  const classes = data || [];
  cache.set(ck, classes, 'classes');
  return classes;
}

async function addClass(userId, classData) {
  const { error } = await supabase.from("schedule").insert({ user_id: userId, ...classData });
  if (!error) cache.invalidate(`classes_${userId}`);
  return !error;
}

async function deleteClass(userId, classId) {
  const { error } = await supabase.from("schedule").delete().eq("id", classId).eq("user_id", userId);
  if (!error) cache.invalidate(`classes_${userId}`);
  return !error;
}

async function editClass(userId, classId, updates) {
  const { error } = await supabase.from("schedule").update(updates).eq("id", classId).eq("user_id", userId);
  if (!error) cache.invalidate(`classes_${userId}`);
  return !error;
}

async function clearAllClasses(userId) {
  const { error } = await supabase.from("schedule").delete().eq("user_id", userId);
  if (!error) cache.invalidate(`classes_${userId}`);
  return !error;
}

async function getTasks(userId, onlyPending = true) {
  const ck = `tasks_${userId}_${onlyPending}`;
  const cached = cache.get(ck, 'tasks');
  if (cached) return cached;

  let query = supabase.from("tasks").select("*").eq("user_id", userId);
  if (onlyPending) query = query.eq("done", false);
  
  const { data } = await query.order("due_date");
  const tasks = data || [];
  cache.set(ck, tasks, 'tasks');
  return tasks;
}

async function addTask(userId, taskData) {
  const { error } = await supabase.from("tasks").insert({ user_id: userId, ...taskData });
  if (!error) cache.invalidate(`tasks_${userId}`);
  return !error;
}

async function completeTask(userId, taskId) {
  const { error } = await supabase.from("tasks").update({ done: true, completed_at: new Date().toISOString() }).eq("id", taskId).eq("user_id", userId);
  if (!error) {
    cache.invalidate(`tasks_${userId}`);
    const { data: user } = await supabase.from("users").select("tasks_completed, xp").eq("vk_id", userId).single();
    if (user) {
      await updateUser(userId, { tasks_completed: (user.tasks_completed || 0) + 1, xp: (user.xp || 0) + 50 });
    }
  }
  return !error;
}

async function deleteTask(userId, taskId) {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId).eq("user_id", userId);
  if (!error) cache.invalidate(`tasks_${userId}`);
  return !error;
}

async function getStats(userId) {
  const ck = `stats_${userId}`;
  const cached = cache.get(ck, 'stats');
  if (cached) return cached;

  const [classes, tasks, user] = await Promise.all([getClasses(userId), getTasks(userId, false), getUser(userId)]);
  const completed = tasks.filter(t => t.done).length;
  const total = tasks.length;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const stats = {
    classes: classes.length, completed, total, rate,
    focus: ((user?.total_focus_minutes || 0) / 60).toFixed(1),
    streak: user?.streak || 0,
    level: Math.floor((user?.xp || 0) / 1000) + 1,
    xp: user?.xp || 0
  };
  cache.set(ck, stats, 'stats');
  return stats;
}

async function getStudySessions(userId, limit = 10) {
  const { data } = await supabase.from("study_sessions").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(limit);
  return data || [];
}

async function logStudySession(userId, sessionData) {
  await supabase.from("study_sessions").insert({ user_id: userId, ...sessionData });
  const user = await getUser(userId);
  await updateUser(userId, { total_focus_minutes: (user?.total_focus_minutes || 0) + (sessionData.actual_duration || sessionData.planned_duration) });
}

// Study Groups
async function createStudyGroup(userId, name) {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const { data: group } = await supabase.from("study_groups").insert({ name, creator_id: userId, invite_code: code }).select().single();
  if (group) {
    await supabase.from("study_group_members").insert({ group_id: group.id, user_id: userId, role: 'admin' });
  }
  return group ? { ...group, invite_code: code } : null;
}

async function joinStudyGroup(userId, code) {
  const { data: group } = await supabase.from("study_groups").select("*").eq("invite_code", code).eq("is_active", true).single();
  if (!group) return { error: 'not_found' };
  const { data: existing } = await supabase.from("study_group_members").select("id").eq("group_id", group.id).eq("user_id", userId).single();
  if (existing) return { error: 'already_member' };
  const { error } = await supabase.from("study_group_members").insert({ group_id: group.id, user_id: userId });
  return !error ? { success: true, group } : { error: 'join_failed' };
}

async function getGroupMembers(groupId) {
  const { data } = await supabase.from("study_group_members").select("user_id, role, joined_at").eq("group_id", groupId);
  return data || [];
}

// ==================== ENHANCED ICS PARSER ====================
function parseICS(icsContent) {
  const events = [];
  const lines = icsContent.split(/\r?\n/);
  let currentEvent = null;
  let currentKey = null;
  let currentValue = '';

  for (const line of lines) {
    if (line.startsWith(' ')) {
      // Continuation of previous line
      if (currentKey) currentValue += line.substring(1);
      continue;
    }

    // Save previous property
    if (currentKey && currentEvent) {
      currentEvent[currentKey] = currentValue;
    }

    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed === 'BEGIN:VEVENT') {
      currentEvent = {};
      currentKey = null;
      currentValue = '';
    } else if (trimmed === 'END:VEVENT') {
      if (currentEvent && currentEvent.SUMMARY && currentEvent.DTSTART) {
        events.push(currentEvent);
      }
      currentEvent = null;
      currentKey = null;
    } else if (currentEvent && trimmed.includes(':')) {
      const colonIndex = trimmed.indexOf(':');
      currentKey = trimmed.substring(0, colonIndex).split(';')[0];
      currentValue = trimmed.substring(colonIndex + 1).replace(/\\,/g, ',').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
    }
  }

  return events;
}

function parseICSEvent(event) {
  try {
    const dtstart = event.DTSTART || '';
    const dtend = event.DTEND || '';

    // Extract date/time
    let year, month, day, hour = 9, minute = 0;
    const startMatch = dtstart.match(/(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?/);
    if (startMatch) {
      year = parseInt(startMatch[1]);
      month = parseInt(startMatch[2]) - 1;
      day = parseInt(startMatch[3]);
      hour = parseInt(startMatch[4] || '9');
      minute = parseInt(startMatch[5] || '0');
    } else {
      return null;
    }

    const date = new Date(year, month, day, hour, minute);
    let weekday = date.getDay();
    weekday = weekday === 0 ? 6 : weekday - 1;

    let endHour = (hour + 1) % 24;
    let endMinute = minute;
    const endMatch = dtend.match(/(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?/);
    if (endMatch) {
      endHour = parseInt(endMatch[4] || endHour.toString());
      endMinute = parseInt(endMatch[5] || '0');
    }

    return {
      subject: (event.SUMMARY || 'Untitled').substring(0, 200),
      day: weekday,
      start_time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
      end_time: `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`,
      location: (event.LOCATION || null)?.substring(0, 200)
    };
  } catch {
    return null;
  }
}

async function importICSFile(userId, icsContent) {
  const events = parseICS(icsContent);
  if (events.length === 0) return { success: false, error: "No valid events found" };

  const existingClasses = await getClasses(userId);
  const existingSet = new Set(existingClasses.map(c => `${c.subject}|${c.day}|${c.start_time}`));
  
  let imported = 0, duplicates = 0, errors = 0;

  for (const event of events) {
    const classData = parseICSEvent(event);
    if (!classData) { errors++; continue; }
    
    const key = `${classData.subject}|${classData.day}|${classData.start_time}`;
    if (existingSet.has(key)) { duplicates++; continue; }
    
    if (await addClass(userId, classData)) {
      imported++;
      existingSet.add(key);
    } else {
      errors++;
    }
  }

  return { success: true, count: imported, duplicates, errors, total: events.length };
}

// ==================== COMMAND HANDLERS ====================
const commandHandlers = {
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

    const weekdays = t('weekdays', lang).split(', ');
    let message = t('schedule_title', lang);

    for (let d = 0; d < 7; d++) {
      if (byDay[d]) {
        message += `\n📌 *${weekdays[d]}*\n`;
        for (const cls of byDay[d]) {
          message += `  #${cls.id} ${cls.start_time}-${cls.end_time} • ${cls.subject}`;
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
    const months = t('months', lang).split(', ');
    const dateStr = `${weekdays[dayIndex]}, ${now.getDate()} ${months[now.getMonth()]}`;
    let message = t('today_title', lang, { date: dateStr });

    for (const cls of todayClasses) {
      const status = cls.start_time <= currentTime && cls.end_time >= currentTime ? '🟢 NOW' : 
                     cls.start_time > currentTime ? '⏳ Upcoming' : '✅ Done';
      message += `${status} ${cls.start_time}-${cls.end_time} • ${cls.subject}\n`;
    }

    await sendMessage(userId, message, getKeyboard(lang));
  },

  tasks: async (userId, lang) => {
    const tasks = await getTasks(userId, true);
    if (tasks.length === 0) {
      await sendMessage(userId, t('tasks_empty', lang), getKeyboard(lang));
      return;
    }

    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    tasks.sort((a, b) => (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2));

    const priorityEmoji = { urgent: '⚡', high: '🔴', medium: '🟡', low: '🟢' };
    let message = t('tasks_title', lang);

    for (const task of tasks.slice(0, 15)) {
      const dueDate = new Date(task.due_date);
      const daysLeft = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));
      const dueStr = daysLeft === 0 ? '⚠️ Today!' : daysLeft === 1 ? '📅 Tomorrow' : daysLeft < 0 ? '❗ Overdue!' : `${daysLeft}d left`;
      
      message += `${priorityEmoji[task.priority]} #${task.id} *${task.task}*\n   📅 ${task.due_date?.split('T')[0]} (${dueStr})`;
      if (task.estimated_duration) message += ` | ⏱️ ${task.estimated_duration}min`;
      message += '\n\n';
    }

    if (tasks.length > 15) message += `... and ${tasks.length - 15} more`;
    await sendMessage(userId, message, getKeyboard(lang));
  },

  stats: async (userId, lang) => {
    const stats = await getStats(userId);
    await sendMessage(userId, t('stats', lang, stats), getKeyboard(lang));
  },

  settings: async (userId, lang) => {
    const user = await getUser(userId);
    const langNames = { en: 'English', ru: 'Русский', zh: '中文' };
    await sendMessage(userId, t('settings', lang, {
      language: langNames[user.language] || user.language,
      timezone: user.timezone || 'UTC',
      reminder_offset: user.notify_offset || 60,
      level: user.level || 1,
      xp: user.xp || 0
    }), getKeyboard(lang));
  }
};

// ==================== FOCUS TIMER SYSTEM ====================
const focusTimers = new Map();
const pomodoroSessions = new Map();

function startFocus(userId, subject, duration, type = 'focus', lang = 'en') {
  if (focusTimers.has(userId)) {
    clearTimeout(focusTimers.get(userId).timeout);
    if (pomodoroSessions.has(userId)) clearInterval(pomodoroSessions.get(userId));
  }

  const timer = { userId, subject, duration, type, startTime: Date.now(), pauses: [], completed: false };
  
  timer.timeout = setTimeout(async () => {
    await completeFocus(userId, lang);
  }, duration * 60 * 1000);

  focusTimers.set(userId, timer);

  if (type === 'pomodoro') {
    startPomodoro(userId, subject, Math.ceil(duration / 25), lang);
  }

  return timer;
}

function startPomodoro(userId, subject, cycles, lang) {
  let currentCycle = 0;
  const interval = setInterval(async () => {
    const timer = focusTimers.get(userId);
    if (!timer) { clearInterval(interval); return; }

    currentCycle++;
    if (currentCycle >= cycles) {
      clearInterval(interval);
      pomodoroSessions.delete(userId);
      return;
    }

    if (currentCycle % 4 === 0) {
      await sendMessage(userId, "☕ *Long Break!*\n\n15 minutes. Great progress! 🌟");
    } else {
      await sendMessage(userId, "☕ *Short Break*\n\n5 minutes. Stand up and stretch!");
    }
  }, 30 * 60 * 1000); // 25min work + 5min break

  pomodoroSessions.set(userId, interval);
}

async function completeFocus(userId, lang) {
  const timer = focusTimers.get(userId);
  if (!timer || timer.completed) return null;

  timer.completed = true;
  if (timer.timeout) clearTimeout(timer.timeout);
  if (pomodoroSessions.has(userId)) { clearInterval(pomodoroSessions.get(userId)); pomodoroSessions.delete(userId); }

  const actualDuration = Math.round((Date.now() - timer.startTime) / 60000);
  focusTimers.delete(userId);

  await logStudySession(userId, {
    subject: timer.subject, planned_duration: timer.duration,
    actual_duration: actualDuration, type: timer.type,
    date: new Date().toISOString().split('T')[0]
  });

  await sendMessage(userId, t('focus_complete', lang, { subject: timer.subject, duration: actualDuration }));
  return { ...timer, actualDuration };
}

function stopFocus(userId, lang) {
  const timer = focusTimers.get(userId);
  if (!timer) return null;

  if (timer.timeout) clearTimeout(timer.timeout);
  if (pomodoroSessions.has(userId)) { clearInterval(pomodoroSessions.get(userId)); pomodoroSessions.delete(userId); }

  const elapsed = Math.round((Date.now() - timer.startTime) / 60000);
  focusTimers.delete(userId);

  logStudySession(userId, {
    subject: timer.subject, planned_duration: timer.duration,
    actual_duration: elapsed, type: timer.type,
    date: new Date().toISOString().split('T')[0]
  }).catch(console.error);

  sendMessage(userId, t('focus_stop', lang, { subject: timer.subject, elapsed }));
  return { ...timer, elapsed };
}

// ==================== MAIN MESSAGE PROCESSOR ====================
async function processMessage(userId, text, attachments = []) {
  const msg = text.trim();
  const lower = msg.toLowerCase();

  let user = await getUser(userId);
  let userLang = user?.language || detectLang(msg);

  if (user && !user.language && detectLang(msg) !== 'en') {
    await updateUser(userId, { language: detectLang(msg) });
    userLang = detectLang(msg);
  }

  // Handle ICS file attachments
  if (attachments.length > 0) {
    for (const att of attachments) {
      if (att.type === 'doc' && (att.doc?.title?.endsWith('.ics') || att.doc?.ext === 'ics')) {
        await sendMessage(userId, t('import_start', userLang));
        try {
          const response = await fetch(att.doc.url);
          const icsContent = await response.text();
          const result = await importICSFile(userId, icsContent);
          if (result.success) {
            await sendMessage(userId, t('import_done', userLang, result), getKeyboard(userLang));
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

  // Commands
  if (lower.startsWith('/')) {
    const cmd = lower.split(/\s+/)[0].substring(1);
    const parts = msg.split(/\s+/);
    const args = parts.slice(1);

    switch (cmd) {
      case 'help': await commandHandlers.help(userId, userLang); break;
      case 'schedule': await commandHandlers.schedule(userId, userLang); break;
      case 'today': await commandHandlers.today(userId, userLang); break;
      case 'tasks': await commandHandlers.tasks(userId, userLang); break;
      case 'stats': await commandHandlers.stats(userId, userLang); break;
      case 'settings': await commandHandlers.settings(userId, userLang); break;
      
      case 'add':
        if (parts.length < 5) {
          await sendMessage(userId, "Format: /add Subject Day StartTime EndTime [Location]\nDays: 0=Mon-6=Sun\nExample: /add Math 0 09:00 10:30 Room 101", getKeyboard(userLang));
        } else {
          const day = parseInt(parts[2]);
          if (isNaN(day) || day < 0 || day > 6) {
            await sendMessage(userId, "Invalid day. Use 0-6 (0=Monday)", getKeyboard(userLang));
          } else {
            const success = await addClass(userId, {
              subject: parts[1], day, start_time: parts[3], end_time: parts[4],
              location: parts.slice(5).join(' ') || null
            });
            if (success) {
              const weekdays = t('weekdays', userLang).split(', ');
              await sendMessage(userId, t('class_added', userLang, {
                subject: parts[1], day: weekdays[day], start: parts[3], end: parts[4],
                location: parts[5] ? ` (${parts.slice(5).join(' ')})` : ''
              }), getKeyboard(userLang));
            }
          }
        }
        break;

      case 'task':
        const taskMatch = msg.match(/\/task\s*"?([^"]+)"?\s+(\d{4}-\d{2}-\d{2})(?:\s+(urgent|high|medium|low))?(?:\s+(\d+))?/i);
        if (!taskMatch) {
          await sendMessage(userId, 'Format: /task "Title" YYYY-MM-DD [priority] [minutes]\nExample: /task "Math Homework" 2026-05-01 high 60', getKeyboard(userLang));
        } else {
          const [, title, dueDate, priority = 'medium', duration] = taskMatch;
          await addTask(userId, { task: title, due_date: dueDate, priority, estimated_duration: duration ? parseInt(duration) : null, done: false });
          await sendMessage(userId, t('task_added', userLang, { title, due: dueDate, priority: t('priorities', userLang)[priority], duration: duration || '?' }), getKeyboard(userLang));
        }
        break;

      case 'complete':
        const taskId = parseInt(args[0]);
        if (isNaN(taskId)) {
          await sendMessage(userId, "Usage: /complete [task_id]", getKeyboard(userLang));
        } else {
          const success = await completeTask(userId, taskId);
          await sendMessage(userId, success ? t('task_completed', userLang, { id: taskId }) : t('error_general', userLang), getKeyboard(userLang));
        }
        break;

      case 'delete':
        const delId = parseInt(args[0]);
        if (isNaN(delId)) {
          await sendMessage(userId, "Usage: /delete [class_id]", getKeyboard(userLang));
        } else {
          await deleteClass(userId, delId);
          await sendMessage(userId, t('class_deleted', userLang, { id: delId }), getKeyboard(userLang));
        }
        break;

      case 'delete_task':
        const dtId = parseInt(args[0]);
        if (isNaN(dtId)) {
          await sendMessage(userId, "Usage: /delete_task [task_id]", getKeyboard(userLang));
        } else {
          await deleteTask(userId, dtId);
          await sendMessage(userId, t('task_deleted', userLang, { id: dtId }), getKeyboard(userLang));
        }
        break;

      case 'upload':
        if (!args[0]) {
          await sendMessage(userId, "Usage: /upload [url]\nOr attach .ics file directly", getKeyboard(userLang));
        } else {
          await sendMessage(userId, t('import_start', userLang));
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);
            const response = await fetch(args[0], { signal: controller.signal });
            clearTimeout(timeout);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const icsContent = await response.text();
            const result = await importICSFile(userId, icsContent);
            if (result.success) {
              await sendMessage(userId, t('import_done', userLang, result), getKeyboard(userLang));
            } else {
              await sendMessage(userId, t('import_error', userLang, { error: result.error }), getKeyboard(userLang));
            }
          } catch (error) {
            await sendMessage(userId, t('import_error', userLang, { error: error.message }), getKeyboard(userLang));
          }
        }
        break;

      case 'clear_calendar':
        await clearAllClasses(userId);
        await sendMessage(userId, t('calendar_cleared', userLang), getKeyboard(userLang));
        break;

      case 'focus':
        const subject = args[0] || 'Study';
        const duration = Math.min(Math.max(parseInt(args[1]) || 25, 5), 180);
        startFocus(userId, subject, duration, 'focus', userLang);
        await sendMessage(userId, t('focus_start', userLang, { subject, duration, type: 'Standard' }), getKeyboard(userLang));
        break;

      case 'pomodoro':
        const pSubject = args[0] || 'Study';
        const cycles = Math.min(Math.max(parseInt(args[1]) || 4, 1), 8);
        const pDuration = cycles * 25;
        startFocus(userId, pSubject, pDuration, 'pomodoro', userLang);
        await sendMessage(userId, t('pomodoro_start', userLang, { cycles }), getKeyboard(userLang));
        break;

      case 'stop':
        if (!focusTimers.has(userId)) {
          await sendMessage(userId, "No active focus session.", getKeyboard(userLang));
        } else {
          stopFocus(userId, userLang);
        }
        break;

      case 'language':
        const newLang = args[0]?.toLowerCase();
        if (!['en', 'ru', 'zh'].includes(newLang)) {
          await sendMessage(userId, "Supported languages: en, ru, zh\nExample: /language zh", getKeyboard(userLang));
        } else {
          await updateUser(userId, { language: newLang });
          await sendMessage(userId, t('language_changed', newLang, { language: newLang }), getKeyboard(newLang));
        }
        break;

      case 'group_create':
        const groupName = args.join(' ') || 'Study Group';
        const group = await createStudyGroup(userId, groupName);
        if (group) {
          await sendMessage(userId, t('group_created', userLang, { name: groupName, code: group.invite_code }), getKeyboard(userLang));
        } else {
          await sendMessage(userId, t('error_general', userLang), getKeyboard(userLang));
        }
        break;

      case 'group_join':
        if (!args[0]) {
          await sendMessage(userId, "Usage: /group_join [code]", getKeyboard(userLang));
        } else {
          const result = await joinStudyGroup(userId, args[0]);
          if (result.success) {
            await sendMessage(userId, t('group_joined', userLang, { name: result.group.name, count: 1 }), getKeyboard(userLang));
          } else if (result.error === 'not_found') {
            await sendMessage(userId, "❌ Group not found", getKeyboard(userLang));
          } else if (result.error === 'already_member') {
            await sendMessage(userId, "You're already a member!", getKeyboard(userLang));
          }
        }
        break;

      default:
        await sendMessage(userId, t('help', userLang), getKeyboard(userLang));
    }
    return;
  }

  // Natural language
  const nlpMap = {
    help: ['help', 'помощь', '帮助'],
    schedule: ['schedule', 'расписание', '课程表'],
    today: ['today', 'сегодня', '今天'],
    tomorrow: ['tomorrow', 'завтра', '明天'],
    tasks: ['tasks', 'задачи', '任务'],
    stats: ['stats', 'статистика', '统计']
  };

  for (const [cmd, triggers] of Object.entries(nlpMap)) {
    if (triggers.some(t => lower.includes(t))) {
      if (commandHandlers[cmd]) {
        await commandHandlers[cmd](userId, userLang);
        return;
      }
    }
  }

  // Welcome/greeting
  if (!user?.name) {
    await sendMessage(userId, t('welcome_new', userLang));
  } else {
    const now = new Date();
    const dayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const classes = await getClasses(userId);
    const todayClasses = classes.filter(c => c.day === dayIndex);
    const tasks = await getTasks(userId, true);
    const stats = await getStats(userId);
    
    await sendMessage(userId, t('welcome_back', userLang, {
      name: user.name,
      classes_today: todayClasses.length,
      tasks_pending: tasks.length,
      streak: stats.streak
    }), getKeyboard(userLang));
  }
}

// ==================== WEBHOOK HANDLER ====================
export async function handler(event) {
  try {
    const body = JSON.parse(event.body);

    if (body.type === 'confirmation') {
      return { statusCode: 200, body: VK_CONFIRMATION || 'df7d544c' };
    }

    if (body.type === 'message_new') {
      const msg = body.object?.message;
      if (!msg || msg.out === 1) {
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }

      const userId = msg.from_id;
      const text = msg.text || '';
      const attachments = msg.attachments || [];

      processMessage(userId, text, attachments).catch(console.error);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };

  } catch (error) {
    console.error("Handler error:", error);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }
}

// Health check
export async function health() {
  return {
    statusCode: 200,
    body: JSON.stringify({
      status: "healthy",
      version: "3.0.0",
      languages: ["en", "ru", "zh"],
      cache: cache.getStats(),
      timestamp: new Date().toISOString()
    })
  };
}