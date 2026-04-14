const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ============================================================
// Hàm định dạng số tiền: 6000000 -> "6.000.000"
// ============================================================
function formatCurrency(value) {
  const num = parseInt((value || '').toString().replace(/\D/g, ''), 10);
  if (isNaN(num)) return '';
  return num.toLocaleString('vi-VN').replace(/,/g, '.');
}

// ============================================================
// Hàm đọc số thành chữ tiếng Việt
// ============================================================
function numberToWords(value) {
  const num = parseInt((value || '').toString().replace(/\D/g, ''), 10);
  if (isNaN(num) || num === 0) return 'Không đồng';

  const units = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const teens = ['mười', 'mười một', 'mười hai', 'mười ba', 'mười bốn', 'mười lăm', 'mười sáu', 'mười bảy', 'mười tám', 'mười chín'];
  
  function readTriple(n) {
    const h = Math.floor(n / 100);
    const t = Math.floor((n % 100) / 10);
    const u = n % 10;
    let result = '';
    if (h > 0) result += units[h] + ' trăm ';
    if (t === 0 && u === 0) return result.trim();
    if (t === 0 && h > 0) { result += 'linh ' + units[u]; return result.trim(); }
    if (t === 1) { result += teens[u]; return result.trim(); }
    result += units[t] + ' mươi';
    if (u === 5) result += ' lăm';
    else if (u > 0) result += ' ' + units[u];
    return result.trim();
  }

  const tỷ = Math.floor(num / 1_000_000_000);
  const triệu = Math.floor((num % 1_000_000_000) / 1_000_000);
  const nghìn = Math.floor((num % 1_000_000) / 1_000);
  const lẻ = num % 1_000;

  let result = '';
  if (tỷ > 0) result += readTriple(tỷ) + ' tỷ ';
  if (triệu > 0) result += readTriple(triệu) + ' triệu ';
  if (nghìn > 0) result += readTriple(nghìn) + ' nghìn ';
  if (lẻ > 0) result += readTriple(lẻ);

  result = result.trim();
  // Viết hoa chữ đầu
  result = result.charAt(0).toUpperCase() + result.slice(1) + ' đồng';
  return result;
}


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

    // Tự động format số tiền và sinh chữ tiếng Việt
    const rawSoTien = rowData['SotienThanhToan'] || '';
    rowData['SotienThanhToan'] = formatCurrency(rawSoTien);
    if (!rowData['SotienThanhToanBangChu'] || rowData['SotienThanhToanBangChu'].trim() === '') {
      rowData['SotienThanhToanBangChu'] = numberToWords(rawSoTien);
    }

    // Thay thế tất cả các placeholder {{key}}
    htmlContent = htmlContent.replace(/{{([^{}]+)}}/g, (match, paramKey) => {
      const value = rowData[paramKey.trim()];
      return value !== undefined && value !== null ? value : '';
    });


    // Xử lý hiển thị có điều kiện: khối ủy quyền vs trực tiếp
    const hasProxy = (rowData['CoUyQuyenNhanTien'] || '').toString().toUpperCase() === 'TRUE';
    if (hasProxy) {
      // Có ủy quyền: Giữ khối UQ, xóa khối DIRECT
      htmlContent = htmlContent.replace(/<!--IF_DIRECT_START-->[\s\S]*?<!--IF_DIRECT_END-->/g, '');
      htmlContent = htmlContent.replace(/<!--IF_UQ_START-->/g, '').replace(/<!--IF_UQ_END-->/g, '');
    } else {
      // Không có ủy quyền: Giữ khối DIRECT, xóa khối UQ (kể cả trang Giấy Ủy Quyền)
      htmlContent = htmlContent.replace(/<!--IF_UQ_START-->[\s\S]*?<!--IF_UQ_END-->/g, '');
      htmlContent = htmlContent.replace(/<!--IF_DIRECT_START-->/g, '').replace(/<!--IF_DIRECT_END-->/g, '');
    }

    // Trả thẳng HTML chuẩn mực A4 cho trình duyệt kèm lệnh tự động mở hộp thoại In/Lưu PDF
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(htmlContent);

  } catch (error) {
    console.error(error);
    res.status(500).send(`<h1>Đã có API lỗi xảy ra:</h1> <p>${error.message}</p>`);
  }
}
