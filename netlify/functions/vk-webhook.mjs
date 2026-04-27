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

// ========== CACHING SYSTEM ==========
const cache = new Map();
const userStates = new Map();
const userReminderSettings = new Map();

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
function detectLanguage(text) {
  if (!text) return 'en';
  
  // Priority: Check for Cyrillic (Russian)
  if (/[а-яА-ЯёЁ]/.test(text)) return 'ru';
  
  // Check for other languages
  const langPatterns = {
    es: /[áéíóúñ¿¡]/i,
    de: /[äöüß]/i,
    fr: /[éèêëàâæôœûùçîï]/i,
    it: /[àèéìíîòóùú]/i
  };
  
  for (const [lang, pattern] of Object.entries(langPatterns)) {
    if (pattern.test(text)) return lang;
  }
  
  return 'en';
}

// ========== COMPLETE MULTILINGUAL RESPONSES ==========
const RESPONSES = {
  en: {
    // Greetings & Onboarding
    ask_name: "👋 Hello! I'm your personal assistant. What's your name?",
    got_name: "🎉 Nice to meet you {name}! I'll help you manage your schedule, tasks, and attendance.\n\nWhat would you like to do?",
    greeting: "👋 Welcome back {name}! Ready to stay organized?",
    morning: "🌅 Good morning {name}! Ready for a productive day?",
    afternoon: "☀️ Good afternoon {name}! How's your day going?",
    evening: "🌙 Good evening {name}! Wrapping up your day?",
    
    // Schedule
    schedule_today: "📅 **Today's Schedule** ({date})\n\n{classes}💡 *Reply with class number to mark attendance*",
    schedule_tomorrow: "📅 **Tomorrow's Schedule** ({date})\n\n{classes}",
    no_classes: "🎉 No classes today {name}! Great time to catch up on tasks!",
    no_classes_tomorrow: "🎉 No classes tomorrow {name}! Enjoy your break!",
    
    // Next Class & Reminders
    next_class: "⏰ **Next Class:** {subject}\n🕐 {time}\n📍 {location}\n⏱️ In {minutes} minutes\n\n*I'll remind you {reminder_minutes} minutes before!*",
    no_next_class: "🎉 No more classes today {name}! Time to relax or work on tasks!",
    class_reminder: "⏰ **CLASS REMINDER!**\n\n📚 {subject}\n🕐 {time}\n📍 {location}\n⏱️ Starts in {minutes} minutes!\n\n✅ Reply 'attend {subject}' to mark attendance after class!",
    reminder_updated: "✅ Reminder time updated! I'll remind you {minutes} minutes before each class.",
    current_reminder: "🔔 Current reminder setting: {minutes} minutes before each class.\n\nUse /reminder <minutes> to change (5-120 minutes)",
    
    // Tasks
    tasks_header: "📋 **Your Tasks** ({pending} pending, {completed} completed)\n\n{tasks}💬 *Reply 'done [task name]' or 'complete [task name]' to mark as done*\n📊 *Say 'stats' to see your progress*",
    no_tasks: "✅ Amazing {name}! No pending tasks! 🎉\n\n📊 *Say 'stats' to see your achievements*",
    task_added: "✅ Added: **{task}**\n📅 Due: {due_date}\n🔔 Reminder: {days} day(s) before\n⚡ Priority: {priority}\n\n*Say 'my tasks' to see all tasks*",
    task_completed: "🎉 Fantastic {name}! Completed: **{task}**\n\n📊 Your productivity score increased! Say 'stats' to see!",
    task_deleted: "🗑️ Removed: **{task}** from your list",
    task_not_found: "❌ Couldn't find task matching '{task}'\n\n💬 Try: 'done {exact task name}' or check 'my tasks' for the exact name",
    task_format_error: "❌ Invalid format!\n\n📝 Use: /task \"Task name\" YYYY-MM-DD HH:MM days [priority]\n\nExample: /task \"Submit homework\" 2025-12-20 23:59 3 high",
    
    // Attendance
    attendance_prompt: "📚 **Mark Attendance**\n\nToday's classes:\n{classes}\n\nReply with the number (1-{count}) or class name:",
    attendance_marked: "✅ Marked **{class_name}** as attended {name}!\n📈 Attendance updated!\n\n{streak_message}",
    attendance_streak: "🔥 You've attended {streak} classes in a row! Keep it up!",
    already_marked: "ℹ️ You've already marked attendance for {class_name} today!",
    no_classes_attendance: "📭 No classes today {name}! Check your tasks instead?",
    
    // Statistics
    stats_header: "📊 **PERFORMANCE DASHBOARD** 📊\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n",
    task_stats: "📝 **TASKS**\n• ✅ Completed: {completed}\n• ⏳ Pending: {pending}\n• 🎯 Completion Rate: {rate}%\n   [{bar}]",
    attendance_stats: "📚 **ATTENDANCE**\n• 📖 Total Classes: {total}\n• ✅ Attended: {attended}\n• ❌ Missed: {missed}\n• 📈 Rate: {rate}%\n   [{bar}]",
    study_stats: "⏱️ **STUDY TIME**\n• 📅 Today: {today} min\n• 📆 This Week: {week} min\n• 🏆 Total: {total} min\n• 💪 Daily Avg: {avg} min",
    motivation: "💡 **INSIGHT**\n{message}",
    
    // ICS Import
    import_instructions: "📥 **Import Schedule**\n\nSend me:\n• An ICS file attachment\n• A link to an ICS calendar\n• Or use: /ics <url>\n\nI'll automatically add all your classes with reminders!",
    import_progress: "⏳ Processing your calendar... This may take a moment.",
    import_success: "🎉 Successfully imported **{count}** classes {name}!\n\n✅ Reminders set {reminder_minutes} minutes before each class\n📅 Say 'today' to see your schedule\n📊 Say 'stats' to track progress!",
    import_fail: "❌ Failed to import calendar. Make sure it's a valid ICS file.\n\n💡 Try: Send the .ics file directly or check the link format.",
    file_import_success: "📁 Imported {count} classes from your file!",
    
    // Natural Language Commands
    help_text: "🤖 **What I Can Do**\n\n📅 **SCHEDULE**\n• 'today' or 'what's today' - Today's classes\n• 'tomorrow' - Tomorrow's classes\n• 'next class' - Next upcoming class\n• Send ICS file - Import timetable\n\n✅ **ATTENDANCE**\n• 'mark attendance' - Mark today's classes\n• 'attend [class name]' - Quick mark\n\n📝 **TASKS**\n• 'my tasks' - See pending tasks\n• '/task \"Task\" 2025-12-20 23:59 3 high'\n• 'done [task name]' - Complete task\n\n⚙️ **REMINDERS**\n• '/reminder 45' - Set class reminder (5-120 min)\n• 'reminder settings' - Check current\n\n📊 **STATISTICS**\n• 'stats' or 'statistics' - Full report\n\n📥 **IMPORT**\n• Attach .ics file\n• /ics [calendar-url]\n\n💬 **Just type naturally - I understand!**",
    
    // Settings
    reminder_settings: "⚙️ **Reminder Settings**\n\nCurrent: {minutes} minutes before class\nRange: 5 - 120 minutes\n\nUse /reminder <minutes> to change\nExample: /reminder 45",
    
    // Dynamic Responses
    time_status: "🕐 {time}\n📅 {date}\n\n{next_class_info}\n📝 Pending tasks: {pending_tasks}\n📊 Attendance: {attendance}%",
    weekly_report: "📊 **Weekly Report**\n\n📚 Classes: {attended}/{total} ({rate}%)\n📝 Tasks: {tasks_done}/{total_tasks}\n⏱️ Study: {study_hours}h\n\n{encouragement}",
    
    // Errors & Fallbacks
    unknown: "🤔 I understand you're asking about something.\n\nTry one of these:\n• 'today' - See schedule\n• 'my tasks' - See pending tasks\n• 'stats' - View progress\n• 'help' - All commands",
    error: "❌ Sorry {name}, something went wrong. Please try again or say 'help'",
    
    // Responses
    thanks: "😊 You're welcome {name}! Anything else I can help with?",
    joke: "😂 Here's a joke for you {name}:\n\n{joke}",
    quote: "📖 \"{quote}\"\n— {author}"
  },
  
  ru: {
    ask_name: "👋 Привет! Я твой персональный помощник. Как тебя зовут?",
    got_name: "🎉 Приятно познакомиться {name}! Я помогу тебе с расписанием, задачами и посещаемостью.\n\nЧто хочешь сделать?",
    greeting: "👋 С возвращением {name}! Готов к продуктивному дню?",
    morning: "🌅 Доброе утро {name}! Готов к продуктивному дню?",
    afternoon: "☀️ Добрый день {name}! Как проходит твой день?",
    evening: "🌙 Добрый вечер {name}! Завершаешь день?",
    
    schedule_today: "📅 **Расписание на сегодня** ({date})\n\n{classes}💡 *Ответь номером пары чтобы отметить посещение*",
    schedule_tomorrow: "📅 **Расписание на завтра** ({date})\n\n{classes}",
    no_classes: "🎉 Сегодня нет пар {name}! Отличное время для задач!",
    no_classes_tomorrow: "🎉 Завтра нет пар {name}! Отдыхай!",
    
    next_class: "⏰ **Следующая пара:** {subject}\n🕐 {time}\n📍 {location}\n⏱️ Через {minutes} минут\n\n*Напомню за {reminder_minutes} минут!*",
    no_next_class: "🎉 На сегодня пар больше нет {name}! Время для задач или отдыха!",
    class_reminder: "⏰ **НАПОМИНАНИЕ О ПАРЕ!**\n\n📚 {subject}\n🕐 {time}\n📍 {location}\n⏱️ Начинается через {minutes} минут!\n\n✅ Ответь 'отметить {subject}' чтобы отметить посещение!",
    reminder_updated: "✅ Напоминание обновлено! Буду напоминать за {minutes} минут до пары.",
    current_reminder: "🔔 Текущая настройка: {minutes} минут до пары.\n\nИспользуй /reminder <минуты> чтобы изменить (5-120 минут)",
    
    tasks_header: "📋 **Твои задачи** ({pending} активных, {completed} выполнено)\n\n{tasks}💬 *Ответь 'готово [задача]' чтобы отметить выполненной*\n📊 *Скажи 'статистика' чтобы увидеть прогресс*",
    no_tasks: "✅ Отлично {name}! Нет активных задач! 🎉\n\n📊 *Скажи 'статистика' чтобы увидеть достижения*",
    task_added: "✅ Добавлено: **{task}**\n📅 Дедлайн: {due_date}\n🔔 Напомню за {days} дн.\n⚡ Приоритет: {priority}\n\n*Скажи 'мои задачи' чтобы увидеть список*",
    task_completed: "🎉 Молодец {name}! Выполнено: **{task}**\n\n📊 Твоя продуктивность выросла! Скажи 'статистика'!",
    task_deleted: "🗑️ Удалено: **{task}** из списка",
    task_not_found: "❌ Не могу найти задачу '{task}'\n\n💬 Попробуй: 'готово {точное название}' или посмотри 'мои задачи'",
    task_format_error: "❌ Неверный формат!\n\n📝 Используй: /task \"Название\" ГГГГ-ММ-ДД ЧЧ:ММ дни [приоритет]\n\nПример: /task \"Сдать дз\" 2025-12-20 23:59 3 high",
    
    attendance_prompt: "📚 **Отметить посещение**\n\nПары сегодня:\n{classes}\n\nОтветь номером (1-{count}) или названием пары:",
    attendance_marked: "✅ Отмечено **{class_name}** как посещённое {name}!\n📈 Посещаемость обновлена!\n\n{streak_message}",
    attendance_streak: "🔥 Ты посетил {streak} пар(ы) подряд! Так держать!",
    already_marked: "ℹ️ Ты уже отметил {class_name} сегодня!",
    no_classes_attendance: "📭 Сегодня нет пар {name}! Проверь задачи?",
    
    stats_header: "📊 **ПАНЕЛЬ ПРОГРЕССА** 📊\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n",
    task_stats: "📝 **ЗАДАЧИ**\n• ✅ Выполнено: {completed}\n• ⏳ Ожидает: {pending}\n• 🎯 Процент: {rate}%\n   [{bar}]",
    attendance_stats: "📚 **ПОСЕЩАЕМОСТЬ**\n• 📖 Всего пар: {total}\n• ✅ Посещено: {attended}\n• ❌ Пропущено: {missed}\n• 📈 Процент: {rate}%\n   [{bar}]",
    study_stats: "⏱️ **ВРЕМЯ УЧЁБЫ**\n• 📅 Сегодня: {today} мин\n• 📆 На неделе: {week} мин\n• 🏆 Всего: {total} мин\n• 💪 В день: {avg} мин",
    motivation: "💡 **ИНСАЙТ**\n{message}",
    
    import_instructions: "📥 **Импорт расписания**\n\nОтправь мне:\n• ICS файл\n• Ссылку на ICS календарь\n• Или используй: /ics <ссылка>\n\nЯ автоматически добавлю все пары с напоминаниями!",
    import_progress: "⏳ Обрабатываю календарь... Подожди немного.",
    import_success: "🎉 Успешно импортировано **{count}** пар(ы) {name}!\n\n✅ Напоминания за {reminder_minutes} минут до каждой пары\n📅 Скажи 'сегодня' чтобы увидеть расписание\n📊 Скажи 'статистика' чтобы отслеживать прогресс!",
    import_fail: "❌ Не удалось импортировать календарь. Убедись что это правильный ICS файл.\n\n💡 Попробуй: Отправить .ics файл напрямую или проверь ссылку.",
    file_import_success: "📁 Импортировано {count} пар(ы) из твоего файла!",
    
    help_text: "🤖 **Что я умею**\n\n📅 **РАСПИСАНИЕ**\n• 'сегодня' - Пары на сегодня\n• 'завтра' - Пары на завтра\n• 'следующая пара' - Ближайшая пара\n• Отправь ICS файл - Импорт\n\n✅ **ПОСЕЩАЕМОСТЬ**\n• 'отметить пару' - Отметить пары\n• 'отметить [название]' - Быстрая отметка\n\n📝 **ЗАДАЧИ**\n• 'мои задачи' - Список задач\n• '/task \"Задача\" 2025-12-20 23:59 3 high'\n• 'готово [задача]' - Выполнить\n\n⚙️ **НАПОМИНАНИЯ**\n• '/reminder 45' - Установить (5-120 мин)\n• 'настройки напоминаний'\n\n📊 **СТАТИСТИКА**\n• 'статистика' - Полный отчёт\n\n📥 **ИМПОРТ**\n• Прикрепи .ics файл\n• /ics [ссылка]\n\n💬 **Говори естественно - я понимаю!**",
    
    reminder_settings: "⚙️ **Настройки напоминаний**\n\nСейчас: {minutes} минут до пары\nДиапазон: 5 - 120 минут\n\nИспользуй /reminder <минуты> чтобы изменить\nПример: /reminder 45",
    
    time_status: "🕐 {time}\n📅 {date}\n\n{next_class_info}\n📝 Активных задач: {pending_tasks}\n📊 Посещаемость: {attendance}%",
    weekly_report: "📊 **Отчёт за неделю**\n\n📚 Пары: {attended}/{total} ({rate}%)\n📝 Задачи: {tasks_done}/{total_tasks}\n⏱️ Учёба: {study_hours}ч\n\n{encouragement}",
    
    unknown: "🤔 Я вижу ты спрашиваешь о чём-то.\n\nПопробуй:\n• 'сегодня' - Расписание\n• 'мои задачи' - Список задач\n• 'статистика' - Прогресс\n• 'помощь' - Все команды",
    error: "❌ Извини {name}, что-то пошло не так. Попробуй ещё раз или скажи 'помощь'",
    
    thanks: "😊 Пожалуйста {name}! Ещё чем-то помочь?",
    joke: "😂 Шутка для тебя {name}:\n\n{joke}",
    quote: "📖 \"{quote}\"\n— {author}"
  }
};

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
    console.error("sendMessage error:", error.message);
    return null;
  }
}

// ========== KEYBOARD BUILDERS ==========
function getMainKeyboard(lang) {
  if (lang === 'ru') {
    return JSON.stringify({
      one_time: false,
      buttons: [
        [{ action: { type: "text", label: "📅 Сегодня" }, color: "primary" }, { action: { type: "text", label: "📅 Завтра" }, color: "primary" }],
        [{ action: { type: "text", label: "⏰ Следующая" }, color: "secondary" }, { action: { type: "text", label: "📝 Задачи" }, color: "positive" }],
        [{ action: { type: "text", label: "✅ Отметить" }, color: "positive" }, { action: { type: "text", label: "📊 Статистика" }, color: "secondary" }],
        [{ action: { type: "text", label: "📥 Импорт" }, color: "primary" }, { action: { type: "text", label: "❓ Помощь" }, color: "secondary" }]
      ]
    });
  }
  
  return JSON.stringify({
    one_time: false,
    buttons: [
      [{ action: { type: "text", label: "📅 Today" }, color: "primary" }, { action: { type: "text", label: "📅 Tomorrow" }, color: "primary" }],
      [{ action: { type: "text", label: "⏰ Next" }, color: "secondary" }, { action: { type: "text", label: "📝 Tasks" }, color: "positive" }],
      [{ action: { type: "text", label: "✅ Mark" }, color: "positive" }, { action: { type: "text", label: "📊 Stats" }, color: "secondary" }],
      [{ action: { type: "text", label: "📥 Import" }, color: "primary" }, { action: { type: "text", label: "❓ Help" }, color: "secondary" }]
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

async function getUserReminderOffset(userId) {
  try {
    const cacheKey = `reminder_${userId}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const { data } = await supabase
      .from("users")
      .select("reminder_offset")
      .eq("vk_id", userId)
      .single();
    const offset = data?.reminder_offset || 60;
    setCached(cacheKey, offset);
    return offset;
  } catch (error) {
    return 60;
  }
}

async function setUserReminderOffset(userId, minutes) {
  try {
    minutes = Math.min(120, Math.max(5, minutes));
    await supabase
      .from("users")
      .upsert({ vk_id: userId, reminder_offset: minutes }, { onConflict: "vk_id" });
    setCached(`reminder_${userId}`, minutes);
    return true;
  } catch (error) {
    console.error("setUserReminderOffset error:", error.message);
    return false;
  }
}

// Schedule Functions
async function addClass(userId, subject, day, startTime, endTime, location = '') {
  try {
    const { error } = await supabase.from("schedule").insert({
      user_id: userId,
      subject,
      day,
      start_time: startTime,
      end_time: endTime,
      location
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

async function getNextClass(userId) {
  const now = new Date();
  const currentDay = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  const schedule = await getSchedule(userId);
  const sorted = [...schedule].sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    return a.start_time.localeCompare(b.start_time);
  });
  
  for (const cls of sorted) {
    const [hours, minutes] = cls.start_time.split(':').map(Number);
    const classMinutes = hours * 60 + minutes;
    
    if (cls.day > currentDay || (cls.day === currentDay && classMinutes > currentMinutes)) {
      return cls;
    }
  }
  
  return sorted.length > 0 ? sorted[0] : null;
}

// Task Functions
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
      await supabase
        .from("daily_stats")
        .update({ tasks_completed: (daily.tasks_completed || 0) + 1 })
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
      const result = { pending: 0, completed: 0, rate: 0 };
      setCached(cacheKey, result);
      return result;
    }

    const pending = tasks.filter(t => t.done === 0).length;
    const completed = tasks.filter(t => t.done === 1).length;
    const rate = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

    const result = { pending, completed, rate };
    setCached(cacheKey, result);
    return result;
  } catch (error) {
    console.error("getTaskStats error:", error.message);
    return { pending: 0, completed: 0, rate: 0 };
  }
}

// Attendance Functions
async function markAttended(userId, className) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Check if already marked
    const { data: existing } = await supabase
      .from("class_attendance")
      .select("id")
      .eq("user_id", userId)
      .eq("class_name", className)
      .eq("date", today)
      .single();
    
    if (existing) {
      return { success: false, alreadyMarked: true };
    }
    
    const { error } = await supabase.from("class_attendance").insert({
      user_id: userId,
      class_name: className,
      date: today,
      attended: 1,
      missed: 0
    });
    
    if (error) throw error;
    
    // Get streak count
    const { data: streak } = await supabase
      .from("class_attendance")
      .select("date")
      .eq("user_id", userId)
      .eq("attended", 1)
      .order("date", { ascending: false })
      .limit(5);
    
    let streakCount = 0;
    let expectedDate = new Date(today);
    for (const record of streak || []) {
      const recordDate = new Date(record.date);
      const diffDays = Math.floor((expectedDate - recordDate) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        streakCount++;
        expectedDate = recordDate;
      } else if (diffDays === 0) {
        continue;
      } else {
        break;
      }
    }
    
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
        .update({ classes_attended: (daily.classes_attended || 0) + 1 })
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
    return { success: true, alreadyMarked: false, streak: streakCount };
  } catch (error) {
    console.error("markAttended error:", error.message);
    return { success: false, alreadyMarked: false };
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

// Study Functions
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
        .update({ study_minutes: (daily.study_minutes || 0) + duration })
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
    
    if (!sessions || sessions.length === 0) {
      return { total: 0, weekly: 0, today: 0, avg: 0 };
    }
    
    const total = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const weekly = sessions.filter(s => s.date >= weekAgoStr).reduce((sum, s) => sum + (s.duration || 0), 0);
    const todayStudy = sessions.filter(s => s.date === today).reduce((sum, s) => sum + (s.duration || 0), 0);
    const avg = Math.round(weekly / 7);
    
    return { total, weekly, today: todayStudy, avg };
  } catch (error) {
    console.error("getStudyStats error:", error.message);
    return { total: 0, weekly: 0, today: 0, avg: 0 };
  }
}

async function getClassCount(userId) {
  const schedule = await getSchedule(userId);
  return schedule.length;
}

// ========== ICS IMPORT FUNCTIONS ==========
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
          currentEvent.subject = trimmed.substring(8).replace(/\\,/g, ',').replace(/\\n/g, ' ').trim();
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
          currentEvent.location = trimmed.substring(9).replace(/\\,/g, ',').replace(/\\n/g, ' ').trim();
        } else if (trimmed.startsWith('DESCRIPTION:')) {
          description = trimmed.substring(12);
        } else if (description && trimmed && !trimmed.includes(':')) {
          description += ' ' + trimmed;
        }
      }
    }
    
    let addedCount = 0;
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    for (const event of events) {
      if (!event.subject || event.subject === '') continue;
      
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
        
        if (event.endDateTime) {
          const endTimeStr = event.endDateTime.substring(9, 15);
          const endHour = parseInt(endTimeStr.substring(0, 2));
          const endMinute = parseInt(endTimeStr.substring(2, 4));
          endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
        }
      } else if (event.startDate && !event.startDateTime) {
        const dateStr = event.startDate;
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6));
        const day = parseInt(dateStr.substring(6, 8));
        const date = new Date(year, month - 1, day);
        dayOfWeek = date.getDay() === 0 ? 6 : date.getDay() - 1;
      }
      
      const location = event.location || '';
      
      const success = await addClass(userId, event.subject, dayOfWeek, startTime, endTime, location);
      if (success) addedCount++;
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
      const offset = user.reminder_offset || 60;
      const lang = user.language || 'en';
      const name = user.name || 'friend';
      
      for (const cls of schedule) {
        if (cls.day !== currentDay) continue;
        
        const [hours, minutes] = cls.start_time.split(':').map(Number);
        const classMinutes = hours * 60 + minutes;
        const reminderMinutes = classMinutes - offset;
        
        // Check if within reminder window (offset +/- 2 minutes)
        if (reminderMinutes <= currentMinutes && currentMinutes <= reminderMinutes + 2) {
          const key = `reminder_${user.vk_id}_${currentDay}_${cls.start_time}_${now.toDateString()}`;
          
          const { data: existing } = await supabase
            .from("reminders")
            .select("key")
            .eq("key", key)
            .single();
          
          if (!existing) {
            const minutesUntil = classMinutes - currentMinutes;
            
            let msg = RESPONSES[lang].class_reminder || RESPONSES.en.class_reminder;
            msg = msg.replace('{subject}', cls.subject)
                     .replace('{time}', cls.start_time)
                     .replace('{location}', cls.location || 'Classroom')
                     .replace('{minutes}', minutesUntil);
            
            await sendMessage(user.vk_id, msg, getMainKeyboard(lang));
            
            await supabase.from("reminders").insert({ 
              key, 
              user_id: user.vk_id, 
              sent: 1, 
              reminder_date: now 
            });
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
  reminderInterval = setInterval(checkAndSendReminders, 60000); // Check every minute
}

// ========== MESSAGE HANDLER ==========
function getResponse(lang, key, vars = {}) {
  let text = RESPONSES[lang]?.[key] || RESPONSES.en[key] || key;
  Object.entries(vars).forEach(([k, v]) => {
    text = text.replace(new RegExp(`{${k}}`, 'g'), v);
  });
  return text;
}

async function handleMessage(userId, text, attachments, lang) {
  try {
    const name = await getUserName(userId);
    const displayName = name || 'friend';
    const lowerText = text.toLowerCase().trim();
    
    // FIRST TIME USER - Ask for name
    if (!name && !lowerText.match(/(my name is|call me|меня зовут|зовут|i am|я -|я )/)) {
      await sendMessage(userId, getResponse(lang, 'ask_name'), getMainKeyboard(lang));
      return;
    }
    
    // Extract name from introduction
    const nameMatch = text.match(/(?:my name is|call me|меня зовут|зовут|i am|я -|я )\s+([A-Za-zА-Яа-яёЁ]+)/i);
    if (nameMatch && !name) {
      const newName = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1).toLowerCase();
      await setUserName(userId, newName);
      await sendMessage(userId, getResponse(lang, 'got_name', { name: newName }), getMainKeyboard(lang));
      return;
    }
    
    // ========== CLASS REMINDER SETTINGS ==========
    if (text.startsWith('/reminder')) {
      const parts = text.split(/\s+/);
      if (parts.length >= 2) {
        const minutes = parseInt(parts[1]);
        if (!isNaN(minutes) && minutes >= 5 && minutes <= 120) {
          await setUserReminderOffset(userId, minutes);
          await sendMessage(userId, getResponse(lang, 'reminder_updated', { minutes }), getMainKeyboard(lang));
        } else {
          await sendMessage(userId, getResponse(lang, 'reminder_settings', { minutes: await getUserReminderOffset(userId) }), getMainKeyboard(lang));
        }
      } else {
        const current = await getUserReminderOffset(userId);
        await sendMessage(userId, getResponse(lang, 'reminder_settings', { minutes: current }), getMainKeyboard(lang));
      }
      return;
    }
    
    // ========== TODAY'S SCHEDULE ==========
    if (text === "📅 Today" || text === "📅 Сегодня" || lowerText.includes('today') || lowerText.includes('сегодня')) {
      const classes = await getTodayClasses(userId);
      if (classes.length === 0) {
        await sendMessage(userId, getResponse(lang, 'no_classes', { name: displayName }), getMainKeyboard(lang));
      } else {
        const dayNames = lang === 'ru' ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        let classList = '';
        for (let i = 0; i < classes.length; i++) {
          const cls = classes[i];
          classList += `${i+1}. **${cls.subject}** • ${cls.start_time}-${cls.end_time}\n`;
          if (cls.location) classList += `   📍 ${cls.location}\n`;
          classList += '\n';
        }
        const today = new Date().toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        await sendMessage(userId, getResponse(lang, 'schedule_today', { date: today, classes: classList }), getMainKeyboard(lang));
      }
      return;
    }
    
    // ========== TOMORROW'S SCHEDULE ==========
    if (text === "📅 Tomorrow" || text === "📅 Завтра" || lowerText.includes('tomorrow') || lowerText.includes('завтра')) {
      const classes = await getTomorrowClasses(userId);
      if (classes.length === 0) {
        await sendMessage(userId, getResponse(lang, 'no_classes_tomorrow', { name: displayName }), getMainKeyboard(lang));
      } else {
        let classList = '';
        for (let i = 0; i < classes.length; i++) {
          const cls = classes[i];
          classList += `${i+1}. **${cls.subject}** • ${cls.start_time}-${cls.end_time}\n`;
          if (cls.location) classList += `   📍 ${cls.location}\n`;
          classList += '\n';
        }
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        await sendMessage(userId, getResponse(lang, 'schedule_tomorrow', { date: dateStr, classes: classList }), getMainKeyboard(lang));
      }
      return;
    }
    
    // ========== NEXT CLASS ==========
    if (text === "⏰ Next" || text === "⏰ Следующая" || lowerText.includes('next class') || lowerText.includes('следующая пара') || lowerText.includes("what's next")) {
      const nextClass = await getNextClass(userId);
      const reminderOffset = await getUserReminderOffset(userId);
      if (nextClass) {
        const now = new Date();
        const [hours, minutes] = nextClass.start_time.split(':').map(Number);
        let minutesUntil = (hours * 60 + minutes) - (now.getHours() * 60 + now.getMinutes());
        minutesUntil = Math.max(0, minutesUntil);
        
        await sendMessage(userId, getResponse(lang, 'next_class', {
          subject: nextClass.subject,
          time: nextClass.start_time,
          location: nextClass.location || 'Classroom',
          minutes: minutesUntil,
          reminder_minutes: reminderOffset
        }), getMainKeyboard(lang));
      } else {
        await sendMessage(userId, getResponse(lang, 'no_next_class', { name: displayName }), getMainKeyboard(lang));
      }
      return;
    }
    
    // ========== MARK ATTENDANCE BUTTON ==========
    if (text === "✅ Mark" || text === "✅ Отметить" || lowerText.includes('mark attendance') || lowerText.includes('отметить пару')) {
      const classes = await getTodayClasses(userId);
      if (classes.length === 0) {
        await sendMessage(userId, getResponse(lang, 'no_classes_attendance', { name: displayName }), getMainKeyboard(lang));
      } else {
        let classList = '';
        for (let i = 0; i < classes.length; i++) {
          classList += `${i+1}. ${classes[i].subject}\n`;
        }
        await sendMessage(userId, getResponse(lang, 'attendance_prompt', { classes: classList, count: classes.length }), getMainKeyboard(lang));
        userStates.set(userId, { mode: 'attendance', classes });
        
        // Auto-clear state after 2 minutes
        setTimeout(() => { if (userStates.get(userId)?.mode === 'attendance') userStates.delete(userId); }, 120000);
      }
      return;
    }
    
    // Handle attendance by number (from prompt)
    if (/^\d+$/.test(text) && text.length <= 2) {
      const state = userStates.get(userId);
      if (state?.mode === 'attendance') {
        const idx = parseInt(text) - 1;
        if (idx >= 0 && idx < state.classes.length) {
          const className = state.classes[idx].subject;
          const result = await markAttended(userId, className);
          
          if (result.alreadyMarked) {
            await sendMessage(userId, getResponse(lang, 'already_marked', { class_name: className }), getMainKeyboard(lang));
          } else {
            const streakMsg = result.streak > 0 ? getResponse(lang, 'attendance_streak', { streak: result.streak + 1 }) : '';
            await sendMessage(userId, getResponse(lang, 'attendance_marked', { 
              class_name: className, 
              name: displayName,
              streak_message: streakMsg
            }), getMainKeyboard(lang));
          }
          userStates.delete(userId);
          return;
        }
      }
    }
    
    // Handle attendance by class name mention
    const todayClasses = await getTodayClasses(userId);
    for (const cls of todayClasses) {
      if (lowerText.includes(cls.subject.toLowerCase())) {
        const result = await markAttended(userId, cls.subject);
        if (result.alreadyMarked) {
          await sendMessage(userId, getResponse(lang, 'already_marked', { class_name: cls.subject }), getMainKeyboard(lang));
        } else {
          const streakMsg = result.streak > 0 ? getResponse(lang, 'attendance_streak', { streak: result.streak + 1 }) : '';
          await sendMessage(userId, getResponse(lang, 'attendance_marked', { 
            class_name: cls.subject, 
            name: displayName,
            streak_message: streakMsg
          }), getMainKeyboard(lang));
        }
        return;
      }
    }
    
    // ========== TASKS BUTTON ==========
    if (text === "📝 Tasks" || text === "📝 Задачи" || lowerText.includes('my tasks') || lowerText.includes('мои задачи')) {
      const tasks = await getTasks(userId, true);
      const stats = await getTaskStats(userId);
      
      if (tasks.length === 0) {
        await sendMessage(userId, getResponse(lang, 'no_tasks', { name: displayName }), getMainKeyboard(lang));
      } else {
        let taskList = '';
        for (let i = 0; i < Math.min(tasks.length, 15); i++) {
          const task = tasks[i];
          const dueDate = new Date(task.due_date);
          const priorityIcon = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢';
          const daysLeft = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));
          taskList += `${priorityIcon} ${i+1}. **${task.task}**\n   📅 Due: ${dueDate.toLocaleDateString()} (${daysLeft} days left)\n\n`;
        }
        if (tasks.length > 15) taskList += `\n... and ${tasks.length - 15} more tasks`;
        
        await sendMessage(userId, getResponse(lang, 'tasks_header', {
          pending: stats.pending,
          completed: stats.completed,
          tasks: taskList
        }), getMainKeyboard(lang));
      }
      return;
    }
    
    // ========== COMPLETE TASK (Done [task]) ==========
    const doneMatch = text.match(/(?:done|complete|finished|готово|сделано|выполнено|завершено)\s+(.+?)(?:\.|$)/i);
    if (doneMatch) {
      const taskName = doneMatch[1].trim();
      const task = await findTaskByName(userId, taskName);
      if (task) {
        await completeTask(task.id, userId);
        await sendMessage(userId, getResponse(lang, 'task_completed', { name: displayName, task: task.task }), getMainKeyboard(lang));
      } else {
        await sendMessage(userId, getResponse(lang, 'task_not_found', { task: taskName }), getMainKeyboard(lang));
      }
      return;
    }
    
    // ========== STATISTICS ==========
    if (text === "📊 Stats" || text === "📊 Статистика" || lowerText.includes('stats') || lowerText.includes('statistics') || lowerText.includes('статистика')) {
      const [taskStats, attendanceStats, studyStats, totalClasses] = await Promise.all([
        getTaskStats(userId),
        getAttendanceStats(userId),
        getStudyStats(userId),
        getClassCount(userId)
      ]);
      
      const prodBar = '█'.repeat(Math.floor(taskStats.rate / 10)) + '░'.repeat(10 - Math.floor(taskStats.rate / 10));
      const attendBar = '█'.repeat(Math.floor(attendanceStats.rate / 10)) + '░'.repeat(10 - Math.floor(attendanceStats.rate / 10));
      
      let msg = getResponse(lang, 'stats_header');
      msg += getResponse(lang, 'task_stats', {
        completed: taskStats.completed,
        pending: taskStats.pending,
        rate: taskStats.rate,
        bar: prodBar
      }) + '\n\n';
      msg += getResponse(lang, 'attendance_stats', {
        total: attendanceStats.total,
        attended: attendanceStats.attended,
        missed: attendanceStats.missed,
        rate: attendanceStats.rate,
        bar: attendBar
      }) + '\n\n';
      msg += getResponse(lang, 'study_stats', {
        today: studyStats.today,
        week: studyStats.weekly,
        total: studyStats.total,
        avg: studyStats.avg
      });
      
      // Add motivation
      const motivationMsg = taskStats.rate > 80 ? "Excellent productivity! Keep crushing your goals! 🎯" :
                           taskStats.rate > 50 ? "Good progress! A little push and you'll be at the top! 💪" :
                           "Every task completed is a step forward. You've got this! 🌟";
      msg += '\n\n' + getResponse(lang, 'motivation', { message: motivationMsg });
      
      await sendMessage(userId, msg, getMainKeyboard(lang));
      return;
    }
    
    // ========== IMPORT BUTTON ==========
    if (text === "📥 Import" || text === "📥 Импорт" || lowerText.includes('import') || lowerText.includes('импорт')) {
      await sendMessage(userId, getResponse(lang, 'import_instructions'), getMainKeyboard(lang));
      return;
    }
    
    // ========== HELP ==========
    if (text === "❓ Help" || text === "❓ Помощь" || lowerText.includes('help') || lowerText.includes('помощь')) {
      await sendMessage(userId, getResponse(lang, 'help_text'), getMainKeyboard(lang));
      return;
    }
    
    // ========== ICS IMPORT COMMAND ==========
    if (text.startsWith('/ics')) {
      const parts = text.split(/\s+/);
      if (parts.length >= 2) {
        const icsUrl = parts[1];
        if (icsUrl.startsWith('http://') || icsUrl.startsWith('https://')) {
          await sendMessage(userId, getResponse(lang, 'import_progress'), getMainKeyboard(lang));
          const reminderOffset = await getUserReminderOffset(userId);
          const count = await importIcsFromUrl(userId, icsUrl);
          if (count > 0) {
            await sendMessage(userId, getResponse(lang, 'import_success', { 
              count, 
              name: displayName,
              reminder_minutes: reminderOffset
            }), getMainKeyboard(lang));
          } else {
            await sendMessage(userId, getResponse(lang, 'import_fail'), getMainKeyboard(lang));
          }
        }
      } else {
        await sendMessage(userId, getResponse(lang, 'import_instructions'), getMainKeyboard(lang));
      }
      return;
    }
    
    // ========== ADD TASK COMMAND ==========
    if (text.startsWith('/task')) {
      const match = text.match(/\/task\s+['"](.+?)['"]\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s+(\d+)(?:\s+(\w+))?/);
      if (match) {
        const taskName = match[1];
        const dueDate = match[2];
        const days = parseInt(match[3]);
        const priority = match[4] || 'normal';
        await addTask(userId, taskName, dueDate, days, priority);
        await sendMessage(userId, getResponse(lang, 'task_added', {
          task: taskName,
          due_date: dueDate,
          days: days,
          priority: priority === 'high' ? 'High' : priority === 'medium' ? 'Medium' : 'Normal'
        }), getMainKeyboard(lang));
      } else {
        await sendMessage(userId, getResponse(lang, 'task_format_error'), getMainKeyboard(lang));
      }
      return;
    }
    
    // ========== THANKS ==========
    if (lowerText.includes('thanks') || lowerText.includes('thank') || lowerText.includes('спасибо')) {
      await sendMessage(userId, getResponse(lang, 'thanks', { name: displayName }), getMainKeyboard(lang));
      return;
    }
    
    // ========== DEFAULT / FALLBACK ==========
    await sendMessage(userId, getResponse(lang, 'unknown'), getMainKeyboard(lang));
    
  } catch (error) {
    console.error("handleMessage error:", error);
    await sendMessage(userId, getResponse('en', 'error', { name: 'friend' }), getMainKeyboard('en'));
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
      
      // DETECT LANGUAGE - This is critical for adaptation
      const lang = detectLanguage(text);
      await setUserLanguage(userId, lang);
      
      // Handle ICS file attachments
      for (const attachment of attachments) {
        if (attachment.type === 'doc' && attachment.doc.title?.toLowerCase().endsWith('.ics')) {
          const fileUrl = attachment.doc.url;
          await sendMessage(userId, getResponse(lang, 'import_progress'), getMainKeyboard(lang));
          const reminderOffset = await getUserReminderOffset(userId);
          const count = await importIcsFromFile(userId, fileUrl);
          const name = await getUserName(userId);
          if (count > 0) {
            await sendMessage(userId, getResponse(lang, 'import_success', { 
              count, 
              name: name || 'friend',
              reminder_minutes: reminderOffset
            }), getMainKeyboard(lang));
          } else {
            await sendMessage(userId, getResponse(lang, 'import_fail'), getMainKeyboard(lang));
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
        await sendMessage(userId, getResponse(lang, 'import_progress'), getMainKeyboard(lang));
        const reminderOffset = await getUserReminderOffset(userId);
        const count = await importIcsFromUrl(userId, icsUrlMatch[1]);
        const name = await getUserName(userId);
        if (count > 0) {
          await sendMessage(userId, getResponse(lang, 'import_success', { 
            count, 
            name: name || 'friend',
            reminder_minutes: reminderOffset
          }), getMainKeyboard(lang));
        } else {
          await sendMessage(userId, getResponse(lang, 'import_fail'), getMainKeyboard(lang));
        }
        return {
          statusCode: 200,
          body: JSON.stringify({ ok: true }),
        };
      }
      
      // Handle regular messages
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

// ========== INITIALIZATION ==========
console.log("Bot initialized with full functionality");
startReminderSystem();
console.log("Reminder system active - checking every minute");