// statuschain.js — ФИНАЛЬНАЯ ВЕРСИЯ 2025 — ИДЕАЛЬНЫЙ APPLE UI



let pollInterval = null;

function dispatchOrderStatusChange(orderId, status, isFinal = false) {
    document.dispatchEvent(new CustomEvent('orderStatusChanged', { detail: { orderId, status, isFinal } }));
}

function createStatusIcon(type) {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, size, size);
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = '#fff';

    switch (type) {
        case 'pending': ctx.beginPath(); ctx.arc(32, 32, 20, 0, Math.PI*2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(32, 32); ctx.lineTo(32, 17); ctx.stroke(); break;
        case 'processing':
            const t = 8;
            for (let i = 0; i < t; i++) {
                const a = (i / t) * Math.PI * 2;
                const x1 = 32 + 19 * Math.cos(a), y1 = 32 + 19 * Math.sin(a);
                const x2 = 32 + 24 * Math.cos(a), y2 = 32 + 24 * Math.sin(a);
                if (i === 0) ctx.moveTo(x2, y2); else ctx.lineTo(x2, y2); ctx.lineTo(x1, y1);
            }
            ctx.closePath(); ctx.stroke();
            ctx.beginPath(); ctx.arc(32, 32, 10, 0, Math.PI*2); ctx.stroke();
            break;
        case 'shipping':
            ctx.fillStyle = '#fff'; ctx.fillRect(16, 26, 32, 16); ctx.fillRect(40, 22, 12, 20);
            ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(24, 44, 6, 0, Math.PI*2); ctx.arc(40, 44, 6, 0, Math.PI*2); ctx.fill();
            break;
        case 'completed':
            ctx.beginPath(); ctx.moveTo(18, 32); ctx.lineTo(26, 40); ctx.lineTo(46, 20); ctx.lineWidth = 6.5; ctx.stroke();
            break;
        case 'cancelled':
            ctx.beginPath(); ctx.moveTo(20, 20); ctx.lineTo(44, 44); ctx.moveTo(44, 20); ctx.lineTo(20, 44);
            ctx.lineWidth = 6.5; ctx.strokeStyle = '#ff6b6b'; ctx.stroke();
            break;
    }
    return canvas.toDataURL();
}
window.startOrderChain = async function(orderId) {
    if (pollInterval) clearInterval(pollInterval);

    const chain = document.getElementById('orderChain');
    if (!chain) return;

    let statusBar = chain.querySelector('.order-status-mini');
    if (!statusBar) {
        statusBar = document.createElement('div');
        statusBar.className = 'order-status-mini';
        chain.appendChild(statusBar);
    }

    chain.style.display = 'block';

    // Кешируем элементы один раз
    let orderIdEl, totalEl, statusEl, fillEl, icons, itemsMini, cancelBtn;

    const poll = async () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const isMobile = window.innerWidth <= 1026;

    try {
        const res = await fetch(`/api/order_status/${orderId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data.status) return;

        const currentStep = ['pending','processing','shipping','completed'].indexOf(data.status);
        const isFinal = ['completed', 'cancelled'].includes(data.status);
        const progressWidth = currentStep > 0 ? (currentStep * 33.33 - 6) + '%' : '0%';

        dispatchOrderStatusChange(orderId, data.status, isFinal);

        // === ПЕРВЫЙ РАЗ — СОЗДАЁМ РАЗМЕТКУ БЕЗ ПЕРЕМЕННЫХ В СТИЛЯХ ===
        if (!statusBar.dataset.ready) {
            statusBar.innerHTML = `
<style>
    @keyframes fill-progress { from { width: 0%; } to { width: var(--progress); } }
    @keyframes pulse-glow-light { 0%,100%{box-shadow:0 0 0 0 transparent} 50%{box-shadow:0 0 20px 8px rgba(0,0,0,.25)} }
    @keyframes pulse-glow-dark  { 0%,100%{box-shadow:0 0 0 0 transparent} 50%{box-shadow:0 0 20px 8px rgba(255,255,255,.4)} }

    .order-status-mini { padding:20px; font-family:-apple-system; font-size:14px; background:var(--bg); border-top:1px solid var(--border); }
    .order-id { font-size:19px; font-weight:600; color:var(--text); }
    .mini-total { font-size:18px; font-weight:600; color:var(--muted); }
    .current-status { font-size:${isMobile?'16px':'22px'}; font-weight:700; color:var(--text); text-align:center; margin:12px 0; }
    .progress-row { display:flex; justify-content:space-between; align-items:center; position:relative; height:44px; padding:0 ${isMobile?'10px':'20px'}; }
    .progress-line { position:absolute; top:50%; left:${isMobile?'32px':'40px'}; right:${isMobile?'32px':'40px'}; height:2px; background:var(--line); border-radius:2px; z-index:1; }
    .progress-fill { position:absolute; top:50%; left:${isMobile?'32px':'40px'}; height:2px; background:var(--text); width:0%; animation:fill-progress 1.4s cubic-bezier(0.16,1,0.3,1) forwards; border-radius:2px; z-index:2; }
    .step-icon { width:44px; height:44px; border-radius:50%; background:var(--text); color:${isLight?'#fff':'#000'}; display:flex; align-items:center; justify-content:center; font-size:22px; z-index:3; transition:all .4s; }
    .step-icon.active { animation:var(--pulse) 3s infinite ease-in-out; }
    .items-mini { 
    display: flex; 
    gap: 12px; 
    padding: 20px 20px 20px calc(50% - 45px); /* ← магия центрирования */
    overflow-x: auto; 
    scrollbar-width: none;
    scroll-snap-type: x mandatory;
}
.items-mini > * { scroll-snap-align: center; flex-shrink: 0; }
    .item-img { width:90px; height:90px; border-radius:20px; object-fit:cover; box-shadow:0 6px 20px rgba(0,0,0,${isLight?'0.12':'0.45'}); }
</style>

<div class="mini-header"><div class="order-id"></div><div class="mini-total"></div></div>
<div class="status-block">
    <div class="current-status"></div>
    <div class="progress-row">
        <div class="progress-line"></div>
        <div class="progress-fill"></div>
        <div class="step-icon"><i class="fa-solid fa-credit-card"></i></div>
        <div class="step-icon"><i class="fa-regular fa-clock"></i></div>
        <div class="step-icon"><i class="fa-solid fa-truck-fast"></i></div>
        <div class="step-icon"><i class="fa-solid fa-check"></i></div>
    </div>
</div>
<div class="items-mini"></div>
<div class="cancel-wrapper" style="margin-top:18px;text-align:center"></div>
            `;

            // Кешируем элементы
            orderIdEl = statusBar.querySelector('.order-id');
            totalEl = statusBar.querySelector('.mini-total');
            statusEl = statusBar.querySelector('.current-status');
            fillEl = statusBar.querySelector('.progress-fill');
            icons = statusBar.querySelectorAll('.step-icon');
            itemsMini = statusBar.querySelector('.items-mini');
            cancelBtn = statusBar.querySelector('.cancel-wrapper');

            statusBar.dataset.ready = "yes";
        }

        // === ДАЛЕЕ — ТОЛЬКО ОБНОВЛЕНИЕ ДАННЫХ ===
        const prevStep = parseInt(statusBar.dataset.step || -1);

        // Обновляем CSS-переменные
        statusBar.style.setProperty('--bg', isLight ? '#f2f2f7' : '#111');
        statusBar.style.setProperty('--border', isLight ? '#ddd' : '#333');
        statusBar.style.setProperty('--text', isLight ? '#000' : '#fff');
        statusBar.style.setProperty('--muted', isLight ? '#666' : '#888');
        statusBar.style.setProperty('--line', isLight ? '#ddd' : '#444');
        statusBar.style.setProperty('--progress', progressWidth);
        statusBar.style.setProperty('--pulse', isLight ? 'pulse-glow-light' : 'pulse-glow-dark');

        // Только если статус изменился — анимируем прогресс и иконки
        if (currentStep !== prevStep) {
            statusBar.dataset.step = currentStep;
            statusEl.textContent = ['Ожидает оплаты','Собираем заказ','В доставке','Доставлено'][currentStep] || 'Ожидает';
            icons.forEach((icon, i) => {
                icon.classList.toggle('done', i < currentStep);
                icon.classList.toggle('active', i === currentStep);
            });
        }

        // Всегда обновляем (могут меняться)
        orderIdEl.textContent = data.display_id ? (data.display_id.startsWith('№') ? data.display_id : `№${data.display_id}`) : '№0000';
        totalEl.textContent = data.total_str || '';

        const visible = (data.items || []).slice(0,8);
        const hasMore = data.items?.length > 8;
                // === ТОВАРЫ — БЕЗ МИГАНИЯ И БЕЗ ОШИБОК ===
        const currentItemsKey = data.items?.map(i => `${i.image_url || ''}|${i.title}|${i.quantity}`).join(';;') || '';

        // Если товары не менялись — вообще ничего не трогаем
        if (statusBar.dataset.lastItemsKey === currentItemsKey && statusBar.dataset.itemsRendered) {
            // ничего не делаем — картинки остаются на месте
        } else {
            const visible = (data.items || []).slice(0, 8);
            const hasMore = data.items?.length > 8;

            itemsMini.innerHTML = visible.map(item => `
                <div class="item-mini">
                    <img src="${item.image_url || '/static/assets/no-image.png'}" class="item-img"
                         onerror="this.src='/static/assets/no-image.png'">
                    <div class="item-title">${item.title}</div>
                    <div class="item-details"><span>${item.quantity}×</span>${item.price_str || ''}</div>
                </div>
            `).join('') + (hasMore ? `
                <div class="item-mini" style="display:flex;align-items:center;justify-content:center;width:90px;">
                    <div style="font-size:22px;font-weight:900;color:var(--muted)">+${data.items.length-8}</div>
                </div>
            ` : '');

            statusBar.dataset.lastItemsKey = currentItemsKey;
            statusBar.dataset.itemsRendered = "yes";
        }

        cancelBtn.innerHTML = data.can_cancel && !isFinal ? `
            <button onclick="cancelOrder(${orderId})" style="padding:10px 24px;background:transparent;color:#ff3b30;border:2px solid #ff3b30;border-radius:16px;font-size:14.5px;font-weight:700;cursor:pointer;">
                Отменить заказ
            </button>` : '';

        if (isFinal) {
            clearInterval(pollInterval);
            pollInterval = null;
            setTimeout(() => {
                statusBar.style.opacity = '0';
                setTimeout(() => chain.style.display = 'none', 600);
            }, 7000);
        }

    } catch (e) { console.error(e); }
};

    poll();
    pollInterval = setInterval(poll, 3000);
};

// Остальное без изменений
window.cancelOrder = function(orderId) {
    document.getElementById('cancelModalOrderId').textContent = orderId;
    document.getElementById('cancelReasonInput').value = '';
    document.getElementById('cancelOrderModal').style.display = 'flex';
    setTimeout(() => document.getElementById('cancelReasonInput').focus(), 300);
};

document.getElementById('cancelOrderModal')?.addEventListener('click', e => e.target === this && (this.style.display = 'none'));

document.getElementById('confirmCancelFinalBtn')?.addEventListener('click', async function(e) {
    e.stopPropagation();
    const reason = document.getElementById('cancelReasonInput').value.trim();
    const orderId = parseInt(document.getElementById('cancelModalOrderId').textContent, 10);

    if (!reason || reason.length < 5) {
        if (window.reliableToast) reliableToast('Укажите причину', 'Минимум 5 символов', true);
        return;
    }

    this.disabled = true;
    this.textContent = 'Отменяем...';

    try {
        const res = await fetch('/api/cancel_order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_id: orderId, reason }) });
        const data = await res.json();

        if (res.ok && data.success) {
            document.getElementById('cancelOrderModal').style.display = 'none';
            if (window.reliableToast) reliableToast('Заказ отменён', '', false);
            dispatchOrderStatusChange(orderId, 'cancelled', true);
            window.startOrderChain(orderId);
        } else {
            if (window.reliableToast) reliableToast('Ошибка', data.error || 'Не удалось отменить', true);
        }
    } catch {
        if (window.reliableToast) reliableToast('Нет связи', 'Проверьте интернет', true);
    } finally {
        this.disabled = false;
        this.textContent = 'Отменить заказ';
    }
});

// Остальной код отмены заказа (не меняется)
window.cancelOrder = function(orderId) {
    document.getElementById('cancelModalOrderId').textContent = orderId;
    document.getElementById('cancelReasonInput').value = '';
    document.getElementById('cancelOrderModal').style.display = 'flex';
    setTimeout(() => document.getElementById('cancelReasonInput').focus(), 300);
};

document.getElementById('cancelOrderModal')?.addEventListener('click', function(e) {
    if (e.target === this) this.style.display = 'none';
});

document.getElementById('confirmCancelFinalBtn')?.addEventListener('click', async function(e) {
    e.stopPropagation();

    const modal = document.getElementById('cancelOrderModal');
    const reasonInput = document.getElementById('cancelReasonInput');
    const reason = reasonInput.value.trim();
    const orderId = parseInt(document.getElementById('cancelModalOrderId').textContent, 10);

    if (!reason || reason.length < 5) {
        reasonInput.style.borderColor = '#ff4444';
        setTimeout(() => reasonInput.style.borderColor = '', 3000);
        if (window.reliableToast) reliableToast('Укажите причину', 'Минимум 5 символов', true);
        return;
    }

    const btn = this;
    btn.disabled = true;
    btn.textContent = 'Отменяем...';

    try {
        const res = await fetch('/api/cancel_order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: orderId, reason })
        });

        const data = await res.json();

        if (res.ok && data.success) {
            modal.style.display = 'none';
            if (window.reliableToast) reliableToast('Заказ отменён', '', false);
            dispatchOrderStatusChange(orderId, 'cancelled', true);
            window.startOrderChain(orderId);
        } else {
            if (window.reliableToast) reliableToast('Ошибка', data.error || 'Не удалось отменить', true);
        }
    } catch (err) {
        console.error(err);
        if (window.reliableToast) reliableToast('Нет связи', 'Проверьте интернет', true);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Отменить заказ';
    }
    
});
// ОБНОВЛЕНИЕ СЧЁТЧИКОВ В ТАБАХ АРХИВА — ФИНАЛЬНАЯ ВЕРСИЯ 2025
// === ПРАВИЛЬНЫЕ СЧЁТЧИКИ ДЛЯ ТРЁХ ОТДЕЛЬНЫХ ТАБОВ (2025) ===
function updateArchiveTabsCounts() {
    // Считаем строго по статусам
    const activeCount     = allOrders.filter(o => 
        !['completed', 'cancelled'].includes(o.status)
    ).length;

    const cancelledCount  = allOrders.filter(o => o.status === 'cancelled').length;
    const completedCount  = allOrders.filter(o => o.status === 'completed').length;

    // Обновляем бейджи — проверь, какие у тебя ID у спанов!
    // Чаще всего так:
    document.querySelector('[data-tab="active"] span')?.then?.(b => b.textContent = activeCount > 0 ? activeCount : '');
// Нет! Так нельзя!

// Правильно:
const activeBadge = document.querySelector('[data-tab="active"] span');
if (activeBadge) activeBadge.textContent = activeCount > 0 ? activeCount : '';

const cancelledBadge = document.querySelector('[data-tab="cancelled"] span');
if (cancelledBadge) cancelledBadge.textContent = cancelledCount > 0 ? cancelledCount : '';

const completedBadge = document.querySelector('[data-tab="completed"] span');
if (completedBadge) completedBadge.textContent = completedCount > 0 ? completedCount : '';

    // Если у тебя ID, а не data-tab — подставь свои:
    // document.getElementById('activeCountBadge')?.textContent = activeCount || '';
    // document.getElementById('cancelledCountBadge')?.textContent = cancelledCount || '';
    // document.getElementById('completedCountBadge')?.textContent = completedCount || '';
}

// Вызываем при переключении табов (на всякий случай с небольшой задержкой)
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setTimeout(updateArchiveTabsCounts, 300); // даём время на загрузку новых заказов
  });
});