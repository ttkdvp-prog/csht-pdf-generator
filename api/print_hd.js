const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

export default async function handler(req, res) {
  // Chỉ chấp nhận GET requests cho việc in Link kết hợp lấy dữ liệu
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed. Must be GET request.' });
  }

  const { id } = req.query; // Ví dụ: ?id=CSHT_VPC_00446
  
  if (!id) {
    return res.status(400).send('<h1>Lỗi: Thiếu tham số ID trên URL! Cần truyền ?id=...</h1>');
  }

  // Khai báo biến môi trường (Lấy từ Vercel Settings)
  const appId = process.env.APPSHEET_APP_ID;
  const accessKey = process.env.APPSHEET_ACCESS_KEY;
  const tableName = process.env.APPSHEET_TABLE_NAME || 'CSHT';

  if (!appId || !accessKey) {
    return res.status(500).send('<h1>Lỗi hệ thống: Chưa cấu hình biến môi trường APPSHEET_APP_ID và APPSHEET_ACCESS_KEY trên Vercel.</h1>');
  }

  try {
    // 1. Gọi API AppSheet để lấy dữ liệu Row hiện tại
    const apiUrl = `https://api.appsheet.com/api/v2/apps/${appId}/tables/${tableName}/Action`;
    const appSheetRes = await axios.post(apiUrl, {
      "Action": "Find",
      "Properties": {
        "Selector": `Filter("${tableName}", [MaTram] = "${id}")` // Cần đảm bảo ID truyền vào là giá trị của cột MaTram
      },
      "Rows": []
    }, {
      headers: {
        'ApplicationAccessKey': accessKey,
        'Content-Type': 'application/json'
      }
    });

    if (!appSheetRes.data || appSheetRes.data.length === 0) {
      return res.status(404).send(`<h1>Lỗi: Không tìm thấy dữ liệu trên AppSheet cho mã: ${id}</h1>`);
    }

    const rowData = appSheetRes.data[0];

    // 2. Đọc file Template HTML chuẩn A4
    const templatePath = path.join(process.cwd(), 'templates', 'hopdong.html');
    let htmlContent = fs.readFileSync(templatePath, 'utf8');

    // 3. Mapping: Thay thế mọi từ khoá {{TenCot}} trong HTML bằng giá trị của AppSheet
    htmlContent = htmlContent.replace(/{{([^{}]+)}}/g, (match, paramKey) => {
      // paramKey có thể là thuộc tính hoặc một xử lý chuyên biệt (vd: ngay, tháng, năm)
      // Để đơn giản, map trực tiệp:
      const value = rowData[paramKey.trim()];
      return value !== undefined && value !== null ? value : '';
    });

    // 4. Khởi chạy Puppeteer để Render HTML thành PDF
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    
    // Nạp HTML vào page ảo
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // Cấu hình xuất file chuẩn A4, kích hoạt cho phép in bg graphic (CSS màu nền)
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,     
      margin: {
        top: '20mm',
        bottom: '20mm',
        left: '30mm',
        right: '20mm'
      }
    });

    await browser.close();

    // 5. Trả về cho trình duyệt định dạng PDF để hiển thị/in
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="HopDong_${id}.pdf"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error("Lỗi quá trình Render: ", error);
    res.status(500).send(`<h1>Đã có lỗi xảy ra trong quá trình sinh file in.</h1> <p>${error.message}</p>`);
  }
}
