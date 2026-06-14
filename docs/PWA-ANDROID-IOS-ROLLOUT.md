# PWA Android/iPhone rollout

Mục tiêu: cho ứng viên, công ty và CTV cài tạm website như app trên Android/iPhone trước khi có app store.

## 1. Điều kiện bắt buộc

- Production phải chạy HTTPS hợp lệ.
- `index.html` phải có `<link rel="manifest" href="/manifest.webmanifest" />`.
- Phải register `/sw.js` với scope `/`.
- Không cache API: mọi request `/api/*` phải đi network trực tiếp.
- Mỗi lần deploy phải sinh `dist/build-info.json` mới để app tự phát hiện bản mới.

## 2. Android

Android Chrome thường tự hiện tùy chọn cài app khi đủ điều kiện:

- Manifest hợp lệ.
- Có service worker.
- Có icon.
- Site chạy HTTPS.

Cách kiểm tra:

1. Mở Chrome Android.
2. Vào domain production.
3. Mở menu ⋮.
4. Chọn `Install app` hoặc `Add to Home screen`.
5. Mở app từ màn hình chính và kiểm tra app chạy fullscreen/standalone.

## 3. iPhone/iPad

iPhone khó hơn Android vì Safari không hiện flow cài rõ như Play Store. Phải hướng dẫn người dùng thủ công:

1. Mở website bằng Safari, không dùng Chrome/Facebook/Zalo in-app browser.
2. Bấm nút Share.
3. Chọn `Add to Home Screen`.
4. Bấm `Add`.
5. Mở app từ icon ngoài màn hình chính.

Lưu ý quan trọng:

- iPhone chỉ chạy PWA đúng nhất khi người dùng mở bằng icon ngoài Home Screen.
- In-app browser của Facebook/Zalo thường không đủ quyền cài PWA.
- Nên có icon PNG `180x180` cho `apple-touch-icon`. Hiện repo đang dùng SVG vì connector chỉ ghi text file; cần bổ sung PNG thật khi deploy production.
- Nếu icon không hiện đẹp trên iPhone, thêm file `/images/brand/apple-touch-icon.png` kích thước 180x180 và đổi `index.html` sang file PNG đó.

## 4. Tự update khi có bản mới

Repo đang dùng 2 lớp chống kẹt cache:

1. Service worker `/sw.js` dùng `skipWaiting()` và `clients.claim()` để kích hoạt bản mới ngay.
2. Frontend `src/lib/pwaRegistration.ts` tự poll `/build-info.json` mỗi 30 phút và khi app quay lại foreground. Nếu `commit`, `buildTime` hoặc `indexAsset` đổi thì app reload.

Điều này xử lý lỗi thường gặp: app đã cài trên iPhone/Android nhưng cứ giữ bản cũ sau deploy.

## 5. Cấu hình Nginx/VPS khuyến nghị

Không để browser cache các file điều khiển PWA:

```nginx
location = /sw.js {
  add_header Cache-Control "no-cache, no-store, must-revalidate";
  try_files $uri =404;
}

location = /manifest.webmanifest {
  add_header Cache-Control "no-cache";
  try_files $uri =404;
}

location = /build-info.json {
  add_header Cache-Control "no-cache, no-store, must-revalidate";
  try_files $uri =404;
}
```

Assets Vite có hash trong tên file nên có thể cache dài:

```nginx
location /assets/ {
  add_header Cache-Control "public, max-age=31536000, immutable";
  try_files $uri =404;
}
```

## 6. Checklist test sau deploy

- [ ] Chrome Android thấy `Install app` / `Add to Home screen`.
- [ ] Safari iPhone thêm được bằng `Share > Add to Home Screen`.
- [ ] Mở từ icon iPhone không hiện thanh địa chỉ Safari.
- [ ] Tắt mạng vẫn mở được màn hình đã cache gần nhất.
- [ ] Deploy bản mới, mở lại app, app tự reload lên bản mới.
- [ ] API không bị cache sai dữ liệu.
- [ ] `/sw.js`, `/manifest.webmanifest`, `/build-info.json` trả header `Cache-Control: no-cache` hoặc `no-store`.
