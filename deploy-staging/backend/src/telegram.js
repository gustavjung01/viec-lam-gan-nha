import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DEFAULT_CHANNEL = process.env.TELEGRAM_DEFAULT_CHANNEL || '@vieclamgannha';

// Company to channel mapping from env
const companyChannels = {};
Object.keys(process.env).forEach(key => {
  if (key.startsWith('CTY')) {
    companyChannels[key] = process.env[key];
  }
});

let bot = null;

export function initTelegramBot() {
  if (!BOT_TOKEN) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN not set, Telegram notifications disabled');
    return null;
  }
  
  try {
    bot = new TelegramBot(BOT_TOKEN, { polling: false });
    console.log('✅ Telegram bot initialized');
    return bot;
  } catch (error) {
    console.error('❌ Failed to initialize Telegram bot:', error.message);
    return null;
  }
}

export function getChannelForCompany(companyCode) {
  return companyChannels[companyCode] || DEFAULT_CHANNEL;
}

export async function sendApplicationToTelegram(application) {
  // Check if Telegram is configured
  if (!BOT_TOKEN) {
    return {
      sent: false,
      skipped: true,
      error: 'TELEGRAM_NOT_CONFIGURED',
      reason: 'TELEGRAM_BOT_TOKEN not set'
    };
  }
  
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
    if (!hasCompanyChannel && !process.env.TELEGRAM_DEFAULT_CHANNEL) {
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

export { bot, companyChannels };
