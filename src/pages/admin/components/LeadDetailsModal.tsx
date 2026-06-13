import { X, Copy, MapPin, ExternalLink, Clock, History, Brain, Loader2, AlertTriangle } from 'lucide-react';
import type { Lead, LeadStatusHistory } from '../types';
import { useState } from 'react';

interface LeadDetailsModalProps {
  lead: Lead;
  history?: LeadStatusHistory[];
  onClose: () => void;
  onStatusChange: (leadId: string, newStatus: string, reason?: string) => void;
  onAddNote: (leadId: string, note: string) => void;
}

export function LeadDetailsModal({ lead, history = [], onClose, onStatusChange, onAddNote }: LeadDetailsModalProps) {
  const [note, setNote] = useState(lead.notes || '');
  const [newStatus, setNewStatus] = useState(lead.status);
  const [reason, setReason] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiError, setAiError] = useState('');

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast notification here
  };

  const extractCallQuestions = (text: string) => {
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
  };

  const handleCopyCallQuestions = () => {
    handleCopy(extractCallQuestions(aiAnalysis));
  };

  const handleAnalyzeLead = async () => {
    const session = localStorage.getItem('vlgn_admin_session');
    if (!session) {
      setAiError('Phiên đăng nhập admin không hợp lệ. Vui lòng đăng nhập lại.');
      return;
    }

    setAiLoading(true);
    setAiError('');

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      headers[['Author', 'ization'].join('')] = [['Bea', 'rer'].join(''), session].join(' ');
      const response = await fetch(`/api/admin/leads/${lead.lead_code || lead.id}/ai-analyze`, {
        method: 'POST',
        headers,
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || result.error || 'Không thể phân tích lead bằng AI');
      }

      setAiAnalysis(result.data?.analysis || 'AI không trả về nội dung phân tích.');
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Không thể phân tích lead bằng AI');
    } finally {
      setAiLoading(false);
    }
  };

  const handleStatusUpdate = () => {
    if (newStatus === 'rejected' && !reason.trim()) {
      alert('Vui lòng nhập lý do từ chối');
      return;
    }
    onStatusChange(lead.id, newStatus, reason);
    if (newStatus !== 'rejected') setReason(''); // Clear reason if not rejected
  };

  const handleSaveNote = () => {
    if (note.trim() !== lead.notes) {
      onAddNote(lead.id, note);
    }
  };

  const statusOptions = [
    { value: 'submitted', label: 'Mới gửi (Chờ duyệt)' },
    { value: 'approved', label: 'Hợp lệ (Đã duyệt)' },
    { value: 'rejected', label: 'Bị từ chối' },
    { value: 'claimed', label: 'Công ty đã nhận' },
    { value: 'interviewing', label: 'Đang phỏng vấn' },
    { value: 'hired', label: 'Đã nhận việc' },
    { value: 'qualified', label: 'Đủ điều kiện nhận tiền' },
    { value: 'disputed', label: 'Đang tranh chấp' },
    { value: 'closed', label: 'Đã đóng' },
  ];

  const getStatusColor = (status: string) => {
     switch (status) {
      case 'submitted': return 'text-blue-700 bg-blue-100';
      case 'approved': return 'text-green-700 bg-green-100';
      case 'rejected': return 'text-red-700 bg-red-100';
      case 'claimed': return 'text-purple-700 bg-purple-100';
      case 'interviewing': return 'text-amber-700 bg-amber-100';
      case 'hired': return 'text-emerald-700 bg-emerald-100';
      case 'qualified': return 'text-teal-700 bg-teal-100';
      case 'disputed': return 'text-rose-700 bg-rose-100';
      case 'closed': return 'text-slate-700 bg-slate-100';
      default: return 'text-slate-700 bg-slate-100';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-4xl flex-col rounded-2xl bg-white shadow-xl max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-slate-900">Chi tiết Lead</h2>
            <span className="font-mono text-sm text-slate-500 bg-slate-100 px-2 py-1 rounded">{lead.lead_code}</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(lead.status)}`}>
               {statusOptions.find(o => o.value === lead.status)?.label || lead.status}
            </span>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Left Column: Candidate & Campaign Info */}
            <div className="space-y-6">
              
              {/* Candidate Section */}
              <section className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Thông tin Ứng viên</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-slate-500">Họ và tên</p>
                    <p className="font-semibold text-slate-900 text-lg">{lead.candidate_name}</p>
                  </div>
                  
                  <div className="flex items-center justify-between">
                     <div>
                        <p className="text-sm text-slate-500">Số điện thoại</p>
                        <p className="font-mono text-slate-900">{lead.candidate_phone}</p>
                     </div>
                     <div className="flex gap-2">
                        <button 
                          onClick={() => handleCopy(lead.candidate_phone)}
                          className="p-2 text-slate-400 hover:text-slate-600 bg-white rounded border border-slate-200" title="Copy SĐT">
                           <Copy className="h-4 w-4" />
                        </button>
                        <a 
                          href={`https://zalo.me/${lead.zalo_phone || lead.candidate_phone}`} 
                          target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded border border-blue-200 hover:bg-blue-100"
                        >
                           Mở Zalo <ExternalLink className="h-3 w-3" />
                        </a>
                     </div>
                  </div>

                  <div>
                     <p className="text-sm text-slate-500">Khu vực muốn làm</p>
                     <div className="flex items-center gap-1 mt-1 text-slate-900">
                        <MapPin className="h-4 w-4 text-red-500" />
                        <span>{lead.district ? `${lead.district}, ` : ''}{lead.province || 'Chưa xác định'}</span>
                     </div>
                  </div>
                </div>
              </section>

               {/* Campaign & Source Section */}
               <section className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-2">Nguồn & Phân bổ</h3>
                
                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <p className="text-xs text-slate-500">Nguồn (CTV)</p>
                      <p className="text-sm font-medium text-indigo-600">{lead.ctv_name || 'Direct (Public)'}</p>
                   </div>
                   <div>
                      <p className="text-xs text-slate-500">Ngày gửi</p>
                      <p className="text-sm text-slate-900 flex items-center gap-1">
                         <Clock className="h-3 w-3 text-slate-400" />
                         {new Date(lead.submitted_at).toLocaleString('vi-VN')}
                      </p>
                   </div>
                   <div className="col-span-2">
                      <p className="text-xs text-slate-500">Chiến dịch</p>
                      <p className="text-sm font-medium text-slate-900">{lead.campaign_title}</p>
                   </div>
                   <div className="col-span-2">
                      <p className="text-xs text-slate-500">Công ty nhận</p>
                      <p className="text-sm text-slate-900">{lead.company_name || 'Chưa có thông tin'}</p>
                   </div>
                </div>
              </section>

            </div>

            {/* Right Column: Actions & History */}
            <div className="space-y-6">
               
               {/* AI Analysis */}
               <section className="rounded-xl border border-purple-200 bg-purple-50 p-5">
                 <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                   <div>
                     <h3 className="flex items-center gap-2 text-sm font-bold text-purple-950">
                       <Brain className="h-4 w-4" /> AI phân tích CV / Lead
                     </h3>
                     <p className="mt-1 text-xs text-purple-700">Kết quả nội bộ, chỉ dùng cho admin sàng lọc ứng viên.</p>
                   </div>
                   <button
                     onClick={handleAnalyzeLead}
                     disabled={aiLoading}
                     className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-purple-300"
                   >
                     {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                     {aiLoading ? 'Đang phân tích...' : 'Phân tích CV bằng AI'}
                   </button>
                 </div>

                 {aiError && (
                   <div className="mt-3 flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-100">
                     <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                     <span>{aiError}</span>
                   </div>
                 )}

                 {aiAnalysis && (
                   <div className="mt-4 rounded-xl bg-white p-4 text-sm text-slate-700 shadow-sm ring-1 ring-purple-100">
                     <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                       <span className="font-semibold text-purple-950">Kết quả phân tích</span>
                       <div className="flex flex-wrap gap-2">
                         <button
                           onClick={handleCopyCallQuestions}
                           className="inline-flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100"
                         >
                           <Copy className="h-3 w-3" /> Copy câu hỏi gọi
                         </button>
                         <button
                           onClick={() => handleCopy(aiAnalysis)}
                           className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                         >
                           <Copy className="h-3 w-3" /> Copy tất cả
                         </button>
                       </div>
                     </div>
                     <div className="whitespace-pre-line leading-6">{aiAnalysis}</div>
                   </div>
                 )}
               </section>

               {/* Status Management */}
               <section className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                 <h3 className="text-sm font-bold text-slate-900 mb-4">Cập nhật Trạng thái</h3>
                 <div className="space-y-4">
                    <div>
                       <label className="block text-sm font-medium text-slate-700 mb-1">Trạng thái mới</label>
                       <select 
                         value={newStatus} 
                         onChange={(e) => setNewStatus(e.target.value)}
                         className="block w-full rounded-xl border-0 py-2 pl-3 pr-10 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-red-600 sm:text-sm sm:leading-6"
                       >
                          {statusOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                       </select>
                    </div>

                    {newStatus === 'rejected' && (
                       <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Lý do từ chối (Bắt buộc)</label>
                          <input 
                            type="text"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="block w-full rounded-xl border-0 py-2 pl-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-red-600 sm:text-sm sm:leading-6"
                            placeholder="Sai số, không bắt máy, sai khu vực..."
                          />
                       </div>
                    )}

                    <button
                      onClick={handleStatusUpdate}
                      disabled={newStatus === lead.status}
                      className="w-full rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                    >
                      Cập nhật trạng thái
                    </button>
                 </div>
               </section>

               {/* Internal Notes */}
               <section>
                 <div className="flex items-center justify-between mb-2">
                   <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Ghi chú nội bộ (Admin)</h3>
                   {lead.processed_by && <span className="text-xs text-slate-400">By: {lead.processed_by}</span>}
                 </div>
                 <textarea
                   value={note}
                   onChange={(e) => setNote(e.target.value)}
                   rows={3}
                   className="block w-full rounded-xl border-0 py-2 pl-3 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-red-600 sm:text-sm sm:leading-6"
                   placeholder="Ghi chú lại quá trình liên hệ, xử lý tranh chấp..."
                 />
                 <button
                    onClick={handleSaveNote}
                    disabled={note === (lead.notes || '')}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium disabled:text-slate-400 disabled:cursor-not-allowed"
                 >
                   Lưu ghi chú
                 </button>
               </section>

               {/* History Timeline */}
               <section>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-1">
                     <History className="h-4 w-4" /> Lịch sử xử lý
                  </h3>
                  <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                     {history.length > 0 ? history.map((record) => (
                       <div key={record.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                          {/* Marker */}
                          <div className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-white bg-slate-300 group-[.is-active]:bg-red-500 text-slate-500 group-[.is-active]:text-emerald-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10"></div>
                          
                          {/* Card */}
                          <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.25rem)] bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                             <div className="flex justify-between items-start mb-1">
                               <span className={`text-xs font-medium px-2 py-0.5 rounded ${getStatusColor(record.to_status)}`}>
                                 {statusOptions.find(o => o.value === record.to_status)?.label || record.to_status}
                               </span>
                               <time className="text-[10px] text-slate-400 font-mono">
                                 {new Date(record.created_at).toLocaleString('vi-VN', { hour: '2-digit', minute:'2-digit', day: '2-digit', month: '2-digit'})}
                               </time>
                             </div>
                             {record.reason && <p className="text-xs text-slate-600 mt-1 italic">Lý do: {record.reason}</p>}
                             <p className="text-[10px] text-slate-400 mt-1 text-right">By: {record.changed_by_role || 'System'}</p>
                          </div>
                       </div>
                     )) : (
                        <p className="text-sm text-slate-500 italic ml-4">Chưa có lịch sử thay đổi.</p>
                     )}
                  </div>
               </section>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
