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

// VK Smart Hour Bot - Multilingual Edition (English, Русский, 中文)
// Supports automatic language detection and user language preferences
// Install: npm install node-fetch node-cron ical uuid express franc



// VK Smart Assistant Bot - Ultimate Edition
// Full-featured bot with multilingual support, schedule management, task tracking, attendance, study logging, and ICS import
// Requires: npm install vk-io node-cron ical uuid sqlite3 axios franc

import { VK, Keyboard, KeyboardBuilder } from 'vk-io';
import cron from 'node-cron';
import ical from 'ical';
import { v4 as uuidv4 } from 'uuid';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import axios from 'axios';
import franc from 'franc';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ==================== CONFIGURATION ====================
const VK_TOKEN = "vk1.a.eZvEbyVQo2aLD4K-r_7DxudJLQ4iNke42CLOnxo-ewzkJhDCjgY-FFImW2JeNulCAByv9bzkSuo_VXZFEV1GbMGoTfjD_TlDUV_pfIIfXU2eJvNsYIVFvVRa7OQxAhzGJPle69aDCxH7jYlu-LbbfSLM-9ZVDiOkmo3zSdgiWYegoSqKJqtGAGoyldsJYC79Fc9up1aNsvk3uJ3NZaE6Xg";
const GROUP_ID = 237363984;
const TIMEZONE = "Asia/Novosibirsk";

// ==================== MULTILINGUAL TRANSLATIONS ====================
const TRANSLATIONS = {
    en: {
        // Greetings & Setup
        ask_name: "👋 Hey there! I'm your personal academic assistant. What's your name?",
        got_name: "🎉 Nice to meet you, {name}! I'll help you manage your schedule, tasks, and track your progress!",
        greeting: "👋 Hey {name}! Ready to stay organized today? Check your schedule or tasks!",
        
        // Schedule
        schedule_today: "📅 **Today's Schedule**\n\n{classes}💡 *Click '✅ Mark' after each class to track attendance!*",
        schedule_tomorrow: "📅 **Tomorrow's Schedule**\n\n{classes}",
        no_classes: "🎉 No classes today, {name}! Enjoy your free day! 📚 Use this time to catch up on tasks!",
        no_classes_tomorrow: "🎉 No classes tomorrow, {name}! Time to relax or plan ahead!",
        next_class: "⏰ **Next Class**\n\n📖 {subject}\n🕐 {time}\n⏱️ In {minutes} minutes!\n\n✅ Don't forget to mark attendance after class!",
        no_next_class: "🎉 You're done with all classes today, {name}! Great job! Time to review your tasks!",
        
        // Attendance
        attendance_prompt: "📚 **Which class did you attend?**\n\n{classes}\n\n*Reply with the number or name of the class*",
        no_classes_attendance: "📭 No classes scheduled today, {name}!",
        attendance_marked: "✅ Great! Marked '{class_name}' as attended, {name}! Attendance rate increased! 📊",
        attendance_error: "❌ Couldn't find '{class_name}'. Please check the name and try again.",
        
        // Tasks
        tasks_header: "📋 **Your Active Tasks**\n\n{tasks}💡 *Say 'Done [task name]' when you complete something!*",
        no_tasks: "✅ Amazing, {name}! No pending tasks. You're all caught up! 🎉",
        task_added: "✅ Added task '{task}'! I'll remind you {days} day(s) before the deadline.",
        task_completed: "🎉 Awesome work, {name}! Completed '{task}'!\n\n📊 Check 'Statistics' to see your updated progress!",
        no_task_found: "❌ Couldn't find a task named '{task}'. Check your tasks with 'My tasks'.",
        task_format: "📝 **Add Task Format:**\n`/task \"Task name\" YYYY-MM-DD HH:MM days [priority]`\n\nPriority: high, medium, normal (default)",
        wrong_format: "❌ Wrong format! Use: `/task \"Task name\" 2025-12-20 23:59 7 high`",
        
        // Study Logging
        study_logged: "📚 Great job, {name}! Logged {minutes} minutes studying '{subject}'. Keep it up!",
        
        // ICS Import
        import_success: "🎉 Success! Imported {count} classes into your schedule, {name}!\n\n✅ I'll remind you before each class.\n📅 Ask 'What's today?' to see your schedule!",
        import_fail: "❌ Couldn't import from that link. Make sure it's a valid ICS file from your university portal.",
        import_instructions: "📥 **Import Your Schedule**\n\n1️⃣ Send me an ICS link (from your university portal)\n2️⃣ Use: `/ics https://your-calendar.ics`\n3️⃣ Attach an .ics file directly\n\nI'll auto-add all your classes with reminders! ⏰",
        
        // Statistics
        stats_header: "📊 **YOUR STUDY STATISTICS, {name}!** 📊\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n",
        task_stats: "📝 **TASK MASTERY**\n• ✅ Completed: {completed}\n• ⏳ Pending: {pending}\n• 🔴 High Priority Done: {high}\n• 🎯 Productivity: {score}%\n   [{bar}]",
        attendance_stats: "📚 **CLASS ATTENDANCE**\n• 📖 Total Classes: {total}\n• ✅ Attended: {attended}\n• ❌ Missed: {missed}\n• 📈 Attendance Rate: {rate}%\n   [{bar}]",
        study_stats: "⏱️ **STUDY TIME**\n• 📅 Today: {today} min\n• 📆 This Week: {week} min\n• 🏆 Total: {total} min\n• 💪 Daily Avg: {avg} min",
        motivation: "💡 **MOTIVATION**\n{message}",
        attendance_tip: "📌 *Tip: Mark attendance after each class to boost your stats!*",
        
        // Help & Commands
        help_text: "🤖 **What I Can Do For You, {name}**\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📅 **SCHEDULE**\n• \"What's today?\" - Today's classes\n• \"What's tomorrow?\" - Tomorrow's classes\n• \"What's next?\" - Next class\n• Send ICS link - Import timetable\n\n✅ **ATTENDANCE**\n• \"Mark\" or \"✅ Mark\" - Track attended classes\n\n📝 **TASKS**\n• \"My tasks\" - See all tasks\n• `/task \"Task\" 2025-12-20 23:59 7 high`\n• \"Done [task]\" - Mark complete\n\n📊 **STATISTICS**\n• \"Statistics\" - Complete progress report\n\n⏱️ **STUDY TIME**\n• \"Studied 30 minutes for Math\" - Log study time\n\n📥 **IMPORT**\n• Send ICS link or /ics [url]\n\n⏰ **REMINDERS**\n• Automatic 60-90 min before class\n\n🌐 **LANGUAGE**\n• /lang ru - Русский\n• /lang en - English\n• /lang zh - 中文\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nWhat would you like help with? 😊",
        
        // Reminders
        reminder: "⏰ **CLASS REMINDER, {name}!**\n\n📚 {subject}\n🕐 at {time}\n⏱️ Starts in {minutes} minutes!\n\n✅ Don't forget to mark attendance after class!",
        
        // Responses
        thanks: "You're welcome, {name}! 😊 Anything else? Check 'Statistics' to see your progress!",
        time: "🕐 Current time: {time}, {name}. What's on your schedule?",
        joke: "😂 Here's a joke for you, {name}:\n\n{joke}",
        unknown: "🤔 Interesting, {name}! How can I help? Try 'Help' to see what I can do!",
        language_changed: "🌐 Language changed to English! All messages will now be in English.",
        current_language: "🌐 Current language: English\n\nAvailable: /lang en, /lang ru, /lang zh",
        
        // Day names
        days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    },
    
    ru: {
        ask_name: "👋 Привет! Я твой персональный учебный ассистент. Как тебя зовут?",
        got_name: "🎉 Приятно познакомиться, {name}! Я помогу тебе с расписанием, задачами и учёбой!",
        greeting: "👋 Привет {name}! Готов к продуктивному дню? Проверь расписание или задачи!",
        
        schedule_today: "📅 **Расписание на сегодня**\n\n{classes}💡 *Нажми '✅ Отметить' после каждой пары для учёта посещаемости!*",
        schedule_tomorrow: "📅 **Расписание на завтра**\n\n{classes}",
        no_classes: "🎉 Сегодня нет пар, {name}! Свободный день! 📚 Используй время для задач!",
        no_classes_tomorrow: "🎉 Завтра нет пар, {name}! Время отдохнуть или спланировать дела!",
        next_class: "⏰ **Следующая пара**\n\n📖 {subject}\n🕐 в {time}\n⏱️ Через {minutes} минут!\n\n✅ Не забудь отметить посещаемость!",
        no_next_class: "🎉 На сегодня пар больше нет, {name}! Молодец! Проверь свои задачи!",
        
        attendance_prompt: "📚 **Какую пару ты посетил?**\n\n{classes}\n\n*Ответь номером или названием пары*",
        no_classes_attendance: "📭 Сегодня нет пар, {name}!",
        attendance_marked: "✅ Отлично! Отметил '{class_name}' как посещённое, {name}! Посещаемость выросла! 📊",
        attendance_error: "❌ Не могу найти '{class_name}'. Проверь название и попробуй снова.",
        
        tasks_header: "📋 **Твои активные задачи**\n\n{tasks}💡 *Скажи 'Готово [задача]' когда выполнишь!*",
        no_tasks: "✅ Потрясающе, {name}! Нет незавершённых задач. Ты всё успел! 🎉",
        task_added: "✅ Добавил задачу '{task}'! Напомню за {days} дн. до дедлайна.",
        task_completed: "🎉 Отличная работа, {name}! Выполнил '{task}'!\n\n📊 Проверь 'Статистику' чтобы увидеть прогресс!",
        no_task_found: "❌ Не могу найти задачу '{task}'. Проверь список командой 'Мои задачи'.",
        task_format: "📝 **Формат добавления задачи:**\n`/task \"Название\" ГГГГ-ММ-ДД ЧЧ:ММ дни [приоритет]`\n\nПриоритет: high, medium, normal",
        wrong_format: "❌ Неверный формат! Используй: `/task \"Название\" 2025-12-20 23:59 7 high`",
        
        study_logged: "📚 Отлично, {name}! Записал {minutes} минут учёбы по '{subject}'. Так держать!",
        
        import_success: "🎉 Успех! Импортировал {count} пар(ы) в расписание, {name}!\n\n✅ Я буду напоминать перед каждой парой.\n📅 Спроси 'Что сегодня?' чтобы увидеть расписание!",
        import_fail: "❌ Не удалось импортировать по этой ссылке. Убедись, что это правильный ICS файл.",
        import_instructions: "📥 **Импорт расписания**\n\n1️⃣ Отправь ICS ссылку (из университетского портала)\n2️⃣ Используй: `/ics https://your-calendar.ics`\n3️⃣ Прикрепи .ics файл\n\nЯ автоматически добавлю все пары с напоминаниями! ⏰",
        
        stats_header: "📊 **ТВОЯ СТАТИСТИКА УЧЁБЫ, {name}!** 📊\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n",
        task_stats: "📝 **ВЫПОЛНЕНИЕ ЗАДАЧ**\n• ✅ Выполнено: {completed}\n• ⏳ Ожидает: {pending}\n• 🔴 Высокий приоритет: {high}\n• 🎯 Продуктивность: {score}%\n   [{bar}]",
        attendance_stats: "📚 **ПОСЕЩАЕМОСТЬ**\n• 📖 Всего пар: {total}\n• ✅ Посещено: {attended}\n• ❌ Пропущено: {missed}\n• 📈 Посещаемость: {rate}%\n   [{bar}]",
        study_stats: "⏱️ **ВРЕМЯ УЧЁБЫ**\n• 📅 Сегодня: {today} мин\n• 📆 На этой неделе: {week} мин\n• 🏆 Всего: {total} мин\n• 💪 В среднем: {avg} мин/день",
        motivation: "💡 **МОТИВАЦИЯ**\n{message}",
        attendance_tip: "📌 *Совет: Отмечай посещаемость после каждой пары для повышения статистики!*",
        
        help_text: "🤖 **Что я умею, {name}**\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📅 **РАСПИСАНИЕ**\n• \"Что сегодня?\" - пары на сегодня\n• \"Что завтра?\" - пары на завтра\n• \"Что дальше?\" - следующую пару\n• Отправь ICS ссылку - импорт расписания\n\n✅ **ПОСЕЩАЕМОСТЬ**\n• \"Отметить\" или \"✅ Отметить\" - учёт посещений\n\n📝 **ЗАДАЧИ**\n• \"Мои задачи\" - список дел\n• `/task \"Задача\" 2025-12-20 23:59 7 high`\n• \"Готово [задача]\" - отметить выполненное\n\n📊 **СТАТИСТИКА**\n• \"Статистика\" - полный отчёт\n\n⏱️ **ВРЕМЯ УЧЁБЫ**\n• \"Учился 30 минут по Математике\" - логирование\n\n📥 **ИМПОРТ**\n• Отправь ICS ссылку или /ics [url]\n\n⏰ **НАПОМИНАНИЯ**\n• Автоматически за 60-90 минут до пары\n\n🌐 **ЯЗЫК**\n• /lang ru - Русский\n• /lang en - English\n• /lang zh - 中文\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nЧем могу помочь? 😊",
        
        reminder: "⏰ **НАПОМИНАНИЕ, {name}!**\n\n📚 {subject}\n🕐 в {time}\n⏱️ Через {minutes} минут!\n\n✅ Не забудь отметить посещаемость!",
        
        thanks: "Пожалуйста, {name}! 😊 Ещё что-то? Проверь 'Статистику' чтобы увидеть прогресс!",
        time: "🕐 Сейчас {time}, {name}. Что в планах?",
        joke: "😂 Шутка для тебя, {name}:\n\n{joke}",
        unknown: "🤔 Интересно, {name}! Чем могу помочь? Напиши 'Помощь' чтобы узнать что я умею!",
        language_changed: "🌐 Язык изменён на Русский! Все сообщения теперь на русском.",
        current_language: "🌐 Текущий язык: Русский\n\nДоступно: /lang ru, /lang en, /lang zh",
        
        days: ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"]
    },
    
    zh: {
        ask_name: "👋 你好！我是你的学习助手。请问你叫什么名字？",
        got_name: "🎉 很高兴认识你，{name}！我会帮你管理课程、任务和学习进度！",
        greeting: "👋 你好 {name}！准备好度过高效的一天了吗？查看课程或任务吧！",
        
        schedule_today: "📅 **今日课程**\n\n{classes}💡 *课后点击'✅ 标记'来记录出勤！*",
        schedule_tomorrow: "📅 **明日课程**\n\n{classes}",
        no_classes: "🎉 今天没课，{name}！自由的一天！📚 利用时间完成任务吧！",
        no_classes_tomorrow: "🎉 明天没课，{name}！休息或提前规划吧！",
        next_class: "⏰ **下一节课**\n\n📖 {subject}\n🕐 {time}\n⏱️ {minutes}分钟后开始！\n\n✅ 课后记得标记出勤！",
        no_next_class: "🎉 今天的课都上完了，{name}！干得好！检查一下任务吧！",
        
        attendance_prompt: "📚 **你上了哪节课？**\n\n{classes}\n\n*回复课程编号或名称*",
        no_classes_attendance: "📭 今天没有课，{name}！",
        attendance_marked: "✅ 太好了！已将'{class_name}'标记为已出勤，{name}！出勤率上升了！📊",
        attendance_error: "❌ 找不到'{class_name}'。请检查名称后重试。",
        
        tasks_header: "📋 **你的待办任务**\n\n{tasks}💡 *完成任务时说'完成 [任务名]'*",
        no_tasks: "✅ 太棒了，{name}！没有待办任务。你都完成了！🎉",
        task_added: "✅ 已添加任务'{task}'！我将在截止日期前{days}天提醒你。",
        task_completed: "🎉 干得好，{name}！完成了'{task}'！\n\n📊 查看'统计'了解你的进度！",
        no_task_found: "❌ 找不到名为'{task}'的任务。用'我的任务'查看列表。",
        task_format: "📝 **添加任务格式：**\n`/task \"任务名\" 年-月-日 时:分 天数 [优先级]`\n\n优先级：high（高）, medium（中）, normal（普通）",
        wrong_format: "❌ 格式错误！使用：`/task \"任务名\" 2025-12-20 23:59 7 high`",
        
        study_logged: "📚 太好了，{name}！记录了学习'{subject}' {minutes}分钟。继续加油！",
        
        import_success: "🎉 成功！已导入{count}节课到你的课程表，{name}！\n\n✅ 我会在每节课前提醒你。\n📅 问'今天有什么课？'查看课程表！",
        import_fail: "❌ 无法从该链接导入。请确保是有效的ICS文件。",
        import_instructions: "📥 **导入课程表**\n\n1️⃣ 发送ICS链接（来自学校门户）\n2️⃣ 使用：`/ics https://your-calendar.ics`\n3️⃣ 直接附加.ics文件\n\n我会自动添加所有课程并设置提醒！⏰",
        
        stats_header: "📊 **你的学习统计，{name}！** 📊\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n",
        task_stats: "📝 **任务完成情况**\n• ✅ 已完成：{completed}\n• ⏳ 待完成：{pending}\n• 🔴 高优先级完成：{high}\n• 🎯 生产力：{score}%\n   [{bar}]",
        attendance_stats: "📚 **出勤统计**\n• 📖 总课程：{total}\n• ✅ 已出勤：{attended}\n• ❌ 缺勤：{missed}\n• 📈 出勤率：{rate}%\n   [{bar}]",
        study_stats: "⏱️ **学习时间**\n• 📅 今日：{today} 分钟\n• 📆 本周：{week} 分钟\n• 🏆 总计：{total} 分钟\n• 💪 日均：{avg} 分钟",
        motivation: "💡 **激励语**\n{message}",
        attendance_tip: "📌 *提示：课后标记出勤可以提高你的统计数据！*",
        
        help_text: "🤖 **我能为你做什么，{name}**\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📅 **课程表**\n• \"今天有什么课？\" - 今日课程\n• \"明天有什么课？\" - 明日课程\n• \"下节课是什么？\" - 下节课\n• 发送ICS链接 - 导入课程表\n\n✅ **出勤**\n• \"标记\"或\"✅ 标记\" - 记录出勤\n\n📝 **任务**\n• \"我的任务\" - 查看任务\n• `/task \"任务名\" 2025-12-20 23:59 7 high`\n• \"完成 [任务名]\" - 标记完成\n\n📊 **统计**\n• \"统计\" - 完整进度报告\n\n⏱️ **学习时间**\n• \"学习了30分钟数学\" - 记录学习\n\n📥 **导入**\n• 发送ICS链接或 /ics [网址]\n\n⏰ **提醒**\n• 课前60-90分钟自动提醒\n\n🌐 **语言**\n• /lang ru - Русский\n• /lang en - English\n• /lang zh - 中文\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n需要什么帮助？😊",
        
        reminder: "⏰ **课程提醒，{name}！**\n\n📚 {subject}\n🕐 在 {time}\n⏱️ {minutes}分钟后开始！\n\n✅ 课后记得标记出勤！",
        
        thanks: "不客气，{name}！😊 还有什么需要？查看'统计'了解你的进度！",
        time: "🕐 当前时间：{time}，{name}。今天有什么安排？",
        joke: "😂 给你讲个笑话，{name}：\n\n{joke}",
        unknown: "🤔 有意思，{name}！我能帮你什么？试试'帮助'看看我能做什么！",
        language_changed: "🌐 语言已切换为中文！所有消息将使用中文。",
        current_language: "🌐 当前语言：中文\n\n可用：/lang ru, /lang en, /lang zh",
        
        days: ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"]
    }
};

// Motivational messages
const MOTIVATION_EN = [
    "You're doing amazing! Keep pushing forward! 💪",
    "Every step counts! Progress over perfection! 🌟",
    "Your dedication is inspiring! 🎯",
    "Small daily improvements lead to big results! 📈",
    "You've got this! Keep up the great work! 🚀",
    "Consistency is key, and you're crushing it! 🔑",
    "Today's efforts are tomorrow's success! ⭐"
];

const MOTIVATION_RU = [
    "У тебя отлично получается! Продолжай в том же духе! 💪",
    "Каждый шаг имеет значение! Прогресс важнее совершенства! 🌟",
    "Твоя целеустремлённость вдохновляет! 🎯",
    "Маленькие ежедневные улучшения ведут к большим результатам! 📈",
    "У тебя всё получится! Продолжай в том же духе! 🚀",
    "Постоянство - ключ к успеху, и у тебя отлично получается! 🔑",
    "Сегодняшние усилия - завтрашний успех! ⭐"
];

const MOTIVATION_ZH = [
    "你做得太棒了！继续加油！💪",
    "每一步都很重要！进步胜于完美！🌟",
    "你的努力很鼓舞人心！🎯",
    "小小的日常改进会带来巨大的成果！📈",
    "你能行的！继续保持！🚀",
    "坚持是关键，而你做得很好！🔑",
    "今天的努力是明天的成功！⭐"
];

const JOKES_EN = [
    "Why don't scientists trust atoms? Because they make up everything!",
    "What do you call a fake noodle? An impasta!",
    "Why did the scarecrow win an award? He was outstanding in his field!",
    "What do you call a bear with no teeth? A gummy bear!",
    "Why don't eggs tell jokes? They'd crack each other up!"
];

const JOKES_RU = [
    "Почему программисты путают Хэллоуин с Рождеством? 31 Oct = 25 Dec!",
    "Как называется ложная лапша? Паста-фальшивка!",
    "Что говорит один ноль другому? Без тебя я просто пустое место!",
    "Почему студенты любят овощи? Потому что они всегда есть!",
    "Как называется медведь без зубов? Жевательный мишка!"
];

const JOKES_ZH = [
    "为什么科学家不相信原子？因为它们构成了一切！",
    "什么叫假面条？假面食！",
    "稻草人为什么得奖？因为他在田里表现出色！",
    "没有牙齿的熊叫什么？软糖熊！",
    "鸡蛋为什么不讲笑话？因为它们会笑裂！"
];

// ==================== DATABASE SETUP ====================
let db;

async function initDatabase() {
    db = await open({
        filename: join(__dirname, 'assistant.db'),
        driver: sqlite3.Database
    });
    
    // Users table
    await db.exec(`CREATE TABLE IF NOT EXISTS users (
        vk_id INTEGER PRIMARY KEY,
        name TEXT DEFAULT '',
        language TEXT DEFAULT 'en',
        reminder_offset INTEGER DEFAULT 75,
        join_date DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    // Schedule table
    await db.exec(`CREATE TABLE IF NOT EXISTS schedule (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        subject TEXT,
        day INTEGER,
        start_time TEXT,
        end_time TEXT,
        location TEXT,
        teacher TEXT
    )`);
    
    // Class attendance
    await db.exec(`CREATE TABLE IF NOT EXISTS class_attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        class_name TEXT,
        date TEXT,
        attended INTEGER DEFAULT 0,
        missed INTEGER DEFAULT 0
    )`);
    
    // Tasks table
    await db.exec(`CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        task TEXT,
        due_date TEXT,
        remind_days INTEGER,
        priority TEXT DEFAULT 'normal',
        category TEXT DEFAULT 'general',
        done INTEGER DEFAULT 0,
        completed_date DATETIME
    )`);
    
    // Study sessions
    await db.exec(`CREATE TABLE IF NOT EXISTS study_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        subject TEXT,
        duration INTEGER,
        date TEXT
    )`);
    
    // Daily statistics
    await db.exec(`CREATE TABLE IF NOT EXISTS daily_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        date TEXT,
        tasks_completed INTEGER DEFAULT 0,
        classes_attended INTEGER DEFAULT 0,
        study_minutes INTEGER DEFAULT 0
    )`);
    
    // Reminders tracking
    await db.exec(`CREATE TABLE IF NOT EXISTS reminders (
        key TEXT PRIMARY KEY,
        sent INTEGER DEFAULT 1,
        reminder_time DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    // Conversations log
    await db.exec(`CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        message TEXT,
        response TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    console.log('✅ Database initialized');
}

// ==================== DATABASE HELPERS ====================
async function getUser(userId) {
    const user = await db.get('SELECT * FROM users WHERE vk_id = ?', userId);
    return user;
}

async function createUser(userId, name = null, language = 'en') {
    await db.run('INSERT OR REPLACE INTO users (vk_id, name, language) VALUES (?, ?, ?)', userId, name || '', language);
}

async function updateUserName(userId, name) {
    await db.run('UPDATE users SET name = ? WHERE vk_id = ?', name, userId);
}

async function getUserLanguage(userId) {
    const user = await getUser(userId);
    return user ? user.language : 'en';
}

async function setUserLanguage(userId, language) {
    await db.run('UPDATE users SET language = ? WHERE vk_id = ?', language, userId);
}

async function getReminderOffset(userId) {
    const user = await getUser(userId);
    return user ? user.reminder_offset : 75;
}

// Schedule functions
async function addClass(userId, subject, day, startTime, endTime, location = '', teacher = '') {
    await db.run(
        'INSERT INTO schedule (user_id, subject, day, start_time, end_time, location, teacher) VALUES (?, ?, ?, ?, ?, ?, ?)',
        userId, subject, day, startTime, endTime, location, teacher
    );
}

async function getTodayClasses(userId, timezone) {
    const today = new Date().toLocaleString('en-US', { timeZone: timezone });
    const day = new Date(today).getDay();
    const weekday = day === 0 ? 7 : day;
    
    return await db.all(
        'SELECT subject, start_time, end_time, location, teacher FROM schedule WHERE user_id = ? AND day = ? ORDER BY start_time',
        userId, weekday - 1
    );
}

async function getTomorrowClasses(userId, timezone) {
    const tomorrow = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
    tomorrow.setDate(tomorrow.getDate() + 1);
    const day = tomorrow.getDay();
    const weekday = day === 0 ? 7 : day;
    
    return await db.all(
        'SELECT subject, start_time, end_time, location, teacher FROM schedule WHERE user_id = ? AND day = ? ORDER BY start_time',
        userId, weekday - 1
    );
}

async function getAllClasses(userId) {
    return await db.all('SELECT subject, day, start_time, end_time, location FROM schedule WHERE user_id = ? ORDER BY day, start_time', userId);
}

async function getClassCount(userId) {
    const result = await db.get('SELECT COUNT(*) as count FROM schedule WHERE user_id = ?', userId);
    return result.count;
}

async function getNextClass(userId, timezone) {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
    const currentDay = now.getDay();
    const weekday = currentDay === 0 ? 7 : currentDay;
    const currentTime = now.toTimeString().slice(0, 5);
    
    const classes = await db.all(
        'SELECT subject, day, start_time FROM schedule WHERE user_id = ? ORDER BY day, start_time',
        userId
    );
    
    for (const cls of classes) {
        const classDay = cls.day + 1;
        if (classDay > weekday || (classDay === weekday && cls.start_time > currentTime)) {
            return cls;
        }
    }
    return classes[0] || null;
}

// Attendance functions
async function markAttendance(userId, className, timezone) {
    const date = new Date().toLocaleString('en-US', { timeZone: timezone }).split(',')[0];
    
    const existing = await db.get(
        'SELECT id FROM class_attendance WHERE user_id = ? AND class_name = ? AND date = ?',
        userId, className, date
    );
    
    if (existing) {
        await db.run('UPDATE class_attendance SET attended = 1, missed = 0 WHERE id = ?', existing.id);
    } else {
        await db.run(
            'INSERT INTO class_attendance (user_id, class_name, date, attended, missed) VALUES (?, ?, ?, 1, 0)',
            userId, className, date
        );
    }
    
    // Update daily stats
    const daily = await db.get('SELECT id FROM daily_stats WHERE user_id = ? AND date = ?', userId, date);
    if (daily) {
        await db.run('UPDATE daily_stats SET classes_attended = classes_attended + 1 WHERE id = ?', daily.id);
    } else {
        await db.run('INSERT INTO daily_stats (user_id, date, classes_attended) VALUES (?, ?, 1)', userId, date);
    }
}

async function getAttendanceStats(userId) {
    const attended = await db.get('SELECT COUNT(*) as count FROM class_attendance WHERE user_id = ? AND attended = 1', userId);
    const missed = await db.get('SELECT COUNT(*) as count FROM class_attendance WHERE user_id = ? AND missed = 1', userId);
    return { attended: attended.count, missed: missed.count };
}

// Task functions
async function addTask(userId, task, dueDate, remindDays, priority = 'normal') {
    await db.run(
        'INSERT INTO tasks (user_id, task, due_date, remind_days, priority, done) VALUES (?, ?, ?, ?, ?, 0)',
        userId, task, dueDate, remindDays, priority
    );
}

async function getActiveTasks(userId) {
    return await db.all(
        'SELECT id, task, due_date, remind_days, priority FROM tasks WHERE user_id = ? AND done = 0 ORDER BY due_date',
        userId
    );
}

async function completeTask(taskId, userId, timezone) {
    const completedDate = new Date().toLocaleString('en-US', { timeZone: timezone });
    await db.run('UPDATE tasks SET done = 1, completed_date = ? WHERE id = ? AND user_id = ?', completedDate, taskId, userId);
    
    const date = new Date().toLocaleString('en-US', { timeZone: timezone }).split(',')[0];
    const daily = await db.get('SELECT id FROM daily_stats WHERE user_id = ? AND date = ?', userId, date);
    if (daily) {
        await db.run('UPDATE daily_stats SET tasks_completed = tasks_completed + 1 WHERE id = ?', daily.id);
    } else {
        await db.run('INSERT INTO daily_stats (user_id, date, tasks_completed) VALUES (?, ?, 1)', userId, date);
    }
}

async function getTaskStats(userId) {
    const pending = await db.get('SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND done = 0', userId);
    const completed = await db.get('SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND done = 1', userId);
    const highPriority = await db.get('SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND done = 1 AND priority = "high"', userId);
    return { pending: pending.count, completed: completed.count, high: highPriority.count };
}

// Study session functions
async function addStudySession(userId, subject, duration, timezone) {
    const date = new Date().toLocaleString('en-US', { timeZone: timezone }).split(',')[0];
    await db.run(
        'INSERT INTO study_sessions (user_id, subject, duration, date) VALUES (?, ?, ?, ?)',
        userId, subject, duration, date
    );
    
    const daily = await db.get('SELECT id FROM daily_stats WHERE user_id = ? AND date = ?', userId, date);
    if (daily) {
        await db.run('UPDATE daily_stats SET study_minutes = study_minutes + ? WHERE id = ?', duration, daily.id);
    } else {
        await db.run('INSERT INTO daily_stats (user_id, date, study_minutes) VALUES (?, ?, ?)', userId, date, duration);
    }
}

async function getStudyStats(userId) {
    const total = await db.get('SELECT COALESCE(SUM(duration), 0) as total FROM study_sessions WHERE user_id = ?', userId);
    const weekly = await db.get(
        "SELECT COALESCE(SUM(duration), 0) as weekly FROM study_sessions WHERE user_id = ? AND date >= date('now', '-7 days')",
        userId
    );
    const today = await db.get(
        "SELECT COALESCE(SUM(duration), 0) as today FROM study_sessions WHERE user_id = ? AND date = date('now')",
        userId
    );
    return { total: total.total, weekly: weekly.weekly, today: today.today };
}

// ICS Import
async function importICSFromUrl(userId, url, timezone) {
    try {
        const response = await axios.get(url, { timeout: 30000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        const cal = ical.parseICS(response.data);
        let count = 0;
        
        for (const key in cal) {
            const event = cal[key];
            if (event.type === 'VEVENT' && event.start) {
                const startDate = new Date(event.start);
                const endDate = event.end ? new Date(event.end) : new Date(startDate.getTime() + 3600000);
                const day = startDate.getDay();
                const weekday = day === 0 ? 6 : day - 1;
                
                await addClass(
                    userId,
                    event.summary || 'Class',
                    weekday,
                    startDate.toTimeString().slice(0, 5),
                    endDate.toTimeString().slice(0, 5),
                    event.location || '',
                    ''
                );
                count++;
            }
        }
        return count;
    } catch (error) {
        console.error('ICS import error:', error.message);
        return -1;
    }
}

// ==================== HELPER FUNCTIONS ====================
function detectLanguage(text) {
    if (!text) return 'en';
    
    // Check for Chinese characters
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
    
    // Check for Cyrillic
    if (/[а-яА-Я]/.test(text)) return 'ru';
    
    // Default to English
    return 'en';
}

function getTranslation(userId, key, params = {}) {
    const lang = getUserLanguage(userId) || 'en';
    let text = TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key] || key;
    
    for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`{${k}}`, 'g'), v);
    }
    return text;
}

function getDayNames(lang) {
    return TRANSLATIONS[lang]?.days || TRANSLATIONS.en.days;
}

function getMotivation(lang) {
    if (lang === 'ru') return MOTIVATION_RU[Math.floor(Math.random() * MOTIVATION_RU.length)];
    if (lang === 'zh') return MOTIVATION_ZH[Math.floor(Math.random() * MOTIVATION_ZH.length)];
    return MOTIVATION_EN[Math.floor(Math.random() * MOTIVATION_EN.length)];
}

function getJoke(lang) {
    if (lang === 'ru') return JOKES_RU[Math.floor(Math.random() * JOKES_RU.length)];
    if (lang === 'zh') return JOKES_ZH[Math.floor(Math.random() * JOKES_ZH.length)];
    return JOKES_EN[Math.floor(Math.random() * JOKES_EN.length)];
}

function createProgressBar(percentage) {
    const filled = Math.floor(percentage / 10);
    const empty = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

// ==================== VK BOT SETUP ====================
const vk = new VK({ token: VK_TOKEN });

// Create keyboards
function getMainKeyboard(lang) {
    const keyboard = Keyboard.builder();
    
    if (lang === 'ru') {
        keyboard.textButton({ label: '📅 Что сегодня?', color: Keyboard.PRIMARY_COLOR });
        keyboard.textButton({ label: '📅 Что завтра?', color: Keyboard.PRIMARY_COLOR });
        keyboard.row();
        keyboard.textButton({ label: '⏰ Что дальше?', color: Keyboard.SECONDARY_COLOR });
        keyboard.textButton({ label: '📝 Мои задачи', color: Keyboard.SECONDARY_COLOR });
        keyboard.row();
        keyboard.textButton({ label: '📊 Статистика', color: Keyboard.POSITIVE_COLOR });
        keyboard.textButton({ label: '📥 Импорт', color: Keyboard.POSITIVE_COLOR });
        keyboard.row();
        keyboard.textButton({ label: '✅ Отметить', color: Keyboard.PRIMARY_COLOR });
        keyboard.textButton({ label: '❓ Помощь', color: Keyboard.PRIMARY_COLOR });
    } else if (lang === 'zh') {
        keyboard.textButton({ label: '📅 今天有什么课？', color: Keyboard.PRIMARY_COLOR });
        keyboard.textButton({ label: '📅 明天有什么课？', color: Keyboard.PRIMARY_COLOR });
        keyboard.row();
        keyboard.textButton({ label: '⏰ 下节课是什么？', color: Keyboard.SECONDARY_COLOR });
        keyboard.textButton({ label: '📝 我的任务', color: Keyboard.SECONDARY_COLOR });
        keyboard.row();
        keyboard.textButton({ label: '📊 统计', color: Keyboard.POSITIVE_COLOR });
        keyboard.textButton({ label: '📥 导入', color: Keyboard.POSITIVE_COLOR });
        keyboard.row();
        keyboard.textButton({ label: '✅ 标记', color: Keyboard.PRIMARY_COLOR });
        keyboard.textButton({ label: '❓ 帮助', color: Keyboard.PRIMARY_COLOR });
    } else {
        keyboard.textButton({ label: '📅 What\'s today?', color: Keyboard.PRIMARY_COLOR });
        keyboard.textButton({ label: '📅 What\'s tomorrow?', color: Keyboard.PRIMARY_COLOR });
        keyboard.row();
        keyboard.textButton({ label: '⏰ What\'s next?', color: Keyboard.SECONDARY_COLOR });
        keyboard.textButton({ label: '📝 My tasks', color: Keyboard.SECONDARY_COLOR });
        keyboard.row();
        keyboard.textButton({ label: '📊 Statistics', color: Keyboard.POSITIVE_COLOR });
        keyboard.textButton({ label: '📥 Import', color: Keyboard.POSITIVE_COLOR });
        keyboard.row();
        keyboard.textButton({ label: '✅ Mark', color: Keyboard.PRIMARY_COLOR });
        keyboard.textButton({ label: '❓ Help', color: Keyboard.PRIMARY_COLOR });
    }
    
    return keyboard;
}

// Send message helper
async function sendMessage(userId, text, keyboard = null) {
    try {
        await vk.api.messages.send({
            user_id: userId,
            message: text,
            random_id: Math.floor(Math.random() * 1000000000),
            keyboard: keyboard ? keyboard : getMainKeyboard(await getUserLanguage(userId))
        });
    } catch (error) {
        console.error('Send message error:', error);
    }
}

// ==================== MESSAGE HANDLER ====================
async function handleMessage(userId, text, attachments) {
    // Get or create user
    let user = await getUser(userId);
    if (!user) {
        const detectedLang = detectLanguage(text);
        await createUser(userId, null, detectedLang);
        user = await getUser(userId);
        await sendMessage(userId, getTranslation(userId, 'ask_name'));
        return;
    }
    
    const lang = user.language;
    const name = user.name;
    
    // Check if user hasn't set name yet
    if (!name && !text.match(/(?:my name is|call me|меня зовут|зовут|我叫)/i)) {
        await sendMessage(userId, getTranslation(userId, 'ask_name'));
        return;
    }
    
    // Extract name from introduction
    const nameMatch = text.match(/(?:my name is|call me|меня зовут|зовут|我叫)\s+([A-Za-zА-Яа-я\u4e00-\u9fff]+)/i);
    if (nameMatch && !name) {
        const newName = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1);
        await updateUserName(userId, newName);
        await sendMessage(userId, getTranslation(userId, 'got_name', { name: newName }));
        return;
    }
    
    const textLower = text.toLowerCase();
    
    // Language change command
    if (text.startsWith('/lang')) {
        const parts = text.split(' ');
        if (parts[1] === 'ru') {
            await setUserLanguage(userId, 'ru');
            await sendMessage(userId, TRANSLATIONS.ru.language_changed);
        } else if (parts[1] === 'zh') {
            await setUserLanguage(userId, 'zh');
            await sendMessage(userId, TRANSLATIONS.zh.language_changed);
        } else if (parts[1] === 'en') {
            await setUserLanguage(userId, 'en');
            await sendMessage(userId, TRANSLATIONS.en.language_changed);
        } else {
            await sendMessage(userId, getTranslation(userId, 'current_language'));
        }
        return;
    }
    
    // Mark attendance
    if (text === '✅ Mark' || text === '✅ Отметить' || text === '✅ 标记' || text === 'Mark' || text === 'Отметить') {
        const classes = await getTodayClasses(userId, TIMEZONE);
        if (classes.length > 0) {
            const classList = classes.map((c, i) => `${i + 1}. ${c.subject} (${c.start_time}-${c.end_time})`).join('\n');
            await sendMessage(userId, getTranslation(userId, 'attendance_prompt', { classes: classList }));
        } else {
            await sendMessage(userId, getTranslation(userId, 'no_classes_attendance', { name: name || '' }));
        }
        return;
    }
    
    // Handle attendance by number
    if (/^\d+$/.test(text) && parseInt(text) <= 10) {
        const classes = await getTodayClasses(userId, TIMEZONE);
        const idx = parseInt(text) - 1;
        if (idx >= 0 && idx < classes.length) {
            const className = classes[idx].subject;
            await markAttendance(userId, className, TIMEZONE);
            await sendMessage(userId, getTranslation(userId, 'attendance_marked', { name: name || '', class_name: className }));
            return;
        }
    }
    
    // Handle attendance by name
    const todayClasses = await getTodayClasses(userId, TIMEZONE);
    for (const cls of todayClasses) {
        if (textLower.includes(cls.subject.toLowerCase())) {
            await markAttendance(userId, cls.subject, TIMEZONE);
            await sendMessage(userId, getTranslation(userId, 'attendance_marked', { name: name || '', class_name: cls.subject }));
            return;
        }
    }
    
    // ICS Import from URL
    if (text.includes('.ics') && (text.includes('http://') || text.includes('https://'))) {
        const urlMatch = text.match(/(https?:\/\/[^\s]+\.ics)/i);
        if (urlMatch) {
            await sendMessage(userId, '⏳ ' + (lang === 'ru' ? 'Импортирую расписание...' : lang === 'zh' ? '正在导入课程表...' : 'Importing your schedule...'));
            const count = await importICSFromUrl(userId, urlMatch[0], TIMEZONE);
            if (count > 0) {
                await sendMessage(userId, getTranslation(userId, 'import_success', { count, name: name || '' }));
            } else {
                await sendMessage(userId, getTranslation(userId, 'import_fail', { name: name || '' }));
            }
        }
        return;
    }
    
    // /ics command
    if (text.startsWith('/ics')) {
        const parts = text.split(/\s+/);
        if (parts.length === 2 && parts[1].startsWith('http')) {
            await sendMessage(userId, '⏳ ' + (lang === 'ru' ? 'Импортирую...' : lang === 'zh' ? '正在导入...' : 'Importing...'));
            const count = await importICSFromUrl(userId, parts[1], TIMEZONE);
            if (count > 0) {
                await sendMessage(userId, getTranslation(userId, 'import_success', { count, name: name || '' }));
            } else {
                await sendMessage(userId, getTranslation(userId, 'import_fail', { name: name || '' }));
            }
        } else {
            await sendMessage(userId, getTranslation(userId, 'import_instructions', { name: name || '' }));
        }
        return;
    }
    
    // Import button
    if (text === '📥 Import' || text === '📥 Импорт' || text === '📥 导入' || textLower.includes('import') || textLower.includes('импорт')) {
        await sendMessage(userId, getTranslation(userId, 'import_instructions', { name: name || '' }));
        return;
    }
    
    // /task command
    if (text.startsWith('/task')) {
        const match = text.match(/\/task\s+"([^"]+)"\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+(\d+)\s*(high|medium|normal)?/i);
        if (match) {
            const taskName = match[1];
            const dueDate = `${match[2]} ${match[3]}`;
            const days = parseInt(match[4]);
            const priority = match[5] || 'normal';
            await addTask(userId, taskName, dueDate, days, priority);
            await sendMessage(userId, getTranslation(userId, 'task_added', { name: name || '', task: taskName, days }));
        } else {
            await sendMessage(userId, getTranslation(userId, 'task_format'));
        }
        return;
    }
    
    // Statistics
    if (text === '📊 Statistics' || text === '📊 Статистика' || text === '📊 统计' || 
        textLower.includes('statistics') || textLower.includes('stats') || textLower.includes('статистика')) {
        
        const classCount = await getClassCount(userId);
        const { pending, completed, high } = await getTaskStats(userId);
        const { attended, missed } = await getAttendanceStats(userId);
        const { total, weekly, today: studyToday } = await getStudyStats(userId);
        
        const totalClasses = classCount;
        const attendanceRate = (attended + missed) > 0 ? (attended / (attended + missed)) * 100 : 0;
        const productivityScore = (completed + pending) > 0 ? (completed / (completed + pending)) * 100 : 0;
        const avgDaily = weekly / 7;
        
        const prodBar = createProgressBar(productivityScore);
        const attendBar = createProgressBar(attendanceRate);
        const motivation = getMotivation(lang);
        
        let message = getTranslation(userId, 'stats_header', { name: name || '' });
        message += getTranslation(userId, 'task_stats', {
            completed, pending, high,
            score: Math.round(productivityScore),
            bar: prodBar
        }) + '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
        message += getTranslation(userId, 'attendance_stats', {
            total: totalClasses, attended, missed,
            rate: attendanceRate.toFixed(1),
            bar: attendBar
        }) + '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
        message += getTranslation(userId, 'study_stats', {
            today: studyToday, week: weekly, total: total,
            avg: Math.round(avgDaily)
        }) + '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
        message += getTranslation(userId, 'motivation', { message: motivation }) + '\n\n';
        message += getTranslation(userId, 'attendance_tip');
        
        await sendMessage(userId, message);
        return;
    }
    
    // Today's schedule
    if (text === '📅 What\'s today?' || text === '📅 Что сегодня?' || text === '📅 今天有什么课？' ||
        textLower.includes('today') || textLower.includes('сегодня')) {
        const classes = await getTodayClasses(userId, TIMEZONE);
        if (classes.length > 0) {
            let classList = '';
            for (const cls of classes) {
                classList += `⏰ ${cls.start_time}-${cls.end_time} • **${cls.subject}**\n`;
                if (cls.location) classList += `   📍 ${cls.location}\n`;
                classList += '\n';
            }
            await sendMessage(userId, getTranslation(userId, 'schedule_today', { name: name || '', classes: classList }));
        } else {
            await sendMessage(userId, getTranslation(userId, 'no_classes', { name: name || '' }));
        }
        return;
    }
    
    // Tomorrow's schedule
    if (text === '📅 What\'s tomorrow?' || text === '📅 Что завтра?' || text === '📅 明天有什么课？' ||
        textLower.includes('tomorrow') || textLower.includes('завтра')) {
        const classes = await getTomorrowClasses(userId, TIMEZONE);
        if (classes.length > 0) {
            let classList = '';
            for (const cls of classes) {
                classList += `⏰ ${cls.start_time}-${cls.end_time} • **${cls.subject}**\n`;
                if (cls.location) classList += `   📍 ${cls.location}\n`;
                classList += '\n';
            }
            await sendMessage(userId, getTranslation(userId, 'schedule_tomorrow', { name: name || '', classes: classList }));
        } else {
            await sendMessage(userId, getTranslation(userId, 'no_classes_tomorrow', { name: name || '' }));
        }
        return;
    }
    
    // Next class
    if (text === '⏰ What\'s next?' || text === '⏰ Что дальше?' || text === '⏰ 下节课是什么？' ||
        textLower.includes('next') || textLower.includes('дальше')) {
        const nextClass = await getNextClass(userId, TIMEZONE);
        if (nextClass) {
            const now = new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
            const [hour, minute] = nextClass.start_time.split(':').map(Number);
            const classTime = new Date(now);
            classTime.setHours(hour, minute, 0, 0);
            const minutes = Math.max(0, Math.round((classTime - now) / 60000));
            await sendMessage(userId, getTranslation(userId, 'next_class', {
                name: name || '', subject: nextClass.subject,
                time: nextClass.start_time, minutes
            }));
        } else {
            await sendMessage(userId, getTranslation(userId, 'no_next_class', { name: name || '' }));
        }
        return;
    }
    
    // My tasks
    if (text === '📝 My tasks' || text === '📝 Мои задачи' || text === '📝 我的任务' ||
        textLower.includes('tasks') || textLower.includes('задачи')) {
        const tasks = await getActiveTasks(userId);
        if (tasks.length > 0) {
            let taskList = '';
            for (const task of tasks) {
                const priorityIcon = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢';
                const dueDate = new Date(task.due_date);
                taskList += `${priorityIcon} **${task.task}**\n   ⏰ ${dueDate.toLocaleDateString()} ${dueDate.toLocaleTimeString()}\n\n`;
            }
            await sendMessage(userId, getTranslation(userId, 'tasks_header', { name: name || '', tasks: taskList }));
        } else {
            await sendMessage(userId, getTranslation(userId, 'no_tasks', { name: name || '' }));
        }
        return;
    }
    
    // Complete task (Done [task])
    const doneMatch = text.match(/(?:done|finished|complete|готово|сделал|выполнил|完成)\s+(.+)/i);
    if (doneMatch) {
        const taskName = doneMatch[1].trim();
        const tasks = await getActiveTasks(userId);
        let found = false;
        for (const task of tasks) {
            if (task.task.toLowerCase().includes(taskName.toLowerCase()) || taskName.toLowerCase().includes(task.task.toLowerCase())) {
                await completeTask(task.id, userId, TIMEZONE);
                await sendMessage(userId, getTranslation(userId, 'task_completed', { name: name || '', task: task.task }));
                found = true;
                break;
            }
        }
        if (!found) {
            await sendMessage(userId, getTranslation(userId, 'no_task_found', { name: name || '', task: taskName }));
        }
        return;
    }
    
    // Study logging
    const studyMatch = text.match(/(?:studied|учился|занимался|学习了)\s+(\d+)\s*(?:minutes?|min|минут|分钟)\s*(?:for|по|学习)?\s*(.+)/i);
    if (studyMatch) {
        const duration = parseInt(studyMatch[1]);
        const subject = studyMatch[2].trim();
        await addStudySession(userId, subject, duration, TIMEZONE);
        await sendMessage(userId, getTranslation(userId, 'study_logged', { name: name || '', minutes: duration, subject }));
        return;
    }
    
    // Help
    if (text === '❓ Help' || text === '❓ Помощь' || text === '❓ 帮助' ||
        textLower.includes('help') || textLower.includes('помощь')) {
        await sendMessage(userId, getTranslation(userId, 'help_text', { name: name || '' }));
        return;
    }
    
    // Thanks
    if (textLower.includes('thanks') || textLower.includes('thank') || textLower.includes('спасибо')) {
        await sendMessage(userId, getTranslation(userId, 'thanks', { name: name || '' }));
        return;
    }
    
    // Time
    if (textLower.includes('time') || textLower.includes('время') || textLower.includes('时间')) {
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
        await sendMessage(userId, getTranslation(userId, 'time', { name: name || '', time: now.toLocaleTimeString() }));
        return;
    }
    
    // Joke
    if (textLower.includes('joke') || textLower.includes('шутка') || textLower.includes('笑话')) {
        await sendMessage(userId, getTranslation(userId, 'joke', { name: name || '', joke: getJoke(lang) }));
        return;
    }
    
    // Greeting
    if (textLower.match(/^(hello|hi|hey|привет|здравствуй|你好)$/)) {
        await sendMessage(userId, getTranslation(userId, 'greeting', { name: name || '' }));
        return;
    }
    
    // Default response
    await sendMessage(userId, getTranslation(userId, 'unknown', { name: name || '' }));
}

// ==================== REMINDER SYSTEM ====================
async function checkReminders() {
    try {
        const users = await db.all('SELECT DISTINCT vk_id FROM users');
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
        const currentDay = now.getDay();
        const weekday = currentDay === 0 ? 6 : currentDay - 1;
        
        for (const user of users) {
            const userId = user.vk_id;
            const userInfo = await getUser(userId);
            const name = userInfo?.name || 'friend';
            const lang = userInfo?.language || 'en';
            const reminderOffset = userInfo?.reminder_offset || 75;
            
            const classes = await db.all(
                'SELECT subject, start_time FROM schedule WHERE user_id = ? AND day = ?',
                userId, weekday
            );
            
            for (const cls of classes) {
                const [hour, minute] = cls.start_time.split(':').map(Number);
                const classTime = new Date(now);
                classTime.setHours(hour, minute, 0, 0);
                const minutesUntil = (classTime - now) / 60000;
                
                if (minutesUntil >= 60 && minutesUntil <= reminderOffset) {
                    const reminderKey = `reminder_${userId}_${currentDay}_${cls.start_time}`;
                    const existing = await db.get('SELECT sent FROM reminders WHERE key = ?', reminderKey);
                    
                    if (!existing) {
                        const reminderMsg = getTranslation(userId, 'reminder', {
                            name, subject: cls.subject,
                            time: cls.start_time,
                            minutes: Math.round(minutesUntil)
                        });
                        await sendMessage(userId, reminderMsg);
                        await db.run('INSERT INTO reminders (key, sent) VALUES (?, 1)', reminderKey);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Reminder check error:', error);
    }
}

// ==================== START BOT ====================
async function startBot() {
    await initDatabase();
    
    // Schedule reminder checks every 5 minutes
    cron.schedule('*/5 * * * *', () => {
        checkReminders().catch(console.error);
    });
    
    // Schedule daily stats reset at midnight
    cron.schedule('0 0 * * *', () => {
        console.log('Daily stats reset not needed - keeping history');
    });
    
    console.log('='.repeat(60));
    console.log('🤖 VK Smart Assistant Bot - Ultimate Edition');
    console.log('='.repeat(60));
    console.log('✅ Features:');
    console.log('   • English, Russian, Chinese (auto-detects)');
    console.log('   • Schedule management with ICS import');
    console.log('   • Task tracking with priorities');
    console.log('   • Class attendance tracking');
    console.log('   • Study time logging');
    console.log('   • Complete statistics with progress bars');
    console.log('   • 60-90 minute class reminders');
    console.log('   • Motivational messages');
    console.log('='.repeat(60));
    console.log('✅ Bot is running and waiting for messages...');
    console.log('💬 Supports: English | Русский | 中文');
    console.log('📥 Send ICS link or file to import schedule');
    console.log('='.repeat(60));
    
    // Start long polling
    vk.updates.on('message_new', async (context) => {
        try {
            const userId = context.senderId;
            const text = context.text || '';
            const attachments = context.messageAttachments || [];
            
            // Handle file attachments
            const icsAttachment = attachments.find(att => 
                att.type === 'doc' && att.doc?.title?.endsWith('.ics')
            );
            
            if (icsAttachment) {
                const url = icsAttachment.doc.url;
                const user = await getUser(userId);
                const lang = user?.language || 'en';
                const name = user?.name || '';
                await context.send('⏳ ' + (lang === 'ru' ? 'Импортирую файл...' : lang === 'zh' ? '正在导入文件...' : 'Importing file...'));
                const count = await importICSFromUrl(userId, url, TIMEZONE);
                if (count > 0) {
                    await context.send(getTranslation(userId, 'import_success', { count, name }));
                } else {
                    await context.send(getTranslation(userId, 'import_fail', { name }));
                }
                return;
            }
            
            await handleMessage(userId, text, attachments);
        } catch (error) {
            console.error('Message handler error:', error);
        }
    });
    
    await vk.updates.start().catch(console.error);
    console.log('✅ Long polling started');
}

startBot().catch(console.error);



