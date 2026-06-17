import { useEffect, useMemo, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const DISMISSED_KEY = 'vlgn:install-banner-dismissed:v2';

function isStandaloneApp() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isAndroidDevice() {
  return /android/i.test(window.navigator.userAgent);
}

function isChromeLikeAndroid() {
  const ua = window.navigator.userAgent.toLowerCase();
  return isAndroidDevice() && ua.includes('chrome') && !ua.includes('wv') && !ua.includes('fbav') && !ua.includes('zalo') && !ua.includes('instagram');
}

function getInstallText() {
  const isAdmin = window.location.pathname.startsWith('/admin');
  return {
    title: isAdmin ? 'Cài app Admin VLGN' : 'Tải app Việc Gần Nhà',
    subtitle: isAdmin
      ? 'Mở bảng quản trị nhanh như app riêng, không cần gõ lại đường dẫn.'
      : 'Mở nhanh như app, nhận bản mới tự động sau khi cập nhật.',
  };
}

export function InstallAppBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [inlineMessage, setInlineMessage] = useState('');

  const device = useMemo(() => {
    if (typeof window === 'undefined') return 'other';
    if (isIosDevice()) return 'ios';
    if (isAndroidDevice()) return 'android';
    return 'other';
  }, []);

  const copy = useMemo(() => {
    if (typeof window === 'undefined') return { title: 'Tải app', subtitle: '' };
    return getInstallText();
  }, []);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISSED_KEY) === '1');
    } catch {
      setDismissed(false);
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setInlineMessage('');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  if (dismissed || isStandaloneApp()) return null;

  const closeBanner = () => {
    try {
      window.localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // ignored
    }
    setDismissed(true);
  };

  const handleInstallClick = async () => {
    setInlineMessage('');

    if (device === 'ios') {
      setShowGuide(true);
      return;
    }

    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice.catch(() => null);
      setInstallPrompt(null);
      if (choice?.outcome === 'dismissed') {
        setShowGuide(true);
      }
      return;
    }

    if (device === 'android') {
      setShowGuide(true);
      setInlineMessage(isChromeLikeAndroid()
        ? 'Nếu cửa sổ cài app chưa tự bật, làm theo hướng dẫn 3 chấm của Chrome.'
        : 'Hãy mở trang này bằng Chrome Android rồi bấm cài app.');
      return;
    }

    setInlineMessage('Trên máy tính, dùng menu trình duyệt để cài nếu Chrome/Edge hỗ trợ.');
  };

  return (
    <>
      <div className="fixed inset-x-3 bottom-3 z-[80] mx-auto max-w-3xl rounded-2xl border border-orange-200 bg-white/95 p-3 shadow-2xl shadow-slate-900/15 backdrop-blur supports-[padding:max(0px)]:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-orange text-xl text-white shadow-md">📲</div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-brand-navy">{copy.title}</p>
            <p className="text-xs text-slate-600">{copy.subtitle}</p>
            {inlineMessage && <p className="mt-1 text-[11px] font-semibold text-orange-700">{inlineMessage}</p>}
          </div>
          <button
            type="button"
            onClick={handleInstallClick}
            className="shrink-0 rounded-full bg-brand-orange px-4 py-2 text-sm font-bold text-white shadow-md active:scale-95"
          >
            Cài app
          </button>
          <button
            type="button"
            aria-label="Đóng banner tải app"
            onClick={closeBanner}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-slate-500 hover:bg-slate-200"
          >
            ×
          </button>
        </div>
      </div>

      {device === 'android' && showGuide && (
        <InstallGuideModal
          icon="🤖"
          title="Cách cài app trên Android"
          intro="Làm bằng Chrome Android. Nếu đang mở trong Zalo, Facebook, Messenger hoặc trình duyệt trong app thì hãy mở lại bằng Chrome trước."
          steps={[
            {
              step: '1',
              title: 'Mở bằng Chrome',
              english: 'Open in Chrome',
              hint: 'Không dùng trình duyệt nhúng trong Zalo/Facebook. Sao chép link rồi mở bằng Chrome nếu cần.',
              visual: 'Chrome → vieclamgannha.me',
            },
            {
              step: '2',
              title: 'Bấm nút 3 chấm góc phải',
              english: 'Tap the three-dot menu',
              hint: 'Menu nằm góc phải phía trên của Chrome Android.',
              visual: '⋮',
            },
            {
              step: '3',
              title: 'Chọn Cài đặt ứng dụng hoặc Thêm vào màn hình chính',
              english: 'Install app / Add to Home screen',
              hint: 'Nếu chỉ thấy “Add to Home screen”, vẫn bấm được để tạo app ngoài màn hình chính.',
              visual: 'Install app → Install',
            },
          ]}
          note="Nếu Chrome vẫn chưa hiện mục cài, vào Chrome Settings → Site settings → All sites → vieclamgannha.me → Clear & reset, rồi mở lại trang."
          onClose={() => setShowGuide(false)}
        />
      )}

      {device === 'ios' && showGuide && (
        <InstallGuideModal
          icon=""
          title="Cách tải app trên iPhone"
          intro="Làm theo 3 bước trong Safari. Máy tiếng Anh cũng có hướng dẫn bên dưới."
          steps={[
            {
              step: '1',
              title: 'Bấm nút chia sẻ',
              english: 'Tap Share',
              hint: 'Trên iPhone thường là biểu tượng ô vuông có mũi tên lên. Nếu đang mở trong app khác, bấm dấu 3 chấm rồi chọn mở bằng Safari trước.',
              visual: '⋯  →  ⬆️',
            },
            {
              step: '2',
              title: 'Chọn Thêm vào Màn hình chính',
              english: 'Add to Home Screen',
              hint: 'Kéo danh sách xuống nếu chưa thấy mục này.',
              visual: 'Share Sheet  →  Add to Home Screen',
            },
            {
              step: '3',
              title: 'Bấm Thêm ở góc phải trên',
              english: 'Tap Add',
              hint: 'Sau đó icon Việc Gần Nhà sẽ nằm ngoài màn hình chính như app.',
              visual: 'Add  →  Home Screen',
            },
          ]}
          note="Nếu vẫn chưa thấy nút thêm app, mở lại đúng bằng Safari, tắt duyệt riêng tư, hoặc xóa icon cũ rồi thêm lại."
          onClose={() => setShowGuide(false)}
        />
      )}
    </>
  );
}

function InstallGuideModal({
  icon,
  title,
  intro,
  steps,
  note,
  onClose,
}: {
  icon: string;
  title: string;
  intro: string;
  steps: Array<{ step: string; title: string; english: string; hint: string; visual: string }>;
  note: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="mx-auto flex h-full max-h-[92vh] max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start gap-3 border-b border-slate-100 p-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-navy text-2xl text-white">{icon}</div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-black text-brand-navy">{title}</h2>
            <p className="text-sm text-slate-600">{intro}</p>
          </div>
          <button
            type="button"
            aria-label="Đóng hướng dẫn tải app"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl font-bold text-slate-500 hover:bg-slate-200"
          >
            ×
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="rounded-2xl bg-orange-50 p-4 text-sm text-orange-900">
            <strong>Lưu ý:</strong> {intro}
          </div>

          <div className="space-y-3">
            {steps.map((item) => <GuideStep key={item.step} {...item} />)}
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-sm font-bold text-brand-navy">Nếu vẫn chưa cài được</p>
            <p className="mt-2 text-sm text-slate-600">{note}</p>
          </div>
        </div>

        <div className="border-t border-slate-100 p-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl bg-brand-navy px-4 py-3 text-sm font-bold text-white active:scale-[0.99]"
          >
            Tôi đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
}

function GuideStep({ step, title, english, hint, visual }: { step: string; title: string; english: string; hint: string; visual: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-orange text-sm font-black text-white">{step}</div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-brand-navy">{title}</p>
          <p className="text-sm font-semibold text-slate-500">English: {english}</p>
          <div className="my-3 rounded-xl bg-slate-100 px-3 py-3 text-center text-sm font-bold text-slate-700">{visual}</div>
          <p className="text-sm text-slate-600">{hint}</p>
        </div>
      </div>
    </div>
  );
}
