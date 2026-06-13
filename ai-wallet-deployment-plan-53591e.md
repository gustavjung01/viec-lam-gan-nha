# AI Wallet Deployment Plan - 53591e

## Mục tiêu

Tài liệu này mô tả plan triển khai cho bản deploy đầy đủ của hệ thống, theo đúng luồng VPS của dự án `vieclamgannha.me`.

## Phạm vi

- Build frontend local
- Package frontend thành tarball
- Package backend release nếu có thay đổi backend
- Upload lên VPS bằng `scp`
- Giải nén vào `/var/www/viec-lam-gan-nha`
- Restart backend service
- Reload Nginx
- Verify health endpoint

## Cấu trúc thư mục đích trên VPS

- `/var/www/viec-lam-gan-nha/frontend`
- `/var/www/viec-lam-gan-nha/backend`
- `/var/www/viec-lam-gan-nha/backend/data`

## Luồng triển khai

1. Build frontend bằng `npm run build`.
2. Nén `dist/` thành `frontend-dist.tar.gz`.
3. Nén backend release thành `backend-release.tar.gz`, loại trừ:
   - `.env`
   - `data/`
   - `node_modules/`
   - file log local
4. Upload cả hai gói lên VPS.
5. Trên VPS:
   - giải nén frontend vào `frontend/`
   - giải nén backend vào `backend/`
   - cài dependencies backend nếu cần
   - restart `viec-lam-gan-nha.service`
   - `nginx -t`
   - reload nginx
6. Kiểm tra:
   - `http://127.0.0.1:3001/api/health`
   - root domain
   - các route SPA quan trọng

## Tiêu chí pass

- Root domain trả HTML của app.
- Route SPA không bị 404 khi refresh trực tiếp.
- `/api/health` trả `ok`.
- Backend service chạy bình thường.

## Rollback

- Khôi phục thư mục frontend backup nếu có.
- Khôi phục backend release trước đó nếu cần.
- Reload nginx sau khi rollback.

## Ghi chú an toàn

- Không dùng Vercel.
- Không đụng `.env`, key, hoặc DB live trên máy local.
- Không push git trong bước deploy.

