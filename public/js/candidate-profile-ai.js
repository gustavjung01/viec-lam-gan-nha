(() => {
  const TARGET_PATH = '/tai-khoan';
  const STORAGE_KEY = 'vieclamgannha_candidate_profile';
  const PANEL_ID = 'vlgn-candidate-profile-ai-panel';

  const isTargetPage = () => window.location.pathname === TARGET_PATH || window.location.pathname.startsWith(`${TARGET_PATH}/`);

  const getSavedProfile = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  };

  const hasUsefulProfileData = (profile) => {
    return Object.values(profile || {}).some((value) => {
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'boolean') return value === true;
      return String(value || '').trim().length > 0;
    });
  };

  const setStatus = (panel, type, message) => {
    const box = panel.querySelector('[data-ai-status]');
    if (!box) return;
    const base = 'mt-3 rounded-xl px-4 py-3 text-sm leading-6';
    const colors = {
      info: 'bg-slate-50 text-slate-600 ring-1 ring-slate-100',
      error: 'bg-red-50 text-red-700 ring-1 ring-red-100',
      success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
    };
    box.className = `${base} ${colors[type] || colors.info}`;
    box.textContent = message || '';
    box.hidden = !message;
  };

  const setResult = (panel, text) => {
    const box = panel.querySelector('[data-ai-result]');
    if (!box) return;
    box.textContent = text || '';
    box.hidden = !text;
  };

  const buildPanel = () => {
    const panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.className = 'rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-5 shadow-sm';
    panel.innerHTML = `
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div class="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">
            ✨ AI hỗ trợ ứng viên
          </div>
          <h2 class="mt-3 text-base font-bold text-slate-950">AI gợi ý hoàn thiện hồ sơ</h2>
          <p class="mt-1 text-sm leading-6 text-slate-600">
            Gợi ý chỉ hiển thị tại màn hình này, dùng để bạn biết hồ sơ còn thiếu gì và nên viết lời giới thiệu thế nào.
          </p>
          <p class="mt-1 text-xs leading-5 text-slate-500">
            Nếu vừa chỉnh hồ sơ, hãy bấm <strong>Lưu hồ sơ tạm</strong> trước rồi chạy AI để đọc đúng dữ liệu mới nhất.
          </p>
        </div>
        <button type="button" data-ai-run class="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300">
          <span data-ai-run-icon>✨</span>
          <span data-ai-run-label>AI gợi ý</span>
        </button>
      </div>
      <div data-ai-status hidden></div>
      <div data-ai-result hidden class="mt-4 whitespace-pre-line rounded-2xl bg-white p-4 text-sm leading-6 text-slate-700 shadow-sm ring-1 ring-indigo-100"></div>
      <div class="mt-3 text-xs leading-5 text-slate-500">
        AI không yêu cầu OTP, mật khẩu, số CCCD, tài khoản ngân hàng hoặc ảnh giấy tờ.
      </div>
    `;

    const button = panel.querySelector('[data-ai-run]');
    const label = panel.querySelector('[data-ai-run-label]');
    const icon = panel.querySelector('[data-ai-run-icon]');

    button?.addEventListener('click', async () => {
      const profile = getSavedProfile();
      setResult(panel, '');

      if (!hasUsefulProfileData(profile)) {
        setStatus(panel, 'error', 'Bạn cần điền và bấm Lưu hồ sơ tạm trước khi dùng AI gợi ý.');
        return;
      }

      button.disabled = true;
      if (label) label.textContent = 'Đang gợi ý...';
      if (icon) icon.textContent = '⏳';
      setStatus(panel, 'info', 'AI đang đọc hồ sơ đã lưu tạm và tạo gợi ý.');

      try {
        const response = await fetch('/api/candidates/profile/ai-suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
          throw new Error(data.message || data.error || 'Không thể tạo gợi ý hồ sơ bằng AI');
        }

        setStatus(panel, 'success', 'Đã tạo gợi ý. Nội dung này chỉ hiển thị cho bạn tại màn hình này.');
        setResult(panel, data.data?.suggestion || 'AI không trả về nội dung gợi ý.');
      } catch (error) {
        setStatus(panel, 'error', error instanceof Error ? error.message : 'Không thể tạo gợi ý hồ sơ bằng AI');
      } finally {
        button.disabled = false;
        if (label) label.textContent = 'AI gợi ý';
        if (icon) icon.textContent = '✨';
      }
    });

    return panel;
  };

  const findSaveBlock = () => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const saveButton = buttons.find((button) => (button.textContent || '').includes('Lưu hồ sơ tạm'));
    return saveButton?.closest('div.flex.flex-col.items-center.gap-3') || saveButton?.parentElement || null;
  };

  const mountPanel = () => {
    if (!isTargetPage()) return;
    if (document.getElementById(PANEL_ID)) return;

    const saveBlock = findSaveBlock();
    if (!saveBlock || !saveBlock.parentElement) return;

    const panel = buildPanel();
    saveBlock.parentElement.insertBefore(panel, saveBlock);
  };

  const observer = new MutationObserver(() => mountPanel());

  const start = () => {
    mountPanel();
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();