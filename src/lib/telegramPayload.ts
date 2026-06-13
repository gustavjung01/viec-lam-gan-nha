import type { QuickApplyForm } from './types';

export function buildTelegramMessage(form: QuickApplyForm) {
  return [
    'HỒ SƠ ỨNG TUYỂN MỚI',
    `Họ tên: ${form.fullName}`,
    `Số điện thoại: ${form.phone}`,
    `Khu vực: ${form.area}`,
    `Mã công ty: ${form.companyCode || 'CHƯA_CÓ'}`,
    `Mã mục tiêu: ${form.targetCode || 'CHƯA_CÓ'}`,
    `Ghi chú: ${form.note || 'Không có'}`,
  ].join('\n');
}

// Đây chỉ là khung minh họa cho dev.
// Backend thật cần giữ TELEGRAM_BOT_TOKEN trong .env server, không để lộ ở frontend.
export async function sendQuickApplyMock(form: QuickApplyForm) {
  console.info('Mock gửi Telegram:', buildTelegramMessage(form));
  return { ok: true };
}
