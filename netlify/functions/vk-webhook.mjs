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






/*// VK Smart Assistant Bot - Ultimate Supabase Edition
// Full-featured bot with multilingual support (EN/RU/ZH), schedule management, tasks, attendance, study logging, ICS import
// Uses Supabase for database, optimized for VK Callback API
// Deploy as Vercel/Cloud Function or run as standalone server

import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";
import ical from "ical";
import { franc } from "franc";

// ==================== CONFIGURATION ====================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const VK_TOKEN = process.env.VK_TOKEN;
const VK_API_VERSION = "5.199";
const TIMEZONE = process.env.TIMEZONE || "Asia/Novosibirsk";

// ==================== CACHING ====================
const cache = new Map();
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

function invalidateCache(userId, type) {
  cache.delete(`${type}_${userId}`);
}

// ==================== MULTILINGUAL TRANSLATIONS ====================
const TRANSLATIONS = {
  en: {
    // Setup & Greetings
    ask_name: "👋 Hey there! I'm your personal academic assistant. What's your name?",
    got_name: "🎉 Nice to meet you, {name}! I'll help you manage your schedule, tasks, and track your progress!",
    greeting: "👋 Hey {name}! Ready to stay organized today? Check your schedule or tasks!",
    
    // Schedule
    schedule_today: "📅 **Today's Schedule**\n\n{classes}💡 *Click '✅ Mark' after each class to track attendance!*",
    schedule_tomorrow: "📅 **Tomorrow's Schedule**\n\n{classes}",
    schedule_empty: "📭 Your schedule is empty. Use /add or send an ICS file to import.",
    no_classes: "🎉 No classes today, {name}! Enjoy your free day!",
    no_classes_tomorrow: "🎉 No classes tomorrow, {name}! Time to relax!",
    next_class: "⏰ **Next Class**\n\n📖 {subject}\n🕐 {time}\n⏱️ In {minutes} minutes!\n\n✅ Don't forget to mark attendance!",
    no_next_class: "🎉 You're done with all classes today, {name}! Great job!",
    
    // Attendance
    attendance_prompt: "📚 **Which class did you attend?**\n\n{classes}\n\n*Reply with the number or name of the class*",
    no_classes_attendance: "📭 No classes scheduled today, {name}!",
    attendance_marked: "✅ Great! Marked '{class_name}' as attended, {name}! Attendance rate increased!",
    attendance_error: "❌ Couldn't find '{class_name}'. Please check the name.",
    
    // Tasks
    tasks_header: "📋 **Your Active Tasks**\n\n{tasks}💡 *Say 'Done [task name]' or click ✅ when complete!*",
    no_tasks: "✅ Amazing, {name}! No pending tasks. You're all caught up!",
    task_added: "✅ Added task '{task}'! I'll remind you {days} day(s) before the deadline.",
    task_completed: "🎉 Awesome work, {name}! Completed '{task}'!\n\n📊 Check 'Statistics' to see your progress!",
    no_task_found: "❌ Couldn't find a task named '{task}'. Check your tasks with 'My tasks'.",
    task_format: "📝 **Add Task Format:**\n`/task \"Task name\" YYYY-MM-DD HH:MM days [priority]`\n\nPriority: high, medium, normal",
    wrong_format: "❌ Wrong format! Use: `/task \"Task name\" 2025-12-20 23:59 7 high`",
    
    // Study Logging
    study_logged: "📚 Great job, {name}! Logged {minutes} minutes studying '{subject}'. Keep it up!",
    
    // ICS Import
    import_success: "🎉 Success! Imported {count} classes into your schedule, {name}!\n\n✅ I'll remind you before each class.",
    import_fail: "❌ Couldn't import from that link. Make sure it's a valid ICS file.",
    import_instructions: "📥 **Import Your Schedule**\n\n1️⃣ Send an ICS link\n2️⃣ Use: `/ics https://your-calendar.ics`\n3️⃣ Attach an .ics file\n\nI'll auto-add all your classes with reminders!",
    
    // Statistics
    stats_header: "📊 **YOUR STUDY STATISTICS, {name}!** 📊\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n",
    task_stats: "📝 **TASK MASTERY**\n• ✅ Completed: {completed}\n• ⏳ Pending: {pending}\n• 🔴 High Priority Done: {high}\n• 🎯 Productivity: {score}%\n   [{bar}]",
    attendance_stats: "📚 **CLASS ATTENDANCE**\n• 📖 Total Classes: {total}\n• ✅ Attended: {attended}\n• ❌ Missed: {missed}\n• 📈 Attendance Rate: {rate}%\n   [{bar}]",
    study_stats: "⏱️ **STUDY TIME**\n• 📅 Today: {today} min\n• 📆 This Week: {week} min\n• 🏆 Total: {total} min\n• 💪 Daily Avg: {avg} min",
    motivation: "💡 **MOTIVATION**\n{message}",
    attendance_tip: "📌 *Tip: Mark attendance after each class to boost your stats!*",
    no_stats: "📊 No data yet. Start by adding classes and tasks to see your statistics!",
    
    // CRUD Operations
    class_added: "✅ Class '{subject}' added to {day} at {start_time}-{end_time}!",
    class_deleted: "✅ Class '{subject}' removed from your schedule.",
    class_update_help: "📝 **Update Class:**\n`/update <class_id> <field> <value>`\n\nFields: subject, day, start_time, end_time, location",
    delete_help: "📝 **Delete Class:**\n`/delete <class_id>` or `/delete <subject> <day> <start_time>`",
    
    // Settings
    settings_title: "⚙️ **Settings**\n\n",
    settings_reminder: "🔔 Reminder offset: {offset} minutes",
    settings_language: "🌐 Language: {language}",
    settings_commands: "\n\nCommands:\n/remind <minutes> - Set reminder time\n/lang ru/en/zh - Change language",
    reminder_set: "⏱️ Reminder time set to {minutes} minutes before class!",
    reminder_current: "Current reminder offset: {offset} minutes before each class.",
    language_changed: "🌐 Language changed to {language}!",
    current_language: "🌐 Current language: {language}\n\nAvailable: /lang en, /lang ru, /lang zh",
    
    // Help
    help_text: `🤖 **What I Can Do For You**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 **SCHEDULE**
• "What's today?" - Today's classes
• "What's tomorrow?" - Tomorrow's classes  
• "What's next?" - Next class
• /add <subject> <day> <start> <end> - Add class
• /delete <class_id> - Remove class
• /update <id> <field> <value> - Edit class
• Send ICS link - Import timetable

✅ **ATTENDANCE**
• "Mark" or "✅ Mark" - Track attended classes

📝 **TASKS**
• "My tasks" - See all tasks
• /task "Task" 2025-12-20 23:59 7 high - Add task
• "Done [task]" - Mark complete

📊 **STATISTICS**
• "Statistics" - Complete progress report

⏱️ **STUDY TIME**
• "Studied 30 minutes for Math" - Log study time

📥 **IMPORT**
• Send ICS link or /ics [url]

⏰ **REMINDERS**
• Automatic before each class
• /remind <minutes> - Customize timing

🌐 **LANGUAGE**
• /lang ru - Русский
• /lang en - English  
• /lang zh - 中文

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
What would you like help with? 😊`,
    
    // Reminders
    reminder: "⏰ **CLASS REMINDER!**\n\n📚 {subject}\n🕐 at {time}\n⏱️ Starts in {minutes} minutes!\n\n✅ Don't forget to mark attendance!",
    first_class_alarm: "⏰ **FIRST CLASS SOON!**\n\n📚 {subject}\n🕐 at {time}\n⏱️ Starts in {minutes} minutes!\n\nGet ready and don't be late!",
    deadline_reminder: "📝 **DEADLINE REMINDER!**\n\nTask: {task}\n⏰ Due: {due_date}\n{days_left} day(s) remaining!\n\nDon't forget to complete it!",
    
    // Responses
    thanks: "You're welcome, {name}! 😊 Anything else?",
    time: "🕐 Current time: {time}, {name}.",
    joke: "😂 Here's a joke for you, {name}:\n\n{joke}",
    unknown: "🤔 How can I help? Try 'Help' to see what I can do!",
    
    // Day names
    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    days_short: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  },
  
  ru: {
    ask_name: "👋 Привет! Я твой учебный ассистент. Как тебя зовут?",
    got_name: "🎉 Приятно познакомиться, {name}! Я помогу с расписанием и задачами!",
    greeting: "👋 Привет {name}! Готов к продуктивному дню?",
    
    schedule_today: "📅 **Расписание на сегодня**\n\n{classes}💡 *Нажми '✅ Отметить' после каждой пары!*",
    schedule_tomorrow: "📅 **Расписание на завтра**\n\n{classes}",
    schedule_empty: "📭 Расписание пусто. Используй /add или отправь ICS файл.",
    no_classes: "🎉 Сегодня нет пар, {name}! Свободный день!",
    no_classes_tomorrow: "🎉 Завтра нет пар, {name}! Отдыхай!",
    next_class: "⏰ **Следующая пара**\n\n📖 {subject}\n🕐 в {time}\n⏱️ Через {minutes} минут!\n\n✅ Не забудь отметить посещаемость!",
    no_next_class: "🎉 На сегодня пар больше нет, {name}! Молодец!",
    
    attendance_prompt: "📚 **Какую пару ты посетил?**\n\n{classes}\n\n*Ответь номером или названием*",
    no_classes_attendance: "📭 Сегодня нет пар, {name}!",
    attendance_marked: "✅ Отлично! Отметил '{class_name}' как посещённое, {name}!",
    attendance_error: "❌ Не могу найти '{class_name}'. Проверь название.",
    
    tasks_header: "📋 **Твои активные задачи**\n\n{tasks}💡 *Скажи 'Готово [задача]' когда выполнишь!*",
    no_tasks: "✅ Потрясающе, {name}! Нет активных задач!",
    task_added: "✅ Добавил задачу '{task}'! Напомню за {days} дн.",
    task_completed: "🎉 Отличная работа, {name}! Выполнил '{task}'!\n\n📊 Проверь 'Статистику'!",
    no_task_found: "❌ Не могу найти задачу '{task}'. Проверь список.",
    task_format: "📝 **Формат задачи:**\n`/task \"Название\" ГГГГ-ММ-ДД ЧЧ:ММ дни [приоритет]`",
    wrong_format: "❌ Неверный формат! Используй: `/task \"Задача\" 2025-12-20 23:59 7 high`",
    
    study_logged: "📚 Отлично, {name}! Записал {minutes} минут учёбы по '{subject}'. Так держать!",
    
    import_success: "🎉 Успех! Импортировал {count} пар в расписание, {name}!",
    import_fail: "❌ Не удалось импортировать. Убедись, что это ICS файл.",
    import_instructions: "📥 **Импорт расписания**\n\n1️⃣ Отправь ICS ссылку\n2️⃣ Используй: `/ics https://calendar.ics`\n3️⃣ Прикрепи .ics файл",
    
    stats_header: "📊 **ТВОЯ СТАТИСТИКА, {name}!** 📊\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n",
    task_stats: "📝 **ВЫПОЛНЕНИЕ ЗАДАЧ**\n• ✅ Выполнено: {completed}\n• ⏳ Ожидает: {pending}\n• 🔴 Высокий приоритет: {high}\n• 🎯 Продуктивность: {score}%\n   [{bar}]",
    attendance_stats: "📚 **ПОСЕЩАЕМОСТЬ**\n• 📖 Всего пар: {total}\n• ✅ Посещено: {attended}\n• ❌ Пропущено: {missed}\n• 📈 Посещаемость: {rate}%\n   [{bar}]",
    study_stats: "⏱️ **ВРЕМЯ УЧЁБЫ**\n• 📅 Сегодня: {today} мин\n• 📆 На этой неделе: {week} мин\n• 🏆 Всего: {total} мин\n• 💪 В среднем: {avg} мин/день",
    motivation: "💡 **МОТИВАЦИЯ**\n{message}",
    attendance_tip: "📌 *Совет: Отмечай посещаемость после каждой пары!*",
    no_stats: "📊 Нет данных. Добавь пары и задачи для статистики!",
    
    class_added: "✅ Предмет '{subject}' добавлен на {day} в {start_time}-{end_time}!",
    class_deleted: "✅ Предмет '{subject}' удалён из расписания.",
    class_update_help: "📝 **Обновление пары:**\n`/update <id> <поле> <значение>`\n\nПоля: subject, day, start_time, end_time, location",
    delete_help: "📝 **Удаление пары:**\n`/delete <id>` или `/delete <предмет> <день> <время>`",
    
    settings_title: "⚙️ **Настройки**\n\n",
    settings_reminder: "🔔 Напоминание за: {offset} минут",
    settings_language: "🌐 Язык: {language}",
    settings_commands: "\n\nКоманды:\n/remind <минуты> - Установить время\n/lang ru/en/zh - Сменить язык",
    reminder_set: "⏱️ Напоминание установлено за {minutes} минут до пары!",
    reminder_current: "Текущее время напоминания: {offset} минут до пары.",
    language_changed: "🌐 Язык изменён на {language}!",
    current_language: "🌐 Текущий язык: {language}\n\nДоступно: /lang ru, /lang en, /lang zh",
    
    help_text: `🤖 **Что я умею**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 **РАСПИСАНИЕ**
• "Что сегодня?" - пары на сегодня
• "Что завтра?" - пары на завтра
• "Что дальше?" - следующую пару
• /add <предмет> <день> <начало> <конец>
• /delete <id> - удалить пару
• Отправь ICS ссылку - импорт

✅ **ПОСЕЩАЕМОСТЬ**
• "Отметить" - отметить посещение

📝 **ЗАДАЧИ**
• "Мои задачи" - список
• /task "Задача" 2025-12-20 23:59 7 high
• "Готово [задача]" - выполнить

📊 **СТАТИСТИКА**
• "Статистика" - полный отчёт

⏱️ **ВРЕМЯ УЧЁБЫ**
• "Учился 30 минут по Математике"

📥 **ИМПОРТ**
• Отправь ICS ссылку или /ics [url]

⏰ **НАПОМИНАНИЯ**
• /remind <минуты>

🌐 **ЯЗЫК**
• /lang ru - Русский
• /lang en - English
• /lang zh - 中文

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Чем могу помочь? 😊`,
    
    reminder: "⏰ **НАПОМИНАНИЕ!**\n\n📚 {subject}\n🕐 в {time}\n⏱️ Через {minutes} минут!\n\n✅ Не забудь отметить посещаемость!",
    first_class_alarm: "⏰ **СКОРО ПЕРВАЯ ПАРА!**\n\n📚 {subject}\n🕐 в {time}\n⏱️ Через {minutes} минут!\n\nГотовься!",
    deadline_reminder: "📝 **ДЕДЛАЙН!**\n\nЗадача: {task}\n⏰ Срок: {due_date}\nОсталось {days_left} дн.\n\nНе забудь выполнить!",
    
    thanks: "Пожалуйста, {name}! 😊 Что ещё?",
    time: "🕐 Сейчас {time}, {name}.",
    joke: "😂 Шутка для тебя, {name}:\n\n{joke}",
    unknown: "🤔 Чем помочь? Напиши 'Помощь' чтобы узнать!",
    
    days: ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"],
    days_short: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
  },
  
  zh: {
    ask_name: "👋 你好！我是你的学习助手。你叫什么名字？",
    got_name: "🎉 很高兴认识你，{name}！我会帮你管理课程和任务！",
    greeting: "👋 你好 {name}！准备好高效学习了吗？",
    
    schedule_today: "📅 **今日课程**\n\n{classes}💡 *课后点击'✅ 标记'记录出勤！*",
    schedule_tomorrow: "📅 **明日课程**\n\n{classes}",
    schedule_empty: "📭 课程表为空。使用 /add 或发送ICS文件导入。",
    no_classes: "🎉 今天没课，{name}！自由的一天！",
    no_classes_tomorrow: "🎉 明天没课，{name}！好好休息！",
    next_class: "⏰ **下一节课**\n\n📖 {subject}\n🕐 {time}\n⏱️ {minutes}分钟后开始！\n\n✅ 课后记得标记出勤！",
    no_next_class: "🎉 今天的课都上完了，{name}！干得好！",
    
    attendance_prompt: "📚 **你上了哪节课？**\n\n{classes}\n\n*回复课程编号或名称*",
    no_classes_attendance: "📭 今天没有课，{name}！",
    attendance_marked: "✅ 太好了！已将'{class_name}'标记为出勤，{name}！",
    attendance_error: "❌ 找不到'{class_name}'。请检查名称。",
    
    tasks_header: "📋 **待办任务**\n\n{tasks}💡 *完成任务时说'完成 [任务名]'*",
    no_tasks: "✅ 太棒了，{name}！没有待办任务！",
    task_added: "✅ 已添加任务'{task}'！提前{days}天提醒你。",
    task_completed: "🎉 干得好，{name}！完成了'{task}'！\n\n📊 查看'统计'了解进度！",
    no_task_found: "❌ 找不到名为'{task}'的任务。",
    task_format: "📝 **添加任务格式：**\n`/task \"任务名\" 年-月-日 时:分 天数 [优先级]`",
    wrong_format: "❌ 格式错误！使用：`/task \"任务名\" 2025-12-20 23:59 7 high`",
    
    study_logged: "📚 太好了，{name}！记录了学习'{subject}' {minutes}分钟。继续加油！",
    
    import_success: "🎉 成功！已导入 {count} 节课到你的课程表，{name}！",
    import_fail: "❌ 无法导入。请确保是有效的ICS文件。",
    import_instructions: "📥 **导入课程表**\n\n1️⃣ 发送ICS链接\n2️⃣ 使用：`/ics https://calendar.ics`\n3️⃣ 附加.ics文件",
    
    stats_header: "📊 **学习统计，{name}！** 📊\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n",
    task_stats: "📝 **任务完成**\n• ✅ 已完成：{completed}\n• ⏳ 待完成：{pending}\n• 🔴 高优先级完成：{high}\n• 🎯 生产力：{score}%\n   [{bar}]",
    attendance_stats: "📚 **出勤统计**\n• 📖 总课程：{total}\n• ✅ 已出勤：{attended}\n• ❌ 缺勤：{missed}\n• 📈 出勤率：{rate}%\n   [{bar}]",
    study_stats: "⏱️ **学习时间**\n• 📅 今日：{today} 分钟\n• 📆 本周：{week} 分钟\n• 🏆 总计：{total} 分钟\n• 💪 日均：{avg} 分钟",
    motivation: "💡 **激励语**\n{message}",
    attendance_tip: "📌 *提示：课后标记出勤可以提高统计数据！*",
    no_stats: "📊 暂无数据。添加课程和任务开始统计！",
    
    class_added: "✅ 课程'{subject}'已添加至{day} {start_time}-{end_time}！",
    class_deleted: "✅ 课程'{subject}'已删除。",
    class_update_help: "📝 **更新课程：**\n`/update <id> <字段> <值>`",
    delete_help: "📝 **删除课程：**\n`/delete <id>`",
    
    settings_title: "⚙️ **设置**\n\n",
    settings_reminder: "🔔 提醒时间：课前{offset}分钟",
    settings_language: "🌐 语言：{language}",
    settings_commands: "\n\n命令：\n/remind <分钟> - 设置提醒时间\n/lang ru/en/zh - 切换语言",
    reminder_set: "⏱️ 提醒时间设置为课前{minutes}分钟！",
    reminder_current: "当前提醒时间：课前{offset}分钟。",
    language_changed: "🌐 语言已切换为{language}！",
    current_language: "🌐 当前语言：{language}\n\n可用：/lang en, /lang ru, /lang zh",
    
    help_text: `🤖 **我能帮你做什么**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 **课程表**
• "今天有什么课？" - 今日课程
• "明天有什么课？" - 明日课程
• "下节课是什么？" - 下节课
• /add <课程> <星期> <开始> <结束>
• /delete <id> - 删除课程
• 发送ICS链接 - 导入课程表

✅ **出勤**
• "标记" - 记录出勤

📝 **任务**
• "我的任务" - 查看任务
• /task "任务名" 2025-12-20 23:59 7 high
• "完成 [任务名]" - 标记完成

📊 **统计**
• "统计" - 完整进度报告

⏱️ **学习时间**
• "学习了30分钟数学"

📥 **导入**
• 发送ICS链接或 /ics [网址]

⏰ **提醒**
• /remind <分钟>

🌐 **语言**
• /lang ru - Русский
• /lang en - English
• /lang zh - 中文

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
需要帮助？😊`,
    
    reminder: "⏰ **课程提醒！**\n\n📚 {subject}\n🕐 {time}\n⏱️ {minutes}分钟后开始！\n\n✅ 课后记得标记出勤！",
    first_class_alarm: "⏰ **第一节课即将开始！**\n\n📚 {subject}\n🕐 {time}\n⏱️ {minutes}分钟后开始！\n\n准备好，不要迟到！",
    deadline_reminder: "📝 **截止日期提醒！**\n\n任务：{task}\n⏰ 截止：{due_date}\n还剩 {days_left} 天！\n\n不要忘记完成！",
    
    thanks: "不客气，{name}！😊 还需要什么？",
    time: "🕐 当前时间：{time}，{name}。",
    joke: "😂 给你讲个笑话，{name}：\n\n{joke}",
    unknown: "🤔 需要什么帮助？试试'帮助'看看我能做什么！",
    
    days: ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"],
    days_short: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
  }
};

// Jokes and motivations
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

const MOTIVATIONS = {
  en: [
    "You're doing amazing! Keep pushing forward! 💪",
    "Every step counts! Progress over perfection! 🌟",
    "Your dedication is inspiring! 🎯",
    "Small daily improvements lead to big results! 📈"
  ],
  ru: [
    "У тебя отлично получается! Продолжай в том же духе! 💪",
    "Каждый шаг имеет значение! Прогресс важнее совершенства! 🌟",
    "Твоя целеустремлённость вдохновляет! 🎯",
    "Маленькие ежедневные улучшения ведут к большим результатам! 📈"
  ],
  zh: [
    "你做得太棒了！继续加油！💪",
    "每一步都很重要！进步胜于完美！🌟",
    "你的努力很鼓舞人心！🎯",
    "小小的日常改进会带来巨大的成果！📈"
  ]
};

// ==================== VK API HELPERS ====================
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
    if (controller) fetchOptions.signal = controller.signal;

    const response = await fetch(url.toString(), fetchOptions);
    const data = await response.json();

    if (data.error) {
      console.error("VK API Error:", data.error);
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
    message: text.slice(0, 4096),
    random_id: Math.floor(Math.random() * 2147483647),
  };
  if (keyboard) params.keyboard = keyboard;

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

// Fire-and-forget async version for non-blocking
function sendMessageAsync(userId, text, keyboard = null) {
  sendMessage(userId, text, keyboard).catch(console.error);
}

// ==================== KEYBOARD BUILDERS ====================
function getMainKeyboard(lang) {
  if (lang === 'ru') {
    return JSON.stringify({
      one_time: false,
      buttons: [
        [{ action: { type: "text", label: "📅 Расписание" }, color: "primary" }],
        [{ action: { type: "text", label: "📋 Сегодня" }, color: "positive" }],
        [{ action: { type: "text", label: "⏭️ Что дальше?" }, color: "secondary" }],
        [{ action: { type: "text", label: "📝 Задачи" }, color: "positive" }],
        [{ action: { type: "text", label: "📊 Статистика" }, color: "secondary" }],
        [{ action: { type: "text", label: "⚙️ Настройки" }, color: "primary" }],
        [{ action: { type: "text", label: "➕ Добавить" }, color: "positive" }],
        [{ action: { type: "text", label: "❓ Помощь" }, color: "secondary" }]
      ]
    });
  } else if (lang === 'zh') {
    return JSON.stringify({
      one_time: false,
      buttons: [
        [{ action: { type: "text", label: "📅 课程表" }, color: "primary" }],
        [{ action: { type: "text", label: "📋 今日" }, color: "positive" }],
        [{ action: { type: "text", label: "⏭️ 下节课" }, color: "secondary" }],
        [{ action: { type: "text", label: "📝 任务" }, color: "positive" }],
        [{ action: { type: "text", label: "📊 统计" }, color: "secondary" }],
        [{ action: { type: "text", label: "⚙️ 设置" }, color: "primary" }],
        [{ action: { type: "text", label: "➕ 添加" }, color: "positive" }],
        [{ action: { type: "text", label: "❓ 帮助" }, color: "secondary" }]
      ]
    });
  } else {
    return JSON.stringify({
      one_time: false,
      buttons: [
        [{ action: { type: "text", label: "📅 Schedule" }, color: "primary" }],
        [{ action: { type: "text", label: "📋 Today" }, color: "positive" }],
        [{ action: { type: "text", label: "⏭️ What's next?" }, color: "secondary" }],
        [{ action: { type: "text", label: "📝 Tasks" }, color: "positive" }],
        [{ action: { type: "text", label: "📊 Statistics" }, color: "secondary" }],
        [{ action: { type: "text", label: "⚙️ Settings" }, color: "primary" }],
        [{ action: { type: "text", label: "➕ Add" }, color: "positive" }],
        [{ action: { type: "text", label: "❓ Help" }, color: "secondary" }]
      ]
    });
  }
}

function getSettingsKeyboard(offset, lang) {
  const buttonText = lang === 'ru' ? '🔙 Назад' : lang === 'zh' ? '🔙 返回' : '🔙 Back';
  return JSON.stringify({
    one_time: false,
    buttons: [
      [
        { action: { type: "callback", label: "➖", payload: JSON.stringify({ cmd: "offset_down" }) }, color: "negative" },
        { action: { type: "text", label: `${offset} min` }, color: "primary" },
        { action: { type: "callback", label: "➕", payload: JSON.stringify({ cmd: "offset_up" }) }, color: "positive" }
      ],
      [{ action: { type: "text", label: buttonText }, color: "secondary" }]
    ]
  });
}

function getAddKeyboard(lang) {
  const classText = lang === 'ru' ? '📅 Добавить пару' : lang === 'zh' ? '📅 添加课程' : '📅 Add Class';
  const taskText = lang === 'ru' ? '📝 Добавить задачу' : lang === 'zh' ? '📝 添加任务' : '📝 Add Task';
  const backText = lang === 'ru' ? '🔙 Назад' : lang === 'zh' ? '🔙 返回' : '🔙 Back';
  
  return JSON.stringify({
    one_time: false,
    buttons: [
      [{ action: { type: "text", label: classText }, color: "positive" }],
      [{ action: { type: "text", label: taskText }, color: "positive" }],
      [{ action: { type: "text", label: backText }, color: "secondary" }]
    ]
  });
}

function getTaskKeyboard(taskId, lang) {
  const doneText = lang === 'ru' ? '✅ Выполнено' : lang === 'zh' ? '✅ 完成' : '✅ Done';
  return JSON.stringify({
    inline: true,
    buttons: [[{
      action: { type: "callback", label: doneText, payload: JSON.stringify({ cmd: "mark_done", tid: taskId }) },
      color: "positive"
    }]]
  });
}

// ==================== DATABASE OPERATIONS ====================
async function getUser(userId) {
  const cacheKey = `user_${userId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("vk_id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("getUser error:", error.message);
    return null;
  }

  const result = data || null;
  if (result) setCached(cacheKey, result);
  return result;
}

async function createUser(userId, name = null, language = null) {
  const detectedLang = language || "en";
  const { error } = await supabase.from("users").upsert({
    vk_id: userId,
    name: name || "",
    language: detectedLang,
    reminder_offset: 60,
    join_date: new Date().toISOString()
  }, { onConflict: "vk_id" });

  if (error) console.error("createUser error:", error.message);
  invalidateCache(userId, "user");
}

async function updateUserName(userId, name) {
  const { error } = await supabase
    .from("users")
    .update({ name })
    .eq("vk_id", userId);

  if (!error) {
    invalidateCache(userId, "user");
    invalidateCache(userId, "name");
  }
}

async function getUserName(userId) {
  const cacheKey = `name_${userId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from("users")
    .select("name")
    .eq("vk_id", userId)
    .single();

  let name = "friend";
  if (!error && data) name = data.name || "friend";
  setCached(cacheKey, name);
  return name;
}

async function getUserLanguage(userId) {
  const cacheKey = `lang_${userId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from("users")
    .select("language")
    .eq("vk_id", userId)
    .single();

  let lang = "en";
  if (!error && data) lang = data.language;
  setCached(cacheKey, lang);
  return lang;
}

async function setUserLanguage(userId, language) {
  const { error } = await supabase
    .from("users")
    .update({ language })
    .eq("vk_id", userId);

  if (!error) {
    invalidateCache(userId, "lang");
    invalidateCache(userId, "user");
  }
}

async function getUserReminderOffset(userId) {
  const cacheKey = `offset_${userId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from("users")
    .select("reminder_offset")
    .eq("vk_id", userId)
    .single();

  let offset = 60;
  if (!error && data) offset = data.reminder_offset || 60;
  setCached(cacheKey, offset);
  return offset;
}

async function setUserReminderOffset(userId, minutes) {
  const { error } = await supabase
    .from("users")
    .update({ reminder_offset: minutes })
    .eq("vk_id", userId);

  if (!error) invalidateCache(userId, "offset");
}

// Schedule operations
async function getSchedule(userId) {
  const cacheKey = `schedule_${userId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from("schedule")
    .select("id, subject, day, start_time, end_time, location")
    .eq("user_id", userId)
    .order("day", { ascending: true })
    .order("start_time", { ascending: true });

  const result = error ? [] : data || [];
  setCached(cacheKey, result);
  return result;
}

async function addClass(userId, subject, day, startTime, endTime, location = "") {
  const { error } = await supabase.from("schedule").insert({
    user_id: userId,
    subject,
    day,
    start_time: startTime,
    end_time: endTime,
    location
  });

  if (!error) {
    invalidateCache(userId, "schedule");
    return true;
  }
  console.error("addClass error:", error.message);
  return false;
}

async function deleteClass(classId, userId) {
  const { error } = await supabase
    .from("schedule")
    .delete()
    .eq("id", classId)
    .eq("user_id", userId);

  if (!error) {
    invalidateCache(userId, "schedule");
    return true;
  }
  return false;
}

async function updateClass(classId, userId, field, value) {
  const allowedFields = ["subject", "day", "start_time", "end_time", "location"];
  if (!allowedFields.includes(field)) return false;

  const { error } = await supabase
    .from("schedule")
    .update({ [field]: value })
    .eq("id", classId)
    .eq("user_id", userId);

  if (!error) {
    invalidateCache(userId, "schedule");
    return true;
  }
  return false;
}

// Task operations
async function getTasks(userId, onlyPending = true) {
  const cacheKey = `tasks_${userId}_${onlyPending}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  let query = supabase
    .from("tasks")
    .select("id, task, due_date, remind_days, priority, done")
    .eq("user_id", userId);

  if (onlyPending) query = query.eq("done", false);
  const { data, error } = await query.order("due_date", { ascending: true });

  const result = error ? [] : data || [];
  setCached(cacheKey, result);
  return result;
}

async function addTask(userId, task, dueDate, remindDays, priority = "normal") {
  const { error } = await supabase.from("tasks").insert({
    user_id: userId,
    task,
    due_date: dueDate,
    remind_days: remindDays,
    priority,
    done: false
  });

  if (!error) {
    invalidateCache(userId, "tasks");
    invalidateCache(userId, "task_stats");
    return true;
  }
  return false;
}

async function completeTask(taskId, userId) {
  const { error } = await supabase
    .from("tasks")
    .update({ done: true, completed_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("user_id", userId);

  if (!error) {
    invalidateCache(userId, "tasks");
    invalidateCache(userId, "task_stats");
    return true;
  }
  return false;
}

// Attendance operations
async function markAttendance(userId, className) {
  const today = new Date().toISOString().split("T")[0];
  const { error } = await supabase
    .from("attendance")
    .upsert({
      user_id: userId,
      class_name: className,
      date: today,
      attended: true
    }, { onConflict: "user_id,class_name,date" });

  if (!error) {
    invalidateCache(userId, "att_stats");
    return true;
  }
  return false;
}

async function getAttendanceStats(userId) {
  const cacheKey = `att_stats_${userId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from("attendance")
    .select("attended")
    .eq("user_id", userId);

  if (error || !data || data.length === 0) {
    const empty = { attended: 0, missed: 0, total: 0, rate: 0 };
    setCached(cacheKey, empty);
    return empty;
  }

  const attended = data.filter(a => a.attended).length;
  const total = data.length;
  const missed = total - attended;
  const rate = total > 0 ? Math.round((attended / total) * 100) : 0;

  const result = { attended, missed, total, rate };
  setCached(cacheKey, result);
  return result;
}

// Study time operations
async function addStudySession(userId, subject, duration) {
  const today = new Date().toISOString().split("T")[0];
  const { error } = await supabase.from("study_sessions").insert({
    user_id: userId,
    subject,
    duration,
    date: today
  });

  if (error) {
    console.error("addStudySession error:", error.message);
    return false;
  }
  invalidateCache(userId, "study_stats");
  return true;
}

async function getStudyStats(userId) {
  const cacheKey = `study_stats_${userId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [{ data: totalData }, { data: weeklyData }, { data: todayData }] = await Promise.all([
    supabase.rpc('sum_study_duration', { p_user_id: userId, p_days: 0 }),
    supabase.rpc('sum_study_duration', { p_user_id: userId, p_days: 7 }),
    supabase.from("study_sessions").select("duration").eq("user_id", userId).eq("date", today)
  ]);

  const total = totalData || 0;
  const weekly = weeklyData || 0;
  const todayTotal = todayData?.reduce((sum, s) => sum + (s.duration || 0), 0) || 0;

  const result = { total, weekly, today: todayTotal };
  setCached(cacheKey, result);
  return result;
}

async function getTaskStats(userId) {
  const cacheKey = `task_stats_${userId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from("tasks")
    .select("done, priority")
    .eq("user_id", userId);

  if (error || !data || data.length === 0) {
    const empty = { completed: 0, pending: 0, high: 0, total: 0, score: 0 };
    setCached(cacheKey, empty);
    return empty;
  }

  const completed = data.filter(t => t.done).length;
  const total = data.length;
  const pending = total - completed;
  const high = data.filter(t => t.done && t.priority === "high").length;
  const score = total > 0 ? Math.round((completed / total) * 100) : 0;

  const result = { completed, pending, high, total, score };
  setCached(cacheKey, result);
  return result;
}

// Getting upcoming classes
async function getTodayClasses(userId) {
  const now = new Date();
  let currentDay = now.getDay() - 1;
  if (currentDay < 0) currentDay = 6;

  const cacheKey = `today_${userId}_${now.toDateString()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from("schedule")
    .select("*")
    .eq("user_id", userId)
    .eq("day", currentDay)
    .order("start_time", { ascending: true });

  const result = error ? [] : data || [];
  setCached(cacheKey, result);
  return result;
}

async function getTomorrowClasses(userId) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  let tomorrowDay = tomorrow.getDay() - 1;
  if (tomorrowDay < 0) tomorrowDay = 6;

  const { data, error } = await supabase
    .from("schedule")
    .select("*")
    .eq("user_id", userId)
    .eq("day", tomorrowDay)
    .order("start_time", { ascending: true });

  return error ? [] : data || [];
}

async function getNextClass(userId) {
  const now = new Date();
  let currentDay = now.getDay() - 1;
  if (currentDay < 0) currentDay = 6;
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const { data: todayClasses, error: todayError } = await supabase
    .from("schedule")
    .select("*")
    .eq("user_id", userId)
    .eq("day", currentDay)
    .order("start_time", { ascending: true });

  if (!todayError && todayClasses) {
    const upcoming = todayClasses.filter(c => c.start_time > currentTime);
    if (upcoming.length > 0) return { class: upcoming[0], when: "today" };
  }

  let nextDay = currentDay + 1;
  if (nextDay > 6) nextDay = 0;

  const { data: nextClasses, error: nextError } = await supabase
    .from("schedule")
    .select("*")
    .eq("user_id", userId)
    .eq("day", nextDay)
    .order("start_time", { ascending: true });

  if (!nextError && nextClasses && nextClasses.length > 0) {
    return { class: nextClasses[0], when: "tomorrow" };
  }

  return null;
}

// ==================== ICS IMPORT ====================
async function importICSFromUrl(userId, url, lang) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const icsText = await response.text();
    const parsed = ical.parseICS(icsText);
    let count = 0;

    for (const key in parsed) {
      const event = parsed[key];
      if (event.type === "VEVENT" && event.start) {
        const startDate = new Date(event.start);
        const endDate = event.end ? new Date(event.end) : new Date(startDate.getTime() + 3600000);
        let day = startDate.getDay() - 1;
        if (day < 0) day = 6;
        const startTime = startDate.toTimeString().slice(0, 5);
        const endTime = endDate.toTimeString().slice(0, 5);
        const subject = event.summary || "Class";
        const location = event.location || "";

        const success = await addClass(userId, subject, day, startTime, endTime, location);
        if (success) count++;
      }
    }
    return { success: true, count };
  } catch (error) {
    console.error("importICS error:", error.message);
    return { success: false, count: 0, error: error.message };
  }
}

// ==================== HELPER FUNCTIONS ====================
function detectLanguage(text) {
  if (!text) return "en";
  if (/[\u4e00-\u9fff]/.test(text)) return "zh";
  if (/[а-яА-Я]/.test(text)) return "ru";
  return "en";
}

function createProgressBar(percentage, length = 10) {
  const filled = Math.floor(percentage / 100 * length);
  return "█".repeat(filled) + "░".repeat(length - filled);
}

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getTranslation(userId, key, params = {}) {
  const lang = getUserLanguage(userId) || "en";
  let text = TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key] || key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(new RegExp(`{${k}}`, "g"), v);
  }
  return text;
}

function getTranslationSync(lang, key, params = {}) {
  let text = TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key] || key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(new RegExp(`{${k}}`, "g"), v);
  }
  return text;
}

// ==================== MESSAGE HANDLER ====================
async function handleMessage(userId, text, lang) {
  const name = await getUserName(userId);
  const lowText = text.toLowerCase().trim();

  // ====== GREETINGS ======
  if (lowText === "привет" || lowText === "hello" || lowText === "hi" || lowText === "你好") {
    await sendMessage(userId, getTranslation(userId, "greeting", { name }), getMainKeyboard(lang));
    return;
  }

  // ====== SCHEDULE ======
  if (text === "📅 Schedule" || text === "📅 Расписание" || text === "📅 课程表" ||
      lowText.includes("schedule") || lowText.includes("расписание")) {
    const schedule = await getSchedule(userId);
    if (schedule.length === 0) {
      await sendMessage(userId, getTranslation(userId, "schedule_empty"), getMainKeyboard(lang));
    } else {
      let msg = getTranslation(userId, "schedule_header");
      for (const cls of schedule) {
        msg += getTranslation(userId, "schedule_item", {
          day: TRANSLATIONS[lang].days_short[cls.day],
          start: cls.start_time,
          end: cls.end_time,
          subject: cls.subject
        });
      }
      await sendMessage(userId, msg, getMainKeyboard(lang));
    }
    return;
  }

  // ====== TODAY'S CLASSES ======
  if (text === "📋 Today" || text === "📋 Сегодня" || text === "📋 今日" ||
      lowText.includes("today") || lowText.includes("сегодня")) {
    const classes = await getTodayClasses(userId);
    if (classes.length === 0) {
      await sendMessage(userId, getTranslation(userId, "no_classes", { name }), getMainKeyboard(lang));
    } else {
      let msg = getTranslation(userId, "schedule_today", { name, classes: "" });
      for (const cls of classes) {
        msg += `⏰ ${cls.start_time}-${cls.end_time} • **${cls.subject}**\n`;
        if (cls.location) msg += `   📍 ${cls.location}\n`;
        msg += "\n";
      }
      await sendMessage(userId, msg, getMainKeyboard(lang));
    }
    return;
  }

  // ====== TOMORROW'S CLASSES ======
  if (lowText.includes("tomorrow") || lowText.includes("завтра") || lowText.includes("明天")) {
    const classes = await getTomorrowClasses(userId);
    if (classes.length === 0) {
      await sendMessage(userId, getTranslation(userId, "no_classes_tomorrow", { name }), getMainKeyboard(lang));
    } else {
      let msg = getTranslation(userId, "schedule_tomorrow", { name, classes: "" });
      for (const cls of classes) {
        msg += `⏰ ${cls.start_time}-${cls.end_time} • **${cls.subject}**\n`;
        msg += "\n";
      }
      await sendMessage(userId, msg, getMainKeyboard(lang));
    }
    return;
  }

  // ====== NEXT CLASS ======
  if (text === "⏭️ What's next?" || text === "⏭️ Что дальше?" || text === "⏭️ 下节课" ||
      lowText.includes("next") || lowText.includes("дальше")) {
    const next = await getNextClass(userId);
    if (next) {
      const now = new Date();
      const [hour, minute] = next.class.start_time.split(":").map(Number);
      const classTime = new Date(now);
      classTime.setHours(hour, minute, 0, 0);
      const minutes = Math.max(0, Math.round((classTime - now) / 60000));
      const whenText = next.when === "today" 
        ? (lang === "ru" ? "сегодня" : lang === "zh" ? "今天" : "today")
        : (lang === "ru" ? "завтра" : lang === "zh" ? "明天" : "tomorrow");
      
      await sendMessage(userId, getTranslation(userId, "next_class", {
        subject: next.class.subject,
        when: whenText,
        time: next.class.start_time,
        minutes
      }), getMainKeyboard(lang));
    } else {
      await sendMessage(userId, getTranslation(userId, "no_next_class", { name }), getMainKeyboard(lang));
    }
    return;
  }

  // ====== TASKS ======
  if (text === "📝 Tasks" || text === "📝 Задачи" || text === "📝 任务" ||
      lowText.includes("tasks") || lowText.includes("задачи")) {
    const tasks = await getTasks(userId, true);
    if (tasks.length === 0) {
      await sendMessage(userId, getTranslation(userId, "no_tasks", { name }), getMainKeyboard(lang));
    } else {
      let taskList = "";
      for (const task of tasks) {
        const priorityIcon = task.priority === "high" ? "🔴" : task.priority === "medium" ? "🟡" : "🟢";
        taskList += `${priorityIcon} **${task.task}**\n   📅 ${task.due_date} | ⏰ ${task.remind_days}d\n\n`;
      }
      await sendMessage(userId, getTranslation(userId, "tasks_header", { name, tasks: taskList }), getMainKeyboard(lang));
    }
    return;
  }

  // ====== COMPLETE TASK ======
  const doneMatch = text.match(/(?:done|готово|выполнил|完成)\s+(.+)/i);
  if (doneMatch) {
    const taskName = doneMatch[1].trim().toLowerCase();
    const tasks = await getTasks(userId, true);
    let found = false;
    for (const task of tasks) {
      if (task.task.toLowerCase().includes(taskName) || taskName.includes(task.task.toLowerCase())) {
        await completeTask(task.id, userId);
        await sendMessage(userId, getTranslation(userId, "task_completed", { name, task: task.task }), getMainKeyboard(lang));
        found = true;
        break;
      }
    }
    if (!found) {
      await sendMessage(userId, getTranslation(userId, "no_task_found", { name, task: taskName }), getMainKeyboard(lang));
    }
    return;
  }

  // ====== STATISTICS ======
  if (text === "📊 Statistics" || text === "📊 Статистика" || text === "📊 统计" ||
      lowText.includes("statistics") || lowText.includes("stats") || lowText.includes("статистика")) {
    const [attendance, taskStats, studyStats, scheduleCount] = await Promise.all([
      getAttendanceStats(userId),
      getTaskStats(userId),
      getStudyStats(userId),
      (await getSchedule(userId)).length
    ]);

    const prodBar = createProgressBar(taskStats.score);
    const attendBar = createProgressBar(attendance.rate);
    const avgDaily = Math.round(studyStats.weekly / 7);
    const motivation = getRandomItem(MOTIVATIONS[lang]);

    let msg = getTranslation(userId, "stats_header", { name }) + "\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
    msg += getTranslation(userId, "task_stats", {
      completed: taskStats.completed,
      pending: taskStats.pending,
      high: taskStats.high,
      score: taskStats.score,
      bar: prodBar
    }) + "\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
    msg += getTranslation(userId, "attendance_stats", {
      total: attendance.total,
      attended: attendance.attended,
      missed: attendance.missed,
      rate: attendance.rate,
      bar: attendBar
    }) + "\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
    msg += getTranslation(userId, "study_stats", {
      today: studyStats.today,
      week: studyStats.weekly,
      total: studyStats.total,
      avg: avgDaily
    }) + "\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
    msg += getTranslation(userId, "motivation", { message: motivation }) + "\n\n";
    msg += getTranslation(userId, "attendance_tip");

    await sendMessage(userId, msg, getMainKeyboard(lang));
    return;
  }

  // ====== ATTENDANCE ======
  if (text === "✅ Mark" || text === "✅ Отметить" || text === "✅ 标记" ||
      lowText.includes("mark") || lowText.includes("отметить")) {
    const classes = await getTodayClasses(userId);
    if (classes.length === 0) {
      await sendMessage(userId, getTranslation(userId, "no_classes_attendance", { name }), getMainKeyboard(lang));
    } else {
      let classList = "";
      for (let i = 0; i < classes.length; i++) {
        classList += `${i + 1}. ${classes[i].subject} (${classes[i].start_time}-${classes[i].end_time})\n`;
      }
      await sendMessage(userId, getTranslation(userId, "attendance_prompt", { classes: classList }), getMainKeyboard(lang));
    }
    return;
  }

  // Handle attendance by number
  if (/^\d+$/.test(text) && parseInt(text) <= 10) {
    const classes = await getTodayClasses(userId);
    const idx = parseInt(text) - 1;
    if (idx >= 0 && idx < classes.length) {
      await markAttendance(userId, classes[idx].subject);
      await sendMessage(userId, getTranslation(userId, "attendance_marked", { name, class_name: classes[idx].subject }), getMainKeyboard(lang));
      return;
    }
  }

  // ====== SETTINGS ======
  if (text === "⚙️ Settings" || text === "⚙️ Настройки" || text === "⚙️ 设置") {
    const offset = await getUserReminderOffset(userId);
    const langDisplay = lang === "ru" ? "Русский" : lang === "zh" ? "中文" : "English";
    let msg = getTranslation(userId, "settings_title");
    msg += getTranslation(userId, "settings_reminder", { offset }) + "\n";
    msg += getTranslation(userId, "settings_language", { language: langDisplay });
    msg += getTranslation(userId, "settings_commands");
    await sendMessage(userId, msg, getSettingsKeyboard(offset, lang));
    return;
  }

  // ====== ADD MENU ======
  if (text === "➕ Add" || text === "➕ Добавить" || text === "➕ 添加") {
    await sendMessage(userId, lang === "ru" ? "Что добавить?" : lang === "zh" ? "添加什么？" : "What would you like to add?", getAddKeyboard(lang));
    return;
  }

  // ====== ADD CLASS ======
  if (text === "📅 Add Class" || text === "📅 Добавить пару" || text === "📅 添加课程") {
    await sendMessage(userId, getTranslation(userId, "add_class_help"), getMainKeyboard(lang));
    return;
  }

  // ====== ADD TASK ======
  if (text === "📝 Add Task" || text === "📝 Добавить задачу" || text === "📝 添加任务") {
    await sendMessage(userId, getTranslation(userId, "task_format"), getMainKeyboard(lang));
    return;
  }

  // ====== BACK BUTTON ======
  if (text === "🔙 Back" || text === "🔙 Назад" || text === "🔙 返回") {
    await sendMessage(userId, lang === "ru" ? "Возвращаемся в меню..." : lang === "zh" ? "返回主菜单..." : "Returning to main menu...", getMainKeyboard(lang));
    return;
  }

  // ====== /add COMMAND ======
  if (lowText.startsWith("/add")) {
    const parts = text.split(" ");
    if (parts.length >= 5) {
      const subject = parts[1];
      const day = parseInt(parts[2]);
      const startTime = parts[3];
      const endTime = parts[4];
      const location = parts[5] || "";
      if (!isNaN(day) && day >= 0 && day <= 6) {
        const success = await addClass(userId, subject, day, startTime, endTime, location);
        if (success) {
          await sendMessage(userId, getTranslation(userId, "class_added", { subject, day: TRANSLATIONS[lang].days_short[day], start_time: startTime, end_time: endTime }), getMainKeyboard(lang));
        } else {
          await sendMessage(userId, "❌ Error adding class", getMainKeyboard(lang));
        }
      } else {
        await sendMessage(userId, "❌ Day must be 0 (Mon) to 6 (Sun)", getMainKeyboard(lang));
      }
    } else {
      await sendMessage(userId, getTranslation(userId, "add_class_help"), getMainKeyboard(lang));
    }
    return;
  }

  // ====== /delete COMMAND ======
  if (lowText.startsWith("/delete")) {
    const parts = text.split(" ");
    if (parts.length >= 2) {
      const classId = parseInt(parts[1]);
      if (!isNaN(classId)) {
        const schedule = await getSchedule(userId);
        const classToDelete = schedule.find(c => c.id === classId);
        if (classToDelete) {
          const success = await deleteClass(classId, userId);
          if (success) {
            await sendMessage(userId, getTranslation(userId, "class_deleted", { subject: classToDelete.subject }), getMainKeyboard(lang));
          } else {
            await sendMessage(userId, "❌ Error deleting class", getMainKeyboard(lang));
          }
        } else {
          await sendMessage(userId, "❌ Class not found", getMainKeyboard(lang));
        }
      } else {
        await sendMessage(userId, getTranslation(userId, "delete_help"), getMainKeyboard(lang));
      }
    } else {
      await sendMessage(userId, getTranslation(userId, "delete_help"), getMainKeyboard(lang));
    }
    return;
  }

  // ====== /task COMMAND ======
  if (lowText.startsWith("/task")) {
    const match = text.match(/\/task\s+"([^"]+)"\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+(\d+)\s*(high|medium|normal)?/i);
    if (match) {
      const taskName = match[1];
      const dueDate = `${match[2]} ${match[3]}`;
      const days = parseInt(match[4]);
      const priority = match[5] || "normal";
      const success = await addTask(userId, taskName, dueDate, days, priority);
      if (success) {
        await sendMessage(userId, getTranslation(userId, "task_added", { name, task: taskName, days }), getMainKeyboard(lang));
      } else {
        await sendMessage(userId, "❌ Error adding task", getMainKeyboard(lang));
      }
    } else {
      await sendMessage(userId, getTranslation(userId, "task_format"), getMainKeyboard(lang));
    }
    return;
  }

  // ====== /remind COMMAND ======
  if (lowText.startsWith("/remind")) {
    const parts = text.split(" ");
    if (parts.length >= 2) {
      const minutes = parseInt(parts[1]);
      if (!isNaN(minutes) && minutes >= 5 && minutes <= 120) {
        await setUserReminderOffset(userId, minutes);
        await sendMessage(userId, getTranslation(userId, "reminder_set", { minutes }), getMainKeyboard(lang));
      } else {
        await sendMessage(userId, "❌ Please enter a number between 5 and 120", getMainKeyboard(lang));
      }
    } else {
      const offset = await getUserReminderOffset(userId);
      await sendMessage(userId, getTranslation(userId, "reminder_current", { offset }), getMainKeyboard(lang));
    }
    return;
  }

  // ====== /lang COMMAND ======
  if (lowText.startsWith("/lang")) {
    const parts = text.split(" ");
    if (parts.length >= 2) {
      const newLang = parts[1];
      if (newLang === "ru" || newLang === "en" || newLang === "zh") {
        await setUserLanguage(userId, newLang);
        const langName = newLang === "ru" ? "Русский" : newLang === "zh" ? "中文" : "English";
        await sendMessage(userId, getTranslation(userId, "language_changed", { language: langName }), getMainKeyboard(newLang));
      } else {
        await sendMessage(userId, getTranslation(userId, "current_language", { language: lang }), getMainKeyboard(lang));
      }
    } else {
      await sendMessage(userId, getTranslation(userId, "current_language", { language: lang }), getMainKeyboard(lang));
    }
    return;
  }

  // ====== /ics or ICS URL IMPORT ======
  if (lowText.startsWith("/ics") || (text.includes(".ics") && (text.includes("http://") || text.includes("https://")))) {
    let url = "";
    if (lowText.startsWith("/ics")) {
      const parts = text.split(" ");
      if (parts.length >= 2) url = parts[1];
    } else {
      const urlMatch = text.match(/(https?:\/\/[^\s]+\.ics)/i);
      if (urlMatch) url = urlMatch[0];
    }
    
    if (url) {
      const loadingMsg = lang === "ru" ? "Импортирую расписание..." : lang === "zh" ? "正在导入课程表..." : "Importing your schedule...";
      await sendMessage(userId, `⏳ ${loadingMsg}`, getMainKeyboard(lang));
      const result = await importICSFromUrl(userId, url, lang);
      if (result.success && result.count > 0) {
        await sendMessage(userId, getTranslation(userId, "import_success", { count: result.count, name }), getMainKeyboard(lang));
      } else {
        await sendMessage(userId, getTranslation(userId, "import_fail", { name }), getMainKeyboard(lang));
      }
    } else {
      await sendMessage(userId, getTranslation(userId, "import_instructions", { name }), getMainKeyboard(lang));
    }
    return;
  }

  // ====== STUDY LOGGING ======
  const studyMatch = text.match(/(?:studied|учился|занимался|学习了)\s+(\d+)\s*(?:minutes?|min|минут|分钟)\s*(?:for|по|学习)?\s*(.+)/i);
  if (studyMatch) {
    const duration = parseInt(studyMatch[1]);
    const subject = studyMatch[2].trim();
    await addStudySession(userId, subject, duration);
    await sendMessage(userId, getTranslation(userId, "study_logged", { name, minutes: duration, subject }), getMainKeyboard(lang));
    return;
  }

  // ====== HELP ======
  if (text === "❓ Help" || text === "❓ Помощь" || text === "❓ 帮助" ||
      lowText.includes("help") || lowText.includes("помощь")) {
    await sendMessage(userId, getTranslation(userId, "help_text"), getMainKeyboard(lang));
    return;
  }

  // ====== THANKS ======
  if (lowText.includes("thanks") || lowText.includes("спасибо") || lowText.includes("谢谢")) {
    await sendMessage(userId, getTranslation(userId, "thanks", { name }), getMainKeyboard(lang));
    return;
  }

  // ====== TIME ======
  if (lowText.includes("time") || lowText.includes("время") || lowText.includes("时间")) {
    const now = new Date();
    await sendMessage(userId, getTranslation(userId, "time", { name, time: now.toLocaleTimeString() }), getMainKeyboard(lang));
    return;
  }

  // ====== JOKE ======
  if (lowText.includes("joke") || lowText.includes("шутка") || lowText.includes("笑话")) {
    const joke = getRandomItem(JOKES[lang]);
    await sendMessage(userId, getTranslation(userId, "joke", { name, joke }), getMainKeyboard(lang));
    return;
  }

  // ====== DEFAULT ======
  await sendMessage(userId, getTranslation(userId, "unknown", { name }), getMainKeyboard(lang));
}

// ====== PAYLOAD HANDLER ======
async function handlePayload(userId, payload, lang) {
  if (payload.cmd === "mark_done") {
    const taskId = payload.tid;
    const success = await completeTask(taskId, userId);
    if (success) {
      await sendMessage(userId, getTranslation(userId, "task_completed", { name: await getUserName(userId), task: "task" }), getMainKeyboard(lang));
    }
  } else if (payload.cmd === "offset_up") {
    const current = await getUserReminderOffset(userId);
    const newOffset = Math.min(current + 5, 120);
    await setUserReminderOffset(userId, newOffset);
    await sendMessage(userId, getTranslation(userId, "reminder_set", { minutes: newOffset }), getSettingsKeyboard(newOffset, lang));
  } else if (payload.cmd === "offset_down") {
    const current = await getUserReminderOffset(userId);
    const newOffset = Math.max(current - 5, 5);
    await setUserReminderOffset(userId, newOffset);
    await sendMessage(userId, getTranslation(userId, "reminder_set", { minutes: newOffset }), getSettingsKeyboard(newOffset, lang));
  }
}

// ====== WEBHOOK HANDLER ======
export async function handler(event) {
  try {
    const body = JSON.parse(event.body);

    // VK Confirmation Request
    if (body.type === "confirmation") {
      console.log("Confirmation request received");
      return {
        statusCode: 200,
        body: process.env.VK_CONFIRMATION_TOKEN || "default_confirmation"
      };
    }

    // Message Event
    if (body.type === "message_new") {
      const message = body.object.message;
      const userId = message.from_id;
      const text = message.text || "";
      const payload = message.payload ? JSON.parse(message.payload) : null;

      console.log(`[${userId}] Message: "${text.substring(0, 50)}"`);

      // Detect language
      const detectedLang = detectLanguage(text);
      
      // Get or create user
      let user = await getUser(userId);
      if (!user) {
        await createUser(userId, null, detectedLang);
        user = await getUser(userId);
        await sendMessage(userId, getTranslationSync(detectedLang, "ask_name"));
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }

      const name = user.name;
      const lang = user.language;

      // First time user - ask for name
      if (!name && !text.match(/(?:my name is|call me|меня зовут|我叫)/i)) {
        await sendMessage(userId, getTranslation(userId, "ask_name"));
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }

      // Extract name
      const nameMatch = text.match(/(?:my name is|call me|меня зовут|我叫)\s+([A-Za-zА-Яа-я\u4e00-\u9fff]+)/i);
      if (nameMatch && !name) {
        const newName = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1);
        await updateUserName(userId, newName);
        await sendMessage(userId, getTranslation(userId, "got_name", { name: newName }));
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }

      // Handle payload or message
      if (payload) {
        await handlePayload(userId, payload, lang);
      } else {
        await handleMessage(userId, text, lang);
      }

      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (error) {
    console.error("Handler error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
}

// ====== REMINDER CHECKER (For cron job) ======
export async function checkReminders() {
  try {
    const now = new Date();
    let currentDay = now.getDay() - 1;
    if (currentDay < 0) currentDay = 6;
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    // Get all users with schedules
    const { data: users, error } = await supabase
      .from("users")
      .select("vk_id, reminder_offset, language, name");

    if (error || !users) return;

    for (const user of users) {
      const userId = user.vk_id;
      const offset = user.reminder_offset || 60;
      const lang = user.language || "en";
      const name = user.name || "friend";

      const { data: classes, error: classError } = await supabase
        .from("schedule")
        .select("id, subject, start_time, end_time")
        .eq("user_id", userId)
        .eq("day", currentDay);

      if (classError || !classes) continue;

      for (const cls of classes) {
        const classMinutes = parseInt(cls.start_time.split(":")[0]) * 60 + parseInt(cls.start_time.split(":")[1]);
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const minutesUntil = classMinutes - currentMinutes;

        if (minutesUntil > 0 && minutesUntil <= offset) {
          const reminderKey = `reminder_${userId}_${new Date().toDateString()}_${cls.id}`;
          const { data: existing } = await supabase
            .from("reminders")
            .select("key")
            .eq("key", reminderKey)
            .single();

          if (!existing) {
            const reminderMsg = getTranslationSync(lang, "reminder", {
              subject: cls.subject,
              time: cls.start_time,
              minutes: minutesUntil
            });
            await sendMessageAsync(userId, reminderMsg, getMainKeyboard(lang));
            await supabase.from("reminders").insert({ key: reminderKey, sent: 1 });
          }
        }
      }
    }
  } catch (error) {
    console.error("Reminder check error:", error);
  }
}*/




// VK Smart Assistant Bot - Ultimate Supabase Edition
// Full-featured bot with multilingual support (EN/RU/ZH), schedule management, tasks, attendance, study logging, ICS import
// Uses Supabase for database, optimized for VK Callback API
// Deploy as Vercel/Cloud Function or run as standalone server

import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";
import ical from "ical";
import { franc } from "franc";

// ==================== CONFIGURATION ====================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const VK_TOKEN = process.env.VK_TOKEN;
const VK_API_VERSION = "5.199";
const TIMEZONE = process.env.TIMEZONE || "Asia/Novosibirsk";

// ==================== CACHING ====================
const cache = new Map();
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

function invalidateCache(userId, type) {
  cache.delete(`${type}_${userId}`);
}

// ==================== MULTILINGUAL TRANSLATIONS ====================
const TRANSLATIONS = {
  en: {
    ask_name: "👋 Hey there! I'm your personal academic assistant. What's your name?",
    got_name: "🎉 Nice to meet you, {name}! I'll help you manage your schedule, tasks, and track your progress!",
    greeting: "👋 Hey {name}! Ready to stay organized today? Check your schedule or tasks!",
    
    schedule_today: "📅 **Today's Schedule**\n\n{classes}💡 *Click '✅ Mark' after each class to track attendance!*",
    schedule_tomorrow: "📅 **Tomorrow's Schedule**\n\n{classes}",
    schedule_empty: "📭 Your schedule is empty. Use /add or send an ICS file to import.",
    no_classes: "🎉 No classes today, {name}! Enjoy your free day!",
    no_classes_tomorrow: "🎉 No classes tomorrow, {name}! Time to relax!",
    next_class: "⏰ **Next Class**\n\n📖 {subject}\n🕐 {time}\n⏱️ In {minutes} minutes!\n\n✅ Don't forget to mark attendance!",
    no_next_class: "🎉 You're done with all classes today, {name}! Great job!",
    
    attendance_prompt: "📚 **Which class did you attend?**\n\n{classes}\n\n*Reply with the number or name of the class*",
    no_classes_attendance: "📭 No classes scheduled today, {name}!",
    attendance_marked: "✅ Great! Marked '{class_name}' as attended, {name}! Attendance rate increased!",
    attendance_error: "❌ Couldn't find '{class_name}'. Please check the name.",
    
    tasks_header: "📋 **Your Active Tasks**\n\n{tasks}💡 *Say 'Done [task name]' or click ✅ when complete!*",
    no_tasks: "✅ Amazing, {name}! No pending tasks. You're all caught up!",
    task_added: "✅ Added task '{task}'! I'll remind you {days} day(s) before the deadline.",
    task_completed: "🎉 Awesome work, {name}! Completed '{task}'!\n\n📊 Check 'Statistics' to see your progress!",
    no_task_found: "❌ Couldn't find a task named '{task}'. Check your tasks with 'My tasks'.",
    task_format: "📝 **Add Task Format:**\n`/task \"Task name\" YYYY-MM-DD HH:MM days [priority]`\n\nPriority: high, medium, normal",
    wrong_format: "❌ Wrong format! Use: `/task \"Task name\" 2025-12-20 23:59 7 high`",
    
    study_logged: "📚 Great job, {name}! Logged {minutes} minutes studying '{subject}'. Keep it up!",
    
    import_success: "🎉 Success! Imported {count} classes into your schedule, {name}!\n\n✅ I'll remind you before each class.",
    import_fail: "❌ Couldn't import from that link. Make sure it's a valid ICS file.",
    import_instructions: "📥 **Import Your Schedule**\n\n1️⃣ Send an ICS link\n2️⃣ Use: `/ics https://your-calendar.ics`\n3️⃣ Attach an .ics file\n\nI'll auto-add all your classes with reminders!",
    import_empty: "⚠️ No valid events found in the ICS file. Please check the file format.",
    import_processing: "⏳ Processing ICS file... This may take a moment.",
    
    stats_header: "📊 **YOUR STUDY STATISTICS, {name}!** 📊\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n",
    task_stats: "📝 **TASK MASTERY**\n• ✅ Completed: {completed}\n• ⏳ Pending: {pending}\n• 🔴 High Priority Done: {high}\n• 🎯 Productivity: {score}%\n   [{bar}]",
    attendance_stats: "📚 **CLASS ATTENDANCE**\n• 📖 Total Classes: {total}\n• ✅ Attended: {attended}\n• ❌ Missed: {missed}\n• 📈 Attendance Rate: {rate}%\n   [{bar}]",
    study_stats: "⏱️ **STUDY TIME**\n• 📅 Today: {today} min\n• 📆 This Week: {week} min\n• 🏆 Total: {total} min\n• 💪 Daily Avg: {avg} min",
    motivation: "💡 **MOTIVATION**\n{message}",
    attendance_tip: "📌 *Tip: Mark attendance after each class to boost your stats!*",
    no_stats: "📊 No data yet. Start by adding classes and tasks to see your statistics!",
    
    class_added: "✅ Class '{subject}' added to {day} at {start_time}-{end_time}!",
    class_deleted: "✅ Class '{subject}' removed from your schedule.",
    class_update_help: "📝 **Update Class:**\n`/update <class_id> <field> <value>`\n\nFields: subject, day, start_time, end_time, location",
    delete_help: "📝 **Delete Class:**\n`/delete <class_id>` or `/delete <subject> <day> <start_time>`",
    
    settings_title: "⚙️ **Settings**\n\n",
    settings_reminder: "🔔 Reminder offset: {offset} minutes",
    settings_language: "🌐 Language: {language}",
    settings_commands: "\n\nCommands:\n/remind <minutes> - Set reminder time\n/lang ru/en/zh - Change language",
    reminder_set: "⏱️ Reminder time set to {minutes} minutes before class!",
    reminder_current: "Current reminder offset: {offset} minutes before each class.",
    language_changed: "🌐 Language changed to {language}!",
    current_language: "🌐 Current language: {language}\n\nAvailable: /lang en, /lang ru, /lang zh",
    
    help_text: `🤖 **What I Can Do For You**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 **SCHEDULE**
• "What's today?" - Today's classes
• "What's tomorrow?" - Tomorrow's classes  
• "What's next?" - Next class
• /add <subject> <day> <start> <end> - Add class
• /delete <class_id> - Remove class
• /update <id> <field> <value> - Edit class
• Send ICS link or attach .ics file - Import timetable

✅ **ATTENDANCE**
• "Mark" or "✅ Mark" - Track attended classes

📝 **TASKS**
• "My tasks" - See all tasks
• /task "Task" 2025-12-20 23:59 7 high - Add task
• "Done [task]" - Mark complete

📊 **STATISTICS**
• "Statistics" - Complete progress report

⏱️ **STUDY TIME**
• "Studied 30 minutes for Math" - Log study time

📥 **IMPORT**
• Send ICS link or /ics [url]
• Attach .ics file directly to chat

⏰ **REMINDERS**
• Automatic before each class
• /remind <minutes> - Customize timing

🌐 **LANGUAGE**
• /lang ru - Русский
• /lang en - English  
• /lang zh - 中文

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
What would you like help with? 😊`,
    
    reminder: "⏰ **CLASS REMINDER!**\n\n📚 {subject}\n🕐 at {time}\n⏱️ Starts in {minutes} minutes!\n\n✅ Don't forget to mark attendance!",
    first_class_alarm: "⏰ **FIRST CLASS SOON!**\n\n📚 {subject}\n🕐 at {time}\n⏱️ Starts in {minutes} minutes!\n\nGet ready and don't be late!",
    deadline_reminder: "📝 **DEADLINE REMINDER!**\n\nTask: {task}\n⏰ Due: {due_date}\n{days_left} day(s) remaining!\n\nDon't forget to complete it!",
    
    thanks: "You're welcome, {name}! 😊 Anything else?",
    time: "🕐 Current time: {time}, {name}.",
    joke: "😂 Here's a joke for you, {name}:\n\n{joke}",
    unknown: "🤔 How can I help? Try 'Help' to see what I can do!",
    
    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    days_short: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  },
  
  ru: {
    ask_name: "👋 Привет! Я твой учебный ассистент. Как тебя зовут?",
    got_name: "🎉 Приятно познакомиться, {name}! Я помогу с расписанием и задачами!",
    greeting: "👋 Привет {name}! Готов к продуктивному дню?",
    
    schedule_today: "📅 **Расписание на сегодня**\n\n{classes}💡 *Нажми '✅ Отметить' после каждой пары!*",
    schedule_tomorrow: "📅 **Расписание на завтра**\n\n{classes}",
    schedule_empty: "📭 Расписание пусто. Используй /add или отправь ICS файл.",
    no_classes: "🎉 Сегодня нет пар, {name}! Свободный день!",
    no_classes_tomorrow: "🎉 Завтра нет пар, {name}! Отдыхай!",
    next_class: "⏰ **Следующая пара**\n\n📖 {subject}\n🕐 в {time}\n⏱️ Через {minutes} минут!\n\n✅ Не забудь отметить посещаемость!",
    no_next_class: "🎉 На сегодня пар больше нет, {name}! Молодец!",
    
    attendance_prompt: "📚 **Какую пару ты посетил?**\n\n{classes}\n\n*Ответь номером или названием*",
    no_classes_attendance: "📭 Сегодня нет пар, {name}!",
    attendance_marked: "✅ Отлично! Отметил '{class_name}' как посещённое, {name}!",
    attendance_error: "❌ Не могу найти '{class_name}'. Проверь название.",
    
    tasks_header: "📋 **Твои активные задачи**\n\n{tasks}💡 *Скажи 'Готово [задача]' когда выполнишь!*",
    no_tasks: "✅ Потрясающе, {name}! Нет активных задач!",
    task_added: "✅ Добавил задачу '{task}'! Напомню за {days} дн.",
    task_completed: "🎉 Отличная работа, {name}! Выполнил '{task}'!\n\n📊 Проверь 'Статистику'!",
    no_task_found: "❌ Не могу найти задачу '{task}'. Проверь список.",
    task_format: "📝 **Формат задачи:**\n`/task \"Название\" ГГГГ-ММ-ДД ЧЧ:ММ дни [приоритет]`",
    wrong_format: "❌ Неверный формат! Используй: `/task \"Задача\" 2025-12-20 23:59 7 high`",
    
    study_logged: "📚 Отлично, {name}! Записал {minutes} минут учёбы по '{subject}'. Так держать!",
    
    import_success: "🎉 Успех! Импортировал {count} пар в расписание, {name}!",
    import_fail: "❌ Не удалось импортировать. Убедись, что это ICS файл.",
    import_instructions: "📥 **Импорт расписания**\n\n1️⃣ Отправь ICS ссылку\n2️⃣ Используй: `/ics https://calendar.ics`\n3️⃣ Прикрепи .ics файл",
    import_empty: "⚠️ В ICS файле не найдено событий. Проверьте формат файла.",
    import_processing: "⏳ Обрабатываю ICS файл... Это может занять несколько секунд.",
    
    stats_header: "📊 **ТВОЯ СТАТИСТИКА, {name}!** 📊\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n",
    task_stats: "📝 **ВЫПОЛНЕНИЕ ЗАДАЧ**\n• ✅ Выполнено: {completed}\n• ⏳ Ожидает: {pending}\n• 🔴 Высокий приоритет: {high}\n• 🎯 Продуктивность: {score}%\n   [{bar}]",
    attendance_stats: "📚 **ПОСЕЩАЕМОСТЬ**\n• 📖 Всего пар: {total}\n• ✅ Посещено: {attended}\n• ❌ Пропущено: {missed}\n• 📈 Посещаемость: {rate}%\n   [{bar}]",
    study_stats: "⏱️ **ВРЕМЯ УЧЁБЫ**\n• 📅 Сегодня: {today} мин\n• 📆 На этой неделе: {week} мин\n• 🏆 Всего: {total} мин\n• 💪 В среднем: {avg} мин/день",
    motivation: "💡 **МОТИВАЦИЯ**\n{message}",
    attendance_tip: "📌 *Совет: Отмечай посещаемость после каждой пары!*",
    no_stats: "📊 Нет данных. Добавь пары и задачи для статистики!",
    
    class_added: "✅ Предмет '{subject}' добавлен на {day} в {start_time}-{end_time}!",
    class_deleted: "✅ Предмет '{subject}' удалён из расписания.",
    class_update_help: "📝 **Обновление пары:**\n`/update <id> <поле> <значение>`\n\nПоля: subject, day, start_time, end_time, location",
    delete_help: "📝 **Удаление пары:**\n`/delete <id>` или `/delete <предмет> <день> <время>`",
    
    settings_title: "⚙️ **Настройки**\n\n",
    settings_reminder: "🔔 Напоминание за: {offset} минут",
    settings_language: "🌐 Язык: {language}",
    settings_commands: "\n\nКоманды:\n/remind <минуты> - Установить время\n/lang ru/en/zh - Сменить язык",
    reminder_set: "⏱️ Напоминание установлено за {minutes} минут до пары!",
    reminder_current: "Текущее время напоминания: {offset} минут до пары.",
    language_changed: "🌐 Язык изменён на {language}!",
    current_language: "🌐 Текущий язык: {language}\n\nДоступно: /lang ru, /lang en, /lang zh",
    
    help_text: `🤖 **Что я умею**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 **РАСПИСАНИЕ**
• "Что сегодня?" - пары на сегодня
• "Что завтра?" - пары на завтра
• "Что дальше?" - следующую пару
• /add <предмет> <день> <начало> <конец>
• /delete <id> - удалить пару
• Отправь ICS ссылку или .ics файл

✅ **ПОСЕЩАЕМОСТЬ**
• "Отметить" - отметить посещение

📝 **ЗАДАЧИ**
• "Мои задачи" - список
• /task "Задача" 2025-12-20 23:59 7 high
• "Готово [задача]" - выполнить

📊 **СТАТИСТИКА**
• "Статистика" - полный отчёт

⏱️ **ВРЕМЯ УЧЁБЫ**
• "Учился 30 минут по Математике"

📥 **ИМПОРТ**
• Отправь ICS ссылку или /ics [url]
• Прикрепи .ics файл в чат

⏰ **НАПОМИНАНИЯ**
• /remind <минуты>

🌐 **ЯЗЫК**
• /lang ru - Русский
• /lang en - English
• /lang zh - 中文

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Чем могу помочь? 😊`,
    
    reminder: "⏰ **НАПОМИНАНИЕ!**\n\n📚 {subject}\n🕐 в {time}\n⏱️ Через {minutes} минут!\n\n✅ Не забудь отметить посещаемость!",
    first_class_alarm: "⏰ **СКОРО ПЕРВАЯ ПАРА!**\n\n📚 {subject}\n🕐 в {time}\n⏱️ Через {minutes} минут!\n\nГотовься!",
    deadline_reminder: "📝 **ДЕДЛАЙН!**\n\nЗадача: {task}\n⏰ Срок: {due_date}\nОсталось {days_left} дн.\n\nНе забудь выполнить!",
    
    thanks: "Пожалуйста, {name}! 😊 Что ещё?",
    time: "🕐 Сейчас {time}, {name}.",
    joke: "😂 Шутка для тебя, {name}:\n\n{joke}",
    unknown: "🤔 Чем помочь? Напиши 'Помощь' чтобы узнать!",
    
    days: ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"],
    days_short: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
  },
  
  zh: {
    ask_name: "👋 你好！我是你的学习助手。你叫什么名字？",
    got_name: "🎉 很高兴认识你，{name}！我会帮你管理课程和任务！",
    greeting: "👋 你好 {name}！准备好高效学习了吗？",
    
    schedule_today: "📅 **今日课程**\n\n{classes}💡 *课后点击'✅ 标记'记录出勤！*",
    schedule_tomorrow: "📅 **明日课程**\n\n{classes}",
    schedule_empty: "📭 课程表为空。使用 /add 或发送ICS文件导入。",
    no_classes: "🎉 今天没课，{name}！自由的一天！",
    no_classes_tomorrow: "🎉 明天没课，{name}！好好休息！",
    next_class: "⏰ **下一节课**\n\n📖 {subject}\n🕐 {time}\n⏱️ {minutes}分钟后开始！\n\n✅ 课后记得标记出勤！",
    no_next_class: "🎉 今天的课都上完了，{name}！干得好！",
    
    attendance_prompt: "📚 **你上了哪节课？**\n\n{classes}\n\n*回复课程编号或名称*",
    no_classes_attendance: "📭 今天没有课，{name}！",
    attendance_marked: "✅ 太好了！已将'{class_name}'标记为出勤，{name}！",
    attendance_error: "❌ 找不到'{class_name}'。请检查名称。",
    
    tasks_header: "📋 **待办任务**\n\n{tasks}💡 *完成任务时说'完成 [任务名]'*",
    no_tasks: "✅ 太棒了，{name}！没有待办任务！",
    task_added: "✅ 已添加任务'{task}'！提前{days}天提醒你。",
    task_completed: "🎉 干得好，{name}！完成了'{task}'！\n\n📊 查看'统计'了解进度！",
    no_task_found: "❌ 找不到名为'{task}'的任务。",
    task_format: "📝 **添加任务格式：**\n`/task \"任务名\" 年-月-日 时:分 天数 [优先级]`",
    wrong_format: "❌ 格式错误！使用：`/task \"任务名\" 2025-12-20 23:59 7 high`",
    
    study_logged: "📚 太好了，{name}！记录了学习'{subject}' {minutes}分钟。继续加油！",
    
    import_success: "🎉 成功！已导入 {count} 节课到你的课程表，{name}！",
    import_fail: "❌ 无法导入。请确保是有效的ICS文件。",
    import_instructions: "📥 **导入课程表**\n\n1️⃣ 发送ICS链接\n2️⃣ 使用：`/ics https://calendar.ics`\n3️⃣ 附加.ics文件",
    import_empty: "⚠️ ICS文件中没有找到有效的事件。请检查文件格式。",
    import_processing: "⏳ 正在处理ICS文件... 请稍等片刻。",
    
    stats_header: "📊 **学习统计，{name}！** 📊\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n",
    task_stats: "📝 **任务完成**\n• ✅ 已完成：{completed}\n• ⏳ 待完成：{pending}\n• 🔴 高优先级完成：{high}\n• 🎯 生产力：{score}%\n   [{bar}]",
    attendance_stats: "📚 **出勤统计**\n• 📖 总课程：{total}\n• ✅ 已出勤：{attended}\n• ❌ 缺勤：{missed}\n• 📈 出勤率：{rate}%\n   [{bar}]",
    study_stats: "⏱️ **学习时间**\n• 📅 今日：{today} 分钟\n• 📆 本周：{week} 分钟\n• 🏆 总计：{total} 分钟\n• 💪 日均：{avg} 分钟",
    motivation: "💡 **激励语**\n{message}",
    attendance_tip: "📌 *提示：课后标记出勤可以提高统计数据！*",
    no_stats: "📊 暂无数据。添加课程和任务开始统计！",
    
    class_added: "✅ 课程'{subject}'已添加至{day} {start_time}-{end_time}！",
    class_deleted: "✅ 课程'{subject}'已删除。",
    class_update_help: "📝 **更新课程：**\n`/update <id> <字段> <值>`",
    delete_help: "📝 **删除课程：**\n`/delete <id>`",
    
    settings_title: "⚙️ **设置**\n\n",
    settings_reminder: "🔔 提醒时间：课前{offset}分钟",
    settings_language: "🌐 语言：{language}",
    settings_commands: "\n\n命令：\n/remind <分钟> - 设置提醒时间\n/lang ru/en/zh - 切换语言",
    reminder_set: "⏱️ 提醒时间设置为课前{minutes}分钟！",
    reminder_current: "当前提醒时间：课前{offset}分钟。",
    language_changed: "🌐 语言已切换为{language}！",
    current_language: "🌐 当前语言：{language}\n\n可用：/lang en, /lang ru, /lang zh",
    
    help_text: `🤖 **我能帮你做什么**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 **课程表**
• "今天有什么课？" - 今日课程
• "明天有什么课？" - 明日课程
• "下节课是什么？" - 下节课
• /add <课程> <星期> <开始> <结束>
• /delete <id> - 删除课程
• 发送ICS链接或.ics文件

✅ **出勤**
• "标记" - 记录出勤

📝 **任务**
• "我的任务" - 查看任务
• /task "任务名" 2025-12-20 23:59 7 high
• "完成 [任务名]" - 标记完成

📊 **统计**
• "统计" - 完整进度报告

⏱️ **学习时间**
• "学习了30分钟数学"

📥 **导入**
• 发送ICS链接或 /ics [url]
• 在聊天中附加.ics文件

⏰ **提醒**
• /remind <分钟>

🌐 **语言**
• /lang ru - Русский
• /lang en - English
• /lang zh - 中文

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
需要帮助？😊`,
    
    reminder: "⏰ **课程提醒！**\n\n📚 {subject}\n🕐 {time}\n⏱️ {minutes}分钟后开始！\n\n✅ 课后记得标记出勤！",
    first_class_alarm: "⏰ **第一节课即将开始！**\n\n📚 {subject}\n🕐 {time}\n⏱️ {minutes}分钟后开始！\n\n准备好，不要迟到！",
    deadline_reminder: "📝 **截止日期提醒！**\n\n任务：{task}\n⏰ 截止：{due_date}\n还剩 {days_left} 天！\n\n不要忘记完成！",
    
    thanks: "不客气，{name}！😊 还需要什么？",
    time: "🕐 当前时间：{time}，{name}。",
    joke: "😂 给你讲个笑话，{name}：\n\n{joke}",
    unknown: "🤔 需要什么帮助？试试'帮助'看看我能做什么！",
    
    days: ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"],
    days_short: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
  }
};

// Jokes and motivations
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

const MOTIVATIONS = {
  en: [
    "You're doing amazing! Keep pushing forward! 💪",
    "Every step counts! Progress over perfection! 🌟",
    "Your dedication is inspiring! 🎯",
    "Small daily improvements lead to big results! 📈"
  ],
  ru: [
    "У тебя отлично получается! Продолжай в том же духе! 💪",
    "Каждый шаг имеет значение! Прогресс важнее совершенства! 🌟",
    "Твоя целеустремлённость вдохновляет! 🎯",
    "Маленькие ежедневные улучшения ведут к большим результатам! 📈"
  ],
  zh: [
    "你做得太棒了！继续加油！💪",
    "每一步都很重要！进步胜于完美！🌟",
    "你的努力很鼓舞人心！🎯",
    "小小的日常改进会带来巨大的成果！📈"
  ]
};

// ==================== VK API HELPERS ====================
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
    if (controller) fetchOptions.signal = controller.signal;

    const response = await fetch(url.toString(), fetchOptions);
    const data = await response.json();

    if (data.error) {
      console.error("VK API Error:", data.error);
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
    message: text.slice(0, 4096),
    random_id: Math.floor(Math.random() * 2147483647),
  };
  if (keyboard) params.keyboard = keyboard;

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

// Fire-and-forget async version for non-blocking
function sendMessageAsync(userId, text, keyboard = null) {
  sendMessage(userId, text, keyboard).catch(console.error);
}

// ==================== KEYBOARD BUILDERS ====================
function getMainKeyboard(lang) {
  if (lang === 'ru') {
    return JSON.stringify({
      one_time: false,
      buttons: [
        [{ action: { type: "text", label: "📅 Расписание" }, color: "primary" }],
        [{ action: { type: "text", label: "📋 Сегодня" }, color: "positive" }],
        [{ action: { type: "text", label: "⏭️ Что дальше?" }, color: "secondary" }],
        [{ action: { type: "text", label: "📝 Задачи" }, color: "positive" }],
        [{ action: { type: "text", label: "📊 Статистика" }, color: "secondary" }],
        [{ action: { type: "text", label: "⚙️ Настройки" }, color: "primary" }],
        [{ action: { type: "text", label: "➕ Добавить" }, color: "positive" }],
        [{ action: { type: "text", label: "❓ Помощь" }, color: "secondary" }]
      ]
    });
  } else if (lang === 'zh') {
    return JSON.stringify({
      one_time: false,
      buttons: [
        [{ action: { type: "text", label: "📅 课程表" }, color: "primary" }],
        [{ action: { type: "text", label: "📋 今日" }, color: "positive" }],
        [{ action: { type: "text", label: "⏭️ 下节课" }, color: "secondary" }],
        [{ action: { type: "text", label: "📝 任务" }, color: "positive" }],
        [{ action: { type: "text", label: "📊 统计" }, color: "secondary" }],
        [{ action: { type: "text", label: "⚙️ 设置" }, color: "primary" }],
        [{ action: { type: "text", label: "➕ 添加" }, color: "positive" }],
        [{ action: { type: "text", label: "❓ 帮助" }, color: "secondary" }]
      ]
    });
  } else {
    return JSON.stringify({
      one_time: false,
      buttons: [
        [{ action: { type: "text", label: "📅 Schedule" }, color: "primary" }],
        [{ action: { type: "text", label: "📋 Today" }, color: "positive" }],
        [{ action: { type: "text", label: "⏭️ What's next?" }, color: "secondary" }],
        [{ action: { type: "text", label: "📝 Tasks" }, color: "positive" }],
        [{ action: { type: "text", label: "📊 Statistics" }, color: "secondary" }],
        [{ action: { type: "text", label: "⚙️ Settings" }, color: "primary" }],
        [{ action: { type: "text", label: "➕ Add" }, color: "positive" }],
        [{ action: { type: "text", label: "❓ Help" }, color: "secondary" }]
      ]
    });
  }
}

function getSettingsKeyboard(offset, lang) {
  const buttonText = lang === 'ru' ? '🔙 Назад' : lang === 'zh' ? '🔙 返回' : '🔙 Back';
  return JSON.stringify({
    one_time: false,
    buttons: [
      [
        { action: { type: "callback", label: "➖", payload: JSON.stringify({ cmd: "offset_down" }) }, color: "negative" },
        { action: { type: "text", label: `${offset} min` }, color: "primary" },
        { action: { type: "callback", label: "➕", payload: JSON.stringify({ cmd: "offset_up" }) }, color: "positive" }
      ],
      [{ action: { type: "text", label: buttonText }, color: "secondary" }]
    ]
  });
}

function getAddKeyboard(lang) {
  const classText = lang === 'ru' ? '📅 Добавить пару' : lang === 'zh' ? '📅 添加课程' : '📅 Add Class';
  const taskText = lang === 'ru' ? '📝 Добавить задачу' : lang === 'zh' ? '📝 添加任务' : '📝 Add Task';
  const backText = lang === 'ru' ? '🔙 Назад' : lang === 'zh' ? '🔙 返回' : '🔙 Back';
  
  return JSON.stringify({
    one_time: false,
    buttons: [
      [{ action: { type: "text", label: classText }, color: "positive" }],
      [{ action: { type: "text", label: taskText }, color: "positive" }],
      [{ action: { type: "text", label: backText }, color: "secondary" }]
    ]
  });
}

function getTaskKeyboard(taskId, lang) {
  const doneText = lang === 'ru' ? '✅ Выполнено' : lang === 'zh' ? '✅ 完成' : '✅ Done';
  return JSON.stringify({
    inline: true,
    buttons: [[{
      action: { type: "callback", label: doneText, payload: JSON.stringify({ cmd: "mark_done", tid: taskId }) },
      color: "positive"
    }]]
  });
}

// ==================== DATABASE OPERATIONS ====================
async function getUser(userId) {
  const cacheKey = `user_${userId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("vk_id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("getUser error:", error.message);
    return null;
  }

  const result = data || null;
  if (result) setCached(cacheKey, result);
  return result;
}

async function createUser(userId, name = null, language = null) {
  const detectedLang = language || "en";
  const { error } = await supabase.from("users").upsert({
    vk_id: userId,
    name: name || "",
    language: detectedLang,
    reminder_offset: 60,
    join_date: new Date().toISOString()
  }, { onConflict: "vk_id" });

  if (error) console.error("createUser error:", error.message);
  invalidateCache(userId, "user");
}

async function updateUserName(userId, name) {
  const { error } = await supabase
    .from("users")
    .update({ name })
    .eq("vk_id", userId);

  if (!error) {
    invalidateCache(userId, "user");
    invalidateCache(userId, "name");
  }
}

async function getUserName(userId) {
  const cacheKey = `name_${userId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from("users")
    .select("name")
    .eq("vk_id", userId)
    .single();

  let name = "friend";
  if (!error && data) name = data.name || "friend";
  setCached(cacheKey, name);
  return name;
}

async function getUserLanguage(userId) {
  const cacheKey = `lang_${userId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from("users")
    .select("language")
    .eq("vk_id", userId)
    .single();

  let lang = "en";
  if (!error && data) lang = data.language;
  setCached(cacheKey, lang);
  return lang;
}

async function setUserLanguage(userId, language) {
  const { error } = await supabase
    .from("users")
    .update({ language })
    .eq("vk_id", userId);

  if (!error) {
    invalidateCache(userId, "lang");
    invalidateCache(userId, "user");
  }
}

async function getUserReminderOffset(userId) {
  const cacheKey = `offset_${userId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from("users")
    .select("reminder_offset")
    .eq("vk_id", userId)
    .single();

  let offset = 60;
  if (!error && data) offset = data.reminder_offset || 60;
  setCached(cacheKey, offset);
  return offset;
}

async function setUserReminderOffset(userId, minutes) {
  const { error } = await supabase
    .from("users")
    .update({ reminder_offset: minutes })
    .eq("vk_id", userId);

  if (!error) invalidateCache(userId, "offset");
}

// Schedule operations
async function getSchedule(userId) {
  const cacheKey = `schedule_${userId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from("schedule")
    .select("id, subject, day, start_time, end_time, location")
    .eq("user_id", userId)
    .order("day", { ascending: true })
    .order("start_time", { ascending: true });

  const result = error ? [] : data || [];
  setCached(cacheKey, result);
  return result;
}

async function addClass(userId, subject, day, startTime, endTime, location = "") {
  const { error } = await supabase.from("schedule").insert({
    user_id: userId,
    subject,
    day,
    start_time: startTime,
    end_time: endTime,
    location
  });

  if (!error) {
    invalidateCache(userId, "schedule");
    return true;
  }
  console.error("addClass error:", error.message);
  return false;
}

async function deleteClass(classId, userId) {
  const { error } = await supabase
    .from("schedule")
    .delete()
    .eq("id", classId)
    .eq("user_id", userId);

  if (!error) {
    invalidateCache(userId, "schedule");
    return true;
  }
  return false;
}

async function updateClass(classId, userId, field, value) {
  const allowedFields = ["subject", "day", "start_time", "end_time", "location"];
  if (!allowedFields.includes(field)) return false;

  const { error } = await supabase
    .from("schedule")
    .update({ [field]: value })
    .eq("id", classId)
    .eq("user_id", userId);

  if (!error) {
    invalidateCache(userId, "schedule");
    return true;
  }
  return false;
}

// Task operations
async function getTasks(userId, onlyPending = true) {
  const cacheKey = `tasks_${userId}_${onlyPending}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  let query = supabase
    .from("tasks")
    .select("id, task, due_date, remind_days, priority, done")
    .eq("user_id", userId);

  if (onlyPending) query = query.eq("done", false);
  const { data, error } = await query.order("due_date", { ascending: true });

  const result = error ? [] : data || [];
  setCached(cacheKey, result);
  return result;
}

async function addTask(userId, task, dueDate, remindDays, priority = "normal") {
  const { error } = await supabase.from("tasks").insert({
    user_id: userId,
    task,
    due_date: dueDate,
    remind_days: remindDays,
    priority,
    done: false
  });

  if (!error) {
    invalidateCache(userId, "tasks");
    invalidateCache(userId, "task_stats");
    return true;
  }
  return false;
}

async function completeTask(taskId, userId) {
  const { error } = await supabase
    .from("tasks")
    .update({ done: true, completed_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("user_id", userId);

  if (!error) {
    invalidateCache(userId, "tasks");
    invalidateCache(userId, "task_stats");
    return true;
  }
  return false;
}

// Attendance operations
async function markAttendance(userId, className) {
  const today = new Date().toISOString().split("T")[0];
  const { error } = await supabase
    .from("attendance")
    .upsert({
      user_id: userId,
      class_name: className,
      date: today,
      attended: true
    }, { onConflict: "user_id,class_name,date" });

  if (!error) {
    invalidateCache(userId, "att_stats");
    return true;
  }
  return false;
}

async function getAttendanceStats(userId) {
  const cacheKey = `att_stats_${userId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from("attendance")
    .select("attended")
    .eq("user_id", userId);

  if (error || !data || data.length === 0) {
    const empty = { attended: 0, missed: 0, total: 0, rate: 0 };
    setCached(cacheKey, empty);
    return empty;
  }

  const attended = data.filter(a => a.attended).length;
  const total = data.length;
  const missed = total - attended;
  const rate = total > 0 ? Math.round((attended / total) * 100) : 0;

  const result = { attended, missed, total, rate };
  setCached(cacheKey, result);
  return result;
}

// Study time operations
async function addStudySession(userId, subject, duration) {
  const today = new Date().toISOString().split("T")[0];
  const { error } = await supabase.from("study_sessions").insert({
    user_id: userId,
    subject,
    duration,
    date: today
  });

  if (error) {
    console.error("addStudySession error:", error.message);
    return false;
  }
  invalidateCache(userId, "study_stats");
  return true;
}

async function getStudyStats(userId) {
  const cacheKey = `study_stats_${userId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const today = new Date().toISOString().split("T")[0];
  
  const [{ data: totalData }, { data: weeklyData }, { data: todayData }] = await Promise.all([
    supabase.rpc('sum_study_duration', { p_user_id: userId, p_days: 0 }),
    supabase.rpc('sum_study_duration', { p_user_id: userId, p_days: 7 }),
    supabase.from("study_sessions").select("duration").eq("user_id", userId).eq("date", today)
  ]);

  const total = totalData || 0;
  const weekly = weeklyData || 0;
  const todayTotal = todayData?.reduce((sum, s) => sum + (s.duration || 0), 0) || 0;

  const result = { total, weekly, today: todayTotal };
  setCached(cacheKey, result);
  return result;
}

async function getTaskStats(userId) {
  const cacheKey = `task_stats_${userId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from("tasks")
    .select("done, priority")
    .eq("user_id", userId);

  if (error || !data || data.length === 0) {
    const empty = { completed: 0, pending: 0, high: 0, total: 0, score: 0 };
    setCached(cacheKey, empty);
    return empty;
  }

  const completed = data.filter(t => t.done).length;
  const total = data.length;
  const pending = total - completed;
  const high = data.filter(t => t.done && t.priority === "high").length;
  const score = total > 0 ? Math.round((completed / total) * 100) : 0;

  const result = { completed, pending, high, total, score };
  setCached(cacheKey, result);
  return result;
}

// Getting upcoming classes
async function getTodayClasses(userId) {
  const now = new Date();
  let currentDay = now.getDay() - 1;
  if (currentDay < 0) currentDay = 6;

  const cacheKey = `today_${userId}_${now.toDateString()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from("schedule")
    .select("*")
    .eq("user_id", userId)
    .eq("day", currentDay)
    .order("start_time", { ascending: true });

  const result = error ? [] : data || [];
  setCached(cacheKey, result);
  return result;
}

async function getTomorrowClasses(userId) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  let tomorrowDay = tomorrow.getDay() - 1;
  if (tomorrowDay < 0) tomorrowDay = 6;

  const { data, error } = await supabase
    .from("schedule")
    .select("*")
    .eq("user_id", userId)
    .eq("day", tomorrowDay)
    .order("start_time", { ascending: true });

  return error ? [] : data || [];
}

async function getNextClass(userId) {
  const now = new Date();
  let currentDay = now.getDay() - 1;
  if (currentDay < 0) currentDay = 6;
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const { data: todayClasses, error: todayError } = await supabase
    .from("schedule")
    .select("*")
    .eq("user_id", userId)
    .eq("day", currentDay)
    .order("start_time", { ascending: true });

  if (!todayError && todayClasses) {
    const upcoming = todayClasses.filter(c => c.start_time > currentTime);
    if (upcoming.length > 0) return { class: upcoming[0], when: "today" };
  }

  let nextDay = currentDay + 1;
  if (nextDay > 6) nextDay = 0;

  const { data: nextClasses, error: nextError } = await supabase
    .from("schedule")
    .select("*")
    .eq("user_id", userId)
    .eq("day", nextDay)
    .order("start_time", { ascending: true });

  if (!nextError && nextClasses && nextClasses.length > 0) {
    return { class: nextClasses[0], when: "tomorrow" };
  }

  return null;
}

// ==================== ENHANCED ICS IMPORT ====================
// Function to parse datetime from various ICS formats
function parseICSDateTime(dateTimeStr) {
  if (!dateTimeStr) return null;
  
  // Format: 20231215T143000Z (UTC)
  if (typeof dateTimeStr === 'string' && dateTimeStr.match(/\d{8}T\d{6}/)) {
    const year = parseInt(dateTimeStr.substring(0, 4));
    const month = parseInt(dateTimeStr.substring(4, 6));
    const day = parseInt(dateTimeStr.substring(6, 8));
    const hour = parseInt(dateTimeStr.substring(9, 11));
    const minute = parseInt(dateTimeStr.substring(11, 13));
    const second = parseInt(dateTimeStr.substring(13, 15));
    return new Date(year, month - 1, day, hour, minute, second);
  }
  
  // Handle Date objects
  if (dateTimeStr instanceof Date) return dateTimeStr;
  
  // Handle string dates
  if (typeof dateTimeStr === 'string') {
    const parsed = new Date(dateTimeStr);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  
  return null;
}

// Function to get day of week (0=Monday, 6=Sunday)
function getDayOfWeek(date) {
  let day = date.getDay();
  // Convert Sunday (0) to 6 (last day of week)
  return day === 0 ? 6 : day - 1;
}

// Main ICS import function - supports both URLs and file content
async function importICSContent(userId, icsContent, lang) {
  try {
    console.log(`[ICS Import] Starting import for user ${userId}, content length: ${icsContent.length}`);
    
    // Parse ICS using the ical library
    const parsed = ical.parseICS(icsContent);
    
    if (!parsed || Object.keys(parsed).length === 0) {
      console.log(`[ICS Import] No events found in ICS file`);
      return { success: false, count: 0, error: "No events found" };
    }
    
    let addedCount = 0;
    let skippedCount = 0;
    const addedClasses = [];
    
    // Iterate through all events
    for (const key in parsed) {
      const event = parsed[key];
      
      // Check if it's a VEVENT
      if (event.type !== 'VEVENT') continue;
      
      // Get event title
      let subject = event.summary || event.title || "Class";
      // Clean up subject - remove HTML tags if any
      subject = subject.replace(/<[^>]*>/g, '').trim();
      
      // Get start and end times
      let startDate = null;
      let endDate = null;
      
      // Try to get DTSTART
      if (event.start) {
        startDate = parseICSDateTime(event.start);
      } else if (event.dtstart) {
        startDate = parseICSDateTime(event.dtstart);
      }
      
      // Try to get DTEND
      if (event.end) {
        endDate = parseICSDateTime(event.end);
      } else if (event.dtend) {
        endDate = parseICSDateTime(event.dtend);
      }
      
      // If no end time, set duration to 1.5 hours (90 minutes)
      if (startDate && !endDate) {
        endDate = new Date(startDate.getTime() + 90 * 60 * 1000);
      }
      
      // Skip if no valid start date
      if (!startDate) {
        console.log(`[ICS Import] Skipping event "${subject}" - no valid start date`);
        skippedCount++;
        continue;
      }
      
      // Format times
      const startTimeStr = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
      const endTimeStr = endDate ? `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}` : 
                         `${String(startDate.getHours() + 1).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
      
      // Get day of week (Monday=0 to Sunday=6)
      const day = getDayOfWeek(startDate);
      
      // Get location if available
      let location = event.location || "";
      if (location) {
        location = location.replace(/<[^>]*>/g, '').trim();
      }
      
      console.log(`[ICS Import] Adding class: ${subject} | Day: ${day} | Time: ${startTimeStr}-${endTimeStr} | Location: ${location}`);
      
      // Add to database
      const success = await addClass(userId, subject, day, startTimeStr, endTimeStr, location);
      if (success) {
        addedCount++;
        addedClasses.push({ subject, day, startTimeStr, endTimeStr });
      }
    }
    
    console.log(`[ICS Import] Import complete - Added: ${addedCount}, Skipped: ${skippedCount}`);
    
    return { 
      success: addedCount > 0, 
      count: addedCount, 
      skipped: skippedCount,
      classes: addedClasses 
    };
    
  } catch (error) {
    console.error("[ICS Import] Parse error:", error);
    return { success: false, count: 0, error: error.message };
  }
}

async function importICSFromUrl(userId, url, lang) {
  try {
    console.log(`[ICS Import] Downloading from URL: ${url}`);
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    
    // Download ICS file with proper headers
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/calendar, application/octet-stream, */*'
      }
    });
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    // Get content type and handle different encodings
    const contentType = response.headers.get('content-type') || '';
    let icsText;
    
    if (contentType.includes('charset=')) {
      const encoding = contentType.match(/charset=([^;]+)/)?.[1] || 'utf-8';
      const buffer = await response.arrayBuffer();
      const decoder = new TextDecoder(encoding);
      icsText = decoder.decode(buffer);
    } else {
      icsText = await response.text();
    }
    
    // Validate that it looks like ICS content
    if (!icsText.includes('BEGIN:VCALENDAR') || !icsText.includes('END:VCALENDAR')) {
      console.log(`[ICS Import] Invalid ICS format - missing VCALENDAR markers`);
      return { success: false, count: 0, error: "Invalid ICS format" };
    }
    
    // Parse the ICS content
    return await importICSContent(userId, icsText, lang);
    
  } catch (error) {
    console.error("[ICS Import] URL import error:", error);
    return { success: false, count: 0, error: error.message };
  }
}

async function importICSFromBuffer(userId, buffer, filename, lang) {
  try {
    console.log(`[ICS Import] Processing file: ${filename}, size: ${buffer.length} bytes`);
    
    // Try different encodings
    let icsText;
    try {
      icsText = buffer.toString('utf-8');
    } catch (e) {
      icsText = buffer.toString('latin1');
    }
    
    // Validate ICS format
    if (!icsText.includes('BEGIN:VCALENDAR') || !icsText.includes('END:VCALENDAR')) {
      console.log(`[ICS Import] Invalid ICS format in file`);
      return { success: false, count: 0, error: "Invalid ICS file format" };
    }
    
    return await importICSContent(userId, icsText, lang);
    
  } catch (error) {
    console.error("[ICS Import] File import error:", error);
    return { success: false, count: 0, error: error.message };
  }
}

// ==================== HELPER FUNCTIONS ====================
function detectLanguage(text) {
  if (!text) return "en";
  if (/[\u4e00-\u9fff]/.test(text)) return "zh";
  if (/[а-яА-Я]/.test(text)) return "ru";
  return "en";
}

function createProgressBar(percentage, length = 10) {
  const filled = Math.floor(percentage / 100 * length);
  return "█".repeat(filled) + "░".repeat(length - filled);
}

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getTranslation(userId, key, params = {}) {
  const lang = getUserLanguage(userId) || "en";
  let text = TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key] || key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(new RegExp(`{${k}}`, "g"), v);
  }
  return text;
}

function getTranslationSync(lang, key, params = {}) {
  let text = TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key] || key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(new RegExp(`{${k}}`, "g"), v);
  }
  return text;
}

// ==================== MESSAGE HANDLER ====================
async function handleMessage(userId, text, lang) {
  const name = await getUserName(userId);
  const lowText = text.toLowerCase().trim();

  // ====== GREETINGS ======
  if (lowText === "привет" || lowText === "hello" || lowText === "hi" || lowText === "你好") {
    await sendMessage(userId, getTranslation(userId, "greeting", { name }), getMainKeyboard(lang));
    return;
  }

  // ====== SCHEDULE ======
  if (text === "📅 Schedule" || text === "📅 Расписание" || text === "📅 课程表" ||
      lowText.includes("schedule") || lowText.includes("расписание")) {
    const schedule = await getSchedule(userId);
    if (schedule.length === 0) {
      await sendMessage(userId, getTranslation(userId, "schedule_empty"), getMainKeyboard(lang));
    } else {
      let msg = getTranslation(userId, "schedule_header");
      for (const cls of schedule) {
        msg += getTranslation(userId, "schedule_item", {
          day: TRANSLATIONS[lang].days_short[cls.day],
          start: cls.start_time,
          end: cls.end_time,
          subject: cls.subject
        });
      }
      await sendMessage(userId, msg, getMainKeyboard(lang));
    }
    return;
  }

  // ====== TODAY'S CLASSES ======
  if (text === "📋 Today" || text === "📋 Сегодня" || text === "📋 今日" ||
      lowText.includes("today") || lowText.includes("сегодня")) {
    const classes = await getTodayClasses(userId);
    if (classes.length === 0) {
      await sendMessage(userId, getTranslation(userId, "no_classes", { name }), getMainKeyboard(lang));
    } else {
      let msg = getTranslation(userId, "schedule_today", { name, classes: "" });
      for (const cls of classes) {
        msg += `⏰ ${cls.start_time}-${cls.end_time} • **${cls.subject}**\n`;
        if (cls.location) msg += `   📍 ${cls.location}\n`;
        msg += "\n";
      }
      await sendMessage(userId, msg, getMainKeyboard(lang));
    }
    return;
  }

  // ====== TOMORROW'S CLASSES ======
  if (lowText.includes("tomorrow") || lowText.includes("завтра") || lowText.includes("明天")) {
    const classes = await getTomorrowClasses(userId);
    if (classes.length === 0) {
      await sendMessage(userId, getTranslation(userId, "no_classes_tomorrow", { name }), getMainKeyboard(lang));
    } else {
      let msg = getTranslation(userId, "schedule_tomorrow", { name, classes: "" });
      for (const cls of classes) {
        msg += `⏰ ${cls.start_time}-${cls.end_time} • **${cls.subject}**\n`;
        msg += "\n";
      }
      await sendMessage(userId, msg, getMainKeyboard(lang));
    }
    return;
  }

  // ====== NEXT CLASS ======
  if (text === "⏭️ What's next?" || text === "⏭️ Что дальше?" || text === "⏭️ 下节课" ||
      lowText.includes("next") || lowText.includes("дальше")) {
    const next = await getNextClass(userId);
    if (next) {
      const now = new Date();
      const [hour, minute] = next.class.start_time.split(":").map(Number);
      const classTime = new Date(now);
      classTime.setHours(hour, minute, 0, 0);
      const minutes = Math.max(0, Math.round((classTime - now) / 60000));
      const whenText = next.when === "today" 
        ? (lang === "ru" ? "сегодня" : lang === "zh" ? "今天" : "today")
        : (lang === "ru" ? "завтра" : lang === "zh" ? "明天" : "tomorrow");
      
      await sendMessage(userId, getTranslation(userId, "next_class", {
        subject: next.class.subject,
        when: whenText,
        time: next.class.start_time,
        minutes
      }), getMainKeyboard(lang));
    } else {
      await sendMessage(userId, getTranslation(userId, "no_next_class", { name }), getMainKeyboard(lang));
    }
    return;
  }

  // ====== TASKS ======
  if (text === "📝 Tasks" || text === "📝 Задачи" || text === "📝 任务" ||
      lowText.includes("tasks") || lowText.includes("задачи")) {
    const tasks = await getTasks(userId, true);
    if (tasks.length === 0) {
      await sendMessage(userId, getTranslation(userId, "no_tasks", { name }), getMainKeyboard(lang));
    } else {
      let taskList = "";
      for (const task of tasks) {
        const priorityIcon = task.priority === "high" ? "🔴" : task.priority === "medium" ? "🟡" : "🟢";
        taskList += `${priorityIcon} **${task.task}**\n   📅 ${task.due_date} | ⏰ ${task.remind_days}d\n\n`;
      }
      await sendMessage(userId, getTranslation(userId, "tasks_header", { name, tasks: taskList }), getMainKeyboard(lang));
    }
    return;
  }

  // ====== COMPLETE TASK ======
  const doneMatch = text.match(/(?:done|готово|выполнил|完成)\s+(.+)/i);
  if (doneMatch) {
    const taskName = doneMatch[1].trim().toLowerCase();
    const tasks = await getTasks(userId, true);
    let found = false;
    for (const task of tasks) {
      if (task.task.toLowerCase().includes(taskName) || taskName.includes(task.task.toLowerCase())) {
        await completeTask(task.id, userId);
        await sendMessage(userId, getTranslation(userId, "task_completed", { name, task: task.task }), getMainKeyboard(lang));
        found = true;
        break;
      }
    }
    if (!found) {
      await sendMessage(userId, getTranslation(userId, "no_task_found", { name, task: taskName }), getMainKeyboard(lang));
    }
    return;
  }

  // ====== STATISTICS ======
  if (text === "📊 Statistics" || text === "📊 Статистика" || text === "📊 统计" ||
      lowText.includes("statistics") || lowText.includes("stats") || lowText.includes("статистика")) {
    const [attendance, taskStats, studyStats, scheduleCount] = await Promise.all([
      getAttendanceStats(userId),
      getTaskStats(userId),
      getStudyStats(userId),
      (await getSchedule(userId)).length
    ]);

    const prodBar = createProgressBar(taskStats.score);
    const attendBar = createProgressBar(attendance.rate);
    const avgDaily = Math.round(studyStats.weekly / 7);
    const motivation = getRandomItem(MOTIVATIONS[lang]);

    let msg = getTranslation(userId, "stats_header", { name }) + "\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
    msg += getTranslation(userId, "task_stats", {
      completed: taskStats.completed,
      pending: taskStats.pending,
      high: taskStats.high,
      score: taskStats.score,
      bar: prodBar
    }) + "\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
    msg += getTranslation(userId, "attendance_stats", {
      total: attendance.total,
      attended: attendance.attended,
      missed: attendance.missed,
      rate: attendance.rate,
      bar: attendBar
    }) + "\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
    msg += getTranslation(userId, "study_stats", {
      today: studyStats.today,
      week: studyStats.weekly,
      total: studyStats.total,
      avg: avgDaily
    }) + "\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
    msg += getTranslation(userId, "motivation", { message: motivation }) + "\n\n";
    msg += getTranslation(userId, "attendance_tip");

    await sendMessage(userId, msg, getMainKeyboard(lang));
    return;
  }

  // ====== ATTENDANCE ======
  if (text === "✅ Mark" || text === "✅ Отметить" || text === "✅ 标记" ||
      lowText.includes("mark") || lowText.includes("отметить")) {
    const classes = await getTodayClasses(userId);
    if (classes.length === 0) {
      await sendMessage(userId, getTranslation(userId, "no_classes_attendance", { name }), getMainKeyboard(lang));
    } else {
      let classList = "";
      for (let i = 0; i < classes.length; i++) {
        classList += `${i + 1}. ${classes[i].subject} (${classes[i].start_time}-${classes[i].end_time})\n`;
      }
      await sendMessage(userId, getTranslation(userId, "attendance_prompt", { classes: classList }), getMainKeyboard(lang));
    }
    return;
  }

  // Handle attendance by number
  if (/^\d+$/.test(text) && parseInt(text) <= 10) {
    const classes = await getTodayClasses(userId);
    const idx = parseInt(text) - 1;
    if (idx >= 0 && idx < classes.length) {
      await markAttendance(userId, classes[idx].subject);
      await sendMessage(userId, getTranslation(userId, "attendance_marked", { name, class_name: classes[idx].subject }), getMainKeyboard(lang));
      return;
    }
  }

  // ====== SETTINGS ======
  if (text === "⚙️ Settings" || text === "⚙️ Настройки" || text === "⚙️ 设置") {
    const offset = await getUserReminderOffset(userId);
    const langDisplay = lang === "ru" ? "Русский" : lang === "zh" ? "中文" : "English";
    let msg = getTranslation(userId, "settings_title");
    msg += getTranslation(userId, "settings_reminder", { offset }) + "\n";
    msg += getTranslation(userId, "settings_language", { language: langDisplay });
    msg += getTranslation(userId, "settings_commands");
    await sendMessage(userId, msg, getSettingsKeyboard(offset, lang));
    return;
  }

  // ====== ADD MENU ======
  if (text === "➕ Add" || text === "➕ Добавить" || text === "➕ 添加") {
    await sendMessage(userId, lang === "ru" ? "Что добавить?" : lang === "zh" ? "添加什么？" : "What would you like to add?", getAddKeyboard(lang));
    return;
  }

  // ====== ADD CLASS ======
  if (text === "📅 Add Class" || text === "📅 Добавить пару" || text === "📅 添加课程") {
    await sendMessage(userId, getTranslation(userId, "add_class_help"), getMainKeyboard(lang));
    return;
  }

  // ====== ADD TASK ======
  if (text === "📝 Add Task" || text === "📝 Добавить задачу" || text === "📝 添加任务") {
    await sendMessage(userId, getTranslation(userId, "task_format"), getMainKeyboard(lang));
    return;
  }

  // ====== BACK BUTTON ======
  if (text === "🔙 Back" || text === "🔙 Назад" || text === "🔙 返回") {
    await sendMessage(userId, lang === "ru" ? "Возвращаемся в меню..." : lang === "zh" ? "返回主菜单..." : "Returning to main menu...", getMainKeyboard(lang));
    return;
  }

  // ====== /add COMMAND ======
  if (lowText.startsWith("/add")) {
    const parts = text.split(" ");
    if (parts.length >= 5) {
      const subject = parts[1];
      const day = parseInt(parts[2]);
      const startTime = parts[3];
      const endTime = parts[4];
      const location = parts[5] || "";
      if (!isNaN(day) && day >= 0 && day <= 6) {
        const success = await addClass(userId, subject, day, startTime, endTime, location);
        if (success) {
          await sendMessage(userId, getTranslation(userId, "class_added", { subject, day: TRANSLATIONS[lang].days_short[day], start_time: startTime, end_time: endTime }), getMainKeyboard(lang));
        } else {
          await sendMessage(userId, "❌ Error adding class", getMainKeyboard(lang));
        }
      } else {
        await sendMessage(userId, "❌ Day must be 0 (Mon) to 6 (Sun)", getMainKeyboard(lang));
      }
    } else {
      await sendMessage(userId, getTranslation(userId, "add_class_help"), getMainKeyboard(lang));
    }
    return;
  }

  // ====== /delete COMMAND ======
  if (lowText.startsWith("/delete")) {
    const parts = text.split(" ");
    if (parts.length >= 2) {
      const classId = parseInt(parts[1]);
      if (!isNaN(classId)) {
        const schedule = await getSchedule(userId);
        const classToDelete = schedule.find(c => c.id === classId);
        if (classToDelete) {
          const success = await deleteClass(classId, userId);
          if (success) {
            await sendMessage(userId, getTranslation(userId, "class_deleted", { subject: classToDelete.subject }), getMainKeyboard(lang));
          } else {
            await sendMessage(userId, "❌ Error deleting class", getMainKeyboard(lang));
          }
        } else {
          await sendMessage(userId, "❌ Class not found", getMainKeyboard(lang));
        }
      } else {
        await sendMessage(userId, getTranslation(userId, "delete_help"), getMainKeyboard(lang));
      }
    } else {
      await sendMessage(userId, getTranslation(userId, "delete_help"), getMainKeyboard(lang));
    }
    return;
  }

  // ====== /task COMMAND ======
  if (lowText.startsWith("/task")) {
    const match = text.match(/\/task\s+"([^"]+)"\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+(\d+)\s*(high|medium|normal)?/i);
    if (match) {
      const taskName = match[1];
      const dueDate = `${match[2]} ${match[3]}`;
      const days = parseInt(match[4]);
      const priority = match[5] || "normal";
      const success = await addTask(userId, taskName, dueDate, days, priority);
      if (success) {
        await sendMessage(userId, getTranslation(userId, "task_added", { name, task: taskName, days }), getMainKeyboard(lang));
      } else {
        await sendMessage(userId, "❌ Error adding task", getMainKeyboard(lang));
      }
    } else {
      await sendMessage(userId, getTranslation(userId, "task_format"), getMainKeyboard(lang));
    }
    return;
  }

  // ====== /remind COMMAND ======
  if (lowText.startsWith("/remind")) {
    const parts = text.split(" ");
    if (parts.length >= 2) {
      const minutes = parseInt(parts[1]);
      if (!isNaN(minutes) && minutes >= 5 && minutes <= 120) {
        await setUserReminderOffset(userId, minutes);
        await sendMessage(userId, getTranslation(userId, "reminder_set", { minutes }), getMainKeyboard(lang));
      } else {
        await sendMessage(userId, "❌ Please enter a number between 5 and 120", getMainKeyboard(lang));
      }
    } else {
      const offset = await getUserReminderOffset(userId);
      await sendMessage(userId, getTranslation(userId, "reminder_current", { offset }), getMainKeyboard(lang));
    }
    return;
  }

  // ====== /lang COMMAND ======
  if (lowText.startsWith("/lang")) {
    const parts = text.split(" ");
    if (parts.length >= 2) {
      const newLang = parts[1];
      if (newLang === "ru" || newLang === "en" || newLang === "zh") {
        await setUserLanguage(userId, newLang);
        const langName = newLang === "ru" ? "Русский" : newLang === "zh" ? "中文" : "English";
        await sendMessage(userId, getTranslation(userId, "language_changed", { language: langName }), getMainKeyboard(newLang));
      } else {
        await sendMessage(userId, getTranslation(userId, "current_language", { language: lang }), getMainKeyboard(lang));
      }
    } else {
      await sendMessage(userId, getTranslation(userId, "current_language", { language: lang }), getMainKeyboard(lang));
    }
    return;
  }

  // ====== /ics COMMAND OR ICS URL ======
  if (lowText.startsWith("/ics") || (text.includes(".ics") && (text.includes("http://") || text.includes("https://")))) {
    let url = "";
    if (lowText.startsWith("/ics")) {
      const parts = text.split(" ");
      if (parts.length >= 2) url = parts[1];
    } else {
      const urlMatch = text.match(/(https?:\/\/[^\s]+\.ics)/i);
      if (urlMatch) url = urlMatch[0];
    }
    
    if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
      await sendMessage(userId, getTranslation(userId, "import_processing"), getMainKeyboard(lang));
      const result = await importICSFromUrl(userId, url, lang);
      if (result.success && result.count > 0) {
        await sendMessage(userId, getTranslation(userId, "import_success", { count: result.count, name }), getMainKeyboard(lang));
      } else if (result.success && result.count === 0) {
        await sendMessage(userId, getTranslation(userId, "import_empty"), getMainKeyboard(lang));
      } else {
        await sendMessage(userId, getTranslation(userId, "import_fail", { name }), getMainKeyboard(lang));
      }
    } else {
      await sendMessage(userId, getTranslation(userId, "import_instructions", { name }), getMainKeyboard(lang));
    }
    return;
  }

  // ====== STUDY LOGGING ======
  const studyMatch = text.match(/(?:studied|учился|занимался|学习了)\s+(\d+)\s*(?:minutes?|min|минут|分钟)\s*(?:for|по|学习)?\s*(.+)/i);
  if (studyMatch) {
    const duration = parseInt(studyMatch[1]);
    const subject = studyMatch[2].trim();
    await addStudySession(userId, subject, duration);
    await sendMessage(userId, getTranslation(userId, "study_logged", { name, minutes: duration, subject }), getMainKeyboard(lang));
    return;
  }

  // ====== HELP ======
  if (text === "❓ Help" || text === "❓ Помощь" || text === "❓ 帮助" ||
      lowText.includes("help") || lowText.includes("помощь")) {
    await sendMessage(userId, getTranslation(userId, "help_text"), getMainKeyboard(lang));
    return;
  }

  // ====== THANKS ======
  if (lowText.includes("thanks") || lowText.includes("спасибо") || lowText.includes("谢谢")) {
    await sendMessage(userId, getTranslation(userId, "thanks", { name }), getMainKeyboard(lang));
    return;
  }

  // ====== TIME ======
  if (lowText.includes("time") || lowText.includes("время") || lowText.includes("时间")) {
    const now = new Date();
    await sendMessage(userId, getTranslation(userId, "time", { name, time: now.toLocaleTimeString() }), getMainKeyboard(lang));
    return;
  }

  // ====== JOKE ======
  if (lowText.includes("joke") || lowText.includes("шутка") || lowText.includes("笑话")) {
    const joke = getRandomItem(JOKES[lang]);
    await sendMessage(userId, getTranslation(userId, "joke", { name, joke }), getMainKeyboard(lang));
    return;
  }

  // ====== DEFAULT ======
  await sendMessage(userId, getTranslation(userId, "unknown", { name }), getMainKeyboard(lang));
}

// ====== PAYLOAD HANDLER ======
async function handlePayload(userId, payload, lang) {
  if (payload.cmd === "mark_done") {
    const taskId = payload.tid;
    const success = await completeTask(taskId, userId);
    if (success) {
      await sendMessage(userId, getTranslation(userId, "task_completed", { name: await getUserName(userId), task: "task" }), getMainKeyboard(lang));
    }
  } else if (payload.cmd === "offset_up") {
    const current = await getUserReminderOffset(userId);
    const newOffset = Math.min(current + 5, 120);
    await setUserReminderOffset(userId, newOffset);
    await sendMessage(userId, getTranslation(userId, "reminder_set", { minutes: newOffset }), getSettingsKeyboard(newOffset, lang));
  } else if (payload.cmd === "offset_down") {
    const current = await getUserReminderOffset(userId);
    const newOffset = Math.max(current - 5, 5);
    await setUserReminderOffset(userId, newOffset);
    await sendMessage(userId, getTranslation(userId, "reminder_set", { minutes: newOffset }), getSettingsKeyboard(newOffset, lang));
  }
}

// ====== WEBHOOK HANDLER ======
export async function handler(event) {
  try {
    const body = JSON.parse(event.body);

    // VK Confirmation Request
    if (body.type === "confirmation") {
      console.log("Confirmation request received");
      return {
        statusCode: 200,
        body: process.env.VK_CONFIRMATION_TOKEN || "default_confirmation"
      };
    }

    // Message Event
    if (body.type === "message_new") {
      const message = body.object.message;
      const userId = message.from_id;
      const text = message.text || "";
      const payload = message.payload ? JSON.parse(message.payload) : null;
      const attachments = message.attachments || [];

      console.log(`[${userId}] Message: "${text.substring(0, 50)}"`);

      // ====== HANDLE ICS FILE ATTACHMENT ======
      // Check for .ics file attachment
      let icsFile = null;
      for (const attachment of attachments) {
        if (attachment.type === "doc" && attachment.doc) {
          const doc = attachment.doc;
          if (doc.title && doc.title.toLowerCase().endsWith(".ics")) {
            icsFile = doc;
            break;
          }
        }
      }

      if (icsFile) {
        console.log(`[${userId}] ICS file detected: ${icsFile.title}`);
        
        // Detect language for response
        const detectedLang = detectLanguage(text);
        
        // Get or create user
        let user = await getUser(userId);
        if (!user) {
          await createUser(userId, null, detectedLang);
          user = await getUser(userId);
        }
        
        const lang = user?.language || detectedLang;
        
        // Send processing message
        await sendMessage(userId, getTranslationSync(lang, "import_processing"));
        
        // Download the ICS file from VK
        try {
          const fileUrl = icsFile.url;
          console.log(`[${userId}] Downloading ICS from: ${fileUrl}`);
          
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 30000);
          
          const response = await fetch(fileUrl, { 
            signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          clearTimeout(timeout);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          
          const buffer = await response.arrayBuffer();
          const result = await importICSFromBuffer(userId, Buffer.from(buffer), icsFile.title, lang);
          
          if (result.success && result.count > 0) {
            await sendMessage(userId, getTranslationSync(lang, "import_success", { count: result.count, name: user?.name || "" }), getMainKeyboard(lang));
          } else if (result.success && result.count === 0) {
            await sendMessage(userId, getTranslationSync(lang, "import_empty"), getMainKeyboard(lang));
          } else {
            await sendMessage(userId, getTranslationSync(lang, "import_fail", { name: user?.name || "" }), getMainKeyboard(lang));
          }
        } catch (error) {
          console.error(`[${userId}] ICS file processing error:`, error);
          await sendMessage(userId, getTranslationSync(detectedLang, "import_fail", { name: "" }), getMainKeyboard(detectedLang));
        }
        
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }

      // Detect language
      const detectedLang = detectLanguage(text);
      
      // Get or create user
      let user = await getUser(userId);
      if (!user) {
        await createUser(userId, null, detectedLang);
        user = await getUser(userId);
        await sendMessage(userId, getTranslationSync(detectedLang, "ask_name"));
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }

      const name = user.name;
      const lang = user.language;

      // First time user - ask for name
      if (!name && !text.match(/(?:my name is|call me|меня зовут|我叫)/i)) {
        await sendMessage(userId, getTranslation(userId, "ask_name"));
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }

      // Extract name
      const nameMatch = text.match(/(?:my name is|call me|меня зовут|我叫)\s+([A-Za-zА-Яа-я\u4e00-\u9fff]+)/i);
      if (nameMatch && !name) {
        const newName = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1);
        await updateUserName(userId, newName);
        await sendMessage(userId, getTranslation(userId, "got_name", { name: newName }));
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }

      // Handle payload or message
      if (payload) {
        await handlePayload(userId, payload, lang);
      } else {
        await handleMessage(userId, text, lang);
      }

      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (error) {
    console.error("Handler error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
}

// ====== REMINDER CHECKER (For cron job) ======
export async function checkReminders() {
  try {
    const now = new Date();
    let currentDay = now.getDay() - 1;
    if (currentDay < 0) currentDay = 6;
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    // Get all users with schedules
    const { data: users, error } = await supabase
      .from("users")
      .select("vk_id, reminder_offset, language, name");

    if (error || !users) return;

    for (const user of users) {
      const userId = user.vk_id;
      const offset = user.reminder_offset || 60;
      const lang = user.language || "en";
      const name = user.name || "friend";

      const { data: classes, error: classError } = await supabase
        .from("schedule")
        .select("id, subject, start_time, end_time")
        .eq("user_id", userId)
        .eq("day", currentDay);

      if (classError || !classes) continue;

      for (const cls of classes) {
        const classMinutes = parseInt(cls.start_time.split(":")[0]) * 60 + parseInt(cls.start_time.split(":")[1]);
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const minutesUntil = classMinutes - currentMinutes;

        if (minutesUntil > 0 && minutesUntil <= offset) {
          const reminderKey = `reminder_${userId}_${new Date().toDateString()}_${cls.id}`;
          const { data: existing } = await supabase
            .from("reminders")
            .select("key")
            .eq("key", reminderKey)
            .single();

          if (!existing) {
            const reminderMsg = getTranslationSync(lang, "reminder", {
              subject: cls.subject,
              time: cls.start_time,
              minutes: minutesUntil
            });
            await sendMessageAsync(userId, reminderMsg, getMainKeyboard(lang));
            await supabase.from("reminders").insert({ key: reminderKey, sent: 1 });
          }
        }
      }
    }
  } catch (error) {
    console.error("Reminder check error:", error);
  }
}
