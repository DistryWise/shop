
fetch('/api/check_admin').then(r => r.json()).then(d => { if (!d.is_admin) location.href = '/404'; });

let currentPage = 1;
const itemsPerPage = 10;
let allFeedback = [];
let filteredFeedback = [];
let deleteMode = null;
let deleteIds = [];
let isSelectionMode = false;

function enterSelectionMode() {
    isSelectionMode = true;
    document.body.classList.add('selection-mode');
    document.getElementById('startSelectionBtn').style.display = 'none';
    document.getElementById('bulkActions').classList.add('active');
    updateBulkButton();
}

function exitSelectionMode() {
    isSelectionMode = false;
    document.body.classList.remove('selection-mode');
    document.getElementById('startSelectionBtn').style.display = 'inline-flex';
    document.getElementById('bulkActions').classList.remove('active');
    document.querySelectorAll('.review-item.selected').forEach(el => el.classList.remove('selected'));
    updateBulkButton();
}

function openFullFeedback(item) {
    if (isSelectionMode) return;
    document.getElementById('modalName').textContent = item.dataset.name;
    document.getElementById('modalDate').textContent = item.dataset.created;
    document.getElementById('modalEmail').textContent = item.dataset.email;
    const phone = item.dataset.phone;
    const wrapper = document.getElementById('modalPhoneWrapper');
    const phoneEl = document.getElementById('modalPhone');
    if (phone && phone.trim()) { phoneEl.textContent = phone; wrapper.style.display = 'block'; } else { wrapper.style.display = 'none'; }
    document.getElementById('modalMessage').textContent = item.dataset.message.replace(/\[BR\]/g, '\n');
    openModal('fullFeedbackModal');
}

document.addEventListener("DOMContentLoaded", () => {
    allFeedback = Array.from(document.querySelectorAll('.review-item')).map(el => ({
        element: el.cloneNode(true),
        id: el.dataset.id,
        name: (el.querySelector('.review-user')?.textContent || '').trim().toLowerCase(),
        email: el.dataset.email.toLowerCase(),                          // ← БЕРЁМ ИЗ data-email
        phone: (el.dataset.phone || '').toLowerCase(),                  // ← БЕРЁМ ИЗ data-phone
        text: (el.querySelector('.review-text-preview')?.textContent || '').toLowerCase(),
        date: new Date(el.dataset.created.replace(' ', 'T'))
    }));
    filteredFeedback = [...allFeedback];
    renderPage();

    document.getElementById('searchInput').addEventListener('input', applyFilters);

    const fromInput = document.getElementById('modalDateFrom');
    const toInput = document.getElementById('modalDateTo');
    const applyBtn = document.getElementById('applyDateBtn');
    const check = () => applyBtn.disabled = !(fromInput.value && toInput.value);
    fromInput.addEventListener('change', check);
    toInput.addEventListener('change', check);
    applyBtn.addEventListener('click', applyCustomDateRange);
});

function renderPage() {
    const container = document.getElementById('feedbackContainer');
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = filteredFeedback.slice(start, end);

    container.innerHTML = pageItems.length === 0 ? `<div style="text-align:center;padding:8rem 0;color:var(--gray);"><i class="fas fa-inbox" style="font-size:6rem;margin-bottom:1.5rem;opacity:0.6;"></i><p style="font-size:1.6rem;">Заявки не найдены</p></div>` : '';

    pageItems.forEach(item => {
        const el = item.element.cloneNode(true);
        el.addEventListener('click', e => {
            if (e.target.closest('.action-btn') || e.target.closest('.review-info-line') || e.target.classList.contains('read-more')) return;
            if (isSelectionMode) {
                el.classList.toggle('selected');
                updateBulkButton();
            } else {
                openFullFeedback(el);
            }
        });
        container.appendChild(el);
    });

    document.querySelectorAll('.review-text-preview').forEach(p => {
        const truncated = p.scrollHeight > p.clientHeight + 10;
        p.classList.toggle('truncated', truncated);
    });

    const totalPages = Math.ceil(filteredFeedback.length / itemsPerPage) || 1;
    document.getElementById('pageInfo').textContent = `Страница ${currentPage} из ${totalPages}`;
    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = currentPage >= totalPages;
    updateBulkButton();
}

function updateBulkButton() {
    const count = document.querySelectorAll('.review-item.selected').length;
    document.getElementById('selectedCount').textContent = count;
    document.getElementById('deleteSelectedBtn').style.display = count > 0 ? 'inline-flex' : 'none';
}

function prepareSingleDelete(id) { deleteMode = 'single'; deleteIds = [id]; document.getElementById('deleteConfirmText').textContent = 'Удалить эту заявку навсегда?'; openModal('deleteConfirmModal'); }
function prepareBulkDelete() { deleteIds = Array.from(document.querySelectorAll('.review-item.selected')).map(el => el.dataset.id); if (!deleteIds.length) return; deleteMode = 'bulk'; document.getElementById('deleteConfirmText').textContent = `Удалить ${deleteIds.length} выбранных заявок?`; openModal('deleteConfirmModal'); }
function prepareDeleteAll() { deleteMode = 'all'; deleteIds = allFeedback.map(f => f.id); document.getElementById('deleteConfirmText').innerHTML = `Удалить <strong style="color:#ff4444;">ВСЕ заявки</strong> (${deleteIds.length} шт.)?`; openModal('deleteConfirmModal'); }

async function executeDelete() {
    const password = document.getElementById('deletePassword').value.trim();
    const errorEl = document.getElementById('deletePasswordError');
    errorEl.style.display = 'none';

    if (!password) {
        errorEl.textContent = 'Введите пароль';
        errorEl.style.display = 'block';
        return;
    }

    // ←←← ВОТ ЭТА ЧАСТЬ ИЗМЕНЕНА — отправляем чистый JSON, а не FormData
    const payload = {
        password: password
    };

    if (deleteMode === 'all') {
        payload.delete_all = true;
    } else {
        payload.ids = deleteIds;  // ← уже массив чисел, не нужно JSON.stringify
    }

    try {
        const r = await fetch('/admin_feedback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(payload)
        });

        const d = await r.json();

        if (d.success) {
            showToast(d.message || 'Удалено успешно!', 'success');
            setTimeout(() => location.reload(), 1200);
        } else {
            errorEl.textContent = d.message || 'Ошибка удаления';
            errorEl.style.display = 'block';
        }
    } catch (err) {
        console.error('Ошибка удаления:', err);
        errorEl.textContent = 'Ошибка сервера';
        errorEl.style.display = 'block';
    }
}

function applyCustomDateRange() {
    const from = document.getElementById('modalDateFrom').value;
    const to = document.getElementById('modalDateTo').value;
    document.getElementById('dateFrom').value = from;
    document.getElementById('dateTo').value = to;
    document.getElementById('dateFilter').value = 'custom';
    document.querySelector('.custom-select-text').textContent = `${new Date(from).toLocaleDateString('ru-RU')} – ${new Date(to).toLocaleDateString('ru-RU')}`;
    closeModal('dateRangeModal');
    applyFilters();
}

function applyFilters() {
    const query = document.getElementById('searchInput').value.trim().toLowerCase();
    const mode = document.getElementById('dateFilter').value;
    const from = document.getElementById('dateFrom').value ? new Date(document.getElementById('dateFrom').value) : null;
    const to = document.getElementById('dateTo').value ? new Date(document.getElementById('dateTo').value) : null;
    if (to) to.setHours(23,59,59,999);

    filteredFeedback = allFeedback.filter(f => {
        const matchesSearch = !query || f.name.includes(query) || f.email.includes(query) || f.text.includes(query);
        if (!matchesSearch) return false;

        if (!mode || mode === '') return true;
        const date = f.date;
        const now = new Date();

        switch (mode) {
            case 'today': return date >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
            case '7days': return date >= new Date(now - 7*24*60*60*1000);
            case '30days': return date >= new Date(now - 30*24*60*60*1000);
            case 'custom': return (!from || date >= from) && (!to || date <= to);
            default: return true;
        }
    });

    currentPage = 1;
    renderPage();
}

function changePage(delta) {
    const total = Math.ceil(filteredFeedback.length / itemsPerPage);
    const next = currentPage + delta;
    if (next >= 1 && next <= total) {
        currentPage = next;
        renderPage();
    }
}

function showToast(msg, type = 'success') {
    const t = document.createElement('div');
    t.className = `zaza-toast ${type === 'error' ? 'error' : ''}`;
    t.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i><span>${msg}</span>`;
    document.body.appendChild(t);
    setTimeout(() => t.style.opacity = '1', 100);
    setTimeout(() => t.remove(), 4000);
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => showToast('Скопировано!'));
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    document.getElementById('deletePassword').value = '';
    document.getElementById('deletePasswordError').style.display = 'none';
}

document.addEventListener('click', e => {
    const trigger = e.target.closest('.custom-select-trigger');
    const option = e.target.closest('.custom-select-option');
    const select = e.target.closest('.custom-select');

    if (trigger) {
        document.querySelectorAll('.custom-select').forEach(s => s !== trigger.parentElement && s.classList.remove('open'));
        trigger.parentElement.classList.toggle('open');
    } else if (option) {
        const parent = option.closest('.custom-select');
        if (option.dataset.value === 'custom') {
            parent.classList.remove('open');
            openModal('dateRangeModal');
            return;
        }
        parent.querySelector('.custom-select-text').textContent = option.textContent;
        document.getElementById('dateFilter').value = option.dataset.value || '';
        parent.classList.remove('open');
        applyFilters();
    } else if (!select) {
        document.querySelectorAll('.custom-select').forEach(s => s.classList.remove('open'));
    }
});

const html = document.documentElement;
const themeToggle = document.getElementById('theme-toggle');

// Загружаем сохранённую тему
if (localStorage.getItem('theme') === 'light') {
    html.setAttribute('data-theme', 'light');
    themeToggle.checked = true;
} else {
    html.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
}

// Переключение
themeToggle.addEventListener('change', () => {
    const isLight = themeToggle.checked;
    html.setAttribute('data-theme', isLight ? 'light' : 'dark');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
});
