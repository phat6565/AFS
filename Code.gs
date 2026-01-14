function doGet(e) {
  // Nếu có tham số action, xử lý như một API request (GET)
  if (e && e.parameter && e.parameter.action) {
    return handleApiRequest(e.parameter.action, e.parameter);
  }

  // Mặc định trả về trang index (dành cho Apps Script Web App URL)
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle("Hệ Thống Quản Trị Neon V8") 
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("Không tìm thấy dữ liệu POST (e.postData rỗng)");
    }
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;
    return handleApiRequest(action, postData);
  } catch (error) {
    console.error("Error in doPost:", error.message);
    return ContentService.createTextOutput(JSON.stringify({
      error: "Backend Error: " + error.message,
      success: false
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function handleApiRequest(action, data) {
  let result;
  try {
    switch (action) {
      case 'loginSystem':
        result = loginSystem(data.email, data.password);
        break;
      case 'getInitialData':
        result = getInitialData();
        break;
      case 'saveData':
        result = saveData(data.type, data.data);
        break;
      case 'deleteData':
        result = deleteData(data.type, data.id);
        break;
      case 'runAIAnalysis':
        result = runAIAnalysis();
        break;
      case 'logActivity':
        logActivity(data.actionName, data.detail);
        result = { success: true };
        break;
      default:
        throw new Error("Hành động không hợp lệ: " + action);
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      error: error.message,
      success: false
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/* 2. QUẢN LÝ DATABASE */
function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  
  if (!sheet) {
    sheet = ss.insertSheet(name);
    // Header Tiếng Việt
    if (name === 'DuAn') sheet.appendRow(['ID', 'Ten', 'QuanLy', 'BatDau', 'KetThuc', 'TrangThai', 'TienDo', 'MoTa', 'TaiLieu']);
    if (name === 'CongViec') sheet.appendRow(['ID', 'Ten', 'ProjectID', 'NguoiLam', 'TrangThai', 'UuTien', 'Deadline', 'TaiLieu']);
    if (name === 'TaiChinh') sheet.appendRow(['ID', 'NoiDung', 'SoTien', 'Loai', 'Ngay', 'DoiTuong']);
    if (name === 'TaiSan') sheet.appendRow(['ID', 'TenTS', 'SoLuong', 'GiaTri', 'NgayNhap', 'TinhTrang']);
    if (name === 'KhachHang') sheet.appendRow(['ID', 'TenKH', 'LienHe', 'Email', 'GhiChu']);
    if (name === 'NhatKy') sheet.appendRow(['ID', 'HanhDong', 'ChiTiet', 'ThoiGian', 'NguoiThucHien']);
    if (name === 'BinhLuan') sheet.appendRow(['ID', 'ParentID', 'NguoiDung', 'NoiDung', 'ThoiGian']);
    if (name === 'NguoiDung') {
      sheet.appendRow(['ID', 'Ten', 'Email', 'MatKhau', 'VaiTro', 'Avatar']);
      sheet.appendRow(['U01', 'Quản Trị Viên', 'admin', '123', 'Admin', 'https://ui-avatars.com/api/?name=Admin&background=00f2ff&color=000']);
    }
  }
  return sheet;
}

/* 3. XỬ LÝ ĐĂNG NHẬP */
function loginSystem(email, password) {
  const users = getData('NguoiDung');
  const user = users.find(u => String(u.email).trim() == String(email).trim() && String(u.password).trim() == String(password).trim());
  
  if (user) return user;
  if (email === 'admin' && password === '123') {
    return { name: 'Super Admin', email: 'admin', role: 'Admin', avatar: 'https://ui-avatars.com/api/?name=SA&background=ff00ff&color=000' };
  }
  throw new Error("Sai tài khoản hoặc mật khẩu hệ thống!");
}

/* 4. API LẤY DỮ LIỆU */
function getInitialData() {
  return {
    projects: getData('DuAn'),
    tasks: getData('CongViec'),
    finance: getData('TaiChinh'),
    assets: getData('TaiSan'),
    clients: getData('KhachHang'),
    logs: getData('NhatKy').reverse().slice(0, 50),
    comments: getData('BinhLuan'),
    users: getData('NguoiDung')
  };
}

function getData(sheetName) {
  const sheet = getSheet(sheetName);
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];
  
  const headers = rows.shift(); // Giữ nguyên case header để dùng trong JS
  
  return rows.map(row => {
    let obj = {};
    headers.forEach((h, i) => {
      if(row[i] instanceof Date) {
        // Format chuẩn cho cả ngày và giờ
        obj[h] = Utilities.formatDate(row[i], Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
      } else {
        obj[h] = row[i];
      }
    });
    return obj;
  });
}

function logActivity(action, detail) {
  const sheet = getSheet('NhatKy');
  const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  sheet.appendRow([new Date().getTime(), action, detail, now, 'Admin']);
}

/* 5. API LƯU DỮ LIỆU (UPSERT) */
function saveData(type, data) {
  let sheetName = '';
  let idPrefix = '';
  
  switch(type) {
    case 'project': sheetName = 'DuAn'; idPrefix = 'DA_'; break;
    case 'task': sheetName = 'CongViec'; idPrefix = 'CV_'; break;
    case 'finance': sheetName = 'TaiChinh'; idPrefix = 'TC_'; break;
    case 'asset': sheetName = 'TaiSan'; idPrefix = 'TS_'; break;
    case 'client': sheetName = 'KhachHang'; idPrefix = 'KH_'; break;
    case 'user': sheetName = 'NguoiDung'; idPrefix = 'NV_'; break;
    case 'comment': sheetName = 'BinhLuan'; idPrefix = 'BL_'; break;
  }
  
  const sheet = getSheet(sheetName);
  const rows = sheet.getDataRange().getValues();
  
  let id = data.ID;
  if (!id) {
    id = idPrefix + new Date().getTime();
    data.ID = id;
  }
  
  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) { rowIndex = i; break; }
  }
  
  const header = rows[0];
  const newRow = header.map(colName => {
    let val = data[colName] || '';
    if(colName === 'ID') val = id;
    return val;
  });
  
  if (rowIndex > 0) {
    sheet.getRange(rowIndex + 1, 1, 1, newRow.length).setValues([newRow]);
    if(type !== 'comment') logActivity('UPDATE', `Cập nhật ${type}: ${id}`);
  } else {
    sheet.appendRow(newRow);
    if(type !== 'comment') logActivity('CREATE', `Tạo mới ${type}: ${id}`);
  }
  
  return getInitialData();
}

/* 6. API XÓA DỮ LIỆU */
function deleteData(type, id) {
  let sheetName = '';
  switch(type) {
    case 'project': sheetName = 'DuAn'; break;
    case 'task': sheetName = 'CongViec'; break;
    case 'finance': sheetName = 'TaiChinh'; break;
    case 'asset': sheetName = 'TaiSan'; break;
    case 'client': sheetName = 'KhachHang'; break;
    case 'user': sheetName = 'NguoiDung'; break;
    case 'comment': sheetName = 'BinhLuan'; break;
  }
  
  const sheet = getSheet(sheetName);
  const rows = sheet.getDataRange().getValues();
  
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      if(type !== 'comment') logActivity('DELETE', `Xóa ${type}: ${id}`);
      break;
    }
  }
  
  return getInitialData();
}


/* 7. AI ENGINE (GEMINI INTEGRATION) */
const GEMINI_API_KEY = 'AIzaSyCsDpnR-b3Uv8yVrtCH2Lqwd0frL7SAIko';

// HÀM NÀY ĐỂ ÉP HIỆN BẢNG CẤP QUYỀN - CHỈ CHẠY 1 LẦN
function forceAuthorize() {
  UrlFetchApp.fetch("https://google.com");
  SpreadsheetApp.getActive();
}

function runAIAnalysis() {
  // Kiểm tra cache (lưu kết quả 30 phút)
  const cache = PropertiesService.getScriptProperties();
  const cacheKey = 'ai_insights_cache';
  const cacheTime = 'ai_insights_time';
  
  const cached = cache.getProperty(cacheKey);
  const cachedTime = cache.getProperty(cacheTime);
  
  // Nếu có cache và chưa quá 30 phút, trả về luôn
  if (cached && cachedTime) {
    const elapsed = (new Date().getTime() - parseInt(cachedTime)) / 1000 / 60;
    if (elapsed < 30) {
      return JSON.parse(cached);
    }
  }
  
  const data = getInitialData();
  const prompt = `Bạn là một chuyên gia quản lý dự án AI. Hãy phân tích dữ liệu sau và đưa ra 3-4 nhận định (insights) ngắn gọn, sắc bén bằng tiếng Việt.
  Mỗi nhận định phải có: tiêu đề (viết hoa), nội dung phân tích, và mức độ quan trọng (HIGH, MEDIUM, LOW).
  
  DỮ LIỆU DỰ ÁN: ${JSON.stringify(data.projects.map(p => ({ten: p.Ten, tienDo: p.TienDo, trangThai: p.TrangThai})))}
  DỮ LIỆU TÀI CHÍNH: ${JSON.stringify(data.finance.map(f => ({loai: f.Loai, soTien: f.SoTien})))}
  DỮ LIỆU NHIỆM VỤ: ${JSON.stringify(data.tasks.map(t => ({ten: t.Ten, trangThai: t.TrangThai, uuTien: t.UuTien})))}
  
  Trả về kết quả dưới dạng JSON array: [{"title": "...", "text": "...", "level": "HIGH/MEDIUM/LOW", "icon": "fire/info-circle/check-double/exclamation-triangle"}]`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
  
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json" }
  };

  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();
    
    if (responseCode !== 200) {
      console.error("Gemini API Error:", responseBody);
      return [{ title: "LỖI API (" + responseCode + ")", text: "Gemini phản hồi lỗi. kiểm tra API Key hoặc hạn mức.", level: "HIGH", icon: "exclamation-triangle" }];
    }

    const result = JSON.parse(responseBody);
    if (!result.candidates || !result.candidates[0].content) {
       console.error("Malformed result:", result);
       return [{ title: "LỖI XỬ LÝ AI", text: "Kết quả từ AI không đúng định dạng.", level: "MEDIUM", icon: "robot" }];
    }
    let aiText = result.candidates[0].content.parts[0].text;
    
    // Xử lý nếu AI trả về kèm markdown ```json ... ```
    if (aiText.includes('```')) {
      aiText = aiText.split('```')[1];
      if (aiText.startsWith('json')) aiText = aiText.substring(4);
      aiText = aiText.split('```')[0];
    }
    
    try {
      const result = JSON.parse(aiText.trim());
      // Lưu vào cache
      cache.setProperty(cacheKey, JSON.stringify(result));
      cache.setProperty(cacheTime, new Date().getTime().toString());
      return result;
    } catch (parseError) {
      console.error("JSON Parse Error:", aiText);
      return [{ title: "LỖI ĐỊNH DẠNG AI", text: "AI trả về dữ liệu không thể đọc được.", level: "MEDIUM", icon: "code" }];
    }
  } catch (e) {
    console.error("AI Fetch Error:", e);
    return [{ title: "LỖI HỆ THỐNG AI", text: "Lỗi kết nối nghiêm trọng: " + e.toString(), level: "HIGH", icon: "wifi" }];
  }
}
