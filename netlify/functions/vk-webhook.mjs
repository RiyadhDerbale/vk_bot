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
const conversationMemory = new Map(); // Store conversation context

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
  
  // Chinese detection (Simplified & Traditional)
  if (/[\u4e00-\u9fff\u3400-\u4dbf\u{20000}-\u{2a6df}\u{2a700}-\u{2b73f}\u{2b740}-\u{2b81f}\u{2b820}-\u{2ceaf}\uf900-\ufaff]/u.test(text)) {
    return 'zh';
  }
  
  // Russian detection
  if (/[а-яА-ЯёЁ]/.test(text)) return 'ru';
  
  // Spanish detection
  if (/[áéíóúñ¿¡]/i.test(text)) return 'es';
  
  // German detection
  if (/[äöüß]/i.test(text)) return 'de';
  
  // French detection
  if (/[éèêëàâæôœûùçîï]/i.test(text)) return 'fr';
  
  // Italian detection
  if (/[àèéìíîòóùú]/i.test(text)) return 'it';
  
  return 'en';
}

// ========== COMPLETE MULTILINGUAL RESPONSES ==========
const RESPONSES = {
  en: {
    // Greetings & Politeness
    ask_name: "🌟 Hello! I'm your personal AI assistant. What's your name?",
    ask_how_are_you: "Nice to meet you {name}! 😊 How are you feeling today?",
    ask_mood_followup: "I'm glad you're {mood}! 😊 How can I help you today?",
    welcome_back: "👋 Welcome back {name}! It's great to see you again. How are you doing today?",
    polite_greeting: "Hello {name}! I hope you're having a wonderful day. What would you like me to help you with?",
    
    // Mood responses
    mood_happy: "🎉 I'm so happy to hear that {name}! Let's make today even more amazing!",
    mood_good: "😊 That's wonderful {name}! I'll do my best to assist you today.",
    mood_okay: "🤗 That's good {name}! I'm here to make your day better.",
    mood_tired: "😴 I understand {name}. Let me help you organize your tasks so you can rest easier.",
    mood_busy: "⚡ I get it {name}! Let me help you stay on top of everything.",
    mood_stressed: "🧘 Take a deep breath {name}. Let's break down what needs to be done.",
    mood_sad: "💙 I'm here for you {name}. Let's focus on small wins together.",
    mood_default: "🙂 I appreciate you sharing {name}. How can I assist you today?",
    
    // Personal Info Memory
    name_updated: "✅ I'll remember your name as {name}. It's a pleasure to know you!",
    name_already_know: "I remember you {name}! It's always nice to talk with you.",
    
    // Schedule
    schedule_today: "📅 **Today's Schedule** - {date}\n\n{classes}💡 *Reply with class number to mark attendance*",
    schedule_tomorrow: "📅 **Tomorrow's Schedule** - {date}\n\n{classes}",
    no_classes: "🎉 You have no classes today {name}! A perfect day to catch up on tasks or relax.",
    no_classes_tomorrow: "🎉 No classes tomorrow {name}! Enjoy your free time!",
    
    // Next Class & Reminders
    next_class: "⏰ **Next Class:** {subject}\n🕐 {time}\n📍 {location}\n⏱️ In {minutes} minutes\n\n*I'll remind you {reminder_minutes} minutes before!*",
    no_next_class: "🎉 No more classes today {name}! Time for tasks or relaxation!",
    class_reminder: "⏰ **CLASS REMINDER!**\n\n📚 {subject}\n🕐 {time}\n📍 {location}\n⏱️ Starts in {minutes} minutes!\n\n✅ Ready for class {name}? Reply 'attend' after class!",
    reminder_updated: "✅ Reminder time updated! I'll notify you {minutes} minutes before each class.",
    current_reminder: "🔔 Current reminder: {minutes} minutes before class.\nUse /reminder <minutes> to change (5-120)",
    
    // Tasks
    tasks_header: "📋 **Your Tasks** ({pending} pending, {completed} completed)\n\n{tasks}💬 *Reply 'done [task name]' to mark complete*\n📊 *Say 'stats' to see your progress*",
    no_tasks: "✅ Amazing {name}! No pending tasks! 🎉\n\n📊 *Say 'stats' to see your achievements*",
    task_added: "✅ Added: **{task}**\n📅 Due: {due_date}\n🔔 Reminder: {days} day(s) before\n⚡ Priority: {priority}\n\n*Say 'my tasks' to see all tasks*",
    task_completed: "🎉 Fantastic {name}! You completed: **{task}**\n\n📊 Your productivity score increased!",
    task_deleted: "🗑️ Removed: **{task}** from your list",
    task_not_found: "❌ Couldn't find task matching '{task}'\n\n💬 Try: 'done {exact name}' or check 'my tasks'",
    
    // Attendance
    attendance_prompt: "📚 **Mark Attendance**\n\nToday's classes:\n{classes}\n\nReply with number (1-{count}) or class name:",
    attendance_marked: "✅ Marked **{class_name}** as attended {name}!\n📈 Attendance updated!\n{streak_message}",
    attendance_streak: "🔥 You've attended {streak} classes in a row! Keep it up!",
    already_marked: "ℹ️ You already marked {class_name} today! Great job staying on track!",
    
    // Statistics
    stats_header: "📊 **YOUR PERFORMANCE DASHBOARD** 📊\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n",
    task_stats: "📝 **TASKS**\n• ✅ Completed: {completed}\n• ⏳ Pending: {pending}\n• 🎯 Rate: {rate}%\n   [{bar}]",
    attendance_stats: "📚 **ATTENDANCE**\n• 📖 Total: {total}\n• ✅ Attended: {attended}\n• ❌ Missed: {missed}\n• 📈 Rate: {rate}%\n   [{bar}]",
    study_stats: "⏱️ **STUDY TIME**\n• 📅 Today: {today} min\n• 📆 Week: {week} min\n• 🏆 Total: {total} min\n• 💪 Daily Avg: {avg} min",
    motivation: "💡 **INSIGHT**\n{message}",
    
    // ICS Import
    import_instructions: "📥 **Import Schedule**\n\nSend me:\n• An ICS file attachment\n• A link to an ICS calendar\n• Or use: /ics <url>\n\nI'll automatically add all your classes!",
    import_progress: "⏳ Processing your calendar... Please wait.",
    import_success: "🎉 Successfully imported **{count}** classes {name}!\n\n✅ Reminders set {reminder_minutes} minutes before each class",
    import_fail: "❌ Failed to import calendar. Make sure it's a valid ICS file.",
    
    // Help & Commands
    help_text: "🤖 **I'm Your Personal Assistant**\n\n📅 **SCHEDULE**\n• 'today' - Today's classes\n• 'tomorrow' - Tomorrow's classes\n• 'next class' - Upcoming class\n• Send ICS file - Import timetable\n\n✅ **ATTENDANCE**\n• 'mark attendance' - Mark today's classes\n• 'attend [class]' - Quick mark\n\n📝 **TASKS**\n• 'my tasks' - See all tasks\n• '/task \"Task\" YYYY-MM-DD HH:MM days priority'\n• 'done [task]' - Complete task\n\n⚙️ **REMINDERS**\n• '/reminder 45' - Set class reminder\n\n📊 **STATISTICS**\n• 'stats' - Full progress report\n\n💬 **CHAT WITH ME**\n• Tell me how you're feeling\n• Ask for advice\n• I remember our conversations!\n\n*Just be yourself - I understand natural language!* 🌟",
    
    // Settings
    reminder_settings: "⚙️ **Reminder Settings**\n\nCurrent: {minutes} minutes before class\nRange: 5 - 120 minutes\nUse /reminder <minutes> to change",
    
    // Politeness & Small Talk
    how_are_you: "Thank you for asking {name}! I'm doing great and ready to help you. How are you feeling today?",
    compliment: "You're doing an amazing job {name}! Keep up the great work! 🌟",
    encouragement: "You've got this {name}! Every small step counts toward your goals. 💪",
    
    // Errors & Fallbacks  
    unknown: "🤔 I understand you're asking about something.\n\nTry one of these:\n• 'today' - See schedule\n• 'my tasks' - See pending tasks\n• 'stats' - View progress\n• 'help' - All commands\n\nOr just tell me how you're feeling! 💭",
    error: "❌ Sorry {name}, I encountered an issue. Please try again or say 'help'",
    
    // Responses
    thanks: "😊 You're very welcome {name}! Is there anything else I can help you with today?",
    goodbye: "👋 Goodbye {name}! Have a wonderful day! Come back anytime you need help.",
    joke: "😂 Here's a joke for you {name}:\n\n{joke}",
    
    // Study
    study_logged: "📖 Great job {name}! Logged {duration} minutes studying {subject}.\n📊 Check 'stats' to see your progress!",
    
    // Memory & Context
    remember_conversation: "💭 I remember you mentioned that. Let me help you with that!",
    weekly_report: "📊 **Weekly Report**\n\n📚 Classes: {attended}/{total} ({rate}%)\n📝 Tasks: {tasks_done}/{total_tasks}\n⏱️ Study: {study_hours}h\n\n{encouragement}"
  },
  
  zh: {
    // Greetings & Politeness - Chinese
    ask_name: "🌟 你好！我是你的个人AI助手。请问你叫什么名字？",
    ask_how_are_you: "{name}，很高兴认识你！😊 你今天感觉怎么样？",
    ask_mood_followup: "很高兴你感觉{mood}！😊 今天我能帮你什么？",
    welcome_back: "👋 欢迎回来{name}！很高兴再次见到你。你今天过得怎么样？",
    polite_greeting: "{name}你好！希望你今天过得愉快。有什么我可以帮你的吗？",
    
    // Mood responses
    mood_happy: "🎉 真为你高兴{name}！让我们一起让今天更精彩！",
    mood_good: "😊 太好了{name}！我会尽力帮助你。",
    mood_okay: "🤗 那就好{name}！我在这里让你的日子更美好。",
    mood_tired: "😴 我理解{name}。让我帮你整理任务，这样你可以更好地休息。",
    mood_busy: "⚡ 我明白{name}！让我帮你处理所有事情。",
    mood_stressed: "🧘 深呼吸{name}。让我们一起分解需要做的事情。",
    mood_sad: "💙 我在这里陪你{name}。让我们一起关注小进步。",
    mood_default: "🙂 谢谢你分享{name}。今天我能帮你什么？",
    
    // Personal Info Memory
    name_updated: "✅ 我会记住你的名字是{name}。很高兴认识你！",
    name_already_know: "我记得你{name}！和你聊天总是很开心。",
    
    // Schedule
    schedule_today: "📅 **今日课表** - {date}\n\n{classes}💡 *回复课程编号标记出勤*",
    schedule_tomorrow: "📅 **明日课表** - {date}\n\n{classes}",
    no_classes: "🎉 {name}，今天没有课！是个完成任务或放松的好日子。",
    no_classes_tomorrow: "🎉 {name}，明天没有课！好好享受你的空闲时间！",
    
    // Next Class
    next_class: "⏰ **下节课：** {subject}\n🕐 {time}\n📍 {location}\n⏱️ {minutes}分钟后开始\n\n*我会提前{reminder_minutes}分钟提醒你！*",
    no_next_class: "🎉 {name}，今天没有更多课了！是时候处理任务或放松了！",
    class_reminder: "⏰ **上课提醒！**\n\n📚 {subject}\n🕐 {time}\n📍 {location}\n⏱️ {minutes}分钟后开始！\n\n✅ {name}，准备好上课了吗？课后回复'出勤'标记！",
    reminder_updated: "✅ 提醒时间已更新！我会在课前{minutes}分钟通知你。",
    current_reminder: "🔔 当前提醒：课前{minutes}分钟。\n使用 /reminder <分钟> 更改(5-120)",
    
    // Tasks
    tasks_header: "📋 **你的任务** ({pending}个待办，{completed}个已完成)\n\n{tasks}💬 *回复'完成 [任务名]'标记完成*\n📊 *说'统计'查看进度*",
    no_tasks: "✅ 太棒了{name}！没有待办任务！🎉\n\n📊 *说'统计'查看你的成就*",
    task_added: "✅ 已添加：**{task}**\n📅 截止：{due_date}\n🔔 提前{days}天提醒\n⚡ 优先级：{priority}\n\n*说'我的任务'查看所有任务*",
    task_completed: "🎉 太棒了{name}！你完成了：**{task}**\n\n📊 你的生产力得分提高了！",
    task_deleted: "🗑️ 已删除：**{task}**",
    task_not_found: "❌ 找不到匹配'{task}'的任务\n\n💬 试试：'完成 [准确名称]'或查看'我的任务'",
    
    // Attendance
    attendance_prompt: "📚 **标记出勤**\n\n今日课程：\n{classes}\n\n回复数字(1-{count})或课程名称：",
    attendance_marked: "✅ {name}，已标记 **{class_name}** 为已出勤！\n📈 出勤率已更新！\n{streak_message}",
    attendance_streak: "🔥 你已经连续出勤{streak}节课！继续保持！",
    already_marked: "ℹ️ 你今天已经标记过{class_name}了！保持好习惯！",
    
    // Statistics
    stats_header: "📊 **你的表现仪表板** 📊\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n",
    task_stats: "📝 **任务**\n• ✅ 已完成：{completed}\n• ⏳ 待办：{pending}\n• 🎯 完成率：{rate}%\n   [{bar}]",
    attendance_stats: "📚 **出勤**\n• 📖 总计：{total}\n• ✅ 已出勤：{attended}\n• ❌ 缺勤：{missed}\n• 📈 出勤率：{rate}%\n   [{bar}]",
    study_stats: "⏱️ **学习时间**\n• 📅 今日：{today}分钟\n• 📆 本周：{week}分钟\n• 🏆 总计：{total}分钟\n• 💪 日均：{avg}分钟",
    motivation: "💡 **洞察**\n{message}",
    
    // ICS Import
    import_instructions: "📥 **导入课程表**\n\n发送给我：\n• ICS文件附件\n• ICS日历链接\n• 或使用：/ics <链接>\n\n我会自动添加所有课程！",
    import_progress: "⏳ 正在处理你的日历...请稍等。",
    import_success: "🎉 成功导入 **{count}** 节课 {name}！\n\n✅ 已设置课前{reminder_minutes}分钟提醒",
    import_fail: "❌ 导入日历失败。请确保是有效的ICS文件。",
    
    // Help
    help_text: "🤖 **我是你的个人助手**\n\n📅 **课表**\n• '今天' - 今日课程\n• '明天' - 明日课程\n• '下节课' - 下一节课\n• 发送ICS文件 - 导入课表\n\n✅ **出勤**\n• '标记出勤' - 标记今日课程\n• '出勤 [课程]' - 快速标记\n\n📝 **任务**\n• '我的任务' - 查看所有任务\n• '/task \"任务\" 2025-12-20 23:59 3 high'\n• '完成 [任务]' - 完成任务\n\n⚙️ **提醒**\n• '/reminder 45' - 设置课前提醒\n\n📊 **统计**\n• '统计' - 完整进度报告\n\n💬 **和我聊天**\n• 告诉我你的感受\n• 寻求建议\n• 我记得我们的对话！\n\n*自然说话就行 - 我能理解！* 🌟",
    
    // Politeness
    how_are_you: "{name}，谢谢关心！我很好，随时准备帮助你。你今天感觉怎么样？",
    compliment: "{name}，你做得太棒了！继续保持！ 🌟",
    encouragement: "{name}，你能行的！每一小步都很重要。💪",
    
    unknown: "🤔 我理解你在问什么。\n\n试试这些：\n• '今天' - 查看课表\n• '我的任务' - 查看任务\n• '统计' - 查看进度\n• '帮助' - 所有命令\n\n或者告诉我你的感受！💭",
    error: "❌ 抱歉{name}，出了点问题。请再试一次或说'帮助'",
    
    thanks: "😊 不客气{name}！今天还有什么我可以帮你的吗？",
    goodbye: "👋 再见{name}！祝你度过美好的一天！需要帮助随时回来。",
    joke: "😂 {name}，给你讲个笑话：\n\n{joke}",
    
    study_logged: "📖 太棒了{name}！记录了{duration}分钟学习{subject}。\n📊 说'统计'查看你的进步！",
    
    remember_conversation: "💭 我记得你提到过这个。让我帮你处理！",
    weekly_report: "📊 **周报**\n\n📚 课程：{attended}/{total} ({rate}%)\n📝 任务：{tasks_done}/{total_tasks}\n⏱️ 学习：{study_hours}小时\n\n{encouragement}"
  },
  
  ru: {
    ask_name: "🌟 Привет! Я твой персональный AI-помощник. Как тебя зовут?",
    ask_how_are_you: "Приятно познакомиться {name}! 😊 Как ты себя чувствуешь сегодня?",
    ask_mood_followup: "Рад что ты {mood}! 😊 Чем могу помочь?",
    welcome_back: "👋 С возвращением {name}! Рад снова тебя видеть. Как дела?",
    polite_greeting: "Привет {name}! Надеюсь у тебя отличный день. Чем могу помочь?",
    
    mood_happy: "🎉 Я очень рад {name}! Давай сделаем этот день ещё лучше!",
    mood_good: "😊 Замечательно {name}! Я сделаю всё возможное чтобы помочь.",
    mood_okay: "🤗 Хорошо {name}! Я здесь чтобы сделать твой день лучше.",
    mood_tired: "😴 Я понимаю {name}. Давай я помогу организовать задачи чтобы ты мог отдохнуть.",
    mood_busy: "⚡ Понимаю {name}! Давай я помогу всё успеть.",
    mood_stressed: "🧘 Глубокий вдох {name}. Давай разберём что нужно сделать.",
    mood_sad: "💙 Я с тобой {name}. Давай сфокусируемся на маленьких победах.",
    mood_default: "🙂 Спасибо что поделился {name}. Чем могу помочь сегодня?",
    
    name_updated: "✅ Я запомню твоё имя как {name}. Рад познакомиться!",
    name_already_know: "Я помню тебя {name}! Всегда приятно поболтать.",
    
    schedule_today: "📅 **Расписание на сегодня** - {date}\n\n{classes}💡 *Ответь номером пары чтобы отметить посещение*",
    schedule_tomorrow: "📅 **Расписание на завтра** - {date}\n\n{classes}",
    no_classes: "🎉 Сегодня нет пар {name}! Отличный день для задач или отдыха.",
    no_classes_tomorrow: "🎉 Завтра нет пар {name}! Наслаждайся свободным временем!",
    
    next_class: "⏰ **Следующая пара:** {subject}\n🕐 {time}\n📍 {location}\n⏱️ Через {minutes} минут\n\n*Напомню за {reminder_minutes} минут!*",
    no_next_class: "🎉 На сегодня пар больше нет {name}! Время для задач или отдыха!",
    class_reminder: "⏰ **НАПОМИНАНИЕ О ПАРЕ!**\n\n📚 {subject}\n🕐 {time}\n📍 {location}\n⏱️ Начинается через {minutes} минут!\n\n✅ Готов к паре {name}? Ответь 'отметить' после пары!",
    reminder_updated: "✅ Время напоминания обновлено! Напомню за {minutes} минут до пары.",
    current_reminder: "🔔 Сейчас: за {minutes} минут до пары.\nИспользуй /reminder <минуты> чтобы изменить (5-120)",
    
    tasks_header: "📋 **Твои задачи** ({pending} активных, {completed} выполнено)\n\n{tasks}💬 *Ответь 'готово [задача]' чтобы отметить*\n📊 *Скажи 'статистика' чтобы увидеть прогресс*",
    no_tasks: "✅ Отлично {name}! Нет активных задач! 🎉\n\n📊 *Скажи 'статистика' чтобы увидеть достижения*",
    task_added: "✅ Добавлено: **{task}**\n📅 Дедлайн: {due_date}\n🔔 Напомню за {days} дн.\n⚡ Приоритет: {priority}\n\n*Скажи 'мои задачи' чтобы увидеть все*",
    task_completed: "🎉 Молодец {name}! Ты выполнил: **{task}**\n\n📊 Твоя продуктивность выросла!",
    
    attendance_prompt: "📚 **Отметить посещение**\n\nПары сегодня:\n{classes}\n\nОтветь номером (1-{count}) или названием:",
    attendance_marked: "✅ Отмечено **{class_name}** как посещённое {name}!\n📈 Посещаемость обновлена!\n{streak_message}",
    attendance_streak: "🔥 Ты посетил {streak} пар(ы) подряд! Так держать!",
    
    stats_header: "📊 **ПАНЕЛЬ ПРОГРЕССА** 📊\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n",
    task_stats: "📝 **ЗАДАЧИ**\n• ✅ Выполнено: {completed}\n• ⏳ Ожидает: {pending}\n• 🎯 Процент: {rate}%\n   [{bar}]",
    attendance_stats: "📚 **ПОСЕЩАЕМОСТЬ**\n• 📖 Всего: {total}\n• ✅ Посещено: {attended}\n• ❌ Пропущено: {missed}\n• 📈 Процент: {rate}%\n   [{bar}]",
    study_stats: "⏱️ **ВРЕМЯ УЧЁБЫ**\n• 📅 Сегодня: {today} мин\n• 📆 На неделе: {week} мин\n• 🏆 Всего: {total} мин\n• 💪 В день: {avg} мин",
    motivation: "💡 **ИНСАЙТ**\n{message}",
    
    import_instructions: "📥 **Импорт расписания**\n\nОтправь мне:\n• ICS файл\n• Ссылку на ICS календарь\n• Или используй: /ics <ссылка>",
    import_progress: "⏳ Обрабатываю календарь... Подожди.",
    import_success: "🎉 Успешно импортировано **{count}** пар(ы) {name}!\n\n✅ Напоминания за {reminder_minutes} минут",
    import_fail: "❌ Не удалось импортировать календарь. Убедись что это ICS файл.",
    
    help_text: "🤖 **Я твой персональный помощник**\n\n📅 **РАСПИСАНИЕ**\n• 'сегодня' - Пары сегодня\n• 'завтра' - Пары завтра\n• 'следующая пара' - Ближайшая\n• Отправь ICS - Импорт\n\n✅ **ПОСЕЩАЕМОСТЬ**\n• 'отметить пару' - Отметить\n• 'отметить [название]' - Быстро\n\n📝 **ЗАДАЧИ**\n• 'мои задачи' - Список\n• '/task \"Задача\" 2025-12-20 23:59 3 high'\n• 'готово [задача]' - Выполнить\n\n⚙️ **НАПОМИНАНИЯ**\n• '/reminder 45' - Установить\n\n📊 **СТАТИСТИКА**\n• 'статистика' - Полный отчёт\n\n💬 **ОБЩАЙСЯ СО МНОЙ**\n• Расскажи как дела\n• Попроси совета\n• Я помню наши разговоры!\n\n*Говори естественно - я понимаю!* 🌟",
    
    how_are_you: "{name}, спасибо что спросил! У меня всё отлично, готов помогать. Как ты себя чувствуешь?",
    compliment: "{name}, у тебя отлично получается! Продолжай в том же духе! 🌟",
    encouragement: "{name}, у тебя всё получится! Каждый маленький шаг важен. 💪",
    
    unknown: "🤔 Я вижу ты спрашиваешь о чём-то.\n\nПопробуй:\n• 'сегодня' - Расписание\n• 'мои задачи' - Задачи\n• 'статистика' - Прогресс\n• 'помощь' - Все команды\n\nИли расскажи как дела! 💭",
    error: "❌ Извини {name}, произошла ошибка. Попробуй ещё раз или скажи 'помощь'",
    
    thanks: "😊 Пожалуйста {name}! Ещё чем-то помочь сегодня?",
    goodbye: "👋 До свидания {name}! Хорошего дня! Возвращайся если нужна помощь.",
    joke: "😂 Шутка для тебя {name}:\n\n{joke}",
    
    study_logged: "📖 Отлично {name}! Записал {duration} минут учёбы по {subject}.\n📊 Скажи 'статистика' чтобы увидеть прогресс!"
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
  if (lang === 'zh') {
    return JSON.stringify({
      one_time: false,
      buttons: [
        [{ action: { type: "text", label: "📅 今天" }, color: "primary" }, { action: { type: "text", label: "📅 明天" }, color: "primary" }],
        [{ action: { type: "text", label: "⏰ 下节课" }, color: "secondary" }, { action: { type: "text", label: "📝 我的任务" }, color: "positive" }],
        [{ action: { type: "text", label: "✅ 标记出勤" }, color: "positive" }, { action: { type: "text", label: "📊 统计" }, color: "secondary" }],
        [{ action: { type: "text", label: "📥 导入" }, color: "primary" }, { action: { type: "text", label: "❓ 帮助" }, color: "secondary" }]
      ]
    });
  }
  
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
      .select("name, last_mood, last_active")
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

async function updateUserMood(userId, mood) {
  try {
    await supabase
      .from("users")
      .upsert({ vk_id: userId, last_mood: mood, last_active: new Date().toISOString() }, { onConflict: "vk_id" });
  } catch (error) {
    console.error("updateUserMood error:", error.message);
  }
}

async function getUserReminderOffset(userId) {
  try {
    const { data } = await supabase
      .from("users")
      .select("reminder_offset")
      .eq("vk_id", userId)
      .single();
    return data?.reminder_offset || 60;
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
    const tasks = await getTasks(userId, false);
    
    if (tasks.length === 0) {
      return { pending: 0, completed: 0, rate: 0 };
    }

    const pending = tasks.filter(t => t.done === 0).length;
    const completed = tasks.filter(t => t.done === 1).length;
    const rate = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

    return { pending, completed, rate };
  } catch (error) {
    console.error("getTaskStats error:", error.message);
    return { pending: 0, completed: 0, rate: 0 };
  }
}

// Attendance Functions
async function markAttended(userId, className) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
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
    
    // Get streak
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
    const { data } = await supabase
      .from("class_attendance")
      .select("attended")
      .eq("user_id", userId);

    if (!data || data.length === 0) {
      return { total: 0, attended: 0, missed: 0, rate: 0 };
    }

    const total = data.length;
    const attended = data.filter(a => a.attended === 1).length;
    const missed = total - attended;
    const rate = total > 0 ? Math.round((attended / total) * 100) : 0;

    return { total, attended, missed, rate };
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
    const avg = weekly > 0 ? Math.round(weekly / 7) : 0;
    
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
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed === 'BEGIN:VEVENT') {
        currentEvent = {};
      } else if (trimmed === 'END:VEVENT' && currentEvent) {
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
        }
      }
    }
    
    let addedCount = 0;
    
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
        
        if (reminderMinutes <= currentMinutes && currentMinutes <= reminderMinutes + 2) {
          const key = `reminder_${user.vk_id}_${currentDay}_${cls.start_time}_${now.toDateString()}`;
          
          const { data: existing } = await supabase
            .from("reminders")
            .select("key")
            .eq("key", key)
            .single();
          
          if (!existing) {
            const minutesUntil = classMinutes - currentMinutes;
            let msg = RESPONSES[lang]?.class_reminder || RESPONSES.en.class_reminder;
            msg = msg.replace('{subject}', cls.subject)
                     .replace('{time}', cls.start_time)
                     .replace('{location}', cls.location || 'Classroom')
                     .replace('{minutes}', minutesUntil)
                     .replace('{name}', name);
            
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
  reminderInterval = setInterval(checkAndSendReminders, 60000);
}

// ========== MOOD DETECTION ==========
function detectMood(text) {
  const lowerText = text.toLowerCase();
  
  if (lowerText.match(/happy|great|amazing|wonderful|excellent|fantastic|счастлив|отлично|прекрасно|好|开心|快乐/)) return 'happy';
  if (lowerText.match(/good|fine|well|okay|alright|хорошо|нормально|ладн|不错|挺好/)) return 'good';
  if (lowerText.match(/tired|exhausted|sleepy|устал|спать|сон|累|困/)) return 'tired';
  if (lowerText.match(/busy|swamped|overwhelmed|занят|много дел|忙|很忙/)) return 'busy';
  if (lowerText.match(/stressed|anxious|worried|стресс|волнуюсь|焦虑|压力/)) return 'stressed';
  if (lowerText.match(/sad|upset|depressed|unhappy|грустно|печально|难过|伤心/)) return 'sad';
  
  return null;
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
    
    // ========== FIRST TIME USER - Polite onboarding ==========
    if (!name && !lowerText.match(/(my name is|call me|меня зовут|叫我|我是|名字|名叫)/)) {
      await sendMessage(userId, getResponse(lang, 'ask_name'), getMainKeyboard(lang));
      return;
    }
    
    // ========== EXTRACT NAME ==========
    const nameMatch = text.match(/(?:my name is|call me|меня зовут|叫我|我是|名字|名叫)\s+([A-Za-zА-Яа-яёЁ\u4e00-\u9fff]+)/i);
    if (nameMatch && !name) {
      const newName = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1).toLowerCase();
      await setUserName(userId, newName);
      
      // Ask how they're feeling
      await sendMessage(userId, getResponse(lang, 'ask_how_are_you', { name: newName }), getMainKeyboard(lang));
      return;
    }
    
    // ========== CHECK FOR MOOD/RESPONSE TO "HOW ARE YOU" ==========
    const detectedMood = detectMood(text);
    if (detectedMood && (lowerText.includes('feel') || lowerText.includes('feeling') || lowerText.includes('чувствую') || lowerText.includes('感觉') || lowerText.includes('觉得'))) {
      await updateUserMood(userId, detectedMood);
      
      let moodResponse = '';
      switch(detectedMood) {
        case 'happy': moodResponse = getResponse(lang, 'mood_happy', { name: displayName }); break;
        case 'good': moodResponse = getResponse(lang, 'mood_good', { name: displayName }); break;
        case 'okay': moodResponse = getResponse(lang, 'mood_okay', { name: displayName }); break;
        case 'tired': moodResponse = getResponse(lang, 'mood_tired', { name: displayName }); break;
        case 'busy': moodResponse = getResponse(lang, 'mood_busy', { name: displayName }); break;
        case 'stressed': moodResponse = getResponse(lang, 'mood_stressed', { name: displayName }); break;
        case 'sad': moodResponse = getResponse(lang, 'mood_sad', { name: displayName }); break;
        default: moodResponse = getResponse(lang, 'mood_default', { name: displayName });
      }
      
      await sendMessage(userId, moodResponse, getMainKeyboard(lang));
      return;
    }
    
    // ========== GREETING RESPONSES (polite) ==========
    if (lowerText.match(/^(hello|hi|hey|greetings|привет|здравствуй|你好|嗨|早上好|下午好|晚上好)$/)) {
      const hour = new Date().getHours();
      let greeting = getResponse(lang, 'polite_greeting', { name: displayName });
      await sendMessage(userId, greeting, getMainKeyboard(lang));
      return;
    }
    
    // ========== "HOW ARE YOU" ASKING THE BOT ==========
    if (lowerText.match(/how are you|how are you doing|как дела|как ты|你好吗|你怎么样|你还好吗/)) {
      await sendMessage(userId, getResponse(lang, 'how_are_you', { name: displayName }), getMainKeyboard(lang));
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
          const current = await getUserReminderOffset(userId);
          await sendMessage(userId, getResponse(lang, 'reminder_settings', { minutes: current }), getMainKeyboard(lang));
        }
      } else {
        const current = await getUserReminderOffset(userId);
        await sendMessage(userId, getResponse(lang, 'reminder_settings', { minutes: current }), getMainKeyboard(lang));
      }
      return;
    }
    
    // ========== TODAY'S SCHEDULE ==========
    if (text === "📅 Today" || text === "📅 Сегодня" || text === "📅 今天" || lowerText.includes('today') || lowerText.includes('сегодня') || lowerText.includes('今天')) {
      const classes = await getTodayClasses(userId);
      if (classes.length === 0) {
        await sendMessage(userId, getResponse(lang, 'no_classes', { name: displayName }), getMainKeyboard(lang));
      } else {
        const dayNames = lang === 'zh' ? ['一', '二', '三', '四', '五', '六', '日'] : 
                         lang === 'ru' ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] : 
                         ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        let classList = '';
        for (let i = 0; i < classes.length; i++) {
          const cls = classes[i];
          classList += `${i+1}. **${cls.subject}** • ${cls.start_time}-${cls.end_time}\n`;
          if (cls.location) classList += `   📍 ${cls.location}\n`;
          classList += '\n';
        }
        const today = new Date().toLocaleDateString(lang === 'zh' ? 'zh-CN' : lang === 'ru' ? 'ru-RU' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        await sendMessage(userId, getResponse(lang, 'schedule_today', { date: today, classes: classList }), getMainKeyboard(lang));
      }
      return;
    }
    
    // ========== TOMORROW'S SCHEDULE ==========
    if (text === "📅 Tomorrow" || text === "📅 Завтра" || text === "📅 明天" || lowerText.includes('tomorrow') || lowerText.includes('завтра') || lowerText.includes('明天')) {
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
        const dateStr = tomorrow.toLocaleDateString(lang === 'zh' ? 'zh-CN' : lang === 'ru' ? 'ru-RU' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        await sendMessage(userId, getResponse(lang, 'schedule_tomorrow', { date: dateStr, classes: classList }), getMainKeyboard(lang));
      }
      return;
    }
    
    // ========== NEXT CLASS ==========
    if (text === "⏰ Next" || text === "⏰ Следующая" || text === "⏰ 下节课" || lowerText.includes('next class') || lowerText.includes('следующая пара') || lowerText.includes('下节课')) {
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
    
    // ========== MARK ATTENDANCE ==========
    if (text === "✅ Mark" || text === "✅ Отметить" || text === "✅ 标记出勤" || lowerText.includes('mark attendance') || lowerText.includes('отметить пару') || lowerText.includes('标记出勤')) {
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
        setTimeout(() => { if (userStates.get(userId)?.mode === 'attendance') userStates.delete(userId); }, 120000);
      }
      return;
    }
    
    // Handle attendance by number
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
    
    // Handle attendance by class name
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
    
    // ========== TASKS ==========
    if (text === "📝 Tasks" || text === "📝 Задачи" || text === "📝 我的任务" || lowerText.includes('my tasks') || lowerText.includes('мои задачи') || lowerText.includes('我的任务')) {
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
    
    // ========== COMPLETE TASK ==========
    const doneMatch = text.match(/(?:done|complete|finished|готово|сделано|выполнено|完成|做完了|好了)\s+(.+?)(?:\.|$)/i);
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
    
    // ========== STATISTICS ==========
    if (text === "📊 Stats" || text === "📊 Статистика" || text === "📊 统计" || lowerText.includes('stats') || lowerText.includes('statistics') || lowerText.includes('статистика') || lowerText.includes('统计')) {
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
      
      let motivationMsg = "";
      if (taskStats.rate > 80) motivationMsg = getResponse(lang, 'compliment', { name: displayName });
      else if (taskStats.rate > 50) motivationMsg = getResponse(lang, 'encouragement', { name: displayName });
      else motivationMsg = "Every step forward is progress! You've got this! 💪";
      
      msg += '\n\n' + getResponse(lang, 'motivation', { message: motivationMsg });
      
      await sendMessage(userId, msg, getMainKeyboard(lang));
      return;
    }
    
    // ========== IMPORT ==========
    if (text === "📥 Import" || text === "📥 Импорт" || text === "📥 导入" || lowerText.includes('import') || lowerText.includes('импорт') || lowerText.includes('导入')) {
      await sendMessage(userId, getResponse(lang, 'import_instructions'), getMainKeyboard(lang));
      return;
    }
    
    // ========== HELP ==========
    if (text === "❓ Help" || text === "❓ Помощь" || text === "❓ 帮助" || lowerText.includes('help') || lowerText.includes('помощь') || lowerText.includes('帮助')) {
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
            await sendMessage(userId, getResponse(lang, 'import_success', { count, name: displayName, reminder_minutes: reminderOffset }), getMainKeyboard(lang));
          } else {
            await sendMessage(userId, getResponse(lang, 'import_fail'), getMainKeyboard(lang));
          }
        }
      } else {
        await sendMessage(userId, getResponse(lang, 'import_instructions'), getMainKeyboard(lang));
      }
      return;
    }
    
    // ========== STUDY LOGGING ==========
    const studyMatch = text.match(/(?:study|studied|учился|занимался|学习|学了)\s+(\d+)\s+(?:minutes?|min|минут|分钟)(?:\s+(?:for\s+)?(.+?))?(?:\.|$)/i);
    if (studyMatch) {
      const duration = parseInt(studyMatch[1]);
      const subject = studyMatch[2]?.trim() || 'general';
      await addStudySession(userId, subject, duration);
      await sendMessage(userId, getResponse(lang, 'study_logged', { name: displayName, duration, subject }), getMainKeyboard(lang));
      return;
    }
    
    // ========== THANKS ==========
    if (lowerText.includes('thanks') || lowerText.includes('thank') || lowerText.includes('спасибо') || lowerText.includes('谢谢')) {
      await sendMessage(userId, getResponse(lang, 'thanks', { name: displayName }), getMainKeyboard(lang));
      return;
    }
    
    // ========== GOODBYE ==========
    if (lowerText.includes('goodbye') || lowerText.includes('bye') || lowerText.includes('до свидания') || lowerText.includes('再见')) {
      await sendMessage(userId, getResponse(lang, 'goodbye', { name: displayName }), getMainKeyboard(lang));
      return;
    }
    
    // ========== JOKE ==========
    if (lowerText.includes('joke') || lowerText.includes('jokes') || lowerText.includes('шутка') || lowerText.includes('笑话')) {
      const jokes = {
        en: ["Why don't scientists trust atoms? Because they make up everything!", "What do you call a fake noodle? An impasta!", "Why did the scarecrow win an award? He was outstanding in his field!"],
        zh: ["为什么科学家不相信原子？因为它们构成了一切！", "为什么数学书总是很悲伤？因为它有太多问题！", "为什么电脑总是很冷？因为它的窗户总是打开着！"],
        ru: ["Почему программисты путают Хэллоуин с Рождеством? 31 Oct = 25 Dec!", "Что говорит один ноль другому? Без тебя я просто пустое место!", "Почему студенты любят спать на лекциях? Потому что сон - лучшее лекарство от скуки!"]
      };
      const jokeList = jokes[lang] || jokes.en;
      const joke = jokeList[Math.floor(Math.random() * jokeList.length)];
      await sendMessage(userId, getResponse(lang, 'joke', { name: displayName, joke }), getMainKeyboard(lang));
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
    
    if (body.type === "confirmation") {
      console.log("Confirmation request received");
      return {
        statusCode: 200,
        body: process.env.VK_CONFIRMATION_TOKEN || "default_token",
      };
    }
    
    if (body.type === "message_new") {
      const message = body.object.message;
      const userId = message.from_id;
      const text = message.text || "";
      const attachments = message.attachments || [];
      
      console.log(`[${userId}] Message: "${text.substring(0, 50)}"`);
      
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
            await sendMessage(userId, getResponse(lang, 'import_success', { count, name: name || 'friend', reminder_minutes: reminderOffset }), getMainKeyboard(lang));
          } else {
            await sendMessage(userId, getResponse(lang, 'import_fail'), getMainKeyboard(lang));
          }
          return {
            statusCode: 200,
            body: JSON.stringify({ ok: true }),
          };
        }
      }
      
      // Handle ICS links
      const icsUrlMatch = text.match(/(https?:\/\/[^\s]+\.ics)/i);
      if (icsUrlMatch) {
        await sendMessage(userId, getResponse(lang, 'import_progress'), getMainKeyboard(lang));
        const reminderOffset = await getUserReminderOffset(userId);
        const count = await importIcsFromUrl(userId, icsUrlMatch[1]);
        const name = await getUserName(userId);
        if (count > 0) {
          await sendMessage(userId, getResponse(lang, 'import_success', { count, name: name || 'friend', reminder_minutes: reminderOffset }), getMainKeyboard(lang));
        } else {
          await sendMessage(userId, getResponse(lang, 'import_fail'), getMainKeyboard(lang));
        }
        return {
          statusCode: 200,
          body: JSON.stringify({ ok: true }),
        };
      }
      
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
startReminderSystem();
console.log("🌟 Perfect VK Bot is running!");
console.log("Languages supported: English, Russian, Chinese (中文)");
console.log("Features: Personal assistant, memory, politeness, schedule, tasks, attendance, reminders, ICS import");