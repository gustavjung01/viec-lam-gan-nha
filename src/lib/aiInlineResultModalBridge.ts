const MODAL_ROOT_ID = 'vlgn-ai-inline-result-modal-root';
const observedInlineResults = new WeakMap<HTMLElement, string>();

type ModalAction = {
  label: string;
  text: string;
  variant?: 'primary' | 'secondary';
};

function ensureModalRoot() {
  let root = document.getElementById(MODAL_ROOT_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = MODAL_ROOT_ID;
    document.body.appendChild(root);
  }
  return root;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function copyText(value: string) {
  const text = String(value || '').trim();
  if (!text) return;
  navigator.clipboard?.writeText(text).catch(() => undefined);
}

function extractCallQuestions(text: string) {
  const raw = String(text || '').trim();
  if (!raw) return '';

  const startPatterns = [
    /4\)\s*Câu hỏi nên hỏi khi gọi ứng viên\s*:/i,
    /4\.\s*Câu hỏi nên hỏi khi gọi ứng viên\s*:/i,
    /Câu hỏi nên hỏi khi gọi ứng viên\s*:/i,
  ];
  const endPatterns = [
    /\n\s*5\)\s*Gợi ý xử lý tiếp theo\s*:/i,
    /\n\s*5\.\s*Gợi ý xử lý tiếp theo\s*:/i,
    /\n\s*Gợi ý xử lý tiếp theo\s*:/i,
  ];

  let startIndex = -1;
  let startLength = 0;
  for (const pattern of startPatterns) {
    const match = raw.match(pattern);
    if (match?.index !== undefined) {
      startIndex = match.index;
      startLength = match[0].length;
      break;
    }
  }

  if (startIndex < 0) return raw;

  const rest = raw.slice(startIndex + startLength).trim();
  let endIndex = rest.length;
  for (const pattern of endPatterns) {
    const match = rest.match(pattern);
    if (match?.index !== undefined) {
      endIndex = Math.min(endIndex, match.index);
    }
  }

  const questions = rest.slice(0, endIndex).trim();
  return questions || raw;
}

function showAiInlineResultModal(title: string, content: string, actions: ModalAction[] = []) {
  const cleanContent = content.trim();
  if (!cleanContent) return;

  const root = ensureModalRoot();
  const allActions: ModalAction[] = actions.length > 0
    ? actions
    : [{ label: 'Copy nội dung', text: cleanContent, variant: 'secondary' }];

  root.innerHTML = `
    <div class="fixed inset-0 z-[70] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" data-vlgn-ai-modal="true">
      <div class="absolute inset-0" data-vlgn-ai-close="true"></div>
      <div class="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200">
        <div class="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <p class="text-xs font-bold uppercase tracking-wide text-indigo-600">AI hỗ trợ</p>
            <h3 class="mt-1 text-lg font-black text-slate-950">${escapeHtml(title)}</h3>
          </div>
          <button type="button" class="rounded-full p-2 text-slate-500 hover:bg-slate-100" data-vlgn-ai-close="true" aria-label="Đóng popup AI">×</button>
        </div>
        <div class="overflow-y-auto px-5 py-4">
          <div class="whitespace-pre-line text-sm leading-6 text-slate-700">${escapeHtml(cleanContent)}</div>
        </div>
        <div class="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-4">
          ${allActions.map((action, index) => `
            <button
              type="button"
              class="rounded-xl ${action.variant === 'primary' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'} px-4 py-2 text-xs font-bold"
              data-vlgn-ai-copy="${index}"
            >${escapeHtml(action.label)}</button>
          `).join('')}
          <button type="button" class="rounded-xl bg-brand-navy px-5 py-2 text-xs font-bold text-white hover:bg-[#0b2d57]" data-vlgn-ai-close="true">Đóng</button>
        </div>
      </div>
    </div>
  `;

  root.querySelectorAll('[data-vlgn-ai-close="true"]').forEach((element) => {
    element.addEventListener('click', () => {
      root.innerHTML = '';
    });
  });

  root.querySelectorAll<HTMLElement>('[data-vlgn-ai-copy]').forEach((element) => {
    element.addEventListener('click', () => {
      const index = Number(element.dataset.vlgnAiCopy || -1);
      const action = allActions[index];
      if (action) copyText(action.text);
    });
  });
}

function shouldOpenForNode(node: HTMLElement, content: string) {
  if (!content || content.length < 8) return false;
  const lastContent = observedInlineResults.get(node);
  if (lastContent === content) return false;
  observedInlineResults.set(node, content);
  return true;
}

function hideInlineResult(node: HTMLElement) {
  node.style.display = 'none';
}

function scanAccountAiSuggestions() {
  const nodes = document.querySelectorAll<HTMLElement>('[class*="ring-indigo-100"][class*="whitespace-pre-line"]');

  nodes.forEach((node) => {
    if (node.closest('[data-vlgn-ai-modal="true"]')) return;

    const wrapperText = node.closest('[class*="bg-indigo-50"]')?.textContent || '';
    if (!wrapperText.includes('AI gợi ý hoàn thiện hồ sơ')) return;

    const content = node.textContent?.trim() || '';
    if (!shouldOpenForNode(node, content)) return;

    hideInlineResult(node);
    showAiInlineResultModal('AI gợi ý hoàn thiện hồ sơ', content);
  });
}

function scanJobFitResults() {
  const cards = document.querySelectorAll<HTMLElement>('[class*="bg-indigo-50"][class*="ring-indigo-100"]');

  cards.forEach((card) => {
    if (card.closest('[data-vlgn-ai-modal="true"]')) return;
    if (!card.textContent?.includes('Gợi ý chỉ hiển thị cho bạn')) return;

    const contentNode = card.querySelector<HTMLElement>('[class*="whitespace-pre-line"]');
    const content = contentNode?.textContent?.trim() || '';
    if (!shouldOpenForNode(card, content)) return;

    hideInlineResult(card.closest<HTMLElement>('[class*="border-t"][class*="pt-4"]') || card);
    showAiInlineResultModal('AI kiểm tra việc này có hợp không', content);
  });
}

function scanLeadAiAnalysis() {
  const contentNodes = document.querySelectorAll<HTMLElement>('[class*="ring-purple-100"] [class*="whitespace-pre-line"]');

  contentNodes.forEach((contentNode) => {
    if (contentNode.closest('[data-vlgn-ai-modal="true"]')) return;

    const wrapper = contentNode.closest<HTMLElement>('[class*="ring-purple-100"]');
    const sectionText = wrapper?.closest('section')?.textContent || '';
    if (!wrapper || !sectionText.includes('AI phân tích CV / Lead')) return;

    const content = contentNode.textContent?.trim() || '';
    if (!shouldOpenForNode(wrapper, content)) return;

    hideInlineResult(wrapper);
    showAiInlineResultModal('Kết quả phân tích CV / Lead', content, [
      { label: 'Copy câu hỏi gọi', text: extractCallQuestions(content), variant: 'primary' },
      { label: 'Copy tất cả', text: content, variant: 'secondary' },
    ]);
  });
}

function scanAiInlineResults() {
  scanAccountAiSuggestions();
  scanJobFitResults();
  scanLeadAiAnalysis();
}

function installAiInlineResultModalBridge() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const scan = () => window.requestAnimationFrame(scanAiInlineResults);
  scan();

  const observer = new MutationObserver(scan);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

installAiInlineResultModalBridge();

export {};
