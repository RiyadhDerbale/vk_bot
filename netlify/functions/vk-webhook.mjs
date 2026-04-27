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

// ========== CONFIGURATION ==========
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const VK_TOKEN = process.env.VK_TOKEN;
const VK_API_VERSION = "5.131";

// ========== CACHE SYSTEM ==========
const cache = new Map();
const userStates = new Map();
const CACHE_TTL = 300000;

function getCached(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCached(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

function clearCache(userId) {
  const keys = [`schedule_${userId}`, `tasks_${userId}`, `stats_${userId}`];
  keys.forEach(k => cache.delete(k));
}

// ========== LANGUAGE DETECTION ==========
function detectLanguage(text) {
  if (!text) return 'en';
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
  if (/[а-яА-ЯёЁ]/.test(text)) return 'ru';
  return 'en';
}

// ========== COMPLETE RESPONSES ==========
const RESPONSES = {
  en: {
    welcome: "🎓 Welcome to Smart Hour Bot!\n\nI'm your academic assistant that helps you manage classes, track assignments, and never miss deadlines.\n\nWhat's your name?",
    name_saved: "🎉 Great to meet you {name}!\n\nI'll help you stay on top of your academic schedule. What would you like to do?",
    welcome_back: "👋 Welcome back {name}!\n\n📊 Today: {classes} class(es) | 📝 {tasks} pending task(s)\n\nHow can I help you today?",
    
    // Schedule Management
    schedule_today: "📅 **TODAY'S SCHEDULE** - {date}\n\n{classes}─────────────────────\n💡 Reply with class number to mark attendance",
    schedule_tomorrow: "📅 **TOMORROW'S SCHEDULE** - {date}\n\n{classes}",
    schedule_week: "📅 **WEEKLY SCHEDULE**\n\n{week_schedule}",
    no_classes: "📭 No classes today {name}! Great time to catch up on assignments.\n\n📝 You have {tasks} pending task(s).",
    no_classes_tomorrow: "📭 No classes tomorrow {name}! Plan your study time wisely.",
    
    add_class_instruction: "📝 **Add a Class**\n\nSend: /addclass [Subject] [Day] [Start] [End] [Location]\n\n📅 Days: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun\n⏰ Time: HH:MM format\n📍 Location: optional\n\nExample: /addclass Mathematics 1 10:30 12:05 Room 201",
    class_added: "✅ Class added: {subject} on {day} at {start}-{end}\n📍 {location}\n\n🔔 I'll remind you 60 minutes before each class!",
    class_deleted: "🗑️ Removed class: {subject}",
    class_not_found: "❌ Class not found. Use '/myclasses' to see your schedule.",
    my_classes: "📚 **YOUR CLASSES**\n\n{classes}",
    
    // Next Class & Reminders
    next_class: "⏰ **NEXT CLASS**\n\n📚 {subject}\n🕐 {time}\n📍 {location}\n⏱️ In {minutes} minutes\n\n🔔 I'll remind you 60 minutes before!",
    no_next_class: "✅ No more classes today {name}! Time to focus on assignments.\n📝 You have {tasks} pending task(s).",
    class_reminder: "🔔 **CLASS REMINDER**\n\n📚 {subject}\n🕐 {time}\n📍 {location}\n⏱️ Starts in {minutes} minutes!\n\n✅ After class, reply 'mark {subject}' to record attendance.",
    reminder_set: "✅ Reminder time updated!\n\n🔔 I'll notify you {minutes} minutes before each class.\nRange: 5-120 minutes",
    reminder_current: "🔔 Current reminder: {minutes} minutes before class.\n\nUse /reminder <minutes> to change (5-120)",
    
    // Tasks / Assignments
    tasks_header: "📋 **YOUR ASSIGNMENTS**\n\n✅ Completed: {completed}\n⏳ Pending: {pending}\n\n{tasks}─────────────────────\n💡 Reply 'done [task name]' to mark complete",
    no_tasks: "✅ **NO PENDING ASSIGNMENTS** {name}! 🎉\n\n📊 Great job staying on top of your work!\n\n📅 Check your schedule with 'today'",
    task_added: "✅ **ASSIGNMENT ADDED**\n\n📝 {task}\n📅 Due: {due_date}\n🔔 Reminder: {days} day(s) before\n⚡ Priority: {priority}\n\nI'll remind you before the deadline!",
    task_completed: "🎉 **CONGRATULATIONS {name}!** 🎉\n\n✅ Completed: {task}\n\n📊 Your productivity score increased! Say 'stats' to see progress.",
    task_deleted: "🗑️ Removed assignment: {task}",
    task_not_found: "❌ Assignment '{task}' not found.\n\n💡 Say 'tasks' to see your current assignments.",
    task_reminder: "⏰ **ASSIGNMENT REMINDER**\n\n📝 {task}\n📅 Due: {due_date}\n⏱️ {days_left} day(s) left!\n\nDon't forget to complete it!",
    high_priority_task: "⚠️ **HIGH PRIORITY** ⚠️\n\n{task} is due tomorrow!",
    
    // Attendance
    attendance_prompt: "📚 **MARK ATTENDANCE**\n\nToday's classes:\n{classes}\n\n─────────────────────\nReply with NUMBER or CLASS NAME:",
    attendance_marked: "✅ **ATTENDANCE RECORDED**\n\nClass: {class_name}\n{streak_msg}\n📊 Attendance rate updated!",
    already_marked: "ℹ️ You already marked '{class_name}' today! ✅",
    attendance_streak: "🔥 **ATTENDANCE STREAK!** 🔥\n\n{name}, you've attended {streak} classes in a row!\nKeep it up!",
    attendance_stats_updated: "📊 Your attendance record has been updated!",
    
    // Statistics
    stats_header: "📊 **YOUR STUDY STATISTICS**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n",
    task_stats: "📝 **ASSIGNMENTS**\n• ✅ Completed: {completed}\n• ⏳ Pending: {pending}\n• 🎯 Completion Rate: {rate}%\n   [{bar}]\n• 📈 Productivity Score: {score}/100",
    attendance_stats: "📚 **CLASS ATTENDANCE**\n• 📖 Total Classes: {total}\n• ✅ Attended: {attended}\n• ❌ Missed: {missed}\n• 📈 Attendance Rate: {rate}%\n   [{bar}]",
    progress_message: "💡 **PRODUCTIVITY INSIGHT**\n{message}",
    
    // ICS Calendar Import
    import_instructions: "📥 **IMPORT CALENDAR**\n\nSend me an ICS calendar file to automatically sync your schedule!\n\n📁 How to use:\n1️⃣ Download .ics file from your university portal\n2️⃣ Attach the file to this chat\n3️⃣ I'll extract all classes automatically\n\n🔔 Reminders will be set for each class!\n\n💡 Or use: /ics [calendar-url]",
    import_progress: "⏳ **Processing your calendar**...\n\nThis may take a few seconds. Please wait ⏳",
    import_success: "🎉 **CALENDAR IMPORTED!** 🎉\n\n✅ Added {count} classes to your schedule\n🔔 Reminders set {reminder} minutes before each class\n📅 Say 'today' to see your schedule!\n\n📊 Say 'stats' to track your progress!",
    import_fail: "❌ **IMPORT FAILED**\n\nMake sure you're sending a valid ICS calendar file.\n\n💡 Tips:\n• Download the .ics file from your university\n• Attach it directly to this chat\n• Try again with a valid file",
    file_import_success: "📁 **CALENDAR IMPORTED FROM FILE**\n\n✅ Added {count} classes to your schedule!",
    
    // Help & Commands
    help_text: "🎓 **SMART HOUR BOT - HELP**\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📅 **SCHEDULE MANAGEMENT**\n• 'today' - Today's classes\n• 'tomorrow' - Tomorrow's classes\n• 'week' - Weekly schedule\n• 'next class' - Upcoming class\n• Send .ics file - Import calendar\n\n✅ **ATTENDANCE TRACKING**\n• 'mark' - Mark today's attendance\n• 'mark [class]' - Quick attendance mark\n\n📝 **ASSIGNMENT TRACKING**\n• 'tasks' - View assignments\n• '/task \"Task\" YYYY-MM-DD HH:MM days priority'\n• 'done [task]' - Complete assignment\n• 'delete [task]' - Remove assignment\n\n⚙️ **REMINDER SETTINGS**\n• '/reminder 45' - Set reminder time\n• '/reminder' - Check current setting\n\n📊 **PROGRESS TRACKING**\n• 'stats' - View your statistics\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💡 **TIP**: I remember everything! Track your attendance and assignments to see your progress over time.",
    
    // Interactive Menu
    main_menu: "🎓 **SMART HOUR BOT**\n\nChoose an option below:",
    
    // Quick Responses
    thanks: "😊 You're welcome {name}! Anything else I can help with?\n\n📊 Say 'stats' to see your progress!",
    goodbye: "👋 Goodbye {name}!\n\n📅 Don't forget to check your schedule tomorrow!\n📝 Stay on top of your assignments!\n\nCome back anytime!",
    error: "❌ Oops! Something went wrong.\n\nPlease try again or say 'help' for assistance.",
    unknown: "🤔 I'm not sure about that {name}.\n\nTry one of these commands:\n• 'today' - See your schedule\n• 'tasks' - View assignments\n• 'mark' - Record attendance\n• 'stats' - Check progress\n• 'help' - All commands",
    
    // Status
    ping: "🏓 Pong! Bot is active and ready!\n\n📅 Schedule loaded: {classes} classes\n📝 Tasks tracked: {tasks} assignments\n✅ Ready to help!",
    status: "🟢 **SMART HOUR BOT - ONLINE**\n\n📊 System Status:\n• Schedule Management: ✅\n• Task Tracking: ✅\n• Attendance System: ✅\n• Reminders: ✅\n• ICS Import: ✅\n\nReady to help you stay organized! 🎓",
    about: "🎓 **Smart Hour Bot v2.0**\n\nI'm your academic assistant designed to help university students manage their schedule and deadlines directly through VK.\n\n📅 Schedule Management\n📝 Assignment Tracking\n✅ Attendance Recording\n⏰ Smart Reminders\n📥 Calendar Import\n\nStay organized and never miss a deadline! 🚀"
  },
  
  ru: {
    welcome: "🎓 Добро пожаловать в Smart Hour Bot!\n\nЯ твой академический помощник. Как тебя зовут?",
    name_saved: "🎉 Приятно познакомиться {name}!\n\nЯ помогу тебе следить за расписанием и дедлайнами. Что хочешь сделать?",
    welcome_back: "👋 С возвращением {name}!\n\n📊 Сегодня: {classes} пар(ы) | 📝 {tasks} задач(и)\n\nЧем помочь?",
    
    schedule_today: "📅 **РАСПИСАНИЕ НА СЕГОДНЯ** - {date}\n\n{classes}─────────────────────\n💡 Ответь номером чтобы отметить посещение",
    schedule_tomorrow: "📅 **РАСПИСАНИЕ НА ЗАВТРА** - {date}\n\n{classes}",
    schedule_week: "📅 **РАСПИСАНИЕ НА НЕДЕЛЮ**\n\n{week_schedule}",
    no_classes: "📭 Сегодня нет пар {name}! Отличное время для задач.\n\n📝 У тебя {tasks} задач(и).",
    no_classes_tomorrow: "📭 Завтра нет пар {name}! Планируй время wisely.",
    
    add_class_instruction: "📝 **Добавить пару**\n\nОтправь: /addclass [Предмет] [День] [Начало] [Конец] [Место]\n\n📅 Дни: 0=Пн, 1=Вт, 2=Ср, 3=Чт, 4=Пт, 5=Сб, 6=Вс\n⏰ Время: ЧЧ:ММ\n📍 Место: опционально\n\nПример: /addclass Математика 1 10:30 12:05 Ауд 201",
    class_added: "✅ Пара добавлена: {subject} в {day} {start}-{end}\n📍 {location}\n\n🔔 Напомню за 60 минут!",
    class_deleted: "🗑️ Удалена пара: {subject}",
    class_not_found: "❌ Пара не найдена. Используй '/myclasses' для просмотра.",
    my_classes: "📚 **ТВОИ ПАРЫ**\n\n{classes}",
    
    next_class: "⏰ **СЛЕДУЮЩАЯ ПАРА**\n\n📚 {subject}\n🕐 {time}\n📍 {location}\n⏱️ Через {minutes} минут\n\n🔔 Напомню за 60 минут!",
    no_next_class: "✅ Сегодня больше нет пар {name}! Время для задач.\n📝 У тебя {tasks} задач(и).",
    class_reminder: "🔔 **НАПОМИНАНИЕ О ПАРЕ**\n\n📚 {subject}\n🕐 {time}\n📍 {location}\n⏱️ Начинается через {minutes} минут!\n\n✅ После пары ответь 'отметить {subject}' для посещения.",
    reminder_set: "✅ Напоминание обновлено!\n\n🔔 Напомню за {minutes} минут до пары.\nДиапазон: 5-120 минут",
    reminder_current: "🔔 Сейчас: напоминание за {minutes} минут до пары.\n\nИспользуй /reminder <минуты> для изменения (5-120)",
    
    tasks_header: "📋 **ТВОИ ЗАДАЧИ**\n\n✅ Выполнено: {completed}\n⏳ Ожидает: {pending}\n\n{tasks}─────────────────────\n💡 Ответь 'готово [задача]' для отметки",
    no_tasks: "✅ **НЕТ АКТИВНЫХ ЗАДАЧ** {name}! 🎉\n\n📊 Отличная работа!\n\n📅 Проверь расписание 'сегодня'",
    task_added: "✅ **ЗАДАЧА ДОБАВЛЕНА**\n\n📝 {task}\n📅 Дедлайн: {due_date}\n🔔 Напомню за {days} дн.\n⚡ Приоритет: {priority}",
    task_completed: "🎉 **ПОЗДРАВЛЯЮ {name}!** 🎉\n\n✅ Выполнено: {task}\n\n📊 Твоя продуктивность выросла! Скажи 'статистика'.",
    task_deleted: "🗑️ Удалена задача: {task}",
    task_not_found: "❌ Задача '{task}' не найдена.\n\n💡 Скажи 'задачи' для просмотра.",
    task_reminder: "⏰ **НАПОМИНАНИЕ О ЗАДАЧЕ**\n\n📝 {task}\n📅 Дедлайн: {due_date}\n⏱️ Осталось {days_left} дн.\n\nНе забудь выполнить!",
    high_priority_task: "⚠️ **ВЫСОКИЙ ПРИОРИТЕТ** ⚠️\n\n{task} завтра дедлайн!",
    
    attendance_prompt: "📚 **ОТМЕТИТЬ ПОСЕЩЕНИЕ**\n\nПары сегодня:\n{classes}\n\n─────────────────────\nОтветь НОМЕРОМ или НАЗВАНИЕМ:",
    attendance_marked: "✅ **ПОСЕЩЕНИЕ ОТМЕЧЕНО**\n\nПара: {class_name}\n{streak_msg}\n📊 Посещаемость обновлена!",
    already_marked: "ℹ️ Ты уже отметил '{class_name}' сегодня! ✅",
    attendance_streak: "🔥 **СЕРИЯ ПОСЕЩЕНИЙ!** 🔥\n\n{name}, ты посетил {streak} пар(ы) подряд!\nТак держать!",
    attendance_stats_updated: "📊 Твоя посещаемость обновлена!",
    
    stats_header: "📊 **ТВОЯ СТАТИСТИКА УЧЁБЫ**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n",
    task_stats: "📝 **ЗАДАЧИ**\n• ✅ Выполнено: {completed}\n• ⏳ Ожидает: {pending}\n• 🎯 Процент: {rate}%\n   [{bar}]\n• 📈 Продуктивность: {score}/100",
    attendance_stats: "📚 **ПОСЕЩАЕМОСТЬ**\n• 📖 Всего пар: {total}\n• ✅ Посещено: {attended}\n• ❌ Пропущено: {missed}\n• 📈 Процент: {rate}%\n   [{bar}]",
    progress_message: "💡 **СОВЕТ ПО ПРОДУКТИВНОСТИ**\n{message}",
    
    import_instructions: "📥 **ИМПОРТ РАСПИСАНИЯ**\n\nОтправь мне ICS файл календаря для автоматической синхронизации!\n\n📁 Как использовать:\n1️⃣ Скачай .ics файл из университетского портала\n2️⃣ Прикрепи файл к этому сообщению\n3️⃣ Я извлеку все пары автоматически\n\n🔔 Напоминания будут установлены для каждой пары!\n\n💡 Или используй: /ics [ссылка]",
    import_progress: "⏳ **Обрабатываю календарь**...\n\nЭто может занять несколько секунд. Пожалуйста, подожди ⏳",
    import_success: "🎉 **КАЛЕНДАРЬ ИМПОРТИРОВАН!** 🎉\n\n✅ Добавлено {count} пар в расписание\n🔔 Напоминания за {reminder} минут\n📅 Скажи 'сегодня' для просмотра!\n\n📊 Скажи 'статистика' для отслеживания прогресса!",
    import_fail: "❌ **ОШИБКА ИМПОРТА**\n\nУбедись что отправляешь правильный ICS файл.\n\n💡 Советы:\n• Скачай .ics файл из университета\n• Прикрепи его к этому чату\n• Попробуй снова",
    file_import_success: "📁 **КАЛЕНДАРЬ ИМПОРТИРОВАН ИЗ ФАЙЛА**\n\n✅ Добавлено {count} пар в расписание!",
    
    help_text: "🎓 **SMART HOUR BOT - ПОМОЩЬ**\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📅 **РАСПИСАНИЕ**\n• 'сегодня' - Пары сегодня\n• 'завтра' - Пары завтра\n• 'неделя' - Расписание на неделю\n• 'следующая пара' - Следующая пара\n• Отправь .ics - Импорт календаря\n\n✅ **ПОСЕЩАЕМОСТЬ**\n• 'отметить' - Отметить пары\n• 'отметить [пара]' - Быстрая отметка\n\n📝 **ЗАДАЧИ**\n• 'задачи' - Список задач\n• '/task \"Задача\" 2025-12-20 23:59 3 high'\n• 'готово [задача]' - Выполнить\n• 'удалить [задача]' - Удалить\n\n⚙️ **НАПОМИНАНИЯ**\n• '/reminder 45' - Установить время\n• '/reminder' - Текущая настройка\n\n📊 **СТАТИСТИКА**\n• 'статистика' - Твой прогресс\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💡 **СОВЕТ**: Я всё помню! Отмечай посещаемость и выполняй задачи, чтобы видеть свой прогресс.",
    
    main_menu: "🎓 **SMART HOUR BOT**\n\nВыбери опцию ниже:",
    
    thanks: "😊 Пожалуйста {name}! Ещё чем помочь?\n\n📊 Скажи 'статистика' для просмотра прогресса!",
    goodbye: "👋 До свидания {name}!\n\n📅 Не забудь проверить расписание завтра!\n📝 Выполняй задачи вовремя!\n\nВозвращайся в любое время!",
    error: "❌ Упс! Что-то пошло не так.\n\nПожалуйста, попробуй ещё раз или скажи 'помощь'.",
    unknown: "🤔 Я не уверен насчёт этого {name}.\n\nПопробуй одну из команд:\n• 'сегодня' - Расписание\n• 'задачи' - Список задач\n• 'отметить' - Посещаемость\n• 'статистика' - Прогресс\n• 'помощь' - Все команды",
    
    ping: "🏓 Понг! Бот активен и готов!\n\n📅 Загружено пар: {classes}\n📝 Задач отслеживается: {tasks}\n✅ Готов помочь!",
    status: "🟢 **SMART HOUR BOT - ОНЛАЙН**\n\n📊 Статус системы:\n• Управление расписанием: ✅\n• Отслеживание задач: ✅\n• Система посещений: ✅\n• Напоминания: ✅\n• Импорт ICS: ✅\n\nГотов помочь оставаться организованным! 🎓",
    about: "🎓 **Smart Hour Bot v2.0**\n\nЯ твой академический помощник для управления расписанием и дедлайнами через ВК.\n\n📅 Управление расписанием\n📝 Отслеживание задач\n✅ Запись посещений\n⏰ Умные напоминания\n📥 Импорт календаря\n\nБудь организован и не пропускай дедлайны! 🚀"
  },
  
  zh: {
    welcome: "🎓 欢迎使用智能课时机器人！\n\n我是你的学术助手。请问你叫什么名字？",
    name_saved: "🎉 很高兴认识你{name}！\n\n我会帮你管理课程安排和作业截止日期。你想做什么？",
    welcome_back: "👋 欢迎回来{name}！\n\n📊 今天：{classes}节课 | 📝 {tasks}个任务\n\n今天需要什么帮助？",
    
    schedule_today: "📅 **今日课表** - {date}\n\n{classes}─────────────────────\n💡 回复课程编号标记出勤",
    schedule_tomorrow: "📅 **明日课表** - {date}\n\n{classes}",
    schedule_week: "📅 **周课表**\n\n{week_schedule}",
    no_classes: "📭 今天没课{name}！正好处理任务。\n\n📝 你有{tasks}个待办任务。",
    no_classes_tomorrow: "📭 明天没课{name}！合理安排学习时间。",
    
    add_class_instruction: "📝 **添加课程**\n\n发送：/addclass [科目] [星期] [开始] [结束] [地点]\n\n📅 星期：0=一,1=二,2=三,3=四,4=五,5=六,6=日\n⏰ 时间：HH:MM格式\n📍 地点：可选\n\n示例：/addclass 数学 1 10:30 12:05 201教室",
    class_added: "✅ 课程已添加：{subject} 星期{day} {start}-{end}\n📍 {location}\n\n🔔 我会提前60分钟提醒你！",
    class_deleted: "🗑️ 已删除课程：{subject}",
    class_not_found: "❌ 未找到课程。使用'/myclasses'查看课表。",
    my_classes: "📚 **你的课程**\n\n{classes}",
    
    next_class: "⏰ **下节课**\n\n📚 {subject}\n🕐 {time}\n📍 {location}\n⏱️ {minutes}分钟后开始\n\n🔔 我会提前60分钟提醒！",
    no_next_class: "✅ 今天没课了{name}！处理任务吧。\n📝 你有{tasks}个待办任务。",
    class_reminder: "🔔 **上课提醒**\n\n📚 {subject}\n🕐 {time}\n📍 {location}\n⏱️ {minutes}分钟后开始！\n\n✅ 课后回复'标记{subject}'记录出勤。",
    reminder_set: "✅ 提醒时间已更新！\n\n🔔 我会在课前{minutes}分钟通知你。\n范围：5-120分钟",
    reminder_current: "🔔 当前提醒：课前{minutes}分钟。\n\n使用 /reminder <分钟> 更改(5-120)",
    
    tasks_header: "📋 **你的作业**\n\n✅ 已完成：{completed}\n⏳ 待办：{pending}\n\n{tasks}─────────────────────\n💡 回复'完成 [任务名]'标记完成",
    no_tasks: "✅ **没有待办任务** {name}！🎉\n\n📊 你做得很好！\n\n📅 说'今天'查看课表",
    task_added: "✅ **作业已添加**\n\n📝 {task}\n📅 截止：{due_date}\n🔔 提前{days}天提醒\n⚡ 优先级：{priority}",
    task_completed: "🎉 **恭喜{name}！** 🎉\n\n✅ 已完成：{task}\n\n📊 你的生产力提高了！说'统计'查看进度。",
    task_deleted: "🗑️ 已删除作业：{task}",
    task_not_found: "❌ 找不到作业'{task}'。\n\n💡 说'任务'查看当前作业。",
    task_reminder: "⏰ **作业提醒**\n\n📝 {task}\n📅 截止：{due_date}\n⏱️ 还剩{days_left}天！\n\n别忘了完成！",
    high_priority_task: "⚠️ **高优先级** ⚠️\n\n{task} 明天截止！",
    
    attendance_prompt: "📚 **标记出勤**\n\n今日课程：\n{classes}\n\n─────────────────────\n回复数字或课程名称：",
    attendance_marked: "✅ **出勤已记录**\n\n课程：{class_name}\n{streak_msg}\n📊 出勤率已更新！",
    already_marked: "ℹ️ 你今天已经标记过'{class_name}'了！✅",
    attendance_streak: "🔥 **出勤连续记录！** 🔥\n\n{name}，你已经连续出勤{streak}节课！\n继续加油！",
    attendance_stats_updated: "📊 你的出勤记录已更新！",
    
    stats_header: "📊 **你的学习统计**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n",
    task_stats: "📝 **作业**\n• ✅ 已完成：{completed}\n• ⏳ 待办：{pending}\n• 🎯 完成率：{rate}%\n   [{bar}]\n• 📈 生产力分数：{score}/100",
    attendance_stats: "📚 **出勤**\n• 📖 总计：{total}\n• ✅ 已出勤：{attended}\n• ❌ 缺勤：{missed}\n• 📈 出勤率：{rate}%\n   [{bar}]",
    progress_message: "💡 **生产力洞察**\n{message}",
    
    import_instructions: "📥 **导入课表**\n\n发送ICS日历文件自动同步课表！\n\n📁 使用方法：\n1️⃣ 从学校网站下载.ics文件\n2️⃣ 在对话中附件发送文件\n3️⃣ 我会自动提取所有课程\n\n🔔 每节课都会设置提醒！\n\n💡 或使用：/ics [日历链接]",
    import_progress: "⏳ **正在处理日历**...\n\n可能需要几秒钟。请稍等 ⏳",
    import_success: "🎉 **日历导入成功！** 🎉\n\n✅ 已添加{count}门课程\n🔔 课前{reminder}分钟提醒\n📅 说'今天'查看课表！\n\n📊 说'统计'跟踪进度！",
    import_fail: "❌ **导入失败**\n\n请确保发送的是有效的ICS日历文件。\n\n💡 提示：\n• 从学校下载.ics文件\n• 直接附件发送\n• 再试一次",
    file_import_success: "📁 **已从文件导入日历**\n\n✅ 已添加{count}门课程到课表！",
    
    help_text: "🎓 **智能课时机器人 - 帮助**\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📅 **课表管理**\n• '今天' - 今日课程\n• '明天' - 明日课程\n• '周课表' - 周课表\n• '下节课' - 下一节课\n• 发送.ics文件 - 导入日历\n\n✅ **出勤跟踪**\n• '标记' - 标记今日出勤\n• '标记 [课程]' - 快速标记\n\n📝 **作业跟踪**\n• '任务' - 查看作业\n• '/task \"作业\" 2025-12-20 23:59 3 high'\n• '完成 [作业]' - 完成作业\n• '删除 [作业]' - 删除作业\n\n⚙️ **提醒设置**\n• '/reminder 45' - 设置提醒时间\n• '/reminder' - 查看当前设置\n\n📊 **进度跟踪**\n• '统计' - 查看你的统计\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💡 **提示**：我能记住一切！标记出勤和完成任务，看到你的进步。",
    
    main_menu: "🎓 **智能课时机器人**\n\n选择以下选项：",
    
    thanks: "😊 不客气{name}！还有什么需要帮忙的吗？\n\n📊 说'统计'查看你的进度！",
    goodbye: "👋 再见{name}！\n\n📅 别忘了查看明天的课表！\n📝 按时完成任务！\n\n随时回来！",
    error: "❌ 哎呀！出了点问题。\n\n请再试一次或说'帮助'。",
    unknown: "🤔 我不太确定{name}的意思。\n\n试试以下命令：\n• '今天' - 查看课表\n• '任务' - 查看作业\n• '标记' - 记录出勤\n• '统计' - 查看进度\n• '帮助' - 所有命令",
    
    ping: "🏓 Pong！机器人活跃且就绪！\n\n📅 已加载课程：{classes}门\n📝 跟踪作业：{tasks}个\n✅ 准备就绪！",
    status: "🟢 **智能课时机器人 - 在线**\n\n📊 系统状态：\n• 课表管理：✅\n• 作业跟踪：✅\n• 出勤系统：✅\n• 提醒功能：✅\n• ICS导入：✅\n\n准备好帮你保持组织！🎓",
    about: "🎓 **智能课时机器人 v2.0**\n\n我是你的学术助手，通过VK帮助大学生管理课程安排和截止日期。\n\n📅 课表管理\n📝 作业跟踪\n✅ 出勤记录\n⏰ 智能提醒\n📥 日历导入\n\n保持组织，永不错过截止日期！🚀"
  }
};

// ========== VK API HELPERS ==========
async function sendMessage(userId, text, keyboard = null) {
  try {
    const params = new URLSearchParams();
    params.append("access_token", VK_TOKEN);
    params.append("v", VK_API_VERSION);
    params.append("user_id", userId);
    params.append("message", text);
    params.append("random_id", Date.now());
    if (keyboard) params.append("keyboard", keyboard);
    
    const response = await fetch(`https://api.vk.com/method/messages.send?${params}`);
    const data = await response.json();
    if (data.error) console.error("VK API Error:", data.error);
    return data;
  } catch (error) {
    console.error("Send message error:", error);
    return null;
  }
}

function getMainKeyboard(lang) {
  if (lang === 'zh') {
    return JSON.stringify({
      one_time: false,
      buttons: [
        [{ action: { type: "text", label: "📅 今天" }, color: "primary" }, { action: { type: "text", label: "📅 明天" }, color: "primary" }],
        [{ action: { type: "text", label: "⏰ 下节课" }, color: "secondary" }, { action: { type: "text", label: "📝 任务" }, color: "positive" }],
        [{ action: { type: "text", label: "✅ 标记" }, color: "positive" }, { action: { type: "text", label: "📊 统计" }, color: "secondary" }],
        [{ action: { type: "text", label: "📥 导入" }, color: "primary" }, { action: { type: "text", label: "❓ 帮助" }, color: "secondary" }]
      ]
    });
  } else if (lang === 'ru') {
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

function getResponse(lang, key, vars = {}) {
  let text = RESPONSES[lang]?.[key] || RESPONSES.en[key] || key;
  Object.entries(vars).forEach(([k, v]) => text = text.replace(new RegExp(`{${k}}`, 'g'), v));
  return text;
}

// ========== DATABASE OPERATIONS ==========
async function getUser(userId) {
  const cached = getCached(`user_${userId}`);
  if (cached) return cached;
  
  try {
    const { data } = await supabase.from("users").select("*").eq("vk_id", userId).single();
    if (data) setCached(`user_${userId}`, data);
    return data;
  } catch { return null; }
}

async function saveUser(userId, data) {
  try {
    await supabase.from("users").upsert({ vk_id: userId, ...data }, { onConflict: "vk_id" });
    setCached(`user_${userId}`, { vk_id: userId, ...data });
    return true;
  } catch { return false; }
}

async function getReminderOffset(userId) {
  const user = await getUser(userId);
  return user?.reminder_offset || 60;
}

async function setReminderOffset(userId, minutes) {
  return saveUser(userId, { reminder_offset: Math.min(120, Math.max(5, minutes)) });
}

// ========== SCHEDULE FUNCTIONS ==========
async function addClass(userId, subject, day, start, end, location = '') {
  try {
    await supabase.from("schedule").insert({
      user_id: userId, subject, day, start_time: start, end_time: end, location
    });
    clearCache(userId);
    return true;
  } catch { return false; }
}

async function getSchedule(userId) {
  const cached = getCached(`schedule_${userId}`);
  if (cached) return cached;
  
  try {
    const { data } = await supabase
      .from("schedule")
      .select("*")
      .eq("user_id", userId)
      .order("day", { ascending: true })
      .order("start_time", { ascending: true });
    const result = data || [];
    setCached(`schedule_${userId}`, result);
    return result;
  } catch { return []; }
}

async function getTodayClasses(userId) {
  const day = (new Date().getDay() + 6) % 7;
  const schedule = await getSchedule(userId);
  return schedule.filter(c => c.day === day);
}

async function getTomorrowClasses(userId) {
  const day = (new Date().getDay() + 7) % 7;
  const schedule = await getSchedule(userId);
  return schedule.filter(c => c.day === day);
}

async function getWeekSchedule(userId) {
  const schedule = await getSchedule(userId);
  const weekMap = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  schedule.forEach(c => weekMap[c.day].push(c));
  return weekMap;
}

async function getNextClass(userId) {
  const now = new Date();
  const currentDay = (now.getDay() + 6) % 7;
  const currentMin = now.getHours() * 60 + now.getMinutes();
  const schedule = await getSchedule(userId);
  const sorted = [...schedule].sort((a, b) => a.day - b.day || a.start_time.localeCompare(b.start_time));
  
  for (const c of sorted) {
    const [h, m] = c.start_time.split(':').map(Number);
    const classMin = h * 60 + m;
    if (c.day > currentDay || (c.day === currentDay && classMin > currentMin)) return c;
  }
  return sorted[0] || null;
}

async function deleteClass(userId, subject, day, startTime) {
  try {
    await supabase
      .from("schedule")
      .delete()
      .eq("user_id", userId)
      .eq("subject", subject)
      .eq("day", day)
      .eq("start_time", startTime);
    clearCache(userId);
    return true;
  } catch { return false; }
}

// ========== TASK FUNCTIONS ==========
async function addTask(userId, task, due, days, priority = 'normal') {
  try {
    await supabase.from("tasks").insert({
      user_id: userId, task, due_date: due, remind_days: days, priority, done: 0
    });
    clearCache(userId);
    return true;
  } catch { return false; }
}

async function getTasks(userId, pending = true) {
  const cached = getCached(`tasks_${userId}`);
  if (cached) return cached;
  
  try {
    let query = supabase.from("tasks").select("*").eq("user_id", userId);
    if (pending) query = query.eq("done", 0);
    const { data } = await query.order("due_date", { ascending: true });
    const result = data || [];
    setCached(`tasks_${userId}`, result);
    return result;
  } catch { return []; }
}

async function completeTask(taskId, userId) {
  try {
    await supabase.from("tasks").update({ done: 1, completed_date: new Date().toISOString() }).eq("id", taskId);
    
    const today = new Date().toISOString().split('T')[0];
    const { data: daily } = await supabase.from("daily_stats").select("id").eq("user_id", userId).eq("date", today).single();
    if (daily) {
      await supabase.from("daily_stats").update({ tasks_completed: (daily.tasks_completed || 0) + 1 }).eq("id", daily.id);
    } else {
      await supabase.from("daily_stats").insert({ user_id: userId, date: today, tasks_completed: 1 });
    }
    clearCache(userId);
    return true;
  } catch { return false; }
}

async function deleteTask(taskId, userId) {
  try {
    await supabase.from("tasks").delete().eq("id", taskId);
    clearCache(userId);
    return true;
  } catch { return false; }
}

async function findTaskByName(userId, name) {
  const tasks = await getTasks(userId, true);
  return tasks.find(t => t.task.toLowerCase().includes(name.toLowerCase()));
}

async function getTaskStats(userId) {
  const tasks = await getTasks(userId, false);
  const pending = tasks.filter(t => !t.done).length;
  const completed = tasks.filter(t => t.done).length;
  const rate = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  const score = Math.min(100, Math.floor(rate * 0.9 + (completed * 2)));
  return { pending, completed, rate, score };
}

// ========== ATTENDANCE FUNCTIONS ==========
async function markAttendance(userId, className) {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    const { data: existing } = await supabase
      .from("attendance")
      .select("id")
      .eq("user_id", userId)
      .eq("class_name", className)
      .eq("date", today)
      .single();
    
    if (existing) return { success: false, already: true };
    
    await supabase.from("attendance").insert({ user_id: userId, class_name: className, date: today, attended: 1 });
    
    const { data: streakData } = await supabase
      .from("attendance")
      .select("date")
      .eq("user_id", userId)
      .eq("attended", 1)
      .order("date", { ascending: false })
      .limit(10);
    
    let streakCount = 0;
    let expected = new Date(today);
    for (const s of streakData || []) {
      const d = new Date(s.date);
      const diff = Math.floor((expected - d) / 86400000);
      if (diff === 1) { streakCount++; expected = d; }
      else if (diff !== 0) break;
    }
    
    const { data: daily } = await supabase.from("daily_stats").select("id").eq("user_id", userId).eq("date", today).single();
    if (daily) {
      await supabase.from("daily_stats").update({ classes_attended: (daily.classes_attended || 0) + 1 }).eq("id", daily.id);
    } else {
      await supabase.from("daily_stats").insert({ user_id: userId, date: today, classes_attended: 1 });
    }
    
    clearCache(userId);
    return { success: true, already: false, streak: streakCount };
  } catch { return { success: false, already: false }; }
}

async function getAttendanceStats(userId) {
  const cached = getCached(`attendance_${userId}`);
  if (cached) return cached;
  
  try {
    const { data } = await supabase.from("attendance").select("attended").eq("user_id", userId);
    if (!data?.length) return { total: 0, attended: 0, missed: 0, rate: 0 };
    
    const total = data.length;
    const attended = data.filter(a => a.attended).length;
    const missed = total - attended;
    const rate = Math.round(attended / total * 100);
    const result = { total, attended, missed, rate };
    setCached(`attendance_${userId}`, result);
    return result;
  } catch { return { total: 0, attended: 0, missed: 0, rate: 0 }; }
}

// ========== ICS CALENDAR IMPORT ==========
async function importICSFromUrl(userId, url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (!response.ok) return -1;
    const content = await response.text();
    return await parseICSAndSave(userId, content);
  } catch (error) {
    console.error("ICS URL import error:", error);
    return -1;
  }
}

async function importICSFromFile(userId, fileUrl) {
  try {
    const response = await fetch(fileUrl);
    if (!response.ok) return -1;
    const content = await response.text();
    return await parseICSAndSave(userId, content);
  } catch (error) {
    console.error("ICS file import error:", error);
    return -1;
  }
}

async function parseICSAndSave(userId, icsContent) {
  try {
    const lines = icsContent.split(/\r?\n/);
    const events = [];
    let currentEvent = null;
    let addedCount = 0;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed === 'BEGIN:VEVENT') {
        currentEvent = {};
      } else if (trimmed === 'END:VEVENT' && currentEvent) {
        if (currentEvent.summary && currentEvent.summary !== '') {
          events.push(currentEvent);
        }
        currentEvent = null;
      } else if (currentEvent) {
        if (trimmed.startsWith('SUMMARY:')) {
          currentEvent.summary = trimmed.substring(8).replace(/\\,/g, ',').replace(/\\n/g, ' ').trim();
        } else if (trimmed.startsWith('DTSTART')) {
          const match = trimmed.match(/DTSTART(?:;TZID=[^:]+)?:(\d{8}T\d{6})/);
          if (match) {
            currentEvent.dtstart = match[1];
          }
        } else if (trimmed.startsWith('DTEND')) {
          const match = trimmed.match(/DTEND(?:;TZID=[^:]+)?:(\d{8}T\d{6})/);
          if (match) {
            currentEvent.dtend = match[1];
          }
        } else if (trimmed.startsWith('LOCATION:')) {
          currentEvent.location = trimmed.substring(9).replace(/\\,/g, ',').replace(/\\n/g, ' ').trim();
        }
      }
    }
    
    for (const event of events) {
      let startTime = '09:00';
      let endTime = '10:00';
      let dayOfWeek = 0;
      
      if (event.dtstart) {
        const year = parseInt(event.dtstart.substring(0, 4));
        const month = parseInt(event.dtstart.substring(4, 6));
        const day = parseInt(event.dtstart.substring(6, 8));
        const hour = parseInt(event.dtstart.substring(9, 11));
        const minute = parseInt(event.dtstart.substring(11, 13));
        
        const date = new Date(year, month - 1, day, hour, minute);
        dayOfWeek = (date.getDay() + 6) % 7;
        startTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        
        if (event.dtend) {
          const endHour = parseInt(event.dtend.substring(9, 11));
          const endMinute = parseInt(event.dtend.substring(11, 13));
          endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
        }
      }
      
      const success = await addClass(userId, event.summary, dayOfWeek, startTime, endTime, event.location || '');
      if (success) addedCount++;
    }
    
    clearCache(userId);
    return addedCount;
  } catch (error) {
    console.error("Parse ICS error:", error);
    return 0;
  }
}

// ========== REMINDER SYSTEM ==========
let reminderInterval = null;

async function checkReminders() {
  try {
    const now = new Date();
    const currentDay = (now.getDay() + 6) % 7;
    const currentMin = now.getHours() * 60 + now.getMinutes();
    
    const { data: users } = await supabase.from("users").select("vk_id, name, language, reminder_offset");
    if (!users) return;
    
    for (const user of users) {
      const schedule = await getSchedule(user.vk_id);
      const offset = user.reminder_offset || 60;
      const lang = user.language || 'en';
      const name = user.name || 'friend';
      
      // Class reminders
      for (const cls of schedule.filter(c => c.day === currentDay)) {
        const [hours, minutes] = cls.start_time.split(':').map(Number);
        const classMin = hours * 60 + minutes;
        const remindMin = classMin - offset;
        
        if (remindMin <= currentMin && currentMin <= remindMin + 2) {
          const key = `class_remind_${user.vk_id}_${currentDay}_${cls.start_time}_${now.toDateString()}`;
          const { data: existing } = await supabase.from("reminders").select("key").eq("key", key).single();
          
          if (!existing) {
            const minutesUntil = classMin - currentMin;
            const msg = getResponse(lang, 'class_reminder', {
              subject: cls.subject, time: cls.start_time, location: cls.location || 'Classroom',
              minutes: minutesUntil, name
            });
            await sendMessage(user.vk_id, msg, getMainKeyboard(lang));
            await supabase.from("reminders").insert({ key });
          }
        }
      }
      
      // Task reminders
      const tasks = await getTasks(user.vk_id, true);
      for (const task of tasks) {
        const dueDate = new Date(task.due_date);
        const daysUntil = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
        
        if (daysUntil <= task.remind_days && daysUntil > 0 && !task.reminded) {
          const key = `task_remind_${task.id}_${now.toDateString()}`;
          const { data: existing } = await supabase.from("reminders").select("key").eq("key", key).single();
          
          if (!existing) {
            let msg;
            if (task.priority === 'high' && daysUntil <= 1) {
              msg = getResponse(lang, 'high_priority_task', { task: task.task });
            } else {
              msg = getResponse(lang, 'task_reminder', {
                task: task.task, due_date: dueDate.toLocaleDateString(), days_left: daysUntil
              });
            }
            await sendMessage(user.vk_id, msg, getMainKeyboard(lang));
            await supabase.from("reminders").insert({ key });
            
            // Mark as reminded to prevent duplicate
            await supabase.from("tasks").update({ reminded: true }).eq("id", task.id);
          }
        }
      }
    }
  } catch (error) {
    console.error("Reminder error:", error);
  }
}

function startReminders() {
  if (reminderInterval) clearInterval(reminderInterval);
  reminderInterval = setInterval(checkReminders, 60000);
  console.log("✅ Reminder system active - checking every minute");
}

// ========== MAIN HANDLER ==========
async function handleMessage(userId, text, lang) {
  try {
    const user = await getUser(userId);
    const name = user?.name || null;
    const displayName = name || 'friend';
    const lowerText = text.toLowerCase().trim();
    
    // NEW USER
    if (!name && !lowerText.match(/(my name is|меня зовут|叫我|我是)/)) {
      await sendMessage(userId, getResponse(lang, 'welcome'), getMainKeyboard(lang));
      return;
    }
    
    // EXTRACT NAME
    const nameMatch = text.match(/(?:my name is|меня зовут|叫我|我是)\s+([A-Za-zА-Яа-яёЁ\u4e00-\u9fff]+)/i);
    if (nameMatch && !name) {
      const newName = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1).toLowerCase();
      await saveUser(userId, { name: newName });
      
      const [tasks, classes] = await Promise.all([getTasks(userId), getTodayClasses(userId)]);
      await sendMessage(userId, getResponse(lang, 'name_saved', { name: newName }), getMainKeyboard(lang));
      await sendMessage(userId, getResponse(lang, 'welcome_back', { 
        name: newName, tasks: tasks.length, classes: classes.length 
      }), getMainKeyboard(lang));
      return;
    }
    
    // QUICK COMMANDS
    if (lowerText === 'ping') {
      const classes = await getSchedule(userId);
      const tasks = await getTasks(userId);
      await sendMessage(userId, getResponse(lang, 'ping', { classes: classes.length, tasks: tasks.length }), getMainKeyboard(lang));
      return;
    }
    if (lowerText === 'status') {
      await sendMessage(userId, getResponse(lang, 'status'), getMainKeyboard(lang));
      return;
    }
    if (lowerText === 'about') {
      await sendMessage(userId, getResponse(lang, 'about'), getMainKeyboard(lang));
      return;
    }
    
    // TODAY
    if (text === "📅 Today" || lowerText === 'today' || lowerText === 'сегодня' || lowerText === '今天') {
      const [classes, tasks] = await Promise.all([getTodayClasses(userId), getTasks(userId)]);
      if (!classes.length) {
        await sendMessage(userId, getResponse(lang, 'no_classes', { name: displayName, tasks: tasks.length }), getMainKeyboard(lang));
      } else {
        let list = '';
        for (let i = 0; i < classes.length; i++) {
          list += `${i+1}. **${classes[i].subject}** • ${classes[i].start_time}-${classes[i].end_time}\n`;
          if (classes[i].location) list += `   📍 ${classes[i].location}\n`;
          list += '\n';
        }
        const date = new Date().toLocaleDateString();
        await sendMessage(userId, getResponse(lang, 'schedule_today', { date, classes: list }), getMainKeyboard(lang));
      }
      return;
    }
    
    // TOMORROW
    if (text === "📅 Tomorrow" || lowerText === 'tomorrow' || lowerText === 'завтра' || lowerText === '明天') {
      const classes = await getTomorrowClasses(userId);
      if (!classes.length) {
        await sendMessage(userId, getResponse(lang, 'no_classes_tomorrow', { name: displayName }), getMainKeyboard(lang));
      } else {
        let list = '';
        for (let i = 0; i < classes.length; i++) {
          list += `${i+1}. **${classes[i].subject}** • ${classes[i].start_time}-${classes[i].end_time}\n`;
          if (classes[i].location) list += `   📍 ${classes[i].location}\n`;
          list += '\n';
        }
        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
        const date = tomorrow.toLocaleDateString();
        await sendMessage(userId, getResponse(lang, 'schedule_tomorrow', { date, classes: list }), getMainKeyboard(lang));
      }
      return;
    }
    
    // WEEK SCHEDULE
    if (lowerText === 'week' || lowerText === 'неделя' || lowerText === '周课表') {
      const weekMap = await getWeekSchedule(userId);
      const dayNames = lang === 'zh' ? ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] : 
                       lang === 'ru' ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] : 
                       ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      
      let weekStr = '';
      for (let i = 0; i < 7; i++) {
        const classes = weekMap[i];
        weekStr += `**${dayNames[i]}**: `;
        if (!classes.length) {
          weekStr += 'No classes\n';
        } else {
          weekStr += classes.map(c => `${c.subject} (${c.start_time})`).join(', ') + '\n';
        }
      }
      await sendMessage(userId, getResponse(lang, 'schedule_week', { week_schedule: weekStr }), getMainKeyboard(lang));
      return;
    }
    
    // NEXT CLASS
    if (text === "⏰ Next" || lowerText === 'next' || lowerText === 'next class' || lowerText === 'следующая' || lowerText === '下节课') {
      const next = await getNextClass(userId);
      const reminder = await getReminderOffset(userId);
      if (next) {
        const now = new Date();
        const [hours, minutes] = next.start_time.split(':').map(Number);
        let mins = (hours * 60 + minutes) - (now.getHours() * 60 + now.getMinutes());
        mins = Math.max(0, mins);
        await sendMessage(userId, getResponse(lang, 'next_class', {
          subject: next.subject, time: next.start_time, location: next.location || 'Classroom',
          minutes: mins, reminder
        }), getMainKeyboard(lang));
      } else {
        const tasks = await getTasks(userId);
        await sendMessage(userId, getResponse(lang, 'no_next_class', { name: displayName, tasks: tasks.length }), getMainKeyboard(lang));
      }
      return;
    }
    
    // REMINDER SETTINGS
    if (text.startsWith('/reminder')) {
      const parts = text.split(/\s+/);
      if (parts.length > 1) {
        const mins = parseInt(parts[1]);
        if (!isNaN(mins) && mins >= 5 && mins <= 120) {
          await setReminderOffset(userId, mins);
          await sendMessage(userId, getResponse(lang, 'reminder_set', { minutes: mins }), getMainKeyboard(lang));
        } else {
          const current = await getReminderOffset(userId);
          await sendMessage(userId, getResponse(lang, 'reminder_current', { minutes: current }), getMainKeyboard(lang));
        }
      } else {
        const current = await getReminderOffset(userId);
        await sendMessage(userId, getResponse(lang, 'reminder_current', { minutes: current }), getMainKeyboard(lang));
      }
      return;
    }
    
    // MARK ATTENDANCE
    if (text === "✅ Mark" || lowerText === 'mark' || lowerText === 'отметить' || lowerText === '标记') {
      const classes = await getTodayClasses(userId);
      if (!classes.length) {
        await sendMessage(userId, getResponse(lang, 'no_classes', { name: displayName, tasks: 0 }), getMainKeyboard(lang));
      } else {
        let list = '';
        for (let i = 0; i < classes.length; i++) list += `${i+1}. ${classes[i].subject}\n`;
        await sendMessage(userId, getResponse(lang, 'attendance_prompt', { classes: list }), getMainKeyboard(lang));
        userStates.set(userId, { mode: 'attendance', classes });
        setTimeout(() => { if (userStates.get(userId)?.mode === 'attendance') userStates.delete(userId); }, 60000);
      }
      return;
    }
    
    // Handle attendance by number
    if (/^\d+$/.test(text) && text.length <= 2) {
      const state = userStates.get(userId);
      if (state?.mode === 'attendance') {
        const idx = parseInt(text) - 1;
        if (idx >= 0 && idx < state.classes.length) {
          const result = await markAttendance(userId, state.classes[idx].subject);
          if (result.already) {
            await sendMessage(userId, getResponse(lang, 'already_marked', { class_name: state.classes[idx].subject }), getMainKeyboard(lang));
          } else {
            const streakMsg = result.streak > 0 ? getResponse(lang, 'attendance_streak', { name: displayName, streak: result.streak + 1 }) : '';
            await sendMessage(userId, getResponse(lang, 'attendance_marked', { class_name: state.classes[idx].subject, streak_msg: streakMsg }), getMainKeyboard(lang));
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
        const result = await markAttendance(userId, cls.subject);
        if (result.already) {
          await sendMessage(userId, getResponse(lang, 'already_marked', { class_name: cls.subject }), getMainKeyboard(lang));
        } else {
          const streakMsg = result.streak > 0 ? getResponse(lang, 'attendance_streak', { name: displayName, streak: result.streak + 1 }) : '';
          await sendMessage(userId, getResponse(lang, 'attendance_marked', { class_name: cls.subject, streak_msg: streakMsg }), getMainKeyboard(lang));
        }
        return;
      }
    }
    
    // TASKS
    if (text === "📝 Tasks" || lowerText === 'tasks' || lowerText === 'задачи' || lowerText === '任务') {
      const tasks = await getTasks(userId, true);
      const stats = await getTaskStats(userId);
      if (!tasks.length) {
        await sendMessage(userId, getResponse(lang, 'no_tasks', { name: displayName }), getMainKeyboard(lang));
      } else {
        let list = '';
        for (let i = 0; i < Math.min(tasks.length, 10); i++) {
          const t = tasks[i];
          const due = new Date(t.due_date);
          const priorityIcon = t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟡' : '🟢';
          const daysLeft = Math.ceil((due - new Date()) / 86400000);
          list += `${priorityIcon} ${i+1}. **${t.task}**\n   📅 Due: ${due.toLocaleDateString()} (${daysLeft} days left)\n\n`;
        }
        await sendMessage(userId, getResponse(lang, 'tasks_header', { pending: stats.pending, completed: stats.completed, tasks: list }), getMainKeyboard(lang));
      }
      return;
    }
    
    // COMPLETE TASK
    const doneMatch = text.match(/(?:done|готово|完成)\s+(.+)/i);
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
    
    // DELETE TASK
    const deleteMatch = text.match(/(?:delete|удалить|删除)\s+(.+)/i);
    if (deleteMatch) {
      const taskName = deleteMatch[1].trim();
      const task = await findTaskByName(userId, taskName);
      if (task) {
        await deleteTask(task.id, userId);
        await sendMessage(userId, getResponse(lang, 'task_deleted', { task: task.task }), getMainKeyboard(lang));
      } else {
        await sendMessage(userId, getResponse(lang, 'task_not_found', { task: taskName }), getMainKeyboard(lang));
      }
      return;
    }
    
    // ADD TASK COMMAND
    if (text.startsWith('/task')) {
      const match = text.match(/\/task\s+['"](.+?)['"]\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s+(\d+)(?:\s+(\w+))?/);
      if (match) {
        await addTask(userId, match[1], match[2], parseInt(match[3]), match[4] || 'normal');
        await sendMessage(userId, getResponse(lang, 'task_added', {
          task: match[1], due_date: match[2], days: match[3],
          priority: match[4] === 'high' ? 'HIGH' : match[4] === 'medium' ? 'MEDIUM' : 'NORMAL'
        }), getMainKeyboard(lang));
      } else {
        await sendMessage(userId, getResponse(lang, 'error'), getMainKeyboard(lang));
      }
      return;
    }
    
    // ADD CLASS COMMAND
    if (text.startsWith('/addclass') || text.startsWith('/addClass')) {
      const parts = text.split(/\s+/);
      if (parts.length >= 5) {
        const subject = parts[1];
        const day = parseInt(parts[2]);
        const start = parts[3];
        const end = parts[4];
        const location = parts.slice(5).join(' ') || '';
        
        if (!isNaN(day) && day >= 0 && day <= 6 && start.match(/^\d{2}:\d{2}$/) && end.match(/^\d{2}:\d{2}$/)) {
          await addClass(userId, subject, day, start, end, location);
          const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
          const dayName = lang === 'ru' ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][day] : dayNames[day];
          await sendMessage(userId, getResponse(lang, 'class_added', { subject, day: dayName, start, end, location }), getMainKeyboard(lang));
        } else {
          await sendMessage(userId, getResponse(lang, 'add_class_instruction'), getMainKeyboard(lang));
        }
      } else {
        await sendMessage(userId, getResponse(lang, 'add_class_instruction'), getMainKeyboard(lang));
      }
      return;
    }
    
    // STATISTICS
    if (text === "📊 Stats" || lowerText === 'stats' || lowerText === 'statistics' || lowerText === 'статистика' || lowerText === '统计') {
      const [taskStats, attendanceStats] = await Promise.all([getTaskStats(userId), getAttendanceStats(userId)]);
      const taskBar = '█'.repeat(Math.floor(taskStats.rate / 10)) + '░'.repeat(10 - Math.floor(taskStats.rate / 10));
      const attendBar = '█'.repeat(Math.floor(attendanceStats.rate / 10)) + '░'.repeat(10 - Math.floor(attendanceStats.rate / 10));
      
      let msg = getResponse(lang, 'stats_header');
      msg += getResponse(lang, 'task_stats', { 
        completed: taskStats.completed, pending: taskStats.pending, rate: taskStats.rate, bar: taskBar, score: taskStats.score 
      }) + '\n\n';
      msg += getResponse(lang, 'attendance_stats', { 
        total: attendanceStats.total, attended: attendanceStats.attended, missed: attendanceStats.missed, rate: attendanceStats.rate, bar: attendBar 
      });
      
      let insight = '';
      if (taskStats.rate > 80) {
        insight = `Excellent productivity ${displayName}! You're crushing your goals! 🎯`;
      } else if (taskStats.rate > 50) {
        insight = `Good progress ${displayName}! A little push and you'll be at the top! 💪`;
      } else if (taskStats.pending > 5) {
        insight = `You have ${taskStats.pending} pending tasks. Break them down into smaller steps! 📝`;
      } else {
        insight = `Every task completed is a step forward. You've got this ${displayName}! 🌟`;
      }
      
      msg += '\n\n' + getResponse(lang, 'progress_message', { message: insight });
      await sendMessage(userId, msg, getMainKeyboard(lang));
      return;
    }
    
    // ICS IMPORT BUTTON
    if (text === "📥 Import" || lowerText === 'import' || lowerText === 'импорт' || lowerText === '导入') {
      await sendMessage(userId, getResponse(lang, 'import_instructions'), getMainKeyboard(lang));
      return;
    }
    
    // ICS COMMAND
    if (text.startsWith('/ics')) {
      const parts = text.split(/\s+/);
      if (parts.length > 1) {
        await sendMessage(userId, getResponse(lang, 'import_progress'), getMainKeyboard(lang));
        const reminder = await getReminderOffset(userId);
        const count = await importICSFromUrl(userId, parts[1]);
        if (count > 0) {
          await sendMessage(userId, getResponse(lang, 'import_success', { count, reminder }), getMainKeyboard(lang));
        } else {
          await sendMessage(userId, getResponse(lang, 'import_fail'), getMainKeyboard(lang));
        }
      } else {
        await sendMessage(userId, getResponse(lang, 'import_instructions'), getMainKeyboard(lang));
      }
      return;
    }
    
    // HELP
    if (text === "❓ Help" || lowerText === 'help' || lowerText === 'помощь' || lowerText === '帮助') {
      await sendMessage(userId, getResponse(lang, 'help_text'), getMainKeyboard(lang));
      return;
    }
    
    // THANKS / GOODBYE
    if (lowerText.includes('thanks') || lowerText.includes('спасибо') || lowerText.includes('谢谢')) {
      await sendMessage(userId, getResponse(lang, 'thanks', { name: displayName }), getMainKeyboard(lang));
      return;
    }
    
    if (lowerText.includes('goodbye') || lowerText.includes('bye') || lowerText.includes('пока') || lowerText.includes('再见')) {
      await sendMessage(userId, getResponse(lang, 'goodbye', { name: displayName }), getMainKeyboard(lang));
      return;
    }
    
    // DEFAULT
    await sendMessage(userId, getResponse(lang, 'unknown', { name: displayName }), getMainKeyboard(lang));
    
  } catch (error) {
    console.error("Handle error:", error);
    await sendMessage(userId, getResponse(lang, 'error'), getMainKeyboard(lang));
  }
}

// ========== WEBHOOK HANDLER ==========
export async function handler(event) {
  try {
    const body = JSON.parse(event.body);
    
    if (body.type === "confirmation") {
      return { statusCode: 200, body: process.env.VK_CONFIRMATION_TOKEN || "default" };
    }
    
    if (body.type === "message_new") {
      const msg = body.object.message;
      const userId = msg.from_id;
      const text = msg.text || "";
      const attachments = msg.attachments || [];
      
      console.log(`[${userId}] ${text.substring(0, 50)}`);
      
      const lang = detectLanguage(text);
      await saveUser(userId, { language: lang });
      
      // HANDLE ICS FILE ATTACHMENTS
      for (const attachment of attachments) {
        if (attachment.type === 'doc' && attachment.doc.title && attachment.doc.title.toLowerCase().endsWith('.ics')) {
          console.log(`Processing ICS file: ${attachment.doc.title}`);
          await sendMessage(userId, getResponse(lang, 'import_progress'), getMainKeyboard(lang));
          const reminder = await getReminderOffset(userId);
          const count = await importICSFromFile(userId, attachment.doc.url);
          
          if (count > 0) {
            await sendMessage(userId, getResponse(lang, 'import_success', { count, reminder }), getMainKeyboard(lang));
          } else {
            await sendMessage(userId, getResponse(lang, 'import_fail'), getMainKeyboard(lang));
          }
          return { statusCode: 200, body: JSON.stringify({ ok: true }) };
        }
      }
      
      // HANDLE ICS LINKS IN TEXT
      const urlMatch = text.match(/(https?:\/\/[^\s]+\.ics)/i);
      if (urlMatch) {
        console.log(`Processing ICS link: ${urlMatch[1]}`);
        await sendMessage(userId, getResponse(lang, 'import_progress'), getMainKeyboard(lang));
        const reminder = await getReminderOffset(userId);
        const count = await importICSFromUrl(userId, urlMatch[1]);
        
        if (count > 0) {
          await sendMessage(userId, getResponse(lang, 'import_success', { count, reminder }), getMainKeyboard(lang));
        } else {
          await sendMessage(userId, getResponse(lang, 'import_fail'), getMainKeyboard(lang));
        }
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }
      
      // NORMAL MESSAGE HANDLING
      await handleMessage(userId, text, lang);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }
    
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (error) {
    console.error("Handler error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
}

// ========== START THE BOT ==========
startReminders();
console.log("=".repeat(60));
console.log("🎓 SMART HOUR BOT - FULLY FUNCTIONAL");
console.log("=".repeat(60));
console.log("✅ Features:");
console.log("   📅 Schedule Management (Today/Tomorrow/Week/Next)");
console.log("   📝 Task/Assignment Tracking (Add/Complete/Delete)");
console.log("   ✅ Attendance Recording (Mark by number or name)");
console.log("   ⏰ Smart Reminders (Adjustable 5-120 minutes)");
console.log("   📥 ICS Calendar Import (File attachments & URLs)");
console.log("   📊 Statistics Dashboard (Tasks & Attendance)");
console.log("   🌐 Multi-language (English, Russian, Chinese)");
console.log("   💾 Cloud-based Data Storage");
console.log("=".repeat(60));
console.log("🚀 Bot is running and waiting for messages!");
console.log("💡 Commands:");
console.log("   📅 Schedule: 'today', 'tomorrow', 'week', 'next class'");
console.log("   📝 Tasks: '/task \"Task\" YYYY-MM-DD HH:MM days priority'");
console.log("   ✅ Attendance: 'mark'");
console.log("   📊 Stats: 'stats'");
console.log("   ❓ Help: 'help'");
console.log("=".repeat(60));