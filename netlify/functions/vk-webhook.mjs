import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";
import crypto from "crypto";

// Initialize Supabase (replaces SQLite)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const VK_TOKEN = process.env.VK_TOKEN;
const VK_API_VERSION = "5.131";

// ========== VK API HELPERS ==========
async function callVkApi(method, params) {
  const url = new URL("https://api.vk.com/method/" + method);
  url.searchParams.append("access_token", VK_TOKEN);
  url.searchParams.append("v", VK_API_VERSION);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, JSON.stringify(value));
  });

  const response = await fetch(url.toString());
  const data = await response.json();

  if (data.error) {
    console.error("VK API Error:", data.error);
    return null;
  }
  return data.response;
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

  return callVkApi("messages.send", params);
}

// ========== KEYBOARD BUILDERS ==========
function getMainKeyboard() {
  return JSON.stringify({
    one_time: false,
    buttons: [
      [
        { action: { type: "text", label: "📅 Schedule" }, color: "primary" },
        { action: { type: "text", label: "➕ Add class" }, color: "positive" },
      ],
      [
        { action: { type: "text", label: "📝 My tasks" }, color: "secondary" },
        {
          action: { type: "text", label: "➕ Add deadline" },
          color: "positive",
        },
      ],
      [
        { action: { type: "text", label: "⚙️ Settings" }, color: "secondary" },
        { action: { type: "text", label: "❓ Help" }, color: "primary" },
      ],
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
            payload: JSON.stringify({ cmd: "complete_task", task_id: taskId }),
          },
          color: "positive",
        },
      ],
    ],
  });
}

// ========== DATABASE OPERATIONS ==========
async function getUserLanguage(userId) {
  const { data } = await supabase
    .from("users")
    .select("language")
    .eq("vk_id", userId)
    .single();
  return data?.language || "en";
}

async function setUserLanguage(userId, language) {
  await supabase
    .from("users")
    .upsert({ vk_id: userId, language }, { onConflict: "vk_id" });
}

async function getUserName(userId) {
  const { data } = await supabase
    .from("users")
    .select("name")
    .eq("vk_id", userId)
    .single();
  return data?.name || "friend";
}

async function getSchedule(userId) {
  const { data } = await supabase
    .from("schedule")
    .select("subject, day, start_time, end_time")
    .eq("user_id", userId);
  return data || [];
}

async function addSchedule(userId, subject, day, startTime, endTime) {
  return supabase.from("schedule").insert({
    user_id: userId,
    subject,
    day,
    start_time: startTime,
    end_time: endTime,
  });
}

async function getTasks(userId, onlyPending = true) {
  let query = supabase.from("tasks").select("*").eq("user_id", userId);

  if (onlyPending) {
    query = query.eq("done", false);
  }

  const { data } = await query;
  return data || [];
}

async function addTask(userId, task, dueDate, remindDays) {
  return supabase.from("tasks").insert({
    user_id: userId,
    task,
    due_date: dueDate,
    remind_days: remindDays,
    done: false,
  });
}

async function completeTask(taskId, userId) {
  return supabase
    .from("tasks")
    .update({ done: true })
    .eq("id", taskId)
    .eq("user_id", userId);
}

// ========== RESPONSE TEMPLATES ==========
const responses = {
  en: {
    greeting: "Hello {name}! 👋 How can I help you today?",
    schedule_empty:
      "Your schedule is empty. Add classes or upload an .ics file.",
    schedule_header: "📚 Your schedule:\n",
    schedule_item: "{day} {start}-{end} — {subject}\n",
    add_class_help:
      "Send command:\n/add <subject> <day(0=Mon..6=Sun)> <HH:MM> <HH:MM>\nExample: /add Math 1 10:30 12:05",
    tasks_empty: "No active tasks.",
    task_item:
      "📌 {task}\n⏰ Due: {due_date}\n🔔 Remind {remind_days} day(s) before",
    task_added: "✅ Task '{task}' saved!",
    class_added: "✅ Class '{subject}' added!",
    task_completed: "✅ Task marked as done!",
    help_text: `📖 **Available Commands:**

📅 **Schedule:**
• /add <subject> <day> <start> <end> - Add single class

📝 **Tasks:**
• /deadline <task> <date HH:MM> <days> - Add deadline
• Click "✅ Done" on tasks to complete them

⚙️ **Settings:**
• Use buttons to navigate

💡 **Tip:** You can import .ics files!`,
  },
  ru: {
    greeting: "Привет {name}! 👋 Чем я могу вам помочь?",
    schedule_empty:
      "Ваше расписание пусто. Добавьте занятия или загрузите файл .ics.",
    schedule_header: "📚 Ваше расписание:\n",
    schedule_item: "{day} {start}-{end} — {subject}\n",
    add_class_help:
      "Отправьте команду:\n/add <предмет> <день(0=Пн..6=Вс)> <ЧЧ:ММ> <ЧЧ:ММ>\nПример: /add Математика 1 10:30 12:05",
    tasks_empty: "Нет активных задач.",
    task_item:
      "📌 {task}\n⏰ Срок: {due_date}\n🔔 Напомнить за {remind_days} дн.",
    task_added: "✅ Задача '{task}' сохранена!",
    class_added: "✅ Занятие '{subject}' добавлено!",
    task_completed: "✅ Задача отмечена как выполненная!",
    help_text: `📖 **Доступные команды:**

📅 **Расписание:**
• /add <предмет> <день> <начало> <конец> - Добавить занятие

📝 **Задачи:**
• /deadline <задача> <дата ЧЧ:ММ> <дни> - Добавить срок
• Нажмите "✅ Done" чтобы отметить задачу выполненной

⚙️ **Настройки:**
• Используйте кнопки для навигации`,
  },
};

function getResponse(userId, lang, template, vars = {}) {
  const text = responses[lang]?.[template] || responses.en[template];
  let result = text;

  Object.entries(vars).forEach(([key, value]) => {
    result = result.replace(`{${key}}`, value);
  });

  return result;
}

// ========== MESSAGE HANDLER ==========
async function handleMessage(vk, userId, text, lang) {
  const name = await getUserName(userId);
  const lowText = text.toLowerCase();

  if (text === "📅 Schedule") {
    const schedule = await getSchedule(userId);
    if (schedule.length === 0) {
      await sendMessage(
        userId,
        getResponse(userId, lang, "schedule_empty"),
        getMainKeyboard(),
      );
    } else {
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      let msg = getResponse(userId, lang, "schedule_header");

      for (const { subject, day, start_time, end_time } of schedule) {
        msg += getResponse(userId, lang, "schedule_item", {
          day: days[day],
          start: start_time,
          end: end_time,
          subject: subject,
        });
      }

      await sendMessage(userId, msg, getMainKeyboard());
    }
  }

  if (text === "➕ Add class") {
    await sendMessage(
      userId,
      getResponse(userId, lang, "add_class_help"),
      getMainKeyboard(),
    );
  }

  if (text === "📝 My tasks") {
    const tasks = await getTasks(userId, true);
    if (tasks.length === 0) {
      await sendMessage(
        userId,
        getResponse(userId, lang, "tasks_empty"),
        getMainKeyboard(),
      );
    } else {
      for (const task of tasks) {
        const msg = getResponse(userId, lang, "task_item", {
          task: task.task,
          due_date: task.due_date,
          remind_days: task.remind_days,
        });
        await sendMessage(userId, msg, getDeadlineKeyboard(task.id));
      }
    }
  }

  if (text === "➕ Add deadline") {
    await sendMessage(
      userId,
      "Send: /deadline <task> <YYYY-MM-DD HH:MM> <days>\nExample: /deadline Report 2025-12-20 23:59 2",
      getMainKeyboard(),
    );
  }

  if (text === "⚙️ Settings") {
    await sendMessage(
      userId,
      "⚙️ Settings:\nUse other buttons to manage your preferences.",
      getMainKeyboard(),
    );
  }

  if (text === "❓ Help") {
    await sendMessage(
      userId,
      getResponse(userId, lang, "help_text"),
      getMainKeyboard(),
    );
  }

  if (text.startsWith("/add")) {
    const parts = text.split();
    if (parts.length === 5) {
      const [, subject, dayStr, startTime, endTime] = parts;
      const day = parseInt(dayStr);

      if (!isNaN(day) && day >= 0 && day <= 6) {
        await addSchedule(userId, subject, day, startTime, endTime);
        await sendMessage(
          userId,
          getResponse(userId, lang, "class_added", { subject }),
          getMainKeyboard(),
        );
      } else {
        await sendMessage(
          userId,
          "Day must be 0 (Mon) to 6 (Sun).",
          getMainKeyboard(),
        );
      }
    }
  }

  if (text.startsWith("/deadline")) {
    const parts = text.split(" ", 4);
    if (parts.length === 4) {
      const [, task, dueDate, remindDaysStr] = parts;
      const remindDays = parseInt(remindDaysStr);

      if (!isNaN(remindDays)) {
        await addTask(userId, task, dueDate, remindDays);
        await sendMessage(
          userId,
          getResponse(userId, lang, "task_added", { task }),
          getMainKeyboard(),
        );
      }
    }
  }

  if (
    lowText.includes("hello") ||
    lowText.includes("hi") ||
    lowText.includes("привет")
  ) {
    await sendMessage(
      userId,
      getResponse(userId, lang, "greeting", { name }),
      getMainKeyboard(),
    );
  }

  // Fallback: Send help for any unhandled message
  if (text && !text.startsWith("/")) {
    await sendMessage(
      userId,
      getResponse(userId, lang, "help_text"),
      getMainKeyboard(),
    );
  }
}

// ========== WEBHOOK HANDLER ==========
export async function handler(event) {
  const body = JSON.parse(event.body);

  // VK Confirmation Request
  if (body.type === "confirmation") {
    return {
      statusCode: 200,
      body: process.env.VK_CONFIRMATION_TOKEN || "default_token",
    };
  }

  // Message Event
  if (body.type === "message_new") {
    try {
      const message = body.object.message;
      const userId = message.from_id;
      const text = message.text || "";

      // Detect language
      const lang = text.match(/[а-яА-ЯёЁ]/) ? "ru" : "en";
      await setUserLanguage(userId, lang);

      // Handle message
      await handleMessage(null, userId, text, lang);

      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true }),
      };
    } catch (error) {
      console.error("Error handling message:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message }),
      };
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true }),
  };
}
