# QA Screenshots

**Lưu ý:** Không thể chụp screenshot tự động từ dev server đang chạy.

## Hướng dẫn chụp thủ công

1. Chạy dev server:
   ```bash
   npm run dev
   ```

2. Mở Chrome DevTools (F12)

3. Bật Device Toolbar (Ctrl+Shift+M)

4. Chọn các kích thước cần kiểm tra:
   - iPhone 14 (390x844)
   - iPhone 14 Pro Max (430x932)
   - iPad Mini (768x1024)
   - Desktop (1366x768)

5. Truy cập các route và chụp:
   - http://localhost:5175/
   - http://localhost:5175/viec-lam
   - http://localhost:5175/viec-lam/nhan-vien-bao-ve-ca-ngay
   - http://localhost:5175/nha-tuyen-dung

## Danh sách ảnh cần có:

### Desktop (1366px)
- [ ] home-desktop.png
- [ ] jobs-desktop.png
- [ ] detail-desktop.png
- [ ] dashboard-desktop.png

### Mobile (390px)
- [ ] home-mobile.png
- [ ] jobs-mobile.png
- [ ] apply-modal-mobile.png

## Checklist Mobile QA:

- [ ] Header không vỡ, menu icon hiển thị
- [ ] Hero không tràn ngang
- [ ] Filter xếp dọc dễ bấm
- [ ] Job card không tràn chữ
- [ ] Popup ứng tuyển nằm giữa, nút Gửi không bị khuất
- [ ] Dashboard scroll ngang nếu cần

---

*QA thực hiện thủ công qua DevTools*
