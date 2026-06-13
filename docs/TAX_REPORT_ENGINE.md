# Tax Report Engine - Báo Cáo Thuế

## 1. Mục tiêu

Tax Report Engine ghi nhận và xuất báo cáo:
- **Tổng tiền công ty thanh toán** cho lead
- **Phí sàn 20%** - doanh thu nền tảng
- **Hoa hồng CTV 80%** - chi CTV theo kỳ
- **Công nợ công ty** - nợ phải trả
- **Payout CTV** - đã thanh toán cho CTV
- **Chứng từ thanh toán** - hoá đơn, biên lai
- **Cảnh báo nghĩa vụ thuế có thể phát sinh** - không tự kết luận

**⚠️ Lưu ý quan trọng:**
Việc nền tảng có giữ tiền, khấu trừ, kê khai thay, hay CTV tự kê khai phụ thuộc vào:
- Mô hình pháp lý (hộ kinh doanh, cá nhân, công ty)
- Hợp đồng CTV và Company
- Quy định thuế hiện hành tại thời điểm triển khai

Engine chỉ báo cáo/cảnh báo, không tự kết luận nghĩa vụ thuế.

## 2. Quy định tham khảo (VN) - Cần cập nhật theo thời điểm

### 2.1 Thuế TNCN đối với CTV

Theo Luật Thuế TNCN và các Thông tư hướng dẫn (cần kiểm tra hiệu lực):

| Thu nhập | Thuế suất tham khảo | Ghi chú |
|----------|---------------------|---------|
| Dưới 2 triệu/lần | 10% | Thu nhập từ kinh doanh, hoa hồng |
| Trên 2 triệu/lần | 10% hoặc theo MST | Tùy hình thức kê khai |
| Tổng năm > ngưỡng | Theo biểu lũy tiến | Nếu có MST cá nhân |

**⚠️ Engine ghi nhận và cảnh báo:**
- Tính toán số liệu thu nhập, phí, hoa hồng
- Cảnh báo khi thu nhập vượt ngưỡng có thể phát sinh nghĩa vụ thuế
- Không tự động khấu trừ hay nộp thay CTV/Company

### 2.2 Hoá đơn và chứng từ

**Platform xuất:**
- Hoá đơn cho Company: "Dịch vụ môi giới việc làm"
- Báo cáo thu nhập cho CTV: Export CSV/PDF
- **Không tự xuất:** Form 02/KK-TNCN (CTV tự kê khai hoặc qua tổ chức cá nhân)

**Company cần có:**
- Hoá đơn từ Platform
- Biên lai thanh toán cho lead
- Hợp đồng dịch vụ (nếu có)

## 3. Data Model cho Tax

```typescript
// Tax withholding record (khấu trừ thuế)
interface TaxWithholding {
  id: string;
  
  // Relations
  ctvId: string;
  commissionId: string;
  
  // Số tiền
  grossAmount: number;        // Hoa hồng gốc
  taxRate: number;            // 10% hoặc theo MST
  taxAmount: number;          // Số thuế khấu trừ
  netAmount: number;          // CTV nhận thực tế
  
  // Thông tin thuế
  hasTaxCode: boolean;        // CTV có MST không
  taxCode?: string;           // MST cá nhân nếu có
  
  // Kỳ tính thuế
  taxPeriod: string;          // "2026-05" (YYYY-MM)
  taxYear: number;            // 2026
  
  // Chứng từ
  withholdingDocUrl?: string; // PDF chứng từ khấu trừ
  
  // Trạng thái
  status: 'pending' | 'withheld' | 'remitted' | 'reported';
  
  // Timeline
  createdAt: Date;
  withheldAt?: Date;
  remittedAt?: Date;          // Nộp thuế cho Tổng cục Thuế
}

// Tax report summary theo kỳ
interface TaxReport {
  id: string;
  
  // Kỳ báo cáo
  period: string;             // "2026-05"
  year: number;
  
  // Tổng hợp
  totalCommissions: number;   // Tổng hoa hồng phát sinh
  totalTaxWithheld: number;   // Tổng thuế đã khấu trừ
  totalNetPaid: number;       // Tổng đã trả CTV
  
  // Chi tiết
  ctvCount: number;           // Số CTV có hoa hồng
  commissionCount: number;    // Số giao dịch
  
  // Thresholds
  aboveThresholdCount: number; // Số CTV > 2 triệu
  belowThresholdCount: number; // Số CTV < 2 triệu
  
  // Chứng từ
  form02KKUrl?: string;       // File 02/KK-TNCN
  summaryReportUrl?: string;    // Báo cáo tổng hợp
  
  // Trạng thái
  status: 'draft' | 'submitted' | 'approved' | 'filed';
  
  // Audit
  createdAt: Date;
  submittedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
}

// Company expense record (cho Công ty tuyển dụng)
interface CompanyExpense {
  id: string;
  
  companyId: string;
  
  // Thông tin chi phí
  expenseType: 'lead_reward' | 'platform_fee' | 'deposit';
  amount: number;
  
  // Lead liên quan
  leadId?: string;
  campaignId?: string;
  
  // Chứng từ
  invoiceNumber?: string;
  invoiceDate?: Date;
  invoiceUrl?: string;
  
  // Kỳ
  period: string;             // "2026-05"
  year: number;
  
  // Deductible (được trừ khi tính thuế TNDN)
  isTaxDeductible: boolean;
  
  // Trạng thái
  status: 'pending' | 'confirmed' | 'included_in_report';
  
  createdAt: Date;
}
```

## 4. Tax Calculation Engine

### 4.1 Flow tính thuế

```
Commission ready for payout
  → Check CTV tax info
    → Có MST?
      → Có → Hỏi CTV muốn áp dụng biểu lũy tiến không?
        → Có → Tính theo biểu lũy tiến (có thể cao hơn 10%)
        → Không → Dùng 10% flat
      → Không MST → 10% flat
  
  → Calculate
    grossAmount = 5,000,000
    taxRate = 10%
    taxAmount = 500,000
    netAmount = 4,500,000
  
  → Create TaxWithholding record
  
  → Add to monthly TaxReport
  
  → Payout netAmount to CTV
```

### 4.2 API Endpoints

```typescript
// Admin only
GET  /api/admin/tax/reports              → Danh sách báo cáo thuế
GET  /api/admin/tax/reports/:period      → Chi tiết 1 kỳ
POST /api/admin/tax/reports/:period/generate  → Tạo báo cáo
POST /api/admin/tax/reports/:period/submit    → Submit báo cáo

// CTV
GET  /api/ctv/tax/summary                → Tổng quan thuế của tôi
GET  /api/ctv/tax/withholdings           → Chi tiết khấu trừ
GET  /api/ctv/tax/documents/:year        → Tải chứng từ năm

// Company
GET  /api/company/tax/expenses         → Chi phí được trừ
GET  /api/company/tax/invoices         → Hoá đơn dịch vụ
```

## 5. Báo cáo theo kỳ

### 5.1 Monthly Tax Report (Admin)

```
BÁO CÁO THUẾ TNCN THÁNG 05/2026

I. TỔNG HỢP
- Tổng hoa hồng phát sinh:           150,000,000 VND
- Tổng thuế đã khấu trừ:            15,000,000 VND
- Tổng đã trả CTV (net):            135,000,000 VND
- Số CTV tham gia:                  45 người

II. PHÂN LOẠI THEO THUẾ SUẤT
- Áp dụng 10% flat:                 150,000,000 VND
- Áp dụng biểu lũy tiến:            0 VND (chưa có CTV đăng ký MST)

III. PHÂN LOẠI THEO NGƯỠNG
- Thu nhập > 2 triệu/lần:           32 giao dịch, 12 CTV
- Thu nhập < 2 triệu/lần:          18 giao dịch, 8 CTV

IV. CHỨNG TỪ
- Form 02/KK-TNCN:                  [Download]
- Danh sách chi tiết:               [Download CSV]
- Hoá đơn dịch vụ:                  [Download ZIP]

V. TRẠNG THÁI
- Status: READY_FOR_SUBMISSION
- Deadline nộp: 20/06/2026
```

### 5.2 CTV Annual Summary

```
TỔNG KẾT THUẾ NĂM 2026 - CTV001

Tổng thu nhập:                      45,000,000 VND
Tổng thuế đã khấu trừ:              4,500,000 VND
Số giao dịch:                       23 lần

Tháng cao nhất:                     Tháng 8 (8,000,000 VND)
Trung bình/tháng:                   3,750,000 VND

Chứng từ khấu trừ:                  [Download PDF]
Mẫu quyết toán thuế:                [Download TNCN form]
```

## 6. Integration với External

### 6.1 Tổng cục Thuế (nếu có API)

- Submit Form 02/KK-TNCN điện tử
- Nhận biên lai nộp thuế
- Tra cứu trạng thái nộp

### 6.2 Accounting Software

Export formats:
- Excel (CSV/XLSX)
- PDF (chứng từ)
- JSON (API integration)
- XML (nếu yêu cầu)

## 7. Compliance Checklist

| Yêu cầu | Tần suất | Người làm | Status |
|---------|----------|-----------|--------|
| Khấu trừ thuế khi trả CTV | Real-time | System | Auto |
| Tổng hợp tháng | Hàng tháng | System | Auto |
| Review báo cáo | Hàng tháng | Admin | Manual |
| Nộp Form 02/KK-TNCN | Hàng tháng | Admin | Manual |
| Nộp thuế | Hàng tháng | Admin | Manual |
| Tổng kết năm cho CTV | Hàng năm | System | Auto |
| Quyết toán thuế năm | Hàng năm | Kế toán | Manual |

## 8. Lưu ý quan trọng

### 8.1 Không tư vấn thuế
- Platform cung cấp công cụ tính toán
- CTV tự chịu trách nhiệm quyết toán thuế cuối năm
- Khuyến nghị CTV đăng ký MST để tối ưu thuế

### 8.2 Thay đổi quy định
- Theo dõi Thông tư mới từ Bộ Tài chính
- Update tax rate trong config
- Notify CTV khi có thay đổi

### 8.3 Backup & Audit
- Giữ chứng từ điện tử tối thiểu 10 năm
- Backup định kỳ hàng ngày
- Audit trail đầy đủ cho mọi thay đổi số thuế
