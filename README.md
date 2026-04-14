# Hướng Dẫn Kích Hoạt API Sinh PDF Hợp Đồng (Vercel + AppSheet)

Hệ thống mã nguồn này đã được cấu hình sắn để tự động kết nối vào AppSheet, lấy dữ liệu form khi có một Request ID gửi vào, dùng Puppeteer để vẽ ra một file PDF chuẩn A4 siêu đẹp và ném về ngay cửa sổ Trình duyệt của bạn.

## BƯỚC 1: Push mã nguồn này lên Github
1. Hãy tạo 1 Repository mới trên Github (vd: `csht-pdf-generator`).
2. Mở cmd / powershell ở chính thư mục `vercel-pdf-api` này và đẩy code lên:
```bash
git init
git add .
git commit -m "Init API render PDF"
git branch -M main
git remote add origin https://github.com/TênTàiKhoảnCủaBạn/csht-pdf-generator.git
git push -u origin main
```

## BƯỚC 2: Tải lên Vercel và Cấu hình Biến môi trường
1. Truy cập [Vercel](https://vercel.com/), đăng nhập bằng Github.
2. Chọn **Add New -> Project**. Import Repository bạn vừa tạo ở Bước 1.
3. Ở màn hình `Configure Project`, bấm xổ mục **Environment Variables** (Biến môi trường) ra và thêm 3 biến sau:
   - `APPSHEET_APP_ID`: Điền ID của AppSheet (Xem hướng dẫn BƯỚC 3).
   - `APPSHEET_ACCESS_KEY`: Điền API Key của AppSheet.
   - `APPSHEET_TABLE_NAME`: Điền chữ `CSHT` (chính là tên bảng chứa dữ liệu hợp đồng của bạn).
4. Nhấn **Deploy**. Sau khoảng 1 phút, Vercel sẽ cấp cho bạn đường link dự án, ví dụ: `https://csht-pdf-generator.vercel.app`

## BƯỚC 3: Lấy thông tin kết nối nền tảng AppSheet (App ID & Access Key)
Để Vercel có thể đọc dữ liệu, bạn cần báo cho AppSheet biết:
1. Mở AppSheet, chọn ứng dụng của bạn. Vào menu **Settings** -> **Integrations** (hoặc tab **Security**) -> Tích bật tính năng `Enable` hoặc `IN: from cloud services to this app`.
2. Lấy **App ID**: Nằm ngay tại thẻ Settings -> Information hoặc trên URL thanh trình duyệt (Đoạn mã rất dài: ví dụ `8913801-43fd...`).
3. Tạo **Access Key**: Ngay trong thẻ *Integrations* (hoặc thẻ Manage->Integrations), chọn `Create Application Access Key`. App sẽ tự sinh ra đoạn key mới. Copy bỏ vào Vercel (Bước 2).

## BƯỚC 4: Tạo Nút "Mở File In PDF" trên AppSheet
Quay lại AppSheet, ta sẽ dọn một nút bấm mở thẳng file sau 1 giây:
1. Vào **Actions** -> Dưới bảng dữ liệu `CSHT`, nhấn tạo nút mới.
2. **Action name**: `Mở In Hợp Đồng`
3. **Do this**: `External: go to a website` (Đi tới một trang web).
4. **Target**: Điền công thức nối link:
   ```text
   CONCATENATE("https://csht-pdf-generator.vercel.app/api/print_hd?id=", [MaTram])
   ```
   *(Hãy thay đoạn `https://csht-pdf-generator.vercel.app` bằng cái Domain thực tế Vercel cấp cho bạn lúc nãy).*
5. **Appearance**: Chọn Logo máy in, tích vào Display Prominently.

Thế là xong. Giờ ở AppSheet, khi Cán bộ nhấn Nút **Mở In Hợp Đồng**, trình duyệt sẽ mở Link API -> Vercel tự động nhận ID `MaTram`, tự động fetch hết dữ liệu người đó, ráp vào Template HTML và trả về cho bạn 1 file PDF A4 sắc nét căng màn hình luôn!
