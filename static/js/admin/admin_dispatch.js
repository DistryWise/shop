
// Защита
fetch('/api/check_admin').then(r => r.json()).then(d => { if (!d.is_admin) location.href = '/404'; });

const PAGE_SIZE = 10;
let currentPage = 1;
let subscribers = [];

function formatPhone(raw, consent) {
    if (!raw) return '—';
    const c = raw.replace(/\D/g, '');
    if (c.length !== 11 || !c.startsWith('7')) return raw;
    return consent ? `+7 (${c.slice(1,4)}) ${c.slice(4,7)}-${c.slice(7,9)}-${c.slice(9)}` : '+7 (•••) •••-••-••';
}

function formatDate(iso) {
    if (!iso) return '—';
    // Фикс для Safari: заменяем пробел на T и убираем лишнее
    const dateStr = iso.replace(' ', 'T').split('.')[0];
    const d = new Date(dateStr + 'Z'); // добавляем Z, если UTC
    return d.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

let pendingSubscriberId = null;

function deleteSubscriber(subscriberId) {
    const sub = subscribers.find(s => s.id === subscriberId);
    if (!sub) return;

    pendingSubscriberId = subscriberId;

    document.getElementById('delSubId').textContent = subscriberId;
    document.getElementById('delSubPhone').textContent = sub.phone || '—';
    document.getElementById('delSubEmail').textContent = sub.email || '—';

    document.getElementById('deleteSubPassword').value = '';
    document.getElementById('deleteSubError').textContent = '';

    openAppleModal('deleteSubscriberModal');
}


document.getElementById('confirmDeleteSubBtn').onclick = async () => {
    const password = document.getElementById('deleteSubPassword').value.trim();
    const errorEl = document.getElementById('deleteSubError');

    if (!password) {
        errorEl.textContent = 'Введите пароль администратора';
        return;
    }

    try {
        const res = await fetch('/api/delete_subscriber', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: pendingSubscriberId, password })
        });
        const data = await res.json();

        if (data.success) {
            closeAppleModal('deleteSubscriberModal');

            // УДАЛЯЕМ ИЗ МАССИВА
            const index = subscribers.findIndex(s => s.id === pendingSubscriberId);
            if (index !== -1) subscribers.splice(index, 1);

            // НАХОДИМ СТРОКУ ПО ID (работает везде)
            const row = document.querySelector(`tr td:first-child`)?.parentElement;
            let found = false;
            document.querySelectorAll('#subsBody tr').forEach(tr => {
                if (tr.querySelector('td:first-child')?.textContent.trim() == pendingSubscriberId) {
                    // Плавное исчезновение
                    tr.style.transition = 'all 0.45s cubic-bezier(0.22,1,0.36,1)';
                    tr.style.opacity = '0';
                    tr.style.transform = 'translateX(-30px)';
                    setTimeout(() => tr.remove(), 450);
                    found = true;
                }
            });

            // ОБНОВЛЯЕМ СТАТИСТИКУ
            const total = subscribers.length;
            const withEmail = subscribers.filter(s => s.email?.trim()).length;
            const withSMS = subscribers.filter(s => s.smsConsent).length;

            document.getElementById('totalSubs').textContent = total;
            document.getElementById('statTotal').textContent = total;
            document.getElementById('statEmail').textContent = withEmail;
            document.getElementById('statSMS').textContent = withSMS;
            document.getElementById('emailCount').textContent = `${withEmail} получателей`;
            document.getElementById('smsCount').textContent = `${withSMS} получателей`;

            // ПЕРЕРИСОВЫВАЕМ ТАБЛИЦУ И ПАГИНАЦИЮ
            render();

            // Если удалили последнюю строку на странице — переходим назад
            if (subscribers.length > 0 && document.querySelector('#subsBody tr') === null && currentPage > 1) {
                currentPage--;
                render();
            }

            if (typeof showCustomAlert === 'function') {
                showCustomAlert('Подписчик удалён навсегда', false, true);
            }

            pendingSubscriberId = null;
        } else {
            errorEl.textContent = data.error || 'Неверный пароль';
        }
    } catch (err) {
        errorEl.textContent = 'Ошибка сервера';
        console.error(err);
    }
};
function render() {
    const tbody = document.getElementById('subsBody');
    tbody.innerHTML = '';
    const start = (currentPage - 1) * PAGE_SIZE;
    const page = subscribers.slice(start, start + PAGE_SIZE);

    page.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${s.id || '—'}</td>
            <td style="font-family:monospace;">${formatPhone(s.phone, s.smsConsent)}</td>
            <td>${s.email || '—'}</td>
            <td class="${s.smsConsent ? 'sms-yes' : 'sms-no'}">${s.smsConsent ? 'Да' : 'Нет'}</td>
            <td>${formatDate(s.lastVisit)}</td>
            <td><button class="btn-delete" onclick="deleteSubscriber(${s.id})">Удалить</button></td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('totalSubs').textContent = subscribers.length;

    const pages = Math.ceil(subscribers.length / PAGE_SIZE);
    const pag = document.getElementById('pagination');
    pag.innerHTML = '';
    for (let i = 1; i <= pages; i++) {
        const b = document.createElement('button');
        b.className = 'page-btn';
        b.textContent = i;
        if (i === currentPage) b.classList.add('active');
        b.onclick = () => { currentPage = i; render(); };
        pag.appendChild(b);
    }
}

async function loadSubscribers() {
    try {
        const res = await fetch('/api/get_subscribers');
        const data = await res.json();
        console.log("Подписчики:", data);

        if (data.success && Array.isArray(data.subscribers)) {
            subscribers = data.subscribers.map(s => ({
                id: s.id,
                phone: s.phone || '',
                email: s.email || '',
                smsConsent: !!s.sms_consent,
                lastVisit: s.subscribed_at || '—'
            }));

            // === СТАТИСТИКА ===
            const total = subscribers.length;
            const withEmail = subscribers.filter(s => s.email?.trim()).length;
            const withSMS = subscribers.filter(s => s.smsConsent).length;

            document.getElementById('totalSubs').textContent = total;
            document.getElementById('statTotal').textContent = total;
            document.getElementById('statEmail').textContent = withEmail;
            document.getElementById('statSMS').textContent = withSMS;
            document.getElementById('emailCount').textContent = `${withEmail} получателей`;
            document.getElementById('smsCount').textContent = `${withSMS} получателей`;

            render(); // ← ВОТ ЭТО ГЛАВНОЕ! ОБЯЗАТЕЛЬНО!
        } else {
            subscribers = [];
            render();
        }
    } catch (err) {
        console.error("Ошибка загрузки:", err);
        subscribers = [];
        render();
    }
}
document.addEventListener("DOMContentLoaded", () => {
    loadSubscribers();

    // Тема
    const themeToggle = document.getElementById('theme-toggle');
    const html = document.documentElement;
    if (localStorage.getItem('theme') === 'light') {
        html.setAttribute('data-theme', 'light');
        themeToggle.checked = true;
    }
    themeToggle.addEventListener('change', () => {
        const theme = themeToggle.checked ? 'light' : 'dark';
        html.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    });

    document.getElementById('dispatch_message')?.addEventListener('input', e => {
        const left = 1000 - e.target.value.length;
        document.getElementById('charsLeft').textContent = left;
        document.getElementById('charsLeft').style.color = left < 100 ? '#ff4444' : 'var(--gray)';
    });
});

let pendingDispatch = null, pendingDeleteId = null;

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function openCreateDispatchModal() {
    document.getElementById('dispatch_title').value = '';
    document.getElementById('dispatch_message').value = '';
    document.getElementById('charsLeft').textContent = '1000';
    openModal('createDispatchModal');
}

function prepareDispatch() {
    const t = document.getElementById('dispatch_title').value.trim();
    const m = document.getElementById('dispatch_message').value.trim();
    if (!t || !m) return alert('Заполните поля');
    pendingDispatch = { title: t, message: m };
    closeModal('createDispatchModal');
    openModal('passwordModal');
}

function deleteDispatch(id) {
    if (!confirm('Удалить рассылку?')) return;
    pendingDeleteId = id;
    openModal('passwordModal');
}

async function confirmPasswordAction() {
    const pw = document.getElementById('global_password').value.trim();
    const err = document.getElementById('password_error');
    if (!pw) return err.textContent = 'Введите пароль', err.style.display = 'block';

    const fd = new FormData();
    fd.append('password', pw);
    if (pendingDispatch) {
        fd.append('action', 'send_dispatch');
        fd.append('title', pendingDispatch.title);
        fd.append('message', pendingDispatch.message);
    } else if (pendingDeleteId) {
        fd.append('action', 'delete_dispatch');
        fd.append('dispatch_id', pendingDeleteId);
    }

    try {
        const r = await fetch('/admin_dispatch', { method: 'POST', body: fd });
        const d = await r.json();
        if (d.success) location.reload();
        else err.textContent = d.message || 'Неверный пароль', err.style.display = 'block';
    } catch {
        err.textContent = 'Ошибка сервера', err.style.display = 'block';
    } finally {
        pendingDispatch = null; pendingDeleteId = null;
        document.getElementById('global_password').value = '';
    }
}

// Закрытие любой модалки кликом по overlay (вне контента модалки)
document.addEventListener('click', (e) => {
    const modals = ['createDispatchModal', 'passwordModal']; // добавляй сюда ID других модалок при необходимости

    modals.forEach(id => {
        const overlay = document.getElementById(id);
        if (!overlay) return;

        // если модалка открыта и клик был именно по overlay (а не по содержимому)
        if (overlay.classList.contains('active') && e.target === overlay) {
            closeModal(id);
            // очищаем поля при закрытии (по желанию)
            if (id === 'createDispatchModal') {
                document.getElementById('dispatch_title').value = '';
                document.getElementById('dispatch_message').value = '';
                document.getElementById('charsLeft').textContent = '1000';
            }
            if (id === 'passwordModal') {
                document.getElementById('global_password').value = '';
                document.getElementById('password_error').style.display = 'none';
            }
        }
    });
});
dispatchType = 'email'; // по умолчанию

function selectDispatchType(el) {
    document.querySelectorAll('.type-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    dispatchType = el.dataset.type;
    
    const title = dispatchType === 'sms' ? 'Отправить как SMS' : 'Отправить по Email';
    document.getElementById('sendBtn').innerHTML = `<i class="fas fa-paper-plane"></i> ${title}`;
    document.getElementById('dispatch_message').placeholder = 
        dispatchType === 'sms' 
            ? "Короткое сообщение (до 160 символов лучше)" 
            : "Текст сообщения...";
}

function togglePanel(header) {
    const content = header.parentElement.querySelector('.panel-content');
    const icon = header.querySelector('i');
    content.classList.toggle('active');
    icon.classList.toggle('fa-chevron-down');
    icon.classList.toggle('fa-chevron-up');
}

async function loadSubscribers() {
    try {
        const res = await fetch('/api/get_subscribers');
        const data = await res.json();

        if (data.success && Array.isArray(data.subscribers)) {
            subscribers = data.subscribers.map(s => ({
                id: s.id,
                phone: s.phone || '',
                email: s.email || '',
                smsConsent: !!s.sms_consent,
                lastVisit: s.subscribed_at || '—'
            }));

            // СЧИТАЕМ СТАТИСТИКУ
            const total = subscribers.length;
            const withEmail = subscribers.filter(s => s.email && s.email.trim()).length;
            const withSMS = subscribers.filter(s => s.smsConsent).length;

            document.getElementById('totalSubs').textContent = total;
            document.getElementById('statTotal').textContent = total;
            document.getElementById('statEmail').textContent = withEmail;
            document.getElementById('statSMS').textContent = withSMS;
            document.getElementById('emailCount').textContent = `${withEmail} получателей`;
            document.getElementById('smsCount').textContent = `${withSMS} получателей`;
        }
    } catch (err) {
        console.error("Ошибка загрузки подписчиков:", err);
    }

    render();
}

// Обнови вызов при открытии модалки
function openCreateDispatchModal() {
    document.getElementById('dispatch_title').value = '';
    document.getElementById('dispatch_message').value = '';
    document.getElementById('charsLeft').textContent = '1000';
    
    // Сброс выбора типа
    document.querySelectorAll('.type-option').forEach(o => o.classList.remove('selected'));
    document.querySelector('.type-option[data-type="email"]').classList.add('selected');
    dispatchType = 'email';
    document.getElementById('sendBtn').innerHTML = '<i class="fas fa-paper-plane"></i> Отправить по Email';
    
    openModal('createDispatchModal');
    loadSubscribers(); // обновляем счётчики
}

// В prepareDispatch() добавь тип
function prepareDispatch() {
    const t = document.getElementById('dispatch_title').value.trim();
    const m = document.getElementById('dispatch_message').value.trim();
    if (!t || !m) return alert('Заполните поля');
    
    pendingDispatch = { 
        title: t, 
        message: m,
        type: dispatchType  // ← передаём тип!
    };
    closeModal('createDispatchModal');
    openModal('passwordModal');
}

// === УНИВЕРСАЛЬНЫЕ ФУНКЦИИ ДЛЯ APPLE-МОДАЛОК ===
const backdrop = document.getElementById('appleModalBackdrop');

function openAppleModal(id) {
    backdrop.classList.add('show');
    document.getElementById(id).classList.add('show');
    setTimeout(() => {
        const input = document.querySelector(`#${id} input[type="password"]`);
        if (input) input.focus();
    }, 100);
}

function closeAppleModal(id) {
    backdrop.classList.remove('show');
    document.getElementById(id).classList.remove('show');
    setTimeout(() => {
        document.getElementById(id).querySelectorAll('input, textarea').forEach(el => el.value = '');
        document.getElementById(id).querySelectorAll('.apple-modal-error').forEach(el => el.textContent = '');
    }, 400);
}

// Закрытие по клику на бэкдроп или Escape
backdrop.addEventListener('click', () => {
    document.querySelectorAll('.apple-modal.show').forEach(m => closeAppleModal(m.id));
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.apple-modal.show').forEach(m => closeAppleModal(m.id));
    }
});
// === НОВАЯ СИСТЕМА ВЫБОРА (как в feedback) — БЕЗ БАГОВ С ИКОНКАМИ ===
let isSelectionMode = false;

function enterSelectionMode() {
    isSelectionMode = true;
    document.body.classList.add('selection-mode');
    document.getElementById('startSelectionBtn').style.display = 'none';
    document.getElementById('bulkActions').classList.add('active');
    updateSelectionCounter();
}

function exitSelectionMode() {
    isSelectionMode = false;
    document.body.classList.remove('selection-mode');
    document.getElementById('startSelectionBtn').style.display = 'inline-flex';
    document.getElementById('bulkActions').classList.remove('active');
    document.querySelectorAll('#subsBody tr.selected').forEach(r => r.classList.remove('selected'));
    updateSelectionCounter();
}

function updateSelectionCounter() {
    const count = document.querySelectorAll('#subsBody tr.selected').length;
    document.getElementById('selectedCount').textContent = count;
    document.getElementById('deleteSelectedBtn').style.display = count > 0 ? 'inline-flex' : 'none';
}

// Клик по строке — только в режиме выбора
document.addEventListener('click', e => {
    if (!isSelectionMode) return;
    const row = e.target.closest('#subsBody tr');
    if (!row) return;
    if (e.target.closest('.btn-delete')) return; // не мешать кнопке "Удалить"
    row.classList.toggle('selected');
    updateSelectionCounter();
});

// Удаление выбранных
function prepareBulkDelete() {
    const selected = Array.from(document.querySelectorAll('#subsBody tr.selected'))
        .map(tr => parseInt(tr.querySelector('td').textContent))
        .filter(Boolean);
    if (selected.length === 0) return;
    deleteMode = 'bulk_subs';
    deleteIds = selected;
    document.getElementById('deleteConfirmText').textContent = `Удалить ${selected.length} выбранных подписчиков?`;
    openModal('deleteConfirmModal');
}

// Удаление всех
function prepareDeleteAll() {
    if (subscribers.length === 0) return;
    deleteMode = 'all_subs';
    deleteIds = subscribers.map(s => s.id);
    document.getElementById('deleteConfirmText').innerHTML = `Удалить <strong style="color:#ff4444;">ВСЕХ подписчиков</strong> (${deleteIds.length} шт.)?`;
    openModal('deleteConfirmModal');
}
