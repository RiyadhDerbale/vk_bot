import { createClient } from "@supabase/supabase-js";

// ==================== CONFIGURATION ====================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const VK_TOKEN = process.env.VK_TOKEN;
const VK_API_VERSION = "5.199";

// Enhanced cache with different TTLs for different data types
const cache = new Map();
const CACHE_TTL = {
  user: 600000,      // 10 minutes
  classes: 300000,   // 5 minutes
  tasks: 120000,     // 2 minutes
  stats: 60000       // 1 minute
};

function getCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  
  // Check if expired based on type
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

// Active study timers with enhanced tracking
const timers = new Map();
const userSessions = new Map(); // Track active user sessions

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
• Week - Weekly overview
• /add subject day start end [location] - Add class
• /update id field value - Update class
• /delete id - Delete class

📝 *TASK MANAGEMENT*
• Tasks - View pending tasks
• All Tasks - View all tasks including completed
• /task "title" YYYY-MM-DD [high|medium|low] - Add task
• /complete id - Mark task as done
• /snooze id days - Postpone task
• /delete_task id - Delete task

⏱️ *FOCUS TIMER*
• /study subject minutes - Start focused session
• /stop - Stop current timer
• Timer Status - Check active timer

📊 *INSIGHTS*
• Stats - Complete productivity report
• Time Summary - Time management overview
• Study Stats - Focus session analytics

🎯 *SMART FEATURES*
• Class Reminders - Auto-reminders before class
• Deadline Alerts - Never miss a deadline
• Daily Briefing - Morning schedule summary
• Context-aware responses

⚙️ *SETTINGS*
• /remind minutes - Set reminder (5-120)
• /quiet - Mute notifications for 2 hours
• /unquiet - Resume notifications

📥 *IMPORT*
• /ics url - Import from link
• Attach .ics file directly

🌐 *SCHEDULE FORMAT*
Days: 0=Mon 1=Tue 2=Wed 3=Thu 4=Fri 5=Sat 6=Sun
Time: 24h format (09:00, 14:30)

💡 *PRO TIPS*
• I learn your routine over time
• Ask me "What's next?" anytime
• I track your study patterns`,
    
    schedule_empty: "📭 Your schedule is empty. Let's build it!\n\nUse /add to manually add classes\nUse /ics to import from Google Calendar\nOr attach an .ics file directly",
    tasks_empty: "✅ No pending tasks! Great job staying on top of things! 🎉\n\nWant to see completed tasks? Type 'All Tasks'",
    no_classes_today: "🎉 No classes today! Perfect day for:\n• Catching up on tasks\n• Self-study sessions\n• Planning ahead",
    no_classes_tomorrow: "🎉 No classes tomorrow! Time to plan something productive or relax!",
    no_next_class: "🎉 No upcoming classes in the next 24 hours! Great time for personal projects!",
    
    class_added: "✅ Class added successfully!\n\n📖 Subject: {subject}\n📅 Day: {day}\n⏰ Time: {start} - {end}\n⏱️ Duration: {duration} min\n📍 Location: {location}\n\nI'll remind you {reminder} minutes before class!",
    class_updated: "✅ Class {id} updated!\n{field}: {old_value} → {new_value}",
    class_deleted: "✅ Class {id} deleted! Your schedule is now optimized.",
    class_not_found: "❌ Class #{id} not found in your schedule.",
    
    task_added: "✅ Task captured!\n\n📝 {title}\n📅 Due: {due_date} ({days_until} days left)\n🎯 Priority: {priority}\n⏰ I'll remind you 2 days before",
    task_completed: "✅ Task #{id} completed! 🎉\n\nGreat job! That's {completed_count} tasks done so far!",
    task_deleted: "🗑️ Task #{id} removed from your list.",
    task_not_found: "❌ Task #{id} not found.",
    task_snoozed: "⏸️ Task #{id} snoozed for {days} days.\nNew due date: {new_date}",
    
    timer_start: "⏱️ *Focus Session Started!*\n\n📖 Studying: {subject}\n⏰ Duration: {duration} minutes\n🎯 Expected end: {end_time}\n\nStay focused! I believe in you! 💪",
    timer_end: "⏰ *Great Work!*\n\n📖 Completed: {subject}\n⏱️ Duration: {duration} minutes\n📊 Total today: {today_total} minutes\n\nTake a short break! 🎉",
    timer_stop: "❌ Timer stopped.\n📖 Session: {subject}\n⏱️ Completed: {elapsed} minutes\n\nEvery minute counts! Ready for another session?",
    timer_active: "⏱️ Active focus session:\n📖 {subject}\n⏱️ {elapsed}/{duration} min\n🎯 Ends at: {end_time}",
    
    remind_set: "⏰ Reminder updated! I'll notify you {minutes} minutes before each class.",
    remind_current: "⏰ Your reminder is set to {minutes} minutes before class.",
    
    quiet_mode_on: "🔕 Quiet mode activated for 2 hours. I won't send notifications during this time.",
    quiet_mode_off: "🔔 Notifications resumed! I'll keep you updated.",
    
    import_start: "⏳ Analyzing your calendar...",
    import_done: "✅ Calendar imported!\n\n📊 Import Summary:\n• Total events: {total}\n• New classes: {count}\n• Duplicates skipped: {duplicates}\n\nYour schedule is now up to date!",
    import_fail: "❌ Import failed: {error}\n\n💡 Tips:\n• Make sure the link is accessible\n• Try downloading and attaching the file\n• Use /add for manual entry",
    
    stats: `📊 *YOUR PRODUCTIVITY DASHBOARD*

📚 *SCHEDULE*
• Total classes: {total_classes}
• Today: {today_classes}
• This week: {week_classes}

📝 *TASKS*
• Completed: {completed_done}/{total_tasks}
• High priority pending: {high_priority}
• Completion rate: {completion_rate}%

⏱️ *STUDY TRACKER*
• Today: {today_min} min
• This week: {study_min} min
• Total: {total_study} hours
• Daily average: {avg_min} min

🎯 *PRODUCTIVITY SCORE*
{productivity_bar} {score}/100
{productivity_message}`,
    
    time_summary: `⏰ *TIME INSIGHTS*

📅 *TODAY'S OVERVIEW*
• Classes: {today_count}
• Total class time: {class_hours}h {class_minutes}m
• Free time: {free_hours}h {free_minutes}m

⏱️ *NEXT CLASS*
{next_class_info}

📝 *DEADLINES*
• Pending tasks: {pending_count}
• Due today: {due_today}
• Overdue: {overdue}

💡 *RECOMMENDATION*
{recommendation}`,
    
    week: "📆 *WEEKLY OVERVIEW*\n\n{week_schedule}",
    
    daily_briefing: `🌅 *GOOD MORNING, {name}!*

📅 *{day} SCHEDULE*
{today_schedule}

📝 *PRIORITIES*
{priorities}

⏰ *FIRST CLASS*
{first_class}

💪 *MOTIVATION*
{motivation}`,
    
    unknown: "I'm not sure what you mean. Type 'Help' to see all my capabilities!",
    
    next_class_detailed: "⏰ *YOUR NEXT CLASS*\n\n📖 {subject}\n📅 {day} ({date})\n🕐 {start_time} - {end_time}\n⏱️ Starts in: {minutes} minutes\n📍 {location}\n\n⏰ I'll remind you {reminder} minutes before!",
    
    class_context: "📖 {subject} is scheduled for {day} at {start_time}-{end_time} in {location}. You have {classes_before} classes before this one.",
    
    weekdays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    weekdays_short: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    
    productivity_messages: [
      "Outstanding! You're a productivity master! 🌟",
      "Great job! Keep this momentum going! 💪",
      "Good progress! Small steps lead to big results! 📈",
      "You're building great habits! Consistency is key! 🎯",
      "Every minute of focus brings you closer to your goals! ✨"
    ],
    
    motivation_quotes: [
      "The secret of getting ahead is getting started. - Mark Twain",
      "Success is not final, failure is not fatal: it is the courage to continue that counts. - Winston Churchill",
      "The only way to do great work is to love what you do. - Steve Jobs",
      "Don't watch the clock; do what it does. Keep going. - Sam Levenson",
      "Your future is created by what you do today, not tomorrow. - Robert Kiyosaki"
    ]
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
• Next - Следующая пара с отсчётом
• Week - Обзор недели
• /add предмет день начало конец [место] - Добавить
• /update id поле значение - Обновить
• /delete id - Удалить

📝 *УПРАВЛЕНИЕ ЗАДАЧАМИ*
• Tasks - Активные задачи
• All Tasks - Все задачи
• /task "название" ГГГГ-ММ-ДД [high|medium|low] - Добавить
• /complete id - Выполнить
• /snooze id дни - Отложить
• /delete_task id - Удалить

⏱️ *ТАЙМЕР ФОКУСА*
• /study предмет минуты - Начать сессию
• /stop - Остановить
• Timer Status - Проверить таймер

📊 *АНАЛИТИКА*
• Stats - Полный отчёт
• Time Summary - Обзор времени
• Study Stats - Статистика учёбы

🎯 *УМНЫЕ ФУНКЦИИ*
• Напоминания о парах
• Уведомления о дедлайнах
• Утренний брифинг
• Контекстные ответы

⚙️ *НАСТРОЙКИ*
• /remind минуты - Напоминание (5-120)
• /quiet - Без уведомлений 2ч
• /unquiet - Включить уведомления

📥 *ИМПОРТ*
• /ics ссылка - Импорт по ссылке
• Прикрепи .ics файл`,
    
    schedule_empty: "📭 Расписание пусто. Давай создадим его!\n\nИспользуй /add для добавления\nИспользуй /ics для импорта из Google Calendar\nИли прикрепи .ics файл",
    tasks_empty: "✅ Нет активных задач! Отличная работа! 🎉\n\nХочешь увидеть выполненные? Напиши 'All Tasks'",
    no_classes_today: "🎉 Сегодня нет пар! Отличный день для:\n• Навёрстывания задач\n• Самостоятельной учёбы\n• Планирования",
    no_classes_tomorrow: "🎉 Завтра нет пар! Время спланировать что-то продуктивное или отдохнуть!",
    no_next_class: "🎉 Нет пар в ближайшие 24 часа! Отличное время для личных проектов!",
    
    class_added: "✅ Пара добавлена!\n\n📖 Предмет: {subject}\n📅 День: {day}\n⏰ Время: {start} - {end}\n⏱️ Длительность: {duration} мин\n📍 Место: {location}\n\nНапомню за {reminder} минут до пары!",
    class_updated: "✅ Пара {id} обновлена!\n{field}: {old_value} → {new_value}",
    class_deleted: "✅ Пара {id} удалена! Расписание оптимизировано.",
    class_not_found: "❌ Пара #{id} не найдена в расписании.",
    
    task_added: "✅ Задача создана!\n\n📝 {title}\n📅 Срок: {due_date} (осталось {days_until} дн.)\n🎯 Приоритет: {priority}\n⏰ Напомню за 2 дня",
    task_completed: "✅ Задача #{id} выполнена! 🎉\n\nОтлично! Уже {completed_count} задач сделано!",
    task_deleted: "🗑️ Задача #{id} удалена из списка.",
    task_not_found: "❌ Задача #{id} не найдена.",
    task_snoozed: "⏸️ Задача #{id} отложена на {days} дн.\nНовый срок: {new_date}",
    
    timer_start: "⏱️ *Фокус-сессия началась!*\n\n📖 Изучаем: {subject}\n⏰ Длительность: {duration} минут\n🎯 Окончание: {end_time}\n\nСосредоточься! Ты сможешь! 💪",
    timer_end: "⏰ *Отличная работа!*\n\n📖 Завершено: {subject}\n⏱️ Длительность: {duration} минут\n📊 Всего сегодня: {today_total} минут\n\nСделай короткий перерыв! 🎉",
    timer_stop: "❌ Таймер остановлен.\n📖 Сессия: {subject}\n⏱️ Пройдено: {elapsed} минут\n\nКаждая минута на счету! Готов к новой сессии?",
    timer_active: "⏱️ Активная сессия:\n📖 {subject}\n⏱️ {elapsed}/{duration} мин\n🎯 Завершится в: {end_time}",
    
    remind_set: "⏰ Напоминание обновлено! Буду уведомлять за {minutes} минут до пары.",
    remind_current: "⏰ Напоминание установлено за {minutes} минут до пары.",
    
    quiet_mode_on: "🔕 Режим тишины на 2 часа. Не буду отправлять уведомления.",
    quiet_mode_off: "🔔 Уведомления возобновлены! Буду держать в курсе.",
    
    import_start: "⏳ Анализирую календарь...",
    import_done: "✅ Календарь импортирован!\n\n📊 Сводка:\n• Всего событий: {total}\n• Новых пар: {count}\n• Пропущено дублей: {duplicates}\n\nРасписание обновлено!",
    import_fail: "❌ Ошибка импорта: {error}\n\n💡 Советы:\n• Проверь доступность ссылки\n• Попробуй скачать и прикрепить файл\n• Используй /add для ручного ввода",
    
    stats: `📊 *ПАНЕЛЬ ПРОДУКТИВНОСТИ*

📚 *РАСПИСАНИЕ*
• Всего пар: {total_classes}
• Сегодня: {today_classes}
• На неделе: {week_classes}

📝 *ЗАДАЧИ*
• Выполнено: {completed_done}/{total_tasks}
• Срочных: {high_priority}
• Процент выполнения: {completion_rate}%

⏱️ *УЧЁБА*
• Сегодня: {today_min} мин
• На неделе: {study_min} мин
• Всего: {total_study} часов
• В среднем: {avg_min} мин/день

🎯 *ОЦЕНКА ПРОДУКТИВНОСТИ*
{productivity_bar} {score}/100
{productivity_message}`,
    
    time_summary: `⏰ *АНАЛИЗ ВРЕМЕНИ*

📅 *ОБЗОР ДНЯ*
• Пары: {today_count}
• Общее время пар: {class_hours}ч {class_minutes}м
• Свободное время: {free_hours}ч {free_minutes}м

⏱️ *СЛЕДУЮЩАЯ ПАРА*
{next_class_info}

📝 *ДЕДЛАЙНЫ*
• Активных задач: {pending_count}
• На сегодня: {due_today}
• Просрочено: {overdue}

💡 *РЕКОМЕНДАЦИЯ*
{recommendation}`,
    
    week: "📆 *ОБЗОР НЕДЕЛИ*\n\n{week_schedule}",
    
    daily_briefing: `🌅 *ДОБРОЕ УТРО, {name}!*

📅 *РАСПИСАНИЕ НА {day}*
{today_schedule}

📝 *ПРИОРИТЕТЫ*
{priorities}

⏰ *ПЕРВАЯ ПАРА*
{first_class}

💪 *МОТИВАЦИЯ*
{motivation}`,
    
    unknown: "Я не совсем понял. Напиши 'Help' чтобы увидеть все возможности!",
    
    next_class_detailed: "⏰ *СЛЕДУЮЩАЯ ПАРА*\n\n📖 {subject}\n📅 {day} ({date})\n🕐 {start_time} - {end_time}\n⏱️ Начнётся через: {minutes} минут\n📍 {location}\n\n⏰ Напомню за {reminder} минут!",
    
    class_context: "📖 {subject} запланирован(а) на {day} в {start_time}-{end_time} в {location}. До этого у тебя {classes_before} пар(ы).",
    
    weekdays: ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"],
    weekdays_short: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
    
    productivity_messages: [
      "Потрясающе! Ты мастер продуктивности! 🌟",
      "Отличная работа! Продолжай в том же духе! 💪",
      "Хороший прогресс! Маленькие шаги ведут к большим результатам! 📈",
      "Ты формируешь отличные привычки! Постоянство - ключ! 🎯",
      "Каждая минута фокуса приближает тебя к целям! ✨"
    ],
    
    motivation_quotes: [
      "Секрет успеха - начать действовать. - Марк Твен",
      "Успех не окончателен, неудача не фатальна: значение имеет смелость продолжать. - Уинстон Черчилль",
      "Единственный способ делать великую работу - любить то, что делаешь. - Стив Джобс",
      "Не следи за часами; делай то же, что и они. Продолжай идти. - Сэм Левенсон",
      "Твоё будущее создаётся тем, что ты делаешь сегодня, а не завтра. - Роберт Кийосаки"
    ]
  },
  
  zh: {
    ask_name: "👋 你好！我是你的智能时间管理助手。你叫什么名字？",
    got_name: "🎉 很高兴认识你，{name}！我会帮你管理时间、追踪课程表、提高效率！输入'Help'查看所有功能。",
    greeting: "👋 你好 {name}！准备让今天高效吗？我记得你的课程表和任务。输入'Help'查看命令。",
    
    help: `🤖 *你的智能时间管理器*

📅 *智能课程表*
• Schedule - 查看所有课程
• Today - 今日课程
• Tomorrow - 明日课程
• Next - 下节课倒计时
• Week - 周概览
• /add 课程 星期 开始 结束 [地点] - 添加课程
• /update id 字段 值 - 更新课程
• /delete id - 删除课程

📝 *任务管理*
• Tasks - 待办任务
• All Tasks - 所有任务
• /task "任务名" 年-月-日 [high|medium|low] - 添加
• /complete id - 完成
• /snooze id 天数 - 推迟
• /delete_task id - 删除

⏱️ *专注计时*
• /study 科目 分钟 - 开始
• /stop - 停止
• Timer Status - 查看计时器

📊 *数据分析*
• Stats - 完整报告
• Time Summary - 时间概览
• Study Stats - 学习统计

🎯 *智能功能*
• 课程提醒
• 截止日期提醒
• 每日简报
• 上下文感知回复

⚙️ *设置*
• /remind 分钟 - 设置提醒 (5-120)
• /quiet - 静音2小时
• /unquiet - 恢复通知

📥 *导入*
• /ics 链接 - 从链接导入
• 直接附加.ics文件`,
    
    schedule_empty: "📭 课程表为空。让我们建立它！\n\n使用 /add 手动添加\n使用 /ics 从Google Calendar导入\n或直接附加.ics文件",
    tasks_empty: "✅ 没有待办任务！做得很好！🎉\n\n想看已完成的任务？输入'All Tasks'",
    no_classes_today: "🎉 今天没课！今天的完美计划：\n• 完成任务\n• 自主学习\n• 提前规划",
    no_classes_tomorrow: "🎉 明天没课！时间用来规划或放松！",
    no_next_class: "🎉 未来24小时没有课程！是时候做个人项目了！",
    
    class_added: "✅ 课程添加成功！\n\n📖 课程: {subject}\n📅 日期: {day}\n⏰ 时间: {start} - {end}\n⏱️ 时长: {duration} 分钟\n📍 地点: {location}\n\n我会提前{reminder}分钟提醒！",
    class_updated: "✅ 课程 {id} 已更新！\n{field}: {old_value} → {new_value}",
    class_deleted: "✅ 课程 {id} 已删除！课程表已优化。",
    class_not_found: "❌ 课程 #{id} 未找到。",
    
    task_added: "✅ 任务已创建！\n\n📝 {title}\n📅 截止: {due_date} (还剩{days_until}天)\n🎯 优先级: {priority}\n⏰ 提前2天提醒",
    task_completed: "✅ 任务 #{id} 已完成！🎉\n\n太棒了！已完成{completed_count}个任务！",
    task_deleted: "🗑️ 任务 #{id} 已删除。",
    task_not_found: "❌ 任务 #{id} 未找到。",
    task_snoozed: "⏸️ 任务 #{id} 推迟{days}天。\n新截止日期: {new_date}",
    
    timer_start: "⏱️ *专注会话开始！*\n\n📖 学习: {subject}\n⏰ 时长: {duration} 分钟\n🎯 预计结束: {end_time}\n\n保持专注！你能行！💪",
    timer_end: "⏰ *太棒了！*\n\n📖 完成: {subject}\n⏱️ 时长: {duration} 分钟\n📊 今日总计: {today_total} 分钟\n\n休息一下吧！🎉",
    timer_stop: "❌ 计时器已停止。\n📖 会话: {subject}\n⏱️ 已完成: {elapsed} 分钟\n\n每一分钟都很重要！准备开始新的会话吗？",
    timer_active: "⏱️ 活动会话:\n📖 {subject}\n⏱️ {elapsed}/{duration} 分钟\n🎯 结束时间: {end_time}",
    
    remind_set: "⏰ 提醒已更新！课前{minutes}分钟通知。",
    remind_current: "⏰ 当前提醒: 课前{minutes}分钟。",
    
    quiet_mode_on: "🔕 静音模式2小时。不会发送通知。",
    quiet_mode_off: "🔔 通知已恢复！我会保持更新。",
    
    import_start: "⏳ 正在分析日历...",
    import_done: "✅ 日历已导入！\n\n📊 导入摘要:\n• 总事件: {total}\n• 新课程: {count}\n• 跳过重复: {duplicates}\n\n课程表已更新！",
    import_fail: "❌ 导入失败: {error}\n\n💡 提示:\n• 确认链接可访问\n• 尝试下载并附加文件\n• 使用 /add 手动输入",
    
    stats: `📊 *你的生产力仪表板*

📚 *课程表*
• 总课程: {total_classes}
• 今日: {today_classes}
• 本周: {week_classes}

📝 *任务*
• 已完成: {completed_done}/{total_tasks}
• 高优先级待办: {high_priority}
• 完成率: {completion_rate}%

⏱️ *学习追踪*
• 今日: {today_min} 分钟
• 本周: {study_min} 分钟
• 总计: {total_study} 小时
• 日均: {avg_min} 分钟

🎯 *生产力评分*
{productivity_bar} {score}/100
{productivity_message}`,
    
    time_summary: `⏰ *时间分析*

📅 *今日概览*
• 课程: {today_count}
• 总课时: {class_hours}小时{class_minutes}分钟
• 空闲时间: {free_hours}小时{free_minutes}分钟

⏱️ *下节课*
{next_class_info}

📝 *截止日期*
• 待办任务: {pending_count}
• 今日到期: {due_today}
• 已过期: {overdue}

💡 *建议*
{recommendation}`,
    
    week: "📆 *周概览*\n\n{week_schedule}",
    
    daily_briefing: `🌅 *早上好，{name}！*

📅 *{day}课程表*
{today_schedule}

📝 *优先事项*
{priorities}

⏰ *第一节课*
{first_class}

💪 *激励*
{motivation}`,
    
    unknown: "我不太明白。输入'Help'查看所有功能！",
    
    next_class_detailed: "⏰ *你的下一节课*\n\n📖 {subject}\n📅 {day} ({date})\n🕐 {start_time} - {end_time}\n⏱️ 还有{minutes}分钟开始\n📍 {location}\n\n⏰ 我会提前{reminder}分钟提醒！",
    
    class_context: "📖 {subject} 安排在{day} {start_time}-{end_time}，地点{location}。在此之前你有{classes_before}节课。",
    
    weekdays: ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"],
    weekdays_short: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
    
    productivity_messages: [
      "出色！你是效率大师！🌟",
      "做得好！保持这个势头！💪",
      "进展良好！积少成多！📈",
      "你在养成好习惯！坚持就是胜利！🎯",
      "每一分钟的专注都让你离目标更近！✨"
    ],
    
    motivation_quotes: [
      "成功的秘诀在于开始行动。——马克·吐温",
      "成功不是终点，失败也不是末日：重要的是继续前进的勇气。——丘吉尔",
      "成就伟大工作的唯一方法是热爱你所做的事。——史蒂夫·乔布斯",
      "不要盯着时钟；要做时钟做的事。继续前进。——萨姆·莱文森",
      "你的未来取决于你今天所做的，而不是明天。——罗伯特·清崎"
    ]
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
        reminder_offset: 30,
        quiet_mode: false,
        quiet_until: null,
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
  const cached = getCache(`classes_${userId}`);
  if (cached) return cached;
  
  const { data } = await supabase
    .from("schedule")
    .select("*")
    .eq("user_id", userId)
    .order("day")
    .order("start_time");
  
  const result = data || [];
  setCache(`classes_${userId}`, result, 'classes');
  return result;
}

async function addClass(userId, subject, day, startTime, endTime, location = "") {
  const { error } = await supabase
    .from("schedule")
    .insert({
      user_id: userId,
      subject,
      day: parseInt(day),
      start_time: startTime,
      end_time: endTime,
      location
    });
  
  if (!error) clearUserCache(userId);
  return !error;
}

async function updateClass(userId, classId, field, value) {
  const allowedFields = ["subject", "day", "start_time", "end_time", "location"];
  if (!allowedFields.includes(field)) return { success: false, error: "Invalid field" };
  
  const { data: existing } = await supabase
    .from("schedule")
    .select(field)
    .eq("id", classId)
    .eq("user_id", userId)
    .single();
  
  if (!existing) return { success: false, error: "Class not found" };
  
  const { error } = await supabase
    .from("schedule")
    .update({ [field]: value })
    .eq("id", classId)
    .eq("user_id", userId);
  
  if (!error) {
    clearUserCache(userId);
    return { success: true, oldValue: existing[field] };
  }
  return { success: false, error: "Update failed" };
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
  setCache(cacheKey, result, 'tasks');
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
      remind_days: 2,
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
  
  if (!error) {
    clearUserCache(userId);
    // Update user stats
    const user = await getUser(userId);
    await updateUser(userId, { tasks_completed: (user?.tasks_completed || 0) + 1 });
  }
  return !error;
}

async function snoozeTask(userId, taskId, days) {
  const { data: task } = await supabase
    .from("tasks")
    .select("due_date")
    .eq("id", taskId)
    .eq("user_id", userId)
    .single();
  
  if (!task) return { success: false };
  
  const newDate = new Date(task.due_date);
  newDate.setDate(newDate.getDate() + days);
  const newDueDate = newDate.toISOString().split("T")[0];
  
  const { error } = await supabase
    .from("tasks")
    .update({ due_date: newDueDate })
    .eq("id", taskId)
    .eq("user_id", userId);
  
  if (!error) {
    clearUserCache(userId);
    return { success: true, newDate: newDueDate };
  }
  return { success: false };
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
      date: new Date().toISOString().split("T")[0],
      timestamp: new Date().toISOString()
    });
  
  if (!error) {
    clearUserCache(userId);
    // Update total focus time
    const user = await getUser(userId);
    await updateUser(userId, { total_focus_minutes: (user?.total_focus_minutes || 0) + duration });
  }
  return !error;
}

async function getStudyStats(userId) {
  const cached = getCache(`study_${userId}`);
  if (cached) return cached;
  
  const { data } = await supabase
    .from("study_sessions")
    .select("duration, date, subject")
    .eq("user_id", userId)
    .order("timestamp", { ascending: false })
    .limit(100);
  
  if (!data || data.length === 0) {
    const empty = { total: 0, weekly: 0, today: 0, avg: 0, subjects: {} };
    setCache(`study_${userId}`, empty, 'stats');
    return empty;
  }
  
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  let total = 0, weekly = 0, todayTotal = 0;
  const subjects = {};
  
  for (const s of data) {
    total += s.duration;
    subjects[s.subject] = (subjects[s.subject] || 0) + s.duration;
    if (s.date === today) todayTotal += s.duration;
    if (new Date(s.date) >= weekAgo) weekly += s.duration;
  }
  
  const daysStudied = new Set(data.map(s => s.date)).size;
  const avg = daysStudied > 0 ? Math.round(weekly / Math.min(daysStudied, 7)) : 0;
  
  const result = { total, weekly, today: todayTotal, avg, subjects };
  setCache(`study_${userId}`, result, 'stats');
  return result;
}

// ==================== ENHANCED HELPER FUNCTIONS ====================
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
  const now = new Date();
  const today = getTodayIndex();
  const currentTime = getCurrentTime();
  const classes = await getClasses(userId);
  
  // Find today's next class
  for (const c of classes) {
    if (c.day === today && c.start_time > currentTime) return c;
  }
  
  // Find tomorrow's first class
  const tomorrow = today === 6 ? 0 : today + 1;
  for (const c of classes) {
    if (c.day === tomorrow) return c;
  }
  
  // Find any future class
  for (const c of classes) {
    if (c.day > today || (c.day === today && c.start_time > currentTime)) return c;
  }
  
  return null;
}

async function getClassesBefore(userId, targetClass) {
  const today = getTodayIndex();
  const currentTime = getCurrentTime();
  const classes = await getClasses(userId);
  
  return classes.filter(c => 
    c.day === today && 
    c.start_time < targetClass.start_time &&
    c.start_time >= currentTime
  ).length;
}

function calculateDuration(startTime, endTime) {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

function getProductivityScore(completionRate, studyAvg, attendanceRate) {
  return Math.min(100, Math.round(
    completionRate * 0.4 +
    Math.min(studyAvg / 120 * 100, 100) * 0.3 +
    attendanceRate * 0.3
  ));
}

function getProductivityBar(score) {
  const filled = Math.round(score / 10);
  return "▓".repeat(filled) + "░".repeat(10 - filled);
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

// ==================== ICS IMPORT ====================
async function importICS(userId, source) {
  try {
    let content;
    
    if (source.startsWith("http://") || source.startsWith("https://")) {
      const res = await fetch(source, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
      content = await res.text();
    } else if (source.startsWith("data:")) {
      const match = source.match(/data:text\/calendar[^,]*,?(.+)/);
      if (match) content = decodeURIComponent(match[1]);
    } else {
      content = source;
    }
    
    if (!content || !content.includes("BEGIN:VCALENDAR")) {
      return { success: false, error: "Invalid ICS format" };
    }
    
    const events = [];
    const lines = content.split(/\r?\n/);
    let event = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === "BEGIN:VEVENT") {
        event = {};
      } else if (trimmed === "END:VEVENT" && event) {
        if (event.SUMMARY && event.DTSTART) events.push(event);
        event = null;
      } else if (event && trimmed.includes(":")) {
        const idx = trimmed.indexOf(":");
        const key = trimmed.substring(0, idx).split(";")[0];
        const value = trimmed.substring(idx + 1);
        event[key] = value;
      }
    }
    
    let imported = 0, duplicates = 0;
    const existing = await getClasses(userId);
    
    for (const ev of events) {
      let match = ev.DTSTART?.match(/(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?/);
      if (!match) continue;
      
      const startDate = new Date(
        parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]),
        match[4] ? parseInt(match[4]) : 9,
        match[5] ? parseInt(match[5]) : 0
      );
      
      let day = startDate.getDay();
      day = day === 0 ? 6 : day - 1;
      
      const startTime = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
      
      let endH = startDate.getHours() + 1, endM = startDate.getMinutes();
      const endMatch = ev.DTEND?.match(/(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?/);
      if (endMatch) {
        endH = parseInt(endMatch[4]) || endH;
        endM = parseInt(endMatch[5]) || endM;
      }
      const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
      
      const subject = (ev.SUMMARY || "Class").replace(/\\,/g, ",").trim();
      const location = (ev.LOCATION || "").replace(/\\,/g, ",").trim();
      
      const isDup = existing.some(c => 
        c.subject === subject && c.day === day && c.start_time === startTime
      );
      
      if (!isDup) {
        await addClass(userId, subject, day, startTime, endTime, location);
        imported++;
      } else {
        duplicates++;
      }
    }
    
    return { success: true, count: imported, total: events.length, duplicates };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ==================== ENHANCED STUDY TIMER ====================
function startTimer(userId, subject, duration) {
  if (timers.has(userId)) {
    clearTimeout(timers.get(userId).timeout);
  }
  
  const startTime = Date.now();
  const endTime = new Date(startTime + duration * 60 * 1000);
  
  const timeout = setTimeout(async () => {
    try {
      const lang = await getUserLang(userId);
      const studyStats = await getStudyStats(userId);
      await sendVkMessage(userId, t(lang, "timer_end", { 
        subject, 
        duration, 
        today_total: studyStats.today + duration 
      }));
      await addStudySession(userId, subject, duration);
    } catch (e) {
      console.error("Timer callback error:", e);
    }
    timers.delete(userId);
  }, duration * 60 * 1000);
  
  timers.set(userId, { 
    timeout, 
    subject, 
    duration, 
    startTime,
    endTime: endTime.toISOString()
  });
}

function getTimerStatus(userId) {
  const timer = timers.get(userId);
  if (!timer) return null;
  
  const elapsed = Math.round((Date.now() - timer.startTime) / 60000);
  const remaining = timer.duration - elapsed;
  
  return {
    subject: timer.subject,
    duration: timer.duration,
    elapsed,
    remaining,
    endTime: timer.endTime
  };
}

// ==================== INTELLIGENT FEATURES ====================
async function getDailyBriefing(userId, lang, name) {
  const todayClasses = await getTodayClasses(userId);
  const pendingTasks = await getTasks(userId, true);
  const weekdays = T[lang].weekdays;
  const today = getTodayIndex();
  
  let todaySchedule = "";
  if (todayClasses.length === 0) {
    todaySchedule = t(lang, "no_classes_today");
  } else {
    for (const c of todayClasses) {
      todaySchedule += `⏰ ${c.start_time}-${c.end_time} | ${c.subject}`;
      if (c.location) todaySchedule += ` | 📍 ${c.location}`;
      todaySchedule += "\n";
    }
  }
  
  let priorities = "";
  const highPriorityTasks = pendingTasks.filter(t => t.priority === "high");
  if (highPriorityTasks.length > 0) {
    priorities = "🔴 High Priority:\n";
    for (const t of highPriorityTasks.slice(0, 3)) {
      priorities += `• ${t.title} (Due: ${t.due_date})\n`;
    }
  } else if (pendingTasks.length > 0) {
    priorities = "📝 Pending tasks:\n";
    for (const t of pendingTasks.slice(0, 3)) {
      priorities += `• ${t.title}\n`;
    }
  } else {
    priorities = "✅ All tasks completed! Great job!";
  }
  
  let firstClass = "";
  if (todayClasses.length > 0) {
    const first = todayClasses[0];
    const [h, m] = first.start_time.split(":").map(Number);
    const classTime = new Date();
    classTime.setHours(h, m, 0, 0);
    const mins = Math.round((classTime - new Date()) / 60000);
    
    if (mins > 0) {
      firstClass = `${first.subject} at ${first.start_time} (in ${mins} minutes)`;
    } else {
      firstClass = `${first.subject} at ${first.start_time} (already started)`;
    }
  } else {
    firstClass = "No classes today - free day!";
  }
  
  const quotes = T[lang].motivation_quotes;
  const motivation = quotes[Math.floor(Math.random() * quotes.length)];
  
  return t(lang, "daily_briefing", {
    name,
    day: weekdays[today],
    today_schedule: todaySchedule,
    priorities,
    first_class: firstClass,
    motivation
  });
}

async function getTimeInsights(userId, lang) {
  const todayClasses = await getTodayClasses(userId);
  const pendingTasks = await getTasks(userId, true);
  const nextClass = await getNextClass(userId);
  const today = new Date().toISOString().split("T")[0];
  
  // Calculate class time
  let totalClassMinutes = 0;
  for (const c of todayClasses) {
    totalClassMinutes += calculateDuration(c.start_time, c.end_time);
  }
  const classHours = Math.floor(totalClassMinutes / 60);
  const classMinutes = totalClassMinutes % 60;
  
  // Calculate free time (assuming 16 waking hours)
  const freeMinutes = 16 * 60 - totalClassMinutes;
  const freeHours = Math.floor(freeMinutes / 60);
  const freeMinutesRem = freeMinutes % 60;
  
  // Next class info
  let nextClassInfo = t(lang, "no_next_class");
  if (nextClass) {
    const [h, m] = nextClass.start_time.split(":").map(Number);
    const classTime = new Date();
    classTime.setHours(h, m, 0, 0);
    const mins = Math.max(0, Math.round((classTime - new Date()) / 60000));
    nextClassInfo = `${nextClass.subject} at ${nextClass.start_time} (in ${mins} min)`;
  }
  
  // Deadlines
  const dueToday = pendingTasks.filter(t => t.due_date === today).length;
  const overdue = pendingTasks.filter(t => t.due_date < today).length;
  
  // Recommendation
  let recommendation = "";
  if (overdue > 0) {
    recommendation = `⚠️ You have ${overdue} overdue task(s)! Prioritize these.`;
  } else if (dueToday > 0) {
    recommendation = `📌 ${dueToday} task(s) due today - plan your time accordingly.`;
  } else if (pendingTasks.length === 0) {
    recommendation = "🎉 All caught up! Consider starting a new project or revising.";
  } else {
    recommendation = "💡 You have upcoming tasks. Use free time to get ahead.";
  }
  
  return t(lang, "time_summary", {
    today_count: todayClasses.length,
    class_hours: classHours,
    class_minutes: classMinutes,
    free_hours: freeHours,
    free_minutes: freeMinutesRem,
    next_class_info: nextClassInfo,
    pending_count: pendingTasks.length,
    due_today: dueToday,
    overdue: overdue,
    recommendation
  });
}

async function getWeekOverview(userId, lang) {
  const classes = await getClasses(userId);
  const weekdays = T[lang].weekdays_short || T[lang].weekdays;
  
  if (classes.length === 0) return t(lang, "schedule_empty");
  
  let schedule = "";
  for (let d = 0; d < 7; d++) {
    const dayClasses = classes.filter(c => c.day === d);
    if (dayClasses.length > 0) {
      schedule += `\n*${weekdays[d]}*\n`;
      for (const c of dayClasses) {
        schedule += `  ⏰ ${c.start_time}-${c.end_time} | ${c.subject}\n`;
      }
    }
  }
  
  return t(lang, "week", { week_schedule: schedule });
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
  
  // ===== DAILY BRIEFING =====
  if (lower === "briefing" || lower === "morning" || lower === "брифинг" || lower === "简报") {
    const user = await getUser(userId);
    const briefing = await getDailyBriefing(userId, lang, user?.name || "Student");
    await sendVkMessage(userId, briefing, getKeyboard(lang));
    return;
  }
  
  // ===== TIME SUMMARY =====
  if (lower === "time summary" || lower === "time" || lower === "время" || lower === "时间" || lower === "时间摘要") {
    const insights = await getTimeInsights(userId, lang);
    await sendVkMessage(userId, insights, getKeyboard(lang));
    return;
  }
  
  // ===== SCHEDULE =====
  if (lower === "schedule" || lower === "расписание" || lower === "课程表" || msg.includes("📅")) {
    const classes = await getClasses(userId);
    
    if (classes.length === 0) {
      await sendVkMessage(userId, t(lang, "schedule_empty"), getKeyboard(lang));
      return;
    }
    
    const days = T[lang].weekdays;
    let response = `📅 *${lang === "ru" ? "Расписание" : lang === "zh" ? "课程表" : "Schedule"}*\n\n`;
    
    for (const c of classes) {
      const duration = calculateDuration(c.start_time, c.end_time);
      response += `🆔 ${c.id} | ${days[c.day]} | ${c.start_time}-${c.end_time}\n`;
      response += `   📖 ${c.subject} (${duration}min)\n`;
      if (c.location) response += `   📍 ${c.location}\n`;
      response += `   🗑️ /delete ${c.id} | ✏️ /update ${c.id}\n\n`;
    }
    
    await sendVkMessage(userId, response, getKeyboard(lang));
    return;
  }
  
  // ===== TODAY =====
  if (lower === "today" || lower === "сегодня" || lower === "今天" || msg.includes("📋")) {
    const classes = await getTodayClasses(userId);
    const user = await getUser(userId);
    const reminder = user?.reminder_offset || 30;
    
    if (classes.length === 0) {
      await sendVkMessage(userId, t(lang, "no_classes_today"), getKeyboard(lang));
      return;
    }
    
    const now = new Date();
    const currentTime = getCurrentTime();
    const header = lang === "ru" ? "📋 Сегодня" : lang === "zh" ? "📋 今日课程" : "📋 Today's Classes";
    let response = `*${header}*\n\n`;
    
    for (const c of classes) {
      const status = c.start_time <= currentTime && c.end_time >= currentTime ? "🟢 NOW" :
                     c.start_time > currentTime ? "⏳" : "✅";
      response += `${status} ${c.start_time}-${c.end_time} • *${c.subject}*\n`;
      if (c.location) response += `   📍 ${c.location}\n`;
      
      if (c.start_time > currentTime) {
        const [h, m] = c.start_time.split(":").map(Number);
        const classTime = new Date();
        classTime.setHours(h, m, 0, 0);
        const mins = Math.round((classTime - now) / 60000);
        if (mins <= reminder) {
          response += `   ⚠️ Starting in ${mins} minutes!\n`;
        }
      }
      response += "\n";
    }
    
    await sendVkMessage(userId, response, getKeyboard(lang));
    return;
  }
  
  // ===== TOMORROW =====
  if (lower === "tomorrow" || lower === "завтра" || lower === "明天") {
    const classes = await getTomorrowClasses(userId);
    
    if (classes.length === 0) {
      await sendVkMessage(userId, t(lang, "no_classes_tomorrow"), getKeyboard(lang));
      return;
    }
    
    const header = lang === "ru" ? "📅 Завтра" : lang === "zh" ? "📅 明日课程" : "📅 Tomorrow's Classes";
    let response = `*${header}*\n\n`;
    
    for (const c of classes) {
      response += `⏰ ${c.start_time}-${c.end_time} • *${c.subject}*\n`;
      if (c.location) response += `   📍 ${c.location}\n`;
      response += "\n";
    }
    
    await sendVkMessage(userId, response, getKeyboard(lang));
    return;
  }
  
  // ===== NEXT CLASS (ENHANCED) =====
  if (lower === "next" || lower === "следующая" || lower === "下一节" || lower === "下一个" || 
      lower === "what's next" || lower === "what next" || lower === "что дальше" || lower === "接下来") {
    const next = await getNextClass(userId);
    const user = await getUser(userId);
    const reminder = user?.reminder_offset || 30;
    
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
    const classesBefore = await getClassesBefore(userId, next);
    
    const dateStr = classTime.toLocaleDateString(
      lang === "ru" ? "ru-RU" : lang === "zh" ? "zh-CN" : "en-US",
      { weekday: 'long', month: 'long', day: 'numeric' }
    );
    
    await sendVkMessage(userId, t(lang, "next_class_detailed", {
      subject: next.subject,
      day: days[next.day],
      date: dateStr,
      start_time: next.start_time,
      end_time: next.end_time,
      minutes: mins,
      location: next.location || t(lang, "schedule_empty").includes("empty") ? "—" : "—",
      reminder: reminder
    }), getKeyboard(lang));
    
    // Also send context about classes before
    if (classesBefore > 0) {
      await sendVkMessage(userId, t(lang, "class_context", {
        subject: next.subject,
        day: days[next.day],
        start_time: next.start_time,
        end_time: next.end_time,
        location: next.location || "—",
        classes_before: classesBefore
      }));
    }
    return;
  }
  
  // ===== WEEK =====
  if (lower === "week" || lower === "неделя" || lower === "周" || lower === "本周") {
    const weekOverview = await getWeekOverview(userId, lang);
    await sendVkMessage(userId, weekOverview, getKeyboard(lang));
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
      
      const duration = calculateDuration(startTime, endTime);
      const ok = await addClass(userId, subject, day, startTime, endTime, location);
      if (ok) {
        const user = await getUser(userId);
        const days = T[lang].weekdays;
        await sendVkMessage(userId, t(lang, "class_added", {
          subject, day: days[day], start: startTime, end: endTime,
          duration, location: location || "—",
          reminder: user?.reminder_offset || 30
        }), getKeyboard(lang));
      }
    } else {
      await sendVkMessage(userId, "❌ Format: /add subject day start end [location]", getKeyboard(lang));
    }
    return;
  }
  
  // ===== UPDATE CLASS =====
  if (lower.startsWith("/update")) {
    const parts = msg.split(/\s+/);
    if (parts.length >= 4) {
      const classId = parseInt(parts[1]);
      const field = parts[2];
      const value = parts.slice(3).join(" ");
      
      const result = await updateClass(userId, classId, field, value);
      if (result.success) {
        await sendVkMessage(userId, t(lang, "class_updated", {
          id: classId, field, old_value: result.oldValue, new_value: value
        }), getKeyboard(lang));
      } else {
        await sendVkMessage(userId, t(lang, "class_not_found", { id: classId }), getKeyboard(lang));
      }
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
  if (lower === "tasks" || lower === "задачи" || lower === "任务" || 
      (msg.includes("📝") && !msg.includes("All"))) {
    const tasks = await getTasks(userId, true);
    
    if (tasks.length === 0) {
      await sendVkMessage(userId, t(lang, "tasks_empty"), getKeyboard(lang));
      return;
    }
    
    const today = new Date().toISOString().split("T")[0];
    const header = lang === "ru" ? "📝 Задачи" : lang === "zh" ? "📝 任务" : "📝 Tasks";
    let response = `*${header}* (${tasks.length} pending)\n\n`;
    
    for (const task of tasks) {
      const prio = task.priority || "normal";
      const prioEmoji = prio === "high" ? "🔴" : prio === "medium" ? "🟡" : "🟢";
      const isOverdue = task.due_date < today;
      const isToday = task.due_date === today;
      const status = isOverdue ? "⚠️ OVERDUE" : isToday ? "📌 TODAY" : "";
      
      response += `🆔 ${task.id} | ${prioEmoji} ${prio}\n`;
      response += `   📖 ${task.title}\n`;
      response += `   📅 ${task.due_date} ${status}\n`;
      response += `   ✅ /complete ${task.id} | ⏸️ /snooze ${task.id} | 🗑️ /delete_task ${task.id}\n\n`;
    }
    
    await sendVkMessage(userId, response, getKeyboard(lang));
    return;
  }
  
  // ===== ALL TASKS =====
  if (lower === "all tasks" || lower === "все задачи" || lower === "所有任务") {
    const tasks = await getTasks(userId, false);
    
    if (tasks.length === 0) {
      await sendVkMessage(userId, "No tasks found. Add one with /task!", getKeyboard(lang));
      return;
    }
    
    const completed = tasks.filter(t => t.completed).length;
    const header = lang === "ru" ? "📝 Все задачи" : lang === "zh" ? "📝 所有任务" : "📝 All Tasks";
    let response = `*${header}* (${completed}/${tasks.length} completed)\n\n`;
    
    for (const task of tasks) {
      const status = task.completed ? "✅" : "⬜";
      response += `${status} ${task.id} | ${task.title} | ${task.due_date}\n`;
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
      
      const dueDateTime = new Date(dueDate);
      const daysUntil = Math.ceil((dueDateTime - new Date()) / (1000 * 60 * 60 * 24));
      
      await addTask(userId, title, dueDate, priority);
      await sendVkMessage(userId, t(lang, "task_added", { 
        title, due_date: dueDate, priority, days_until: daysUntil 
      }), getKeyboard(lang));
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
      if (ok) {
        const tasks = await getTasks(userId, false);
        const completedCount = tasks.filter(t => t.completed).length;
        await sendVkMessage(userId, t(lang, "task_completed", { id, completed_count: completedCount }), getKeyboard(lang));
      } else {
        await sendVkMessage(userId, t(lang, "task_not_found", { id }), getKeyboard(lang));
      }
    }
    return;
  }
  
  // ===== SNOOZE TASK =====
  if (lower.startsWith("/snooze")) {
    const parts = msg.split(/\s+/);
    const id = parseInt(parts[1]);
    const days = parseInt(parts[2]) || 1;
    
    if (!isNaN(id)) {
      const result = await snoozeTask(userId, id, days);
      if (result.success) {
        await sendVkMessage(userId, t(lang, "task_snoozed", { id, days, new_date: result.newDate }), getKeyboard(lang));
      } else {
        await sendVkMessage(userId, t(lang, "task_not_found", { id }), getKeyboard(lang));
      }
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
        const endTime = new Date(Date.now() + duration * 60000);
        const endTimeStr = `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`;
        
        await sendVkMessage(userId, t(lang, "timer_start", { subject, duration, end_time: endTimeStr }), getKeyboard(lang));
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
      const elapsed = Math.round((Date.now() - timer.startTime) / 60000);
      timers.delete(userId);
      await sendVkMessage(userId, t(lang, "timer_stop", { subject: timer.subject, elapsed }), getKeyboard(lang));
    } else {
      await sendVkMessage(userId, "❌ No active timer", getKeyboard(lang));
    }
    return;
  }
  
  if (lower === "timer status" || lower === "статус таймера" || lower === "计时器状态") {
    const status = getTimerStatus(userId);
    if (status) {
      const endTime = new Date(status.endTime);
      const endTimeStr = `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`;
      await sendVkMessage(userId, t(lang, "timer_active", {
        subject: status.subject,
        elapsed: status.elapsed,
        duration: status.duration,
        end_time: endTimeStr
      }), getKeyboard(lang));
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
  
  // ===== QUIET MODE =====
  if (lower === "/quiet") {
    const quietUntil = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    await updateUser(userId, { quiet_mode: true, quiet_until: quietUntil });
    await sendVkMessage(userId, t(lang, "quiet_mode_on"), getKeyboard(lang));
    return;
  }
  
  if (lower === "/unquiet") {
    await updateUser(userId, { quiet_mode: false, quiet_until: null });
    await sendVkMessage(userId, t(lang, "quiet_mode_off"), getKeyboard(lang));
    return;
  }
  
  // ===== ICS IMPORT =====
  if (lower.startsWith("/ics")) {
    const url = msg.split(/\s+/)[1];
    if (url) {
      await sendVkMessage(userId, t(lang, "import_start"), getKeyboard(lang));
      const result = await importICS(userId, url);
      
      if (result.success) {
        await sendVkMessage(userId, t(lang, "import_done", { 
          count: result.count, total: result.total, duplicates: result.duplicates 
        }), getKeyboard(lang));
      } else {
        await sendVkMessage(userId, t(lang, "import_fail", { error: result.error }), getKeyboard(lang));
      }
    }
    return;
  }
  
  // ===== ENHANCED STATS =====
  if (lower === "stats" || lower === "статистика" || lower === "统计" || msg.includes("📊")) {
    const [classes, tasks, study] = await Promise.all([
      getClasses(userId),
      getTasks(userId, false),
      getStudyStats(userId)
    ]);
    
    const today = getTodayIndex();
    const todayClasses = classes.filter(c => c.day === today);
    const weekClasses = classes.filter(c => {
      const daysUntil = c.day - today;
      return daysUntil >= 0 && daysUntil < 7;
    });
    
    const completed = tasks.filter(t => t.completed).length;
    const highPriority = tasks.filter(t => !t.completed && t.priority === "high").length;
    const completionRate = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
    
    const score = getProductivityScore(completionRate, study.avg, 80);
    const bar = getProductivityBar(score);
    const messages = T[lang].productivity_messages;
    const message = messages[Math.floor(Math.random() * messages.length)];
    
    await sendVkMessage(userId, t(lang, "stats", {
      total_classes: classes.length,
      today_classes: todayClasses.length,
      week_classes: weekClasses.length,
      completed_done: completed,
      total_tasks: tasks.length,
      high_priority: highPriority,
      completion_rate: completionRate,
      today_min: study.today,
      study_min: study.weekly,
      total_study: Math.round(study.total / 60),
      avg_min: study.avg,
      productivity_bar: bar,
      score,
      productivity_message: message
    }), getKeyboard(lang));
    return;
  }
  
  // ===== STUDY STATS =====
  if (lower === "study stats" || lower === "статистика учёбы" || lower === "学习统计") {
    const study = await getStudyStats(userId);
    
    let response = "*⏱️ Study Statistics*\n\n";
    response += `📊 Today: ${study.today} min\n`;
    response += `📊 This week: ${study.weekly} min\n`;
    response += `📊 Total: ${Math.round(study.total / 60)} hours\n`;
    response += `📊 Daily average: ${study.avg} min\n\n`;
    
    if (Object.keys(study.subjects).length > 0) {
      response += "*Top Subjects:*\n";
      const sorted = Object.entries(study.subjects)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);
      for (const [subject, minutes] of sorted) {
        response += `📖 ${subject}: ${Math.round(minutes / 60)}h ${minutes % 60}m\n`;
      }
    }
    
    await sendVkMessage(userId, response, getKeyboard(lang));
    return;
  }
  
  // ===== CONTEXT-AWARE CLASS QUERIES =====
  // "What class do I have now?"
  if (lower.includes("now") || lower.includes("сейчас") || lower.includes("现在")) {
    const todayClasses = await getTodayClasses(userId);
    const currentTime = getCurrentTime();
    
    const currentClass = todayClasses.find(c => 
      c.start_time <= currentTime && c.end_time >= currentTime
    );
    
    if (currentClass) {
      await sendVkMessage(userId, `🟢 You're in *${currentClass.subject}* right now!\n⏰ ${currentClass.start_time}-${currentClass.end_time}\n📍 ${currentClass.location || "—"}\n📖 Ends at ${currentClass.end_time}`, getKeyboard(lang));
    } else {
      // Find next class
      const nextClass = todayClasses.find(c => c.start_time > currentTime);
      if (nextClass) {
        const [h, m] = nextClass.start_time.split(":").map(Number);
        const classTime = new Date();
        classTime.setHours(h, m, 0, 0);
        const mins = Math.round((classTime - new Date()) / 60000);
        await sendVkMessage(userId, `⏳ No class right now.\n\nNext: *${nextClass.subject}* at ${nextClass.start_time} (in ${mins} minutes)`, getKeyboard(lang));
      } else {
        await sendVkMessage(userId, t(lang, "no_classes_today"), getKeyboard(lang));
      }
    }
    return;
  }
  
  // ===== DEFAULT =====
  const user = await getUser(userId);
  const name = user?.name;
  
  if (!name || name === "Student") {
    await sendVkMessage(userId, t(lang, "ask_name"));
  } else {
    // Smart greeting with context
    const todayClasses = await getTodayClasses(userId);
    const pendingTasks = await getTasks(userId, true);
    const nextClass = await getNextClass(userId);
    
    let greeting = t(lang, "greeting", { name });
    
    // Add context if available
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
      
      console.log(`[${userId}] ${text.substring(0, 100)}`);
      
      const detectedLang = detectLanguage(text);
      let user = await getUser(userId);
      
      // Auto-update language based on what user types
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
        await sendVkMessage(userId, t(lang, "import_start"), getKeyboard(lang));
        try {
          const res = await fetch(icsFile.doc.url);
          const content = await res.text();
          const result = await importICS(userId, `data:text/calendar,${encodeURIComponent(content)}`);
          
          if (result.success) {
            await sendVkMessage(userId, t(lang, "import_done", { 
              count: result.count, total: result.total, duplicates: result.duplicates 
            }), getKeyboard(lang));
          } else {
            await sendVkMessage(userId, t(lang, "import_fail", { error: result.error }), getKeyboard(lang));
          }
        } catch (e) {
          await sendVkMessage(userId, t(lang, "import_fail", { error: e.message }), getKeyboard(lang));
        }
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }
      
      // Handle name detection for new users
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
      
      // Track user session
      userSessions.set(userId, { lastActive: new Date().toISOString(), lang });
      
      // Process the message
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