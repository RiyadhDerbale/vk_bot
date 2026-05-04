// ==================== COMPLETE VITA BOT - PRODUCTION READY ====================
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import crypto from "crypto";

// ==================== DATABASE CONFIGURATION & MIGRATIONS ====================
/*
-- Run these SQL migrations in Supabase:

-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  vk_id BIGINT UNIQUE NOT NULL,
  name TEXT,
  language TEXT DEFAULT 'en',
  timezone TEXT DEFAULT 'UTC',
  reminder_offset INTEGER DEFAULT 30,
  total_focus_minutes INTEGER DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  streak INTEGER DEFAULT 0,
  last_study_date DATE,
  is_premium BOOLEAN DEFAULT false,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Schedule table
CREATE TABLE schedule (
  id SERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(vk_id),
  subject TEXT NOT NULL,
  day INTEGER CHECK (day >= 0 AND day <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location TEXT,
  color TEXT DEFAULT '#4A90E2',
  recurring BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks table
CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(vk_id),
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  estimated_duration INTEGER,
  category TEXT,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Study sessions table
CREATE TABLE study_sessions (
  id SERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(vk_id),
  subject TEXT,
  planned_duration INTEGER NOT NULL,
  actual_duration INTEGER,
  type TEXT DEFAULT 'focus',
  breaks_taken INTEGER DEFAULT 0,
  productivity_score INTEGER,
  notes TEXT,
  date DATE DEFAULT CURRENT_DATE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- Achievements table
CREATE TABLE achievements (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  xp_reward INTEGER DEFAULT 50,
  category TEXT
);

-- User achievements junction table
CREATE TABLE user_achievements (
  id SERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(vk_id),
  achievement_id INTEGER REFERENCES achievements(id),
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- Study groups table
CREATE TABLE study_groups (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  creator_id BIGINT REFERENCES users(vk_id),
  max_members INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Study group members junction table
CREATE TABLE study_group_members (
  id SERIAL PRIMARY KEY,
  group_id INTEGER REFERENCES study_groups(id),
  user_id BIGINT REFERENCES users(vk_id),
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Reminders table
CREATE TABLE reminders (
  id SERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(vk_id),
  task_id INTEGER REFERENCES tasks(id),
  reminder_time TIMESTAMPTZ NOT NULL,
  is_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics cache table
CREATE TABLE analytics_cache (
  id SERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(vk_id) UNIQUE,
  data JSONB NOT NULL,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour')
);

-- Insert default achievements
INSERT INTO achievements (code, name, description, icon, xp_reward, category) VALUES
('first_task', 'First Steps', 'Complete your first task', '🌟', 100, 'beginner'),
('task_master_10', 'Task Master', 'Complete 10 tasks', '📋', 200, 'beginner'),
('task_master_50', 'Task Champion', 'Complete 50 tasks', '🏆', 500, 'intermediate'),
('streak_7', 'Week Warrior', '7-day streak', '🔥', 300, 'intermediate'),
('streak_30', 'Monthly Legend', '30-day streak', '💎', 1000, 'advanced'),
('focus_10h', 'Focused Mind', 'Study for 10 hours', '🧠', 200, 'beginner'),
('focus_100h', 'Dedication', 'Study for 100 hours', '📚', 1000, 'advanced'),
('perfect_week', 'Perfect Week', 'Complete all tasks for a week', '⭐', 500, 'intermediate'),
('early_bird', 'Early Bird', 'Start studying before 7 AM', '🌅', 150, 'beginner'),
('night_owl', 'Night Owl', 'Study after midnight', '🦉', 150, 'beginner'),
('pomodoro_master', 'Pomodoro Master', 'Complete 25+ pomodoro sessions', '🍅', 300, 'intermediate'),
('study_group', 'Team Player', 'Create or join a study group', '👥', 200, 'social'),
('analytics_pro', 'Data Driven', 'View your analytics 10 times', '📊', 200, 'intermediate'),
('premium', 'Premium User', 'Upgrade to premium', '👑', 500, 'premium');

-- Create indexes for performance
CREATE INDEX idx_schedule_user_day ON schedule(user_id, day);
CREATE INDEX idx_tasks_user_due ON tasks(user_id, due_date);
CREATE INDEX idx_study_sessions_user_date ON study_sessions(user_id, date);
CREATE INDEX idx_reminders_user_time ON reminders(user_id, reminder_time);
CREATE INDEX idx_users_vk_id ON users(vk_id);
*/

// ==================== INITIALIZATION ====================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  {
    auth: { persistSession: false },
    db: { schema: "public" },
    global: {
      headers: { "x-application": "vita-bot-v3" }
    }
  }
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ==================== ENHANCED CACHING SYSTEM ====================
class CacheSystem {
  constructor() {
    this.memory = new Map();
    this.maxSize = 2000;
    this.stats = { hits: 0, misses: 0, sets: 0, evictions: 0 };
    this.TTL = {
      user: 600000,        // 10 minutes
      classes: 120000,     // 2 minutes
      tasks: 60000,        // 1 minute
      analytics: 300000,   // 5 minutes
      ai_response: 3600000 // 1 hour
    };
    
    // Start cleanup interval
    setInterval(() => this.cleanup(), 300000); // Every 5 minutes
  }

  generateKey(...args) {
    return args.join('_');
  }

  async get(key, type = 'default') {
    const item = this.memory.get(key);
    if (!item) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() - item.timestamp > (this.TTL[type] || 300000)) {
      this.memory.delete(key);
      this.stats.misses++;
      return null;
    }

    // Promote item (for LRU)
    this.memory.delete(key);
    this.memory.set(key, { ...item, lastAccessed: Date.now() });
    
    this.stats.hits++;
    return item.data;
  }

  async set(key, data, type = 'default') {
    // Evict old items if needed
    if (this.memory.size >= this.maxSize) {
      this.evictOldest();
    }

    this.memory.set(key, {
      data,
      timestamp: Date.now(),
      type,
      lastAccessed: Date.now()
    });

    this.stats.sets++;
  }

  evictOldest() {
    let oldest = null;
    let oldestKey = null;

    for (const [key, value] of this.memory) {
      if (!oldest || value.lastAccessed < oldest) {
        oldest = value.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.memory.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  invalidate(pattern) {
    for (const key of this.memory.keys()) {
      if (key.includes(pattern)) {
        this.memory.delete(key);
      }
    }
  }

  cleanup() {
    const now = Date.now();
    for (const [key, value] of this.memory) {
      if (now - value.timestamp > (this.TTL[value.type] || 300000)) {
        this.memory.delete(key);
      }
    }
  }

  getStats() {
    return {
      ...this.stats,
      size: this.memory.size,
      hitRate: this.stats.hits > 0 
        ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2) + '%'
        : '0%'
    };
  }
}

const cache = new CacheSystem();

// ==================== RATE LIMITER ====================
class RateLimiter {
  constructor() {
    this.windows = new Map();
    this.limits = {
      message: { max: 30, window: 60000 },     // 30 messages per minute
      command: { max: 10, window: 60000 },      // 10 commands per minute
      ai: { max: 20, window: 3600000 },         // 20 AI requests per hour
      import: { max: 5, window: 3600000 }       // 5 imports per hour
    };
  }

  async checkLimit(userId, type = 'message') {
    const limit = this.limits[type];
    if (!limit) return true;

    const key = `${userId}_${type}`;
    const now = Date.now();
    
    let window = this.windows.get(key) || [];
    window = window.filter(timestamp => now - timestamp < limit.window);
    
    if (window.length >= limit.max) {
      return false;
    }
    
    window.push(now);
    this.windows.set(key, window);
    
    // Cleanup old windows
    if (this.windows.size > 10000) {
      const oldest = this.windows.keys().next().value;
      this.windows.delete(oldest);
    }
    
    return true;
  }

  getRemainingRequests(userId, type = 'message') {
    const limit = this.limits[type];
    if (!limit) return Infinity;

    const key = `${userId}_${type}`;
    const now = Date.now();
    const window = this.windows.get(key) || [];
    const active = window.filter(t => now - t < limit.window);
    
    return Math.max(0, limit.max - active.length);
  }
}

const rateLimiter = new RateLimiter();

// ==================== VK API SERVICE ====================
class VKService {
  constructor() {
    this.messageQueue = new Map();
    this.processingQueue = false;
  }

  async apiCall(method, params, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const url = new URL(`https://api.vk.com/method/${method}`);
        url.searchParams.append('v', '5.199');
        url.searchParams.append('access_token', process.env.VK_TOKEN);

        const formData = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
          formData.append(key, typeof value === 'object' ? JSON.stringify(value) : value);
        }

        const response = await fetch(url.toString(), {
          method: 'POST',
          body: formData
        });

        const data = await response.json();

        if (data.error) {
          // Handle rate limiting
          if (data.error.error_code === 9) {
            const waitTime = Math.pow(2, attempt) * 1000;
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
          
          // Handle other errors
          console.error(`VK API Error (${method}):`, data.error);
          throw new Error(data.error.error_msg);
        }

        return data.response || data;
      } catch (error) {
        if (attempt === retries) {
          console.error(`VK API call failed after ${retries} retries:`, error);
          return null;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  async sendMessage(userId, message, options = {}) {
    if (message.length > 4096) {
      // Split long messages
      const chunks = this.splitMessage(message);
      for (const chunk of chunks) {
        await this.sendSingleMessage(userId, chunk, options);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      return;
    }

    return this.sendSingleMessage(userId, message, options);
  }

  async sendSingleMessage(userId, message, options = {}) {
    const params = {
      user_id: userId,
      message: message.substring(0, 4096),
      random_id: this.generateRandomId(),
      ...options
    };

    // Add keyboard if provided
    if (options.keyboard) {
      params.keyboard = typeof options.keyboard === 'string' 
        ? options.keyboard 
        : JSON.stringify(options.keyboard);
    }

    // Add attachment
    if (options.attachment) {
      params.attachment = options.attachment;
    }

    // Add template (for carousel)
    if (options.template) {
      params.template = typeof options.template === 'string'
        ? options.template
        : JSON.stringify(options.template);
    }

    return this.apiCall('messages.send', params);
  }

  async sendTypingIndicator(userId) {
    return this.apiCall('messages.setActivity', {
      user_id: userId,
      type: 'typing'
    });
  }

  async sendSticker(userId, stickerId) {
    return this.apiCall('messages.send', {
      user_id: userId,
      sticker_id: stickerId,
      random_id: this.generateRandomId()
    });
  }

  async getKeyboard(lang = 'en', context = 'default') {
    const keyboards = {
      default: {
        one_time: false,
        inline: false,
        buttons: [
          [
            { action: { type: "text", label: "📅 Schedule" }, color: "primary" },
            { action: { type: "text", label: "📋 Today" }, color: "primary" }
          ],
          [
            { action: { type: "text", label: "📝 Tasks" }, color: "positive" },
            { action: { type: "text", label: "⏰ Next" }, color: "positive" }
          ],
          [
            { action: { type: "text", label: "⏱️ Focus" }, color: "negative" },
            { action: { type: "text", label: "📊 Stats" }, color: "secondary" }
          ],
          [
            { action: { type: "text", label: "🧠 AI Help" }, color: "primary" },
            { action: { type: "text", label: "⚙️ Settings" }, color: "secondary" }
          ]
        ]
      },
      
      tasks: {
        one_time: false,
        buttons: [
          [
            { action: { type: "text", label: "➕ Add Task" }, color: "primary" }
          ],
          [
            { action: { type: "text", label: "✅ Complete" }, color: "positive" },
            { action: { type: "text", label: "🗑️ Delete" }, color: "negative" }
          ],
          [
            { action: { type: "text", label: "📅 Sort by Date" }, color: "secondary" },
            { action: { type: "text", label: "🔴 Sort by Priority" }, color: "secondary" }
          ],
          [
            { action: { type: "text", label: "↩️ Back" }, color: "secondary" }
          ]
        ]
      },

      // Add more keyboard layouts...
    };

    return keyboards[context] || keyboards.default;
  }

  async sendCarousel(userId, elements) {
    const template = {
      type: "carousel",
      elements: elements.map(el => ({
        title: (el.title || "").substring(0, 80),
        description: (el.description || "").substring(0, 80),
        photo_id: el.photoId || null,
        buttons: (el.buttons || []).map(btn => ({
          action: {
            type: btn.type || "text",
            label: (btn.label || "").substring(0, 40),
            payload: btn.payload ? JSON.stringify(btn.payload) : undefined
          }
        })),
        action: el.action ? {
          type: "open_link",
          link: el.action.link
        } : undefined
      }))
    };

    return this.sendMessage(userId, "", { template });
  }

  splitMessage(text, maxLength = 4000) {
    const chunks = [];
    while (text.length > maxLength) {
      let splitAt = text.lastIndexOf('\n', maxLength);
      if (splitAt === -1 || splitAt < maxLength / 2) {
        splitAt = text.lastIndexOf(' ', maxLength);
      }
      if (splitAt === -1 || splitAt < maxLength / 2) {
        splitAt = maxLength;
      }
      
      chunks.push(text.substring(0, splitAt).trim());
      text = text.substring(splitAt).trim();
    }
    
    if (text) chunks.push(text);
    return chunks;
  }

  generateRandomId() {
    return Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000000);
  }
}

const vk = new VKService();

// ==================== LANGUAGE SYSTEM ====================
class LanguageManager {
  constructor() {
    this.translations = {
      en: {
        // Welcome & Setup
        welcome_new: "🎉 *Welcome to Vita AI!*\n\nI'm your advanced study companion powered by artificial intelligence.\n\n✨ *What I can do:*\n• Manage your schedule with NLP\n• Track tasks and deadlines\n• Pomodoro focus timer\n• AI-powered study tips\n• Productivity analytics\n• Study groups\n\nWhat's your name?",
        welcome_back: "👋 Welcome back, {name}! Ready to be productive?\n\n📅 Today's classes: {classes_today}\n📝 Pending tasks: {tasks_pending}\n🔥 Streak: {streak} days",
        
        // Main Features
        schedule_title: "📅 *Your Schedule*\n\n",
        schedule_empty: "📭 Your schedule is empty!\n\nAdd classes using:\n/add Subject Day Time\n\nOr attach an .ics file!",
        class_format: "  {time} • {subject}{location}\n",
        today_title: "📋 *Today's Schedule* ({date})\n\n",
        today_empty: "🎉 No classes today! Enjoy your free time!\n\nTip: Use this time for focused study!",
        tasks_title: "📝 *Your Tasks*\n\n",
        tasks_empty: "✅ All clear! No pending tasks!\n\nGreat job staying on top of things! 🎉",
        
        // Focus Mode
        focus_start: "⏱️ *Focus Mode Activated!*\n\nSubject: {subject}\nDuration: {duration}min\n\nStay focused! I'll notify you when done.",
        focus_complete: "🎉 *Focus Session Complete!*\n\nSubject: {subject}\nDuration: {duration}min\n\nGreat work! Take a 5-minute break.",
        focus_stop: "⏹️ *Focus Session Stopped*\n\nSubject: {subject}\nCompleted: {elapsed}min\n\nDon't give up! Try again later.",
        
        // Analytics
        stats_title: "📊 *Your Analytics*\n\n",
        stats_line: "📚 Classes: {classes}\n✅ Tasks: {completed}/{total}\n⏱️ Focus: {focus}h\n🔥 Streak: {streak} days\n⭐ Level: {level} ({xp} XP)",
        
        // Achievements
        achievement_unlock: "🏆 *Achievement Unlocked!*\n\n{name}\n{description}\n\n+{xp} XP",
        
        // Errors
        error_general: "❌ Something went wrong. Please try again.",
        rate_limit: "⏳ You're going too fast! Please wait a moment.",
        
        // Time & Dates
        weekdays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
        
        // Commands Help
        help: `🤖 *Vita AI Commands*

📅 *Schedule:*
/add - Add class
/delete_class - Remove class
/schedule - View full schedule
/today - Today's classes
/tomorrow - Tomorrow's classes

📝 *Tasks:*
/task - Add task
/tasks - View tasks
/complete - Complete task
/delete_task - Remove task

⏱️ *Focus:*
/focus - Start focus timer
/stop - Stop timer
/pomodoro - Pomodoro mode

📊 *Analytics:*
/stats - Your statistics
/analytics - Detailed analytics
/weekly - Weekly report

🧠 *AI Features:*
/ai - Ask AI for help
/optimize - Optimize schedule
/tips - Get study tips

👥 *Social:*
/group_create - Create study group
/group_join - Join group

⚙️ *Settings:*
/settings - View settings
/language - Change language
/timezone - Set timezone

Type any command to get started!`
      },
      
      ru: {
        welcome_new: "🎉 *Добро пожаловать в Vita AI!*\n\nЯ ваш продвинутый помощник по учебе с искусственным интеллектом.\n\n✨ *Что я умею:*\n• Управление расписанием\n• Отслеживание задач\n• Таймер фокусировки\n• AI-советы по учебе\n• Аналитика продуктивности\n• Учебные группы\n\nКак вас зовут?",
        welcome_back: "👋 С возвращением, {name}! Готовы быть продуктивным?\n\n📅 Сегодня пар: {classes_today}\n📝 Задач: {tasks_pending}\n🔥 Серия: {streak} дней",
        schedule_title: "📅 *Ваше расписание*\n\n",
        schedule_empty: "📭 Ваше расписание пусто!\n\nДобавьте занятия командой:\n/add Предмет День Время\n\nИли прикрепите .ics файл!",
        class_format: "  {time} • {subject}{location}\n",
        today_title: "📋 *Расписание на сегодня* ({date})\n\n",
        today_empty: "🎉 Сегодня нет пар! Наслаждайтесь свободным временем!\n\nСовет: Используйте это время для учебы!",
        tasks_title: "📝 *Ваши задачи*\n\n",
        tasks_empty: "✅ Всё чисто! Нет невыполненных задач!\n\nОтличная работа! 🎉",
        focus_start: "⏱️ *Режим фокусировки активирован!*\n\nПредмет: {subject}\nДлительность: {duration}мин\n\nСосредоточьтесь! Я сообщу, когда закончите.",
        focus_complete: "🎉 *Сессия фокусировки завершена!*\n\nПредмет: {subject}\nДлительность: {duration}мин\n\nОтличная работа! Сделайте 5-минутный перерыв.",
        stats_title: "📊 *Ваша аналитика*\n\n",
        stats_line: "📚 Пары: {classes}\n✅ Задачи: {completed}/{total}\n⏱️ Фокус: {focus}ч\n🔥 Серия: {streak} дней\n⭐ Уровень: {level} ({xp} XP)",
        achievement_unlock: "🏆 *Достижение разблокировано!*\n\n{name}\n{description}\n\n+{xp} XP",
        error_general: "❌ Что-то пошло не так. Попробуйте еще раз.",
        rate_limit: "⏳ Вы слишком быстры! Пожалуйста, подождите.",
        weekdays: ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"],
        months: ["Января", "Февраля", "Марта", "Апреля", "Мая", "Июня", "Июля", "Августа", "Сентября", "Октября", "Ноября", "Декабря"],
        help: `🤖 *Команды Vita AI*

📅 *Расписание:*
/add - Добавить пару
/delete_class - Удалить пару
/schedule - Полное расписание
/today - Пары сегодня
/tomorrow - Пары завтра

📝 *Задачи:*
/task - Добавить задачу
/tasks - Список задач
/complete - Выполнить задачу
/delete_task - Удалить задачу

⏱️ *Фокус:*
/focus - Начать фокусировку
/stop - Остановить
/pomodoro - Режим Pomodoro

📊 *Аналитика:*
/stats - Статистика
/analytics - Подробная аналитика
/weekly - Недельный отчет

🧠 *AI функции:*
/ai - Спросить AI
/optimize - Оптимизировать расписание
/tips - Советы по учебе

👥 *Социальное:*
/group_create - Создать группу
/group_join - Присоединиться к группе

⚙️ *Настройки:*
/settings - Настройки
/language - Язык
/timezone - Часовой пояс

Введите любую команду для начала!`
      }
    };
  }

  get(key, lang = 'en', params = {}) {
    let text = this.translations[lang]?.[key] || this.translations.en[key] || key;
    
    for (const [param, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`{${param}}`, 'g'), value);
    }
    
    return text;
  }

  detectLanguage(text) {
    if (!text) return 'en';
    
    const patterns = {
      ru: /[а-яё]/i,
      zh: /[\u4e00-\u9fff]/,
      ja: /[\u3040-\u309f\u30a0-\u30ff]/,
      ko: /[\uac00-\ud7af]/
    };

    for (const [lang, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) return lang;
    }

    return 'en';
  }
}

const lang = new LanguageManager();

// ==================== DATABASE SERVICE ====================
class DatabaseService {
  async getUser(userId) {
    const cacheKey = cache.generateKey('user', userId);
    const cached = await cache.get(cacheKey, 'user');
    if (cached) return cached;

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('vk_id', userId)
      .single();

    if (error || !data) {
      // Create new user
      const { data: newUser } = await supabase
        .from('users')
        .insert({
          vk_id: userId,
          language: 'en',
          timezone: 'UTC',
          preferences: {}
        })
        .select()
        .single();

      if (newUser) {
        await cache.set(cacheKey, newUser, 'user');
        return newUser;
      }
      return null;
    }

    await cache.set(cacheKey, data, 'user');
    return data;
  }

  async updateUser(userId, updates) {
    const { error } = await supabase
      .from('users')
      .update({ ...updates, updated_at: new Date() })
      .eq('vk_id', userId);

    if (!error) {
      cache.invalidate(`user_${userId}`);
    }

    return !error;
  }

  async getClasses(userId) {
    const cacheKey = cache.generateKey('classes', userId);
    const cached = await cache.get(cacheKey, 'classes');
    if (cached) return cached;

    const { data } = await supabase
      .from('schedule')
      .select('*')
      .eq('user_id', userId)
      .order('day')
      .order('start_time');

    const classes = data || [];
    await cache.set(cacheKey, classes, 'classes');
    return classes;
  }

  async addClass(userId, classData) {
    const { error } = await supabase
      .from('schedule')
      .insert({
        user_id: userId,
        ...classData
      });

    if (!error) {
      cache.invalidate(`classes_${userId}`);
      return true;
    }
    return false;
  }

  async deleteClass(userId, classId) {
    const { error } = await supabase
      .from('schedule')
      .delete()
      .eq('id', classId)
      .eq('user_id', userId);

    if (!error) {
      cache.invalidate(`classes_${userId}`);
      return true;
    }
    return false;
  }

  async getTasks(userId, filter = {}) {
    const cacheKey = cache.generateKey('tasks', userId, JSON.stringify(filter));
    const cached = await cache.get(cacheKey, 'tasks');
    if (cached) return cached;

    let query = supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId);

    if (filter.completed !== undefined) {
      query = query.eq('completed', filter.completed);
    }

    if (filter.priority) {
      query = query.eq('priority', filter.priority);
    }

    query = query.order('due_date').order('priority');

    const { data } = await query;
    const tasks = data || [];
    await cache.set(cacheKey, tasks, 'tasks');
    return tasks;
  }

  async addTask(userId, taskData) {
    const { error } = await supabase
      .from('tasks')
      .insert({
        user_id: userId,
        ...taskData
      });

    if (!error) {
      cache.invalidate(`tasks_${userId}`);
      return true;
    }
    return false;
  }

  async completeTask(userId, taskId) {
    const { error } = await supabase
      .from('tasks')
      .update({
        completed: true,
        completed_at: new Date()
      })
      .eq('id', taskId)
      .eq('user_id', userId);

    if (!error) {
      cache.invalidate(`tasks_${userId}`);
      
      // Update user stats
      await this.updateUser(userId, {
        tasks_completed: supabase.raw('tasks_completed + 1')
      });

      // Check achievements
      const { count } = await supabase
        .from('tasks')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .eq('completed', true);

      if (count === 1) {
        await this.unlockAchievement(userId, 'first_task');
      } else if (count === 10) {
        await this.unlockAchievement(userId, 'task_master_10');
      } else if (count === 50) {
        await this.unlockAchievement(userId, 'task_master_50');
      }

      return true;
    }
    return false;
  }

  async deleteTask(userId, taskId) {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)
      .eq('user_id', userId);

    if (!error) {
      cache.invalidate(`tasks_${userId}`);
      return true;
    }
    return false;
  }

  async logStudySession(userId, sessionData) {
    const { error } = await supabase
      .from('study_sessions')
      .insert({
        user_id: userId,
        ...sessionData
      });

    if (!error) {
      // Update user focus time
      const { data: user } = await supabase
        .from('users')
        .select('total_focus_minutes')
        .eq('vk_id', userId)
        .single();

      const newTotal = (user?.total_focus_minutes || 0) + (sessionData.actual_duration || sessionData.planned_duration);
      
      await this.updateUser(userId, {
        total_focus_minutes: newTotal,
        last_study_date: new Date().toISOString().split('T')[0]
      });

      // Check focus achievements
      const totalHours = newTotal / 60;
      if (totalHours >= 10) {
        await this.unlockAchievement(userId, 'focus_10h');
      }
      if (totalHours >= 100) {
        await this.unlockAchievement(userId, 'focus_100h');
      }

      // Update streak
      await this.updateStreak(userId);

      cache.invalidate(`analytics_${userId}`);
      return true;
    }
    return false;
  }

  async updateStreak(userId) {
    const { data: sessions } = await supabase
      .from('study_sessions')
      .select('date')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (!sessions || sessions.length === 0) return;

    let streak = 1;
    const today = new Date().toISOString().split('T')[0];
    let currentDate = new Date(today);

    for (const session of sessions) {
      const sessionDate = new Date(session.date);
      const diffDays = Math.floor((currentDate - sessionDate) / (1000 * 60 * 60 * 24));

      if (diffDays <= 1) {
        if (diffDays === 1) {
          streak++;
          currentDate = sessionDate;
        }
      } else {
        break;
      }
    }

    await this.updateUser(userId, { streak });

    // Check streak achievements
    if (streak === 7) await this.unlockAchievement(userId, 'streak_7');
    if (streak === 30) await this.unlockAchievement(userId, 'streak_30');
  }

  async unlockAchievement(userId, achievementCode) {
    // Check if already unlocked
    const { data: existing } = await supabase
      .from('user_achievements')
      .select('id')
      .eq('user_id', userId)
      .eq('achievement_id', supabase.raw(`(SELECT id FROM achievements WHERE code = '${achievementCode}')`))
      .single();

    if (existing) return null;

    // Get achievement details
    const { data: achievement } = await supabase
      .from('achievements')
      .select('*')
      .eq('code', achievementCode)
      .single();

    if (!achievement) return null;

    // Unlock achievement
    const { error } = await supabase
      .from('user_achievements')
      .insert({
        user_id: userId,
        achievement_id: achievement.id
      });

    if (!error) {
      // Award XP
      const { data: user } = await supabase
        .from('users')
        .select('xp, level')
        .eq('vk_id', userId)
        .single();

      const newXP = (user?.xp || 0) + (achievement.xp_reward || 50);
      const newLevel = Math.floor(newXP / 1000) + 1;

      await this.updateUser(userId, {
        xp: newXP,
        level: newLevel
      });

      cache.invalidate(`user_${userId}`);
      return achievement;
    }

    return null;
  }

  async getAchievements(userId) {
    const { data } = await supabase
      .from('user_achievements')
      .select(`
        unlocked_at,
        achievement:achievements(*)
      `)
      .eq('user_id', userId);

    return data || [];
  }

  async getAnalytics(userId) {
    const cacheKey = cache.generateKey('analytics', userId);
    const cached = await cache.get(cacheKey, 'analytics');
    if (cached) return cached;

    // Check analytics cache table first
    const { data: cachedAnalytics } = await supabase
      .from('analytics_cache')
      .select('data')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (cachedAnalytics?.data) {
      await cache.set(cacheKey, cachedAnalytics.data, 'analytics');
      return cachedAnalytics.data;
    }

    // Calculate fresh analytics
    const [
      { count: totalClasses },
      { count: totalTasks },
      { count: completedTasks },
      { data: focusData }
    ] = await Promise.all([
      supabase.from('schedule').select('id', { count: 'exact' }).eq('user_id', userId),
      supabase.from('tasks').select('id', { count: 'exact' }).eq('user_id', userId),
      supabase.from('tasks').select('id', { count: 'exact' }).eq('user_id', userId).eq('completed', true),
      supabase.from('study_sessions').select('planned_duration, actual_duration').eq('user_id', userId)
    ]);

    const totalFocusMinutes = (focusData || []).reduce((sum, s) => sum + (s.actual_duration || s.planned_duration), 0);
    const user = await this.getUser(userId);

    const analytics = {
      total_classes: totalClasses || 0,
      total_tasks: totalTasks || 0,
      completed_tasks: completedTasks || 0,
      total_focus_hours: (totalFocusMinutes / 60).toFixed(1),
      total_focus_minutes: totalFocusMinutes,
      streak: user?.streak || 0,
      level: user?.level || 1,
      xp: user?.xp || 0,
      tasks_completed: user?.tasks_completed || 0,
      completion_rate: totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0
    };

    // Cache analytics
    await supabase.from('analytics_cache').upsert({
      user_id: userId,
      data: analytics,
      expires_at: new Date(Date.now() + 3600000).toISOString()
    });

    await cache.set(cacheKey, analytics, 'analytics');
    return analytics;
  }

  async createStudyGroup(userId, name, maxMembers = 10) {
    const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    
    const { data: group, error } = await supabase
      .from('study_groups')
      .insert({
        name,
        creator_id: userId,
        invite_code: inviteCode,
        max_members: maxMembers
      })
      .select()
      .single();

    if (!error && group) {
      // Add creator as member
      await supabase
        .from('study_group_members')
        .insert({
          group_id: group.id,
          user_id: userId,
          role: 'admin'
        });

      await this.unlockAchievement(userId, 'study_group');
      return { ...group, invite_code: inviteCode };
    }

    return null;
  }

  async joinStudyGroup(userId, inviteCode) {
    const { data: group } = await supabase
      .from('study_groups')
      .select('*')
      .eq('invite_code', inviteCode)
      .eq('is_active', true)
      .single();

    if (!group) return { error: 'not_found' };

    // Check if already a member
    const { data: existingMember } = await supabase
      .from('study_group_members')
      .select('id')
      .eq('group_id', group.id)
      .eq('user_id', userId)
      .single();

    if (existingMember) return { error: 'already_member' };

    // Check if group is full
    const { count } = await supabase
      .from('study_group_members')
      .select('id', { count: 'exact' })
      .eq('group_id', group.id);

    if (count >= group.max_members) return { error: 'full' };

    // Join group
    const { error } = await supabase
      .from('study_group_members')
      .insert({
        group_id: group.id,
        user_id: userId
      });

    if (!error) {
      await this.unlockAchievement(userId, 'study_group');
      return { success: true, group };
    }

    return { error: 'join_failed' };
  }
}

const db = new DatabaseService();

// ==================== FOCUS TIMER SERVICE ====================
class FocusTimer {
  constructor() {
    this.activeTimers = new Map();
    this.pomodoroSessions = new Map();
  }

  startFocus(userId, subject, duration, type = 'focus') {
    // Stop any existing timer
    this.stopFocus(userId);

    const timer = {
      userId,
      subject,
      duration,
      type,
      startTime: Date.now(),
      endTime: Date.now() + (duration * 60 * 1000),
      paused: false,
      breaks: [],
      pomodoroCycles: 0
    };

    // Set timeout for auto-completion
    timer.completionTimeout = setTimeout(async () => {
      await this.completeFocus(userId);
    }, duration * 60 * 1000);

    this.activeTimers.set(userId, timer);

    if (type === 'pomodoro') {
      this.startPomodoro(userId, duration);
    }

    return timer;
  }

  startPomodoro(userId, totalDuration) {
    const cycles = Math.floor(totalDuration / 25);
    let currentCycle = 0;

    const pomodoroInterval = setInterval(async () => {
      const timer = this.activeTimers.get(userId);
      if (!timer || timer.paused) return;

      currentCycle++;
      
      if (currentCycle % 4 === 0) {
        // Long break after 4 cycles
        await vk.sendMessage(userId, "🍅 *Long Break!*\n\nYou've completed 4 pomodoros. Take a 15-minute break.\n\nGreat focus! 🌟");
        timer.breaks.push({ type: 'long', duration: 15, time: Date.now() });
      } else {
        // Short break
        await vk.sendMessage(userId, "🍅 *Short Break*\n\n5-minute break. Stand up and stretch!\n\nCycle: {currentCycle}/{totalCycles}".replace('{currentCycle}', currentCycle));
        timer.breaks.push({ type: 'short', duration: 5, time: Date.now() });
      }

      timer.pomodoroCycles = currentCycle;

      if (currentCycle >= cycles) {
        clearInterval(pomodoroInterval);
        this.pomodoroSessions.delete(userId);
      }
    }, 25 * 60 * 1000); // 25 minutes per pomodoro

    this.pomodoroSessions.set(userId, pomodoroInterval);
  }

  async completeFocus(userId) {
    const timer = this.activeTimers.get(userId);
    if (!timer) return null;

    // Clear timers
    if (timer.completionTimeout) clearTimeout(timer.completionTimeout);
    if (this.pomodoroSessions.has(userId)) {
      clearInterval(this.pomodoroSessions.get(userId));
      this.pomodoroSessions.delete(userId);
    }

    const actualDuration = Math.round((Date.now() - timer.startTime) / 60000);
    this.activeTimers.delete(userId);

    // Log session
    await db.logStudySession(userId, {
      subject: timer.subject,
      planned_duration: timer.duration,
      actual_duration: actualDuration,
      type: timer.type,
      breaks_taken: timer.breaks.length,
      started_at: new Date(timer.startTime).toISOString(),
      ended_at: new Date().toISOString()
    });

    if (timer.type === 'pomodoro' && timer.pomodoroCycles >= 4) {
      await db.unlockAchievement(userId, 'pomodoro_master');
    }

    return { ...timer, actualDuration };
  }

  stopFocus(userId) {
    const timer = this.activeTimers.get(userId);
    if (!timer) return null;

    if (timer.completionTimeout) clearTimeout(timer.completionTimeout);
    if (this.pomodoroSessions.has(userId)) {
      clearInterval(this.pomodoroSessions.get(userId));
      this.pomodoroSessions.delete(userId);
    }

    const elapsed = Math.round((Date.now() - timer.startTime) / 60000);
    this.activeTimers.delete(userId);

    // Log partial session
    db.logStudySession(userId, {
      subject: timer.subject,
      planned_duration: timer.duration,
      actual_duration: elapsed,
      type: timer.type,
      breaks_taken: timer.breaks.length,
      started_at: new Date(timer.startTime).toISOString(),
      ended_at: new Date().toISOString()
    }).catch(console.error);

    return { ...timer, elapsed };
  }

  getActiveTimer(userId) {
    return this.activeTimers.get(userId) || null;
  }

  pauseFocus(userId) {
    const timer = this.activeTimers.get(userId);
    if (timer && !timer.paused) {
      timer.paused = true;
      if (timer.completionTimeout) clearTimeout(timer.completionTimeout);
      return true;
    }
    return false;
  }

  resumeFocus(userId) {
    const timer = this.activeTimers.get(userId);
    if (timer && timer.paused) {
      timer.paused = false;
      const remaining = timer.endTime - Date.now();
      if (remaining > 0) {
        timer.completionTimeout = setTimeout(async () => {
          await this.completeFocus(userId);
        }, remaining);
      }
      return true;
    }
    return false;
  }
}

const focusTimer = new FocusTimer();

// ==================== AI SERVICE ====================
class AIService {
  async generateResponse(prompt, options = {}) {
    try {
      const completion = await openai.chat.completions.create({
        model: options.model || "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: options.systemPrompt || "You are Vita, an intelligent study assistant. Help students with productivity, scheduling, and study tips. Be encouraging and practical."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: options.maxTokens || 500,
        temperature: options.temperature || 0.7
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error("AI generation error:", error);
      return null;
    }
  }

  async analyzeSchedule(userId) {
    const classes = await db.getClasses(userId);
    const tasks = await db.getTasks(userId, { completed: false });

    if (classes.length === 0 && tasks.length === 0) {
      return "You don't have any classes or tasks yet. Add some first!";
    }

    const prompt = `Analyze this student's schedule and tasks. Provide optimization suggestions and productivity tips.

Classes: ${JSON.stringify(classes)}
Pending Tasks: ${JSON.stringify(tasks)}

Provide:
1. Schedule optimization suggestions
2. Best study times based on gaps
3. Task prioritization advice
4. Potential time conflicts
5. Overall efficiency score (1-10)`;

    return this.generateResponse(prompt, {
      maxTokens: 800,
      temperature: 0.5
    });
  }

  async generateStudyPlan(userId, duration) {
    const classes = await db.getClasses(userId);
    const tasks = await db.getTasks(userId, { completed: false });

    const prompt = `Create a detailed study plan for the next ${duration || 24} hours based on:

Classes: ${JSON.stringify(classes)}
Tasks: ${JSON.stringify(tasks)}

Include:
1. Time blocks for each task/study session
2. Break recommendations
3. Priority order
4. Estimated completion times
5. Motivational tips`;

    return this.generateResponse(prompt, {
      maxTokens: 1000,
      temperature: 0.6
    });
  }

  async smartReply(userMessage, context = {}) {
    const prompt = `User message: "${userMessage}"

Context: ${JSON.stringify(context)}

You are Vita, a helpful study assistant. Respond naturally and helpfully. Keep responses under 4000 characters.`;

    return this.generateResponse(prompt, {
      maxTokens: 600,
      temperature: 0.8
    });
  }

  async parseNaturalLanguage(text, intent) {
    const prompt = `Extract information from this text: "${text}"
    
Intent: ${intent}

For task creation extract: title, due_date (YYYY-MM-DD), priority (low/medium/high/urgent), estimated_duration (minutes)
For class creation extract: subject, day (0-6, 0=Monday), start_time (HH:MM), end_time (HH:MM), location
For focus session extract: subject, duration (minutes)

Return valid JSON only.`;

    const response = await this.generateResponse(prompt, {
      maxTokens: 200,
      temperature: 0.1
    });

    try {
      return response ? JSON.parse(response) : null;
    } catch {
      return null;
    }
  }
}

const ai = new AIService();

// ==================== BOT COMMAND HANDLER ====================
class BotHandler {
  constructor() {
    this.conversationStates = new Map();
  }

  async processMessage(userId, text, attachments = []) {
    // Rate limiting check
    if (!await rateLimiter.checkLimit(userId, 'message')) {
      await vk.sendMessage(userId, lang.get('rate_limit', 'en'));
      return;
    }

    // Send typing indicator
    await vk.sendTypingIndicator(userId);

    const user = await db.getUser(userId);
    const userLang = user?.language || lang.detectLanguage(text);

    // Handle conversations in progress
    const state = this.conversationStates.get(userId);
    if (state) {
      return this.handleConversationState(userId, text, state, userLang);
    }

    // Handle attachments
    if (attachments.length > 0) {
      return this.handleAttachments(userId, attachments, userLang);
    }

    // Parse command
    const command = this.parseCommand(text);
    if (command) {
      return this.executeCommand(userId, command, text, user, userLang);
    }

    // Default interaction
    return this.defaultInteraction(userId, text, user, userLang);
  }

  parseCommand(text) {
    const lower = text.toLowerCase().trim();
    
    // Direct commands
    if (lower.startsWith('/')) {
      const parts = lower.split(/\s+/);
      return parts[0].substring(1);
    }

    // Natural language commands
    const nlpCommands = {
      'help': ['help', 'помощь', '帮助', 'hilfe', 'aide'],
      'schedule': ['schedule', 'timetable', 'расписание', '课程表'],
      'today': ['today', 'сегодня', '今天'],
      'tomorrow': ['tomorrow', 'завтра', '明天'],
      'tasks': ['tasks', 'homework', 'задачи', '任务'],
      'stats': ['stats', 'statistics', 'статистика', '统计'],
      'analytics': ['analytics', 'аналитика', '分析'],
      'focus': ['focus', 'study', 'помодоро', '学习'],
      'ai': ['ai', 'assistant', 'помощник', '助手'],
      'settings': ['settings', 'настройки', '设置'],
      'achievements': ['achievements', 'достижения', '成就']
    };

    for (const [command, triggers] of Object.entries(nlpCommands)) {
      if (triggers.some(trigger => lower.includes(trigger))) {
        return command;
      }
    }

    return null;
  }

  async executeCommand(userId, command, text, user, lang) {
    // Rate limiting for commands
    if (!await rateLimiter.checkLimit(userId, 'command')) {
      await vk.sendMessage(userId, lang.get('rate_limit', lang));
      return;
    }

    switch (command) {
      case 'help':
        return this.showHelp(userId, lang);
      
      case 'schedule':
        return this.showSchedule(userId, lang);
      
      case 'today':
        return this.showToday(userId, lang);
      
      case 'tomorrow':
        return this.showTomorrow(userId, lang);
      
      case 'tasks':
        return this.showTasks(userId, lang);
      
      case 'stats':
        return this.showStats(userId, lang);
      
      case 'analytics':
        return this.showAnalytics(userId, lang);
      
      case 'focus':
        return this.startFocus(userId, text, lang);
      
      case 'stop':
        return this.stopFocus(userId, lang);
      
      case 'add':
        return this.addClass(userId, text, lang);
      
      case 'task':
        return this.addTask(userId, text, lang);
      
      case 'complete':
        return this.completeTask(userId, text, lang);
      
      case 'delete':
        return this.deleteItem(userId, text, lang);
      
      case 'ai':
        return this.aiAssistant(userId, text, lang);
      
      case 'optimize':
        return this.optimizeSchedule(userId, lang);
      
      case 'achievements':
        return this.showAchievements(userId, lang);
      
      case 'group_create':
        return this.createStudyGroup(userId, text, lang);
      
      case 'group_join':
        return this.joinStudyGroup(userId, text, lang);
      
      case 'settings':
        return this.showSettings(userId, lang);
      
      case 'language':
        return this.changeLanguage(userId, text, lang);
      
      default:
        return this.defaultInteraction(userId, text, user, lang);
    }
  }

  async showHelp(userId, lang) {
    await vk.sendMessage(userId, lang.get('help', lang), {
      keyboard: await vk.getKeyboard(lang, 'default')
    });
  }

  async showSchedule(userId, userLang) {
    const classes = await db.getClasses(userId);
    
    if (classes.length === 0) {
      await vk.sendMessage(userId, userLang.get('schedule_empty', userLang));
      return;
    }

    // Group by day
    const byDay = {};
    for (const cls of classes) {
      if (!byDay[cls.day]) byDay[cls.day] = [];
      byDay[cls.day].push(cls);
    }

    let message = userLang.get('schedule_title', userLang);
    const weekdays = userLang.get('weekdays', userLang);

    for (let day = 0; day < 7; day++) {
      if (byDay[day]) {
        message += `\n📌 *${weekdays[day]}*\n`;
        for (const cls of byDay[day]) {
          message += userLang.get('class_format', userLang, {
            time: `${cls.start_time}-${cls.end_time}`,
            subject: cls.subject,
            location: cls.location ? ` (${cls.location})` : ''
          });
        }
      }
    }

    await vk.sendMessage(userId, message);
  }

  async showToday(userId, userLang) {
    const now = new Date();
    const today = now.getDay();
    const dayIndex = today === 0 ? 6 : today - 1;
    
    const classes = await db.getClasses(userId);
    const todayClasses = classes.filter(c => c.day === dayIndex);

    const weekdays = userLang.get('weekdays');
    const months = userLang.get('months');
    const dateStr = `${weekdays[dayIndex]}, ${now.getDate()} ${months[now.getMonth()]}`;

    if (todayClasses.length === 0) {
      await vk.sendMessage(userId, userLang.get('today_empty', userLang));
      return;
    }

    let message = userLang.get('today_title', userLang, { date: dateStr });
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    for (const cls of todayClasses) {
      const status = cls.start_time <= currentTime && cls.end_time >= currentTime ? '🟢 NOW' : 
                     cls.start_time > currentTime ? '⏳ Upcoming' : '✅ Done';
      message += `${status} ` + userLang.get('class_format', userLang, {
        time: `${cls.start_time}-${cls.end_time}`,
        subject: cls.subject,
        location: cls.location ? ` (${cls.location})` : ''
      });
    }

    await vk.sendMessage(userId, message);
  }

  async showTasks(userId, userLang) {
    const tasks = await db.getTasks(userId, { completed: false });

    if (tasks.length === 0) {
      await vk.sendMessage(userId, userLang.get('tasks_empty', userLang));
      return;
    }

    let message = userLang.get('tasks_title', userLang);
    
    // Sort by priority then due date
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    tasks.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(a.due_date) - new Date(b.due_date);
    });

    const priorityEmojis = {
      urgent: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢'
    };

    for (const task of tasks.slice(0, 15)) {
      const emoji = priorityEmojis[task.priority] || '⚪';
      const dueDate = new Date(task.due_date);
      const daysLeft = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));
      const dueStr = daysLeft === 0 ? 'Today' : 
                     daysLeft === 1 ? 'Tomorrow' : 
                     daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue!` :
                     `${daysLeft}d left`;

      message += `${emoji} #${task.id} *${task.title}*\n   📅 ${task.due_date} (${dueStr})\n`;
      if (task.estimated_duration) {
        message += `   ⏱️ ~${task.estimated_duration}min\n`;
      }
      message += '\n';
    }

    if (tasks.length > 15) {
      message += `\n... and ${tasks.length - 15} more tasks`;
    }

    await vk.sendMessage(userId, message, {
      keyboard: await vk.getKeyboard(userLang, 'tasks')
    });
  }

  async showStats(userId, userLang) {
    const analytics = await db.getAnalytics(userId);
    
    let message = userLang.get('stats_title', userLang);
    message += userLang.get('stats_line', userLang, {
      classes: analytics.total_classes,
      completed: analytics.completed_tasks,
      total: analytics.total_tasks,
      focus: analytics.total_focus_hours,
      streak: analytics.streak,
      level: analytics.level,
      xp: analytics.xp
    });

    // Progress bar to next level
    const xpInLevel = analytics.xp % 1000;
    const progressBars = Math.floor(xpInLevel / 100);
    message += `\n\nLevel Progress: ${'█'.repeat(progressBars)}${'░'.repeat(10 - progressBars)} ${xpInLevel}/1000 XP`;

    await vk.sendMessage(userId, message);
  }

  async showAnalytics(userId, userLang) {
    const analytics = await db.getAnalytics(userId);
    const achievements = await db.getAchievements(userId);

    let message = `📊 *Detailed Analytics*\n\n`;
    message += `📚 Total Classes: ${analytics.total_classes}\n`;
    message += `✅ Tasks Completed: ${analytics.completed_tasks}/${analytics.total_tasks}`;
    
    if (analytics.total_tasks > 0) {
      message += ` (${analytics.completion_rate}%)`;
    }
    
    message += `\n⏱️ Total Focus Time: ${analytics.total_focus_hours}h`;
    message += `\n🔥 Current Streak: ${analytics.streak} days`;
    message += `\n⭐ Level: ${analytics.level} (${analytics.xp} XP)`;
    message += `\n🏆 Achievements: ${achievements.length} unlocked\n`;

    // Recent activity
    message += `\n🎯 *Productivity Score:* `;
    const scoreBase = analytics.completion_rate ? parseFloat(analytics.completion_rate) : 0;
    const streakBonus = Math.min(analytics.streak * 2, 20);
    const focusBonus = Math.min(analytics.total_focus_minutes / 60, 20);
    const totalScore = Math.min(Math.round(scoreBase * 0.6 + streakBonus + focusBonus), 100);
    
    message += `${totalScore}/100\n`;
    message += `${'█'.repeat(Math.floor(totalScore / 10))}${'░'.repeat(10 - Math.floor(totalScore / 10))}`;

    await vk.sendMessage(userId, message);
  }

  async startFocus(userId, text, userLang) {
    // Check if timer already running
    const existing = focusTimer.getActiveTimer(userId);
    if (existing) {
      await vk.sendMessage(userId, 
        `⏱️ Already in focus mode!\n${existing.subject} - ${existing.duration}min\nType /stop to end.`
      );
      return;
    }

    // Parse focus command
    const parts = text.split(/\s+/);
    let subject = 'Study';
    let duration = 25;
    let type = 'focus';

    if (parts.length >= 2) {
      // Check if pomodoro
      if (parts[1].toLowerCase() === 'pomodoro' || parts[1].toLowerCase() === 'помодоро') {
        type = 'pomodoro';
        subject = parts[2] || 'Study';
        duration = parseInt(parts[3]) || 25;
      } else {
        subject = parts[1];
        duration = parseInt(parts[2]) || 25;
      }
    }

    // Validate duration
    if (duration < 5) duration = 5;
    if (duration > 180) duration = 180;

    const timer = focusTimer.startFocus(userId, subject, duration, type);
    
    await vk.sendMessage(userId, userLang.get('focus_start', userLang, {
      subject, duration
    }), {
      keyboard: {
        one_time: true,
        buttons: [
          [
            { action: { type: "text", label: "⏸️ Pause" }, color: "primary" },
            { action: { type: "text", label: "⏹️ Stop" }, color: "negative" }
          ],
          [
            { action: { type: "text", label: "✅ Complete Early" }, color: "positive" }
          ]
        ]
      }
    });
  }

  async stopFocus(userId, userLang) {
    const timer = focusTimer.stopFocus(userId);
    
    if (timer) {
      await vk.sendMessage(userId, userLang.get('focus_stop', userLang, {
        subject: timer.subject,
        elapsed: timer.elapsed || 0
      }));
    } else {
      await vk.sendMessage(userId, "No active focus session to stop.");
    }
  }

  async addClass(userId, text, userLang) {
    // Try AI-powered parsing
    const aiParsed = await ai.parseNaturalLanguage(text, 'class');
    
    if (aiParsed && aiParsed.subject && aiParsed.day !== undefined && aiParsed.start_time) {
      const success = await db.addClass(userId, aiParsed);
      if (success) {
        await vk.sendMessage(userId, `✅ Added: ${aiParsed.subject}\n${userLang.get('weekdays')[aiParsed.day]} ${aiParsed.start_time}-${aiParsed.end_time || ''}`);
        return;
      }
    }

    // Manual parsing
    const parts = text.split(/\s+/);
    if (parts.length < 4) {
      await vk.sendMessage(userId, 
        "Format: /add Subject Day StartTime EndTime [Location]\n\n" +
        "Example: /add Math 0 09:00 10:30 Room 101\n" +
        "Days: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun\n\n" +
        "Or just type naturally: 'Add Math class on Monday at 9am'"
      );
      return;
    }

    const subject = parts[1];
    const day = parseInt(parts[2]);
    const startTime = parts[3];
    const endTime = parts[4] || parts[3].split(':')[0] + ':' + (parseInt(parts[3].split(':')[1] || 0) + 60).toString().padStart(2, '0');
    const location = parts.slice(5).join(' ');

    if (isNaN(day) || day < 0 || day > 6) {
      await vk.sendMessage(userId, "Invalid day. Use 0-6 (0=Monday)");
      return;
    }

    const success = await db.addClass(userId, {
      subject,
      day,
      start_time: startTime,
      end_time: endTime,
      location: location || null
    });

    if (success) {
      await vk.sendMessage(userId, `✅ Class added: ${subject}\n${userLang.get('weekdays')[day]} ${startTime}-${endTime}${location ? ' (' + location + ')' : ''}`);
    } else {
      await vk.sendMessage(userId, userLang.get('error_general', userLang));
    }
  }

  async addTask(userId, text, userLang) {
    // Try AI parsing
    const aiParsed = await ai.parseNaturalLanguage(text, 'task');
    
    if (aiParsed && aiParsed.title && aiParsed.due_date) {
      const success = await db.addTask(userId, aiParsed);
      if (success) {
        await vk.sendMessage(userId, `✅ Task added: "${aiParsed.title}"\nDue: ${aiParsed.due_date}\nPriority: ${aiParsed.priority || 'medium'}`);
        
        // Check for first task achievement
        const tasks = await db.getTasks(userId);
        if (tasks.length === 1) {
          const achievement = await db.unlockAchievement(userId, 'first_task');
          if (achievement) {
            await vk.sendMessage(userId, userLang.get('achievement_unlock', userLang, {
              name: achievement.name,
              description: achievement.description,
              xp: achievement.xp_reward
            }));
          }
        }
        return;
      }
    }

    // Manual format
    await vk.sendMessage(userId, 
      "📝 *Add Task*\n\n" +
      "Format: /task \"Title\" YYYY-MM-DD [priority] [duration]\n\n" +
      "Example: /task \"Finish math homework\" 2024-12-25 high 60\n\n" +
      "Priority: low, medium, high, urgent\n" +
      "Duration: estimated minutes to complete\n\n" +
      "Or just type naturally: 'I need to finish my math homework by Friday'"
    );
  }

  async completeTask(userId, text, userLang) {
    const parts = text.split(/\s+/);
    const taskId = parseInt(parts[1]);

    if (isNaN(taskId)) {
      await vk.sendMessage(userId, "Usage: /complete [task_id]\nFind IDs in your task list with /tasks");
      return;
    }

    const success = await db.completeTask(userId, taskId);
    
    if (success) {
      await vk.sendMessage(userId, `✅ Task #${taskId} completed! Great job! 🎉`);
      
      // Random motivational message
      const messages = [
        "Keep up the great work! 💪",
        "One step closer to your goals! 🎯",
        "Productivity level: 100! 📈",
        "You're on fire! 🔥"
      ];
      const randomMsg = messages[Math.floor(Math.random() * messages.length)];
      
      setTimeout(async () => {
        await vk.sendMessage(userId, randomMsg);
      }, 1000);
    } else {
      await vk.sendMessage(userId, `❌ Task #${taskId} not found or already completed.`);
    }
  }

  async deleteItem(userId, text, userLang) {
    const parts = text.split(/\s+/);
    
    if (parts[0].toLowerCase() === '/delete_class' || parts[1]?.toLowerCase() === 'class') {
      const classId = parseInt(parts[2] || parts[1]);
      if (isNaN(classId)) {
        await vk.sendMessage(userId, "Usage: /delete class [id]");
        return;
      }
      const success = await db.deleteClass(userId, classId);
      await vk.sendMessage(userId, success ? `✅ Class #${classId} deleted.` : "❌ Class not found.");
    } else {
      const taskId = parseInt(parts[1]);
      if (isNaN(taskId)) {
        await vk.sendMessage(userId, "Usage: /delete [task_id] or /delete class [class_id]");
        return;
      }
      const success = await db.deleteTask(userId, taskId);
      await vk.sendMessage(userId, success ? `✅ Task #${taskId} deleted.` : "❌ Task not found.");
    }
  }

  async aiAssistant(userId, text, userLang) {
    if (!await rateLimiter.checkLimit(userId, 'ai')) {
      await vk.sendMessage(userId, "⏳ AI assistant limit reached. Please try again in a few minutes.");
      return;
    }

    const question = text.split(/\s+/).slice(1).join(' ') || text;
    
    if (question.length < 3) {
      await vk.sendMessage(userId, 
        "🧠 *Vita AI Assistant*\n\n" +
        "Ask me anything about:\n" +
        "• Schedule optimization\n" +
        "• Study techniques\n" +
        "• Task management\n" +
        "• Productivity tips\n" +
        "• Time management\n\n" +
        "Or use:\n" +
        "/optimize - Get schedule optimization\n" +
        "/tips - Get study tips"
      );
      return;
    }

    await vk.sendTypingIndicator(userId);
    
    const context = {
      user: await db.getUser(userId),
      analytics: await db.getAnalytics(userId)
    };

    const response = await ai.smartReply(question, context);
    
    if (response) {
      await vk.sendMessage(userId, response);
    } else {
      await vk.sendMessage(userId, "I couldn't process your request. Please try again.");
    }
  }

  async optimizeSchedule(userId, userLang) {
    if (!await rateLimiter.checkLimit(userId, 'ai')) {
      await vk.sendMessage(userId, "Please wait before requesting another optimization.");
      return;
    }

    await vk.sendMessage(userId, "🧠 Analyzing your schedule...");
    await vk.sendTypingIndicator(userId);

    const analysis = await ai.analyzeSchedule(userId);
    
    if (analysis) {
      await vk.sendMessage(userId, analysis);
    } else {
      await vk.sendMessage(userId, "Unable to analyze schedule. Add some classes first!");
    }
  }

  async showAchievements(userId, userLang) {
    const achievements = await db.getAchievements(userId);
    const allAchievements = await supabase
      .from('achievements')
      .select('*');

    let message = "🏆 *Your Achievements*\n\n";
    
    if (achievements.length === 0) {
      message += "No achievements yet. Start using Vita to earn them!\n\n";
    } else {
      for (const ua of achievements) {
        message += `✅ *${ua.achievement.name}*\n   ${ua.achievement.description}\n   Unlocked: ${new Date(ua.unlocked_at).toLocaleDateString()}\n\n`;
      }
    }

    // Show next achievements to earn
    message += "🎯 *Next Achievements to Earn:*\n";
    const earnedIds = achievements.map(a => a.achievement.id);
    const nextAchievements = (allAchievements.data || [])
      .filter(a => !earnedIds.includes(a.id))
      .slice(0, 3);

    for (const achievement of nextAchievements) {
      message += `🔒 ${achievement.name} - ${achievement.description}\n`;
    }

    await vk.sendMessage(userId, message);
  }

  async createStudyGroup(userId, text, userLang) {
    const parts = text.split(/\s+/);
    const name = parts.slice(1).join(' ') || "Study Group";
    
    const group = await db.createStudyGroup(userId, name);
    
    if (group) {
      await vk.sendMessage(userId, 
        `👥 *Study Group Created!*\n\n` +
        `Name: ${group.name}\n` +
        `Invite Code: *${group.invite_code}*\n\n` +
        `Share this code with friends to join!\n` +
        `They can use: /group_join ${group.invite_code}`
      );
    } else {
      await vk.sendMessage(userId, "Failed to create group. Please try again.");
    }
  }

  async joinStudyGroup(userId, text, userLang) {
    const parts = text.split(/\s+/);
    const code = parts[1];

    if (!code) {
      await vk.sendMessage(userId, "Usage: /group_join [invite_code]\nAsk a friend for their group's invite code!");
      return;
    }

    const result = await db.joinStudyGroup(userId, code);
    
    if (result.error === 'not_found') {
      await vk.sendMessage(userId, "❌ Group not found. Check the invite code.");
    } else if (result.error === 'already_member') {
      await vk.sendMessage(userId, "You're already a member of this group!");
    } else if (result.error === 'full') {
      await vk.sendMessage(userId, "❌ This group is full!");
    } else if (result.success) {
      await vk.sendMessage(userId, `✅ Joined *${result.group.name}*!\n\nHappy studying together! 🎓`);
    } else {
      await vk.sendMessage(userId, "Failed to join group. Please try again.");
    }
  }

  async showSettings(userId, userLang) {
    const user = await db.getUser(userId);
    
    const message = `⚙️ *Settings*\n\n` +
      `Language: ${user.language || 'en'}\n` +
      `Timezone: ${user.timezone || 'UTC'}\n` +
      `Premium: ${user.is_premium ? '✅ Yes' : '❌ No'}\n` +
      `Level: ${user.level}\n` +
      `XP: ${user.xp}\n\n` +
      `Commands:\n` +
      `/language [en|ru] - Change language\n` +
      `/timezone [timezone] - Set timezone`;
    
    await vk.sendMessage(userId, message);
  }

  async changeLanguage(userId, text, userLang) {
    const parts = text.split(/\s+/);
    const newLang = parts[1]?.toLowerCase();

    const supportedLanguages = ['en', 'ru'];
    
    if (!newLang || !supportedLanguages.includes(newLang)) {
      await vk.sendMessage(userId, `Supported languages: ${supportedLanguages.join(', ')}\nUsage: /language [code]`);
      return;
    }

    await db.updateUser(userId, { language: newLang });
    await vk.sendMessage(userId, `✅ Language changed to ${newLang}!`);
  }

  async defaultInteraction(userId, text, user, userLang) {
    if (!user?.name) {
      // New user onboarding
      this.conversationStates.set(userId, { state: 'awaiting_name' });
      await vk.sendMessage(userId, userLang.get('welcome_new', userLang));
      return;
    }

    // Welcome back message with stats
    const analytics = await db.getAnalytics(userId);
    const tasks = await db.getTasks(userId, { completed: false });
    const now = new Date();
    const today = now.getDay();
    const dayIndex = today === 0 ? 6 : today - 1;
    const classes = await db.getClasses(userId);
    const todayClasses = classes.filter(c => c.day === dayIndex);

    await vk.sendMessage(userId, userLang.get('welcome_back', userLang, {
      name: user.name,
      classes_today: todayClasses.length,
      tasks_pending: tasks.length,
      streak: analytics.streak || 0
    }), {
      keyboard: await vk.getKeyboard(userLang, 'default')
    });
  }

  async handleConversationState(userId, text, state, userLang) {
    if (state.state === 'awaiting_name') {
      const name = text.trim();
      if (name.length > 0 && name.length < 100) {
        await db.updateUser(userId, { name });
        this.conversationStates.delete(userId);
        await vk.sendMessage(userId, 
          `✨ Nice to meet you, ${name}!\n\n` +
          `I'm Vita, your AI study companion. Let me show you around:\n\n` +
          `📅 *Schedule* - View your classes\n` +
          `📝 *Tasks* - Manage assignments\n` +
          `⏱️ *Focus* - Start study sessions\n` +
          `📊 *Stats* - Track progress\n\n` +
          `Type *Help* anytime to see all commands!`,
          { keyboard: await vk.getKeyboard(userLang, 'default') }
        );
      } else {
        await vk.sendMessage(userId, "Please enter a valid name.");
      }
    }
  }

  async handleAttachments(userId, attachments, userLang) {
    for (const attachment of attachments) {
      if (attachment.type === 'doc') {
        const doc = attachment.doc;
        if (doc.title?.endsWith('.ics') || doc.ext === 'ics') {
          // Handle ICS import
          await vk.sendMessage(userId, "📥 Importing calendar file...");
          
          try {
            const response = await fetch(doc.url);
            const icsContent = await response.text();
            
            // Parse ICS
            const events = this.parseICS(icsContent);
            
            // Import classes
            let imported = 0;
            let duplicates = 0;
            
            for (const event of events) {
              const dateInfo = this.parseICSDate(event.DTSTART, event.DTEND);
              if (!dateInfo) continue;
              
              // Check for duplicates
              const existingClasses = await db.getClasses(userId);
              const isDuplicate = existingClasses.some(c => 
                c.subject === event.SUMMARY &&
                c.day === dateInfo.day &&
                c.start_time === dateInfo.start_time
              );
              
              if (isDuplicate) {
                duplicates++;
                continue;
              }
              
              await db.addClass(userId, {
                subject: event.SUMMARY,
                day: dateInfo.day,
                start_time: dateInfo.start_time,
                end_time: dateInfo.end_time,
                location: event.LOCATION || null
              });
              
              imported++;
            }
            
            await vk.sendMessage(userId, 
              `✅ Import complete!\n` +
              `📚 Imported: ${imported} classes\n` +
              `🔄 Duplicates skipped: ${duplicates}\n` +
              `📅 Total events: ${events.length}`
            );
          } catch (error) {
            await vk.sendMessage(userId, `❌ Import failed: ${error.message}`);
          }
          
          return;
        }
      }
    }
    
    await vk.sendMessage(userId, "I can only process .ics calendar files for now.");
  }

  parseICS(icsContent) {
    const events = [];
    const eventRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
    
    let match;
    while ((match = eventRegex.exec(icsContent)) !== null) {
      const event = {};
      const lines = match[1].split('\n');
      
      for (const line of lines) {
        if (line.startsWith('SUMMARY:')) {
          event.SUMMARY = line.substring(8).trim();
        } else if (line.startsWith('DTSTART')) {
          event.DTSTART = line.split(':')[1].trim();
        } else if (line.startsWith('DTEND')) {
          event.DTEND = line.split(':')[1].trim();
        } else if (line.startsWith('LOCATION:')) {
          event.LOCATION = line.substring(9).trim();
        }
      }
      
      if (event.SUMMARY && event.DTSTART) {
        events.push(event);
      }
    }
    
    return events;
  }

  parseICSDate(dtstart, dtend) {
    try {
      // Format: 20240101T090000
      const year = parseInt(dtstart.substring(0, 4));
      const month = parseInt(dtstart.substring(4, 6)) - 1;
      const day = parseInt(dtstart.substring(6, 8));
      const hour = parseInt(dtstart.substring(9, 11) || '0');
      const minute = parseInt(dtstart.substring(11, 13) || '0');
      
      const date = new Date(year, month, day, hour, minute);
      const dayOfWeek = date.getDay();
      const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

      let endHour = hour + 1;
      let endMinute = minute;
      
      if (dtend) {
        endHour = parseInt(dtend.substring(9, 11) || (hour + 1).toString());
        endMinute = parseInt(dtend.substring(11, 13) || '0');
      }
      
      return {
        day: dayIndex,
        start_time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
        end_time: `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`
      };
    } catch {
      return null;
    }
  }
}

// ==================== WEBHOOK HANDLER ====================
const bot = new BotHandler();

export async function handler(event) {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    // Handle OPTIONS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true })
      };
    }

    const body = JSON.parse(event.body);

    // Confirm server for VK Callback API
    if (body.type === 'confirmation') {
      return {
        statusCode: 200,
        headers,
        body: process.env.VK_CONFIRMATION_TOKEN || ''
      };
    }

    // Handle new messages
    if (body.type === 'message_new') {
      const msg = body.object?.message;
      
      if (!msg || msg.out === 1) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ ok: true })
        };
      }

      const userId = msg.from_id;
      const text = msg.text || '';
      const attachments = msg.attachments || [];

      // Process message asynchronously
      bot.processMessage(userId, text, attachments).catch(console.error);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true })
    };

  } catch (error) {
    console.error("Webhook error:", error);
    
    return {
      statusCode: 200, // Always return 200 to VK
      headers,
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
}

// ==================== HEALTH CHECK ENDPOINT ====================
export async function healthCheck(event) {
  const stats = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '3.0.0',
    features: [
      'NLP Commands',
      'AI Assistant (GPT-4)',
      'Pomodoro Timer',
      'Achievement System',
      'Study Groups',
      'Analytics Engine',
      'Multi-language (EN, RU)',
      'ICS Calendar Import',
      'Smart Reminders',
      'Productivity Scoring',
      'Rate Limiting',
      'Distributed Caching'
    ],
    metrics: {
      cache: cache.getStats(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    }
  };

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(stats)
  };
}