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
import { WebSocket } from "ws";

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const VK_TOKEN = process.env.VK_TOKEN;
const VK_API_VERSION = "5.131";

// ========== INTELLIGENT CACHING ==========
const cache = new Map();
const userContexts = new Map(); // Store conversation context per user
const userStates = new Map(); // Store user state (waiting for input)

const CACHE_TTL = 300000; // 5 minutes

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

// ========== ENHANCED LANGUAGE DETECTION ==========
const languagePatterns = {
  en: /^(hello|hi|hey|what|how|when|where|my|schedule|task|help|thanks|thank|good|great|yes|no|please|sorry|show|tell|create|add|delete|edit|update|mark|track|statistics|progress|attendance|study|remind|reminder|today|tomorrow|next|done|complete|finish)$/i,
  ru: /^(привет|здравствуй|что|как|когда|где|мой|мое|моя|расписание|задача|помощь|спасибо|хорошо|отлично|да|нет|пожалуйста|извини|покажи|скажи|создай|добавь|удали|редактируй|отметь|отслеживай|статистика|прогресс|посещаемость|учеба|напомни|напоминание|сегодня|завтра|следующий|готово|сделано|завершено)$/i,
  es: /^(hola|qué|cómo|cuándo|dónde|mi|horario|tarea|ayuda|gracias|bueno|genial|sí|no|por favor|lo siento|muestra|dime|crea|agrega|elimina|edita|marca|estadísticas|progreso|asistencia|estudio|recordar|recordatorio|hoy|mañana|próximo|hecho|completo|terminado)$/i,
  de: /^(hallo|was|wie|wann|wo|mein|stundenplan|aufgabe|hilfe|danke|gut|großartig|ja|nein|bitte|entschuldigung|zeig|sag|erstellen|hinzufügen|löschen|bearbeiten|markieren|statistik|fortschritt|anwesenheit|lernen|erinnern|erinnerung|heute|morgen|nächste|fertig|abgeschlossen|beenden)$/i,
  fr: /^(bonjour|salut|quoi|comment|quand|où|mon|emploi|tâche|aide|merci|bien|génial|oui|non|s'il vous plaît|désolé|montre|dis|créer|ajouter|supprimer|modifier|marquer|statistiques|progrès|présence|étude|rappeler|rappel|aujourd'hui|demain|prochain|fini|terminé|complété)$/i
};

function detectLanguage(text) {
  if (!text) return 'en';
  
  // Check for Cyrillic
  if (/[а-яА-ЯёЁ]/.test(text)) return 'ru';
  
  // Check other languages
  for (const [lang, pattern] of Object.entries(languagePatterns)) {
    if (pattern.test(text)) return lang;
  }
  
  return 'en';
}

// ========== ENHANCED MULTILINGUAL RESPONSES ==========
const RESPONSES = {
  en: {
    // Greetings & Intro
    greeting: "👋 Hello {name}! I'm your intelligent academic assistant. How can I help you today?",
    morning_greeting: "🌅 Good morning {name}! Ready for a productive day?",
    afternoon_greeting: "☀️ Good afternoon {name}! Hope you're having a great day!",
    evening_greeting: "🌙 Good evening {name}! Winding down or studying?",
    ask_name: "👋 Hi there! I'm your personal AI assistant. What's your name?",
    got_name: "🎉 Awesome to meet you {name}! I'm here to help you succeed. What would you like to do?",
    
    // Schedule
    schedule_today: "📅 **Today's Schedule** - {date}\n\n{classes}💡 *Click '✅ Mark' after each class to track attendance!*",
    schedule_tomorrow: "📅 **Tomorrow's Schedule** - {date}\n\n{classes}",
    schedule_week: "📅 **Full Week Schedule**\n\n{week_schedule}",
    no_classes: "🎉 You have no classes today {name}! Perfect day for self-study or catching up on tasks!",
    no_classes_tomorrow: "🎉 No classes tomorrow {name}! Enjoy your break!",
    class_reminder: "⏰ **Class in {minutes} minutes!**\n📚 {subject}\n📍 {location}\n🕐 {start} - {end}\n\nReady to learn? 📖",
    
    // Next Class
    next_class: "⏰ {name}, your next class is **{subject}** at {time}\n📍 {location}\n⏱️ In about {minutes} minutes!\n\n*Set a reminder? Just ask!*",
    next_class_tomorrow: "📌 Your next class is tomorrow: **{subject}** at {time}\n📍 {location}",
    no_next_class: "🎉 You're all done with classes for today {name}! Time to relax or catch up on tasks!",
    
    // Tasks
    tasks_header: "📋 **Your Tasks** ({pending} pending, {completed} completed)\n\n{tasks}\n💬 *Say 'Done [task]' or click ✅ when complete!*",
    no_tasks: "✅ Amazing! No pending tasks {name}. Check 'Statistics' to see your achievement! 🎉",
    task_added: "✅ Added '{task}' to your list!\n📅 Due: {due_date}\n🔔 I'll remind you {days} day(s) before.\n\n*Want to add another? Just say the word!*",
    task_completed: "🎉 Congratulations {name}! You completed '{task}'!\n\n📊 Check your improved statistics!",
    task_deleted: "🗑️ Removed '{task}' from your list.",
    task_reminder: "⏰ **Task Reminder!**\n📝 {task}\n📅 Due: {due_date}\n⚠️ {days_left} day(s) left!",
    high_priority_warning: "🔴 **HIGH PRIORITY!** {task} is due tomorrow!",
    
    // Attendance
    attendance_prompt: "📚 **Mark Attendance**\n\nWhich class did you attend today {name}?\n\n{classes}\n\n*Reply with number or class name!*",
    attendance_marked: "✅ Got it! Marked '{class_name}' as attended {name}!\n📈 Attendance rate updated!\n\n*Need to mark another? Just say 'Mark attendance' again!*",
    attendance_streak: "🔥 You've attended {streak} classes in a row! Keep it up!",
    no_classes_attendance: "📭 No classes today {name}! Catch up on tasks or enjoy your free time!",
    
    // Study Tracking
    study_logged: "📖 Great job {name}! Logged {duration} minutes studying {subject}.\n📊 Check 'Statistics' to see your progress!\n\n*Keep up the great work!*",
    study_prompt: "📚 How long did you study today {name}? Tell me like:\n'Study 120 minutes Math'\n'Studied 45 minutes Physics'",
    
    // Statistics
    stats_header: "📊 **YOUR PERFORMANCE DASHBOARD** 📊\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n",
    task_mastery: "📝 **TASK MASTERY**\n• ✅ Completed: {completed}\n• ⏳ Pending: {pending}\n• 🔴 High Priority Done: {high}\n• 🎯 Productivity Score: {score}%\n   [{bar}]",
    attendance_section: "📚 **CLASS ATTENDANCE**\n• 📖 Total Classes: {total}\n• ✅ Attended: {attended}\n• ❌ Missed: {missed}\n• 📈 Attendance Rate: {rate}%\n   [{bar}]",
    study_section: "⏱️ **STUDY TIME**\n• 📅 Today: {today} min\n• 📆 This Week: {week} min\n• 🏆 Total: {total_study} min\n• 💪 Daily Avg: {avg} min",
    streak_section: "🔥 **STREAKS**\n• Study Streak: {study_streak} days\n• Task Streak: {task_streak} days\n• Perfect Attendance: {perfect_days} days",
    motivation: "💡 **AI INSIGHT**\n{message}",
    
    // Smart Responses
    smart_suggestions: "💡 **Smart Suggestions:**\n• You have {pending_tasks} pending tasks\n• {next_class_info}\n• Attendance: {attendance_rate}%\n\n*Want me to help with anything?*",
    productivity_tip: "📈 **Productivity Tip:** {tip}",
    encouragement: "🌟 {name}, you're doing great! {achievement}",
    
    // Natural Language Understanding
    what_can_i_ask: "I understand natural language! Try asking:\n• 'What's my schedule like this week?'\n• 'Add a math test on Friday'\n• 'I studied physics for 2 hours'\n• 'Mark my programming class'\n• 'How am I doing this month?'\n• 'Remind me to submit assignment tomorrow'",
    
    // Import
    import_instructions: "📥 **Import Schedule**\n\nSend me:\n1️⃣ An ICS file attachment\n2️⃣ A link to an ICS calendar\n3️⃣ Or use: /ics [url]\n\nI'll automatically add all your classes! ✨",
    import_success: "🎉 Successfully imported {count} classes {name}!\n\n📅 Your schedule is ready!\n✅ I'll remind you before each class\n📊 Check your statistics to track progress!",
    import_progress: "⏳ Processing your calendar... This may take a moment.",
    file_import_success: "📁 File imported! Added {count} classes to your schedule.",
    
    // Smart Commands
    help_text: "🤖 **What I Can Do**\n\n📅 **Schedule**\n• 'What's today?' or 'My classes today'\n• 'What's tomorrow?' or 'Classes tomorrow'\n• 'Show full week' or 'Weekly schedule'\n• Send ICS file to import\n\n✅ **Attendance**\n• 'Mark attendance' or 'I attended class'\n• 'Track my math class'\n\n📝 **Tasks**\n• 'My tasks' or 'What's pending?'\n• '/task \"Task name\" 2025-12-20 23:59 7 high'\n• 'Done homework' or 'Complete assignment'\n\n📊 **Study**\n• 'I studied X minutes for Y'\n• 'Study statistics' or 'My progress'\n\n📈 **Analytics**\n• 'Statistics' or 'Show my stats'\n• 'How am I doing?'\n• 'Weekly report'\n\n⚡ **Smart Features**\n• Natural language understanding\n• Personalized suggestions\n• Streak tracking\n• Productivity insights\n\n*Just type naturally - I'll understand!* 🎯",
    
    // Dynamic Responses
    time_response: "🕐 It's {time} {name}. You have {classes_today} today.\n\n{next_class_info}",
    joke: "😂 Here's a laugh for you:\n\n{joke}",
    quote: "📖 *{quote}*\n— {author}",
    
    // Errors & Fallbacks
    unknown: "🤔 I understand you're asking about '{topic}'.\n\nWould you like me to:\n• Check your schedule?\n• Show your tasks?\n• Display statistics?\n• Help with attendance?\n\n*Or just tell me what you need!*",
    error: "❌ Sorry {name}, I encountered an issue. Could you rephrase that?",
    not_found: "🔍 I couldn't find '{query}' in your {category}. Try checking your {category} list?",
    
    // Reminders
    reminder_set: "⏰ I'll remind you about '{reminder}' on {date}!",
    reminder_deleted: "🗑️ Removed your reminder.",
    no_reminders: "No active reminders {name}. Need to set one?",
    
    // Reports
    weekly_report: "📊 **Weekly Report**\n\n📅 Classes: {classes_attended}/{total_classes}\n📝 Tasks: {tasks_completed}/{total_tasks}\n📖 Study: {study_hours} hours\n📈 Improvement: {improvement}%\n\n{encouragement}",
    
    // ICS File specific
    ics_support: "📁 I support ICS files! Just attach your calendar file or send a link. I'll extract all your classes automatically!"
  },
  
  ru: {
    greeting: "👋 Привет {name}! Я твой умный учебный помощник. Чем могу помочь?",
    morning_greeting: "🌅 Доброе утро {name}! Готов к продуктивному дню?",
    afternoon_greeting: "☀️ Добрый день {name}! Надеюсь, день проходит отлично!",
    evening_greeting: "🌙 Добрый вечер {name}! Занимаешься или отдыхаешь?",
    ask_name: "👋 Привет! Я твой персональный AI-помощник. Как тебя зовут?",
    got_name: "🎉 Отлично, {name}! Я помогу тебе успевать всё. Что хочешь сделать?",
    
    schedule_today: "📅 **Расписание на сегодня** - {date}\n\n{classes}💡 *Нажми '✅ Отметить' после каждой пары!*",
    schedule_tomorrow: "📅 **Расписание на завтра** - {date}\n\n{classes}",
    schedule_week: "📅 **Расписание на неделю**\n\n{week_schedule}",
    no_classes: "🎉 Сегодня нет пар {name}! Отличный день для самоподготовки!",
    no_classes_tomorrow: "🎉 Завтра нет пар {name}! Отдыхай!",
    
    next_class: "⏰ {name}, следующая пара: **{subject}** в {time}\n📍 {location}\n⏱️ Через {minutes} минут!",
    no_next_class: "🎉 На сегодня пар больше нет {name}! Время отдыхать!",
    
    tasks_header: "📋 **Твои задачи** ({pending} активных, {completed} выполнено)\n\n{tasks}\n💬 *Скажи 'Готово [задача]' когда сделаешь!*",
    no_tasks: "✅ Отлично! Нет активных задач {name}. Проверь статистику! 🎉",
    task_added: "✅ Добавил '{task}'!\n📅 Дедлайн: {due_date}\n🔔 Напомню за {days} дн.",
    task_completed: "🎉 Молодец {name}! Ты выполнил '{task}'!\n\n📊 Проверь обновлённую статистику!",
    task_deleted: "🗑️ Удалил '{task}' из списка.",
    
    attendance_prompt: "📚 **Отметить посещение**\n\nКакую пару ты посетил {name}?\n\n{classes}\n\n*Ответь номером или названием!*",
    attendance_marked: "✅ Отметил '{class_name}' как посещённое {name}!\n📊 Посещаемость обновлена!",
    no_classes_attendance: "📭 Сегодня нет пар {name}!",
    
    study_logged: "📖 Отлично {name}! Записал {duration} минут учёбы по {subject}.\n📊 Проверь статистику!",
    
    stats_header: "📊 **ТВОЯ СТАТИСТИКА УСПЕВАЕМОСТИ** 📊\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n",
    task_mastery: "📝 **ЗАДАЧИ**\n• ✅ Выполнено: {completed}\n• ⏳ Ожидает: {pending}\n• 🔴 Высокий приоритет: {high}\n• 🎯 Продуктивность: {score}%\n   [{bar}]",
    attendance_section: "📚 **ПОСЕЩАЕМОСТЬ**\n• 📖 Всего пар: {total}\n• ✅ Посещено: {attended}\n• ❌ Пропущено: {missed}\n• 📈 Процент: {rate}%\n   [{bar}]",
    study_section: "⏱️ **ВРЕМЯ УЧЁБЫ**\n• 📅 Сегодня: {today} мин\n• 📆 На неделе: {week} мин\n• 🏆 Всего: {total_study} мин\n• 💪 В среднем: {avg} мин",
    
    import_success: "🎉 Успешно импортировано {count} пар(ы) {name}!\n\n📅 Расписание готово!\n✅ Буду напоминать перед каждой парой!",
    import_progress: "⏳ Обрабатываю календарь... Подождите.",
    
    help_text: "🤖 **Что я умею**\n\n📅 **Расписание**\n• 'Что сегодня?'\n• 'Что завтра?'\n• 'Покажи неделю'\n• Прикрепи ICS файл\n\n✅ **Посещаемость**\n• 'Отметить пару'\n\n📝 **Задачи**\n• 'Мои задачи'\n• '/task \"Задача\" 2025-12-20 23:59 7'\n• 'Готово задача'\n\n📊 **Учёба**\n• 'Я учился X минут'\n• 'Статистика'\n\n*Говори естественно - я пойму!* 🎯",
    
    unknown: "🤔 Ты спрашиваешь о '{topic}'.\n\nХочешь:\n• Посмотреть расписание?\n• Показать задачи?\n• Увидеть статистику?\n• Отметить посещение?\n\n*Просто скажи, что нужно!*",
    
    ics_support: "📁 Я поддерживаю ICS файлы! Просто прикрепи файл календаря или отправь ссылку."
  }
};

// ========== ENHANCED DATABASE SETUP ==========
async function initDatabase() {
  // Create tables if they don't exist
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      vk_id BIGINT PRIMARY KEY,
      name TEXT,
      language TEXT DEFAULT 'en',
      reminder_offset INTEGER DEFAULT 75,
      study_streak INTEGER DEFAULT 0,
      task_streak INTEGER DEFAULT 0,
      perfect_attendance_days INTEGER DEFAULT 0,
      last_active DATE,
      join_date TIMESTAMP DEFAULT NOW()
    )`,
    
    `CREATE TABLE IF NOT EXISTS schedule (
      id SERIAL PRIMARY KEY,
      user_id BIGINT,
      subject TEXT,
      day INTEGER,
      start_time TEXT,
      end_time TEXT,
      location TEXT DEFAULT '',
      teacher TEXT DEFAULT '',
      room TEXT DEFAULT '',
      UNIQUE(user_id, subject, day, start_time)
    )`,
    
    `CREATE TABLE IF NOT EXISTS class_attendance (
      id SERIAL PRIMARY KEY,
      user_id BIGINT,
      class_name TEXT,
      date DATE,
      attended INTEGER DEFAULT 0,
      missed INTEGER DEFAULT 0,
      UNIQUE(user_id, class_name, date)
    )`,
    
    `CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      user_id BIGINT,
      task TEXT,
      due_date TIMESTAMP,
      remind_days INTEGER,
      priority TEXT DEFAULT 'normal',
      category TEXT DEFAULT 'general',
      done INTEGER DEFAULT 0,
      completed_date TIMESTAMP,
      created_date TIMESTAMP DEFAULT NOW()
    )`,
    
    `CREATE TABLE IF NOT EXISTS study_sessions (
      id SERIAL PRIMARY KEY,
      user_id BIGINT,
      subject TEXT,
      duration INTEGER,
      date DATE
    )`,
    
    `CREATE TABLE IF NOT EXISTS daily_stats (
      id SERIAL PRIMARY KEY,
      user_id BIGINT,
      date DATE,
      tasks_completed INTEGER DEFAULT 0,
      classes_attended INTEGER DEFAULT 0,
      study_minutes INTEGER DEFAULT 0
    )`,
    
    `CREATE TABLE IF NOT EXISTS reminders (
      key TEXT PRIMARY KEY,
      user_id BIGINT,
      reminder_text TEXT,
      reminder_date TIMESTAMP,
      sent INTEGER DEFAULT 0
    )`,
    
    `CREATE TABLE IF NOT EXISTS user_queries (
      id SERIAL PRIMARY KEY,
      user_id BIGINT,
      query TEXT,
      intent TEXT,
      timestamp TIMESTAMP DEFAULT NOW()
    )`
  ];
  
  for (const sql of tables) {
    try {
      await supabase.rpc('exec_sql', { sql });
    } catch (e) {
      // Table might already exist
    }
  }
}

// ========== INTELLIGENT INTENT RECOGNITION ==========
class IntentRecognizer {
  constructor() {
    this.intents = {
      schedule_today: ['today', 'today\'s schedule', 'what\'s today', 'classes today', 'сегодня', 'расписание на сегодня', 'что сегодня'],
      schedule_tomorrow: ['tomorrow', 'tomorrow\'s schedule', 'what\'s tomorrow', 'classes tomorrow', 'завтра', 'расписание на завтра', 'что завтра'],
      schedule_week: ['this week', 'weekly schedule', 'full week', 'whole week', 'week schedule', 'эта неделя', 'расписание на неделю', 'вся неделя'],
      next_class: ['next', 'next class', 'what\'s next', 'следующая', 'следующая пара', 'что дальше'],
      add_task: ['add task', 'new task', 'create task', 'добавить задачу', 'новая задача', 'создать задачу'],
      show_tasks: ['my tasks', 'show tasks', 'list tasks', 'what tasks', 'мои задачи', 'показать задачи', 'список задач', 'какие задачи'],
      complete_task: ['done', 'complete', 'finished', 'готово', 'сделано', 'завершено', 'выполнено'],
      delete_task: ['delete task', 'remove task', 'удалить задачу', 'убрать задачу'],
      mark_attendance: ['mark attendance', 'mark class', 'attended', 'отметить пару', 'отметить посещение', 'я был', 'посетил'],
      show_stats: ['statistics', 'stats', 'progress', 'performance', 'how am i doing', 'статистика', 'прогресс', 'успеваемость', 'как дела'],
      study_time: ['study', 'studied', 'учился', 'занимался', 'study session'],
      help: ['help', 'what can you do', 'commands', 'помощь', 'что ты умеешь', 'команды'],
      reminder: ['remind', 'reminder', 'напомни', 'напоминание'],
      import_ics: ['import', 'ics', 'calendar', 'импорт', 'календарь'],
      greeting: ['hello', 'hi', 'hey', 'привет', 'здравствуй'],
      thanks: ['thanks', 'thank you', 'спасибо', 'благодарю'],
      time: ['what time', 'current time', 'time now', 'который час', 'время сейчас'],
      joke: ['joke', 'tell me a joke', 'шутка', 'расскажи шутку']
    };
  }
  
  recognize(text) {
    const lowerText = text.toLowerCase();
    
    for (const [intent, keywords] of Object.entries(this.intents)) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          return intent;
        }
      }
    }
    
    return 'unknown';
  }
  
  extractTaskInfo(text) {
    // Extract task name, due date, priority from natural language
    const patterns = {
      task: /(?:add|create|new)\s+(?:task\s+)?['"]?(.+?)['"]?(?:\s+(?:due|on|for|by)\s+)?/i,
      dueDate: /(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?)/,
      priority: /\b(high|medium|low|urgent|важный|средний|низкий)\b/i
    };
    
    const taskMatch = text.match(patterns.task);
    const dueMatch = text.match(patterns.dueDate);
    const priorityMatch = text.match(patterns.priority);
    
    let priority = 'normal';
    if (priorityMatch) {
      const p = priorityMatch[1].toLowerCase();
      if (p === 'high' || p === 'urgent' || p === 'важный') priority = 'high';
      else if (p === 'low' || p === 'низкий') priority = 'low';
      else priority = 'medium';
    }
    
    let dueDate = dueMatch ? dueMatch[1] : null;
    if (dueDate && dueDate.length === 10) {
      dueDate += ' 23:59';
    }
    
    return {
      task: taskMatch ? taskMatch[1].trim() : null,
      dueDate,
      priority
    };
  }
  
  extractStudyInfo(text) {
    const durationMatch = text.match(/(\d+)\s*(?:minutes?|min|минут|мин)/i);
    const subjectMatch = text.match(/(?:for|for studying|по|для)\s+(\w+)/i);
    
    return {
      duration: durationMatch ? parseInt(durationMatch[1]) : null,
      subject: subjectMatch ? subjectMatch[1] : 'general'
    };
  }
}

const intentRecognizer = new IntentRecognizer();

// ========== INTELLIGENT RESPONSE GENERATOR ==========
class SmartResponseGenerator {
  async generateInsights(userId) {
    const stats = await getFullStats(userId);
    const suggestions = [];
    
    if (stats.pendingTasks > 3) {
      suggestions.push(`You have ${stats.pendingTasks} pending tasks. Focus on completing high-priority ones first!`);
    }
    
    if (stats.attendanceRate < 70 && stats.totalClasses > 5) {
      suggestions.push(`Your attendance is ${stats.attendanceRate}%. Try to attend more classes to improve!`);
    }
    
    if (stats.studyTime.total < 300) {
      suggestions.push(`You've studied ${Math.round(stats.studyTime.total/60)} hours total. Consistency is key!`);
    }
    
    if (stats.taskCompletionRate > 80) {
      suggestions.push(`Great task completion rate! You're very organized! 🌟`);
    }
    
    if (suggestions.length === 0) {
      suggestions.push("You're doing fantastic! Keep up the momentum! 🚀");
    }
    
    return suggestions;
  }
  
  generateMotivation(stats) {
    const messages = [
      `You've completed ${stats.completedTasks} tasks! Every task done is a step closer to your goals! 🎯`,
      `With ${stats.attendanceRate}% attendance, you're building great habits! 📚`,
      `${stats.studyTime.total} minutes of study time invested in your future! 💪`,
      `You're in the top ${Math.floor(Math.random() * 30) + 10}% of productive students! 🌟`,
      `Keep going! Your consistency is paying off! 🚀`
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }
  
  async generateWeeklyReport(userId) {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const [tasks, attendance, study] = await Promise.all([
      supabase.from('tasks').select('*').eq('user_id', userId).gte('completed_date', weekAgo.toISOString()),
      supabase.from('class_attendance').select('*').eq('user_id', userId).gte('date', weekAgo.toISOString().split('T')[0]),
      supabase.from('study_sessions').select('duration').eq('user_id', userId).gte('date', weekAgo.toISOString().split('T')[0])
    ]);
    
    const totalTasks = tasks.data?.length || 0;
    const completedTasks = tasks.data?.filter(t => t.done === 1).length || 0;
    const attendedClasses = attendance.data?.filter(a => a.attended === 1).length || 0;
    const totalClasses = attendance.data?.length || 0;
    const studyHours = (study.data?.reduce((sum, s) => sum + s.duration, 0) || 0) / 60;
    
    return {
      tasksCompleted: completedTasks,
      totalTasks,
      attendance: totalClasses > 0 ? Math.round((attendedClasses / totalClasses) * 100) : 0,
      studyHours: Math.round(studyHours * 10) / 10
    };
  }
}

const smartResponse = new SmartResponseGenerator();

// ========== ENHANCED VK API HELPERS ==========
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
    console.error("sendMessage error:", error.message);
    return null;
  }
}

// ========== ENHANCED KEYBOARDS ==========
function getMainKeyboard(lang = 'en') {
  if (lang === 'ru') {
    return JSON.stringify({
      one_time: false,
      buttons: [
        [{ action: { type: "text", label: "📅 Сегодня" }, color: "primary" }, { action: { type: "text", label: "📅 Завтра" }, color: "primary" }],
        [{ action: { type: "text", label: "⏰ Следующая" }, color: "secondary" }, { action: { type: "text", label: "📝 Задачи" }, color: "positive" }],
        [{ action: { type: "text", label: "📊 Статистика" }, color: "positive" }, { action: { type: "text", label: "✅ Отметить" }, color: "primary" }],
        [{ action: { type: "text", label: "📥 Импорт" }, color: "secondary" }, { action: { type: "text", label: "❓ Помощь" }, color: "secondary" }]
      ]
    });
  }
  
  return JSON.stringify({
    one_time: false,
    buttons: [
      [{ action: { type: "text", label: "📅 Today" }, color: "primary" }, { action: { type: "text", label: "📅 Tomorrow" }, color: "primary" }],
      [{ action: { type: "text", label: "⏰ Next" }, color: "secondary" }, { action: { type: "text", label: "📝 Tasks" }, color: "positive" }],
      [{ action: { type: "text", label: "📊 Stats" }, color: "positive" }, { action: { type: "text", label: "✅ Mark" }, color: "primary" }],
      [{ action: { type: "text", label: "📥 Import" }, color: "secondary" }, { action: { type: "text", label: "❓ Help" }, color: "secondary" }]
    ]
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

async function updateUserStreaks(userId) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Check if user was active yesterday
    const { data: user } = await supabase
      .from("users")
      .select("last_active, study_streak, task_streak")
      .eq("vk_id", userId)
      .single();
    
    if (user?.last_active) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      if (user.last_active === yesterdayStr) {
        // Update streaks based on daily activity
        const { data: stats } = await supabase
          .from("daily_stats")
          .select("*")
          .eq("user_id", userId)
          .eq("date", today)
          .single();
        
        const studyStreak = (stats?.study_minutes || 0) > 0 ? (user.study_streak || 0) + 1 : 0;
        const taskStreak = (stats?.tasks_completed || 0) > 0 ? (user.task_streak || 0) + 1 : 0;
        
        await supabase
          .from("users")
          .update({ study_streak: studyStreak, task_streak: taskStreak, last_active: today })
          .eq("vk_id", userId);
      } else if (user.last_active !== today) {
        // Reset streaks
        await supabase
          .from("users")
          .update({ study_streak: 0, task_streak: 0, last_active: today })
          .eq("vk_id", userId);
      }
    } else {
      await supabase
        .from("users")
        .update({ last_active: today })
        .eq("vk_id", userId);
    }
  } catch (error) {
    console.error("updateUserStreaks error:", error.message);
  }
}

// Schedule functions
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
      .select("*")
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

async function getWeekSchedule(userId) {
  const schedule = await getSchedule(userId);
  const weekSchedule = {};
  for (let i = 0; i < 7; i++) {
    weekSchedule[i] = schedule.filter(c => c.day === i);
  }
  return weekSchedule;
}

async function getNextClass(userId) {
  const now = new Date();
  const currentDay = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const currentTime = now.getHours() * 60 + now.getMinutes();
  
  const schedule = await getSchedule(userId);
  const sorted = [...schedule].sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    return a.start_time.localeCompare(b.start_time);
  });
  
  for (const cls of sorted) {
    const [hours, minutes] = cls.start_time.split(':').map(Number);
    const classTime = hours * 60 + minutes;
    
    if (cls.day > currentDay || (cls.day === currentDay && classTime > currentTime)) {
      return cls;
    }
  }
  
  return sorted.length > 0 ? sorted[0] : null;
}

// Task functions
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
    setCached(`task_stats_${userId}`, null);
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
      .select("*")
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
    
    const today = new Date().toISOString().split('T')[0];
    const { data: daily } = await supabase
      .from("daily_stats")
      .select("id")
      .eq("user_id", userId)
      .eq("date", today)
      .single();
    
    if (daily) {
      await supabase.rpc('increment_task_count', { row_id: daily.id });
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

async function deleteTask(taskId, userId) {
  try {
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId)
      .eq("user_id", userId);
    
    if (error) throw error;
    setCached(`tasks_${userId}_true`, null);
    setCached(`task_stats_${userId}`, null);
    return true;
  } catch (error) {
    console.error("deleteTask error:", error.message);
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

// Attendance functions
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
    
    const { data: daily } = await supabase
      .from("daily_stats")
      .select("id")
      .eq("user_id", userId)
      .eq("date", today)
      .single();
    
    if (daily) {
      await supabase.rpc('increment_attendance', { row_id: daily.id });
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
    await updateUserStreaks(userId);
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

// Study functions
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
    
    await updateUserStreaks(userId);
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
    
    if (!sessions || sessions.length === 0) {
      return { total: 0, weekly: 0, today: 0 };
    }
    
    const total = sessions.reduce((sum, s) => sum + s.duration, 0);
    const weekly = sessions.filter(s => s.date >= weekAgoStr).reduce((sum, s) => sum + s.duration, 0);
    const todayStudy = sessions.filter(s => s.date === today).reduce((sum, s) => sum + s.duration, 0);
    
    return { total, weekly, today: todayStudy };
  } catch (error) {
    console.error("getStudyStats error:", error.message);
    return { total: 0, weekly: 0, today: 0 };
  }
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

async function getClassCount(userId) {
  const schedule = await getSchedule(userId);
  return schedule.length;
}

async function getFullStats(userId) {
  const [taskStats, attendanceStats, studyStats, tasks] = await Promise.all([
    getTaskStats(userId),
    getAttendanceStats(userId),
    getStudyStats(userId),
    getTasks(userId, false)
  ]);
  
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.done === 1).length;
  const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  return {
    ...taskStats,
    ...attendanceStats,
    ...studyStats,
    totalTasks,
    completedTasks,
    taskCompletionRate
  };
}

// ========== ICS IMPORT WITH FILE SUPPORT ==========
async function importIcsFromUrl(userId, url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    clearTimeout(timeout);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const icsContent = await response.text();
    return await parseIcsAndSave(userId, icsContent);
  } catch (error) {
    console.error("importIcsFromUrl error:", error.message);
    return -1;
  }
}

async function importIcsFromFile(userId, fileUrl) {
  try {
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const icsContent = await response.text();
    return await parseIcsAndSave(userId, icsContent);
  } catch (error) {
    console.error("importIcsFromFile error:", error.message);
    return -1;
  }
}

async function parseIcsAndSave(userId, icsContent) {
  try {
    const lines = icsContent.split(/\r?\n/);
    const events = [];
    let currentEvent = null;
    let description = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed === 'BEGIN:VEVENT') {
        currentEvent = {};
        description = '';
      } else if (trimmed === 'END:VEVENT' && currentEvent) {
        if (description) currentEvent.description = description;
        events.push(currentEvent);
        currentEvent = null;
      } else if (currentEvent) {
        if (trimmed.startsWith('SUMMARY:')) {
          currentEvent.subject = trimmed.substring(8).replace(/\\,/g, ',').replace(/\\n/g, ' ');
        } else if (trimmed.startsWith('DTSTART')) {
          const match = trimmed.match(/DTSTART(?:;TZID=[^:]+)?:(\d{8}T\d{6})|DTSTART:(\d{8})/);
          if (match) {
            if (match[1]) currentEvent.startDateTime = match[1];
            else if (match[2]) currentEvent.startDate = match[2];
          }
        } else if (trimmed.startsWith('DTEND')) {
          const match = trimmed.match(/DTEND(?:;TZID=[^:]+)?:(\d{8}T\d{6})|DTEND:(\d{8})/);
          if (match) {
            if (match[1]) currentEvent.endDateTime = match[1];
            else if (match[2]) currentEvent.endDate = match[2];
          }
        } else if (trimmed.startsWith('LOCATION:')) {
          currentEvent.location = trimmed.substring(9).replace(/\\,/g, ',').replace(/\\n/g, ' ');
        } else if (trimmed.startsWith('DESCRIPTION:')) {
          description = trimmed.substring(12);
        } else if (description && trimmed && !trimmed.includes(':')) {
          description += ' ' + trimmed;
        } else if (trimmed.startsWith('RRULE:')) {
          currentEvent.rrule = trimmed.substring(6);
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
      } else if (event.startDate && !event.startDateTime) {
        const dateStr = event.startDate;
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6));
        const day = parseInt(dateStr.substring(6, 8));
        const date = new Date(year, month - 1, day);
        dayOfWeek = date.getDay() === 0 ? 6 : date.getDay() - 1;
      }
      
      if (event.endDateTime) {
        const timeStr = event.endDateTime.substring(9, 15);
        const hour = parseInt(timeStr.substring(0, 2));
        const minute = parseInt(timeStr.substring(2, 4));
        endTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      }
      
      const location = event.location || '';
      
      const success = await addClass(userId, event.subject, dayOfWeek, startTime, endTime, location);
      if (success) addedCount++;
      
      // Handle recurring events if present
      if (event.rrule && addedCount === 1) {
        // For recurring events, we'll add all occurrences or mark as recurring
        console.log(`Recurring event detected: ${event.subject}`);
      }
    }
    
    return addedCount;
  } catch (error) {
    console.error("parseIcsAndSave error:", error.message);
    return 0;
  }
}

// ========== REMINDER SYSTEM ==========
let reminderInterval = null;

async function checkAndSendReminders() {
  try {
    const now = new Date();
    const currentDay = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    const { data: users } = await supabase.from("users").select("vk_id, name, language, reminder_offset");
    
    for (const user of users || []) {
      const schedule = await getSchedule(user.vk_id);
      const offset = user.reminder_offset || 75;
      
      for (const cls of schedule) {
        if (cls.day !== currentDay) continue;
        
        const [hours, minutes] = cls.start_time.split(':').map(Number);
        const classMinutes = hours * 60 + minutes;
        const reminderMinutes = classMinutes - offset;
        
        // Check if within reminder window (60-90 minutes)
        if (reminderMinutes <= currentMinutes && currentMinutes <= reminderMinutes + 5) {
          const key = `reminder_${user.vk_id}_${currentDay}_${cls.start_time}`;
          
          const { data: existing } = await supabase
            .from("reminders")
            .select("key")
            .eq("key", key)
            .single();
          
          if (!existing) {
            const lang = user.language || 'en';
            const name = user.name || 'friend';
            const minutesUntil = classMinutes - currentMinutes;
            
            const msg = getLocalizedResponse(lang, 'class_reminder', {
              name,
              subject: cls.subject,
              location: cls.location || 'Online/Classroom',
              start: cls.start_time,
              end: cls.end_time,
              minutes: minutesUntil
            });
            
            await sendMessage(user.vk_id, msg, getMainKeyboard(lang));
            
            await supabase.from("reminders").insert({ key, user_id: user.vk_id, sent: 1, reminder_date: now });
          }
        }
      }
      
      // Check for task reminders
      const tasks = await getTasks(user.vk_id, true);
      for (const task of tasks) {
        const dueDate = new Date(task.due_date);
        const daysUntil = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
        
        if (daysUntil <= task.remind_days && daysUntil > 0) {
          const key = `task_reminder_${task.id}`;
          const { data: existing } = await supabase
            .from("reminders")
            .select("key")
            .eq("key", key)
            .single();
          
          if (!existing) {
            const lang = user.language || 'en';
            const name = user.name || 'friend';
            
            let msg = getLocalizedResponse(lang, 'task_reminder', {
              name,
              task: task.task,
              due_date: dueDate.toLocaleDateString(),
              days_left: daysUntil
            });
            
            if (task.priority === 'high' && daysUntil <= 1) {
              msg = getLocalizedResponse(lang, 'high_priority_warning', { task: task.task }) + '\n\n' + msg;
            }
            
            await sendMessage(user.vk_id, msg, getMainKeyboard(lang));
            await supabase.from("reminders").insert({ key, user_id: user.vk_id, sent: 1 });
          }
        }
      }
    }
  } catch (error) {
    console.error("checkAndSendReminders error:", error.message);
  }
}

function startReminderSystem() {
  if (reminderInterval) clearInterval(reminderInterval);
  reminderInterval = setInterval(checkAndSendReminders, 300000); // Every 5 minutes
}

// ========== LOCALIZED RESPONSE HELPER ==========
function getLocalizedResponse(lang, key, vars = {}) {
  const responseSet = RESPONSES[lang] || RESPONSES.en;
  let text = responseSet[key] || RESPONSES.en[key] || key;
  
  Object.entries(vars).forEach(([k, v]) => {
    text = text.replace(new RegExp(`{${k}}`, 'g'), v);
  });
  
  return text;
}

// ========== INTELLIGENT MESSAGE HANDLER ==========
async function handleMessage(userId, text, attachments, lang) {
  try {
    const name = await getUserName(userId);
    const displayName = name || 'friend';
    
    // First time user
    if (!name && !text.toLowerCase().match(/(my name is|call me|меня зовут|зовут|i am|я -|я )/)) {
      await sendMessage(userId, getLocalizedResponse(lang, 'ask_name'), getMainKeyboard(lang));
      return;
    }
    
    // Extract name
    const nameMatch = text.match(/(?:my name is|call me|меня зовут|зовут|i am|я -|я )\s+([A-Za-zА-Яа-яёЁ]+)/i);
    if (nameMatch && !name) {
      const newName = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1).toLowerCase();
      await setUserName(userId, newName);
      
      const greeting = new Date().getHours() < 12 ? 'morning_greeting' : 
                       new Date().getHours() < 18 ? 'afternoon_greeting' : 'evening_greeting';
      
      await sendMessage(userId, getLocalizedResponse(lang, greeting, { name: newName }), getMainKeyboard(lang));
      return;
    }
    
    // Recognize intent
    const intent = intentRecognizer.recognize(text);
    const lowerText = text.toLowerCase();
    
    // Handle different intents
    switch(intent) {
      case 'schedule_today': {
        const classes = await getTodayClasses(userId);
        if (classes.length === 0) {
          await sendMessage(userId, getLocalizedResponse(lang, 'no_classes', { name: displayName }), getMainKeyboard(lang));
        } else {
          const dayNames = lang === 'ru' ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
          let classList = '';
          for (const cls of classes) {
            classList += `📚 ${cls.subject}\n   ⏰ ${cls.start_time} - ${cls.end_time}\n`;
            if (cls.location) classList += `   📍 ${cls.location}\n`;
            classList += '\n';
          }
          const today = new Date().toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' });
          await sendMessage(userId, getLocalizedResponse(lang, 'schedule_today', { name: displayName, date: today, classes: classList }), getMainKeyboard(lang));
        }
        break;
      }
      
      case 'schedule_tomorrow': {
        const classes = await getTomorrowClasses(userId);
        if (classes.length === 0) {
          await sendMessage(userId, getLocalizedResponse(lang, 'no_classes_tomorrow', { name: displayName }), getMainKeyboard(lang));
        } else {
          let classList = '';
          for (const cls of classes) {
            classList += `📚 ${cls.subject}\n   ⏰ ${cls.start_time} - ${cls.end_time}\n`;
            if (cls.location) classList += `   📍 ${cls.location}\n`;
            classList += '\n';
          }
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const dateStr = tomorrow.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' });
          await sendMessage(userId, getLocalizedResponse(lang, 'schedule_tomorrow', { name: displayName, date: dateStr, classes: classList }), getMainKeyboard(lang));
        }
        break;
      }
      
      case 'schedule_week': {
        const weekSchedule = await getWeekSchedule(userId);
        const dayNames = lang === 'ru' 
          ? ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']
          : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        
        let weekStr = '';
        for (let i = 0; i < 7; i++) {
          const classes = weekSchedule[i] || [];
          weekStr += `**${dayNames[i]}**:\n`;
          if (classes.length === 0) {
            weekStr += `   ✨ No classes\n`;
          } else {
            for (const cls of classes) {
              weekStr += `   📚 ${cls.subject} • ${cls.start_time}-${cls.end_time}\n`;
            }
          }
          weekStr += '\n';
        }
        await sendMessage(userId, getLocalizedResponse(lang, 'schedule_week', { week_schedule: weekStr }), getMainKeyboard(lang));
        break;
      }
      
      case 'next_class': {
        const nextClass = await getNextClass(userId);
        if (nextClass) {
          const now = new Date();
          const [hours, minutes] = nextClass.start_time.split(':').map(Number);
          const classTime = new Date();
          classTime.setHours(hours, minutes, 0, 0);
          
          let minutesUntil = Math.round((classTime - now) / 60000);
          minutesUntil = Math.max(0, minutesUntil);
          
          if (minutesUntil < 0 || (nextClass.day === now.getDay() === 0 ? 6 : now.getDay() - 1 && minutesUntil < 0)) {
            // Class is tomorrow or later
            await sendMessage(userId, getLocalizedResponse(lang, 'next_class_tomorrow', {
              subject: nextClass.subject,
              time: nextClass.start_time,
              location: nextClass.location || 'Classroom'
            }), getMainKeyboard(lang));
          } else {
            await sendMessage(userId, getLocalizedResponse(lang, 'next_class', {
              name: displayName,
              subject: nextClass.subject,
              time: nextClass.start_time,
              location: nextClass.location || 'Classroom',
              minutes: minutesUntil
            }), getMainKeyboard(lang));
          }
        } else {
          await sendMessage(userId, getLocalizedResponse(lang, 'no_next_class', { name: displayName }), getMainKeyboard(lang));
        }
        break;
      }
      
      case 'add_task': {
        const taskInfo = intentRecognizer.extractTaskInfo(text);
        if (taskInfo.task) {
          let dueDate = taskInfo.dueDate;
          if (!dueDate) {
            // Default to 7 days from now
            const defaultDate = new Date();
            defaultDate.setDate(defaultDate.getDate() + 7);
            defaultDate.setHours(23, 59, 0, 0);
            dueDate = defaultDate.toISOString().slice(0, 16).replace('T', ' ');
          }
          
          await addTask(userId, taskInfo.task, dueDate, 1, taskInfo.priority);
          await sendMessage(userId, getLocalizedResponse(lang, 'task_added', {
            name: displayName,
            task: taskInfo.task,
            due_date: new Date(dueDate).toLocaleDateString(),
            days: 1
          }), getMainKeyboard(lang));
        } else {
          await sendMessage(userId, "📝 Please specify the task name. Example: 'Add task Finish homework due 2025-12-20'", getMainKeyboard(lang));
        }
        break;
      }
      
      case 'show_tasks': {
        const tasks = await getTasks(userId, true);
        const taskStats = await getTaskStats(userId);
        
        if (tasks.length === 0) {
          await sendMessage(userId, getLocalizedResponse(lang, 'no_tasks', { name: displayName }), getMainKeyboard(lang));
        } else {
          let taskList = '';
          for (let i = 0; i < Math.min(tasks.length, 10); i++) {
            const task = tasks[i];
            const dueDate = new Date(task.due_date);
            const priorityIcon = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢';
            taskList += `${priorityIcon} ${i+1}. **${task.task}**\n   📅 Due: ${dueDate.toLocaleDateString()}\n`;
            if (task.priority === 'high') taskList += `   ⚠️ HIGH PRIORITY\n`;
            taskList += '\n';
          }
          if (tasks.length > 10) {
            taskList += `\n... and ${tasks.length - 10} more tasks`;
          }
          
          await sendMessage(userId, getLocalizedResponse(lang, 'tasks_header', {
            name: displayName,
            pending: taskStats.pending,
            completed: taskStats.completed,
            tasks: taskList
          }), getMainKeyboard(lang));
        }
        break;
      }
      
      case 'complete_task': {
        const match = text.match(/(?:done|complete|finished|готово|сделано|выполнено|завершено)\s+(.+?)(?:\.|$)/i);
        if (match) {
          const taskName = match[1].trim();
          const task = await findTaskByName(userId, taskName);
          if (task) {
            await completeTask(task.id, userId);
            await sendMessage(userId, getLocalizedResponse(lang, 'task_completed', { name: displayName, task: task.task }), getMainKeyboard(lang));
          } else {
            await sendMessage(userId, getLocalizedResponse(lang, 'not_found', { query: taskName, category: 'tasks', name: displayName }), getMainKeyboard(lang));
          }
        } else {
          await sendMessage(userId, "💬 Tell me what you completed! Example: 'Done homework' or 'Finished math assignment'", getMainKeyboard(lang));
        }
        break;
      }
      
      case 'mark_attendance': {
        const classes = await getTodayClasses(userId);
        if (classes.length === 0) {
          await sendMessage(userId, getLocalizedResponse(lang, 'no_classes_attendance', { name: displayName }), getMainKeyboard(lang));
        } else {
          let classList = '';
          for (let i = 0; i < classes.length; i++) {
            classList += `${i+1}. ${classes[i].subject} (${classes[i].start_time})\n`;
          }
          await sendMessage(userId, getLocalizedResponse(lang, 'attendance_prompt', { name: displayName, classes: classList }), getMainKeyboard(lang));
          
          // Store state that user is in attendance marking mode
          userStates.set(userId, { mode: 'attendance', classes });
        }
        break;
      }
      
      case 'study_time': {
        const studyInfo = intentRecognizer.extractStudyInfo(text);
        if (studyInfo.duration) {
          await addStudySession(userId, studyInfo.subject, studyInfo.duration);
          await sendMessage(userId, getLocalizedResponse(lang, 'study_logged', {
            name: displayName,
            duration: studyInfo.duration,
            subject: studyInfo.subject
          }), getMainKeyboard(lang));
        } else {
          await sendMessage(userId, getLocalizedResponse(lang, 'study_prompt', { name: displayName }), getMainKeyboard(lang));
        }
        break;
      }
      
      case 'show_stats': {
        const [taskStats, attendanceStats, studyStats, schedule] = await Promise.all([
          getTaskStats(userId),
          getAttendanceStats(userId),
          getStudyStats(userId),
          getSchedule(userId)
        ]);
        
        const productivityScore = taskStats.pending + taskStats.completed > 0 
          ? Math.round((taskStats.completed / (taskStats.completed + taskStats.pending)) * 100)
          : 0;
        
        const prodBar = '█'.repeat(Math.floor(productivityScore / 10)) + '░'.repeat(10 - Math.floor(productivityScore / 10));
        const attendBar = '█'.repeat(Math.floor(attendanceStats.rate / 10)) + '░'.repeat(10 - Math.floor(attendanceStats.rate / 10));
        const avgDaily = studyStats.weekly > 0 ? Math.round(studyStats.weekly / 7) : 0;
        
        let msg = getLocalizedResponse(lang, 'stats_header') + '\n\n';
        msg += getLocalizedResponse(lang, 'task_mastery', {
          completed: taskStats.completed,
          pending: taskStats.pending,
          high: taskStats.high,
          score: productivityScore,
          bar: prodBar
        }) + '\n\n';
        msg += getLocalizedResponse(lang, 'attendance_section', {
          total: attendanceStats.total,
          attended: attendanceStats.attended,
          missed: attendanceStats.missed,
          rate: attendanceStats.rate,
          bar: attendBar
        }) + '\n\n';
        msg += getLocalizedResponse(lang, 'study_section', {
          today: studyStats.today,
          week: studyStats.weekly,
          total_study: studyStats.total,
          avg: avgDaily
        });
        
        const motivation = await smartResponse.generateMotivation({
          completedTasks: taskStats.completed,
          attendanceRate: attendanceStats.rate,
          studyTime: studyStats
        });
        msg += '\n\n' + getLocalizedResponse(lang, 'motivation', { message: motivation });
        
        await sendMessage(userId, msg, getMainKeyboard(lang));
        break;
      }
      
      case 'import_ics': {
        await sendMessage(userId, getLocalizedResponse(lang, 'import_instructions', { name: displayName }), getMainKeyboard(lang));
        break;
      }
      
      case 'help': {
        await sendMessage(userId, getLocalizedResponse(lang, 'help_text', { name: displayName }), getMainKeyboard(lang));
        break;
      }
      
      case 'greeting': {
        const hour = new Date().getHours();
        let greetingKey = 'greeting';
        if (hour < 12) greetingKey = 'morning_greeting';
        else if (hour < 18) greetingKey = 'afternoon_greeting';
        else greetingKey = 'evening_greeting';
        
        const suggestions = await smartResponse.generateInsights(userId);
        let response = getLocalizedResponse(lang, greetingKey, { name: displayName });
        if (suggestions.length > 0) {
          response += '\n\n💡 ' + suggestions[0];
        }
        await sendMessage(userId, response, getMainKeyboard(lang));
        break;
      }
      
      case 'thanks': {
        await sendMessage(userId, getLocalizedResponse(lang, 'thanks', { name: displayName }), getMainKeyboard(lang));
        break;
      }
      
      case 'joke': {
        const jokes = {
          en: [
            "Why don't scientists trust atoms? Because they make up everything!",
            "What do you call a fake noodle? An impasta!",
            "Why did the scarecrow win an award? He was outstanding in his field!",
            "What do you call a bear with no teeth? A gummy bear!",
            "Why don't eggs tell jokes? They'd crack each other up!"
          ],
          ru: [
            "Почему программисты путают Хэллоуин с Рождеством? Потому что 31 Oct = 25 Dec!",
            "Что говорит один ноль другому? Без тебя я просто пустое место!",
            "Почему студенты любят спать на лекциях? Потому что сон - лучшее лекарство от скуки!",
            "Что общего между экзаменом и морем? Оба вызывают тошноту!"
          ]
        };
        const jokeList = jokes[lang] || jokes.en;
        const joke = jokeList[Math.floor(Math.random() * jokeList.length)];
        await sendMessage(userId, getLocalizedResponse(lang, 'joke', { joke }), getMainKeyboard(lang));
        break;
      }
      
      default: {
        // Handle number input for attendance
        if (/^\d+$/.test(text) && text.length <= 2) {
          const state = userStates.get(userId);
          if (state?.mode === 'attendance') {
            const idx = parseInt(text) - 1;
            if (idx >= 0 && idx < state.classes.length) {
              const className = state.classes[idx].subject;
              await markAttended(userId, className);
              await sendMessage(userId, getLocalizedResponse(lang, 'attendance_marked', { name: displayName, class_name: className }), getMainKeyboard(lang));
              userStates.delete(userId);
              return;
            }
          }
        }
        
        // Check if text matches a class name
        const todayClasses = await getTodayClasses(userId);
        for (const cls of todayClasses) {
          if (lowerText.includes(cls.subject.toLowerCase())) {
            await markAttended(userId, cls.subject);
            await sendMessage(userId, getLocalizedResponse(lang, 'attendance_marked', { name: displayName, class_name: cls.subject }), getMainKeyboard(lang));
            return;
          }
        }
        
        // Intelligent fallback
        const insights = await smartResponse.generateInsights(userId);
        await sendMessage(userId, getLocalizedResponse(lang, 'unknown', { 
          name: displayName, 
          topic: text.substring(0, 30)
        }) + '\n\n' + insights.slice(0, 2).join('\n'), getMainKeyboard(lang));
        break;
      }
    }
    
    // Clear state after handling
    if (userStates.has(userId)) {
      setTimeout(() => userStates.delete(userId), 30000);
    }
    
  } catch (error) {
    console.error("handleMessage error:", error);
    await sendMessage(userId, getLocalizedResponse('en', 'error', { name: 'friend' }), getMainKeyboard('en'));
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
      const attachments = message.attachments || [];
      
      console.log(`[${userId}] Message: "${text.substring(0, 50)}"`);
      
      // Detect language
      const lang = detectLanguage(text);
      await setUserLanguage(userId, lang);
      
      // Handle ICS file attachments
      for (const attachment of attachments) {
        if (attachment.type === 'doc' && attachment.doc.title?.endsWith('.ics')) {
          const fileUrl = attachment.doc.url;
          await sendMessage(userId, getLocalizedResponse(lang, 'import_progress'), getMainKeyboard(lang));
          const count = await importIcsFromFile(userId, fileUrl);
          if (count > 0) {
            const name = await getUserName(userId);
            await sendMessage(userId, getLocalizedResponse(lang, 'file_import_success', { count, name: name || 'friend' }), getMainKeyboard(lang));
          } else {
            await sendMessage(userId, getLocalizedResponse(lang, 'import_fail', { name: 'friend' }), getMainKeyboard(lang));
          }
          return {
            statusCode: 200,
            body: JSON.stringify({ ok: true }),
          };
        }
      }
      
      // Handle ICS links in text
      const icsUrlMatch = text.match(/(https?:\/\/[^\s]+\.ics)/i);
      if (icsUrlMatch) {
        await sendMessage(userId, getLocalizedResponse(lang, 'import_progress'), getMainKeyboard(lang));
        const count = await importIcsFromUrl(userId, icsUrlMatch[1]);
        if (count > 0) {
          const name = await getUserName(userId);
          await sendMessage(userId, getLocalizedResponse(lang, 'import_success', { count, name: name || 'friend' }), getMainKeyboard(lang));
        } else {
          await sendMessage(userId, getLocalizedResponse(lang, 'import_fail', { name: 'friend' }), getMainKeyboard(lang));
        }
        return {
          statusCode: 200,
          body: JSON.stringify({ ok: true }),
        };
      }
      
      // /ics command
      if (text.startsWith('/ics')) {
        const parts = text.split(/\s+/);
        if (parts.length >= 2) {
          const icsUrl = parts[1];
          if (icsUrl.startsWith('http://') || icsUrl.startsWith('https://')) {
            await sendMessage(userId, getLocalizedResponse(lang, 'import_progress'), getMainKeyboard(lang));
            const count = await importIcsFromUrl(userId, icsUrl);
            if (count > 0) {
              const name = await getUserName(userId);
              await sendMessage(userId, getLocalizedResponse(lang, 'import_success', { count, name: name || 'friend' }), getMainKeyboard(lang));
            } else {
              await sendMessage(userId, getLocalizedResponse(lang, 'import_fail', { name: 'friend' }), getMainKeyboard(lang));
            }
          }
        } else {
          await sendMessage(userId, getLocalizedResponse(lang, 'import_instructions', { name: 'friend' }), getMainKeyboard(lang));
        }
        return {
          statusCode: 200,
          body: JSON.stringify({ ok: true }),
        };
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
          const name = await getUserName(userId);
          await sendMessage(userId, getLocalizedResponse(lang, 'task_added', { 
            name: name || 'friend', 
            task: taskName, 
            due_date: dueDate,
            days
          }), getMainKeyboard(lang));
        } else {
          await sendMessage(userId, getLocalizedResponse(lang, 'task_format'), getMainKeyboard(lang));
        }
        return {
          statusCode: 200,
          body: JSON.stringify({ ok: true }),
        };
      }
      
      // Handle button/text intents
      await handleMessage(userId, text, attachments, lang);
      
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

// Initialize database and start reminder system on server start
initDatabase().then(() => {
  console.log("Database initialized");
  startReminderSystem();
  console.log("Reminder system started");
});