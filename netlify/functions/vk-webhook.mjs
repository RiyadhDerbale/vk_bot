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
function getMainKeyboard(lang = 'en') {
  if (lang === 'ru') {
    return JSON.stringify({
      one_time: false,
      buttons: [
        [
          { action: { type: "text", label: "📅 Что сегодня?" }, color: "primary" },
          { action: { type: "text", label: "📅 Что завтра?" }, color: "primary" },
        ],
        [
          { action: { type: "text", label: "⏰ Что дальше?" }, color: "secondary" },
          { action: { type: "text", label: "📝 Мои задачи" }, color: "positive" },
        ],
        [
          { action: { type: "text", label: "📊 Статистика" }, color: "positive" },
          { action: { type: "text", label: "📥 Импорт" }, color: "positive" },
        ],
        [
          { action: { type: "text", label: "✅ Отметить" }, color: "primary" },
          { action: { type: "text", label: "❓ Помощь" }, color: "secondary" },
        ],
      ],
    });
  }
  
  return JSON.stringify({
    one_time: false,
    buttons: [
      [
        { action: { type: "text", label: "📅 What's today?" }, color: "primary" },
        { action: { type: "text", label: "📅 What's tomorrow?" }, color: "primary" },
      ],
      [
        { action: { type: "text", label: "⏰ What's next?" }, color: "secondary" },
        { action: { type: "text", label: "📝 My tasks" }, color: "positive" },
      ],
      [
        { action: { type: "text", label: "📊 Statistics" }, color: "positive" },
        { action: { type: "text", label: "📥 Import" }, color: "positive" },
      ],
      [
        { action: { type: "text", label: "✅ Mark" }, color: "primary" },
        { action: { type: "text", label: "❓ Help" }, color: "secondary" },
      ],
    ],
  });
}

// ========== MULTILINGUAL RESPONSES ==========
const RESPONSES = {
  en: {
    ask_name: "Hey there! 👋 I'm your personal assistant. What's your name?",
    got_name: "Nice to meet you, {name}! 👋 I'm here to help with your schedule, tasks, and tracking your progress!",
    schedule_today: "📅 **Today's Schedule, {name}:**\n\n{classes}\n💡 After each class, click '✅ Mark attended' to track your attendance!",
    schedule_tomorrow: "📅 **Tomorrow's Schedule, {name}:**\n\n{classes}",
    no_classes: "🎉 You have no classes today, {name}! Free day!",
    no_classes_tomorrow: "🎉 No classes tomorrow, {name}! Enjoy your day off!",
    next_class: "⏰ {name}, your next class is **{subject}** at {time}. That's in about {minutes} minutes!",
    no_next_class: "🎉 You're all done with classes for today, {name}! Time to relax!",
    tasks_header: "📋 **Your Tasks, {name}:**\n\n{tasks}\n💡 Say 'Done [task]' when you complete something!\n📊 Check 'Statistics' to see your progress!",
    no_tasks: "✅ Great job, {name}! You have no pending tasks. All caught up! 🎉",
    task_added: "✅ Got it, {name}! I've added '{task}' to your list. I'll remind you {days} day(s) before.",
    task_completed: "🎉 Awesome work, {name}! I've marked '{task}' as complete!\n\n📊 Check 'Statistics' to see your updated progress!",
    import_success: "🎉 Success! I've imported {count} classes into your schedule, {name}!\n\n✅ I'll remind you before each class.\n📅 Ask 'What's today?' to see your schedule!\n📊 Check 'Statistics' to track your progress!",
    import_fail: "❌ Couldn't import from that link, {name}. Make sure it's a valid ICS file.",
    import_instructions: "📥 **How to Import Your Schedule, {name}:**\n\n1️⃣ Send me an ICS link (like from your university portal)\n2️⃣ Use command: /ics [your-link]\n3️⃣ Attach an .ics file\n\nI'll automatically add all your classes and remind you before each one! ⏰",
    attendance_prompt: "📚 Which class did you attend, {name}?\n\n{classes}\n\nReply with the number or name of the class.",
    no_classes_attendance: "You have no classes today, {name}! 📭",
    attendance_marked: "✅ Great! I've marked '{class_name}' as attended, {name}! Keep up the good attendance! 📚",
    attendance_error: "❌ Couldn't find a class named '{class_name}', {name}. Please try again with the exact name.",
    help_text: "🤖 **What I Can Do For You, {name}:**\n\n📅 **SCHEDULE**\n• \"What's today?\" - Today's classes\n• \"What's tomorrow?\" - Tomorrow's classes\n• \"What's next?\" - Next class\n• Send ICS link - Import your timetable\n\n✅ **ATTENDANCE**\n• \"Mark attended\" - Track classes you attended\n\n📝 **TASKS**\n• \"My tasks\" - See all tasks\n• /task \"Task\" 2025-12-20 23:59 7 [priority]\n• \"Done [task]\" - Mark complete\n\n📊 **STATISTICS**\n• \"Statistics\" - Complete progress report\n\n📥 **IMPORT SCHEDULE**\n• Just send me an ICS link\n• Use /ics [your-link]\n\n⏰ **REMINDERS**\n• Automatic 60-90 min before class\n\n🎯 **PRO TIP:** Track your attendance and tasks to see your productivity score!\n\nWhat would you like help with? 😊",
    stats_header: "📊 **YOUR STUDY STATISTICS, {name}!** 📊",
    task_mastery: "📝 **TASK MASTERY**\n• ✅ Completed Tasks: {completed}\n• ⏳ Pending Tasks: {pending}\n• 🔴 High Priority Done: {high}\n• 🎯 Productivity Score: {score}%\n   [{bar}]",
    attendance_section: "📚 **CLASS ATTENDANCE**\n• 📖 Total Classes: {total}\n• ✅ Attended: {attended}\n• ❌ Missed: {missed}\n• 📈 Attendance Rate: {rate}%\n   [{bar}]",
    study_section: "⏱️ **STUDY TIME**\n• 📅 Today: {today} minutes\n• 📆 This Week: {week} minutes\n• 🏆 Total: {total_study} minutes\n• 💪 Avg Daily: {avg} min/day",
    motivation: "💡 **MOTIVATION**\n{message}",
    attendance_tip: "📌 *Track your attendance by clicking '✅ Mark attended' after each class!*",
    thanks: "You're welcome, {name}! 😊 Anything else I can help with? Check 'Statistics' to see your progress!",
    time: "🕐 It's {time}, {name}. What's on your schedule?",
    joke: "😂 Here's a joke for you, {name}: {joke}",
    greeting: "Hey {name}! 👋 Good to see you! Check 'Statistics' to see your progress! 🎉",
    unknown: "That's interesting, {name}! How can I help you with that? Try 'Statistics' to see your progress!",
    reminder: "⏰ **Reminder, {name}!**\n\n📚 {subject}\n🕐 {time}\n\nIn {minutes} minutes! Get ready! 📖\n\n✅ Don't forget to mark attendance after class!",
    wrong_format: "Format: /task 'Task name' 2025-12-20 23:59 7 [priority]",
    task_format: "Format: /task 'Task name' YYYY-MM-DD HH:MM days [priority]",
    no_task_found: "Hmm, I couldn't find a task named '{task}', {name}. Can you check the name?",
    file_import_success: "🎉 Success! I've imported {count} classes from your file, {name}!",
    file_import_fail: "❌ Couldn't import from that file, {name}. Make sure it's a valid ICS file."
  },
  ru: {
    ask_name: "Привет! 👋 Я твой персональный помощник. Как тебя зовут?",
    got_name: "Приятно познакомиться, {name}! 👋 Я здесь, чтобы помочь с расписанием, задачами и отслеживанием прогресса!",
    schedule_today: "📅 **Расписание на сегодня, {name}:**\n\n{classes}\n💡 После каждой пары нажми '✅ Отметить пару', чтобы отслеживать посещаемость!",
    schedule_tomorrow: "📅 **Расписание на завтра, {name}:**\n\n{classes}",
    no_classes: "🎉 У тебя сегодня нет пар, {name}! Свободный день!",
    no_classes_tomorrow: "🎉 Завтра нет пар, {name}! Отдыхай!",
    next_class: "⏰ {name}, следующая пара: **{subject}** в {time}. Через {minutes} минут!",
    no_next_class: "🎉 На сегодня пар больше нет, {name}! Время отдыхать!",
    tasks_header: "📋 **Твои задачи, {name}:**\n\n{tasks}\n💡 Скажи 'Готово [задача]' когда сделаешь!\n📊 Проверь 'Статистику' чтобы увидеть прогресс!",
    no_tasks: "✅ Отлично, {name}! Нет активных задач. Ты всё успел! 🎉",
    task_added: "✅ Понял, {name}! Добавил '{task}' в список. Напомню за {days} дн.",
    task_completed: "🎉 Молодец, {name}! Отметил '{task}' как выполненное!\n\n📊 Проверь 'Статистику' чтобы увидеть прогресс!",
    import_success: "🎉 Отлично! Я импортировал {count} пар(ы) в расписание, {name}!\n\n✅ Я буду напоминать перед каждой парой.\n📅 Спроси 'Что сегодня?' чтобы увидеть расписание!\n📊 Проверь 'Статистику' чтобы отслеживать прогресс!",
    import_fail: "❌ Не удалось импортировать по этой ссылке, {name}. Убедись, что это правильный ICS файл.",
    import_instructions: "📥 **Как импортировать расписание, {name}:**\n\n1️⃣ Отправь мне ICS ссылку (как из университетского портала)\n2️⃣ Используй команду: /ics [ссылка]\n3️⃣ Прикрепи .ics файл\n\nЯ автоматически добавлю все пары и буду напоминать перед каждой! ⏰",
    attendance_prompt: "📚 Какую пару ты посетил, {name}?\n\n{classes}\n\nОтветь номером или названием пары.",
    no_classes_attendance: "У тебя сегодня нет пар, {name}! 📭",
    attendance_marked: "✅ Отлично! Я отметил '{class_name}' как посещённое, {name}! Так держать! 📚",
    attendance_error: "❌ Не могу найти пару '{class_name}', {name}. Попробуй ещё раз с точным названием.",
    help_text: "🤖 **Что я умею, {name}:**\n\n📅 **РАСПИСАНИЕ**\n• \"Что сегодня?\" - пары на сегодня\n• \"Что завтра?\" - пары на завтра\n• \"Что дальше?\" - следующую пару\n• Отправь ICS ссылку - импорт расписания\n\n✅ **ПОСЕЩАЕМОСТЬ**\n• \"Отметить пару\" - отметить посещённые пары\n\n📝 **ЗАДАЧИ**\n• \"Мои задачи\" - список дел\n• /task \"Задача\" 2025-12-20 23:59 7 [приоритет]\n• \"Готово [задача]\" - отметить выполненное\n\n📊 **СТАТИСТИКА**\n• \"Статистика\" - полный отчёт о прогрессе\n\n📥 **ИМПОРТ РАСПИСАНИЯ**\n• Просто отправь ICS ссылку\n• Используй /ics [ссылка]\n\n⏰ **НАПОМИНАНИЯ**\n• Автоматически за 60-90 минут до пары\n\n🎯 **СОВЕТ:** Отмечай посещаемость и задачи, чтобы видеть свой прогресс!\n\nЧем могу помочь? 😊",
    stats_header: "📊 **ТВОЯ СТАТИСТИКА УЧЁБЫ, {name}!** 📊",
    task_mastery: "📝 **ВЫПОЛНЕНИЕ ЗАДАЧ**\n• ✅ Выполнено задач: {completed}\n• ⏳ Ожидает: {pending}\n• 🔴 Высокий приоритет: {high}\n• 🎯 Продуктивность: {score}%\n   [{bar}]",
    attendance_section: "📚 **ПОСЕЩАЕМОСТЬ**\n• 📖 Всего пар: {total}\n• ✅ Посещено: {attended}\n• ❌ Пропущено: {missed}\n• 📈 Посещаемость: {rate}%\n   [{bar}]",
    study_section: "⏱️ **ВРЕМЯ УЧЁБЫ**\n• 📅 Сегодня: {today} минут\n• 📆 На этой неделе: {week} минут\n• 🏆 Всего: {total_study} минут\n• 💪 В среднем: {avg} мин/день",
    motivation: "💡 **МОТИВАЦИЯ**\n{message}",
    attendance_tip: "📌 *Отмечай посещаемость, нажимая '✅ Отметить пару' после каждой пары!*",
    thanks: "Пожалуйста, {name}! 😊 Ещё что-то нужно? Проверь 'Статистику' чтобы увидеть прогресс!",
    time: "🕐 Сейчас {time}, {name}. Что в планах?",
    joke: "😂 Шутка для тебя, {name}: {joke}",
    greeting: "Привет {name}! 👋 Рад тебя видеть! Проверь 'Статистику' чтобы увидеть прогресс! 🎉",
    unknown: "Интересно, {name}! Чем я могу помочь? Попробуй 'Статистику' чтобы увидеть прогресс!",
    reminder: "⏰ **Напоминание, {name}!**\n\n📚 {subject}\n🕐 {time}\n\nЧерез {minutes} минут! Готовься! 📖\n\n✅ Не забудь отметить посещаемость после пары!",
    wrong_format: "Формат: /task 'Название задачи' 2025-12-20 23:59 7 [приоритет]",
    task_format: "Формат: /task 'Название' ГГГГ-ММ-ДД ЧЧ:ММ дни [приоритет]",
    no_task_found: "Хм, я не могу найти задачу '{task}', {name}. Проверь название.",
    file_import_success: "🎉 Отлично! Я импортировал {count} пар(ы) из твоего файла, {name}!",
    file_import_fail: "❌ Не удалось импортировать из файла, {name}. Убедись, что это правильный ICS файл."
  }
};

function getResponse(userId, key, vars = {}) {
  const lang = getUserLanguageSync(userId);
  const text = RESPONSES[lang]?.[key] || RESPONSES.en[key];
  let result = text;
  Object.entries(vars).forEach(([key, value]) => {
    result = result.replace(new RegExp(`{${key}}`, 'g'), value);
  });
  return result;
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
    return "en";
  }
}

function getUserLanguageSync(userId) {
  // For synchronous access - defaults to 'en' for new users
  return 'en';
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
    const name = data?.name || null;
    if (name) setCached(cacheKey, name);
    return name;
  } catch (error) {
    return null;
  }
}

async function setUserName(userId, name) {
  try {
    await supabase
      .from("users")
      .upsert({ vk_id: userId, name }, { onConflict: "vk_id" });
    setCached(`name_${userId}`, name);
    return true;
  } catch (error) {
    console.error("setUserName error:", error.message);
    return false;
  }
}

async function getUserReminderOffset(userId) {
  try {
    const { data } = await supabase
      .from("users")
      .select("reminder_offset")
      .eq("vk_id", userId)
      .single();
    return data?.reminder_offset || 75;
  } catch (error) {
    return 75;
  }
}

// ========== SCHEDULE FUNCTIONS ==========
async function addClass(userId, subject, day, startTime, endTime, location = '', teacher = '') {
  try {
    const { error } = await supabase.from("schedule").insert({
      user_id: userId,
      subject,
      day,
      start_time: startTime,
      end_time: endTime,
      location,
      teacher
    });
    if (error) throw error;
    setCached(`schedule_${userId}`, null);
    return true;
  } catch (error) {
    console.error("addClass error:", error.message);
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
      .select("id, subject, day, start_time, end_time, location, teacher")
      .eq("user_id", userId)
      .order("day", { ascending: true })
      .order("start_time", { ascending: true });
    const result = data || [];
    setCached(cacheKey, result);
    return result;
  } catch (error) {
    console.error("getSchedule error:", error.message);
    return [];
  }
}

async function getTodayClasses(userId) {
  const today = new Date().getDay();
  const dayIndex = today === 0 ? 6 : today - 1;
  const schedule = await getSchedule(userId);
  return schedule.filter(c => c.day === dayIndex);
}

async function getTomorrowClasses(userId) {
  const tomorrow = (new Date().getDay() + 1) % 7;
  const dayIndex = tomorrow === 0 ? 6 : tomorrow - 1;
  const schedule = await getSchedule(userId);
  return schedule.filter(c => c.day === dayIndex);
}

async function getNextClass(userId) {
  const now = new Date();
  const currentDay = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const currentTime = now.getHours() * 60 + now.getMinutes();
  
  const schedule = await getSchedule(userId);
  
  // Sort by day and time
  const sorted = [...schedule].sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    return a.start_time.localeCompare(b.start_time);
  });
  
  // Find next class
  for (const cls of sorted) {
    const [hours, minutes] = cls.start_time.split(':').map(Number);
    const classTime = hours * 60 + minutes;
    
    if (cls.day > currentDay || (cls.day === currentDay && classTime > currentTime)) {
      return cls;
    }
  }
  
  // If no class found today/tomorrow, return first class of next week
  return sorted.length > 0 ? sorted[0] : null;
}

async function getClassCount(userId) {
  const schedule = await getSchedule(userId);
  return schedule.length;
}

// ========== ATTENDANCE FUNCTIONS ==========
async function markAttended(userId, className) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const { error } = await supabase.from("class_attendance").upsert(
      {
        user_id: userId,
        class_name: className,
        date: today,
        attended: 1,
        missed: 0
      },
      { onConflict: "user_id,class_name,date" }
    );
    
    if (error) throw error;
    
    // Update daily stats
    const { data: daily } = await supabase
      .from("daily_stats")
      .select("id")
      .eq("user_id", userId)
      .eq("date", today)
      .single();
    
    if (daily) {
      await supabase
        .from("daily_stats")
        .update({ classes_attended: supabase.rpc('increment', { row_id: daily.id, amount: 1 }) })
        .eq("id", daily.id);
    } else {
      await supabase.from("daily_stats").insert({
        user_id: userId,
        date: today,
        classes_attended: 1,
        tasks_completed: 0,
        study_minutes: 0
      });
    }
    
    setCached(`att_stats_${userId}`, null);
    return true;
  } catch (error) {
    console.error("markAttended error:", error.message);
    return false;
  }
}

async function getAttendanceStats(userId) {
  try {
    const cacheKey = `att_stats_${userId}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const { data } = await supabase
      .from("class_attendance")
      .select("attended")
      .eq("user_id", userId);

    if (!data || data.length === 0) {
      const result = { total: 0, attended: 0, missed: 0, rate: 0 };
      setCached(cacheKey, result);
      return result;
    }

    const total = data.length;
    const attended = data.filter(a => a.attended === 1).length;
    const missed = total - attended;
    const rate = total > 0 ? Math.round((attended / total) * 100) : 0;

    const result = { total, attended, missed, rate };
    setCached(cacheKey, result);
    return result;
  } catch (error) {
    console.error("getAttendanceStats error:", error.message);
    return { total: 0, attended: 0, missed: 0, rate: 0 };
  }
}

// ========== TASK FUNCTIONS ==========
async function addTask(userId, task, dueDate, remindDays, priority = 'normal') {
  try {
    const { error } = await supabase.from("tasks").insert({
      user_id: userId,
      task,
      due_date: dueDate,
      remind_days: remindDays,
      priority,
      done: 0
    });
    if (error) throw error;
    setCached(`tasks_${userId}_true`, null);
    return true;
  } catch (error) {
    console.error("addTask error:", error.message);
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
      .select("id, task, due_date, remind_days, priority, done")
      .eq("user_id", userId);

    if (onlyPending) {
      query = query.eq("done", 0);
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

async function completeTask(taskId, userId) {
  try {
    const completedDate = new Date().toISOString();
    const { error } = await supabase
      .from("tasks")
      .update({ done: 1, completed_date: completedDate })
      .eq("id", taskId)
      .eq("user_id", userId);
    
    if (error) throw error;
    
    // Update daily stats
    const today = new Date().toISOString().split('T')[0];
    const { data: daily } = await supabase
      .from("daily_stats")
      .select("id")
      .eq("user_id", userId)
      .eq("date", today)
      .single();
    
    if (daily) {
      await supabase
        .from("daily_stats")
        .update({ tasks_completed: supabase.rpc('increment', { row_id: daily.id, amount: 1 }) })
        .eq("id", daily.id);
    } else {
      await supabase.from("daily_stats").insert({
        user_id: userId,
        date: today,
        tasks_completed: 1,
        classes_attended: 0,
        study_minutes: 0
      });
    }
    
    setCached(`tasks_${userId}_true`, null);
    setCached(`task_stats_${userId}`, null);
    return true;
  } catch (error) {
    console.error("completeTask error:", error.message);
    return false;
  }
}

async function findTaskByName(userId, taskName) {
  const tasks = await getTasks(userId, true);
  return tasks.find(t => 
    t.task.toLowerCase().includes(taskName.toLowerCase()) || 
    taskName.toLowerCase().includes(t.task.toLowerCase())
  );
}

async function getTaskStats(userId) {
  try {
    const cacheKey = `task_stats_${userId}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const tasks = await getTasks(userId, false);
    
    if (tasks.length === 0) {
      const result = { pending: 0, completed: 0, high: 0 };
      setCached(cacheKey, result);
      return result;
    }

    const pending = tasks.filter(t => t.done === 0).length;
    const completed = tasks.filter(t => t.done === 1).length;
    const high = tasks.filter(t => t.priority === 'high' && t.done === 1).length;

    const result = { pending, completed, high };
    setCached(cacheKey, result);
    return result;
  } catch (error) {
    console.error("getTaskStats error:", error.message);
    return { pending: 0, completed: 0, high: 0 };
  }
}

// ========== STUDY FUNCTIONS ==========
async function addStudySession(userId, subject, duration) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const { error } = await supabase.from("study_sessions").insert({
      user_id: userId,
      subject,
      duration,
      date: today
    });
    
    if (error) throw error;
    
    // Update daily stats
    const { data: daily } = await supabase
      .from("daily_stats")
      .select("id, study_minutes")
      .eq("user_id", userId)
      .eq("date", today)
      .single();
    
    if (daily) {
      await supabase
        .from("daily_stats")
        .update({ study_minutes: daily.study_minutes + duration })
        .eq("id", daily.id);
    } else {
      await supabase.from("daily_stats").insert({
        user_id: userId,
        date: today,
        study_minutes: duration,
        tasks_completed: 0,
        classes_attended: 0
      });
    }
    
    return true;
  } catch (error) {
    console.error("addStudySession error:", error.message);
    return false;
  }
}

async function getStudyStats(userId) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];
    
    const { data: sessions } = await supabase
      .from("study_sessions")
      .select("duration, date")
      .eq("user_id", userId);
    
    if (!sessions) return { total: 0, weekly: 0, today: 0 };
    
    const total = sessions.reduce((sum, s) => sum + s.duration, 0);
    const weekly = sessions.filter(s => s.date >= weekAgoStr).reduce((sum, s) => sum + s.duration, 0);
    const todayStudy = sessions.filter(s => s.date === today).reduce((sum, s) => sum + s.duration, 0);
    
    return { total, weekly, today: todayStudy };
  } catch (error) {
    console.error("getStudyStats error:", error.message);
    return { total: 0, weekly: 0, today: 0 };
  }
}

// ========== ICS IMPORT ==========
async function importIcsFromLink(userId, url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const icsContent = await response.text();
    return await parseIcsAndSave(userId, icsContent);
  } catch (error) {
    console.error("importIcsFromLink error:", error.message);
    return -1;
  }
}

async function parseIcsAndSave(userId, icsContent) {
  try {
    const lines = icsContent.split('\n');
    const events = [];
    let currentEvent = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed === 'BEGIN:VEVENT') {
        currentEvent = {};
      } else if (trimmed === 'END:VEVENT' && currentEvent) {
        events.push(currentEvent);
        currentEvent = null;
      } else if (currentEvent) {
        if (trimmed.startsWith('SUMMARY:')) {
          currentEvent.subject = trimmed.substring(8);
        } else if (trimmed.startsWith('DTSTART')) {
          const match = trimmed.match(/DTSTART(?:.*?):(\d{8}T\d{6})?(\d{8})?/);
          if (match && match[1]) {
            currentEvent.startDateTime = match[1];
          } else if (match && match[2]) {
            currentEvent.startDate = match[2];
          }
        } else if (trimmed.startsWith('DTEND')) {
          const match = trimmed.match(/DTEND(?:.*?):(\d{8}T\d{6})?(\d{8})?/);
          if (match && match[1]) {
            currentEvent.endDateTime = match[1];
          } else if (match && match[2]) {
            currentEvent.endDate = match[2];
          }
        }
      }
    }
    
    let addedCount = 0;
    
    for (const event of events) {
      if (!event.subject) continue;
      
      let startTime = '09:00';
      let endTime = '10:00';
      let dayOfWeek = 0;
      
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
        startTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      }
      
      if (event.endDateTime) {
        const timeStr = event.endDateTime.substring(9, 15);
        const hour = parseInt(timeStr.substring(0, 2));
        const minute = parseInt(timeStr.substring(2, 4));
        endTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      }
      
      const success = await addClass(userId, event.subject, dayOfWeek, startTime, endTime);
      if (success) addedCount++;
    }
    
    return addedCount;
  } catch (error) {
    console.error("parseIcsAndSave error:", error.message);
    return 0;
  }
}

// ========== REMINDER SYSTEM ==========
let reminderScheduler = null;

async function checkReminders(vk) {
  try {
    const { data: users } = await supabase.from("users").select("vk_id, name, reminder_offset");
    
    for (const user of users) {
      const now = new Date();
      const currentDay = now.getDay() === 0 ? 6 : now.getDay() - 1;
      const currentTime = now.getHours() * 60 + now.getMinutes();
      
      const schedule = await getSchedule(user.vk_id);
      const offset = user.reminder_offset || 75;
      
      for (const cls of schedule) {
        if (cls.day !== currentDay) continue;
        
        const [hours, minutes] = cls.start_time.split(':').map(Number);
        const classTime = hours * 60 + minutes;
        const reminderTime = classTime - offset;
        
        // Check if we should send reminder (60-90 minutes window)
        if (reminderTime <= currentTime && currentTime <= reminderTime + 5) {
          const key = `reminder_${user.vk_id}_${currentDay}_${cls.start_time}`;
          
          const { data: existing } = await supabase
            .from("reminders")
            .select("key")
            .eq("key", key)
            .single();
          
          if (!existing) {
            const lang = user.language || 'en';
            const name = user.name || 'friend';
            const minutesUntil = classTime - currentTime;
            
            const msg = getResponse(user.vk_id, 'reminder', {
              name,
              subject: cls.subject,
              time: cls.start_time,
              minutes: minutesUntil
            });
            
            await sendMessage(user.vk_id, msg, getMainKeyboard(lang));
            
            await supabase.from("reminders").insert({ key, sent: 1 });
          }
        }
      }
    }
  } catch (error) {
    console.error("checkReminders error:", error.message);
  }
}

function startReminderScheduler(vk) {
  if (reminderScheduler) clearInterval(reminderScheduler);
  reminderScheduler = setInterval(() => checkReminders(vk), 300000); // Check every 5 minutes
}

// ========== MAIN MESSAGE HANDLER ==========
async function handleMessage(vk, userId, text, attachments, lang) {
  const name = await getUserName(userId);
  
  // First time user - ask for name
  if (!name && !text.toLowerCase().match(/(my name is|call me|меня зовут|зовут)/)) {
    await sendMessage(userId, getResponse(userId, 'ask_name'), getMainKeyboard(lang));
    return;
  }
  
  // Extract name from introduction
  const nameMatch = text.match(/(?:my name is|call me|меня зовут|зовут)\s+([A-Za-zА-Яа-я]+)/i);
  if (nameMatch && !name) {
    const newName = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1).toLowerCase();
    await setUserName(userId, newName);
    await sendMessage(userId, getResponse(userId, 'got_name', { name: newName }), getMainKeyboard(lang));
    return;
  }
  
  const displayName = name || 'friend';
  const textLower = text.toLowerCase();
  
  // Mark attendance button
  if (text === "✅ Mark" || text === "✅ Отметить" || text === "✅ Mark attended" || text === "✅ Отметить пару") {
    const classes = await getTodayClasses(userId);
    if (classes.length > 0) {
      const classList = classes.map((c, i) => `${i + 1}. ${c.subject}`).join('\n');
      await sendMessage(userId, getResponse(userId, 'attendance_prompt', { name: displayName, classes: classList }), getMainKeyboard(lang));
    } else {
      await sendMessage(userId, getResponse(userId, 'no_classes_attendance', { name: displayName }), getMainKeyboard(lang));
    }
    return;
  }
  
  // Handle attendance reply (number)
  if (/^\d+$/.test(text) && text.length <= 2) {
    const classes = await getTodayClasses(userId);
    const idx = parseInt(text) - 1;
    if (idx >= 0 && idx < classes.length) {
      const className = classes[idx].subject;
      await markAttended(userId, className);
      await sendMessage(userId, getResponse(userId, 'attendance_marked', { name: displayName, class_name: className }), getMainKeyboard(lang));
      return;
    }
  }
  
  // Check if text matches a class name
  const todayClasses = await getTodayClasses(userId);
  for (const cls of todayClasses) {
    if (textLower.includes(cls.subject.toLowerCase())) {
      await markAttended(userId, cls.subject);
      await sendMessage(userId, getResponse(userId, 'attendance_marked', { name: displayName, class_name: cls.subject }), getMainKeyboard(lang));
      return;
    }
  }
  
  // ICS link detection
  if (text.includes('.ics') && (text.includes('http://') || text.includes('https://'))) {
    const urlMatch = text.match(/(https?:\/\/[^\s]+\.ics)/);
    if (urlMatch) {
      await sendMessage(userId, lang === 'en' ? "⏳ Importing your schedule..." : "⏳ Импортирую расписание...", getMainKeyboard(lang));
      const count = await importIcsFromLink(userId, urlMatch[1]);
      if (count > 0) {
        await sendMessage(userId, getResponse(userId, 'import_success', { count, name: displayName }), getMainKeyboard(lang));
      } else {
        await sendMessage(userId, getResponse(userId, 'import_fail', { name: displayName }), getMainKeyboard(lang));
      }
    }
    return;
  }
  
  // /ics command
  if (text.startsWith('/ics')) {
    const parts = text.split(/\s+/);
    if (parts.length >= 2) {
      const icsUrl = parts[1];
      if (icsUrl.startsWith('http://') || icsUrl.startsWith('https://')) {
        await sendMessage(userId, lang === 'en' ? "⏳ Importing..." : "⏳ Импортирую...", getMainKeyboard(lang));
        const count = await importIcsFromLink(userId, icsUrl);
        if (count > 0) {
          await sendMessage(userId, getResponse(userId, 'import_success', { count, name: displayName }), getMainKeyboard(lang));
        } else {
          await sendMessage(userId, getResponse(userId, 'import_fail', { name: displayName }), getMainKeyboard(lang));
        }
      }
    } else {
      await sendMessage(userId, getResponse(userId, 'import_instructions', { name: displayName }), getMainKeyboard(lang));
    }
    return;
  }
  
  // Import button
  if (text === "📥 Import" || text === "📥 Импорт" || textLower.includes('how to import') || textLower.includes('как импортировать')) {
    await sendMessage(userId, getResponse(userId, 'import_instructions', { name: displayName }), getMainKeyboard(lang));
    return;
  }
  
  // /task command
  if (text.startsWith('/task')) {
    const match = text.match(/\/task\s+['"](.+?)['"]\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s+(\d+)(?:\s+(\w+))?/);
    if (match) {
      const taskName = match[1];
      const dueDate = match[2];
      const days = parseInt(match[3]);
      const priority = match[4] || 'normal';
      await addTask(userId, taskName, dueDate, days, priority);
      await sendMessage(userId, getResponse(userId, 'task_added', { name: displayName, task: taskName, days }), getMainKeyboard(lang));
    } else {
      await sendMessage(userId, getResponse(userId, 'task_format'), getMainKeyboard(lang));
    }
    return;
  }
  
  // Statistics
  if (text === "📊 Statistics" || text === "📊 Статистика" || textLower.includes('statistics') || textLower.includes('stats') || textLower.includes('статистика')) {
    const totalClasses = await getClassCount(userId);
    const taskStats = await getTaskStats(userId);
    const attendanceStats = await getAttendanceStats(userId);
    const studyStats = await getStudyStats(userId);
    
    const productivityScore = taskStats.pending + taskStats.completed > 0 
      ? Math.round((taskStats.completed / (taskStats.completed + taskStats.pending)) * 100)
      : 0;
    
    const prodBar = '█'.repeat(Math.floor(productivityScore / 10)) + '░'.repeat(10 - Math.floor(productivityScore / 10));
    const attendBar = '█'.repeat(Math.floor(attendanceStats.rate / 10)) + '░'.repeat(10 - Math.floor(attendanceStats.rate / 10));
    const avgDaily = studyStats.weekly > 0 ? Math.round(studyStats.weekly / 7) : 0;
    
    let msg = getResponse(userId, 'stats_header', { name: displayName }) + '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
    msg += getResponse(userId, 'task_mastery', {
      completed: taskStats.completed,
      pending: taskStats.pending,
      high: taskStats.high,
      score: productivityScore,
      bar: prodBar
    }) + '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
    msg += getResponse(userId, 'attendance_section', {
      total: attendanceStats.total,
      attended: attendanceStats.attended,
      missed: attendanceStats.missed,
      rate: attendanceStats.rate,
      bar: attendBar
    }) + '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
    msg += getResponse(userId, 'study_section', {
      today: studyStats.today,
      week: studyStats.weekly,
      total_study: studyStats.total,
      avg: avgDaily
    }) + '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
    
    const motivations = lang === 'en' 
      ? ["You're doing amazing! Keep pushing forward! 💪", "Every step counts! Progress over perfection! 🌟", "Your dedication is inspiring! 🎯", "Small daily improvements lead to big results! 📈", "You've got this! Keep up the great work! 🚀"]
      : ["У тебя отлично получается! Продолжай в том же духе! 💪", "Каждый шаг имеет значение! Прогресс важнее совершенства! 🌟", "Твоя целеустремлённость вдохновляет! 🎯", "Маленькие ежедневные улучшения ведут к большим результатам! 📈", "У тебя всё получится! Продолжай в том же духе! 🚀"];
    
    msg += getResponse(userId, 'motivation', { message: motivations[Math.floor(Math.random() * motivations.length)] }) + '\n\n';
    msg += getResponse(userId, 'attendance_tip');
    
    await sendMessage(userId, msg, getMainKeyboard(lang));
    return;
  }
  
  // Today's schedule
  if (text === "📅 What's today?" || text === "📅 Что сегодня?" || textLower.includes("what's today") || textLower.includes('что сегодня')) {
    const classes = await getTodayClasses(userId);
    if (classes.length > 0) {
      const days = lang === 'en' ? ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] : ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
      let classList = '';
      for (const cls of classes) {
        classList += `⏰ ${cls.start_time}-${cls.end_time} • **${cls.subject}**\n`;
        if (cls.location) classList += `   📍 ${cls.location}\n`;
        classList += '\n';
      }
      await sendMessage(userId, getResponse(userId, 'schedule_today', { name: displayName, classes: classList }), getMainKeyboard(lang));
    } else {
      await sendMessage(userId, getResponse(userId, 'no_classes', { name: displayName }), getMainKeyboard(lang));
    }
    return;
  }
  
  // Tomorrow's schedule
  if (text === "📅 What's tomorrow?" || text === "📅 Что завтра?" || textLower.includes("what's tomorrow") || textLower.includes('что завтра')) {
    const classes = await getTomorrowClasses(userId);
    if (classes.length > 0) {
      let classList = '';
      for (const cls of classes) {
        classList += `⏰ ${cls.start_time}-${cls.end_time} • **${cls.subject}**\n`;
        if (cls.location) classList += `   📍 ${cls.location}\n`;
        classList += '\n';
      }
      await sendMessage(userId, getResponse(userId, 'schedule_tomorrow', { name: displayName, classes: classList }), getMainKeyboard(lang));
    } else {
      await sendMessage(userId, getResponse(userId, 'no_classes_tomorrow', { name: displayName }), getMainKeyboard(lang));
    }
    return;
  }
  
  // Next class
  if (text === "⏰ What's next?" || text === "⏰ Что дальше?" || textLower.includes("what's next") || textLower.includes('что дальше') || textLower.includes('следующая')) {
    const nextClass = await getNextClass(userId);
    if (nextClass) {
      const now = new Date();
      const [hours, minutes] = nextClass.start_time.split(':').map(Number);
      const classTime = new Date();
      classTime.setHours(hours, minutes, 0, 0);
      const minutesUntil = Math.round((classTime - now) / 60000);
      
      await sendMessage(userId, getResponse(userId, 'next_class', { 
        name: displayName, 
        subject: nextClass.subject, 
        time: nextClass.start_time, 
        minutes: Math.max(0, minutesUntil) 
      }), getMainKeyboard(lang));
    } else {
      await sendMessage(userId, getResponse(userId, 'no_next_class', { name: displayName }), getMainKeyboard(lang));
    }
    return;
  }
  
  // My tasks
  if (text === "📝 My tasks" || text === "📝 Мои задачи" || textLower.includes('my tasks') || textLower.includes('мои задачи') || textLower.includes('tasks')) {
    const tasks = await getTasks(userId, true);
    if (tasks.length > 0) {
      let taskList = '';
      for (const task of tasks) {
        const dt = new Date(task.due_date);
        const priorityIcon = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢';
        taskList += `${priorityIcon} **${task.task}**\n   ⏰ ${dt.toLocaleDateString()} ${dt.toLocaleTimeString()}\n\n`;
      }
      await sendMessage(userId, getResponse(userId, 'tasks_header', { name: displayName, tasks: taskList }), getMainKeyboard(lang));
    } else {
      await sendMessage(userId, getResponse(userId, 'no_tasks', { name: displayName }), getMainKeyboard(lang));
    }
    return;
  }
  
  // Complete task (Done [task])
  const doneMatch = text.match(/(?:done|finished|complete|готово|сделал|выполнил)\s+(.+?)(?:\.|$)/i);
  if (doneMatch) {
    const taskName = doneMatch[1].trim();
    const task = await findTaskByName(userId, taskName);
    if (task) {
      await completeTask(task.id, userId);
      await sendMessage(userId, getResponse(userId, 'task_completed', { name: displayName, task: task.task }), getMainKeyboard(lang));
    } else {
      await sendMessage(userId, getResponse(userId, 'no_task_found', { name: displayName, task: taskName }), getMainKeyboard(lang));
    }
    return;
  }
  
  // Study logging
  const studyMatch = text.match(/(?:study|studied|учился|занимался)\s+(\d+)\s+(?:minutes?|min|минут?)(?:\s+(?:for\s+)?(.+?))?(?:\.|$)/i);
  if (studyMatch) {
    const duration = parseInt(studyMatch[1]);
    const subject = studyMatch[2]?.trim() || 'general';
    await addStudySession(userId, subject, duration);
    await sendMessage(userId, `📝 ${lang === 'en' ? `Great job! I've logged ${duration} minutes for ${subject}!` : `Отлично! Записал ${duration} минут учёбы по ${subject}!`} 📊 Check 'Statistics' to see your progress!`, getMainKeyboard(lang));
    return;
  }
  
  // Help
  if (text === "❓ Help" || text === "❓ Помощь" || textLower.includes('help') || textLower.includes('помощь')) {
    await sendMessage(userId, getResponse(userId, 'help_text', { name: displayName }), getMainKeyboard(lang));
    return;
  }
  
  // Thanks
  if (textLower.includes('thanks') || textLower.includes('thank you') || textLower.includes('спасибо')) {
    await sendMessage(userId, getResponse(userId, 'thanks', { name: displayName }), getMainKeyboard(lang));
    return;
  }
  
  // Time
  if (textLower.includes('time') || textLower.includes('время') || textLower.includes('который час')) {
    const now = new Date();
    await sendMessage(userId, getResponse(userId, 'time', { name: displayName, time: now.toLocaleTimeString() }), getMainKeyboard(lang));
    return;
  }
  
  // Joke
  if (textLower.includes('joke') || textLower.includes('шутка')) {
    const jokes = lang === 'en' 
      ? ["Why don't scientists trust atoms? They make up everything!", "What do you call a fake noodle? An impasta!", "Why did the scarecrow win an award? He was outstanding in his field!"]
      : ["Почему программисты путают Хэллоуин с Рождеством? 31 Oct = 25 Dec!", "Как называется ложная лапша? Паста-фальшивка!", "Что говорит один ноль другому? Без тебя я просто пустое место!"];
    await sendMessage(userId, getResponse(userId, 'joke', { name: displayName, joke: jokes[Math.floor(Math.random() * jokes.length)] }), getMainKeyboard(lang));
    return;
  }
  
  // Greeting
  if (textLower.match(/^(hello|hi|hey|привет)$/)) {
    await sendMessage(userId, getResponse(userId, 'greeting', { name: displayName }), getMainKeyboard(lang));
    return;
  }
  
  // Default response
  await sendMessage(userId, getResponse(userId, 'unknown', { name: displayName }), getMainKeyboard(lang));
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
      const attachments = message.attachments || [];
      
      console.log(`Message from ${userId}: "${text}"`);
      
      // Detect language
      const lang = /[а-яА-ЯёЁ]/.test(text) ? "ru" : "en";
      
      // Save language
      await setUserLanguage(userId, lang);
      
      // Handle message
      await handleMessage(null, userId, text, attachments, lang);
      
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
}
