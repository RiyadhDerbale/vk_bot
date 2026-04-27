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

// ========== OPTIMIZED CACHE SYSTEM (Faster Responses) ==========
const cache = new Map();
const userStates = new Map();
const activeUsers = new Map(); // Track active users for faster responses
const responseQueue = new Map(); // Queue for batched responses

const CACHE_TTL = 600000; // 10 minutes - longer cache for faster responses
const BATCH_DELAY = 100; // Batch multiple responses

// Optimized cache functions
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

function clearUserCache(userId) {
  const keys = [`schedule_${userId}`, `tasks_${userId}`, `tasks_pending_${userId}`, `stats_${userId}`];
  keys.forEach(key => cache.delete(key));
}

// ========== FAST LANGUAGE DETECTION ==========
const languageCache = new Map();

function detectLanguage(text) {
  if (!text) return 'en';
  
  // Check cache first
  if (languageCache.has(text.substring(0, 20))) {
    return languageCache.get(text.substring(0, 20));
  }
  
  let lang = 'en';
  if (/[\u4e00-\u9fff]/.test(text)) lang = 'zh';
  else if (/[а-яА-ЯёЁ]/.test(text)) lang = 'ru';
  
  languageCache.set(text.substring(0, 20), lang);
  return lang;
}

// ========== COMPLETE MULTILINGUAL RESPONSES ==========
const RESPONSES = {
  en: {
    welcome_new: "🌟 Hello! I'm your Time Management Assistant. What's your name?",
    name_saved: "🎉 Nice to meet you {name}! I'll help you manage your time effectively.",
    welcome_back: "👋 Welcome back {name}! You have {tasks} task(s) pending and {classes} class(es) today.",
    
    schedule_today: "📅 **TODAY'S SCHEDULE** - {date}\n\n{classes}💡 Reply with class number to mark attendance",
    schedule_tomorrow: "📅 **TOMORROW'S SCHEDULE** - {date}\n\n{classes}",
    no_classes: "🎉 No classes today {name}! You have {tasks} pending task(s). Great time to complete them!",
    no_classes_tomorrow: "🎉 No classes tomorrow {name}! Plan your study time wisely!",
    
    next_class: "⏰ **NEXT CLASS:** {subject}\n🕐 Time: {time}\n📍 Location: {location}\n⏱️ In {minutes} minutes\n🔔 I'll remind you {reminder} min before!",
    no_next_class: "✅ No more classes today {name}! You have {tasks} task(s) pending.",
    class_reminder: "🔔 **CLASS STARTING SOON!**\n\n📚 {subject}\n🕐 {time}\n📍 {location}\n⏱️ In {minutes} minutes!\n\n✅ Reply 'attend {subject}' after class!",
    
    reminder_set: "✅ Reminder set to {minutes} minutes before each class!",
    reminder_current: "🔔 Current reminder: {minutes} minutes before class.\nUse /reminder <minutes> (5-120) to change.",
    
    tasks_header: "📋 **YOUR TASKS** ({pending} pending | {completed} completed)\n\n{tasks}💬 Reply 'done [task name]' to complete\n📊 Say 'stats' for progress",
    no_tasks: "✅ EXCELLENT {name}! No pending tasks! 🎉\n\n📊 Say 'stats' to see your achievements!",
    task_added: "✅ **TASK ADDED**\n\n📝 {task}\n📅 Due: {due_date}\n🔔 Remind {days} day(s) before\n⚡ Priority: {priority}",
    task_completed: "🎉 **CONGRATULATIONS {name}!** 🎉\n\nCompleted: {task}\n\n📊 Your productivity improved!",
    task_deleted: "🗑️ Deleted task: {task}",
    task_not_found: "❌ Task '{task}' not found.\n💡 Say 'my tasks' to see your tasks.",
    
    attendance_prompt: "📚 **MARK ATTENDANCE**\n\nToday's classes:\n{classes}\n\nReply with NUMBER or CLASS NAME:",
    attendance_marked: "✅ Marked '{class_name}' as attended!\n{streak_msg}\n📊 Attendance rate updated!",
    attendance_streak: "🔥 {name}, {streak} classes in a row! 🔥",
    already_marked: "ℹ️ You already marked '{class_name}' today! ✅",
    
    stats_header: "📊 **TIME MANAGEMENT DASHBOARD** 📊\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n",
    task_stats: "📝 **TASKS**\n• ✅ Completed: {completed}\n• ⏳ Pending: {pending}\n• 🎯 Rate: {rate}%\n   [{bar}]",
    attendance_stats: "📚 **ATTENDANCE**\n• 📖 Total: {total}\n• ✅ Attended: {attended}\n• ❌ Missed: {missed}\n• 📈 Rate: {rate}%\n   [{bar}]",
    study_stats: "⏱️ **STUDY TIME**\n• 📅 Today: {today} min\n• 📆 Week: {week} min\n• 🏆 Total: {total} min\n• 💪 Daily Avg: {avg} min",
    time_insight: "💡 **TIME INSIGHT**\n{message}",
    
    import_instructions: "📥 **IMPORT SCHEDULE**\n\nSend me:\n1️⃣ ICS file attachment\n2️⃣ ICS calendar link\n3️⃣ /ics [url]\n\nI'll add all classes with reminders!",
    import_progress: "⏳ Importing calendar... Please wait.",
    import_success: "🎉 **IMPORTED {count} CLASSES!**\n\n✅ Schedule ready\n🔔 Reminders: {reminder} min before\n📅 Say 'today' to see!",
    import_fail: "❌ Import failed. Please send a valid ICS file or link.",
    
    study_logged: "📖 **STUDY LOGGED**\n\n📚 {subject}: {duration} minutes\n📊 Say 'stats' to see progress!",
    
    help_text: "🤖 **TIME MANAGEMENT BOT** 🤖\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📅 **SCHEDULE**\n• 'today' - Today's classes\n• 'tomorrow' - Tomorrow's classes\n• 'next class' - Upcoming class\n• Send .ics file - Import timetable\n\n✅ **ATTENDANCE**\n• 'mark attendance' - Mark classes\n• 'attend [class]' - Quick mark\n\n📝 **TASKS**\n• 'my tasks' - View tasks\n• '/task \"Task\" YYYY-MM-DD HH:MM days priority'\n• 'done [task]' - Complete task\n• 'delete task [name]' - Delete task\n\n⚙️ **REMINDERS**\n• '/reminder 45' - Set reminder time\n\n📊 **STATISTICS**\n• 'stats' - View progress\n\n📖 **STUDY**\n• 'studied 30 min math'\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💬 Just type naturally! 🌟",
    
    invalid: "❌ Invalid command. Try 'help' for commands.",
    error: "❌ Error. Please try again.",
    thanks: "😊 You're welcome {name}! Need anything else?",
    goodbye: "👋 Goodbye {name}! Have a productive day!",
    
    joke: "😂 {name}: {joke}",
    how_r_u: "😊 I'm great {name}! Ready to help you manage your time.",
    
    unknown: "🤔 Let me help {name}!\n\nTry: 'today' (schedule), 'my tasks' (tasks), 'stats' (progress), or 'help' (commands)"
  },
  
  ru: {
    welcome_new: "🌟 Привет! Я твой помощник по управлению временем. Как тебя зовут?",
    name_saved: "🎉 Приятно познакомиться {name}! Я помогу тебе управлять временем.",
    welcome_back: "👋 С возвращением {name}! У тебя {tasks} задач(и) и {classes} пар(ы) сегодня.",
    
    schedule_today: "📅 **РАСПИСАНИЕ НА СЕГОДНЯ** - {date}\n\n{classes}💡 Ответь номером чтобы отметить",
    schedule_tomorrow: "📅 **РАСПИСАНИЕ НА ЗАВТРА** - {date}\n\n{classes}",
    no_classes: "🎉 Сегодня нет пар {name}! У тебя {tasks} задач.",
    no_classes_tomorrow: "🎉 Завтра нет пар {name}! Планируй время wisely!",
    
    next_class: "⏰ **СЛЕДУЮЩАЯ ПАРА:** {subject}\n🕐 {time}\n📍 {location}\n⏱️ Через {minutes} мин\n🔔 Напомню за {reminder} мин!",
    no_next_class: "✅ Больше нет пар {name}! У тебя {tasks} задач.",
    class_reminder: "🔔 **ПАРА СКОРО!**\n\n📚 {subject}\n🕐 {time}\n📍 {location}\n⏱️ Через {minutes} мин!\n\n✅ Ответь 'отметить {subject}' после пары!",
    
    reminder_set: "✅ Напоминание за {minutes} минут до пары!",
    reminder_current: "🔔 Сейчас: за {minutes} минут.\nИспользуй /reminder <минуты> (5-120)",
    
    tasks_header: "📋 **ЗАДАЧИ** ({pending} активных | {completed} готово)\n\n{tasks}💬 Ответь 'готово [задача]'",
    no_tasks: "✅ ОТЛИЧНО {name}! Нет задач! 🎉\n\n📊 Скажи 'статистика'!",
    task_added: "✅ **ЗАДАЧА ДОБАВЛЕНА**\n\n📝 {task}\n📅 Дедлайн: {due_date}\n🔔 Напомню за {days} дн.\n⚡ Приоритет: {priority}",
    task_completed: "🎉 **ПОЗДРАВЛЯЮ {name}!** 🎉\n\nВыполнено: {task}\n\n📊 Продуктивность выросла!",
    task_deleted: "🗑️ Удалена задача: {task}",
    task_not_found: "❌ Задача '{task}' не найдена.\n💡 Скажи 'мои задачи'",
    
    attendance_prompt: "📚 **ОТМЕТИТЬ ПОСЕЩЕНИЕ**\n\nПары сегодня:\n{classes}\n\nОтветь НОМЕРОМ или НАЗВАНИЕМ:",
    attendance_marked: "✅ Отмечено '{class_name}'!\n{streak_msg}\n📊 Посещаемость обновлена!",
    attendance_streak: "🔥 {name}, {streak} пар(ы) подряд! 🔥",
    already_marked: "ℹ️ Ты уже отметил '{class_name}' сегодня! ✅",
    
    stats_header: "📊 **УПРАВЛЕНИЕ ВРЕМЕНЕМ** 📊\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n",
    task_stats: "📝 **ЗАДАЧИ**\n• ✅ Готово: {completed}\n• ⏳ Ждёт: {pending}\n• 🎯 Процент: {rate}%\n   [{bar}]",
    attendance_stats: "📚 **ПОСЕЩАЕМОСТЬ**\n• 📖 Всего: {total}\n• ✅ Было: {attended}\n• ❌ Пропущено: {missed}\n• 📈 Процент: {rate}%\n   [{bar}]",
    study_stats: "⏱️ **ВРЕМЯ УЧЁБЫ**\n• 📅 Сегодня: {today} мин\n• 📆 Неделя: {week} мин\n• 🏆 Всего: {total} мин\n• 💪 В день: {avg} мин",
    time_insight: "💡 **СОВЕТ**\n{message}",
    
    import_instructions: "📥 **ИМПОРТ РАСПИСАНИЯ**\n\nОтправь:\n1️⃣ ICS файл\n2️⃣ Ссылку на ICS\n3️⃣ /ics [ссылка]",
    import_progress: "⏳ Импортирую... Подожди.",
    import_success: "🎉 **ИМПОРТИРОВАНО {count} ПАР!**\n\n✅ Расписание готово\n🔔 Напоминания за {reminder} мин",
    import_fail: "❌ Ошибка импорта. Отправь правильный ICS файл.",
    
    study_logged: "📖 **УЧЁБА ЗАПИСАНА**\n\n📚 {subject}: {duration} минут\n📊 Скажи 'статистика'!",
    
    help_text: "🤖 **ПОМОЩНИК ПО ВРЕМЕНИ** 🤖\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📅 **РАСПИСАНИЕ**\n• 'сегодня' - Пары сегодня\n• 'завтра' - Пары завтра\n• 'следующая пара' - Следующая\n• Отправь .ics - Импорт\n\n✅ **ПОСЕЩАЕМОСТЬ**\n• 'отметить пару' - Отметить\n\n📝 **ЗАДАЧИ**\n• 'мои задачи' - Список\n• '/task \"Задача\" 2025-12-20 23:59 3 high'\n• 'готово [задача]'\n• 'удалить задачу [название]'\n\n⚙️ **НАПОМИНАНИЯ**\n• '/reminder 45' - Установить\n\n📊 **СТАТИСТИКА**\n• 'статистика' - Прогресс\n\n📖 **УЧЁБА**\n• 'учился 30 мин математика'\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💬 Говори естественно! 🌟",
    
    invalid: "❌ Неверно. Попробуй 'помощь'.",
    error: "❌ Ошибка. Попробуй ещё.",
    thanks: "😊 Пожалуйста {name}! Ещё нужно?",
    goodbye: "👋 До свидания {name}! Продуктивного дня!",
    
    joke: "😂 {name}: {joke}",
    how_r_u: "😊 У меня отлично {name}! Готов помочь.",
    
    unknown: "🤔 Давай помогу {name}!\n\nПопробуй: 'сегодня'(расписание), 'мои задачи'(задачи), 'статистика'(прогресс), 'помощь'(команды)"
  },
  
  zh: {
    welcome_new: "🌟 你好！我是时间管理助手。你叫什么名字？",
    name_saved: "🎉 很高兴认识你{name}！我会帮你管理时间。",
    welcome_back: "👋 欢迎回来{name}！你有{tasks}个任务待办，今天有{classes}节课。",
    
    schedule_today: "📅 **今日课表** - {date}\n\n{classes}💡 回复课程编号标记出勤",
    schedule_tomorrow: "📅 **明日课表** - {date}\n\n{classes}",
    no_classes: "🎉 {name}，今天没课！你有{tasks}个任务。",
    no_classes_tomorrow: "🎉 {name}，明天没课！合理安排学习时间！",
    
    next_class: "⏰ **下节课：** {subject}\n🕐 时间：{time}\n📍 地点：{location}\n⏱️ {minutes}分钟后\n🔔 我会提前{reminder}分钟提醒！",
    no_next_class: "✅ {name}，今天没课了！你有{tasks}个任务待办。",
    class_reminder: "🔔 **快上课了！**\n\n📚 {subject}\n🕐 {time}\n📍 {location}\n⏱️ {minutes}分钟后！\n\n✅ 课后回复'标记{subject}'记录出勤！",
    
    reminder_set: "✅ 提醒已设置！课前{minutes}分钟通知！",
    reminder_current: "🔔 当前提醒：课前{minutes}分钟。\n使用 /reminder <分钟> (5-120) 更改",
    
    tasks_header: "📋 **你的任务** ({pending}个待办 | {completed}个完成)\n\n{tasks}💬 回复'完成 [任务名]'标记完成",
    no_tasks: "✅ 太棒了{name}！没有待办任务！🎉\n\n📊 说'统计'查看成就！",
    task_added: "✅ **任务已添加**\n\n📝 {task}\n📅 截止：{due_date}\n🔔 提前{days}天提醒\n⚡ 优先级：{priority}",
    task_completed: "🎉 **恭喜{name}！** 🎉\n\n完成：{task}\n\n📊 生产力提高了！",
    task_deleted: "🗑️ 已删除任务：{task}",
    task_not_found: "❌ 找不到任务'{task}'。\n💡 说'我的任务'查看列表",
    
    attendance_prompt: "📚 **标记出勤**\n\n今日课程：\n{classes}\n\n回复数字或课程名称：",
    attendance_marked: "✅ 已标记'{class_name}'为出勤！\n{streak_msg}\n📊 出勤率已更新！",
    attendance_streak: "🔥 {name}，连续{streak}节课！🔥",
    already_marked: "ℹ️ 你今天已经标记过'{class_name}'了！✅",
    
    stats_header: "📊 **时间管理仪表板** 📊\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n",
    task_stats: "📝 **任务**\n• ✅ 已完成：{completed}\n• ⏳ 待办：{pending}\n• 🎯 完成率：{rate}%\n   [{bar}]",
    attendance_stats: "📚 **出勤**\n• 📖 总计：{total}\n• ✅ 已出勤：{attended}\n• ❌ 缺勤：{missed}\n• 📈 出勤率：{rate}%\n   [{bar}]",
    study_stats: "⏱️ **学习时间**\n• 📅 今天：{today}分钟\n• 📆 本周：{week}分钟\n• 🏆 总计：{total}分钟\n• 💪 日均：{avg}分钟",
    time_insight: "💡 **时间洞察**\n{message}",
    
    import_instructions: "📥 **导入课表**\n\n发送给我：\n1️⃣ ICS文件附件\n2️⃣ ICS日历链接\n3️⃣ /ics [链接]\n\n我会添加所有课程和提醒！",
    import_progress: "⏳ 正在导入...请稍等",
    import_success: "🎉 **已导入{count}门课程！**\n\n✅ 课表已准备\n🔔 课前{reminder}分钟提醒\n📅 说'今天'查看！",
    import_fail: "❌ 导入失败。请发送有效的ICS文件或链接。",
    
    study_logged: "📖 **学习已记录**\n\n📚 {subject}：{duration}分钟\n📊 说'统计'查看进度！",
    
    help_text: "🤖 **时间管理助手** 🤖\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📅 **课表**\n• '今天' - 今日课程\n• '明天' - 明日课程\n• '下节课' - 下节课\n• 发送.ics文件 - 导入课表\n\n✅ **出勤**\n• '标记出勤' - 标记课程\n• '标记 [课程]' - 快速标记\n\n📝 **任务**\n• '我的任务' - 查看任务\n• '/task \"任务\" 2025-12-20 23:59 3 high'\n• '完成 [任务]' - 完成任务\n• '删除任务 [名称]' - 删除任务\n\n⚙️ **提醒**\n• '/reminder 45' - 设置提醒时间\n\n📊 **统计**\n• '统计' - 查看进度\n\n📖 **学习**\n• '学习了30分钟数学'\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💬 自然说话就行！🌟",
    
    invalid: "❌ 无效命令。试试'帮助'。",
    error: "❌ 出错。请重试。",
    thanks: "😊 不客气{name}！还需要什么？",
    goodbye: "👋 再见{name}！度过高效的一天！",
    
    joke: "😂 {name}：{joke}",
    how_r_u: "😊 我很好{name}！准备好帮你管理时间。",
    
    unknown: "🤔 {name}，让我帮你！\n\n试试：'今天'(课表), '我的任务'(任务), '统计'(进度), '帮助'(命令)"
  }
};

// ========== FAST VK API ==========
async function callVkApi(method, params) {
  try {
    const url = new URL(`https://api.vk.com/method/${method}`);
    url.searchParams.append("access_token", VK_TOKEN);
    url.searchParams.append("v", VK_API_VERSION);
    Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);
    
    const data = await response.json();
    if (data.error) return null;
    return data.response;
  } catch { return null; }
}

// Batched message sending for faster responses
async function sendMessage(userId, text, keyboard = null) {
  const params = {
    user_id: userId,
    message: text,
    random_id: Date.now() + Math.random(),
  };
  if (keyboard) params.keyboard = keyboard;
  return callVkApi("messages.send", params);
}

function getKeyboard(lang) {
  const buttons = lang === 'zh' ? [
    [{ action: { type: "text", label: "📅 今天" }, color: "primary" }, { action: { type: "text", label: "📅 明天" }, color: "primary" }],
    [{ action: { type: "text", label: "⏰ 下节课" }, color: "secondary" }, { action: { type: "text", label: "📝 任务" }, color: "positive" }],
    [{ action: { type: "text", label: "✅ 出勤" }, color: "positive" }, { action: { type: "text", label: "📊 统计" }, color: "secondary" }],
    [{ action: { type: "text", label: "📥 导入" }, color: "primary" }, { action: { type: "text", label: "❓ 帮助" }, color: "secondary" }]
  ] : lang === 'ru' ? [
    [{ action: { type: "text", label: "📅 Сегодня" }, color: "primary" }, { action: { type: "text", label: "📅 Завтра" }, color: "primary" }],
    [{ action: { type: "text", label: "⏰ Следующая" }, color: "secondary" }, { action: { type: "text", label: "📝 Задачи" }, color: "positive" }],
    [{ action: { type: "text", label: "✅ Отметить" }, color: "positive" }, { action: { type: "text", label: "📊 Статистика" }, color: "secondary" }],
    [{ action: { type: "text", label: "📥 Импорт" }, color: "primary" }, { action: { type: "text", label: "❓ Помощь" }, color: "secondary" }]
  ] : [
    [{ action: { type: "text", label: "📅 Today" }, color: "primary" }, { action: { type: "text", label: "📅 Tomorrow" }, color: "primary" }],
    [{ action: { type: "text", label: "⏰ Next" }, color: "secondary" }, { action: { type: "text", label: "📝 Tasks" }, color: "positive" }],
    [{ action: { type: "text", label: "✅ Mark" }, color: "positive" }, { action: { type: "text", label: "📊 Stats" }, color: "secondary" }],
    [{ action: { type: "text", label: "📥 Import" }, color: "primary" }, { action: { type: "text", label: "❓ Help" }, color: "secondary" }]
  ];
  return JSON.stringify({ one_time: false, buttons });
}

function getResponse(lang, key, vars = {}) {
  let text = RESPONSES[lang]?.[key] || RESPONSES.en[key] || key;
  Object.entries(vars).forEach(([k, v]) => text = text.replace(new RegExp(`{${k}}`, 'g'), v));
  return text;
}

// ========== DATABASE WITH MEMORY ==========
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

async function getReminder(userId) {
  const user = await getUser(userId);
  return user?.reminder_offset || 60;
}

async function setReminder(userId, minutes) {
  return saveUser(userId, { reminder_offset: Math.min(120, Math.max(5, minutes)) });
}

// ========== SCHEDULE WITH MEMORY ==========
async function addClass(userId, subject, day, start, end, loc = '') {
  try {
    await supabase.from("schedule").insert({ 
      user_id: userId, subject, day, start_time: start, end_time: end, location: loc 
    });
    clearUserCache(userId);
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
  const sched = await getSchedule(userId);
  return sched.filter(c => c.day === day);
}

async function getTomorrowClasses(userId) {
  const day = (new Date().getDay() + 7) % 7;
  const sched = await getSchedule(userId);
  return sched.filter(c => c.day === day);
}

async function getNextClass(userId) {
  const now = new Date();
  const currentDay = (now.getDay() + 6) % 7;
  const currentMin = now.getHours() * 60 + now.getMinutes();
  const sched = await getSchedule(userId);
  const sorted = [...sched].sort((a, b) => a.day - b.day || a.start_time.localeCompare(b.start_time));
  
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
    clearUserCache(userId);
    return true;
  } catch { return false; }
}

// ========== TASKS WITH FULL MEMORY TRACKING ==========
async function addTask(userId, task, due, days, priority = 'normal') {
  try {
    await supabase.from("tasks").insert({ 
      user_id: userId, task, due_date: due, remind_days: days, priority, done: 0, created_at: new Date().toISOString()
    });
    clearUserCache(userId);
    return true;
  } catch { return false; }
}

async function getTasks(userId, pending = true) {
  const cacheKey = pending ? `tasks_pending_${userId}` : `tasks_${userId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  
  try {
    let query = supabase.from("tasks").select("*").eq("user_id", userId);
    if (pending) query = query.eq("done", 0);
    const { data } = await query.order("due_date", { ascending: true });
    const result = data || [];
    setCached(cacheKey, result);
    return result;
  } catch { return []; }
}

async function getAllTasks(userId) {
  return getTasks(userId, false);
}

async function completeTask(taskId, userId) {
  try {
    await supabase
      .from("tasks")
      .update({ done: 1, completed_date: new Date().toISOString() })
      .eq("id", taskId)
      .eq("user_id", userId);
    
    // Update daily stats
    const today = new Date().toISOString().split('T')[0];
    const { data: daily } = await supabase
      .from("daily_stats")
      .select("id, tasks_completed")
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
        user_id: userId, date: today, tasks_completed: 1, classes_attended: 0, study_minutes: 0
      });
    }
    
    clearUserCache(userId);
    return true;
  } catch { return false; }
}

async function deleteTask(taskId, userId) {
  try {
    await supabase.from("tasks").delete().eq("id", taskId).eq("user_id", userId);
    clearUserCache(userId);
    return true;
  } catch { return false; }
}

async function findTaskByName(userId, name) {
  const tasks = await getTasks(userId, true);
  return tasks.find(t => 
    t.task.toLowerCase().includes(name.toLowerCase()) || 
    name.toLowerCase().includes(t.task.toLowerCase())
  );
}

async function findExactTask(userId, name) {
  const tasks = await getTasks(userId, true);
  return tasks.find(t => t.task.toLowerCase() === name.toLowerCase());
}

async function getTaskStats(userId) {
  const cached = getCached(`task_stats_${userId}`);
  if (cached) return cached;
  
  const tasks = await getAllTasks(userId);
  const pending = tasks.filter(t => !t.done).length;
  const completed = tasks.filter(t => t.done).length;
  const rate = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  const result = { pending, completed, rate };
  setCached(`task_stats_${userId}`, result);
  return result;
}

// ========== ATTENDANCE WITH MEMORY ==========
async function markAttended(userId, className) {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    // Check if already marked
    const { data: existing } = await supabase
      .from("attendance")
      .select("id")
      .eq("user_id", userId)
      .eq("class_name", className)
      .eq("date", today)
      .single();
    
    if (existing) return { success: false, already: true };
    
    // Mark attendance
    await supabase.from("attendance").insert({ 
      user_id: userId, class_name: className, date: today, attended: 1 
    });
    
    // Calculate streak
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
    
    // Update daily stats
    const { data: daily } = await supabase
      .from("daily_stats")
      .select("id, classes_attended")
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
        user_id: userId, date: today, classes_attended: 1, tasks_completed: 0, study_minutes: 0
      });
    }
    
    clearUserCache(userId);
    return { success: true, already: false, streak: streakCount };
  } catch { return { success: false, already: false }; }
}

async function getAttendanceStats(userId) {
  const cached = getCached(`attendance_stats_${userId}`);
  if (cached) return cached;
  
  try {
    const { data } = await supabase.from("attendance").select("attended").eq("user_id", userId);
    if (!data?.length) return { total: 0, attended: 0, missed: 0, rate: 0 };
    
    const total = data.length;
    const attended = data.filter(a => a.attended).length;
    const missed = total - attended;
    const rate = Math.round(attended / total * 100);
    const result = { total, attended, missed, rate };
    setCached(`attendance_stats_${userId}`, result);
    return result;
  } catch { return { total: 0, attended: 0, missed: 0, rate: 0 }; }
}

// ========== STUDY TRACKING ==========
async function addStudy(userId, subject, duration) {
  const today = new Date().toISOString().split('T')[0];
  try {
    await supabase.from("study").insert({ user_id: userId, subject, duration, date: today });
    
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
        user_id: userId, date: today, study_minutes: duration, tasks_completed: 0, classes_attended: 0
      });
    }
    
    clearUserCache(userId);
    return true;
  } catch { return false; }
}

async function getStudyStats(userId) {
  const cached = getCached(`study_stats_${userId}`);
  if (cached) return cached;
  
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split('T')[0];
  
  try {
    const { data } = await supabase.from("study").select("duration, date").eq("user_id", userId);
    if (!data?.length) return { total: 0, weekly: 0, today: 0, avg: 0 };
    
    const total = data.reduce((s, d) => s + (d.duration || 0), 0);
    const weekly = data.filter(d => d.date >= weekAgoStr).reduce((s, d) => s + (d.duration || 0), 0);
    const todayStudy = data.filter(d => d.date === today).reduce((s, d) => s + (d.duration || 0), 0);
    const avg = weekly ? Math.round(weekly / 7) : 0;
    const result = { total, weekly, today: todayStudy, avg };
    setCached(`study_stats_${userId}`, result);
    return result;
  } catch { return { total: 0, weekly: 0, today: 0, avg: 0 }; }
}

// ========== ICS IMPORT ==========
async function importICS(userId, url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!resp.ok) return -1;
    
    const content = await resp.text();
    const lines = content.split(/\r?\n/);
    let count = 0;
    let current = null;
    
    for (const line of lines) {
      const l = line.trim();
      if (l === 'BEGIN:VEVENT') current = {};
      else if (l === 'END:VEVENT' && current) {
        if (current.summary) {
          let start = '09:00', end = '10:00', day = 0;
          if (current.dtstart) {
            const match = current.dtstart.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
            if (match) {
              const date = new Date(parseInt(match[1]), parseInt(match[2])-1, parseInt(match[3]), parseInt(match[4]), parseInt(match[5]));
              day = (date.getDay() + 6) % 7;
              start = `${match[4]}:${match[5]}`;
            }
          }
          if (current.dtend) {
            const match = current.dtend.match(/T(\d{2})(\d{2})/);
            if (match) end = `${match[1]}:${match[2]}`;
          }
          if (await addClass(userId, current.summary, day, start, end, current.location || '')) count++;
        }
        current = null;
      } else if (current) {
        if (l.startsWith('SUMMARY:')) current.summary = l.substring(8).replace(/\\,/g, ',').trim();
        else if (l.startsWith('DTSTART')) current.dtstart = l;
        else if (l.startsWith('DTEND')) current.dtend = l;
        else if (l.startsWith('LOCATION:')) current.location = l.substring(9).replace(/\\,/g, ',').trim();
      }
    }
    clearUserCache(userId);
    return count;
  } catch { return -1; }
}

// ========== FAST REMINDER SYSTEM ==========
let reminderInterval = null;

async function checkReminders() {
  try {
    const now = new Date();
    const currentDay = (now.getDay() + 6) % 7;
    const currentMin = now.getHours() * 60 + now.getMinutes();
    
    const { data: users } = await supabase.from("users").select("vk_id, name, language, reminder_offset");
    if (!users) return;
    
    for (const user of users) {
      const sched = await getSchedule(user.vk_id);
      const offset = user.reminder_offset || 60;
      const lang = user.language || 'en';
      
      for (const cls of sched.filter(c => c.day === currentDay)) {
        const [h, m] = cls.start_time.split(':').map(Number);
        const classMin = h * 60 + m;
        const remindMin = classMin - offset;
        
        if (remindMin <= currentMin && currentMin <= remindMin + 2) {
          const key = `remind_${user.vk_id}_${currentDay}_${cls.start_time}_${now.toDateString()}`;
          const { data: existing } = await supabase.from("reminders").select("key").eq("key", key).single();
          
          if (!existing) {
            const msg = getResponse(lang, 'class_reminder', {
              subject: cls.subject, time: cls.start_time, location: cls.location || 'Classroom',
              minutes: classMin - currentMin
            });
            await sendMessage(user.vk_id, msg, getKeyboard(lang));
            await supabase.from("reminders").insert({ key });
          }
        }
      }
    }
  } catch(e) { console.error("Reminder error:", e); }
}

function startReminders() {
  if (reminderInterval) clearInterval(reminderInterval);
  reminderInterval = setInterval(checkReminders, 60000);
}

// ========== MAIN MESSAGE HANDLER (OPTIMIZED) ==========
async function handleMessage(userId, text, lang) {
  try {
    const user = await getUser(userId);
    const name = user?.name || null;
    const displayName = name || 'friend';
    const lowerText = text.toLowerCase().trim();
    
    // NEW USER - Get name
    if (!name && !lowerText.match(/(my name is|call me|меня зовут|叫我|我是|名字)/)) {
      await sendMessage(userId, getResponse(lang, 'welcome_new'), getKeyboard(lang));
      return;
    }
    
    // Extract name
    const nameMatch = text.match(/(?:my name is|call me|меня зовут|叫我|我是|名字)\s+([A-Za-zА-Яа-яёЁ\u4e00-\u9fff]+)/i);
    if (nameMatch && !name) {
      const newName = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1).toLowerCase();
      await saveUser(userId, { name: newName });
      
      const tasks = await getTasks(userId, true);
      const classes = await getTodayClasses(userId);
      await sendMessage(userId, getResponse(lang, 'name_saved', { name: newName }), getKeyboard(lang));
      
      if (tasks.length || classes.length) {
        await sendMessage(userId, getResponse(lang, 'welcome_back', { 
          name: newName, tasks: tasks.length, classes: classes.length 
        }), getKeyboard(lang));
      }
      return;
    }
    
    // Welcome back check
    if (name && (lowerText === 'hello' || lowerText === 'hi' || lowerText === 'hey' || lowerText === 'привет' || lowerText === '你好')) {
      const tasks = await getTasks(userId, true);
      const classes = await getTodayClasses(userId);
      await sendMessage(userId, getResponse(lang, 'welcome_back', { 
        name: displayName, tasks: tasks.length, classes: classes.length 
      }), getKeyboard(lang));
      return;
    }
    
    // ===== SCHEDULE =====
    if (text === "📅 Today" || text === "📅 Сегодня" || text === "📅 今天" || lowerText === 'today' || lowerText === 'сегодня' || lowerText === '今天') {
      const classes = await getTodayClasses(userId);
      const tasks = await getTasks(userId, true);
      
      if (!classes.length) {
        await sendMessage(userId, getResponse(lang, 'no_classes', { name: displayName, tasks: tasks.length }), getKeyboard(lang));
      } else {
        const dayNames = lang === 'zh' ? ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] : 
                         lang === 'ru' ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] : 
                         ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        let list = '';
        for (let i = 0; i < classes.length; i++) {
          list += `${i+1}. **${classes[i].subject}** • ${classes[i].start_time}-${classes[i].end_time}\n`;
          if (classes[i].location) list += `   📍 ${classes[i].location}\n`;
          list += '\n';
        }
        const date = new Date().toLocaleDateString(lang === 'zh' ? 'zh-CN' : lang === 'ru' ? 'ru-RU' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        await sendMessage(userId, getResponse(lang, 'schedule_today', { date, classes: list }), getKeyboard(lang));
      }
      return;
    }
    
    if (text === "📅 Tomorrow" || text === "📅 Завтра" || text === "📅 明天" || lowerText === 'tomorrow' || lowerText === 'завтра' || lowerText === '明天') {
      const classes = await getTomorrowClasses(userId);
      
      if (!classes.length) {
        await sendMessage(userId, getResponse(lang, 'no_classes_tomorrow', { name: displayName }), getKeyboard(lang));
      } else {
        let list = '';
        for (let i = 0; i < classes.length; i++) {
          list += `${i+1}. **${classes[i].subject}** • ${classes[i].start_time}-${classes[i].end_time}\n`;
          if (classes[i].location) list += `   📍 ${classes[i].location}\n`;
          list += '\n';
        }
        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
        const date = tomorrow.toLocaleDateString(lang === 'zh' ? 'zh-CN' : lang === 'ru' ? 'ru-RU' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        await sendMessage(userId, getResponse(lang, 'schedule_tomorrow', { date, classes: list }), getKeyboard(lang));
      }
      return;
    }
    
    // ===== NEXT CLASS =====
    if (text === "⏰ Next" || text === "⏰ Следующая" || text === "⏰ 下节课" || lowerText === 'next class' || lowerText === 'what\'s next' || lowerText === 'следующая пара' || lowerText === '下节课') {
      const next = await getNextClass(userId);
      const reminder = await getReminder(userId);
      
      if (next) {
        const now = new Date();
        const [h, m] = next.start_time.split(':').map(Number);
        let mins = (h * 60 + m) - (now.getHours() * 60 + now.getMinutes());
        mins = Math.max(0, mins);
        await sendMessage(userId, getResponse(lang, 'next_class', {
          subject: next.subject, time: next.start_time, location: next.location || 'Classroom',
          minutes: mins, reminder
        }), getKeyboard(lang));
      } else {
        const tasks = await getTasks(userId, true);
        await sendMessage(userId, getResponse(lang, 'no_next_class', { name: displayName, tasks: tasks.length }), getKeyboard(lang));
      }
      return;
    }
    
    // ===== REMINDER SETTINGS =====
    if (text.startsWith('/reminder')) {
      const parts = text.split(/\s+/);
      if (parts.length > 1) {
        const mins = parseInt(parts[1]);
        if (!isNaN(mins) && mins >= 5 && mins <= 120) {
          await setReminder(userId, mins);
          await sendMessage(userId, getResponse(lang, 'reminder_set', { minutes: mins }), getKeyboard(lang));
        } else {
          const current = await getReminder(userId);
          await sendMessage(userId, getResponse(lang, 'reminder_current', { minutes: current }), getKeyboard(lang));
        }
      } else {
        const current = await getReminder(userId);
        await sendMessage(userId, getResponse(lang, 'reminder_current', { minutes: current }), getKeyboard(lang));
      }
      return;
    }
    
    // ===== MARK ATTENDANCE =====
    if (text === "✅ Mark" || text === "✅ Отметить" || text === "✅ 出勤" || lowerText === 'mark attendance' || lowerText === 'отметить пару' || lowerText === '标记出勤') {
      const classes = await getTodayClasses(userId);
      
      if (!classes.length) {
        await sendMessage(userId, getResponse(lang, 'no_classes', { name: displayName, tasks: 0 }), getKeyboard(lang));
      } else {
        let list = '';
        for (let i = 0; i < classes.length; i++) list += `${i+1}. ${classes[i].subject}\n`;
        await sendMessage(userId, getResponse(lang, 'attendance_prompt', { classes: list, count: classes.length }), getKeyboard(lang));
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
          const result = await markAttended(userId, state.classes[idx].subject);
          if (result.already) {
            await sendMessage(userId, getResponse(lang, 'already_marked', { class_name: state.classes[idx].subject }), getKeyboard(lang));
          } else {
            const streakMsg = result.streak > 0 ? getResponse(lang, 'attendance_streak', { name: displayName, streak: result.streak + 1 }) : '';
            await sendMessage(userId, getResponse(lang, 'attendance_marked', { class_name: state.classes[idx].subject, streak_msg: streakMsg, name: displayName }), getKeyboard(lang));
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
        if (result.already) {
          await sendMessage(userId, getResponse(lang, 'already_marked', { class_name: cls.subject }), getKeyboard(lang));
        } else {
          const streakMsg = result.streak > 0 ? getResponse(lang, 'attendance_streak', { name: displayName, streak: result.streak + 1 }) : '';
          await sendMessage(userId, getResponse(lang, 'attendance_marked', { class_name: cls.subject, streak_msg: streakMsg, name: displayName }), getKeyboard(lang));
        }
        return;
      }
    }
    
    // ===== TASKS =====
    if (text === "📝 Tasks" || text === "📝 Задачи" || text === "📝 任务" || lowerText === 'my tasks' || lowerText === 'мои задачи' || lowerText === '我的任务') {
      const tasks = await getTasks(userId, true);
      const stats = await getTaskStats(userId);
      
      if (!tasks.length) {
        await sendMessage(userId, getResponse(lang, 'no_tasks', { name: displayName }), getKeyboard(lang));
      } else {
        let list = '';
        for (let i = 0; i < Math.min(tasks.length, 15); i++) {
          const t = tasks[i];
          const due = new Date(t.due_date);
          const priorityIcon = t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟡' : '🟢';
          const daysLeft = Math.ceil((due - new Date()) / 86400000);
          list += `${priorityIcon} ${i+1}. **${t.task}**\n   📅 Due: ${due.toLocaleDateString()} (${daysLeft} days)\n\n`;
        }
        await sendMessage(userId, getResponse(lang, 'tasks_header', { pending: stats.pending, completed: stats.completed, tasks: list }), getKeyboard(lang));
      }
      return;
    }
    
    // Complete task - "done task name"
    const doneMatch = text.match(/(?:done|complete|finished|готово|сделано|完成|完成了)\s+(.+?)(?:\.|$)/i);
    if (doneMatch) {
      const taskName = doneMatch[1].trim();
      const task = await findTaskByName(userId, taskName);
      if (task) {
        await completeTask(task.id, userId);
        await sendMessage(userId, getResponse(lang, 'task_completed', { name: displayName, task: task.task }), getKeyboard(lang));
      } else {
        await sendMessage(userId, getResponse(lang, 'task_not_found', { task: taskName }), getKeyboard(lang));
      }
      return;
    }
    
    // Delete task - "delete task name"
    const deleteMatch = text.match(/(?:delete|remove|удалить|删除)\s+(?:task\s+)?(.+?)(?:\.|$)/i);
    if (deleteMatch) {
      const taskName = deleteMatch[1].trim();
      const task = await findTaskByName(userId, taskName);
      if (task) {
        await deleteTask(task.id, userId);
        await sendMessage(userId, getResponse(lang, 'task_deleted', { task: task.task }), getKeyboard(lang));
      } else {
        await sendMessage(userId, getResponse(lang, 'task_not_found', { task: taskName }), getKeyboard(lang));
      }
      return;
    }
    
    // ===== ADD TASK =====
    if (text.startsWith('/task')) {
      const match = text.match(/\/task\s+['"](.+?)['"]\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s+(\d+)(?:\s+(\w+))?/);
      if (match) {
        await addTask(userId, match[1], match[2], parseInt(match[3]), match[4] || 'normal');
        await sendMessage(userId, getResponse(lang, 'task_added', {
          task: match[1], due_date: match[2], days: match[3],
          priority: match[4] === 'high' ? 'HIGH' : match[4] === 'medium' ? 'MEDIUM' : 'NORMAL'
        }), getKeyboard(lang));
      } else {
        await sendMessage(userId, getResponse(lang, 'invalid'), getKeyboard(lang));
      }
      return;
    }
    
    // ===== STATISTICS =====
    if (text === "📊 Stats" || text === "📊 Статистика" || text === "📊 统计" || lowerText === 'stats' || lowerText === 'statistics' || lowerText === 'статистика' || lowerText === '统计') {
      const [taskStats, attendanceStats, studyStats] = await Promise.all([
        getTaskStats(userId), getAttendanceStats(userId), getStudyStats(userId)
      ]);
      
      const taskBar = '█'.repeat(Math.floor(taskStats.rate / 10)) + '░'.repeat(10 - Math.floor(taskStats.rate / 10));
      const attendBar = '█'.repeat(Math.floor(attendanceStats.rate / 10)) + '░'.repeat(10 - Math.floor(attendanceStats.rate / 10));
      
      let msg = getResponse(lang, 'stats_header');
      msg += getResponse(lang, 'task_stats', { completed: taskStats.completed, pending: taskStats.pending, rate: taskStats.rate, bar: taskBar }) + '\n\n';
      msg += getResponse(lang, 'attendance_stats', { total: attendanceStats.total, attended: attendanceStats.attended, missed: attendanceStats.missed, rate: attendanceStats.rate, bar: attendBar }) + '\n\n';
      msg += getResponse(lang, 'study_stats', { today: studyStats.today, week: studyStats.weekly, total: studyStats.total, avg: studyStats.avg });
      
      let insight = '';
      if (taskStats.rate > 80) insight = `Excellent productivity ${displayName}! Keep crushing your goals! 🎯`;
      else if (attendanceStats.rate < 50 && attendanceStats.total > 5) insight = `Your attendance is ${attendanceStats.rate}%. Try to attend more classes! 📚`;
      else if (studyStats.total < 300) insight = `You've studied ${Math.round(studyStats.total/60)} hours total. Consistency is key! 💪`;
      else insight = `Great progress ${displayName}! Every step counts toward your success! 🌟`;
      
      msg += '\n\n' + getResponse(lang, 'time_insight', { message: insight });
      await sendMessage(userId, msg, getKeyboard(lang));
      return;
    }
    
    // ===== STUDY LOGGING =====
    const studyMatch = text.match(/(?:study|studied|учился|занимался|学习|学了)\s+(\d+)\s+(?:minutes?|min|минут|分钟)(?:\s+(?:for|по|学习)\s+(.+?))?(?:\.|$)/i);
    if (studyMatch) {
      const duration = parseInt(studyMatch[1]);
      const subject = studyMatch[2]?.trim() || 'General';
      await addStudy(userId, subject, duration);
      await sendMessage(userId, getResponse(lang, 'study_logged', { subject, duration }), getKeyboard(lang));
      return;
    }
    
    // ===== ICS IMPORT =====
    if (text === "📥 Import" || text === "📥 Импорт" || text === "📥 导入" || lowerText === 'import' || lowerText === 'импорт' || lowerText === '导入') {
      await sendMessage(userId, getResponse(lang, 'import_instructions'), getKeyboard(lang));
      return;
    }
    
    if (text.startsWith('/ics')) {
      const parts = text.split(/\s+/);
      if (parts.length > 1) {
        await sendMessage(userId, getResponse(lang, 'import_progress'), getKeyboard(lang));
        const reminder = await getReminder(userId);
        const count = await importICS(userId, parts[1]);
        if (count > 0) {
          await sendMessage(userId, getResponse(lang, 'import_success', { count, reminder }), getKeyboard(lang));
        } else {
          await sendMessage(userId, getResponse(lang, 'import_fail'), getKeyboard(lang));
        }
      } else {
        await sendMessage(userId, getResponse(lang, 'import_instructions'), getKeyboard(lang));
      }
      return;
    }
    
    // ===== HELP =====
    if (text === "❓ Help" || text === "❓ Помощь" || text === "❓ 帮助" || lowerText === 'help' || lowerText === 'помощь' || lowerText === '帮助') {
      await sendMessage(userId, getResponse(lang, 'help_text'), getKeyboard(lang));
      return;
    }
    
    // ===== POLITE RESPONSES =====
    if (lowerText.includes('thanks') || lowerText.includes('thank') || lowerText.includes('спасибо') || lowerText.includes('谢谢')) {
      await sendMessage(userId, getResponse(lang, 'thanks', { name: displayName }), getKeyboard(lang));
      return;
    }
    
    if (lowerText.includes('goodbye') || lowerText.includes('bye') || lowerText.includes('пока') || lowerText.includes('再见')) {
      await sendMessage(userId, getResponse(lang, 'goodbye', { name: displayName }), getKeyboard(lang));
      return;
    }
    
    if (lowerText.includes('how are you') || lowerText.includes('how are you doing') || lowerText.includes('как дела') || lowerText.includes('你好吗')) {
      await sendMessage(userId, getResponse(lang, 'how_r_u', { name: displayName }), getKeyboard(lang));
      return;
    }
    
    if (lowerText.includes('joke') || lowerText.includes('jokes') || lowerText.includes('шутка') || lowerText.includes('笑话')) {
      const jokes = {
        en: ["Why don't scientists trust atoms? Because they make up everything!", "What do you call a fake noodle? An impasta!", "Why did the scarecrow win an award? He was outstanding in his field!"],
        ru: ["Почему программисты путают Хэллоуин с Рождеством? 31 Oct = 25 Dec!", "Что говорит один ноль другому? Без тебя я просто пустое место!", "Почему студенты любят спать на лекциях? Потому что сон - лучшее лекарство от скуки!"],
        zh: ["为什么科学家不相信原子？因为它们构成了一切！", "为什么数学书总是很悲伤？因为它有太多问题！", "为什么电脑总是很冷？因为它的窗户总是打开着！"]
      };
      const jokeList = jokes[lang] || jokes.en;
      await sendMessage(userId, getResponse(lang, 'joke', { name: displayName, joke: jokeList[Math.floor(Math.random() * jokeList.length)] }), getKeyboard(lang));
      return;
    }
    
    // ===== DEFAULT =====
    await sendMessage(userId, getResponse(lang, 'unknown', { name: displayName }), getKeyboard(lang));
    
  } catch (error) {
    console.error("Handle error:", error);
    await sendMessage(userId, getResponse(lang, 'error', { name: displayName }), getKeyboard(lang));
  }
}

// ========== WEBHOOK HANDLER ==========
export async function handler(event) {
  try {
    const body = JSON.parse(event.body);
    
    // Fast confirmation response
    if (body.type === "confirmation") {
      return { statusCode: 200, body: process.env.VK_CONFIRMATION_TOKEN || "default" };
    }
    
    if (body.type === "message_new") {
      const msg = body.object.message;
      const userId = msg.from_id;
      const text = msg.text || "";
      const attachments = msg.attachments || [];
      
      console.log(`[${userId}] ${text.substring(0, 50)}`);
      
      // Fast language detection
      const lang = detectLanguage(text);
      await saveUser(userId, { language: lang });
      
      // Handle ICS file attachment (fast)
      for (const att of attachments) {
        if (att.type === 'doc' && att.doc.title?.toLowerCase().endsWith('.ics')) {
          await sendMessage(userId, getResponse(lang, 'import_progress'), getKeyboard(lang));
          const reminder = await getReminder(userId);
          const count = await importICS(userId, att.doc.url);
          if (count > 0) {
            await sendMessage(userId, getResponse(lang, 'import_success', { count, reminder }), getKeyboard(lang));
          } else {
            await sendMessage(userId, getResponse(lang, 'import_fail'), getKeyboard(lang));
          }
          return { statusCode: 200, body: JSON.stringify({ ok: true }) };
        }
      }
      
      // Handle ICS link in text
      const urlMatch = text.match(/(https?:\/\/[^\s]+\.ics)/i);
      if (urlMatch) {
        await sendMessage(userId, getResponse(lang, 'import_progress'), getKeyboard(lang));
        const reminder = await getReminder(userId);
        const count = await importICS(userId, urlMatch[1]);
        if (count > 0) {
          await sendMessage(userId, getResponse(lang, 'import_success', { count, reminder }), getKeyboard(lang));
        } else {
          await sendMessage(userId, getResponse(lang, 'import_fail'), getKeyboard(lang));
        }
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }
      
      // Process message
      await handleMessage(userId, text, lang);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }
    
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (error) {
    console.error("Handler error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
}

// ========== START REMINDERS ==========
startReminders();
console.log("✅ TIME MANAGEMENT BOT RUNNING PERFECTLY!");
console.log("📅 Full Schedule Management | 📝 Complete Task Tracking | ✅ Attendance System");
console.log("⏰ Smart Reminders | 📥 ICS Import | 🌐 Multi-language (EN/RU/ZH)");
console.log("💾 Full Memory - Remembers everything | ⚡ Optimized for FAST responses");