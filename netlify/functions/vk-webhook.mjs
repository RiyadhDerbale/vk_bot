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


// VK Smart Hour Bot - Multilingual Edition (English, Русский, 中文)
// Supports automatic language detection and user language preferences
// Install: npm install node-fetch node-cron ical uuid express franc

import fetch from 'node-fetch';
import cron from 'node-cron';
import ical from 'ical';
import { v4 as uuidv4 } from 'uuid';
import express from 'express';
import fs from 'fs';
import franc from 'franc'; // Language detection library

// ==================== CONFIGURATION ====================
const VK_API_VERSION = '5.199';
const VK_ACCESS_TOKEN = 'YOUR_VK_GROUP_TOKEN'; // Replace with actual token
const VK_CONFIRMATION_CODE = 'YOUR_CONFIRMATION_CODE'; // For webhook
const PORT = process.env.PORT || 3000;

// ==================== MULTILINGUAL SUPPORT ====================
const SUPPORTED_LANGUAGES = {
  ru: 'Русский',
  en: 'English',
  zh: '中文',
  auto: 'Auto Detect'
};

// Translation dictionaries
const translations = {
  ru: {
    // General
    greeting: "👋 Привет! Я Умный час бот. Помогаю следить за расписанием и дедлайнами.\nОтправь .ics файл или ссылку для импорта расписания, или используй меню.",
    help: "📖 **Умный час бот - справка**\n\nОсновные возможности:\n📅 Расписание - просмотр, добавление вручную или через .ics\n📝 Задания - трекинг дедлайнов с отметкой \"Сделано\"\n📊 Статистика - ваш прогресс выполнения задач\n⚙️ Настройки - управление напоминаниями\n\nКоманды:\n/add_class день время название\n/add_task название ГГГГ-ММ-ДД [описание]\n/done_ID - отметить задание выполненным\n/remind_on, /remind_off, /set_remind_time 45\n/alarm_first on/off - напоминание за 60 мин до первой пары\n/lang - сменить язык\n\nЗагрузите .ics файл или ссылку на календарь прямо в чат!",
    languageChanged: "🌐 Язык изменен на Русский. Ваши уведомления теперь будут на русском языке.",
    currentLanguage: "🌐 Текущий язык: Русский\n\nВыберите язык / Выберите язык / Select language:\n/lang ru - Русский\n/lang en - English\n/lang zh - 中文",
    userNotFound: "Пользователь не найден.",
    scheduleEmpty: "📭 Расписание пусто. Добавьте занятия командой:\n`добавить занятие Название день Время`\nИли загрузите .ics файл.",
    noActiveTasks: "✅ У вас нет активных заданий! Добавьте новое командой:\n`добавить задание Название ГГГГ-ММ-ДД`",
    taskCompleted: "🎉 Отлично! Задание выполнено. Статистика обновлена.",
    taskNotFound: "Задание не найдено или уже выполнено.",
    remindersOn: "🔔 Напоминания включены",
    remindersOff: "🔕 Напоминания выключены",
    invalidTime: "Введите число от 5 до 120",
    reminderTimeSet: (m) => `⏱ Время напоминания установлено на ${m} минут до начала пары`,
    classAdded: (name, day, time) => `✅ Занятие "${name}" добавлено на ${day} день недели в ${time}`,
    addClassUsage: "Использование: `/add_class день время название`, например `/add_class 1 10:30 Математика`",
    taskAdded: (title, date) => `✅ Задание "${title}" добавлено. Дедлайн: ${date}`,
    addTaskUsage: "Формат: `/add_task Название ГГГГ-ММ-ДД [описание]`",
    icsSuccess: (count) => `✅ Импортировано ${count} событий из ICS файла.`,
    icsFail: (error) => `❌ Ошибка импорта ICS: ${error}`,
    classReminder: (title, time, location) => `📚 Напоминание о занятии!\n\n📖 ${title}\n⏰ Начало: ${time}\n📍 ${location || 'Место не указано'}\n\nНе опаздывайте!`,
    firstClassAlarm: (title, time) => `⏰ СКОРО ПЕРВОЕ ЗАНЯТИЕ!\n\nПервый урок дня: ${title} в ${time}\nДо начала 60 минут. Подготовьтесь!`,
    deadlineReminder: (title, date, daysLeft) => `📝 ДЕДЛАЙН!\n\nЗадание: ${title}\nСдать до: ${date}\n${daysLeft === 0 ? '❗️ Сегодня последний день!' : `⏳ Осталось ${daysLeft} дня(ей)`}`,
    // Schedule view
    scheduleTitle: "📅 **Ваше расписание:**\n\n",
    days: ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'],
    tasksTitle: "📋 **Активные задания:**\n\n",
    settingsTitle: "⚙️ **Настройки напоминаний**\n\n",
    settingsNotifications: (status) => `🔔 Уведомления: ${status ? 'ВКЛ' : 'ВЫКЛ'}`,
    settingsReminderMinutes: (m) => `⏱ За сколько минут напоминать о паре: ${m}`,
    settingsFirstAlarm: (status) => `🌅 Напоминание за 60 мин до первой пары: ${status ? 'ВКЛ' : 'ВЫКЛ'}`,
    settingsCommands: "Команды:\n/remind_on | /remind_off\n/set_remind_time 30\n/alarm_first on|off",
    unknownCommand: "Я не понял команду. Используйте меню или команду /help",
    // Statistics
    statsTitle: "📊 **Ваша статистика**\n\n",
    statsClasses: (n) => `📚 Занятий в расписании: ${n}`,
    statsCompleted: (done, total, percent) => `✅ Выполнено заданий: ${done}/${total} (${percent}%)`,
    statsPending: (n) => `⏳ Ожидают выполнения: ${n}`,
    statsOverdue: (n) => `⚠️ Просроченных заданий: ${n}`,
    statsReminders: (n) => `🔔 Отправлено напоминаний: ${n}`,
    statsLastActive: (date) => `📅 Последняя активность: ${date}`,
    statsProgress: (percent) => `Прогресс: ${'▓'.repeat(Math.floor(percent/10))}${'░'.repeat(10-Math.floor(percent/10))} ${percent}%`,
  },
  en: {
    greeting: "👋 Hello! I'm Smart Hour bot. I help you manage your academic schedule and deadlines.\nSend an .ics file or link to import your schedule, or use the menu.",
    help: "📖 **Smart Hour Bot - Help**\n\nFeatures:\n📅 Schedule - view, add manually or via .ics\n📝 Tasks - track deadlines with 'Done' button\n📊 Statistics - your progress and performance\n⚙️ Settings - manage notifications\n\nCommands:\n/add_class day time name (day: 1-7 Mon=1)\n/add_task name YYYY-MM-DD [description]\n/done_ID - mark task as completed\n/remind_on, /remind_off, /set_remind_time 45\n/alarm_first on/off - alarm 60min before first class\n/lang - change language\n\nUpload .ics file or paste calendar link!",
    languageChanged: "🌐 Language changed to English. Your notifications will now be in English.",
    currentLanguage: "🌐 Current language: English\n\nSelect language:\n/lang ru - Русский\n/lang en - English\n/lang zh - 中文",
    userNotFound: "User not found.",
    scheduleEmpty: "📭 Schedule is empty. Add classes using:\n`/add_class day time name`\nOr upload an .ics file.",
    noActiveTasks: "✅ You have no active tasks! Add one with:\n`/add_task name YYYY-MM-DD`",
    taskCompleted: "🎉 Great! Task marked as completed. Statistics updated.",
    taskNotFound: "Task not found or already completed.",
    remindersOn: "🔔 Reminders enabled",
    remindersOff: "🔕 Reminders disabled",
    invalidTime: "Please enter a number between 5 and 120",
    reminderTimeSet: (m) => `⏱ Reminder time set to ${m} minutes before class`,
    classAdded: (name, day, time) => `✅ Class "${name}" added for day ${day} at ${time}`,
    addClassUsage: "Usage: `/add_class day time name`, e.g., `/add_class 1 10:30 Mathematics`",
    taskAdded: (title, date) => `✅ Task "${title}" added. Due date: ${date}`,
    addTaskUsage: "Format: `/add_task title YYYY-MM-DD [description]`",
    icsSuccess: (count) => `✅ Imported ${count} events from ICS file.`,
    icsFail: (error) => `❌ ICS import failed: ${error}`,
    classReminder: (title, time, location) => `📚 Class Reminder!\n\n📖 ${title}\n⏰ Starts at: ${time}\n📍 ${location || 'No location specified'}\n\nDon't be late!`,
    firstClassAlarm: (title, time) => `⏰ FIRST CLASS SOON!\n\nFirst class today: ${title} at ${time}\nStarts in 60 minutes. Get ready!`,
    deadlineReminder: (title, date, daysLeft) => `📝 DEADLINE REMINDER!\n\nTask: ${title}\nDue: ${date}\n${daysLeft === 0 ? '❗️ Today is the last day!' : `⏳ ${daysLeft} day(s) remaining`}`,
    scheduleTitle: "📅 **Your Schedule:**\n\n",
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    tasksTitle: "📋 **Active Tasks:**\n\n",
    settingsTitle: "⚙️ **Notification Settings**\n\n",
    settingsNotifications: (status) => `🔔 Notifications: ${status ? 'ON' : 'OFF'}`,
    settingsReminderMinutes: (m) => `⏱ Reminder minutes before class: ${m}`,
    settingsFirstAlarm: (status) => `🌅 60-minute alarm before first class: ${status ? 'ON' : 'OFF'}`,
    settingsCommands: "Commands:\n/remind_on | /remind_off\n/set_remind_time 30\n/alarm_first on|off",
    unknownCommand: "I don't understand that command. Use the menu or /help",
    statsTitle: "📊 **Your Statistics**\n\n",
    statsClasses: (n) => `📚 Classes in schedule: ${n}`,
    statsCompleted: (done, total, percent) => `✅ Tasks completed: ${done}/${total} (${percent}%)`,
    statsPending: (n) => `⏳ Pending tasks: ${n}`,
    statsOverdue: (n) => `⚠️ Overdue tasks: ${n}`,
    statsReminders: (n) => `🔔 Reminders sent: ${n}`,
    statsLastActive: (date) => `📅 Last active: ${date}`,
    statsProgress: (percent) => `Progress: ${'▓'.repeat(Math.floor(percent/10))}${'░'.repeat(10-Math.floor(percent/10))} ${percent}%`,
  },
  zh: {
    greeting: "👋 你好！我是智能学时助手。帮助你管理课程表和学习任务截止日期。\n发送 .ics 文件或链接导入课程表，或使用菜单。",
    help: "📖 **智能学时助手 - 帮助**\n\n功能：\n📅 课程表 - 查看、手动添加或通过 .ics 导入\n📝 任务 - 追踪截止日期，可标记\"已完成\"\n📊 统计 - 你的学习进度\n⚙️ 设置 - 管理提醒\n\n命令：\n/add_class 星期几 时间 课程名称 (星期：1-7，周一=1)\n/add_task 任务名称 年-月-日 [描述]\n/done_ID - 标记任务完成\n/remind_on, /remind_off, /set_remind_time 45\n/alarm_first on/off - 第一节课前60分钟提醒\n/lang - 切换语言\n\n直接上传 .ics 文件或粘贴日历链接！",
    languageChanged: "🌐 语言已切换为中文。您的通知将使用中文。",
    currentLanguage: "🌐 当前语言：中文\n\n选择语言 / 選擇語言 / Select language:\n/lang ru - Русский\n/lang en - English\n/lang zh - 中文",
    userNotFound: "未找到用户。",
    scheduleEmpty: "📭 课程表为空。使用以下命令添加课程：\n`/add_class 星期几 时间 名称`\n或上传 .ics 文件。",
    noActiveTasks: "✅ 您没有未完成的任务！使用以下命令添加：\n`/add_task 任务名称 年-月-日`",
    taskCompleted: "🎉 太棒了！任务已完成。统计数据已更新。",
    taskNotFound: "任务未找到或已完成。",
    remindersOn: "🔔 提醒已开启",
    remindersOff: "🔕 提醒已关闭",
    invalidTime: "请输入 5 到 120 之间的数字",
    reminderTimeSet: (m) => `⏱ 提醒时间设置为课程前 ${m} 分钟`,
    classAdded: (name, day, time) => `✅ 课程“${name}”已添加到星期${day} ${time}`,
    addClassUsage: "用法：`/add_class 星期几 时间 名称`，例如 `/add_class 1 10:30 数学`",
    taskAdded: (title, date) => `✅ 任务“${title}”已添加。截止日期：${date}`,
    addTaskUsage: "格式：`/add_task 任务名称 年-月-日 [描述]`",
    icsSuccess: (count) => `✅ 已从 ICS 文件导入 ${count} 个事件。`,
    icsFail: (error) => `❌ ICS 导入失败：${error}`,
    classReminder: (title, time, location) => `📚 课程提醒！\n\n📖 ${title}\n⏰ 开始时间：${time}\n📍 ${location || '未指定地点'}\n\n不要迟到！`,
    firstClassAlarm: (title, time) => `⏰ 第一节课即将开始！\n\n今天的第一节课：${title} ${time}\n60分钟后开始。请做好准备！`,
    deadlineReminder: (title, date, daysLeft) => `📝 截止日期提醒！\n\n任务：${title}\n截止：${date}\n${daysLeft === 0 ? '❗️ 今天是最后一天！' : `⏳ 还剩 ${daysLeft} 天`}`,
    scheduleTitle: "📅 **您的课程表：**\n\n",
    days: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    tasksTitle: "📋 **未完成任务：**\n\n",
    settingsTitle: "⚙️ **提醒设置**\n\n",
    settingsNotifications: (status) => `🔔 通知：${status ? '开启' : '关闭'}`,
    settingsReminderMinutes: (m) => `⏱ 课程前几分钟提醒：${m}`,
    settingsFirstAlarm: (status) => `🌅 第一节课前60分钟提醒：${status ? '开启' : '关闭'}`,
    settingsCommands: "命令：\n/remind_on | /remind_off\n/set_remind_time 30\n/alarm_first on|off",
    unknownCommand: "我不理解该命令。请使用菜单或 /help",
    statsTitle: "📊 **您的统计**\n\n",
    statsClasses: (n) => `📚 课程表课程数：${n}`,
    statsCompleted: (done, total, percent) => `✅ 任务完成：${done}/${total} (${percent}%)`,
    statsPending: (n) => `⏳ 待完成任务：${n}`,
    statsOverdue: (n) => `⚠️ 逾期任务：${n}`,
    statsReminders: (n) => `🔔 已发送提醒：${n}`,
    statsLastActive: (date) => `📅 最后活动：${date}`,
    statsProgress: (percent) => `进度：${'▓'.repeat(Math.floor(percent/10))}${'░'.repeat(10-Math.floor(percent/10))} ${percent}%`,
  }
};

// Default fallback for unknown languages (English)
const DEFAULT_LANG = 'en';

// ==================== DATA STORAGE ====================
let users = new Map(); // userId -> UserData

class UserData {
  constructor(userId, language = null) {
    this.id = userId;
    this.language = language; // Will be auto-detected or set by user
    this.schedule = [];
    this.assignments = [];
    this.settings = {
      reminderMinutes: 60,
      enableNotifications: true,
      firstClassAlarm: true,
    };
    this.icsUrls = [];
    this.statistics = {
      totalRemindersSent: 0,
      tasksCompleted: 0,
      tasksOverdue: 0,
      lastActive: new Date().toISOString(),
    };
    this._sentReminders = new Set();
    this._sentFirstAlarm = false;
  }
}

// Load/save data
function loadData() {
  try {
    if (fs.existsSync('users_data.json')) {
      const data = JSON.parse(fs.readFileSync('users_data.json', 'utf8'));
      for (const [id, userData] of Object.entries(data)) {
        const user = new UserData(id);
        Object.assign(user, userData);
        user._sentReminders = new Set(userData._sentReminders || []);
        users.set(id, user);
      }
      console.log(`Loaded ${users.size} users from storage`);
    }
  } catch (e) {
    console.error('Failed to load data:', e);
  }
}

function saveData() {
  const plain = {};
  for (const [id, user] of users.entries()) {
    const userCopy = {
      ...user,
      _sentReminders: Array.from(user._sentReminders || []),
      _sentFirstAlarm: user._sentFirstAlarm
    };
    delete userCopy._sentReminders;
    plain[id] = userCopy;
  }
  fs.writeFileSync('users_data.json', JSON.stringify(plain, null, 2));
}

// ==================== LANGUAGE DETECTION ====================
function detectLanguage(text) {
  if (!text || text.trim() === '') return DEFAULT_LANG;
  
  // Check for explicit language commands first
  const lowerText = text.toLowerCase();
  if (lowerText.includes('/lang ru')) return 'ru';
  if (lowerText.includes('/lang en')) return 'en';
  if (lowerText.includes('/lang zh')) return 'zh';
  
  // Character-based detection for Chinese
  const chinesePattern = /[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f]/;
  if (chinesePattern.test(text)) return 'zh';
  
  // Russian cyrillic detection
  const russianPattern = /[а-яА-ЯёЁ]/;
  const hasRussian = russianPattern.test(text);
  // English words detection (latin alphabet)
  const latinPattern = /[a-zA-Z]/;
  const hasLatin = latinPattern.test(text);
  
  if (hasRussian && !hasLatin) return 'ru';
  
  // Use franc for ambiguous cases (mostly English vs others)
  if (hasLatin) {
    const langCode = franc(text, { minLength: 3 });
    if (langCode === 'rus') return 'ru';
    if (langCode === 'cmn' || langCode === 'zho') return 'zh';
    if (langCode === 'eng') return 'en';
  }
  
  // Default to English for unknown
  return DEFAULT_LANG;
}

function getUserLanguage(userId) {
  const user = users.get(userId);
  if (user && user.language && translations[user.language]) {
    return user.language;
  }
  return DEFAULT_LANG;
}

function setUserLanguage(userId, language) {
  if (!translations[language]) return false;
  const user = users.get(userId);
  if (user) {
    user.language = language;
    saveData();
    return true;
  }
  return false;
}

function t(userId, key, ...args) {
  const lang = getUserLanguage(userId);
  const dict = translations[lang] || translations[DEFAULT_LANG];
  let text = dict[key];
  if (typeof text === 'function') {
    text = text(...args);
  }
  return text || dict[key] || translations[DEFAULT_LANG][key] || key;
}

// ==================== HELPER FUNCTIONS ====================
function getDayOfWeekIndex(date = new Date()) {
  let day = date.getDay();
  return day === 0 ? 7 : day;
}

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// ==================== ICS IMPORT ====================
async function importICSFromUrl(userId, url) {
  try {
    const response = await fetch(url);
    const icsData = await response.text();
    return parseICSContent(userId, icsData, url);
  } catch (error) {
    return { success: false, message: t(userId, 'icsFail', error.message) };
  }
}

function parseICSContent(userId, icsContent, source) {
  const user = users.get(userId);
  if (!user) return { success: false, message: t(userId, 'userNotFound') };

  const parsed = ical.parseICS(icsContent);
  let addedCount = 0;

  for (const key in parsed) {
    const event = parsed[key];
    if (event.type === 'VEVENT' && event.start) {
      const startDate = new Date(event.start);
      const dayOfWeek = startDate.getDay() === 0 ? 7 : startDate.getDay();
      const startTimeStr = startDate.toTimeString().slice(0, 5);
      const endTimeStr = event.end ? new Date(event.end).toTimeString().slice(0, 5) : startTimeStr;

      const exists = user.schedule.some(s => 
        s.title === event.summary && s.startTime === startTimeStr && s.dayOfWeek === dayOfWeek
      );
      if (!exists) {
        user.schedule.push({
          id: uuidv4(),
          title: event.summary || 'Unnamed Class',
          description: event.description || '',
          startTime: startTimeStr,
          endTime: endTimeStr,
          dayOfWeek: dayOfWeek,
          location: event.location || '',
          type: 'lecture',
          sourceIcs: source,
        });
        addedCount++;
      }
    }
  }
  saveData();
  return { success: true, message: t(userId, 'icsSuccess', addedCount), count: addedCount };
}

// ==================== SCHEDULE MANAGEMENT ====================
function addClass(userId, classData) {
  const user = users.get(userId);
  if (!user) return false;
  const newClass = {
    id: uuidv4(),
    ...classData,
    dayOfWeek: parseInt(classData.dayOfWeek),
  };
  user.schedule.push(newClass);
  saveData();
  return true;
}

function getUserSchedule(userId, dayFilter = null) {
  const user = users.get(userId);
  if (!user) return [];
  if (dayFilter) {
    return user.schedule.filter(c => c.dayOfWeek === dayFilter).sort((a,b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  }
  return user.schedule.sort((a,b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
  });
}

// ==================== ASSIGNMENT MANAGEMENT ====================
function addAssignment(userId, title, description, dueDate) {
  const user = users.get(userId);
  if (!user) return false;
  const newAssignment = {
    id: uuidv4(),
    title,
    description: description || '',
    dueDate: new Date(dueDate).toISOString(),
    completed: false,
    createdAt: new Date().toISOString(),
  };
  user.assignments.push(newAssignment);
  saveData();
  return newAssignment;
}

function markAssignmentCompleted(userId, assignmentId) {
  const user = users.get(userId);
  if (!user) return false;
  const assignment = user.assignments.find(a => a.id === assignmentId);
  if (assignment && !assignment.completed) {
    assignment.completed = true;
    user.statistics.tasksCompleted++;
    saveData();
    return true;
  }
  return false;
}

function getUserAssignments(userId, showCompleted = false) {
  const user = users.get(userId);
  if (!user) return [];
  let filtered = user.assignments;
  if (!showCompleted) {
    filtered = filtered.filter(a => !a.completed);
  }
  return filtered.sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));
}

function updateStatistics(userId) {
  const user = users.get(userId);
  if (!user) return;
  const now = new Date();
  let overdue = 0;
  for (const a of user.assignments) {
    if (!a.completed && new Date(a.dueDate) < now) overdue++;
  }
  user.statistics.tasksOverdue = overdue;
  user.statistics.lastActive = new Date().toISOString();
  saveData();
}

// ==================== REMINDER SYSTEM ====================
async function sendVKMessage(userId, message, keyboard = null) {
  const payload = {
    user_id: userId,
    message: message,
    random_id: Math.floor(Math.random() * 1000000000),
    v: VK_API_VERSION,
    access_token: VK_ACCESS_TOKEN,
  };
  if (keyboard) {
    payload.keyboard = JSON.stringify(keyboard);
  }
  try {
    const response = await fetch('https://api.vk.com/method/messages.send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (data.error) console.error('VK API error:', data.error);
    return data;
  } catch (e) {
    console.error('Failed to send message:', e);
  }
}

async function checkClassReminders() {
  const now = new Date();
  const currentDay = getDayOfWeekIndex(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  for (const [userId, user] of users.entries()) {
    if (!user.settings.enableNotifications) continue;
    
    const todayClasses = user.schedule.filter(c => c.dayOfWeek === currentDay);
    for (const cls of todayClasses) {
      const classMinutes = timeToMinutes(cls.startTime);
      const reminderMinutes = user.settings.reminderMinutes;
      const timeUntilClass = classMinutes - currentMinutes;
      
      if (timeUntilClass === reminderMinutes || (timeUntilClass > 0 && timeUntilClass <= reminderMinutes && timeUntilClass > reminderMinutes - 2)) {
        if (!user._sentReminders) user._sentReminders = new Set();
        const reminderKey = `${currentDay}_${cls.id}_${now.toDateString()}`;
        if (!user._sentReminders.has(reminderKey)) {
          const message = t(userId, 'classReminder', cls.title, cls.startTime, cls.location);
          await sendVKMessage(userId, message);
          user.statistics.totalRemindersSent++;
          user._sentReminders.add(reminderKey);
          saveData();
        }
      }
    }
    
    const sortedToday = todayClasses.sort((a,b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    if (sortedToday.length > 0 && user.settings.firstClassAlarm) {
      const firstClass = sortedToday[0];
      const firstClassMinutes = timeToMinutes(firstClass.startTime);
      const timeUntilFirst = firstClassMinutes - currentMinutes;
      if (Math.abs(timeUntilFirst - 60) <= 1 && !user._sentFirstAlarm) {
        const alarmMsg = t(userId, 'firstClassAlarm', firstClass.title, firstClass.startTime);
        await sendVKMessage(userId, alarmMsg);
        user._sentFirstAlarm = true;
        saveData();
      }
      if (now.getHours() === 23 && now.getMinutes() > 50) {
        user._sentFirstAlarm = false;
        saveData();
      }
    }
  }
}

async function checkDeadlineReminders() {
  const now = new Date();
  for (const [userId, user] of users.entries()) {
    const upcoming = user.assignments.filter(a => !a.completed);
    for (const assignment of upcoming) {
      const due = new Date(assignment.dueDate);
      const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
      if (diffDays === 2 || diffDays === 1 || (diffDays === 0 && now.getHours() === 9)) {
        const remindMsg = t(userId, 'deadlineReminder', assignment.title, due.toLocaleDateString(), diffDays);
        await sendVKMessage(userId, remindMsg);
        user.statistics.totalRemindersSent++;
        saveData();
      }
    }
    updateStatistics(userId);
  }
}

// ==================== STATISTICS ====================
function getUserStatisticsReport(userId) {
  const user = users.get(userId);
  if (!user) return t(userId, 'userNotFound');
  
  updateStatistics(userId);
  const totalTasks = user.assignments.length;
  const completedTasks = user.statistics.tasksCompleted;
  const pendingTasks = totalTasks - completedTasks;
  const overdueTasks = user.statistics.tasksOverdue;
  const completionRate = totalTasks === 0 ? 0 : ((completedTasks / totalTasks) * 100).toFixed(1);
  const scheduleCount = user.schedule.length;
  const remindersSent = user.statistics.totalRemindersSent;
  
  return `${t(userId, 'statsTitle')}` +
    `${t(userId, 'statsClasses', scheduleCount)}\n` +
    `${t(userId, 'statsCompleted', completedTasks, totalTasks, completionRate)}\n` +
    `${t(userId, 'statsPending', pendingTasks)}\n` +
    `${t(userId, 'statsOverdue', overdueTasks)}\n` +
    `${t(userId, 'statsReminders', remindersSent)}\n` +
    `${t(userId, 'statsLastActive', new Date(user.statistics.lastActive).toLocaleString())}\n\n` +
    `${t(userId, 'statsProgress', completionRate)}`;
}

// ==================== VK KEYBOARDS (Multilingual) ====================
function getMainKeyboard(userId) {
  const tMain = (key) => {
    const lang = getUserLanguage(userId);
    const labels = {
      ru: { schedule: "📅 Расписание", tasks: "📝 Мои задания", stats: "📊 Статистика", settings: "⚙️ Настройки", help: "❓ Помощь" },
      en: { schedule: "📅 Schedule", tasks: "📝 My Tasks", stats: "📊 Statistics", settings: "⚙️ Settings", help: "❓ Help" },
      zh: { schedule: "📅 课程表", tasks: "📝 我的任务", stats: "📊 统计", settings: "⚙️ 设置", help: "❓ 帮助" }
    };
    return (labels[lang] || labels.en)[key];
  };
  
  return {
    "one_time": false,
    "buttons": [
      [{ "action": { "type": "text", "label": tMain("schedule"), "payload": "{\"command\":\"schedule\"}" }, "color": "primary" }],
      [{ "action": { "type": "text", "label": tMain("tasks"), "payload": "{\"command\":\"tasks\"}" }, "color": "primary" }],
      [{ "action": { "type": "text", "label": tMain("stats"), "payload": "{\"command\":\"stats\"}" }, "color": "positive" }],
      [{ "action": { "type": "text", "label": tMain("settings"), "payload": "{\"command\":\"settings\"}" }, "color": "secondary" }],
      [{ "action": { "type": "text", "label": tMain("help"), "payload": "{\"command\":\"help\"}" }, "color": "secondary" }]
    ]
  };
}

// ==================== COMMAND HANDLER ====================
async function handleMessage(userId, text, attachments) {
  // Auto-detect language for new users
  let user = users.get(userId);
  if (!user) {
    const detectedLang = detectLanguage(text);
    user = new UserData(userId, detectedLang);
    users.set(userId, user);
    saveData();
    await sendVKMessage(userId, t(userId, 'greeting'), getMainKeyboard(userId));
    return;
  }
  
  // Language change command
  if (text.startsWith('/lang')) {
    const parts = text.split(' ');
    if (parts[1] === 'ru' || parts[1] === 'en' || parts[1] === 'zh') {
      setUserLanguage(userId, parts[1]);
      await sendVKMessage(userId, t(userId, 'languageChanged'), getMainKeyboard(userId));
    } else {
      await sendVKMessage(userId, t(userId, 'currentLanguage'), getMainKeyboard(userId));
    }
    return;
  }
  
  // Process ICS file attachment
  if (attachments && attachments.length > 0) {
    const doc = attachments.find(a => a.type === 'doc' && a.doc?.ext === 'ics');
    if (doc) {
      const fileUrl = doc.doc.url;
      const result = await importICSFromUrl(userId, fileUrl);
      await sendVKMessage(userId, result.message, getMainKeyboard(userId));
      return;
    }
  }
  
  // Check for ICS URL in text
  const urlMatch = text.match(/(https?:\/\/[^\s]+\.ics)/i);
  if (urlMatch) {
    const result = await importICSFromUrl(userId, urlMatch[0]);
    await sendVKMessage(userId, result.message, getMainKeyboard(userId));
    return;
  }
  
  const lowerText = text.toLowerCase();
  const tHelper = (key, ...args) => t(userId, key, ...args);
  
  // Schedule view
  if (lowerText.includes('расписание') || lowerText.includes('schedule') || lowerText.includes('课程表') || text === '📅 Расписание' || text === '📅 Schedule' || text === '📅 课程表') {
    const schedule = getUserSchedule(userId);
    if (schedule.length === 0) {
      await sendVKMessage(userId, tHelper('scheduleEmpty'), getMainKeyboard(userId));
    } else {
      let msg = tHelper('scheduleTitle');
      const days = tHelper('days');
      for (let d = 1; d <= 7; d++) {
        const dayClasses = schedule.filter(c => c.dayOfWeek === d);
        if (dayClasses.length) {
          msg += `\n*${days[d-1]}*:\n`;
          for (const c of dayClasses) {
            msg += `  ${c.startTime} - ${c.endTime || '?'} | ${c.title} ${c.location ? `(@${c.location})` : ''}\n`;
          }
        }
      }
      await sendVKMessage(userId, msg, getMainKeyboard(userId));
    }
    return;
  }
  
  // Tasks view
  if (lowerText.includes('задания') || lowerText.includes('tasks') || lowerText.includes('任务') || text === '📝 Мои задания' || text === '📝 My Tasks' || text === '📝 我的任务') {
    const tasks = getUserAssignments(userId, false);
    if (tasks.length === 0) {
      await sendVKMessage(userId, tHelper('noActiveTasks'), getMainKeyboard(userId));
    } else {
      let msg = tHelper('tasksTitle');
      for (const t of tasks) {
        const due = new Date(t.dueDate);
        msg += `• ${t.title}\n  ⏰ ${tHelper('dueDate', due.toLocaleDateString())}\n  📝 ${t.description || '—'}\n  /done_${t.id}\n\n`;
      }
      await sendVKMessage(userId, msg, getMainKeyboard(userId));
    }
    return;
  }
  
  // Statistics
  if (lowerText.includes('статистика') || lowerText.includes('statistics') || lowerText.includes('统计') || text === '📊 Статистика' || text === '📊 Statistics' || text === '📊 统计') {
    const stats = getUserStatisticsReport(userId);
    await sendVKMessage(userId, stats, getMainKeyboard(userId));
    return;
  }
  
  // Settings
  if (lowerText.includes('настройки') || lowerText.includes('settings') || lowerText.includes('设置') || text === '⚙️ Настройки' || text === '⚙️ Settings' || text === '⚙️ 设置') {
    const settings = user.settings;
    const msg = `${tHelper('settingsTitle')}` +
      `${tHelper('settingsNotifications', settings.enableNotifications)}\n` +
      `${tHelper('settingsReminderMinutes', settings.reminderMinutes)}\n` +
      `${tHelper('settingsFirstAlarm', settings.firstClassAlarm)}\n\n` +
      `${tHelper('settingsCommands')}\n/lang - ${tHelper('changeLanguage')}`;
    await sendVKMessage(userId, msg, getMainKeyboard(userId));
    return;
  }
  
  // Help
  if (lowerText.includes('помощь') || lowerText.includes('help') || lowerText.includes('帮助') || text === '❓ Помощь' || text === '❓ Help' || text === '❓ 帮助') {
    await sendVKMessage(userId, tHelper('help'), getMainKeyboard(userId));
    return;
  }
  
  // Command parsing
  if (text.startsWith('/add_class')) {
    const parts = text.split(' ');
    if (parts.length >= 4) {
      const day = parseInt(parts[1]);
      const time = parts[2];
      const name = parts.slice(3).join(' ');
      const added = addClass(userId, { title: name, startTime: time, dayOfWeek: day });
      await sendVKMessage(userId, added ? tHelper('classAdded', name, day, time) : tHelper('userNotFound'), getMainKeyboard(userId));
    } else {
      await sendVKMessage(userId, tHelper('addClassUsage'), getMainKeyboard(userId));
    }
    return;
  }
  
  if (text.startsWith('/add_task')) {
    const match = text.match(/\/add_task (.+) (\d{4}-\d{2}-\d{2})(?: (.+))?/);
    if (match) {
      const title = match[1];
      const dueDate = match[2];
      const desc = match[3] || '';
      const task = addAssignment(userId, title, desc, dueDate);
      await sendVKMessage(userId, tHelper('taskAdded', title, dueDate), getMainKeyboard(userId));
    } else {
      await sendVKMessage(userId, tHelper('addTaskUsage'), getMainKeyboard(userId));
    }
    return;
  }
  
  if (text.startsWith('/done_')) {
    const taskId = text.substring(6);
    if (markAssignmentCompleted(userId, taskId)) {
      await sendVKMessage(userId, tHelper('taskCompleted'), getMainKeyboard(userId));
    } else {
      await sendVKMessage(userId, tHelper('taskNotFound'), getMainKeyboard(userId));
    }
    return;
  }
  
  if (text === '/stats') {
    const stats = getUserStatisticsReport(userId);
    await sendVKMessage(userId, stats, getMainKeyboard(userId));
    return;
  }
  
  if (text === '/remind_on') {
    user.settings.enableNotifications = true;
    saveData();
    await sendVKMessage(userId, tHelper('remindersOn'), getMainKeyboard(userId));
    return;
  }
  
  if (text === '/remind_off') {
    user.settings.enableNotifications = false;
    saveData();
    await sendVKMessage(userId, tHelper('remindersOff'), getMainKeyboard(userId));
    return;
  }
  
  if (text.startsWith('/set_remind_time')) {
    const minutes = parseInt(text.split(' ')[1]);
    if (!isNaN(minutes) && minutes >= 5 && minutes <= 120) {
      user.settings.reminderMinutes = minutes;
      saveData();
      await sendVKMessage(userId, tHelper('reminderTimeSet', minutes), getMainKeyboard(userId));
    } else {
      await sendVKMessage(userId, tHelper('invalidTime'), getMainKeyboard(userId));
    }
    return;
  }
  
  if (text === '/alarm_first on') {
    user.settings.firstClassAlarm = true;
    saveData();
    await sendVKMessage(userId, tHelper('firstAlarmOn'), getMainKeyboard(userId));
    return;
  }
  
  if (text === '/alarm_first off') {
    user.settings.firstClassAlarm = false;
    saveData();
    await sendVKMessage(userId, tHelper('firstAlarmOff'), getMainKeyboard(userId));
    return;
  }
  
  // Default: unknown command
  await sendVKMessage(userId, tHelper('unknownCommand'), getMainKeyboard(userId));
}

// Add missing translation keys
translations.ru.firstAlarmOn = "🌅 Напоминание за 60 мин до первой пары включено";
translations.ru.firstAlarmOff = "🌅 Напоминание за 60 мин до первой пары выключено";
translations.ru.dueDate = "до";
translations.ru.changeLanguage = "сменить язык";

translations.en.firstAlarmOn = "🌅 60-minute first class alarm enabled";
translations.en.firstAlarmOff = "🌅 60-minute first class alarm disabled";
translations.en.dueDate = "due";
translations.en.changeLanguage = "change language";

translations.zh.firstAlarmOn = "🌅 第一节课前60分钟提醒已开启";
translations.zh.firstAlarmOff = "🌅 第一节课前60分钟提醒已关闭";
translations.zh.dueDate = "截止";
translations.zh.changeLanguage = "切换语言";

// ==================== WEBHOOK SERVER ====================
const app = express();
app.use(express.json());

app.post('/webhook', async (req, res) => {
  const { type, object, group_id, secret } = req.body;
  
  if (type === 'confirmation') {
    return res.send(VK_CONFIRMATION_CODE);
  }
  
  if (type === 'message_new') {
    const userId = object.message.from_id;
    const text = object.message.text || '';
    const attachments = object.message.attachments || [];
    
    handleMessage(userId, text, attachments).catch(console.error);
    res.send('ok');
  } else {
    res.send('ok');
  }
});

// ==================== CRON JOBS ====================
cron.schedule('* * * * *', () => {
  checkClassReminders().catch(console.error);
});

cron.schedule('0 9 * * *', () => {
  checkDeadlineReminders().catch(console.error);
});

cron.schedule('*/5 * * * *', () => {
  saveData();
});

// ==================== START SERVER ====================
loadData();
app.listen(PORT, () => {
  console.log(`VK Smart Hour Bot (Multilingual) running on port ${PORT}`);
  console.log(`Supported languages: Russian, English, Chinese (auto-detect)`);
  console.log(`Set VK Callback URL to: https://your-domain.com/webhook`);
});