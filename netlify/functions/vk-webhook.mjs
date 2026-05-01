


import { createClient } from "@supabase/supabase-js";

// ==================== CONFIGURATION ====================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const VK_TOKEN = process.env.VK_TOKEN;
const VK_API_VERSION = "5.199";

// Cache system
const cache = new Map();
const activeTimers = new Map();

function getCached(key) {
  const item = cache.get(key);
  if (item && Date.now() - item.time < 300000) return item.data;
  return null;
}

function setCached(key, data) {
  cache.set(key, { data, time: Date.now() });
}

function clearCache(userId) {
  for (const key of cache.keys()) {
    if (key.includes(String(userId))) cache.delete(key);
  }
}

// ==================== MULTILINGUAL SUPPORT ====================
const TRANSLATIONS = {
  en: {
    // Setup
    ask_name: "👋 Hello! I'm your time management assistant. What's your name?",
    got_name: "🎉 Nice to meet you, {name}! I'll help you manage your time, schedule, and tasks!",
    greeting: "👋 Hey {name}! Ready to make the most of your time today?",
    
    // Schedule Management
    schedule_empty: "📭 Your schedule is empty. Use /add, /ics, or send a calendar file.",
    schedule_header: "📅 **Your Schedule**\n\n",
    schedule_item: "🆔 {id} | {day} | {start}-{end}\n   📖 {subject}\n   📍 {location}\n   ⏱️ Duration: {duration} min\n   🗑️ /delete {id}\n\n",
    today_header: "📋 **Today's Classes**\n\n",
    tomorrow_header: "📅 **Tomorrow's Classes**\n\n",
    week_header: "📆 **This Week's Schedule**\n\n",
    no_classes: "🎉 No classes today! Use this time wisely!",
    no_classes_tomorrow: "🎉 No classes tomorrow! Plan something productive!",
    next_class: "⏰ **Next Class**\n\n📖 {subject}\n📅 {day}\n🕐 {time}\n⏱️ Starts in {minutes} minutes!\n📍 {location}",
    no_next_class: "🎉 No upcoming classes! Time to review your tasks or study!",
    
    // Time Management
    time_summary: "⏰ **Time Summary**\n\n📚 Classes today: {classes_today}\n⏱️ Total class time: {class_hours}h {class_minutes}min\n📝 Pending tasks: {pending_tasks}\n🎯 Upcoming deadlines: {deadlines}\n\n💡 Time until next class: {time_until}",
    study_timer_start: "⏱️ **Study Timer Started!**\n\nSubject: {subject}\nDuration: {duration} minutes\n\nI'll notify you when time's up! Focus! 🎯",
    study_timer_end: "⏰ **Time's Up!**\n\nGreat job studying {subject} for {duration} minutes! 🎉\n\n📊 Type 'Stats' to see your study progress!",
    study_timer_cancel: "❌ Study timer cancelled. No active timer found.",
    study_logged: "📚 Logged {duration} minutes studying {subject}! Total study time: {total} hours!",
    
    // Task Management with Deadlines
    tasks_empty: "✅ No pending tasks! All caught up!",
    tasks_header: "📝 **Your Tasks & Deadlines**\n\n",
    task_item: "🆔 {id} | 📅 Due: {due_date}\n   📖 {title}\n   ⏰ Reminder: {remind_days} days before\n   🎯 Priority: {priority}\n   ✅ /complete {id}\n   ⏸️ /snooze {id}\n   🗑️ /delete_task {id}\n\n",
    task_added: "✅ Task added!\n\n📝 {title}\n📅 Due: {due_date}\n⏰ I'll remind you {remind_days} days before!\n🎯 Priority: {priority}",
    task_completed: "✅ Task {id} completed! 🎉\n\nGreat job staying on track!",
    task_snoozed: "⏸️ Task {id} snoozed for {days} days! New due date: {new_date}",
    task_deleted: "🗑️ Task {id} deleted!",
    task_not_found: "❌ Task not found.",
    deadline_reminder: "⏰ **DEADLINE REMINDER!**\n\nTask: {title}\nDue: {due_date}\n{days_left} day(s) remaining!\n\nDon't forget to complete it!",
    
    // Priority Levels
    priority_high: "🔴 High",
    priority_medium: "🟡 Medium", 
    priority_low: "🟢 Low",
    
    // Add/Delete/Update
    class_added: "✅ Class added!\n\n📖 {subject}\n📅 {day}\n⏰ {start}-{end}\n⏱️ Duration: {duration} minutes\n📍 {location}",
    class_updated: "✅ Class {id} updated!\n\n{field}: {old} → {new}",
    class_deleted: "✅ Class {id} deleted!",
    class_not_found: "❌ Class not found.",
    wrong_format: "❌ Wrong format. Use /add <subject> <day> <start> <end> [location]",
    update_format: "📝 **Update Format:**\n/update <class_id> <field> <new_value>\n\nFields: subject, day, start_time, end_time, location",
    
    // ICS Import
    import_start: "⏳ Importing calendar... Please wait.",
    import_success: "✅ Success! Imported {count} classes into your schedule!\n\n📅 Total events found: {total}\n✨ New classes: {new}\n⚠️ Duplicates skipped: {duplicates}",
    import_fail: "❌ Import failed.\n\nError: {error}\n\n💡 Try:\n1. Download the ICS file manually\n2. Attach the file directly to this chat\n3. Or add classes manually with /add",
    import_instructions: "📥 **Import Calendar**\n\nSend an ICS link:\n`/ics <url>`\n\nOr attach an .ics file directly.\n\nSupported sources:\n• Google Calendar\n• Outlook Calendar\n• University portals\n• Any valid .ics file",
    
    // Statistics & Analytics
    stats_header: "📊 **Your Productivity Analytics**\n\n",
    stats_classes: "📚 **SCHEDULE OVERVIEW**\n   • Total classes: {total}\n   • Classes today: {today}\n   • Classes this week: {week}\n   • Total study hours: {hours}h {minutes}min\n\n",
    stats_tasks: "📝 **TASK MASTERY**\n   • Completed: {completed}\n   • Pending: {pending}\n   • High priority: {high_priority}\n   • Completion rate: {rate}%\n   • On-time rate: {on_time}%\n\n",
    stats_study: "⏱️ **STUDY TRACKING**\n   • Today: {today_study} min\n   • This week: {week_study} min\n   • Total: {total_study} min\n   • Daily average: {avg_study} min\n\n",
    stats_productivity: "🎯 **PRODUCTIVITY SCORE**\n   • Score: {score}/100\n   • {bar}\n   • {message}\n\n",
    stats_attendance: "✅ **ATTENDANCE**\n   • Attended: {attended}/{total_classes} ({rate}%)\n   • {bar}\n\n",
    stats_motivation: "💡 {message}",
    
    // Study Timer
    timer_help: "⏱️ **Study Timer**\n\nStart a focused study session:\n`/study <subject> <minutes>`\n\nExamples:\n• `/study Math 30`\n• `/study Physics 45`\n• `/study English 60`\n\nI'll notify you when time's up!",
    timer_running: "⏱️ You have an active study timer for {subject} with {minutes} minutes remaining!\n\nUse `/stop` to cancel.",
    
    // Reminder Settings
    reminder_set: "⏰ Reminder set! I'll remind you {minutes} minutes before each class.",
    reminder_current: "Current reminder setting: {minutes} minutes before class.",
    reminder_help: "⏰ **Reminder Settings**\n\nSet reminder time:\n`/remind <minutes>`\n\nExample: `/remind 30` (remind 30 min before class)\n\nRange: 5-120 minutes",
    
    // Attendance
    attendance_marked: "✅ Attendance marked for {class_name}! 📚\n\nKeep up the good attendance!",
    attendance_error: "❌ Couldn't mark attendance. Class not found for today.",
    attendance_prompt: "📚 Which class did you attend?\n\n{classes}\n\nReply with the number or name.",
    attendance_stats: "📅 **Attendance Rate**: {attended}/{total} ({rate}%)\n{bar}",
    
    // Help
    help_text: `🤖 **Time Management Assistant - Help**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 **SCHEDULE MANAGEMENT**
• "Schedule" - View all classes
• "Today" - Today's classes
• "Tomorrow" - Tomorrow's classes
• "Week" - This week's schedule
• "Next" - Next class
• /add <subject> <day> <start> <end> - Add class
• /update <id> <field> <value> - Update class
• /delete <id> - Delete class

📝 **TASK & DEADLINE MANAGEMENT**
• "Tasks" - View pending tasks
• /task "Title" YYYY-MM-DD [priority] - Add task
• /complete <id> - Complete task
• /snooze <id> [days] - Postpone task
• /delete_task <id> - Delete task

⏱️ **STUDY TIMER**
• /study <subject> <minutes> - Start study session
• /stop - Stop current timer
• "Study stats" - View study analytics

📥 **IMPORT SCHEDULE**
• /ics <url> - Import from ICS link
• Attach .ics file directly

📊 **ANALYTICS & STATS**
• "Stats" - Complete productivity report
• "Time" - Time management summary
• "Attendance" - Attendance tracking

⚙️ **SETTINGS**
• /remind <minutes> - Set reminder time
• /lang en/ru/zh - Change language

🎯 **PRIORITIES**
• high - 🔴 Urgent & Important
• medium - 🟡 Important
• low - 🟢 Can wait

📋 **EXAMPLES**
• /add Math 1 10:30 12:05 Room 101
• /task "Final Project" 2025-12-20 high
• /study Physics 45
• /ics https://calendar.ics

Days: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun`,
    
    // Day names
    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    days_short: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    
    // Language
    lang_changed: "🌐 Language changed to English!",
    current_lang: "🌐 Current language: English",
    
    // Messages
    unknown: "🤔 How can I help? Type 'Help' to see all commands.",
    time: "🕐 Current time: {time}",
    joke: "😂 Here's a joke for you:\n\n{joke}",
    weekdays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
  },
  
  ru: {
    ask_name: "👋 Привет! Я твой помощник по тайм-менеджменту. Как тебя зовут?",
    got_name: "🎉 Приятно познакомиться, {name}! Я помогу управлять твоим временем!",
    greeting: "👋 Привет {name}! Готов эффективно использовать своё время?",
    
    schedule_empty: "📭 Расписание пусто. Используй /add, /ics или отправь файл календаря.",
    schedule_header: "📅 **Твоё расписание**\n\n",
    schedule_item: "🆔 {id} | {day} | {start}-{end}\n   📖 {subject}\n   📍 {location}\n   ⏱️ Длительность: {duration} мин\n   🗑️ /delete {id}\n\n",
    today_header: "📋 **Пары сегодня**\n\n",
    tomorrow_header: "📅 **Пары завтра**\n\n",
    week_header: "📆 **Расписание на неделю**\n\n",
    no_classes: "🎉 Сегодня нет пар! Используй время с умом!",
    no_classes_tomorrow: "🎉 Завтра нет пар! Запланируй что-то полезное!",
    next_class: "⏰ **Следующая пара**\n\n📖 {subject}\n📅 {day}\n🕐 {time}\n⏱️ Через {minutes} минут!\n📍 {location}",
    no_next_class: "🎉 Нет предстоящих пар! Время проверить задачи!",
    
    time_summary: "⏰ **Сводка по времени**\n\n📚 Пар сегодня: {classes_today}\n⏱️ Общее время: {class_hours}ч {class_minutes}мин\n📝 Ожидает задач: {pending_tasks}\n🎯 Ближайшие дедлайны: {deadlines}\n\n💡 До следующей пары: {time_until}",
    study_timer_start: "⏱️ **Таймер учёбы запущен!**\n\nПредмет: {subject}\nДлительность: {duration} минут\n\nЯ сообщу когда время выйдет! Сосредоточься! 🎯",
    study_timer_end: "⏰ **Время вышло!**\n\nОтлично позанимался {subject} {duration} минут! 🎉\n\n📊 Введи 'Stats' чтобы увидеть прогресс!",
    study_timer_cancel: "❌ Таймер учёбы отменён. Активных таймеров нет.",
    study_logged: "📚 Записал {duration} минут учёбы по {subject}! Общее время: {total} часов!",
    
    tasks_empty: "✅ Нет активных задач! Всё выполнено!",
    tasks_header: "📝 **Твои задачи и дедлайны**\n\n",
    task_item: "🆔 {id} | 📅 Срок: {due_date}\n   📖 {title}\n   ⏰ Напомню за {remind_days} дн.\n   🎯 Приоритет: {priority}\n   ✅ /complete {id}\n   ⏸️ /snooze {id}\n   🗑️ /delete_task {id}\n\n",
    task_added: "✅ Задача добавлена!\n\n📝 {title}\n📅 Срок: {due_date}\n⏰ Напомню за {remind_days} дн.\n🎯 Приоритет: {priority}",
    task_completed: "✅ Задача {id} выполнена! 🎉\n\nОтлично, ты на верном пути!",
    task_snoozed: "⏸️ Задача {id} отложена на {days} дн. Новый срок: {new_date}",
    task_deleted: "🗑️ Задача {id} удалена!",
    task_not_found: "❌ Задача не найдена.",
    deadline_reminder: "⏰ **НАПОМИНАНИЕ О ДЕДЛАЙНЕ!**\n\nЗадача: {title}\nСрок: {due_date}\nОсталось {days_left} дн.\n\nНе забудь выполнить!",
    
    priority_high: "🔴 Высокий",
    priority_medium: "🟡 Средний",
    priority_low: "🟢 Низкий",
    
    class_added: "✅ Пара добавлена!\n\n📖 {subject}\n📅 {day}\n⏰ {start}-{end}\n⏱️ Длительность: {duration} мин\n📍 {location}",
    class_updated: "✅ Пара {id} обновлена!\n\n{field}: {old} → {new}",
    class_deleted: "✅ Пара {id} удалена!",
    class_not_found: "❌ Пара не найдена.",
    wrong_format: "❌ Неверный формат. Используй /add <предмет> <день> <начало> <конец> [место]",
    update_format: "📝 **Формат обновления:**\n/update <id> <поле> <новое_значение>\n\nПоля: subject, day, start_time, end_time, location",
    
    import_start: "⏳ Импортирую расписание... Пожалуйста, подожди.",
    import_success: "✅ Успех! Импортировано {count} пар в расписание!\n\n📅 Всего событий: {total}\n✨ Новых: {new}\n⚠️ Пропущено дубликатов: {duplicates}",
    import_fail: "❌ Ошибка импорта.\n\nОшибка: {error}\n\n💡 Попробуй:\n1. Скачай ICS файл вручную\n2. Отправь файл напрямую в чат\n3. Или добавь пары вручную через /add",
    import_instructions: "📥 **Импорт расписания**\n\nОтправь ICS ссылку:\n`/ics <url>`\n\nИли прикрепи .ics файл напрямую.\n\nПоддерживаемые источники:\n• Google Calendar\n• Outlook Calendar\n• Университетские порталы\n• Любой .ics файл",
    
    stats_header: "📊 **Твоя аналитика продуктивности**\n\n",
    stats_classes: "📚 **ОБЗОР РАСПИСАНИЯ**\n   • Всего пар: {total}\n   • Пар сегодня: {today}\n   • Пар на неделе: {week}\n   • Всего часов учёбы: {hours}ч {minutes}мин\n\n",
    stats_tasks: "📝 **ВЫПОЛНЕНИЕ ЗАДАЧ**\n   • Выполнено: {completed}\n   • Ожидает: {pending}\n   • Высокий приоритет: {high_priority}\n   • Выполнение: {rate}%\n   • Своевременность: {on_time}%\n\n",
    stats_study: "⏱️ **ОТСЛЕЖИВАНИЕ УЧЁБЫ**\n   • Сегодня: {today_study} мин\n   • На этой неделе: {week_study} мин\n   • Всего: {total_study} мин\n   • В среднем: {avg_study} мин/день\n\n",
    stats_productivity: "🎯 **ПРОДУКТИВНОСТЬ**\n   • Оценка: {score}/100\n   • {bar}\n   • {message}\n\n",
    stats_attendance: "✅ **ПОСЕЩАЕМОСТЬ**\n   • Посещено: {attended}/{total_classes} ({rate}%)\n   • {bar}\n\n",
    stats_motivation: "💡 {message}",
    
    timer_help: "⏱️ **Таймер учёбы**\n\nНачни фокусированную сессию:\n`/study <предмет> <минуты>`\n\nПримеры:\n• `/study Математика 30`\n• `/study Физика 45`\n• `/study Английский 60`\n\nЯ сообщу когда время выйдет!",
    timer_running: "⏱️ У тебя активный таймер для {subject} - осталось {minutes} минут!\n\nИспользуй `/stop` чтобы отменить.",
    
    reminder_set: "⏰ Напоминание установлено! Напомню за {minutes} минут до пары.",
    reminder_current: "Текущее время напоминания: {minutes} минут до пары.",
    reminder_help: "⏰ **Настройки напоминаний**\n\nУстанови время напоминания:\n`/remind <минуты>`\n\nПример: `/remind 30` (напомнить за 30 минут)\n\nДиапазон: 5-120 минут",
    
    attendance_marked: "✅ Посещение отмечено для {class_name}! 📚\n\nПродолжай в том же духе!",
    attendance_error: "❌ Не удалось отметить посещение. Пара не найдена на сегодня.",
    attendance_prompt: "📚 Какую пару ты посетил?\n\n{classes}\n\nОтветь номером или названием.",
    attendance_stats: "📅 **Посещаемость**: {attended}/{total} ({rate}%)\n{bar}",
    
    help_text: `🤖 **Помощник по тайм-менеджменту - Помощь**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 **УПРАВЛЕНИЕ РАСПИСАНИЕМ**
• "Schedule" - Все пары
• "Today" - Пары сегодня
• "Tomorrow" - Пары завтра
• "Week" - Расписание на неделю
• "Next" - Следующая пара
• /add <предмет> <день> <начало> <конец> - Добавить пару
• /update <id> <поле> <значение> - Обновить пару
• /delete <id> - Удалить пару

📝 **УПРАВЛЕНИЕ ЗАДАЧАМИ**
• "Tasks" - Список задач
• /task "Название" ГГГГ-ММ-ДД [приоритет] - Добавить задачу
• /complete <id> - Выполнить задачу
• /snooze <id> [дни] - Отложить задачу
• /delete_task <id> - Удалить задачу

⏱️ **ТАЙМЕР УЧЁБЫ**
• /study <предмет> <минуты> - Начать сессию
• /stop - Остановить таймер
• "Study stats" - Аналитика учёбы

📥 **ИМПОРТ РАСПИСАНИЯ**
• /ics <url> - Импорт из ICS ссылки
• Прикрепи .ics файл напрямую

📊 **АНАЛИТИКА И СТАТИСТИКА**
• "Stats" - Полный отчёт продуктивности
• "Time" - Сводка по времени
• "Attendance" - Отслеживание посещений

⚙️ **НАСТРОЙКИ**
• /remind <минуты> - Время напоминания
• /lang en/ru/zh - Сменить язык

🎯 **ПРИОРИТЕТЫ**
• high - 🔴 Срочно и важно
• medium - 🟡 Важно
• low - 🟢 Может подождать

📋 **ПРИМЕРЫ**
• /add Математика 1 10:30 12:05 Ауд 101
• /task "Курсовая" 2025-12-20 high
• /study Физика 45
• /ics https://calendar.ics

Дни: 0=Пн, 1=Вт, 2=Ср, 3=Чт, 4=Пт, 5=Сб, 6=Вс`,
    
    days: ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"],
    days_short: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
    
    lang_changed: "🌐 Язык изменён на Русский!",
    current_lang: "🌐 Текущий язык: Русский",
    
    unknown: "🤔 Чем помочь? Напиши 'Help' чтобы увидеть команды.",
    time: "🕐 Текущее время: {time}",
    joke: "😂 Шутка для тебя:\n\n{joke}",
    weekdays: ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"]
  },
  
  zh: {
    ask_name: "👋 你好！我是你的时间管理助手。你叫什么名字？",
    got_name: "🎉 很高兴认识你，{name}！我会帮你管理时间和任务！",
    greeting: "👋 你好 {name}！准备好高效利用时间了吗？",
    
    schedule_empty: "📭 课程表为空。使用 /add、/ics 或发送日历文件。",
    schedule_header: "📅 **你的课程表**\n\n",
    schedule_item: "🆔 {id} | {day} | {start}-{end}\n   📖 {subject}\n   📍 {location}\n   ⏱️ 时长：{duration}分钟\n   🗑️ /delete {id}\n\n",
    today_header: "📋 **今日课程**\n\n",
    tomorrow_header: "📅 **明日课程**\n\n",
    week_header: "📆 **本周课程**\n\n",
    no_classes: "🎉 今天没课！合理安排时间！",
    no_classes_tomorrow: "🎉 明天没课！规划一些有意义的事！",
    next_class: "⏰ **下一节课**\n\n📖 {subject}\n📅 {day}\n🕐 {time}\n⏱️ {minutes}分钟后开始！\n📍 {location}",
    no_next_class: "🎉 没有即将开始的课程！检查一下任务！",
    
    time_summary: "⏰ **时间总结**\n\n📚 今日课程：{classes_today}\n⏱️ 总课时：{class_hours}小时{class_minutes}分钟\n📝 待办任务：{pending_tasks}\n🎯 即将截止：{deadlines}\n\n💡 距离下节课：{time_until}",
    study_timer_start: "⏱️ **学习计时器已启动！**\n\n科目：{subject}\n时长：{duration}分钟\n\n时间到时会通知你！专注学习！🎯",
    study_timer_end: "⏰ **时间到！**\n\n学习了{subject} {duration}分钟，太棒了！🎉\n\n📊 输入'Stats'查看学习进度！",
    study_timer_cancel: "❌ 学习计时器已取消。没有活动的计时器。",
    study_logged: "📚 记录了学习{subject} {duration}分钟！总学习时间：{total}小时！",
    
    tasks_empty: "✅ 没有待办任务！都完成了！",
    tasks_header: "📝 **你的任务和截止日期**\n\n",
    task_item: "🆔 {id} | 📅 截止：{due_date}\n   📖 {title}\n   ⏰ 提前{remind_days}天提醒\n   🎯 优先级：{priority}\n   ✅ /complete {id}\n   ⏸️ /snooze {id}\n   🗑️ /delete_task {id}\n\n",
    task_added: "✅ 任务已添加！\n\n📝 {title}\n📅 截止：{due_date}\n⏰ 提前{remind_days}天提醒\n🎯 优先级：{priority}",
    task_completed: "✅ 任务 {id} 已完成！🎉\n\n保持节奏，继续前进！",
    task_snoozed: "⏸️ 任务 {id} 推迟 {days} 天！新截止日期：{new_date}",
    task_deleted: "🗑️ 任务 {id} 已删除！",
    task_not_found: "❌ 任务未找到。",
    deadline_reminder: "⏰ **截止日期提醒！**\n\n任务：{title}\n截止：{due_date}\n还剩 {days_left} 天！\n\n不要忘记完成！",
    
    priority_high: "🔴 高",
    priority_medium: "🟡 中",
    priority_low: "🟢 低",
    
    class_added: "✅ 课程已添加！\n\n📖 {subject}\n📅 {day}\n⏰ {start}-{end}\n⏱️ 时长：{duration}分钟\n📍 {location}",
    class_updated: "✅ 课程 {id} 已更新！\n\n{field}: {old} → {new}",
    class_deleted: "✅ 课程 {id} 已删除！",
    class_not_found: "❌ 课程未找到。",
    wrong_format: "❌ 格式错误。使用 /add <课程> <星期> <开始> <结束> [地点]",
    update_format: "📝 **更新格式：**\n/update <id> <字段> <新值>\n\n字段：subject, day, start_time, end_time, location",
    
    import_start: "⏳ 正在导入日历... 请稍候。",
    import_success: "✅ 成功！已导入 {count} 节课！\n\n📅 总事件：{total}\n✨ 新增：{new}\n⚠️ 跳过重复：{duplicates}",
    import_fail: "❌ 导入失败。\n\n错误：{error}\n\n💡 尝试：\n1. 手动下载ICS文件\n2. 直接发送文件到聊天\n3. 或使用 /add 手动添加课程",
    import_instructions: "📥 **导入日历**\n\n发送ICS链接：\n`/ics <url>`\n\n或直接附加.ics文件。\n\n支持来源：\n• Google Calendar\n• Outlook Calendar\n• 学校网站\n• 任何有效的.ics文件",
    
    stats_header: "📊 **你的生产力分析**\n\n",
    stats_classes: "📚 **课程概览**\n   • 总课程：{total}\n   • 今日课程：{today}\n   • 本周课程：{week}\n   • 总学习时间：{hours}小时{minutes}分钟\n\n",
    stats_tasks: "📝 **任务完成情况**\n   • 已完成：{completed}\n   • 待完成：{pending}\n   • 高优先级：{high_priority}\n   • 完成率：{rate}%\n   • 准时率：{on_time}%\n\n",
    stats_study: "⏱️ **学习追踪**\n   • 今日：{today_study} 分钟\n   • 本周：{week_study} 分钟\n   • 总计：{total_study} 分钟\n   • 日均：{avg_study} 分钟\n\n",
    stats_productivity: "🎯 **生产力评分**\n   • 得分：{score}/100\n   • {bar}\n   • {message}\n\n",
    stats_attendance: "✅ **出勤率**\n   • 已出勤：{attended}/{total_classes} ({rate}%)\n   • {bar}\n\n",
    stats_motivation: "💡 {message}",
    
    timer_help: "⏱️ **学习计时器**\n\n开始专注学习：\n`/study <科目> <分钟>`\n\n示例：\n• `/study 数学 30`\n• `/study 物理 45`\n• `/study 英语 60`\n\n时间到时会通知你！",
    timer_running: "⏱️ 你有一个进行中的计时器：{subject}，还剩 {minutes} 分钟！\n\n使用 `/stop` 取消。",
    
    reminder_set: "⏰ 提醒已设置！课前{minutes}分钟提醒。",
    reminder_current: "当前提醒设置：课前{minutes}分钟。",
    reminder_help: "⏰ **提醒设置**\n\n设置提醒时间：\n`/remind <分钟>`\n\n示例：`/remind 30`（提前30分钟提醒）\n\n范围：5-120分钟",
    
    attendance_marked: "✅ 已标记 {class_name} 的出勤！📚\n\n保持良好出勤记录！",
    attendance_error: "❌ 无法标记出勤。今日未找到该课程。",
    attendance_prompt: "📚 你上了哪节课？\n\n{classes}\n\n回复课程编号或名称。",
    attendance_stats: "📅 **出勤率**：{attended}/{total} ({rate}%)\n{bar}",
    
    help_text: `🤖 **时间管理助手 - 帮助**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 **课程管理**
• "Schedule" - 查看所有课程
• "Today" - 今日课程
• "Tomorrow" - 明日课程
• "Week" - 本周课程
• "Next" - 下一节课
• /add <课程> <星期> <开始> <结束> - 添加课程
• /update <id> <字段> <值> - 更新课程
• /delete <id> - 删除课程

📝 **任务与截止日期**
• "Tasks" - 查看任务
• /task "任务名" 年-月-日 [优先级] - 添加任务
• /complete <id> - 完成任务
• /snooze <id> [天数] - 推迟任务
• /delete_task <id> - 删除任务

⏱️ **学习计时器**
• /study <科目> <分钟> - 开始学习
• /stop - 停止计时器
• "Study stats" - 学习统计

📥 **导入课程表**
• /ics <url> - 从ICS链接导入
• 直接附加.ics文件

📊 **统计与分析**
• "Stats" - 完整生产力报告
• "Time" - 时间总结
• "Attendance" - 出勤追踪

⚙️ **设置**
• /remind <分钟> - 设置提醒时间
• /lang en/ru/zh - 切换语言

🎯 **优先级**
• high - 🔴 紧急重要
• medium - 🟡 重要
• low - 🟢 可以等待

📋 **示例**
• /add 数学 1 10:30 12:05 101教室
• /task "期末考试" 2025-12-20 high
• /study 物理 45
• /ics https://calendar.ics

星期：0=周一, 1=周二, 2=周三, 3=周四, 4=周五, 5=周六, 6=周日`,
    
    days: ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"],
    days_short: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
    
    lang_changed: "🌐 语言已切换为中文！",
    current_lang: "🌐 当前语言：中文",
    
    unknown: "🤔 需要帮助？输入'Help'查看命令。",
    time: "🕐 当前时间：{time}",
    joke: "😂 给你讲个笑话：\n\n{joke}",
    weekdays: ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"]
  }
};

// Jokes
const JOKES = {
  en: [
    "Why don't scientists trust atoms? Because they make up everything!",
    "What do you call a fake noodle? An impasta!",
    "Why did the scarecrow win an award? He was outstanding in his field!",
    "What do you call a bear with no teeth? A gummy bear!"
  ],
  ru: [
    "Почему программисты путают Хэллоуин с Рождеством? 31 Oct = 25 Dec!",
    "Как называется ложная лапша? Паста-фальшивка!",
    "Что говорит один ноль другому? Без тебя я просто пустое место!",
    "Почему студенты любят овощи? Потому что они всегда есть!"
  ],
  zh: [
    "为什么科学家不相信原子？因为它们构成了一切！",
    "什么叫假面条？假面食！",
    "稻草人为什么得奖？因为他在田里表现出色！",
    "没有牙齿的熊叫什么？软糖熊！"
  ]
};

// Motivational messages
const MOTIVATION = {
  en: [
    "You're doing amazing! Keep pushing forward! 💪",
    "Every step counts! Progress over perfection! 🌟",
    "Your dedication is inspiring! 🎯",
    "Small daily improvements lead to big results! 📈",
    "Consistency is the key, and you're crushing it! 🔑"
  ],
  ru: [
    "У тебя отлично получается! Продолжай в том же духе! 💪",
    "Каждый шаг имеет значение! Прогресс важнее совершенства! 🌟",
    "Твоя целеустремлённость вдохновляет! 🎯",
    "Маленькие ежедневные улучшения ведут к большим результатам! 📈",
    "Постоянство - ключ к успеху, и у тебя отлично получается! 🔑"
  ],
  zh: [
    "你做得太棒了！继续加油！💪",
    "每一步都很重要！进步胜于完美！🌟",
    "你的努力很鼓舞人心！🎯",
    "小小的日常改进会带来巨大的成果！📈",
    "坚持是关键，而你做得很好！🔑"
  ]
};

// ==================== LANGUAGE DETECTION ====================
function detectLanguage(text) {
  if (!text) return "en";
  if (/[\u4e00-\u9fff]/.test(text)) return "zh";
  if (/[а-яА-Я]/.test(text)) return "ru";
  return "en";
}

function getTranslation(lang, key, params = {}) {
  let text = TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key] || key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(new RegExp(`{${k}}`, "g"), v);
  }
  return text;
}

function createProgressBar(percentage, length = 10) {
  const filled = Math.floor(percentage / 100 * length);
  return "█".repeat(filled) + "░".repeat(length - filled);
}

// ==================== DATABASE FUNCTIONS ====================
async function getOrCreateUser(userId, detectedLang = "en") {
  const { data: existing } = await supabase
    .from("users")
    .select("*")
    .eq("vk_id", userId)
    .single();
  
  if (existing) return existing;
  
  const { data: newUser, error } = await supabase
    .from("users")
    .insert({ vk_id: userId, name: "Student", language: detectedLang, reminder_offset: 30 })
    .select()
    .single();
  
  if (error) console.error("Create user error:", error);
  return newUser;
}

async function getUserLanguage(userId) {
  const cached = getCached(`lang_${userId}`);
  if (cached) return cached;
  
  const { data, error } = await supabase
    .from("users")
    .select("language")
    .eq("vk_id", userId)
    .single();
  
  const lang = error ? "en" : (data?.language || "en");
  setCached(`lang_${userId}`, lang);
  return lang;
}

async function setUserLanguage(userId, language) {
  const { error } = await supabase
    .from("users")
    .update({ language })
    .eq("vk_id", userId);
  
  if (!error) {
    clearCache(userId);
    setCached(`lang_${userId}`, language);
  }
  return !error;
}

async function getUserName(userId) {
  const cached = getCached(`name_${userId}`);
  if (cached) return cached;
  
  const { data, error } = await supabase
    .from("users")
    .select("name")
    .eq("vk_id", userId)
    .single();
  
  const name = error ? "Student" : (data?.name || "Student");
  setCached(`name_${userId}`, name);
  return name;
}

async function setUserName(userId, name) {
  const { error } = await supabase
    .from("users")
    .update({ name })
    .eq("vk_id", userId);
  
  if (!error) clearCache(userId);
  return !error;
}

async function getUserReminderOffset(userId) {
  const cached = getCached(`reminder_${userId}`);
  if (cached) return cached;
  
  const { data, error } = await supabase
    .from("users")
    .select("reminder_offset")
    .eq("vk_id", userId)
    .single();
  
  const offset = error ? 30 : (data?.reminder_offset || 30);
  setCached(`reminder_${userId}`, offset);
  return offset;
}

async function setUserReminderOffset(userId, minutes) {
  const { error } = await supabase
    .from("users")
    .update({ reminder_offset: minutes })
    .eq("vk_id", userId);
  
  if (!error) clearCache(userId);
  return !error;
}

// Schedule functions
async function addClass(userId, subject, day, startTime, endTime, location = "") {
  const { error } = await supabase.from("schedule").insert({
    user_id: userId, subject, day: parseInt(day), start_time: startTime, end_time: endTime, location
  });
  if (!error) clearCache(userId);
  return !error;
}

async function updateClass(classId, userId, field, value) {
  const allowedFields = ["subject", "day", "start_time", "end_time", "location"];
  if (!allowedFields.includes(field)) return false;
  
  const { error } = await supabase
    .from("schedule")
    .update({ [field]: value })
    .eq("id", classId)
    .eq("user_id", userId);
  
  if (!error) clearCache(userId);
  return !error;
}

async function getClasses(userId) {
  const cached = getCached(`schedule_${userId}`);
  if (cached) return cached;
  
  const { data, error } = await supabase
    .from("schedule")
    .select("*")
    .eq("user_id", userId)
    .order("day", { ascending: true })
    .order("start_time", { ascending: true });
  
  const result = error ? [] : data;
  setCached(`schedule_${userId}`, result);
  return result;
}

async function deleteClass(classId, userId) {
  const { error } = await supabase
    .from("schedule")
    .delete()
    .eq("id", classId)
    .eq("user_id", userId);
  
  if (!error) clearCache(userId);
  return !error;
}

// Task functions
async function addTask(userId, title, dueDate, remindDays = 2, priority = "normal") {
  const { error } = await supabase.from("tasks").insert({
    user_id: userId, title, due_date: dueDate, remind_days: remindDays, priority, completed: false
  });
  if (!error) clearCache(userId);
  return !error;
}

async function getTasks(userId, onlyPending = true) {
  const cached = getCached(`tasks_${userId}_${onlyPending}`);
  if (cached) return cached;
  
  let query = supabase.from("tasks").select("*").eq("user_id", userId);
  if (onlyPending) query = query.eq("completed", false);
  
  const { data, error } = await query.order("due_date", { ascending: true });
  const result = error ? [] : data;
  setCached(`tasks_${userId}_${onlyPending}`, result);
  return result;
}

async function completeTask(taskId, userId) {
  const { error } = await supabase
    .from("tasks")
    .update({ completed: true, completed_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("user_id", userId);
  
  if (!error) clearCache(userId);
  return !error;
}

async function snoozeTask(taskId, userId, days = 1) {
  const { data: task } = await supabase
    .from("tasks")
    .select("due_date")
    .eq("id", taskId)
    .eq("user_id", userId)
    .single();
  
  if (!task) return false;
  
  const newDate = new Date(task.due_date);
  newDate.setDate(newDate.getDate() + days);
  const newDueDate = newDate.toISOString().split("T")[0];
  
  const { error } = await supabase
    .from("tasks")
    .update({ due_date: newDueDate })
    .eq("id", taskId)
    .eq("user_id", userId);
  
  if (!error) clearCache(userId);
  return !error;
}

async function deleteTask(taskId, userId) {
  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("user_id", userId);
  
  if (!error) clearCache(userId);
  return !error;
}

// Study sessions
async function addStudySession(userId, subject, duration) {
  const today = new Date().toISOString().split("T")[0];
  const { error } = await supabase.from("study_sessions").insert({
    user_id: userId, subject, duration, date: today
  });
  
  if (!error) clearCache(userId);
  return !error;
}

async function getStudyStats(userId) {
  const cached = getCached(`study_${userId}`);
  if (cached) return cached;
  
  const { data } = await supabase
    .from("study_sessions")
    .select("duration, date")
    .eq("user_id", userId);
  
  if (!data || data.length === 0) {
    return { total: 0, weekly: 0, today: 0, avg: 0 };
  }
  
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const total = data.reduce((sum, s) => sum + s.duration, 0);
  const weekly = data.filter(s => new Date(s.date) >= weekAgo).reduce((sum, s) => sum + s.duration, 0);
  const todayTotal = data.filter(s => s.date === today).reduce((sum, s) => sum + s.duration, 0);
  const avg = Math.round(weekly / 7);
  
  const result = { total, weekly, today: todayTotal, avg };
  setCached(`study_${userId}`, result);
  return result;
}

// Attendance
async function markAttendance(userId, className) {
  const today = new Date().toISOString().split("T")[0];
  const { error } = await supabase.from("attendance").upsert({
    user_id: userId, class_name: className, date: today, attended: true
  }, { onConflict: "user_id,class_name,date" });
  
  if (!error) clearCache(userId);
  return !error;
}

async function getAttendanceStats(userId) {
  const cached = getCached(`attendance_${userId}`);
  if (cached) return cached;
  
  const { data } = await supabase
    .from("attendance")
    .select("attended")
    .eq("user_id", userId);
  
  if (!data || data.length === 0) {
    return { attended: 0, total: 0, rate: 0 };
  }
  
  const attended = data.filter(a => a.attended).length;
  const total = data.length;
  const rate = total > 0 ? Math.round((attended / total) * 100) : 0;
  const result = { attended, total, rate };
  setCached(`attendance_${userId}`, result);
  return result;
}

// Helper functions
async function getTodayClasses(userId) {
  const now = new Date();
  let today = now.getDay();
  if (today === 0) today = 6;
  else today = today - 1;
  
  const allClasses = await getClasses(userId);
  return allClasses.filter(c => c.day === today);
}

async function getNextClass(userId) {
  const now = new Date();
  let today = now.getDay();
  if (today === 0) today = 6;
  else today = today - 1;
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  const allClasses = await getClasses(userId);
  
  // Find next class today
  for (const cls of allClasses) {
    if (cls.day === today && cls.start_time > currentTime) {
      return cls;
    }
  }
  
  // Find first class tomorrow
  let tomorrow = today + 1;
  if (tomorrow > 6) tomorrow = 0;
  for (const cls of allClasses) {
    if (cls.day === tomorrow) return cls;
  }
  
  return null;
}

function calculateDuration(startTime, endTime) {
  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);
  const duration = (endHour * 60 + endMin) - (startHour * 60 + startMin);
  return duration;
}

// ==================== ICS IMPORT ====================
async function importICS(userId, url, lang) {
  console.log(`[ICS] Importing from: ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    
    if (!response.ok) return { success: false, error: `HTTP ${response.status}` };
    
    let content = await response.text();
    
    // Handle HTML responses
    if (content.includes('<!DOCTYPE html>') || content.includes('<html')) {
      const linkMatch = content.match(/https?:\/\/[^\s"']+\.ics/i);
      if (linkMatch) return importICS(userId, linkMatch[0], lang);
      return { success: false, error: "URL returned HTML, not ICS file" };
    }
    
    if (!content.includes('BEGIN:VCALENDAR')) {
      return { success: false, error: "Not a valid ICS file" };
    }
    
    // Parse ICS manually
    const events = [];
    const lines = content.split(/\r?\n/);
    let currentEvent = null;
    let inEvent = false;
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      
      if (line === 'BEGIN:VEVENT') {
        currentEvent = {};
        inEvent = true;
      } else if (line === 'END:VEVENT' && currentEvent) {
        if (currentEvent.SUMMARY && currentEvent.DTSTART) events.push({ ...currentEvent });
        currentEvent = null;
        inEvent = false;
      } else if (inEvent && currentEvent) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          let key = line.substring(0, colonIndex);
          let value = line.substring(colonIndex + 1);
          const semiIndex = key.indexOf(';');
          if (semiIndex > 0) key = key.substring(0, semiIndex);
          currentEvent[key] = value;
        }
      }
    }
    
    console.log(`[ICS] Found ${events.length} events`);
    if (events.length === 0) return { success: false, error: "No events found" };
    
    let imported = 0;
    let duplicates = 0;
    const existingClasses = await getClasses(userId);
    
    for (const event of events) {
      try {
        let startValue = event.DTSTART;
        let match = startValue.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
        if (!match) match = startValue.match(/(\d{4})(\d{2})(\d{2})/);
        
        if (match) {
          const year = parseInt(match[1]);
          const month = parseInt(match[2]) - 1;
          const day = parseInt(match[3]);
          const hour = match[4] ? parseInt(match[4]) : 9;
          const minute = match[5] ? parseInt(match[5]) : 0;
          
          const startDate = new Date(year, month, day, hour, minute);
          let dayOfWeek = startDate.getDay();
          if (dayOfWeek === 0) dayOfWeek = 6;
          else dayOfWeek = dayOfWeek - 1;
          
          const startTimeStr = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
          
          let endHour = hour + 1;
          let endMinute = minute;
          if (event.DTEND) {
            const endMatch = event.DTEND.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
            if (endMatch) {
              endHour = parseInt(endMatch[4]);
              endMinute = parseInt(endMatch[5]);
            }
          }
          const endTimeStr = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
          
          let subject = (event.SUMMARY || 'Class').replace(/<[^>]*>/g, '').trim();
          let location = (event.LOCATION || '').replace(/<[^>]*>/g, '').trim();
          
          // Check for duplicate
          const isDuplicate = existingClasses.some(c => 
            c.subject === subject && c.day === dayOfWeek && c.start_time === startTimeStr
          );
          
          if (!isDuplicate) {
            const added = await addClass(userId, subject, dayOfWeek, startTimeStr, endTimeStr, location);
            if (added) imported++;
          } else {
            duplicates++;
          }
        }
      } catch (err) {
        console.error("Error importing event:", err);
      }
    }
    
    return { success: imported > 0, count: imported, total: events.length, new: imported, duplicates };
  } catch (error) {
    console.error("ICS import error:", error);
    return { success: false, error: error.message };
  }
}

// ==================== STUDY TIMER ====================
async function startStudyTimer(userId, subject, duration, sendMessageFunc) {
  // Clear any existing timer
  if (activeTimers.has(userId)) {
    clearTimeout(activeTimers.get(userId));
    activeTimers.delete(userId);
  }
  
  const timer = setTimeout(async () => {
    const lang = await getUserLanguage(userId);
    const msg = getTranslation(lang, "study_timer_end", { subject, duration });
    await sendMessageFunc(userId, msg);
    await addStudySession(userId, subject, duration);
    activeTimers.delete(userId);
  }, duration * 60 * 1000);
  
  activeTimers.set(userId, timer);
  return true;
}

// ==================== VK MESSAGING ====================
async function sendMessage(userId, text, keyboard = null) {
  try {
    const params = new URLSearchParams();
    params.append("access_token", VK_TOKEN);
    params.append("v", VK_API_VERSION);
    params.append("user_id", userId);
    params.append("message", text.slice(0, 4096));
    params.append("random_id", Math.floor(Math.random() * 1000000));
    if (keyboard) params.append("keyboard", keyboard);
    
    const response = await fetch("https://api.vk.com/method/messages.send", {
      method: "POST",
      body: params
    });
    
    const data = await response.json();
    if (data.error) console.error("VK API Error:", data.error);
    return data;
  } catch (error) {
    console.error("Send message error:", error);
    return null;
  }
}

function getMainKeyboard(lang) {
  const scheduleText = lang === 'ru' ? "📅 Расписание" : lang === 'zh' ? "📅 课程表" : "📅 Schedule";
  const tasksText = lang === 'ru' ? "📝 Задачи" : lang === 'zh' ? "📝 任务" : "📝 Tasks";
  const statsText = lang === 'ru' ? "📊 Статистика" : lang === 'zh' ? "📊 统计" : "📊 Stats";
  const timerText = lang === 'ru' ? "⏱️ Таймер" : lang === 'zh' ? "⏱️ 计时器" : "⏱️ Timer";
  const helpText = lang === 'ru' ? "❓ Помощь" : lang === 'zh' ? "❓ 帮助" : "❓ Help";
  
  return JSON.stringify({
    one_time: false,
    buttons: [
      [{ action: { type: "text", label: scheduleText }, color: "primary" }],
      [{ action: { type: "text", label: tasksText }, color: "positive" }],
      [{ action: { type: "text", label: statsText }, color: "secondary" }],
      [{ action: { type: "text", label: timerText }, color: "secondary" }],
      [{ action: { type: "text", label: helpText }, color: "secondary" }]
    ]
  });
}

// ==================== MESSAGE HANDLER ====================
async function processMessage(userId, messageText, lang) {
  const text = messageText.trim();
  const lowerText = text.toLowerCase();
  const userName = await getUserName(userId);
  const t = (key, params = {}) => getTranslation(lang, key, params);
  
  // Language commands
  if (lowerText === "/lang en") {
    await setUserLanguage(userId, "en");
    await sendMessage(userId, t("lang_changed"), getMainKeyboard("en"));
    return;
  }
  if (lowerText === "/lang ru") {
    await setUserLanguage(userId, "ru");
    await sendMessage(userId, t("lang_changed"), getMainKeyboard("ru"));
    return;
  }
  if (lowerText === "/lang zh") {
    await setUserLanguage(userId, "zh");
    await sendMessage(userId, t("lang_changed"), getMainKeyboard("zh"));
    return;
  }
  
  // Help
  if (text === "❓ Help" || text === "❓ Помощь" || text === "❓ 帮助" || lowerText === "/help" || lowerText === "help") {
    await sendMessage(userId, t("help_text"), getMainKeyboard(lang));
    return;
  }
  
  // Study Timer Help
  if (lowerText === "/timer" || (text === "⏱️ Timer" && lang === 'en') || (text === "⏱️ Таймер" && lang === 'ru') || (text === "⏱️ 计时器" && lang === 'zh')) {
    await sendMessage(userId, t("timer_help"), getMainKeyboard(lang));
    return;
  }
  
  // Study Timer Start
  if (lowerText.startsWith("/study")) {
    const parts = text.split(" ");
    if (parts.length >= 3) {
      const subject = parts[1];
      const duration = parseInt(parts[2]);
      
      if (!isNaN(duration) && duration >= 5 && duration <= 180) {
        await startStudyTimer(userId, subject, duration, sendMessage);
        await sendMessage(userId, t("study_timer_start", { subject, duration }), getMainKeyboard(lang));
      } else {
        await sendMessage(userId, "❌ Please enter a valid duration (5-180 minutes)", getMainKeyboard(lang));
      }
    } else {
      await sendMessage(userId, t("timer_help"), getMainKeyboard(lang));
    }
    return;
  }
  
  // Stop Timer
  if (lowerText === "/stop") {
    if (activeTimers.has(userId)) {
      clearTimeout(activeTimers.get(userId));
      activeTimers.delete(userId);
      await sendMessage(userId, t("study_timer_cancel"), getMainKeyboard(lang));
    } else {
      await sendMessage(userId, t("study_timer_cancel"), getMainKeyboard(lang));
    }
    return;
  }
  
  // Reminder Settings
  if (lowerText.startsWith("/remind")) {
    const parts = text.split(" ");
    if (parts.length >= 2) {
      const minutes = parseInt(parts[1]);
      if (!isNaN(minutes) && minutes >= 5 && minutes <= 120) {
        await setUserReminderOffset(userId, minutes);
        await sendMessage(userId, t("reminder_set", { minutes }), getMainKeyboard(lang));
      } else {
        await sendMessage(userId, t("reminder_help"), getMainKeyboard(lang));
      }
    } else {
      const current = await getUserReminderOffset(userId);
      await sendMessage(userId, t("reminder_current", { minutes: current }), getMainKeyboard(lang));
    }
    return;
  }
  
  // Time Summary
  if (lowerText === "time" || lowerText === "/time") {
    const todayClasses = await getTodayClasses(userId);
    const pendingTasks = await getTasks(userId, true);
    const nextClass = await getNextClass(userId);
    
    let totalMinutes = 0;
    for (const cls of todayClasses) {
      totalMinutes += calculateDuration(cls.start_time, cls.end_time);
    }
    const classHours = Math.floor(totalMinutes / 60);
    const classMinutes = totalMinutes % 60;
    
    let timeUntil = "No more classes today";
    if (nextClass) {
      const now = new Date();
      const [hour, minute] = nextClass.start_time.split(":").map(Number);
      const classTime = new Date(now);
      classTime.setHours(hour, minute, 0, 0);
      const diff = Math.max(0, Math.round((classTime - now) / 60000));
      timeUntil = `${diff} minutes`;
    }
    
    await sendMessage(userId, t("time_summary", {
      classes_today: todayClasses.length,
      class_hours: classHours,
      class_minutes: classMinutes,
      pending_tasks: pendingTasks.length,
      deadlines: pendingTasks.length,
      time_until: timeUntil
    }), getMainKeyboard(lang));
    return;
  }
  
  // Schedule view
  if (text === "📅 Schedule" || text === "📅 Расписание" || text === "📅 课程表" || lowerText === "schedule") {
    const classes = await getClasses(userId);
    
    if (classes.length === 0) {
      await sendMessage(userId, t("schedule_empty"), getMainKeyboard(lang));
      return;
    }
    
    let msg = t("schedule_header");
    const days = TRANSLATIONS[lang].days_short;
    
    for (const cls of classes) {
      const duration = calculateDuration(cls.start_time, cls.end_time);
      msg += t("schedule_item", {
        id: cls.id,
        day: days[cls.day],
        start: cls.start_time,
        end: cls.end_time,
        subject: cls.subject,
        location: cls.location || "—",
        duration: duration
      });
    }
    
    await sendMessage(userId, msg, getMainKeyboard(lang));
    return;
  }
  
  // Today's classes
  if (lowerText === "today" || lowerText === "сегодня" || text === "📋 Today") {
    const allClasses = await getClasses(userId);
    const now = new Date();
    let today = now.getDay();
    if (today === 0) today = 6;
    else today = today - 1;
    
    const todayClasses = allClasses.filter(c => c.day === today);
    
    if (todayClasses.length === 0) {
      await sendMessage(userId, t("no_classes"), getMainKeyboard(lang));
      return;
    }
    
    let msg = t("today_header");
    for (const cls of todayClasses) {
      msg += `⏰ ${cls.start_time}-${cls.end_time} • **${cls.subject}**\n`;
      if (cls.location) msg += `   📍 ${cls.location}\n`;
      msg += "\n";
    }
    
    await sendMessage(userId, msg, getMainKeyboard(lang));
    return;
  }
  
  // Tomorrow's classes
  if (lowerText === "tomorrow" || lowerText === "завтра" || lowerText === "明天") {
    const allClasses = await getClasses(userId);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    let tomorrowDay = tomorrow.getDay();
    if (tomorrowDay === 0) tomorrowDay = 6;
    else tomorrowDay = tomorrowDay - 1;
    
    const tomorrowClasses = allClasses.filter(c => c.day === tomorrowDay);
    
    if (tomorrowClasses.length === 0) {
      await sendMessage(userId, t("no_classes_tomorrow"), getMainKeyboard(lang));
      return;
    }
    
    let msg = t("tomorrow_header");
    for (const cls of tomorrowClasses) {
      msg += `⏰ ${cls.start_time}-${cls.end_time} • **${cls.subject}**\n`;
      if (cls.location) msg += `   📍 ${cls.location}\n`;
      msg += "\n";
    }
    
    await sendMessage(userId, msg, getMainKeyboard(lang));
    return;
  }
  
  // Week schedule
  if (lowerText === "week" || lowerText === "неделя" || lowerText === "周") {
    const allClasses = await getClasses(userId);
    
    if (allClasses.length === 0) {
      await sendMessage(userId, t("schedule_empty"), getMainKeyboard(lang));
      return;
    }
    
    let msg = t("week_header");
    const days = TRANSLATIONS[lang].days;
    
    for (let d = 0; d < 7; d++) {
      const dayClasses = allClasses.filter(c => c.day === d);
      if (dayClasses.length > 0) {
        msg += `\n*${days[d]}*\n`;
        for (const cls of dayClasses) {
          msg += `   ⏰ ${cls.start_time}-${cls.end_time} • ${cls.subject}\n`;
        }
      }
    }
    
    await sendMessage(userId, msg, getMainKeyboard(lang));
    return;
  }
  
  // Next class
  if (lowerText === "next" || lowerText === "следующая" || lowerText === "下节课") {
    const nextClass = await getNextClass(userId);
    
    if (nextClass) {
      const now = new Date();
      const [hour, minute] = nextClass.start_time.split(":").map(Number);
      const classTime = new Date(now);
      classTime.setHours(hour, minute, 0, 0);
      const minutes = Math.max(0, Math.round((classTime - now) / 60000));
      const days = TRANSLATIONS[lang].days;
      
      await sendMessage(userId, t("next_class", {
        subject: nextClass.subject,
        day: days[nextClass.day],
        time: nextClass.start_time,
        minutes: minutes,
        location: nextClass.location || "—"
      }), getMainKeyboard(lang));
    } else {
      await sendMessage(userId, t("no_next_class"), getMainKeyboard(lang));
    }
    return;
  }
  
  // Tasks view
  if (text === "📝 Tasks" || text === "📝 Задачи" || text === "📝 任务" || lowerText === "tasks") {
    const tasks = await getTasks(userId, true);
    
    if (tasks.length === 0) {
      await sendMessage(userId, t("tasks_empty"), getMainKeyboard(lang));
      return;
    }
    
    let msg = t("tasks_header");
    for (const task of tasks) {
      const priorityText = task.priority === "high" ? t("priority_high") : task.priority === "medium" ? t("priority_medium") : t("priority_low");
      msg += t("task_item", {
        id: task.id,
        due_date: task.due_date,
        title: task.title,
        remind_days: task.remind_days || 2,
        priority: priorityText
      });
    }
    
    await sendMessage(userId, msg, getMainKeyboard(lang));
    return;
  }
  
  // Statistics
  if (text === "📊 Stats" || text === "📊 Статистика" || text === "📊 统计" || lowerText === "stats") {
    const classes = await getClasses(userId);
    const todayClasses = await getTodayClasses(userId);
    const pendingTasks = await getTasks(userId, true);
    const allTasks = await getTasks(userId, false);
    const studyStats = await getStudyStats(userId);
    const attendance = await getAttendanceStats(userId);
    
    const completedTasks = allTasks.filter(t => t.completed === true).length;
    const completionRate = allTasks.length > 0 ? Math.round((completedTasks / allTasks.length) * 100) : 0;
    const highPriorityCompleted = allTasks.filter(t => t.completed && t.priority === "high").length;
    
    let totalMinutes = 0;
    for (const cls of classes) {
      totalMinutes += calculateDuration(cls.start_time, cls.end_time);
    }
    const totalHours = Math.floor(totalMinutes / 60);
    const totalMinutesRemainder = totalMinutes % 60;
    
    const weekClasses = classes.filter(c => {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() + 1);
      return true;
    }).length;
    
    const productivityScore = Math.min(100, Math.round(
      (completionRate * 0.4) + 
      (studyStats.avg / 60 * 20) + 
      (attendance.rate * 0.2) + 
      ((pendingTasks.length === 0 ? 100 : Math.max(0, 100 - pendingTasks.length * 10)) * 0.2)
    ));
    
    const bar = createProgressBar(productivityScore);
    const motivationMsg = MOTIVATION[lang][Math.floor(Math.random() * MOTIVATION[lang].length)];
    
    let msg = t("stats_header");
    msg += t("stats_classes", {
      total: classes.length,
      today: todayClasses.length,
      week: weekClasses,
      hours: totalHours,
      minutes: totalMinutesRemainder
    });
    msg += t("stats_tasks", {
      completed: completedTasks,
      pending: pendingTasks.length,
      high_priority: highPriorityCompleted,
      rate: completionRate,
      on_time: Math.min(100, Math.round(completionRate * 0.9))
    });
    msg += t("stats_study", {
      today_study: studyStats.today,
      week_study: studyStats.weekly,
      total_study: studyStats.total,
      avg_study: studyStats.avg
    });
    msg += t("stats_productivity", {
      score: productivityScore,
      bar: bar,
      message: motivationMsg
    });
    if (attendance.total > 0) {
      const attendBar = createProgressBar(attendance.rate);
      msg += t("stats_attendance", {
        attended: attendance.attended,
        total_classes: attendance.total,
        rate: attendance.rate,
        bar: attendBar
      });
    }
    msg += t("stats_motivation", { message: motivationMsg });
    
    await sendMessage(userId, msg, getMainKeyboard(lang));
    return;
  }
  
  // Add class
  if (lowerText.startsWith("/add")) {
    const parts = text.split(" ");
    if (parts.length >= 5) {
      const subject = parts[1];
      const day = parseInt(parts[2]);
      const startTime = parts[3];
      const endTime = parts[4];
      const location = parts.slice(5).join(" ");
      
      if (isNaN(day) || day < 0 || day > 6) {
        await sendMessage(userId, t("wrong_format"), getMainKeyboard(lang));
        return;
      }
      
      const success = await addClass(userId, subject, day, startTime, endTime, location);
      const days = TRANSLATIONS[lang].days;
      const duration = calculateDuration(startTime, endTime);
      
      if (success) {
        await sendMessage(userId, t("class_added", {
          subject, day: days[day], start: startTime, end: endTime, 
          duration: duration, location: location || "—"
        }), getMainKeyboard(lang));
      } else {
        await sendMessage(userId, "❌ Error adding class", getMainKeyboard(lang));
      }
    } else {
      await sendMessage(userId, t("wrong_format"), getMainKeyboard(lang));
    }
    return;
  }
  
  // Update class
  if (lowerText.startsWith("/update")) {
    const parts = text.split(" ");
    if (parts.length >= 4) {
      const classId = parseInt(parts[1]);
      const field = parts[2];
      const newValue = parts.slice(3).join(" ");
      
      if (!isNaN(classId)) {
        const classes = await getClasses(userId);
        const classToUpdate = classes.find(c => c.id === classId);
        
        if (classToUpdate) {
          const oldValue = classToUpdate[field];
          const success = await updateClass(classId, userId, field, newValue);
          
          if (success) {
            await sendMessage(userId, t("class_updated", { id: classId, field, old: oldValue, new: newValue }), getMainKeyboard(lang));
          } else {
            await sendMessage(userId, "❌ Error updating class", getMainKeyboard(lang));
          }
        } else {
          await sendMessage(userId, t("class_not_found"), getMainKeyboard(lang));
        }
      } else {
        await sendMessage(userId, t("update_format"), getMainKeyboard(lang));
      }
    } else {
      await sendMessage(userId, t("update_format"), getMainKeyboard(lang));
    }
    return;
  }
  
  // Delete class
  if (lowerText.startsWith("/delete") && !lowerText.includes("_task")) {
    const parts = text.split(" ");
    if (parts.length >= 2) {
      const classId = parseInt(parts[1]);
      if (!isNaN(classId)) {
        const success = await deleteClass(classId, userId);
        if (success) {
          await sendMessage(userId, t("class_deleted", { id: classId }), getMainKeyboard(lang));
        } else {
          await sendMessage(userId, t("class_not_found"), getMainKeyboard(lang));
        }
      } else {
        await sendMessage(userId, t("wrong_format"), getMainKeyboard(lang));
      }
    } else {
      await sendMessage(userId, t("wrong_format"), getMainKeyboard(lang));
    }
    return;
  }
  
  // Add task
  if (lowerText.startsWith("/task")) {
    const match = text.match(/\/task\s+"([^"]+)"\s+(\d{4}-\d{2}-\d{2})(?:\s+(high|medium|low))?/);
    
    if (match) {
      const title = match[1];
      const dueDate = match[2];
      const priority = match[3] || "normal";
      const remindDays = 2;
      
      const success = await addTask(userId, title, dueDate, remindDays, priority);
      const priorityText = priority === "high" ? t("priority_high") : priority === "medium" ? t("priority_medium") : t("priority_low");
      
      if (success) {
        await sendMessage(userId, t("task_added", { title, due_date: dueDate, remind_days: remindDays, priority: priorityText }), getMainKeyboard(lang));
      } else {
        await sendMessage(userId, "❌ Error adding task", getMainKeyboard(lang));
      }
    } else {
      await sendMessage(userId, t("wrong_format"), getMainKeyboard(lang));
    }
    return;
  }
  
  // Complete task
  if (lowerText.startsWith("/complete")) {
    const parts = text.split(" ");
    if (parts.length >= 2) {
      const taskId = parseInt(parts[1]);
      if (!isNaN(taskId)) {
        const success = await completeTask(taskId, userId);
        if (success) {
          await sendMessage(userId, t("task_completed", { id: taskId }), getMainKeyboard(lang));
        } else {
          await sendMessage(userId, t("task_not_found"), getMainKeyboard(lang));
        }
      } else {
        await sendMessage(userId, t("wrong_format"), getMainKeyboard(lang));
      }
    } else {
      await sendMessage(userId, t("wrong_format"), getMainKeyboard(lang));
    }
    return;
  }
  
  // Snooze task
  if (lowerText.startsWith("/snooze")) {
    const parts = text.split(" ");
    if (parts.length >= 2) {
      const taskId = parseInt(parts[1]);
      const days = parts.length >= 3 ? parseInt(parts[2]) : 1;
      
      if (!isNaN(taskId) && !isNaN(days)) {
        const tasks = await getTasks(userId, true);
        const task = tasks.find(t => t.id === taskId);
        
        if (task) {
          const newDate = new Date(task.due_date);
          newDate.setDate(newDate.getDate() + days);
          const newDateStr = newDate.toISOString().split("T")[0];
          
          const success = await snoozeTask(taskId, userId, days);
          if (success) {
            await sendMessage(userId, t("task_snoozed", { id: taskId, days, new_date: newDateStr }), getMainKeyboard(lang));
          } else {
            await sendMessage(userId, "❌ Error snoozing task", getMainKeyboard(lang));
          }
        } else {
          await sendMessage(userId, t("task_not_found"), getMainKeyboard(lang));
        }
      } else {
        await sendMessage(userId, t("wrong_format"), getMainKeyboard(lang));
      }
    } else {
      await sendMessage(userId, t("wrong_format"), getMainKeyboard(lang));
    }
    return;
  }
  
  // Delete task
  if (lowerText.startsWith("/delete_task")) {
    const parts = text.split(" ");
    if (parts.length >= 2) {
      const taskId = parseInt(parts[1]);
      if (!isNaN(taskId)) {
        const success = await deleteTask(taskId, userId);
        if (success) {
          await sendMessage(userId, t("task_deleted", { id: taskId }), getMainKeyboard(lang));
        } else {
          await sendMessage(userId, t("task_not_found"), getMainKeyboard(lang));
        }
      } else {
        await sendMessage(userId, t("wrong_format"), getMainKeyboard(lang));
      }
    } else {
      await sendMessage(userId, t("wrong_format"), getMainKeyboard(lang));
    }
    return;
  }
  
  // Attendance
  if (lowerText === "attendance" || lowerText === "посещаемость" || lowerText === "出勤") {
    const stats = await getAttendanceStats(userId);
    const bar = createProgressBar(stats.rate);
    await sendMessage(userId, t("attendance_stats", { attended: stats.attended, total: stats.total, rate: stats.rate, bar }), getMainKeyboard(lang));
    return;
  }
  
  if (lowerText === "mark" || lowerText === "отметить" || lowerText === "标记") {
    const todayClasses = await getTodayClasses(userId);
    
    if (todayClasses.length === 0) {
      await sendMessage(userId, t("no_classes"), getMainKeyboard(lang));
      return;
    }
    
    let classList = "";
    for (let i = 0; i < todayClasses.length; i++) {
      classList += `${i + 1}. ${todayClasses[i].subject} (${todayClasses[i].start_time}-${todayClasses[i].end_time})\n`;
    }
    
    await sendMessage(userId, t("attendance_prompt", { classes: classList }), getMainKeyboard(lang));
    return;
  }
  
  // Handle attendance by number
  if (/^\d+$/.test(text) && parseInt(text) <= 10) {
    const todayClasses = await getTodayClasses(userId);
    const idx = parseInt(text) - 1;
    if (idx >= 0 && idx < todayClasses.length) {
      const success = await markAttendance(userId, todayClasses[idx].subject);
      if (success) {
        await sendMessage(userId, t("attendance_marked", { class_name: todayClasses[idx].subject }), getMainKeyboard(lang));
      } else {
        await sendMessage(userId, t("attendance_error"), getMainKeyboard(lang));
      }
      return;
    }
  }
  
  // ICS Import
  if (lowerText.startsWith("/ics")) {
    const parts = text.split(" ");
    if (parts.length >= 2) {
      const icsUrl = parts[1];
      await sendMessage(userId, t("import_start"), getMainKeyboard(lang));
      const result = await importICS(userId, icsUrl, lang);
      
      if (result.success && result.count > 0) {
        await sendMessage(userId, t("import_success", { count: result.count, total: result.total, new: result.new, duplicates: result.duplicates }), getMainKeyboard(lang));
      } else {
        await sendMessage(userId, t("import_fail", { error: result.error || "Unknown error" }), getMainKeyboard(lang));
      }
    } else {
      await sendMessage(userId, t("import_instructions"), getMainKeyboard(lang));
    }
    return;
  }
  
  // Joke
  if (lowerText.includes("joke") || lowerText.includes("шутка") || lowerText.includes("笑话")) {
    const jokes = JOKES[lang] || JOKES.en;
    const joke = jokes[Math.floor(Math.random() * jokes.length)];
    await sendMessage(userId, t("joke", { joke }), getMainKeyboard(lang));
    return;
  }
  
  // Time
  if (lowerText.includes("time") || lowerText.includes("время") || lowerText.includes("时间")) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString(lang === 'ru' ? 'ru-RU' : lang === 'zh' ? 'zh-CN' : 'en-US');
    await sendMessage(userId, t("time", { time: timeStr }), getMainKeyboard(lang));
    return;
  }
  
  // Default response
  await sendMessage(userId, t("greeting", { name: userName }), getMainKeyboard(lang));
}

// ==================== REMINDER CHECKER ====================
async function checkReminders() {
  try {
    const now = new Date();
    let currentDay = now.getDay();
    if (currentDay === 0) currentDay = 6;
    else currentDay = currentDay - 1;
    
    // Get all users with schedules
    const { data: users } = await supabase.from("users").select("vk_id, reminder_offset, language");
    if (!users) return;
    
    for (const user of users) {
      const userId = user.vk_id;
      const offset = user.reminder_offset || 30;
      const lang = user.language || "en";
      
      const { data: classes } = await supabase
        .from("schedule")
        .select("id, subject, start_time")
        .eq("user_id", userId)
        .eq("day", currentDay);
      
      if (!classes) continue;
      
      for (const cls of classes) {
        const [hour, minute] = cls.start_time.split(":").map(Number);
        const classTime = new Date(now);
        classTime.setHours(hour, minute, 0, 0);
        const minutesUntil = (classTime - now) / 60000;
        
        if (minutesUntil > 0 && minutesUntil <= offset) {
          const reminderKey = `reminder_${userId}_${now.toDateString()}_${cls.id}`;
          const { data: existing } = await supabase
            .from("reminders")
            .select("key")
            .eq("key", reminderKey)
            .single();
          
          if (!existing) {
            const reminderMsg = getTranslation(lang, "next_class", {
              subject: cls.subject,
              day: TRANSLATIONS[lang].days[currentDay],
              time: cls.start_time,
              minutes: Math.round(minutesUntil),
              location: ""
            });
            
            await sendMessage(userId, "⏰ **REMINDER**\n\n" + reminderMsg);
            await supabase.from("reminders").insert({ key: reminderKey });
          }
        }
      }
    }
  } catch (error) {
    console.error("Reminder error:", error);
  }
}

// ==================== DEADLINE CHECKER ====================
async function checkDeadlines() {
  try {
    const today = new Date().toISOString().split("T")[0];
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, user_id, title, due_date, remind_days")
      .eq("completed", false);
    
    if (!tasks) return;
    
    for (const task of tasks) {
      const dueDate = new Date(task.due_date);
      const todayDate = new Date();
      const daysLeft = Math.ceil((dueDate - todayDate) / (1000 * 60 * 60 * 24));
      
      if (daysLeft <= task.remind_days && daysLeft >= 0) {
        const reminderKey = `deadline_${task.id}_${daysLeft}`;
        const { data: existing } = await supabase
          .from("reminders")
          .select("key")
          .eq("key", reminderKey)
          .single();
        
        if (!existing) {
          const userLang = await getUserLanguage(task.user_id);
          const reminderMsg = getTranslation(userLang, "deadline_reminder", {
            title: task.title,
            due_date: task.due_date,
            days_left: daysLeft
          });
          
          await sendMessage(task.user_id, reminderMsg);
          await supabase.from("reminders").insert({ key: reminderKey });
        }
      }
    }
  } catch (error) {
    console.error("Deadline error:", error);
  }
}

// ==================== WEBHOOK HANDLER ====================
export async function handler(event) {
  try {
    const body = JSON.parse(event.body);
    console.log(`[Webhook] Type: ${body.type}`);
    
    // VK Confirmation
    if (body.type === "confirmation") {
      return { statusCode: 200, body: process.env.VK_CONFIRMATION_TOKEN || "confirmation_token" };
    }
    
    // Message Event
    if (body.type === "message_new") {
      const message = body.object.message;
      const userId = message.from_id;
      const text = message.text || "";
      const attachments = message.attachments || [];
      
      console.log(`[${userId}] ${text.substring(0, 100)}`);
      
      // Detect language
      const detectedLang = detectLanguage(text);
      
      // Get or create user
      let user = await getOrCreateUser(userId, detectedLang);
      const userLang = user?.language || detectedLang;
      
      // Check for name on first message
      const nameMatch = text.match(/(?:my name is|call me|меня зовут|我叫)\s+([A-Za-zА-Яа-я\u4e00-\u9fff]+)/i);
      
      if ((!user?.name || user.name === "Student") && !nameMatch && !text.startsWith("/") && !text.includes("📅") && !text.includes("📝") && !text.includes("⏱️")) {
        const askName = getTranslation(userLang, "ask_name");
        await sendMessage(userId, askName);
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }
      
      if (nameMatch && (!user?.name || user.name === "Student")) {
        const newName = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1);
        await setUserName(userId, newName);
        const greetingMsg = getTranslation(userLang, "got_name", { name: newName });
        await sendMessage(userId, greetingMsg, getMainKeyboard(userLang));
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }
      
      // Check for ICS file attachment
      let icsAttachment = null;
      for (const attachment of attachments) {
        if (attachment.type === "doc") {
          const doc = attachment.doc;
          if (doc.title && doc.title.toLowerCase().includes(".ics")) {
            icsAttachment = doc;
            break;
          }
        }
      }
      
      // Process ICS file attachment
      if (icsAttachment) {
        console.log(`[${userId}] ICS file: ${icsAttachment.title}`);
        const importStartMsg = getTranslation(userLang, "import_start");
        await sendMessage(userId, importStartMsg, getMainKeyboard(userLang));
        
        try {
          const fileResponse = await fetch(icsAttachment.url);
          const fileContent = await fileResponse.text();
          const tempUrl = "data:text/calendar," + encodeURIComponent(fileContent);
          const result = await importICS(userId, tempUrl, userLang);
          
          if (result.success && result.count > 0) {
            const successMsg = getTranslation(userLang, "import_success", { 
              count: result.count, 
              total: result.total, 
              new: result.new, 
              duplicates: result.duplicates 
            });
            await sendMessage(userId, successMsg, getMainKeyboard(userLang));
          } else {
            const failMsg = getTranslation(userLang, "import_fail", { error: "Invalid file format" });
            await sendMessage(userId, failMsg, getMainKeyboard(userLang));
          }
        } catch (err) {
          console.error("File error:", err);
          const failMsg = getTranslation(userLang, "import_fail", { error: err.message });
          await sendMessage(userId, failMsg, getMainKeyboard(userLang));
        }
        
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }
      
      // Process regular message
      await processMessage(userId, text, userLang);
      
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }
    
    // Run reminder checks periodically (simplified - in production use cron)
    if (body.type === "check_reminders") {
      await checkReminders();
      await checkDeadlines();
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }
    
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    
  } catch (error) {
    console.error("Handler error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
}