const axios = require('axios');
const fs = require('fs');
const path = require('path');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Chỉ hỗ trợ GET request.' });
  }

  const { id } = req.query; 
  if (!id) return res.status(400).send('<h1>Lỗi: Thiếu tham số ?id=</h1>');

  const appId = process.env.APPSHEET_APP_ID;
  const accessKey = process.env.APPSHEET_ACCESS_KEY;
  const tableName = process.env.APPSHEET_TABLE_NAME || 'CSHT';

  if (!appId || !accessKey) {
    return res.status(500).send('<h1>Lỗi hệ thống: Chưa cấu hình biến môi trường trên Vercel.</h1>');
  }

  try {
    const apiUrl = `https://api.appsheet.com/api/v2/apps/${appId}/tables/${tableName}/Action`;
    const appSheetRes = await axios.post(apiUrl, {
      "Action": "Find",
      "Properties": {
        "Selector": `Filter("${tableName}", [MaTram] = "${id}")`
      },
      "Rows": []
    }, {
      headers: {
        'ApplicationAccessKey': accessKey,
        'Content-Type': 'application/json'
      }
    });

    if (!appSheetRes.data || appSheetRes.data.length === 0) {
      return res.status(404).send(`<h1>Lỗi: Không tìm thấy hợp đồng nào có mã: ${id} trên AppSheet</h1>`);
    }

    const rowData = appSheetRes.data[0];

    const templatePath = path.join(process.cwd(), 'templates', 'hopdong.html');
    let htmlContent = fs.readFileSync(templatePath, 'utf8');

    htmlContent = htmlContent.replace(/{{([^{}]+)}}/g, (match, paramKey) => {
      const value = rowData[paramKey.trim()];
      return value !== undefined && value !== null ? value : '';
    });

    // Trả thẳng HTML chuẩn mực A4 cho trình duyệt kèm lệnh tự động mở hộp thoại In/Lưu PDF
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(htmlContent);

  } catch (error) {
    console.error(error);
    res.status(500).send(`<h1>Đã có API lỗi xảy ra:</h1> <p>${error.message}</p>`);
  }
}
