// --- API CONFIGURATION ---
const API_URL = 'https://script.google.com/macros/s/AKfycbwfK_X_0UOhe1GyEO7JlX_kf_szJEw_KzMDUhtI9jTuULyyBz9WAwGCqqxB7OVk09EZ/exec';

async function callApi(action, data = {}) {
    const payload = { action, ...data };
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            redirect: 'follow'
        });
        const text = await response.text();
        try {
            const result = JSON.parse(text);
            if (result.error) throw new Error(result.error);
            return result;
        } catch (e) {
            console.error("Non-JSON response:", text);
            throw new Error("Phản hồi từ Server không đúng định dạng.");
        }
    } catch (error) {
        console.error("API Error:", error);
        showToast("Lỗi kết nối: " + error.message, 'error');
        throw error;
    }
}

let STATE = { user: null, projects: [], tasks: [], finance: [], assets: [], clients: [], users: [], logs: [], comments: [] };
let CURRENT_PROJECT_ID = null;
let CURRENT_PAGE = 'dashboard';
let currentType = '';
let currentEditId = null;

// --- CORE UTILITIES ---
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'error' ? 'times-circle' : (type === 'warning' ? 'exclamation-triangle' : 'check-circle');
    toast.innerHTML = `<i class="fas fa-${icon}"></i><span>HỆ THỐNG: ${message}</span>`;
    container.appendChild(toast);
    toast.onclick = () => toast.remove();
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 4000);
}

async function updateProjectProgress(projectId) {
    const pTasks = STATE.tasks.filter(t => t.ProjectID === projectId);
    if (pTasks.length === 0) return;
    const done = pTasks.filter(t => t.TrangThai === 'Done').length;
    const percent = Math.round((done / pTasks.length) * 100);
    const p = STATE.projects.find(x => x.ID === projectId);
    if (p && p.TienDo != percent) {
        p.TienDo = percent;
        if (percent === 100) p.TrangThai = 'Hoàn tất';
        try {
            const data = await callApi('saveData', { type: 'project', data: p });
            STATE = { ...STATE, ...data };
            showToast(`Đã tự động cập nhật tiến độ dự án: ${percent}%`);
        } catch (e) { }
    }
}

function updateNotifications() {
    const bell = document.getElementById('noti-bell');
    if (!bell) return;
    const today = new Date().toISOString().split('T')[0];
    const overdue = STATE.tasks.filter(t => t.Deadline && t.Deadline < today && t.TrangThai !== 'Done');
    if (overdue.length > 0) {
        bell.innerHTML = `<i class="fas fa-bell pulse-animation" style="color:var(--accent-magenta)"></i><span style="position:absolute; top:-5px; right:-5px; background:var(--accent-magenta); color:white; font-size:10px; padding:2px 5px; border-radius:50%">${overdue.length}</span>`;
    } else {
        bell.innerHTML = `<i class="fas fa-bell"></i>`;
    }
}

function toggleSidebar(force) {
    const sb = document.getElementById('sidebar');
    const ov = document.querySelector('.sidebar-overlay');
    if (force === undefined) {
        sb.classList.toggle('active');
        ov.classList.toggle('active');
    } else {
        if (force) { sb.classList.add('active'); ov.classList.add('active'); }
        else { sb.classList.remove('active'); ov.classList.remove('active'); }
    }
}

function handleSearch(keyword) {
    keyword = keyword.toLowerCase();
    if (CURRENT_PAGE === 'projects') {
        const filtered = STATE.projects.filter(p => p.Ten.toLowerCase().includes(keyword) || (p.QuanLy && p.QuanLy.toLowerCase().includes(keyword)));
        renderProjects(filtered);
    } else if (CURRENT_PAGE === 'finance') {
        const filtered = STATE.finance.filter(f => f.NoiDung.toLowerCase().includes(keyword));
        renderFinance(filtered);
    } else if (CURRENT_PAGE === 'assets') {
        const filtered = STATE.assets.filter(a => a.TenTS.toLowerCase().includes(keyword));
        renderAssets(filtered);
    } else if (CURRENT_PAGE === 'clients') {
        const filtered = STATE.clients.filter(c => c.TenKH.toLowerCase().includes(keyword));
        renderClients(filtered);
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-login');
    const err = document.getElementById('login-error');
    const email = document.getElementById('log-email').value;
    const pass = document.getElementById('log-pass').value;

    btn.innerHTML = '<i class="fas fa-sync fa-spin"></i> ĐANG XÁC THỰC...';
    btn.disabled = true;
    err.style.display = 'none';

    try {
        const user = await callApi('loginSystem', { email, password: pass });
        STATE.user = user;
        document.getElementById('view-login').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('view-login').style.display = 'none';
            document.getElementById('view-app').style.display = 'block';
            document.getElementById('view-app').style.animation = 'fadeIn 0.5s ease-out';
        }, 300);

        document.getElementById('user-info').innerHTML = `
            <img src="${user.avatar || 'https://ui-avatars.com/api/?name=U&background=00f2ff&color=000'}" class="user-avatar">
            <div>
                <div style="font-weight:700; font-size:0.9rem; color:#fff">${user.name}</div>
                <div style="font-size:0.7rem; color:var(--accent-cyan); text-transform:uppercase">${user.role}</div>
            </div>`;

        loadData();
    } catch (error) {
        btn.innerHTML = 'TRUY CẬP HỆ THỐNG';
        btn.disabled = false;
        err.innerText = "TRUY CẬP BỊ TỪ CHỐI: " + error.message;
        err.style.display = 'block';
    }
}

async function loadData() {
    const content = document.getElementById('content-area');
    content.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--accent-cyan)">
            <i class="fas fa-atom fa-spin fa-3x" style="margin-bottom:20px; text-shadow:var(--neon-shadow-cyan)"></i>
            <div style="font-family:'Orbitron'; letter-spacing:2px">ĐANG TẢI HỆ THỐNG QUẢN TRỊ DỰ ÁN...</div>
        </div>`;

    try {
        const data = await callApi('getInitialData');
        STATE = { ...STATE, ...data };
        renderDashboard();
        updateNotifications();
    } catch (e) { }
}

function switchPage(page, el) {
    CURRENT_PAGE = page;
    document.querySelectorAll('.nav-menu li').forEach(li => li.classList.remove('active'));
    if (el) el.classList.add('active');

    const content = document.getElementById('content-area');
    const title = document.getElementById('page-title');
    const btnAction = document.getElementById('btn-main-action');

    content.style.opacity = '0';
    setTimeout(() => {
        CURRENT_PROJECT_ID = null;
        if (page === 'dashboard') {
            title.innerText = "BÀN ĐIỀU KHIỂN DỰ ÁN";
            renderDashboard();
            btnAction.style.display = 'none';
        } else {
            btnAction.style.display = 'block';
            if (page === 'projects') {
                title.innerText = "DANH SÁCH BLUEPRINTS (DỰ ÁN)";
                btnAction.innerText = "+ KHỞI TẠO DỰ ÁN";
                btnAction.onclick = () => openModal('project');
                renderProjects();
            }
            else if (page === 'kanban') {
                title.innerText = "MA TRẬN CÔNG VIỆC (KANBAN)";
                btnAction.innerText = "+ THÊM NHIỆM VỤ";
                btnAction.onclick = () => openModal('task');
                renderKanban();
            }
            else if (page === 'finance') {
                title.innerText = "CHI PHÍ & NGÂN SÁCH DỰ ÁN";
                btnAction.innerText = "+ NHẬP CHI PHÍ";
                btnAction.onclick = () => openModal('finance');
                renderFinance();
            }
            else if (page === 'assets') {
                title.innerText = "NGUỒN LỰC & THIẾT BỊ";
                btnAction.innerText = "+ THÊM NGUỒN LỰC";
                btnAction.onclick = () => openModal('asset');
                renderAssets();
            }
            else if (page === 'clients') {
                title.innerText = "ĐỐI TÁC & CHỦ ĐẦU TƯ";
                btnAction.innerText = "+ THÊM ĐỐI TÁC";
                btnAction.onclick = () => openModal('client');
                renderClients();
            }
            else if (page === 'users') {
                title.innerText = "ĐỘI NGŨ NHÂN SỰ (AGENTS)";
                btnAction.style.display = 'none';
                renderUsers();
            }
            else if (page === 'logs') {
                title.innerText = "NHẬT KÝ HỆ THỐNG (SYSTEM LOGS)";
                btnAction.style.display = 'none';
                renderLogs();
            }
            else if (page === 'reports') {
                title.innerText = "BÁO CÁO CHIẾN LƯỢC (REPORTS ENGINE)";
                btnAction.innerText = "+ XUẤT BÁO CÁO TỔNG HỢP";
                btnAction.onclick = () => generateGlobalReport();
                renderReports();
            }
        }
        content.style.opacity = '1';
        content.style.transition = '0.3s';
    }, 150);
}

function renderDashboard() {
    const totalProjects = STATE.projects.length;
    const activeTasks = STATE.tasks.filter(t => t.TrangThai !== 'Done').length;
    const completionRate = totalProjects > 0 ? (STATE.projects.filter(p => p.TienDo == 100).length / totalProjects * 100).toFixed(0) : 0;

    document.getElementById('content-area').innerHTML = `
        <div class="stats-container">
            <div class="neon-card stagger-item">
                <div class="stat-label">Tổng số dự án</div>
                <div class="stat-val count-up" style="color:var(--accent-cyan)">${totalProjects}</div>
            </div>
            <div class="neon-card stagger-item">
                <div class="stat-label">Nhiệm vụ đang chạy</div>
                <div class="stat-val count-up" style="color:var(--accent-magenta)">${activeTasks}</div>
            </div>
            <div class="neon-card stagger-item">
                <div class="stat-label">Hiệu suất trung bình</div>
                <div class="stat-val count-up" style="color:var(--accent-lime)">${completionRate}%</div>
            </div>
        </div>
        
        <div style="display:grid; grid-template-columns: 1.5fr 1fr; gap:30px; margin-bottom:30px;">
            <div class="neon-card stagger-item" style="min-height:380px">
                <div class="stat-label" style="margin-bottom:20px">Biểu Đồ Phân Bổ Dự Án</div>
                <canvas id="chartProjects"></canvas>
            </div>
            <div class="neon-card stagger-item" style="min-height:380px; overflow-y:auto;">
                <div class="stat-label" style="margin-bottom:20px; display:flex; justify-content:space-between; align-items:center;">
                    <span>Phân Tích Thông Minh (Gemini AI)</span>
                    <i class="fas fa-magic" style="color:var(--accent-cyan); animation: pulse 2s infinite"></i>
                </div>
                <div id="insights-list">
                    <div style="color:var(--text-dim); text-align:center; padding-top:100px;">
                        <i class="fas fa-brain fa-spin" style="font-size:2rem; margin-bottom:15px; color:var(--accent-cyan)"></i>
                        <div>AI đang phân tích dữ liệu...</div>
                    </div>
                </div>
            </div>
        </div>
        <div id="dashboard-bottom">
            <div class="neon-card stagger-item">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px">
                    <div class="stat-label">Dự Án Trọng Điểm Đang Hoạt Động</div>
                    <button class="btn-ghost" onclick="switchPage('projects')">Xem tất cả</button>
                </div>
                <table class="neon-table">
                    <thead><tr><th>Dự Án</th><th>Người Phụ Trách</th><th>Tiến Độ</th><th>Trạng Thái</th></tr></thead>
                    <tbody>
                        ${STATE.projects.slice(0, 5).map(p => `
                                <tr onclick="viewProjectDetail('${p.ID}')" style="cursor:pointer">
                                    <td style="color:#fff; font-weight:600">${p.Ten}</td>
                                    <td style="color:var(--text-dim)">${p.QuanLy}</td>
                                    <td>
                                        <div class="prog-bar" style="width:120px; margin:0">
                                            <div class="prog-fill" style="width:${p.TienDo}%; background:var(--accent-cyan)"></div>
                                        </div>
                                    </td>
                                    <td><span style="color:var(--accent-cyan); text-transform:uppercase; font-size:0.75rem">${p.TrangThai}</span></td>
                                </tr>
                            `).join('') || '<tr><td colspan="4">Không có dự án nào trong hệ thống.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    callApi('runAIAnalysis').then(aiInsights => {
        const list = document.getElementById('insights-list');
        if (!list) return;
        list.innerHTML = aiInsights.map(ins => `
            <div style="display:flex; gap:15px; margin-bottom:15px; padding:15px; background:rgba(255,255,255,0.03); border-left:4px solid ${ins.level === 'HIGH' ? 'var(--accent-magenta)' : (ins.level === 'MEDIUM' ? 'var(--accent-cyan)' : 'var(--accent-lime)')}">
                <i class="fas fa-${ins.icon || 'info-circle'}" style="color:${ins.level === 'HIGH' ? 'var(--accent-magenta)' : (ins.level === 'MEDIUM' ? 'var(--accent-cyan)' : 'var(--accent-lime)')}; font-size:1.2rem; margin-top:2px"></i>
                <div>
                    <div style="font-weight:700; font-size:0.75rem; color:var(--accent-cyan); margin-bottom:5px; text-transform:uppercase">${ins.title}</div>
                    <span style="font-size:0.85rem; color:var(--text-primary)">${ins.text}</span>
                </div>
            </div>`).join('');
    }).catch(e => {
        const list = document.getElementById('insights-list');
        if (list) list.innerHTML = `<div style="color:var(--accent-magenta); font-size:0.8rem; text-align:center; padding:20px;">LỖI AI: ${e.message}</div>`;
    });

    setTimeout(() => {
        const chartEl = document.getElementById('chartProjects');
        if (!chartEl) return;
        new Chart(chartEl, {
            type: 'doughnut',
            data: {
                labels: ['Mới', 'Đang làm', 'Hoàn tất', 'Tạm dừng'],
                datasets: [{
                    data: [
                        STATE.projects.filter(p => p.TrangThai === 'Mới').length,
                        STATE.projects.filter(p => p.TrangThai === 'Đang làm').length,
                        STATE.projects.filter(p => p.TrangThai === 'Hoàn tất').length,
                        STATE.projects.filter(p => p.TrangThai === 'Tạm dừng').length
                    ],
                    backgroundColor: ['#00f2ff', '#bcff00', '#ff00ff', '#8485b1'],
                    borderWidth: 0,
                    hoverOffset: 15
                }]
            },
            options: {
                cutout: '70%',
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: '#8485b1', padding: 20, font: { size: 10 } } } }
            }
        });
    }, 100);
}

function renderProjects(data = STATE.projects) {
    let html = `<div style="display:flex; justify-content:flex-end; margin-bottom:20px;">
        <button class="btn-ghost" onclick="exportToCSV(STATE.projects, 'AFS_Projects')"><i class="fas fa-file-export"></i> XUẤT DỮ LIỆU</button>
    </div>
    <div class="project-grid">`;
    data.forEach(p => {
        html += `
        <div class="neon-card stagger-item" onclick="viewProjectDetail('${p.ID}')" style="cursor:pointer">
            <div style="display:flex; justify-content:space-between; align-items:start">
                <h3 style="color:#fff; margin-bottom:10px">${p.Ten}</h3>
                <div style="font-size:0.7rem; color:var(--accent-magenta); border:1px solid var(--accent-magenta); padding:2px 6px; border-radius:4px; text-transform:uppercase">${p.TrangThai}</div>
            </div>
            <p style="color:var(--text-dim); font-size:0.85rem; height:40px; overflow:hidden; margin:10px 0;">${p.MoTa || 'Hệ thống chưa ghi nhận mô tả cho dự án này.'}</p>
            <div style="margin-top:20px;">
                <div style="display:flex; justify-content:space-between; font-size:0.75rem; margin-bottom:8px">
                    <span style="color:var(--accent-cyan)"><i class="fas fa-user"></i> ${p.QuanLy}</span>
                    <span style="color:#fff">${p.TienDo || 0}%</span>
                </div>
                <div class="prog-bar">
                    <div class="prog-fill" style="width:${p.TienDo || 0}%; background:linear-gradient(90deg, var(--accent-cyan), var(--accent-magenta))"></div>
                </div>
            </div>
        </div>`;
    });
    document.getElementById('content-area').innerHTML = html + "</div>";
}

function viewProjectDetail(id) {
    let p = STATE.projects.find(x => x.ID === id);
    if (!p) return;
    CURRENT_PROJECT_ID = id;
    const title = document.getElementById('page-title');
    title.innerHTML = `<i class="fas fa-arrow-left" onclick="switchPage('projects')" style="cursor:pointer; margin-right:15px"></i> PROJECT: ${p.Ten}`;
    const projectTasks = STATE.tasks.filter(t => t.ProjectID === id);

    document.getElementById('content-area').innerHTML = `
        <div style="display:grid; grid-template-columns: 1fr 2fr; gap:30px;">
            <div class="stagger-item">
                <div class="neon-card" style="margin-bottom:30px">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px">
                        <div class="stat-label">Tiến Độ Cốt Lõi</div>
                        <i class="fas fa-edit" style="cursor:pointer; color:var(--accent-cyan)" onclick="openModal('project', '${p.ID}', true)"></i>
                    </div>
                    <div class="stat-val" style="color:var(--accent-cyan); font-size:3.5rem; text-align:center;">${p.TienDo}%</div>
                    <div class="prog-bar"><div class="prog-fill" style="width:${p.TienDo}%; background:var(--accent-cyan)"></div></div>
                </div>
                <div class="neon-card">
                    <div class="stat-label">Mô tả chi tiết</div>
                    <p style="color:var(--text-dim); margin-top:15px; font-size:0.9rem">${p.MoTa || 'Không có mô tả.'}</p>
                </div>
            </div>
            <div class="stagger-item">
                <div class="neon-card">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px">
                        <div class="stat-label">Danh sách nhiệm vụ</div>
                        <button class="btn-create" onclick="openModal('task', '${id}')" style="padding:5px 15px; font-size:0.7rem">+ THÊM NHIỆM VỤ</button>
                    </div>
                    <table class="neon-table">
                        <thead><tr><th>Tên Công Việc</th><th>Nhân Sự</th><th>Trạng Thái</th></tr></thead>
                        <tbody>
                            ${projectTasks.map(t => `<tr onclick="openModal('task', '${t.ID}', true)" style="cursor:pointer"><td>${t.Ten}</td><td>${t.NguoiLam}</td><td><span style="color:${t.TrangThai === 'Done' ? 'var(--accent-lime)' : 'var(--accent-magenta)'}">${t.TrangThai}</span></td></tr>`).join('') || '<tr><td colspan="3">Chưa có nhiệm vụ.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>`;
}

function renderKanban() {
    const statuses = [{ id: 'Pending', name: 'Sử dụng', color: 'var(--text-dim)' }, { id: 'In Progress', name: 'Đang chuẩn bị', color: 'var(--accent-cyan)' }, { id: 'Done', name: 'Hoàn tất', color: 'var(--accent-lime)' }];
    let html = `<div class="kanban-board">`;
    statuses.forEach(st => {
        const items = STATE.tasks.filter(t => t.TrangThai === st.id);
        html += `<div class="kanban-col"><div class="status-badge" style="color:${st.color}">${st.name}</div><div class="task-list" style="display:flex; flex-direction:column; gap:10px;">${items.map(t => `<div class="task-card" onclick="openModal('task', '${t.ID}', true)"><div style="font-weight:600; color:#fff">${t.Ten}</div><div style="font-size:0.75rem; color:var(--text-dim)">${t.NguoiLam}</div></div>`).join('')}</div></div>`;
    });
    document.getElementById('content-area').innerHTML = html + "</div>";
}

function renderFinance() {
    let html = `<div class="neon-card stagger-item"><table class="neon-table"><thead><tr><th>Nội dung</th><th>Số tiền</th><th>Loại</th><th>Ngày</th></tr></thead><tbody>${STATE.finance.map(f => `<tr><td>${f.NoiDung}</td><td style="color:${f.Loai === 'Thu' ? 'var(--accent-lime)' : 'var(--accent-magenta)'}">${Number(f.SoTien).toLocaleString()} Ȼ</td><td>${f.Loai}</td><td>${f.Ngay}</td></tr>`).join('')}</tbody></table></div>`;
    document.getElementById('content-area').innerHTML = html;
}

function renderAssets() {
    let html = `<div class="neon-card stagger-item"><table class="neon-table"><thead><tr><th>Tên tài sản</th><th>Số lượng</th><th>Giá trị</th><th>Tình trạng</th></tr></thead><tbody>${STATE.assets.map(a => `<tr><td>${a.TenTS}</td><td>${a.SoLuong}</td><td>${Number(a.GiaTri).toLocaleString()}</td><td>${a.TinhTrang}</td></tr>`).join('')}</tbody></table></div>`;
    document.getElementById('content-area').innerHTML = html;
}

function renderClients() {
    let html = `<div class="neon-card stagger-item"><table class="neon-table"><thead><tr><th>Tên khách hàng</th><th>Liên hệ</th><th>Email</th></tr></thead><tbody>${STATE.clients.map(c => `<tr><td>${c.TenKH}</td><td>${c.LienHe}</td><td>${c.Email}</td></tr>`).join('')}</tbody></table></div>`;
    document.getElementById('content-area').innerHTML = html;
}

function renderUsers() {
    let html = `<div class="neon-card stagger-item"><table class="neon-table"><thead><tr><th>Họ tên</th><th>Email</th><th>Vai trò</th></tr></thead><tbody>${STATE.users.map(u => `<tr><td>${u.Ten}</td><td>${u.Email}</td><td>${u.VaiTro}</td></tr>`).join('')}</tbody></table></div>`;
    document.getElementById('content-area').innerHTML = html;
}

function renderLogs() {
    let html = `<div class="neon-card stagger-item">${STATE.logs.map(l => `<div class="log-entry"><span class="log-time">${l.ThoiGian}</span><span class="log-action" style="color:var(--accent-cyan)">${l.HanhDong}</span><span class="log-detail">${l.ChiTiet}</span></div>`).join('')}</div>`;
    document.getElementById('content-area').innerHTML = html;
}

function renderReports() { renderDashboard(); }

function openModal(type, idOrPid = null, isEdit = false) {
    currentType = type;
    currentEditId = isEdit ? idOrPid : null;
    document.getElementById('modal').style.display = 'flex';
    const h = document.getElementById('modal-heading');
    const b = document.getElementById('modal-body');

    let item = {};
    if (isEdit) {
        if (type === 'project') item = STATE.projects.find(x => x.ID === idOrPid);
        else if (type === 'task') item = STATE.tasks.find(x => x.ID === idOrPid);
    }

    if (type === 'project') {
        h.innerText = isEdit ? "CẬP NHẬT DỰ ÁN" : "TẠO DỰ ÁN MỚI";
        b.innerHTML = `
            <div class="stat-label">Tên dự án</div><input id="val1" value="${item.Ten || ''}">
            <div class="stat-label">Quản lý</div><input id="val2" value="${item.QuanLy || ''}">
            <div class="stat-label">Tiến độ (%)</div><input id="val6" type="number" value="${item.TienDo || 0}">
            <div class="stat-label">Mô tả</div><textarea id="val7">${item.MoTa || ''}</textarea>`;
    } else if (type === 'task') {
        h.innerText = isEdit ? "CẬP NHẬT NHIỆM VỤ" : "PHÂN CÔNG NHIỆM VỤ";
        let pid = isEdit ? item.ProjectID : idOrPid;
        let ops = STATE.projects.map(p => `<option value="${p.ID}" ${pid === p.ID ? 'selected' : ''}>${p.Ten}</option>`).join('');
        b.innerHTML = `
            <div class="stat-label">Tên nhiệm vụ</div><input id="val1" value="${item.Ten || ''}">
            <div class="stat-label">Thuộc dự án</div><select id="val2">${ops}</select>
            <div class="stat-label">Người thực hiện</div><input id="val3" value="${item.NguoiLam || ''}">
            <div class="stat-label">Trạng thái</div><select id="val4">
                <option value="Pending" ${item.TrangThai === 'Pending' ? 'selected' : ''}>Đang chờ</option>
                <option value="In Progress" ${item.TrangThai === 'In Progress' ? 'selected' : ''}>Đang làm</option>
                <option value="Done" ${item.TrangThai === 'Done' ? 'selected' : ''}>Hoàn tất</option>
            </select>`;
    } else {
        h.innerText = "CẬP NHẬT DỮ LIỆU";
        b.innerHTML = `<input id="val1" placeholder="Tên / Nội dung"><input id="val2" placeholder="Chi tiết / Số tiền">`;
    }
}

function closeModal() { document.getElementById('modal').style.display = 'none'; }

async function saveData() {
    const btn = document.getElementById('btn-save');
    btn.innerHTML = '<i class="fas fa-sync fa-spin"></i> ĐANG LƯU...';
    btn.disabled = true;

    let data = { ID: currentEditId };
    if (currentType === 'project') {
        data = { ...data, Ten: val1.value, QuanLy: val2.value, TienDo: val6.value, MoTa: val7.value, TrangThai: val6.value == 100 ? 'Hoàn tất' : 'Đang làm' };
    } else if (currentType === 'task') {
        data = { ...data, Ten: val1.value, ProjectID: val2.value, NguoiLam: val3.value, TrangThai: val4.value };
    }

    try {
        const newData = await callApi('saveData', { type: currentType, data: data });
        STATE = { ...STATE, ...newData };
        showToast("Đồng bộ dữ liệu thành công!");
        closeModal();
        switchPage(CURRENT_PAGE);
    } catch (e) {
        showToast("Lỗi lưu dữ liệu: " + e.message, 'error');
    }
    btn.innerHTML = 'ĐỒNG BỘ DỮ LIỆU';
    btn.disabled = false;
}

function exportToCSV(data, filename) {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csv = [headers.join(','), ...data.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
}

function openThemePicker() { showToast("Tính năng tùy chỉnh đang được tối ưu hóa."); }
function toggleNotifications() { showToast("Không có thông báo mới."); }
