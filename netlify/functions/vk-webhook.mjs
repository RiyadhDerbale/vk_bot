/*import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const VK_TOKEN = process.env.VK_TOKEN;
const VK_API_VERSION = "5.131";

// ========== CACHING ==========
const cache = new Map();
const CACHE_TTL = 5000; // 5 seconds

function getCached(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

function setCached(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

// ========== VK API HELPERS ==========
async function callVkApi(method, params, controller = null) {
  try {
    const url = new URL("https://api.vk.com/method/" + method);
    url.searchParams.append("access_token", VK_TOKEN);
    url.searchParams.append("v", VK_API_VERSION);

    Object.entries(params).forEach(([key, value]) => {
      if (typeof value === "object") {
        url.searchParams.append(key, JSON.stringify(value));
      } else {
        url.searchParams.append(key, value);
      }
    });

    const fetchOptions = {};
    if (controller) {
      fetchOptions.signal = controller.signal;
    }

    const response = await fetch(url.toString(), fetchOptions);
    const data = await response.json();

    if (data.error) {
      console.error("VK API Error:", JSON.stringify(data.error));
      return null;
    }
    return data.response;
  } catch (error) {
    console.error("callVkApi error:", error.message);
    return null;
  }
}

async function sendMessage(userId, text, keyboard = null) {
  const params = {
    user_id: userId,
    message: text,
    random_id: Math.floor(Math.random() * 2147483647),
  };

  if (keyboard) {
    params.keyboard = keyboard;
  }

  // Add request timeout of 10 seconds
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await callVkApi("messages.send", params, controller);
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    console.error("sendMessage timeout or error:", error.message);
    return null;
  }
}

// ========== KEYBOARD BUILDERS ==========
function getMainKeyboard() {
  return JSON.stringify({
    one_time: false,
    buttons: [
      [
        { action: { type: "text", label: "📅 Schedule" }, color: "primary" },
        { action: { type: "text", label: "📋 Today" }, color: "positive" },
      ],
      [
        {
          action: { type: "text", label: "⏭️ What's next?" },
          color: "secondary",
        },
        { action: { type: "text", label: "📝 My tasks" }, color: "positive" },
      ],
      [
        { action: { type: "text", label: "� Statistics" }, color: "secondary" },
        { action: { type: "text", label: "⚙️ Settings" }, color: "primary" },
      ],
      [
        { action: { type: "text", label: "➕ Add" }, color: "positive" },
        { action: { type: "text", label: "❓ Help" }, color: "secondary" },
      ],
    ],
  });
}

function getAddKeyboard() {
  return JSON.stringify({
    one_time: false,
    buttons: [
      [
        { action: { type: "text", label: "📅 Add Class" }, color: "positive" },
        {
          action: { type: "text", label: "📝 Add Task" },
          color: "positive",
        },
      ],
      [{ action: { type: "text", label: "🔙 Back" }, color: "secondary" }],
    ],
  });
}

function getDeadlineKeyboard(taskId) {
  return JSON.stringify({
    inline: true,
    buttons: [
      [
        {
          action: {
            type: "callback",
            label: "✅ Done",
            payload: JSON.stringify({ cmd: "mark_done", did: taskId }),
          },
          color: "positive",
        },
        {
          action: {
            type: "callback",
            label: "⏸️ Snooze",
            payload: JSON.stringify({ cmd: "snooze_task", did: taskId }),
          },
          color: "secondary",
        },
      ],
    ],
  });
}

function getAttendanceKeyboard(classId) {
  return JSON.stringify({
    inline: true,
    buttons: [
      [
        {
          action: {
            type: "callback",
            label: "✅ Attended",
            payload: JSON.stringify({ cmd: "mark_attended", cid: classId }),
          },
          color: "positive",
        },
        {
          action: {
            type: "callback",
            label: "❌ Missed",
            payload: JSON.stringify({ cmd: "mark_missed", cid: classId }),
          },
          color: "negative",
        },
      ],
    ],
  });
}

function getSettingsKeyboard(offset) {
  return JSON.stringify({
    one_time: false,
    buttons: [
      [
        {
          action: {
            type: "callback",
            label: "➖",
            payload: JSON.stringify({ cmd: "offset_down" }),
          },
          color: "negative",
        },
        {
          action: { type: "text", label: `${offset} min` },
          color: "primary",
        },
        {
          action: {
            type: "callback",
            label: "➕",
            payload: JSON.stringify({ cmd: "offset_up" }),
          },
          color: "positive",
        },
      ],
      [{ action: { type: "text", label: "🔙 Back" }, color: "secondary" }],
    ],
  });
}

// ========== DATABASE OPERATIONS ==========
async function getUserLanguage(userId) {
  try {
    const { data } = await supabase
      .from("users")
      .select("language")
      .eq("vk_id", userId)
      .single();
    return data?.language || "en";
  } catch (error) {
    console.error("getUserLanguage error:", error.message);
    return "en";
  }
}

async function setUserLanguage(userId, language) {
  try {
    await supabase
      .from("users")
      .upsert({ vk_id: userId, language }, { onConflict: "vk_id" });
  } catch (error) {
    console.error("setUserLanguage error:", error.message);
  }
}

// Fire-and-forget version (doesn't block)
function setUserLanguageAsync(userId, language) {
  try {
    supabase
      .from("users")
      .upsert({ vk_id: userId, language }, { onConflict: "vk_id" });
  } catch (error) {
    console.error("setUserLanguageAsync error:", error.message);
  }
}

async function getUserName(userId) {
  try {
    const cacheKey = `name_${userId}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const { data } = await supabase
      .from("users")
      .select("name")
      .eq("vk_id", userId)
      .single();
    const name = data?.name || "friend";
    setCached(cacheKey, name);
    return name;
  } catch (error) {
    console.error("getUserName error:", error.message);
    return "friend";
  }
}

async function getUserOffset(userId) {
  try {
    const cacheKey = `offset_${userId}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const { data } = await supabase
      .from("users")
      .select("notify_offset")
      .eq("vk_id", userId)
      .single();
    const offset = data?.notify_offset || 60;
    setCached(cacheKey, offset);
    return offset;
  } catch (error) {
    console.error("getUserOffset error:", error.message);
    return 60;
  }
}

async function setUserOffset(userId, minutes) {
  try {
    await supabase
      .from("users")
      .upsert(
        { vk_id: userId, notify_offset: minutes },
        { onConflict: "vk_id" },
      );
    return true;
  } catch (error) {
    console.error("setUserOffset error:", error.message);
    return false;
  }
}

async function getSchedule(userId) {
  try {
    const cacheKey = `schedule_${userId}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const { data } = await supabase
      .from("schedule")
      .select("id, subject, day, start_time, end_time")
      .eq("user_id", userId)
      .order("day", { ascending: true });
    const result = data || [];
    setCached(cacheKey, result);
    return result;
  } catch (error) {
    console.error("getSchedule error:", error.message);
    return [];
  }
}

async function addSchedule(userId, subject, day, startTime, endTime) {
  try {
    const { error } = await supabase.from("schedule").insert({
      user_id: userId,
      subject,
      day,
      start_time: startTime,
      end_time: endTime,
    });
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("addSchedule error:", error.message);
    return false;
  }
}

async function deleteSchedule(userId, subject, day, startTime) {
  try {
    const { error } = await supabase
      .from("schedule")
      .delete()
      .eq("user_id", userId)
      .eq("subject", subject)
      .eq("day", day)
      .eq("start_time", startTime);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("deleteSchedule error:", error.message);
    return false;
  }
}

async function getTasks(userId, onlyPending = true) {
  try {
    const cacheKey = `tasks_${userId}_${onlyPending}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    let query = supabase
      .from("tasks")
      .select("id, task, due_date, remind_days, done")
      .eq("user_id", userId);

    if (onlyPending) {
      query = query.eq("done", false);
    }

    const { data } = await query.order("due_date", { ascending: true });
    const result = data || [];
    setCached(cacheKey, result);
    return result;
  } catch (error) {
    console.error("getTasks error:", error.message);
    return [];
  }
}

async function addTask(userId, task, dueDate, remindDays) {
  try {
    const { error } = await supabase.from("tasks").insert({
      user_id: userId,
      task,
      due_date: dueDate,
      remind_days: remindDays,
      done: false,
    });
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("addTask error:", error.message);
    return false;
  }
}

async function completeTask(taskId, userId) {
  try {
    const { error } = await supabase
      .from("tasks")
      .update({ done: true, completed_at: new Date().toISOString() })
      .eq("id", taskId)
      .eq("user_id", userId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("completeTask error:", error.message);
    return false;
  }
}

async function markAttendance(classId, userId, attended) {
  try {
    const today = new Date().toISOString().split("T")[0];
    const { error } = await supabase.from("attendance").upsert(
      {
        user_id: userId,
        class_id: classId,
        attended,
        date: today,
      },
      { onConflict: "user_id,class_id,date" },
    );
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("markAttendance error:", error.message);
    return false;
  }
}

async function getAttendanceStats(userId) {
  try {
    const cacheKey = `att_stats_${userId}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const { data } = await supabase
      .from("attendance")
      .select("attended")
      .eq("user_id", userId);

    if (!data || data.length === 0) {
      const result = { total: 0, attended: 0, missed: 0, percentage: 0 };
      setCached(cacheKey, result);
      return result;
    }

    const total = data.length;
    const attended = data.filter((a) => a.attended).length;
    const missed = total - attended;
    const percentage = Math.round((attended / total) * 100);

    const result = { total, attended, missed, percentage };
    setCached(cacheKey, result);
    return result;
  } catch (error) {
    console.error("getAttendanceStats error:", error.message);
    return { total: 0, attended: 0, missed: 0, percentage: 0 };
  }
}

async function getTaskStats(userId) {
  try {
    const cacheKey = `task_stats_${userId}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const { data } = await supabase
      .from("tasks")
      .select("done")
      .eq("user_id", userId);

    if (!data || data.length === 0) {
      const result = { total: 0, completed: 0, pending: 0, completion: 0 };
      setCached(cacheKey, result);
      return result;
    }

    const total = data.length;
    const completed = data.filter((t) => t.done).length;
    const pending = total - completed;
    const completion = Math.round((completed / total) * 100);

    const result = { total, completed, pending, completion };
    setCached(cacheKey, result);
    return result;
  } catch (error) {
    console.error("getTaskStats error:", error.message);
    return { total: 0, completed: 0, pending: 0, completion: 0 };
  }
}

async function getUpcomingClasses(userId, hoursAhead = 24) {
  try {
    const now = new Date();
    const future = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
    const today = now.getDate();
    const tomorrow = future.getDate();

    const currentDay = now.getDay() === 0 ? 6 : now.getDay() - 1; // Convert to 0=Mon
    const nextDay = currentDay === 6 ? 0 : currentDay + 1;

    // Run both queries in parallel
    const [todayResponse, tomorrowResponse] = await Promise.all([
      supabase
        .from("schedule")
        .select("*")
        .eq("user_id", userId)
        .eq("day", currentDay)
        .order("start_time", { ascending: true }),
      supabase
        .from("schedule")
        .select("*")
        .eq("user_id", userId)
        .eq("day", nextDay)
        .order("start_time", { ascending: true }),
    ]);

    let todayClasses = todayResponse.data || [];
    let tomorrowClasses = tomorrowResponse.data || [];

    // Filter today's classes - only those not yet passed
    const currentTime = now.getHours() * 100 + now.getMinutes(); // Convert to HHMM format
    const upcomingToday = todayClasses.filter((c) => {
      const classTime =
        parseInt(c.start_time.split(":")[0]) * 100 +
        parseInt(c.start_time.split(":")[1]);
      return classTime >= currentTime;
    });

    return {
      today: upcomingToday,
      tomorrow: tomorrowClasses,
    };
  } catch (error) {
    console.error("getUpcomingClasses error:", error.message);
    return { today: [], tomorrow: [] };
  }
}

async function getNextClass(userId) {
  try {
    const now = new Date();
    const currentDay = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const nextDay = currentDay === 6 ? 0 : currentDay + 1;
    const currentTime = now.getHours() * 100 + now.getMinutes();

    // Run both queries in parallel
    const [todayResponse, tomorrowResponse] = await Promise.all([
      supabase
        .from("schedule")
        .select("*")
        .eq("user_id", userId)
        .eq("day", currentDay)
        .order("start_time", { ascending: true }),
      supabase
        .from("schedule")
        .select("*")
        .eq("user_id", userId)
        .eq("day", nextDay)
        .order("start_time", { ascending: true })
        .limit(1),
    ]);

    const todayClasses = todayResponse.data || [];
    const tomorrowClasses = tomorrowResponse.data || [];

    // Find next class today
    if (todayClasses && todayClasses.length > 0) {
      for (const cls of todayClasses) {
        const classTime =
          parseInt(cls.start_time.split(":")[0]) * 100 +
          parseInt(cls.start_time.split(":")[1]);
        if (classTime >= currentTime) {
          return { class: cls, when: "today" };
        }
      }
    }

    // If no class today, use first class tomorrow
    if (tomorrowClasses && tomorrowClasses.length > 0) {
      return { class: tomorrowClasses[0], when: "tomorrow" };
    }

    return { class: null, when: null };
  } catch (error) {
    console.error("getNextClass error:", error.message);
    return { class: null, when: null };
  }
}

// ========== ICS PARSING & UPLOAD ==========
async function parseIcsAndSave(userId, icsContent, lang) {
  try {
    const lines = icsContent.split("\n");
    const events = [];
    let currentEvent = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line === "BEGIN:VEVENT") {
        currentEvent = {};
      } else if (line === "END:VEVENT" && currentEvent) {
        events.push(currentEvent);
        currentEvent = null;
      } else if (currentEvent) {
        if (line.startsWith("SUMMARY:")) {
          currentEvent.subject = line.substring(8);
        } else if (line.startsWith("DTSTART")) {
          const match = line.match(/DTSTART(?:.*?):(\d{8}T\d{6})?(\d{8})?/);
          if (match && match[1]) {
            currentEvent.startDateTime = match[1];
          } else if (match && match[2]) {
            currentEvent.startDate = match[2];
          }
        } else if (line.startsWith("DTEND")) {
          const match = line.match(/DTEND(?:.*?):(\d{8}T\d{6})?(\d{8})?/);
          if (match && match[1]) {
            currentEvent.endDateTime = match[1];
          } else if (match && match[2]) {
            currentEvent.endDate = match[2];
          }
        }
      }
    }

    // Convert events to schedule entries
    let addedCount = 0;

    for (const event of events) {
      if (!event.subject) continue;

      let startTime = "09:00";
      let endTime = "10:00";
      let dayOfWeek = 0;

      // Parse datetime if available
      if (event.startDateTime) {
        const dateStr = event.startDateTime.substring(0, 8);
        const timeStr = event.startDateTime.substring(9, 15);
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6));
        const day = parseInt(dateStr.substring(6, 8));
        const hour = parseInt(timeStr.substring(0, 2));
        const minute = parseInt(timeStr.substring(2, 4));

        const date = new Date(year, month - 1, day, hour, minute);
        dayOfWeek = date.getDay() === 0 ? 6 : date.getDay() - 1;
        startTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(
          2,
          "0",
        )}`;
      }

      if (event.endDateTime) {
        const timeStr = event.endDateTime.substring(9, 15);
        const hour = parseInt(timeStr.substring(0, 2));
        const minute = parseInt(timeStr.substring(2, 4));
        endTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(
          2,
          "0",
        )}`;
      }

      // Add to database
      const success = await addSchedule(
        userId,
        event.subject,
        dayOfWeek,
        startTime,
        endTime,
      );
      if (success) addedCount++;
    }

    return addedCount;
  } catch (error) {
    console.error("parseIcsAndSave error:", error.message);
    return 0;
  }
}

async function downloadAndParseIcs(userId, url, lang) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Failed to download ICS: ${response.status}`);
    }

    const icsContent = await response.text();
    const addedCount = await parseIcsAndSave(userId, icsContent, lang);

    return { success: true, count: addedCount };
  } catch (error) {
    console.error("downloadAndParseIcs error:", error.message);
    return { success: false, count: 0, error: error.message };
  }
}

// ========== RESPONSE TEMPLATES ==========
const responses = {
  en: {
    greeting:
      "Hello {name}! 👋 I'm your academic assistant. I'll help you stay organized! 📚",
    schedule_empty:
      "📅 Your schedule is empty. Send /add or click ➕ Add Class.",
    schedule_header: "📚 **Your Schedule:**\n",
    schedule_item: "{day} • {start}-{end} — {subject}\n",
    today_empty: "📋 No classes today! Enjoy your free time! 🎉",
    today_header: "📋 **Today's Classes:**\n",
    tomorrow_empty: "📅 No classes tomorrow. Great!",
    tomorrow_header: "📅 **Tomorrow's Classes:**\n",
    next_class: "⏭️ Your next class is {subject} {when} at {time}",
    next_not_found: "✅ No upcoming classes scheduled!",
    add_class_help:
      "📝 Send: /add <subject> <day(0-6)> <HH:MM> <HH:MM>\n\nDays: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun\n\nExample: /add Math 1 10:30 12:05",
    delete_class_help:
      "📝 Send: /delete <subject> <day> <HH:MM>\n\nExample: /delete Math 1 10:30",
    tasks_empty: "📝 All clear! No pending tasks.",
    task_item:
      "📌 **{task}**\n⏰ Due: {due_date}\n🔔 Remind {remind_days} day(s) before",
    task_added: "✅ Task '{task}' saved! I'll remind you.",
    class_added: "✅ Class '{subject}' added to your schedule!",
    class_deleted: "✅ Class '{subject}' removed.",
    task_completed: "✅ Great! Task marked as done!",
    task_snoozed: "⏸️ Snoozed for 1 hour.",
    attended: "✅ Attendance marked!",
    missed: "❌ Marked as missed.",
    statistics_header: "📊 **Your Statistics:**",
    attendance_stats:
      "📅 Attendance: {attended}/{total} classes ({percentage}%)\n❌ Missed: {missed}",
    task_stats:
      "✅ Completed: {completed}/{total} tasks ({completion}%)\n⏳ Pending: {pending}",
    settings_text:
      "⚙️ **Settings:**\n🔔 Reminder offset: {offset} minutes\n💬 Language: {language}",
    help_text: `📖 **Commands & Features:**

📅 **Schedule:**
/add <subject> <day> <start> <end> - Add class
/delete <subject> <day> <start> - Delete class
"What's my schedule today?" - Today's classes
"What's next?" - Next upcoming class

📝 **Tasks:**
/deadline <task> <YYYY-MM-DD HH:MM> <days> - Add task
Click ✅ Done to mark complete

📊 **Info:**
"What are my tasks?" - List pending tasks
"Statistics" - View your progress

⚙️ **Other:**
/upload <link> - Load .ics calendar`,
  },
  ru: {
    greeting:
      "Привет {name}! 👋 Я твой учебный помощник. Помогу тебе организоваться! 📚",
    schedule_empty: "📅 Расписание пусто. Отправь /add или нажми ➕ Add Class.",
    schedule_header: "📚 **Твое расписание:**\n",
    schedule_item: "{day} • {start}-{end} — {subject}\n",
    today_empty: "📋 Сегодня нет пар! Отдыхай! 🎉",
    today_header: "📋 **Пары сегодня:**\n",
    tomorrow_empty: "📅 Завтра выходной.",
    tomorrow_header: "📅 **Пары завтра:**\n",
    next_class: "⏭️ Следующая пара {subject} {when} в {time}",
    next_not_found: "✅ Нет предстоящих пар!",
    add_class_help:
      "📝 Отправь: /add <предмет> <день(0-6)> <ЧЧ:ММ> <ЧЧ:ММ>\n\nДни: 0=Пн, 1=Вт, 2=Ср, 3=Чт, 4=Пт, 5=Сб, 6=Вс\n\nПример: /add Математика 1 10:30 12:05",
    delete_class_help:
      "📝 Отправь: /delete <предмет> <день> <ЧЧ:ММ>\n\nПример: /delete Математика 1 10:30",
    tasks_empty: "📝 Спокойно! Нет задач.",
    task_item:
      "📌 **{task}**\n⏰ Срок: {due_date}\n🔔 Напомню за {remind_days} дн.",
    task_added: "✅ Задача '{task}' сохранена! Напомню.",
    class_added: "✅ Предмет '{subject}' добавлен!",
    class_deleted: "✅ Предмет '{subject}' удален.",
    task_completed: "✅ Отлично! Задача завершена!",
    task_snoozed: "⏸️ Отложу на 1 час.",
    attended: "✅ Посещение отмечено!",
    missed: "❌ Отмечено как пропуск.",
    statistics_header: "📊 **Твоя статистика:**",
    attendance_stats:
      "📅 Посещаемость: {attended}/{total} пар ({percentage}%)\n❌ Пропусков: {missed}",
    task_stats:
      "✅ Выполнено: {completed}/{total} задач ({completion}%)\n⏳ Ожидает: {pending}",
    settings_text:
      "⚙️ **Настройки:**\n🔔 Смещение напоминаний: {offset} минут\n💬 Язык: {language}",
    help_text: `📖 **Команды и возможности:**

📅 **Расписание:**
/add <предмет> <день> <начало> <конец> - Добавить пару
/delete <предмет> <день> <начало> - Удалить пару
"Какое расписание сегодня?" - Пары сегодня
"Что дальше?" - Следующая пара

📝 **Задачи:**
/deadline <задача> <YYYY-MM-DD ЧЧ:ММ> <дни> - Добавить задачу
Нажми ✅ Выполнено для завершения

📊 **Информация:**
"Какие у меня задачи?" - Список задач
"Статистика" - Твой прогресс

⚙️ **Другое:**
/upload <ссылка> - Загрузить .ics календарь`,
  },
};

function getResponse(lang, template, vars = {}) {
  const text = responses[lang]?.[template] || responses.en[template];
  let result = text;

  Object.entries(vars).forEach(([key, value]) => {
    result = result.replace(`{${key}}`, value);
  });

  return result;
}

// ========== MESSAGE HANDLER ==========
async function handleMessage(userId, text, lang) {
  try {
    // Parallelize user data loading - all at once instead of sequentially
    const name = await getUserName(userId);
    const lowText = text.toLowerCase().trim();
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const daysRu = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
    const dayNames = lang === "ru" ? daysRu : days;

    // Schedule button
    if (text === "📅 Schedule") {
      const schedule = await getSchedule(userId);
      if (schedule.length === 0) {
        await sendMessage(
          userId,
          getResponse(lang, "schedule_empty"),
          getMainKeyboard(),
        );
      } else {
        let msg = getResponse(lang, "schedule_header");
        for (const { subject, day, start_time, end_time } of schedule) {
          msg += getResponse(lang, "schedule_item", {
            day: dayNames[day],
            start: start_time,
            end: end_time,
            subject: subject,
          });
        }
        await sendMessage(userId, msg, getMainKeyboard());
      }
      return;
    }

    // Today's schedule button
    if (text === "📋 Today") {
      const upcoming = await getUpcomingClasses(userId, 24);
      const today = upcoming.today || [];

      if (today.length === 0) {
        await sendMessage(
          userId,
          getResponse(lang, "today_empty"),
          getMainKeyboard(),
        );
      } else {
        let msg = getResponse(lang, "today_header");
        for (const { subject, start_time, end_time } of today) {
          msg += `${subject} • ${start_time}-${end_time}\n`;
        }
        await sendMessage(userId, msg, getMainKeyboard());
      }
      return;
    }

    // What's next button
    if (
      text === "⏭️ What's next?" ||
      lowText.includes("what's next") ||
      lowText.includes("что дальше")
    ) {
      const nextClass = await getNextClass(userId);

      if (nextClass) {
        const when =
          nextClass.when === "today"
            ? lang === "ru"
              ? "сегодня"
              : "today"
            : lang === "ru"
              ? "завтра"
              : "tomorrow";

        await sendMessage(
          userId,
          getResponse(lang, "next_class", {
            subject: nextClass.class.subject,
            when,
            time: nextClass.class.start_time,
          }),
          getMainKeyboard(),
        );
      } else {
        await sendMessage(
          userId,
          getResponse(lang, "next_not_found"),
          getMainKeyboard(),
        );
      }
      return;
    }

    // Statistics button
    if (text === "📊 Statistics") {
      const [attendance, tasks] = await Promise.all([
        getAttendanceStats(userId),
        getTaskStats(userId),
      ]);

      let msg = getResponse(lang, "statistics_header") + "\n\n";
      msg += getResponse(lang, "attendance_stats", {
        attended: attendance.attended,
        total: attendance.total,
        percentage: attendance.percentage || 0,
        missed: attendance.missed,
      });
      msg += "\n\n";
      msg += getResponse(lang, "task_stats", {
        completed: tasks.completed,
        total: tasks.total,
        completion: tasks.completion || 0,
        pending: tasks.pending,
      });

      await sendMessage(userId, msg, getMainKeyboard());
      return;
    }

    // Add menu button
    if (text === "➕ Add") {
      await sendMessage(
        userId,
        lang === "ru"
          ? "Что ты хочешь добавить?"
          : "What would you like to add?",
        getAddKeyboard(),
      );
      return;
    }

    // Add class from menu
    if (text === "📅 Schedule" && lang === "en") {
      await sendMessage(
        userId,
        getResponse(lang, "add_class_help"),
        getMainKeyboard(),
      );
      return;
    }

    if (text === "📅 Расписание") {
      await sendMessage(
        userId,
        getResponse(lang, "add_class_help"),
        getMainKeyboard(),
      );
      return;
    }

    // My tasks button
    if (text === "📝 My tasks" || text === "📝 Мои задачи") {
      const tasks = await getTasks(userId, true);
      if (tasks.length === 0) {
        await sendMessage(
          userId,
          getResponse(lang, "tasks_empty"),
          getMainKeyboard(),
        );
      } else {
        // Consolidate all tasks into ONE message instead of sending 5 separate messages
        let taskList = tasks
          .map(
            (task, index) =>
              `${index + 1}. **${task.task}**\n   📅 ${task.due_date} | 🔔 ${task.remind_days}d`,
          )
          .join("\n\n");
        await sendMessage(
          userId,
          `📝 **Your Tasks:**\n\n${taskList}`,
          getMainKeyboard(),
        );
      }
      return;
    }

    // Settings button
    if (text === "⚙️ Settings" || text === "⚙️ Настройки") {
      const offset = await getUserOffset(userId);
      await sendMessage(
        userId,
        getResponse(lang, "settings_text", {
          offset,
          language: lang === "ru" ? "Русский" : "English",
        }),
        getSettingsKeyboard(offset),
      );
      return;
    }

    // Back from settings
    if (text === "🔙 Back") {
      await sendMessage(
        userId,
        lang === "ru" ? "Возвращаемся в меню..." : "Returning to main menu...",
        getMainKeyboard(),
      );
      return;
    }

    // Help button
    if (text === "❓ Help" || text === "❓ Помощь") {
      await sendMessage(
        userId,
        getResponse(lang, "help_text"),
        getMainKeyboard(),
      );
      return;
    }

    // Natural language: "What's my schedule today/tomorrow?"
    if (lowText.includes("schedule") || lowText.includes("расписание")) {
      if (lowText.includes("today") || lowText.includes("сегодня")) {
        text = "📋 Today";
      } else if (lowText.includes("tomorrow") || lowText.includes("завтра")) {
        const upcoming = await getUpcomingClasses(userId, 48);
        const tomorrow = upcoming.tomorrow || [];

        if (tomorrow.length === 0) {
          await sendMessage(
            userId,
            getResponse(lang, "tomorrow_empty"),
            getMainKeyboard(),
          );
        } else {
          let msg = getResponse(lang, "tomorrow_header");
          for (const { subject, start_time, end_time } of tomorrow) {
            msg += `${subject} • ${start_time}-${end_time}\n`;
          }
          await sendMessage(userId, msg, getMainKeyboard());
        }
        return;
      } else {
        text = "📅 Schedule";
      }
    }

    // Natural language: "What are my tasks?"
    if (lowText.includes("task") || lowText.includes("задач")) {
      text = "📝 My tasks";
    }

    // /add command
    if (lowText.startsWith("/add")) {
      const parts = text.split(" ");
      if (parts.length >= 5) {
        const subject = parts[1];
        const dayStr = parts[2];
        const startTime = parts[3];
        const endTime = parts[4];
        const day = parseInt(dayStr);

        if (!isNaN(day) && day >= 0 && day <= 6) {
          const success = await addSchedule(
            userId,
            subject,
            day,
            startTime,
            endTime,
          );
          if (success) {
            await sendMessage(
              userId,
              getResponse(lang, "class_added", { subject }),
              getMainKeyboard(),
            );
          } else {
            await sendMessage(
              userId,
              lang === "ru"
                ? "❌ Ошибка добавления класса"
                : "❌ Error adding class",
              getMainKeyboard(),
            );
          }
        } else {
          await sendMessage(
            userId,
            lang === "ru"
              ? "❌ День должен быть от 0 (Пн) до 6 (Вс)"
              : "❌ Day must be 0 (Mon) to 6 (Sun)",
            getMainKeyboard(),
          );
        }
      } else {
        await sendMessage(
          userId,
          getResponse(lang, "add_class_help"),
          getMainKeyboard(),
        );
      }
      return;
    }

    // /delete command
    if (lowText.startsWith("/delete")) {
      const parts = text.split(" ");
      if (parts.length >= 4) {
        const subject = parts[1];
        const dayStr = parts[2];
        const startTime = parts[3];
        const day = parseInt(dayStr);

        if (!isNaN(day) && day >= 0 && day <= 6) {
          const success = await deleteSchedule(userId, subject, day, startTime);
          if (success) {
            await sendMessage(
              userId,
              getResponse(lang, "class_deleted", { subject }),
              getMainKeyboard(),
            );
          } else {
            await sendMessage(
              userId,
              lang === "ru"
                ? "❌ Ошибка удаления класса"
                : "❌ Error deleting class",
              getMainKeyboard(),
            );
          }
        } else {
          await sendMessage(
            userId,
            lang === "ru"
              ? "❌ День должен быть от 0 (Пн) до 6 (Вс)"
              : "❌ Day must be 0 (Mon) to 6 (Sun)",
            getMainKeyboard(),
          );
        }
      } else {
        await sendMessage(
          userId,
          getResponse(lang, "delete_class_help"),
          getMainKeyboard(),
        );
      }
      return;
    }

    // /deadline command
    if (lowText.startsWith("/deadline")) {
      const parts = text.split(" ");
      if (parts.length >= 4) {
        const task = parts[1];
        const dueDate = parts[2];
        const remindDaysStr = parts[3];
        const remindDays = parseInt(remindDaysStr);

        if (!isNaN(remindDays)) {
          const success = await addTask(userId, task, dueDate, remindDays);
          if (success) {
            await sendMessage(
              userId,
              getResponse(lang, "task_added", { task }),
              getMainKeyboard(),
            );
          } else {
            await sendMessage(
              userId,
              lang === "ru"
                ? "❌ Ошибка добавления задачи"
                : "❌ Error adding task",
              getMainKeyboard(),
            );
          }
        } else {
          await sendMessage(
            userId,
            lang === "ru"
              ? "❌ Неверный формат. Используйте: /deadline задача YYYY-MM-DD ЧЧ:ММ дни"
              : "❌ Invalid format. Use: /deadline task YYYY-MM-DD HH:MM days",
            getMainKeyboard(),
          );
        }
      } else {
        await sendMessage(
          userId,
          lang === "ru"
            ? "📝 Отправьте: /deadline <задача> <YYYY-MM-DD ЧЧ:ММ> <дни>"
            : "📝 Send: /deadline <task> <YYYY-MM-DD HH:MM> <days>",
          getMainKeyboard(),
        );
      }
      return;
    }

    // /upload command - Import ICS calendar
    if (lowText.startsWith("/upload")) {
      const parts = text.split(" ");
      if (parts.length >= 2) {
        const url = parts.slice(1).join(" ");

        await sendMessage(
          userId,
          lang === "ru"
            ? "📥 Загружаю календарь... Пожалуйста, подождите."
            : "📥 Importing calendar... Please wait.",
          getMainKeyboard(),
        );

        const result = await downloadAndParseIcs(userId, url, lang);

        if (result.success && result.count > 0) {
          await sendMessage(
            userId,
            lang === "ru"
              ? `✅ Успешно добавлено ${result.count} занятий в расписание!`
              : `✅ Successfully added ${result.count} classes to your schedule!`,
            getMainKeyboard(),
          );
        } else if (result.success && result.count === 0) {
          await sendMessage(
            userId,
            lang === "ru"
              ? "⚠️ Календарь пуст или не содержит события."
              : "⚠️ Calendar is empty or contains no events.",
            getMainKeyboard(),
          );
        } else {
          await sendMessage(
            userId,
            lang === "ru"
              ? `❌ Ошибка импорта календаря: ${result.error}`
              : `❌ Failed to import calendar: ${result.error}`,
            getMainKeyboard(),
          );
        }
      } else {
        await sendMessage(
          userId,
          lang === "ru"
            ? "📝 Отправьте: /upload <ссылка на календарь .ics>\n\nПример: /upload https://example.com/calendar.ics"
            : "📝 Send: /upload <link to .ics calendar>\n\nExample: /upload https://example.com/calendar.ics",
          getMainKeyboard(),
        );
      }
      return;
    }

    // Greeting for hello/привет
    if (
      lowText.includes("hello") ||
      lowText.includes("hi") ||
      lowText.includes("привет")
    ) {
      await sendMessage(
        userId,
        getResponse(lang, "greeting", { name }),
        getMainKeyboard(),
      );
      return;
    }

    // Default response for any other text
    await sendMessage(
      userId,
      getResponse(lang, "help_text"),
      getMainKeyboard(),
    );
  } catch (error) {
    console.error("handleMessage error:", error);
    await sendMessage(
      userId,
      "❌ An error occurred. Please try again.",
      getMainKeyboard(),
    );
  }
}

// ========== PAYLOAD HANDLER (Inline buttons) ==========
async function handlePayload(userId, payload, lang) {
  try {
    if (payload.cmd === "mark_done") {
      const taskId = payload.did;
      const success = await completeTask(taskId, userId);
      if (success) {
        await sendMessage(
          userId,
          getResponse(lang, "task_completed"),
          getMainKeyboard(),
        );
      } else {
        await sendMessage(
          userId,
          lang === "ru"
            ? "❌ Ошибка выполнения задачи"
            : "❌ Error completing task",
          getMainKeyboard(),
        );
      }
    } else if (payload.cmd === "snooze_task") {
      const taskId = payload.tid;
      const remindDays = payload.rd || 1; // Default 1 day snooze

      try {
        const { error } = await supabase
          .from("tasks")
          .update({ remind_days: parseInt(remindDays) + 1 })
          .eq("id", taskId)
          .eq("user_id", userId);

        if (!error) {
          await sendMessage(
            userId,
            getResponse(lang, "task_snoozed"),
            getMainKeyboard(),
          );
        } else {
          throw error;
        }
      } catch (error) {
        console.error("snooze_task error:", error.message);
        await sendMessage(
          userId,
          lang === "ru" ? "❌ Ошибка отложения" : "❌ Error snoozing",
          getMainKeyboard(),
        );
      }
    } else if (payload.cmd === "mark_attended") {
      const classId = payload.cid;
      const success = await markAttendance(classId, userId, true);

      if (success) {
        await sendMessage(
          userId,
          getResponse(lang, "attended"),
          getMainKeyboard(),
        );
      } else {
        await sendMessage(
          userId,
          lang === "ru" ? "❌ Ошибка отметки" : "❌ Error marking",
          getMainKeyboard(),
        );
      }
    } else if (payload.cmd === "mark_missed") {
      const classId = payload.cid;
      const success = await markAttendance(classId, userId, false);

      if (success) {
        await sendMessage(
          userId,
          getResponse(lang, "missed"),
          getMainKeyboard(),
        );
      } else {
        await sendMessage(
          userId,
          lang === "ru" ? "❌ Ошибка отметки" : "❌ Error marking",
          getMainKeyboard(),
        );
      }
    } else if (payload.cmd === "offset_up") {
      try {
        const currentOffset = await getUserOffset(userId);
        const newOffset = Math.min(currentOffset + 5, 120); // Max 2 hours

        const { error } = await supabase
          .from("users")
          .update({ reminder_offset: newOffset })
          .eq("user_id", userId);

        if (!error) {
          await sendMessage(
            userId,
            getResponse(lang, "settings_text", {
              offset: newOffset,
              language: lang === "ru" ? "Русский" : "English",
            }),
            getSettingsKeyboard(newOffset),
          );
        } else {
          throw error;
        }
      } catch (error) {
        console.error("offset_up error:", error.message);
      }
    } else if (payload.cmd === "offset_down") {
      try {
        const currentOffset = await getUserOffset(userId);
        const newOffset = Math.max(currentOffset - 5, 5); // Min 5 minutes

        const { error } = await supabase
          .from("users")
          .update({ reminder_offset: newOffset })
          .eq("user_id", userId);

        if (!error) {
          await sendMessage(
            userId,
            getResponse(lang, "settings_text", {
              offset: newOffset,
              language: lang === "ru" ? "Русский" : "English",
            }),
            getSettingsKeyboard(newOffset),
          );
        } else {
          throw error;
        }
      } catch (error) {
        console.error("offset_down error:", error.message);
      }
    }
  } catch (error) {
    console.error("handlePayload error:", error);
  }
}

// ========== WEBHOOK HANDLER ==========
export async function handler(event) {
  try {
    const body = JSON.parse(event.body);

    // VK Confirmation Request
    if (body.type === "confirmation") {
      console.log("Confirmation request received");
      return {
        statusCode: 200,
        body: process.env.VK_CONFIRMATION_TOKEN || "default_token",
      };
    }

    // Message Event
    if (body.type === "message_new") {
      const message = body.object.message;
      const userId = message.from_id;
      const text = message.text || "";
      const payload = message.payload ? JSON.parse(message.payload) : null;

      console.log(`Message from ${userId}: "${text}"`);

      // Detect language based on text content
      const lang = text.match(/[а-яА-ЯёЁ]/) ? "ru" : "en";

      // Save language in background (fire-and-forget) - doesn't block response
      setUserLanguageAsync(userId, lang);

      // Handle payload from inline buttons
      if (payload) {
        console.log(`[${userId}] Handling payload: ${payload.cmd}`);
        await handlePayload(userId, payload, lang);
      } else {
        // Handle regular text messages
        console.log(`[${userId}] Handling message: ${text.substring(0, 50)}`);
        await handleMessage(userId, text, lang);
      }

      // Return immediately to VK after processing
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
    };
  } catch (error) {
    console.error("Handler error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}*/

import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

// ========== OPTIMIZED CONFIGURATION ==========
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const VK_TOKEN = process.env.VK_TOKEN;
const VK_API_VERSION = "5.131";

// ========== ULTRA-FAST CACHE (LRU with TTL) ==========
class FastLRUCache {
  constructor(maxSize = 500, ttl = 600000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    return item.data;
  }

  set(key, data) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  delete(key) { this.cache.delete(key); }
  clear() { this.cache.clear(); }
}

const cache = new FastLRUCache(500, 600000);
const userCache = new FastLRUCache(200, 300000);
const langCache = new FastLRUCache(100, 3600000);

// ========== FAST LANGUAGE DETECTION ==========
const LANG_PATTERNS = {
  zh: /[\u4e00-\u9fff]/,
  ru: /[а-яА-ЯёЁ]/
};

const detectLanguage = (text) => {
  if (!text) return 'en';
  const key = text.slice(0, 30);
  const cached = langCache.get(key);
  if (cached) return cached;
  
  let lang = 'en';
  if (LANG_PATTERNS.zh.test(text)) lang = 'zh';
  else if (LANG_PATTERNS.ru.test(text)) lang = 'ru';
  
  langCache.set(key, lang);
  return lang;
};

// ========== MINIFIED RESPONSES (Faster parsing) ==========
const R = {
  en: {
    w: "🌟 Hello! What's your name?",
    n: "🎉 Nice to meet you {name}!",
    wb: "👋 Welcome back {name}! {t} tasks, {c} classes",
    td: "📅 **TODAY** {date}\n{c}",
    nc: "🎉 No classes! {t} tasks pending",
    nt: "✅ No pending tasks!",
    ta: "✅ Added: {task}",
    tc: "🎉 Completed: {task}",
    ma: "✅ Marked '{c}' attended!",
    st: "📊 **Stats**\n📝 Tasks: {c}/{t} ({r}%)\n📚 Attendance: {a}/{tt} ({ar}%)",
    h: "Commands: today, tasks, stats, help",
    err: "❌ Try again",
    qp: "pong!",
    qt: "✅ OK",
    qs: "🟢 Online"
  },
  ru: {
    w: "🌟 Привет! Как тебя зовут?",
    n: "🎉 Приятно познакомиться {name}!",
    wb: "👋 С возвращением {name}! {t} задач, {c} пар",
    td: "📅 **СЕГОДНЯ** {date}\n{c}",
    nc: "🎉 Сегодня нет пар! {t} задач",
    nt: "✅ Нет задач!",
    ta: "✅ Добавлено: {task}",
    tc: "🎉 Выполнено: {task}",
    ma: "✅ Отмечено '{c}'!",
    st: "📊 **Статистика**\n📝 Задачи: {c}/{t} ({r}%)\n📚 Посещения: {a}/{tt} ({ar}%)",
    h: "Команды: сегодня, задачи, статистика, помощь",
    err: "❌ Ошибка",
    qp: "понг!",
    qt: "✅ ОК",
    qs: "🟢 Онлайн"
  },
  zh: {
    w: "🌟 你好！请问你的名字？",
    n: "🎉 很高兴认识你{name}！",
    wb: "👋 欢迎回来{name}！{t}个任务，{c}节课",
    td: "📅 **今日课表** {date}\n{c}",
    nc: "🎉 今天没课！{t}个任务",
    nt: "✅ 没有待办任务！",
    ta: "✅ 已添加：{task}",
    tc: "🎉 已完成：{task}",
    ma: "✅ 已标记'{c}'出勤！",
    st: "📊 **统计**\n📝 任务：{c}/{t} ({r}%)\n📚 出勤：{a}/{tt} ({ar}%)",
    h: "命令：今天，任务，统计，帮助",
    err: "❌ 错误",
    qp: "pong！",
    qt: "✅ 正常",
    qs: "🟢 在线"
  }
};

// ========== CACHED KEYBOARDS ==========
const keyboards = {};

const getKeyboard = (lang) => {
  if (keyboards[lang]) return keyboards[lang];
  
  const buttons = {
    zh: [[{ action: { type: "text", label: "📅 今天" }, color: "primary" }]],
    ru: [[{ action: { type: "text", label: "📅 Сегодня" }, color: "primary" }]],
    en: [[{ action: { type: "text", label: "📅 Today" }, color: "primary" }]]
  };
  
  keyboards[lang] = JSON.stringify({ one_time: false, buttons: buttons[lang] || buttons.en });
  return keyboards[lang];
};

// ========== FAST VK API ==========
const sendMessage = async (userId, text, keyboard = null) => {
  try {
    const params = new URLSearchParams();
    params.append("access_token", VK_TOKEN);
    params.append("v", VK_API_VERSION);
    params.append("user_id", userId);
    params.append("message", text.slice(0, 4000));
    params.append("random_id", Date.now());
    if (keyboard) params.append("keyboard", keyboard);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    await fetch(`https://api.vk.com/method/messages.send?${params}`, { signal: controller.signal });
    clearTimeout(timeout);
  } catch { /* silent fail */ }
};

// ========== OPTIMIZED DB FUNCTIONS ==========
const getUser = async (userId) => {
  const cached = userCache.get(userId);
  if (cached) return cached;
  
  try {
    const { data } = await supabase
      .from("users")
      .select("name, language, reminder_offset")
      .eq("vk_id", userId)
      .single();
    if (data) userCache.set(userId, data);
    return data;
  } catch { return null; }
};

const saveUser = async (userId, data) => {
  try {
    await supabase.from("users").upsert({ vk_id: userId, ...data }, { onConflict: "vk_id" });
    const updated = { ...(await getUser(userId)), ...data };
    userCache.set(userId, updated);
    return true;
  } catch { return false; }
};

const getTodayClasses = async (userId) => {
  const cacheKey = `sc_${userId}_${new Date().toDateString()}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  
  try {
    const { data } = await supabase
      .from("schedule")
      .select("subject, start_time, end_time, location")
      .eq("user_id", userId)
      .eq("day", (new Date().getDay() + 6) % 7)
      .order("start_time");
    const result = data || [];
    cache.set(cacheKey, result);
    return result;
  } catch { return []; }
};

const getTasks = async (userId) => {
  const cached = cache.get(`ts_${userId}`);
  if (cached) return cached;
  
  try {
    const { data } = await supabase
      .from("tasks")
      .select("id, task, due_date, priority")
      .eq("user_id", userId)
      .eq("done", 0)
      .order("due_date")
      .limit(20);
    const result = data || [];
    cache.set(`ts_${userId}`, result);
    return result;
  } catch { return []; }
};

const addTask = async (userId, task, due, days) => {
  try {
    await supabase.from("tasks").insert({
      user_id: userId, task, due_date: due, remind_days: days, done: 0
    });
    cache.delete(`ts_${userId}`);
    return true;
  } catch { return false; }
};

const completeTask = async (taskId, userId) => {
  try {
    await supabase.from("tasks").update({ done: 1, completed_date: new Date().toISOString() }).eq("id", taskId);
    cache.delete(`ts_${userId}`);
    return true;
  } catch { return false; }
};

const findTask = async (userId, name) => {
  const tasks = await getTasks(userId);
  return tasks.find(t => t.task.toLowerCase().includes(name.toLowerCase()));
};

const markAttended = async (userId, className) => {
  const today = new Date().toISOString().split('T')[0];
  try {
    await supabase.from("attendance").insert({ user_id: userId, class_name: className, date: today, attended: 1 });
    return true;
  } catch { return false; }
};

const getStats = async (userId) => {
  const cached = cache.get(`st_${userId}`);
  if (cached) return cached;
  
  const [tasks, attendance] = await Promise.all([
    supabase.from("tasks").select("done").eq("user_id", userId),
    supabase.from("attendance").select("attended").eq("user_id", userId)
  ]);
  
  const taskData = tasks.data || [];
  const attData = attendance.data || [];
  
  const completed = taskData.filter(t => t.done).length;
  const total = taskData.length;
  const attended = attData.filter(a => a.attended).length;
  const totalAtt = attData.length;
  
  const result = {
    tasks: { completed, pending: total - completed, rate: total ? Math.round(completed/total*100) : 0 },
    attendance: { attended, total: totalAtt, rate: totalAtt ? Math.round(attended/totalAtt*100) : 0 }
  };
  cache.set(`st_${userId}`, result);
  return result;
};

// ========== MAIN HANDLER (ULTRA FAST) ==========
export async function handler(event) {
  const start = Date.now();
  
  try {
    const body = JSON.parse(event.body);
    
    if (body.type === "confirmation") {
      return { statusCode: 200, body: process.env.VK_CONFIRMATION_TOKEN || "default" };
    }
    
    if (body.type === "message_new") {
      const msg = body.object.message;
      const userId = msg.from_id;
      const text = msg.text?.trim() || "";
      const lower = text.toLowerCase();
      
      // Quick command responses (no DB)
      if (R.en[lower]) {
        await sendMessage(userId, R.en[lower]);
        return { statusCode: 200 };
      }
      
      // Get user (cached)
      let user = await getUser(userId);
      const lang = user?.language || detectLanguage(text);
      
      if (!user?.language && lang !== 'en') {
        await saveUser(userId, { language: lang });
        user = { ...user, language: lang };
      }
      
      const name = user?.name;
      const displayName = name || 'friend';
      
      // New user
      if (!name && !lower.match(/(my name is|меня зовут|叫我)/)) {
        await sendMessage(userId, R[lang].w, getKeyboard(lang));
        return { statusCode: 200 };
      }
      
      // Extract name
      const nameMatch = text.match(/(?:my name is|меня зовут|叫我)\s+([A-Za-zА-Яа-яёЁ\u4e00-\u9fff]+)/i);
      if (nameMatch && !name) {
        const newName = nameMatch[1][0].toUpperCase() + nameMatch[1].slice(1).toLowerCase();
        await saveUser(userId, { name: newName });
        await sendMessage(userId, R[lang].n.replace('{name}', newName), getKeyboard(lang));
        
        const [tasks, classes] = await Promise.all([getTasks(userId), getTodayClasses(userId)]);
        if (tasks.length || classes.length) {
          await sendMessage(userId, R[lang].wb.replace('{name}', newName).replace('{t}', tasks.length).replace('{c}', classes.length), getKeyboard(lang));
        }
        return { statusCode: 200 };
      }
      
      // ===== FAST COMMANDS =====
      
      // Today's schedule
      if (lower === 'today' || lower === 'сегодня' || lower === '今天' || text === "📅 Today") {
        const [classes, tasks] = await Promise.all([getTodayClasses(userId), getTasks(userId)]);
        
        if (!classes.length) {
          await sendMessage(userId, R[lang].nc.replace('{t}', tasks.length), getKeyboard(lang));
        } else {
          let list = '';
          for (let i = 0; i < Math.min(classes.length, 8); i++) {
            list += `${i+1}. ${classes[i].subject} • ${classes[i].start_time}\n`;
          }
          const date = new Date().toLocaleDateString();
          await sendMessage(userId, R[lang].td.replace('{date}', date).replace('{c}', list), getKeyboard(lang));
        }
        return { statusCode: 200 };
      }
      
      // My tasks
      if (lower === 'my tasks' || lower === 'мои задачи' || lower === '我的任务' || text === "📝 Tasks") {
        const tasks = await getTasks(userId);
        
        if (!tasks.length) {
          await sendMessage(userId, R[lang].nt, getKeyboard(lang));
        } else {
          let list = '';
          for (let i = 0; i < Math.min(tasks.length, 10); i++) {
            list += `${i+1}. ${tasks[i].task}\n`;
          }
          await sendMessage(userId, `📋 **Tasks**\n${list}`, getKeyboard(lang));
        }
        return { statusCode: 200 };
      }
      
      // Complete task
      const doneMatch = text.match(/(?:done|готово|完成)\s+(.+)/i);
      if (doneMatch) {
        const task = await findTask(userId, doneMatch[1].trim());
        if (task) {
          await completeTask(task.id, userId);
          await sendMessage(userId, R[lang].tc.replace('{task}', task.task), getKeyboard(lang));
        }
        return { statusCode: 200 };
      }
      
      // Add task
      if (text.startsWith('/task')) {
        const match = text.match(/\/task\s+['"](.+?)['"]\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s+(\d+)/);
        if (match) {
          await addTask(userId, match[1], match[2], parseInt(match[3]));
          await sendMessage(userId, R[lang].ta.replace('{task}', match[1]), getKeyboard(lang));
        }
        return { statusCode: 200 };
      }
      
      // Mark attendance
      if (lower === 'mark attendance' || lower === 'отметить' || lower === '标记' || text === "✅ Mark") {
        const classes = await getTodayClasses(userId);
        if (!classes.length) {
          await sendMessage(userId, R[lang].nc.replace('{t}', 0), getKeyboard(lang));
        } else {
          let list = '';
          for (let i = 0; i < classes.length; i++) list += `${i+1}. ${classes[i].subject}\n`;
          await sendMessage(userId, `📚 Reply number:\n${list}`, getKeyboard(lang));
        }
        return { statusCode: 200 };
      }
      
      // Handle attendance number
      if (/^\d+$/.test(text) && text.length <= 2) {
        const classes = await getTodayClasses(userId);
        const idx = parseInt(text) - 1;
        if (classes[idx]) {
          await markAttended(userId, classes[idx].subject);
          await sendMessage(userId, R[lang].ma.replace('{c}', classes[idx].subject), getKeyboard(lang));
        }
        return { statusCode: 200 };
      }
      
      // Statistics
      if (lower === 'stats' || lower === 'statistics' || lower === 'статистика' || lower === '统计' || text === "📊 Stats") {
        const stats = await getStats(userId);
        const msg = R[lang].st
          .replace('{c}', stats.tasks.completed)
          .replace('{t}', stats.tasks.completed + stats.tasks.pending)
          .replace('{r}', stats.tasks.rate)
          .replace('{a}', stats.attendance.attended)
          .replace('{tt}', stats.attendance.total)
          .replace('{ar}', stats.attendance.rate);
        await sendMessage(userId, msg, getKeyboard(lang));
        return { statusCode: 200 };
      }
      
      // Help
      if (lower === 'help' || lower === 'помощь' || lower === '帮助' || text === "❓ Help") {
        await sendMessage(userId, R[lang].h, getKeyboard(lang));
        return { statusCode: 200 };
      }
      
      // Default
      await sendMessage(userId, R[lang].h, getKeyboard(lang));
      
      const elapsed = Date.now() - start;
      if (elapsed > 500) console.log(`⚠️ Slow: ${elapsed}ms`);
      
      return { statusCode: 200 };
    }
    
    return { statusCode: 200 };
  } catch (error) {
    console.error("Error:", error);
    return { statusCode: 200 };
  }
}

// ========== CLEANUP INTERVAL ==========
setInterval(() => {
  // Cache cleanup happens automatically via LRU
}, 300000);

console.log("🚀 OPTIMIZED BOT RUNNING");