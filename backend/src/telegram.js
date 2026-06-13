import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const TELEGRAM_CONFIG_PATH = path.join(__dirname, '..', 'data', 'telegram-config.json');

// Helper to read Telegram settings
export function readTelegramSettings() {
  try {
    if (!fs.existsSync(TELEGRAM_CONFIG_PATH)) {
      return { botToken: '', defaultChannel: '', notifyOnApplication: true, notifyOnLead: true };
    }
    const data = fs.readFileSync(TELEGRAM_CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(data);
    // Backfill defaults cho config cũ
    return {
      notifyOnApplication: true,
      notifyOnLead: true,
      ...parsed,
    };
  } catch (error) {
    console.error('Error reading Telegram settings:', error);
    return { botToken: '', defaultChannel: '', notifyOnApplication: true, notifyOnLead: true };
  }
}

// Helper to write Telegram settings
export function writeTelegramSettings(settings) {
  try {
    // Backfill defaults: nếu admin gửi thiếu flag thì giữ true
    const toWrite = {
      botToken: settings.botToken || '',
      defaultChannel: settings.defaultChannel || '',
      notifyOnApplication: settings.notifyOnApplication !== false,
      notifyOnLead: settings.notifyOnLead !== false,
    };
    fs.writeFileSync(TELEGRAM_CONFIG_PATH, JSON.stringify(toWrite, null, 2), 'utf8');
    // Re-initialize bot with new token
    initTelegramBot();
    return true;
  } catch (error) {
    console.error('Error writing Telegram settings:', error);
    throw error;
  }
}

// Get effective config (JSON overrides .env)
function getEffectiveConfig() {
  const settings = readTelegramSettings();
  return {
    botToken: settings.botToken || process.env.TELEGRAM_BOT_TOKEN,
    defaultChannel: settings.defaultChannel || process.env.TELEGRAM_DEFAULT_CHANNEL || '@vieclamgannha',
    notifyOnApplication: settings.notifyOnApplication !== false,
    notifyOnLead: settings.notifyOnLead !== false,
  };
}

// Company to channel mapping from env
const companyChannels = {};
Object.keys(process.env).forEach(key => {
  if (key.startsWith('CTY')) {
    companyChannels[key] = process.env[key];
  }
});

let bot = null;
let currentBotToken = null;

export function initTelegramBot() {
  const config = getEffectiveConfig();
  
  if (!config.botToken) {
    console.warn('⚠️ Telegram Bot Token not set (neither in .env nor admin config), notifications disabled');
    bot = null;
    currentBotToken = null;
    return null;
  }
  
  // Don't re-initialize if token hasn't changed and bot exists
  if (bot && currentBotToken === config.botToken) {
    return bot;
  }
  
  try {
    bot = new TelegramBot(config.botToken, { polling: false });
    currentBotToken = config.botToken;
    console.log('✅ Telegram bot initialized');
    return bot;
  } catch (error) {
    console.error('❌ Failed to initialize Telegram bot:', error.message);
    bot = null;
    currentBotToken = null;
    return null;
  }
}

export function getChannelForCompany(companyCode) {
  const config = getEffectiveConfig();
  return companyChannels[companyCode] || config.defaultChannel;
}

export async function sendApplicationToTelegram(application) {
  const config = getEffectiveConfig();

  // Check flag notifyOnApplication
  if (config.notifyOnApplication === false) {
    return {
      sent: false,
      skipped: true,
      error: 'NOTIFY_DISABLED',
      reason: 'Thông báo đơn ứng tuyển đang tắt trong cấu hình',
    };
  }

  // Check if Telegram is configured
  if (!config.botToken) {
    return {
      sent: false,
      skipped: true,
      error: 'TELEGRAM_NOT_CONFIGURED',
      reason: 'Telegram Bot Token not set'
    };
  }
  
  // Lazy init if needed
  if (!bot) initTelegramBot();
  
  if (!bot) {
    return {
      sent: false,
      skipped: false,
      error: 'BOT_INIT_FAILED',
      reason: 'Telegram bot failed to initialize'
    };
  }
  
  const channel = getChannelForCompany(application.companyCode);
  
  // Check if channel is configured
  if (!channel || channel === '@vieclamgannha') {
    const hasCompanyChannel = companyChannels[application.companyCode];
    if (!hasCompanyChannel && !config.defaultChannel) {
      return {
        sent: false,
        skipped: true,
        error: 'TELEGRAM_NOT_CONFIGURED',
        reason: `No channel configured for ${application.companyCode}`
      };
    }
  }
  
  const message = formatApplicationMessage(application);
  
  try {
    await bot.sendMessage(channel, message, { parse_mode: 'HTML' });
    console.log(`✅ Telegram sent to ${channel} for ${application.companyCode}`);
    return { sent: true, skipped: false, channel };
  } catch (error) {
    console.error(`❌ Telegram failed for ${channel}:`, error.message);
    return { sent: false, skipped: false, error: error.message, channel };
  }
}

function formatApplicationMessage(app) {
  const timestamp = new Date().toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false
  });
  
  let message = `🎯 <b>ĐƠN ỨNG TUYỂN MỚI</b>\n`;
  message += `⏰ ${timestamp}\n\n`;
  
  message += `📋 <b>Thông tin ứng viên:</b>\n`;
  message += `👤 Họ tên: <b>${escapeHtml(app.fullName)}</b>\n`;
  message += `📱 SĐT: <code>${app.phone}</code>\n`;
  message += `📍 Khu vực: ${escapeHtml(app.area)}\n`;
  
  if (app.note) {
    message += `📝 Ghi chú: ${escapeHtml(app.note)}\n`;
  }
  
  message += `\n💼 <b>Thông tin công việc:</b>\n`;
  message += `🏢 Mã công ty: <code>${app.companyCode}</code>\n`;
  message += `🎯 Mã mục tiêu: <code>${app.targetCode}</code>\n`;
  
  if (app.jobTitle) {
    message += `📌 Vị trí: ${escapeHtml(app.jobTitle)}\n`;
  }
  
  if (app.jobSlug) {
    message += `🔗 Link: /viec-lam/${app.jobSlug}\n`;
  }
  
  message += `\n<i>Phân phối tự động theo mã ${app.companyCode}</i>`;
  
  return message;
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function sendWebSupportLeadNotification(leadInfo) {
  const config = getEffectiveConfig();

  // Check flag notifyOnLead
  if (config.notifyOnLead === false) {
    return { sent: false, skipped: true, error: 'NOTIFY_LEAD_DISABLED' };
  }

  if (!config.botToken) return { sent: false, error: 'TELEGRAM_NOT_CONFIGURED' };

  if (!bot) initTelegramBot();
  if (!bot) return { sent: false, error: 'TELEGRAM_INIT_FAILED' };
  
  const channel = config.defaultChannel;
  
  const timestamp = new Date().toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false
  });
  
  let message = `🔔 <b>CHATBOT BẮT ĐƯỢC LEAD MỚI</b>\n`;
  message += `⏰ ${timestamp}\n\n`;
  
  message += `👤 <b>Thông tin (từ bot):</b>\n`;
  if (leadInfo.phone) message += `📱 Số điện thoại: <code>${leadInfo.phone}</code>\n`;
  message += `📝 Nội dung: ${escapeHtml(leadInfo.message)}\n`;
  message += `🆔 Session: <code>${leadInfo.sessionId}</code>\n`;
  
  try {
    await bot.sendMessage(channel, message, { parse_mode: 'HTML' });
    console.log(`✅ Web Support Lead Telegram sent to ${channel}`);
    return { sent: true };
  } catch (error) {
    console.error(`❌ Web Support Lead Telegram failed:`, error.message);
    return { sent: false, error: error.message };
  }
}

export { bot, companyChannels };
