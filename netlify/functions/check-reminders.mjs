import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const VK_TOKEN = process.env.VK_TOKEN;
const VK_API_VERSION = "5.131";
const TIMEZONE_OFFSET = 6; // For Asia/Novosibirsk

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

async function sendMessage(userId, text) {
  return callVkApi("messages.send", {
    user_id: userId,
    message: text,
    random_id: Math.floor(Math.random() * 2147483647),
  });
}

export async function handler(event) {
  try {
    const now = new Date();
    const currentDay = now.getDay();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    console.log(
      `Checking reminders at ${currentHour}:${currentMinute} on day ${currentDay}`,
    );

    // Get all users with schedules
    const { data: users } = await supabase
      .from("schedule")
      .select("DISTINCT user_id");

    if (!users || users.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "No users found" }),
      };
    }

    let remindersSent = 0;

    // Check class reminders (60 minutes before)
    for (const { user_id } of users) {
      const { data: classes } = await supabase
        .from("schedule")
        .select("id, subject, start_time")
        .eq("user_id", user_id)
        .eq("day", currentDay);

      for (const classItem of classes || []) {
        const [classHour, classMinute] = classItem.start_time
          .split(":")
          .map(Number);
        const minutesUntilClass =
          (classHour - currentHour) * 60 + (classMinute - currentMinute);

        // Send reminder 60-90 minutes before
        if (minutesUntilClass >= 60 && minutesUntilClass <= 90) {
          const lang = await getUserLanguage(user_id);
          const reminderMsg =
            lang === "ru"
              ? `🔔 Напоминание: "${classItem.subject}" начинается в ${classItem.start_time}`
              : `🔔 Reminder: "${classItem.subject}" starts at ${classItem.start_time}`;

          await sendMessage(user_id, reminderMsg);
          remindersSent++;

          // Mark reminder as sent
          await supabase.from("reminders").insert({
            user_id,
            type: "class",
            reference_id: classItem.id,
            sent_at: new Date().toISOString(),
          });
        }
      }
    }

    // Check deadline reminders
    const { data: tasks } = await supabase
      .from("tasks")
      .select("*")
      .eq("done", false);

    for (const task of tasks || []) {
      const dueDate = new Date(task.due_date);
      const today = new Date();
      const daysUntilDue = Math.floor(
        (dueDate - today) / (1000 * 60 * 60 * 24),
      );

      if (daysUntilDue === task.remind_days) {
        const lang = await getUserLanguage(task.user_id);
        const reminderMsg =
          lang === "ru"
            ? `⚠️ Срок "${task.task}" наступает через ${task.remind_days} дн. (${task.due_date})`
            : `⚠️ Deadline for "${task.task}" is in ${task.remind_days} days (${task.due_date})`;

        await sendMessage(task.user_id, reminderMsg);
        remindersSent++;

        // Mark reminder as sent
        await supabase.from("reminders").insert({
          user_id: task.user_id,
          type: "deadline",
          reference_id: task.id,
          sent_at: new Date().toISOString(),
        });
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Checked reminders, sent ${remindersSent}`,
      }),
    };
  } catch (error) {
    console.error("Reminder check error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

async function getUserLanguage(userId) {
  const { data } = await supabase
    .from("users")
    .select("language")
    .eq("vk_id", userId)
    .single();
  return data?.language || "en";
}
