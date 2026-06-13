import {
  AlertCircle,
  Bell,
  Bot,
  CheckCircle,
  ChevronDown,
  Eye,
  EyeOff,
  FileText,
  Globe,
  Key,
  Loader2,
  RefreshCw,
  Send,
  Shield,
  ToggleLeft,
  ToggleRight,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type AiType = 'chatbot_main' | 'chatbot_fallback' | 'cv_analyzer';
type ProviderType = 'dialogflow' | 'gemini_api' | 'claude_api' | 'vertex_ai' | 'agent_builder' | 'none';

type AiConfig = {
  id: string;
  name: string;
  type: AiType;
  provider_type: ProviderType;
  config_json: string;
  rules: string;
  status: 'active' | 'inactive' | 'error';
  error_reason: string | null;
  updated_at?: string;
};

type ConfigForm = {
  provider_type: ProviderType;
  baseUrl: string;
  apiKey: string;
  authToken: string;
  credentialsJson: string;
  model: string;
  systemPrompt: string;
  projectId: string;
  location: string;
  agentId: string;
  languageCode: string;
  temperature: string;
  maxTokens: string;
  rules: string;
  status: string;
};

type ResourceItem = {
  id: string;
  name?: string;
  displayName?: string;
  meta?: Record<string, any>;
  additionalInfo?: Record<string, any>;
};

type TelegramSettings = {
  botToken: string;
  defaultChannel: string;
  notifyOnApplication: boolean;
  notifyOnLead: boolean;
};

const PROVIDER_LABELS: Record<string, string> = {
  dialogflow: 'Dialogflow (VLGN Chat Agent)',
  gemini_api: 'Gemini API / Gemini Studio',
  claude_api: 'Claude API (bên thứ ba)',
  vertex_ai: 'Vertex AI Gemini',
  agent_builder: 'Agent Builder / Conversation Agent',
  none: 'Chưa cấu hình',
};

const TYPE_LABELS: Record<AiType, string> = {
  chatbot_main: 'AI chính',
  chatbot_fallback: 'AI phụ khi bí',
  cv_analyzer: 'AI phân tích hồ sơ',
};

const TYPE_DESCRIPTIONS: Record<AiType, string> = {
  chatbot_main: 'AI trả lời chatbot tư vấn ngoài website',
  chatbot_fallback: 'AI dự phòng - chạy khi AI chính không trả lời được',
  cv_analyzer: 'AI phân tích hồ sơ ứng viên khi admin/công ty bấm nút',
};

const DEFAULT_RULES: Record<AiType, string> = {
  chatbot_main: 'Chỉ tư vấn tìm việc, tuyển người, CTV, lỗi tài khoản.\nKhông phân tích CV ở đây.\nKhông hỏi CCCD, OTP, mật khẩu, tài khoản ngân hàng.\nKhông hiện hoa hồng nội bộ, bounty, platform fee, 80/20.',
  chatbot_fallback: 'Chỉ chạy khi AI chính không trả lời được hoặc báo lỗi.\nCùng quy tắc với AI chính.',
  cv_analyzer: 'Chỉ chạy khi admin/công ty bấm nút "Phân tích hồ sơ".\nKhông chạy trong chatbot website.\nKhông gửi nội dung phân tích qua Telegram.',
};

function emptyForm(type: AiType, provider: ProviderType = 'none'): ConfigForm {
  return {
    provider_type: provider,
    baseUrl: '',
    apiKey: '',
    authToken: '',
    credentialsJson: '',
    model: '',
    systemPrompt: '',
    projectId: '',
    location: provider === 'agent_builder' ? 'global' : '',
    agentId: '',
    languageCode: 'vi',
    temperature: '0.7',
    maxTokens: '8192',
    rules: DEFAULT_RULES[type],
    status: 'inactive',
  };
}

function normalizeGeminiModelId(model: string): string {
  let value = String(model || '').trim();
  if (!value) return '';
  if (value.includes('/')) value = value.split('/').filter(Boolean).pop() || value;
  return value
    .replace(/^models\//i, '')
    .replace(/^google\//i, '')
    .replace(/^publishers\/google\/models\//i, '')
    .replace(/[:@].*$/, '')
    .trim();
}

function normalizeAgentId(value: string): string {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.split('/').filter(Boolean).pop() || text;
}

function parseProjectIdFromCredentials(text: string): string {
  try {
    const parsed = JSON.parse(text || '{}');
    return String(parsed.project_id || '').trim();
  } catch {
    return '';
  }
}

function parseConfig(configJson: string, fallbackProviderType: ProviderType, type: AiType): ConfigForm {
  try {
    const parsed = JSON.parse(configJson || '{}');
    const providerType = (parsed.provider_type || fallbackProviderType || 'none') as ProviderType;
    return {
      ...emptyForm(type, providerType),
      baseUrl: parsed.baseUrl || '',
      apiKey: parsed.apiKey || '',
      authToken: parsed.authToken || '',
      credentialsJson: parsed.credentialsJson || '',
      model: providerType === 'gemini_api' ? normalizeGeminiModelId(parsed.model || '') : (parsed.model || ''),
      systemPrompt: parsed.systemPrompt || '',
      projectId: parsed.projectId || '',
      location: parsed.location || (providerType === 'agent_builder' ? 'global' : ''),
      agentId: normalizeAgentId(parsed.agentId || ''),
      languageCode: parsed.languageCode || 'vi',
      temperature: parsed.temperature || '0.7',
      maxTokens: parsed.maxTokens || '8192',
    };
  } catch {
    return emptyForm(type, fallbackProviderType);
  }
}

function configToJson(form: ConfigForm): string {
  const p = form.provider_type;
  const out: Record<string, any> = { provider_type: p };

  if (p === 'gemini_api') {
    out.apiKey = form.apiKey;
    out.model = normalizeGeminiModelId(form.model);
    out.systemPrompt = form.systemPrompt;
    out.temperature = form.temperature;
    out.maxTokens = form.maxTokens;
  }

  if (p === 'claude_api') {
    out.baseUrl = form.baseUrl;
    out.apiKey = form.apiKey;
    out.model = form.model;
    out.systemPrompt = form.systemPrompt;
    out.temperature = form.temperature;
    out.maxTokens = form.maxTokens;
  }

  if (p === 'vertex_ai') {
    out.projectId = form.projectId;
    out.location = form.location;
    out.credentialsJson = form.credentialsJson;
    out.authToken = form.authToken;
    out.model = form.model;
    out.systemPrompt = form.systemPrompt;
    out.temperature = form.temperature;
    out.maxTokens = form.maxTokens;
  }

  if (p === 'dialogflow' || p === 'agent_builder') {
    out.projectId = form.projectId || parseProjectIdFromCredentials(form.credentialsJson);
    out.location = form.location || 'global';
    out.agentId = normalizeAgentId(form.agentId);
    out.languageCode = form.languageCode || 'vi';
    out.credentialsJson = form.credentialsJson;
    if (p === 'agent_builder') out.runtime = 'dialogflow_cx';
  }

  return JSON.stringify(out);
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') return <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700"><CheckCircle className="h-3 w-3" /> Hoạt động</span>;
  if (status === 'error') return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700"><XCircle className="h-3 w-3" /> Lỗi</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"><AlertCircle className="h-3 w-3" /> Chưa hoạt động</span>;
}

function PasswordInput({ value, onChange, placeholder, label, icon: Icon }: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {Icon && <Icon className="inline h-3.5 w-3.5 mr-1" />}
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm px-3 py-2 border pr-10"
        />
        <button type="button" onClick={() => setShow(!show)} className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600" tabIndex={-1}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function AiFormCard({ config, onSave, saving, type }: {
  config: AiConfig | null;
  onSave: (data: { config_json: string; provider_type: ProviderType; rules: string; status: string }) => void;
  saving: boolean;
  type: AiType;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState<ConfigForm>(() => ({
    ...parseConfig(config?.config_json || '{}', config?.provider_type || 'none', type),
    rules: config?.rules || DEFAULT_RULES[type],
    status: config?.status || 'inactive',
  }));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loadedResources, setLoadedResources] = useState<ResourceItem[]>([]);
  const [allowFreeModelInput, setAllowFreeModelInput] = useState(false);
  const [loadingResources, setLoadingResources] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      ...parseConfig(config?.config_json || '{}', config?.provider_type || 'none', type),
      rules: config?.rules || DEFAULT_RULES[type],
      status: config?.status || 'inactive',
    });
    setLoadedResources([]);
    setAllowFreeModelInput(false);
    setTestResult(null);
    setValidationError(null);
  }, [config?.id, config?.provider_type, config?.config_json, config?.rules, config?.status, config?.updated_at, type]);

  const isCvConversationAgent = type === 'cv_analyzer' && form.provider_type === 'agent_builder';

  const setField = (field: keyof ConfigForm, value: string) => {
    const nextValue = field === 'model' && form.provider_type === 'gemini_api' ? normalizeGeminiModelId(value) : value;
    setForm(prev => ({ ...prev, [field]: nextValue }));
    if (validationError) setValidationError(null);
    if (testResult) setTestResult(null);
  };

  const getProviderOptions = () => {
    if (type === 'chatbot_main') {
      return [
        { value: 'dialogflow', label: 'Dialogflow (VLGN Chat Agent)' },
        { value: 'gemini_api', label: 'Gemini API / Gemini Studio' },
        { value: 'claude_api', label: 'Claude API (bên thứ ba)' },
        { value: 'vertex_ai', label: 'Vertex AI Gemini' },
        { value: 'agent_builder', label: 'Agent Builder / Conversation Agent' },
      ];
    }
    if (type === 'chatbot_fallback') {
      return [
        { value: 'gemini_api', label: 'Gemini API / Gemini Studio' },
        { value: 'claude_api', label: 'Claude API (bên thứ ba)' },
        { value: 'vertex_ai', label: 'Vertex AI Gemini' },
        { value: 'agent_builder', label: 'Agent Builder / Conversation Agent' },
      ];
    }
    return [
      { value: 'gemini_api', label: 'Gemini API / Gemini Studio' },
      { value: 'claude_api', label: 'Claude API (bên thứ ba)' },
      { value: 'vertex_ai', label: 'Vertex AI Gemini' },
      { value: 'agent_builder', label: 'Agent Builder / Conversation Agent' },
    ];
  };

  const validateConfig = (): string | null => {
    if (form.provider_type === 'none') return 'Vui lòng chọn loại AI';
    if (form.provider_type === 'gemini_api') {
      if (!form.apiKey) return 'Thiếu API Key (Gemini)';
      if (!form.model) return 'Thiếu Model ID';
    }
    if (form.provider_type === 'claude_api') {
      if (!form.baseUrl) return 'Thiếu Base URL cho Claude bên thứ ba';
      if (!form.apiKey) return 'Thiếu API Key (Claude)';
      if (!form.model) return 'Thiếu tên model';
    }
    if (form.provider_type === 'vertex_ai') {
      if (!form.credentialsJson && !form.authToken) return 'Cần Credentials JSON hoặc Auth Token cho Vertex AI';
      if (!form.model) return 'Thiếu tên model/engine';
    }
    if (form.provider_type === 'dialogflow' || form.provider_type === 'agent_builder') {
      if (!form.credentialsJson) return 'Thiếu Credentials JSON';
      if (!(form.projectId || parseProjectIdFromCredentials(form.credentialsJson))) return 'Thiếu Project ID';
      if (!form.location) return 'Thiếu Location';
      if (!form.agentId) return 'Thiếu Agent ID';
    }
    return null;
  };

  const handleCredentialsFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      JSON.parse(text);
      setForm(prev => ({
        ...prev,
        credentialsJson: text,
        projectId: prev.projectId || parseProjectIdFromCredentials(text),
        location: prev.location || 'global',
      }));
      setValidationError(null);
      setTestResult({ ok: true, msg: `Đã nạp file JSON: ${file.name}` });
    } catch {
      setTestResult({ ok: false, msg: 'File JSON không hợp lệ.' });
    } finally {
      event.target.value = '';
    }
  };

  const canLoadResources = () => {
    if (form.provider_type === 'gemini_api' || form.provider_type === 'claude_api') return !!form.apiKey;
    if (form.provider_type === 'vertex_ai') return !!form.credentialsJson || !!form.authToken;
    if (isCvConversationAgent) return !!form.credentialsJson && !!(form.projectId || parseProjectIdFromCredentials(form.credentialsJson));
    return false;
  };

  const handleLoadResources = async () => {
    if (!canLoadResources()) {
      setTestResult({ ok: false, msg: 'Cần nhập đủ thông tin provider trước.' });
      return;
    }
    setLoadingResources(true);
    setLoadedResources([]);
    setTestResult(null);
    try {
      const token = localStorage.getItem('vlgn_admin_session') || '';
      const providerType = isCvConversationAgent ? 'dialogflow' : form.provider_type;
      const body: Record<string, string> = { providerType, type };

      if (form.provider_type === 'gemini_api' || form.provider_type === 'claude_api') body.apiKey = form.apiKey;
      if (form.provider_type === 'vertex_ai') {
        body.credentialsJson = form.credentialsJson;
        body.authToken = form.authToken;
      }
      if (isCvConversationAgent) {
        body.credentialsJson = form.credentialsJson;
        body.projectId = form.projectId || parseProjectIdFromCredentials(form.credentialsJson);
        body.location = form.location || 'global';
        body.agentId = form.agentId;
      }

      const res = await fetch('/api/admin/ai/load-resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || data.error || 'Load thất bại');
      const items = Array.isArray(data.items) ? data.items : [];
      setLoadedResources(items);
      setTestResult({ ok: true, msg: isCvConversationAgent ? `Đã tải ${items.length} agent.` : `Đã tải ${items.length} resource.` });
    } catch (error) {
      setTestResult({ ok: false, msg: error instanceof Error ? error.message : 'Load thất bại' });
    } finally {
      setLoadingResources(false);
    }
  };

  const useAgent = (item: ResourceItem) => {
    const meta = item.meta || item.additionalInfo || {};
    setForm(prev => ({
      ...prev,
      agentId: normalizeAgentId(item.id || item.name || ''),
      languageCode: String(meta.defaultLanguageCode || prev.languageCode || 'vi'),
      location: prev.location || 'global',
    }));
    setTestResult({ ok: true, msg: `Đã chọn agent: ${item.displayName || item.id || item.name}` });
  };

  const handleTest = async () => {
    const err = validateConfig();
    if (err) {
      setValidationError(err);
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const token = localStorage.getItem('vlgn_admin_session') || '';
      const testProvider = isCvConversationAgent ? 'dialogflow' : form.provider_type;
      const res = await fetch('/api/admin/ai-configs/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type, config_json: configToJson(form), provider_type: testProvider }),
      });
      const data = await res.json();
      setTestResult({ ok: Boolean(data.success), msg: data.message || data.error || 'Kết quả không rõ' });
    } catch {
      setTestResult({ ok: false, msg: 'Lỗi kết nối server' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    const err = validateConfig();
    if (err) {
      setValidationError(err);
      return;
    }
    onSave({ config_json: configToJson(form), provider_type: form.provider_type, rules: form.rules, status: form.status });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-slate-900">{TYPE_LABELS[type]}</h4>
          <p className="text-xs text-slate-500 mt-0.5">{TYPE_DESCRIPTIONS[type]}</p>
        </div>
        <StatusBadge status={form.status} />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Loại AI</label>
        <select
          value={form.provider_type}
          onChange={e => {
            const provider = e.target.value as ProviderType;
            setForm(prev => ({ ...emptyForm(type, provider), rules: prev.rules || DEFAULT_RULES[type], status: prev.status }));
            setLoadedResources([]);
            setTestResult(null);
          }}
          className="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm px-3 py-2 border"
        >
          <option value="none">-- Chọn loại AI --</option>
          {getProviderOptions().map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>

      {form.provider_type !== 'none' && (
        <>
          {['gemini_api', 'vertex_ai', 'claude_api'].includes(form.provider_type) && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tên model / Engine ID</label>
              {form.provider_type === 'gemini_api' ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={form.model}
                    onChange={e => setField('model', e.target.value)}
                    placeholder="gemini-2.5-flash"
                    readOnly={!allowFreeModelInput}
                    className={`w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm px-3 py-2 border font-mono ${allowFreeModelInput ? '' : 'bg-slate-50'}`}
                  />
                  <label className="inline-flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={allowFreeModelInput} onChange={e => setAllowFreeModelInput(e.target.checked)} />
                    <span>Cho phép nhập model thủ công</span>
                  </label>
                </div>
              ) : (
                <input type="text" value={form.model} onChange={e => setField('model', e.target.value)} placeholder="model id hoặc engine id..." className="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm px-3 py-2 border" />
              )}
            </div>
          )}

          {form.provider_type === 'gemini_api' && <PasswordInput value={form.apiKey} onChange={val => setField('apiKey', val)} placeholder="AIza..." label="API Key (Gemini)" icon={Key} />}

          {form.provider_type === 'claude_api' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1"><Globe className="inline h-3.5 w-3.5 mr-1" />Base URL (Claude third-party)</label>
                <input type="text" value={form.baseUrl} onChange={e => setField('baseUrl', e.target.value)} placeholder="https://your-claude-proxy.example.com" className="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm px-3 py-2 border font-mono" />
              </div>
              <PasswordInput value={form.apiKey} onChange={val => setField('apiKey', val)} placeholder="sk-ant-..." label="API Key (Claude)" icon={Key} />
            </>
          )}

          {form.provider_type === 'vertex_ai' && (
            <>
              <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-sm text-slate-600">Base URL sẽ được hệ thống tạo tự động. Nhập Credentials JSON hoặc Auth Token cùng model.</div>
              <PasswordInput value={form.authToken} onChange={val => setField('authToken', val)} placeholder="Token hoặc để trống nếu dùng Credentials JSON" label="Auth Token (Access Token GCP)" />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Credentials JSON (Service Account GCP)</label>
                <textarea value={form.credentialsJson} onChange={e => setField('credentialsJson', e.target.value)} rows={3} placeholder='{"type":"service_account","project_id":"..."}' className="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm px-3 py-2 border font-mono" />
              </div>
              <ProjectLocationFields form={form} setField={setField} />
            </>
          )}

          {form.provider_type === 'dialogflow' && (
            <>
              <GoogleAgentFields form={form} setField={setField} />
            </>
          )}

          {form.provider_type === 'agent_builder' && (
            <>
              {type === 'cv_analyzer' && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  Luồng này chỉ dùng cho nút Phân tích CV/Lead trong admin. Không chạy chatbot public.
                </div>
              )}
              <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleCredentialsFile} />
              <GoogleAgentFields form={form} setField={setField} credentialsLabel="Credentials JSON (Service Account / Conversation Agent)" />
              {type === 'cv_analyzer' && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-300">
                    <FileText className="h-3.5 w-3.5" /> Nạp file JSON
                  </button>
                  <button type="button" onClick={handleLoadResources} disabled={loadingResources || !canLoadResources()} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                    {loadingResources ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    {loadingResources ? 'Đang tải...' : 'Tải danh sách Agent'}
                  </button>
                </div>
              )}
            </>
          )}

          {(form.provider_type === 'gemini_api' || form.provider_type === 'claude_api' || form.provider_type === 'vertex_ai') && (
            <button type="button" onClick={handleLoadResources} disabled={loadingResources || !canLoadResources()} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {loadingResources ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              {loadingResources ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}
            </button>
          )}

          {loadedResources.length > 0 && (
            <div className="space-y-2 rounded-lg border border-green-200 bg-green-50 px-3 py-3 text-xs text-green-700">
              <div className="font-semibold">Tìm thấy {loadedResources.length} resource</div>
              {loadedResources.slice(0, 8).map(item => {
                const modelId = normalizeGeminiModelId(item.name || item.id || '');
                const isAgent = isCvConversationAgent;
                return (
                  <div key={item.id || item.name || modelId} className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2 text-slate-700">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{item.displayName || modelId || item.id}</div>
                      <div className="truncate font-mono text-xs text-slate-400">{item.id || item.name || modelId}</div>
                    </div>
                    <button type="button" onClick={() => isAgent ? useAgent(item) : setField('model', modelId)} className="shrink-0 rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700">
                      {isAgent ? 'Dùng agent này' : 'Dùng model này'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {(form.provider_type === 'gemini_api' || form.provider_type === 'claude_api' || form.provider_type === 'vertex_ai') && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">📝 Hướng dẫn nhân cách cho AI (System Prompt)</label>
              <textarea value={form.systemPrompt} onChange={e => setField('systemPrompt', e.target.value)} rows={4} placeholder="Bạn là trợ lý tư vấn việc làm cho vieclamgannha.me..." className="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm px-3 py-2 border" />
            </div>
          )}

          <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
            <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            Tùy chọn nâng cao
          </button>

          {showAdvanced && (
            <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50 p-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quy tắc hoạt động</label>
                <textarea value={form.rules} onChange={e => setField('rules', e.target.value)} rows={4} className="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm px-3 py-2 border" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                <input type="checkbox" checked={form.status === 'active'} onChange={e => setField('status', e.target.checked ? 'active' : 'inactive')} className="rounded border-slate-300 text-indigo-600 shadow-sm focus:ring-indigo-500" />
                Hoạt động
              </label>
            </div>
          )}
        </>
      )}

      {validationError && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">⚠️ {validationError}</div>}
      {testResult && <div className={`rounded-lg px-3 py-2 text-sm ${testResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{testResult.ok ? '✅ ' : '❌ '}{testResult.msg}</div>}

      <div className="flex justify-end gap-3">
        <button onClick={handleTest} disabled={testing || form.provider_type === 'none'} className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed">
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {testing ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}
        </button>
        <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
        </button>
      </div>
    </div>
  );
}

function ProjectLocationFields({ form, setField }: { form: ConfigForm; setField: (field: keyof ConfigForm, value: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Project ID</label>
        <input type="text" value={form.projectId} onChange={e => setField('projectId', e.target.value)} className="w-full rounded-lg border-slate-300 shadow-sm text-sm px-3 py-2 border" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
        <input type="text" value={form.location} onChange={e => setField('location', e.target.value)} placeholder="global" className="w-full rounded-lg border-slate-300 shadow-sm text-sm px-3 py-2 border" />
      </div>
    </div>
  );
}

function GoogleAgentFields({ form, setField, credentialsLabel = 'Credentials JSON (Service Account)' }: { form: ConfigForm; setField: (field: keyof ConfigForm, value: string) => void; credentialsLabel?: string }) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">{credentialsLabel}</label>
        <textarea
          value={form.credentialsJson}
          onChange={e => {
            const text = e.target.value;
            setField('credentialsJson', text);
            const projectId = parseProjectIdFromCredentials(text);
            if (projectId && !form.projectId) setField('projectId', projectId);
          }}
          rows={3}
          placeholder='{"type":"service_account","project_id":"..."}'
          className="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm px-3 py-2 border font-mono"
        />
      </div>
      <ProjectLocationFields form={form} setField={setField} />
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Agent ID / Full Path</label>
        <input type="text" value={form.agentId} onChange={e => setField('agentId', normalizeAgentId(e.target.value))} placeholder="06e61936-... hoặc projects/.../agents/..." className="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm px-3 py-2 border font-mono" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Language Code</label>
        <input type="text" value={form.languageCode} onChange={e => setField('languageCode', e.target.value)} placeholder="vi" className="w-full rounded-lg border-slate-300 shadow-sm text-sm px-3 py-2 border" />
      </div>
    </>
  );
}

function TelegramSection() {
  const [settings, setSettings] = useState<TelegramSettings>({ botToken: '', defaultChannel: '', notifyOnApplication: true, notifyOnLead: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('vlgn_admin_session') || '';
      const res = await fetch('/api/admin/telegram-settings', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Không tải được cấu hình Telegram');
      const data = await res.json();
      setSettings(data.data || settings);
    } catch {
      setError('Không tải được cấu hình Telegram');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const token = localStorage.getItem('vlgn_admin_session') || '';
      const res = await fetch('/api/admin/telegram-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error('Lỗi khi lưu');
      setSuccessMsg('Đã lưu cấu hình Telegram!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      setError('Lỗi khi lưu Telegram');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!settings.botToken || !settings.defaultChannel) {
      setTestResult('Vui lòng nhập đủ Token và Channel ID');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const token = localStorage.getItem('vlgn_admin_session') || '';
      const res = await fetch('/api/admin/telegram-settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      setTestResult(data.success ? '✅ ' + data.message : '❌ ' + data.message);
    } catch {
      setTestResult('❌ Lỗi kết nối');
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-indigo-600" /></div></div>;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center gap-2"><Send className="h-5 w-5 text-sky-600" /><h3 className="font-semibold text-slate-900">Cấu hình Telegram</h3></div>
      <p className="text-xs text-slate-500">Bot gửi thông báo đơn ứng tuyển và lead chatbot qua Telegram channel.</p>
      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
      {successMsg && <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">{successMsg}</div>}
      {testResult && <div className={`rounded-lg px-3 py-2 text-sm ${testResult.startsWith('✅') ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>{testResult}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PasswordInput value={settings.botToken} onChange={val => setSettings(prev => ({ ...prev, botToken: val }))} placeholder="7xxxxxxxxxx:AAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" label="Bot Token" icon={Key} />
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1"><Bell className="inline h-3.5 w-3.5 mr-1" />Channel mặc định</label>
          <input type="text" value={settings.defaultChannel} onChange={e => setSettings(prev => ({ ...prev, defaultChannel: e.target.value }))} placeholder="@vieclamgannha hoặc -100xxxxxxxxxx" className="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm px-3 py-2 border" />
        </div>
      </div>
      <div className="space-y-3">
        <ToggleRow label="Thông báo đơn ứng tuyển" desc="Gửi Telegram khi có ứng viên nộp đơn" checked={settings.notifyOnApplication} onChange={value => setSettings(prev => ({ ...prev, notifyOnApplication: value }))} />
        <ToggleRow label="Thông báo lead chatbot" desc="Gửi Telegram khi chatbot bắt được lead mới" checked={settings.notifyOnLead} onChange={value => setSettings(prev => ({ ...prev, notifyOnLead: value }))} />
      </div>
      <div className="flex justify-end gap-3">
        <button type="button" onClick={handleTest} disabled={testing} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">{testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{testing ? 'Đang gửi...' : 'Test Telegram'}</button>
        <button type="button" onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{saving ? 'Đang lưu...' : 'Lưu Telegram'}</button>
      </div>
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-xs text-slate-400">{desc}</p>
      </div>
      <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-1 text-sm">
        {checked ? <ToggleRight className="h-6 w-6 text-green-600" /> : <ToggleLeft className="h-6 w-6 text-slate-400" />}
        <span className={`text-xs font-medium ${checked ? 'text-green-600' : 'text-slate-400'}`}>{checked ? 'Bật' : 'Tắt'}</span>
      </button>
    </div>
  );
}

export function AdminConfigTab() {
  const [configs, setConfigs] = useState<AiConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchConfigs = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('vlgn_admin_session') || '';
      const res = await fetch('/api/admin/ai-configs', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Không tải được cấu hình AI');
      const data = await res.json();
      setConfigs(data.data || []);
    } catch {
      setError('Không tải được cấu hình AI');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConfigs(); }, []);

  const handleSave = async (id: string, data: { config_json: string; provider_type: ProviderType; rules: string; status: string }) => {
    setSavingIds(prev => new Set(prev).add(id));
    setError(null);
    try {
      const token = localStorage.getItem('vlgn_admin_session') || '';
      const res = await fetch(`/api/admin/ai-configs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Lỗi khi lưu');
      }
      await fetchConfigs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối khi lưu');
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa AI này?')) return;
    setDeletingId(id);
    try {
      const token = localStorage.getItem('vlgn_admin_session') || '';
      const res = await fetch(`/api/admin/ai-configs/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Lỗi khi xóa');
      await fetchConfigs();
    } catch {
      setError('Lỗi khi xóa');
    } finally {
      setDeletingId(null);
    }
  };

  const getConfig = (type: AiType) => configs.find(c => c.type === type) || null;

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Cấu hình AI & Telegram</h2>
          <p className="text-sm text-slate-500">Quản lý AI chatbot, AI phân tích, và thông báo Telegram</p>
        </div>
        <button onClick={fetchConfigs} className="inline-flex items-center gap-2 rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><RefreshCw className="h-4 w-4" />Làm mới</button>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section>
        <div className="flex items-center gap-2 mb-4"><Bot className="h-5 w-5 text-purple-600" /><h3 className="font-semibold text-slate-900">Chatbot tư vấn ngoài website</h3></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1"><span className="inline-flex items-center justify-center rounded-full bg-purple-100 text-purple-700 text-xs font-bold h-5 w-5">1</span>AI chính</p>
            <AiFormCard config={getConfig('chatbot_main')} onSave={data => handleSave('chatbot_main', data)} saving={savingIds.has('chatbot_main')} type="chatbot_main" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1"><span className="inline-flex items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold h-5 w-5">2</span>AI phụ khi AI chính không trả lời được</p>
            <AiFormCard config={getConfig('chatbot_fallback')} onSave={data => handleSave('chatbot_fallback', data)} saving={savingIds.has('chatbot_fallback')} type="chatbot_fallback" />
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4"><FileText className="h-5 w-5 text-blue-600" /><h3 className="font-semibold text-slate-900">Phân tích hồ sơ ứng viên</h3></div>
        <div className="max-w-xl">
          <p className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1"><span className="inline-flex items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold h-5 w-5">3</span>AI phân tích hồ sơ</p>
          <AiFormCard config={getConfig('cv_analyzer')} onSave={data => handleSave('cv_analyzer', data)} saving={savingIds.has('cv_analyzer')} type="cv_analyzer" />
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4"><Send className="h-5 w-5 text-sky-600" /><h3 className="font-semibold text-slate-900">Telegram</h3></div>
        <TelegramSection />
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4"><Shield className="h-5 w-5 text-emerald-600" /><h3 className="font-semibold text-slate-900">Các AI đã cấu hình</h3></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {configs.map(cfg => (
            <div key={cfg.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm">{cfg.name}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{PROVIDER_LABELS[cfg.provider_type] || cfg.provider_type}</p>
                </div>
                <StatusBadge status={cfg.status} />
              </div>
              <div className="space-y-1.5 text-xs text-slate-600">
                <div><span className="font-medium">Loại:</span> {TYPE_LABELS[cfg.type]}</div>
                <div><span className="font-medium">Việc được làm:</span> {TYPE_DESCRIPTIONS[cfg.type]}</div>
                {cfg.error_reason && <div className="text-red-600"><span className="font-medium">Lý do lỗi:</span> {cfg.error_reason}</div>}
              </div>
              {cfg.id !== 'chatbot_main' && (
                <button onClick={() => handleDelete(cfg.id)} disabled={deletingId === cfg.id} className="mt-3 inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
                  <Trash2 className="h-3 w-3" />{deletingId === cfg.id ? 'Đang xóa...' : 'Xóa'}
                </button>
              )}
            </div>
          ))}
          {configs.length === 0 && <div className="col-span-full rounded-xl border-2 border-dashed border-slate-200 p-8 text-center"><Bot className="h-8 w-8 text-slate-300 mx-auto mb-2" /><p className="text-sm text-slate-500">Chưa có AI nào được cấu hình</p></div>}
        </div>
      </section>
    </div>
  );
}
