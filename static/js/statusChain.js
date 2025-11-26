// statuschain.js — ФИНАЛЬНАЯ ВЕРСИЯ 2025 + КРАСИВЫЙ НОМЕР ЗАКАЗА

let pollInterval = null;
let currentOrderId = null;

function dispatchOrderStatusChange(orderId, status, isFinal = false) {
    document.dispatchEvent(new CustomEvent('orderStatusChanged', {
        detail: { orderId, status, isFinal }
    }));
}

function createStatusIcon(type) {
    const size = 60;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, size, size);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#fff';

    switch (type) {
        case 'pending':
            ctx.beginPath();
            ctx.arc(size/2, size/2, 20, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(size/2, size/2);
            ctx.lineTo(size/2, size/2 - 15);
            ctx.stroke();
            break;
        case 'processing':
            const teeth = 8;
            for (let i = 0; i < teeth; i++) {
                const angle = (i / teeth) * Math.PI * 2;
                const x1 = size/2 + 18 * Math.cos(angle);
                const y1 = size/2 + 18 * Math.sin(angle);
                const x2 = size/2 + 22 * Math.cos(angle);
                const y2 = size/2 + 22 * Math.sin(angle);
                if (i === 0) ctx.moveTo(x2, y2);
                else ctx.lineTo(x2, y2);
                ctx.lineTo(x1, y1);
            }
            ctx.closePath();
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(size/2, size/2, 10, 0, Math.PI * 2);
            ctx.stroke();
            break;
        case 'shipping':
            ctx.fillStyle = '#fff';
            ctx.fillRect(15, 25, 30, 15);
            ctx.fillRect(38, 20, 12, 20);
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(22, 42, 6, 0, Math.PI * 2);
            ctx.arc(38, 42, 6, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'completed':
            ctx.beginPath();
            ctx.moveTo(18, 30);
            ctx.lineTo(25, 37);
            ctx.lineTo(42, 20);
            ctx.lineWidth = 6;
            ctx.stroke();
            break;
        case 'cancelled':
            ctx.beginPath();
            ctx.moveTo(20, 20);
            ctx.lineTo(40, 40);
            ctx.moveTo(40, 20);
            ctx.lineTo(20, 40);
            ctx.lineWidth = 6;
            ctx.strokeStyle = '#ff6b6b';
            ctx.stroke();
            break;
    }
    return canvas.toDataURL();
}

window.startOrderChain = async function(orderId) {
    if (pollInterval) clearInterval(pollInterval);
    currentOrderId = orderId;

    const chain = document.getElementById('orderChain');
    if (!chain) return;

    chain.style.display = 'block';
    chain.innerHTML = `<div class="chain-loading">Загружаем статус...</div>`;

    const steps = [
        { status: 'pending',     label: 'Ожидает',   type: 'pending' },
        { status: 'processing',  label: 'Обработка',    type: 'processing' },
        { status: 'shipping',    label: 'В доставке',   type: 'shipping' },
        { status: 'completed',   label: 'Выполнено',    type: 'completed' },
        { status: 'cancelled', label: 'Отменён',      type: 'cancelled' }
    ];

    const poll = async () => {
        try {
            const res = await fetch(`/api/order_status/${orderId}?t=${Date.now()}`);
            if (!res.ok) return;
            const data = await res.json();
            if (!data.status) return;

            const currentIdx = steps.findIndex(s => s.status === data.status);
            const isFinal = ['completed', 'cancelled'].includes(data.status);

            dispatchOrderStatusChange(orderId, data.status, isFinal);

            const icons = steps.map(s => createStatusIcon(s.type));

            // КРАСИВЫЙ НОМЕР ЗАКАЗА ДЛЯ ПОЛЬЗОВАТЕЛЯ
let displayId = '№0000'; // fallback

if (window.activeOrders && Array.isArray(window.activeOrders)) {
    const found = window.activeOrders.find(o => o.id === orderId);
    if (found?.display_id) {
        // Если display_id = "№2025-0042" → берём только последние 4 цифры
        const match = found.display_id.match(/(\d{4})$/);
        displayId = match ? `№${match[1]}` : found.display_id;
    }
}

// Если сервер отдал display_id — тоже обрезаем до 4 цифр
if (data.display_id) {
    const match = String(data.display_id).match(/(\d{4})$/);
    if (match) {
        displayId = `№${match[1]}`;
    }
}
            // 2. Если сервер отдал display_id — тоже используем
            if (data.display_id) {
                displayId = data.display_id.startsWith('№') ? data.display_id : `№${data.display_id}`;
            }

            // Собираем цепочку
            // === ОТОБРАЖЕНИЕ ДЕТАЛЬНОЙ ЦЕПОЧКИ + ТОВАРЫ С ФОТО ===
            chain.innerHTML = `
                <!-- Заголовок с номером заказа -->
                <div style="text-align:center;margin-bottom:1.5rem;">
                    <div style="font-size:1.4rem;font-weight:700;color:#fff;">
                        Заказ <span style="color:#00ff95;font-size:1.6rem;">${displayId}</span>
                    </div>
                    ${data.label ? `<div style="color:#aaa;margin-top:0.4rem;">${data.label}</div>` : ''}
                </div>

                <!-- Цепочка статусов -->
                <div style="display:flex;justify-content:center;align-items:center;gap:1rem;padding:1rem;flex-wrap:wrap;margin-bottom:2rem;">
                    ${steps.map((step, i) => `
                        <div style="text-align:center;position:relative;flex:1;min-width:70px;">
                            <div class="chain-img-circle ${i === currentIdx ? 'active' : ''} ${i < currentIdx ? 'done' : ''}"
                                 style="width:60px;height:60px;border-radius:50%;margin:0 auto;overflow:hidden;
                                        border:4px solid ${i <= currentIdx && !isFinal ? '#00ff95' : '#444'};
                                        box-shadow:0 0 20px ${i === currentIdx ? 'rgba(0,255,149,0.6)' : 'transparent'};">
                                <img src="${icons[i]}" style="width:100%;height:100%;object-fit:contain;">
                            </div>
                            <div style="margin-top:0.5rem;font-size:0.9rem;color:${i <= currentIdx ? '#fff' : '#888'};">${step.label}</div>
                            ${i < steps.length - 1 ? `<div style="position:absolute;top:30px;left:70px;right:-30px;height:4px;background:${i < currentIdx ? '#00ff95' : '#444'};z-index:-1;"></div>` : ''}
                        </div>
                    `).join('')}
                </div>

                <!-- ТОВАРЫ В ЗАКАЗЕ — ТОЧНО КАК В АРХИВЕ -->
                ${data.items && data.items.length > 0 ? `
                <div style="background:rgba(255,255,255,0.05);border-radius:20px;padding:1.4rem;margin:1rem 0.5rem;">
                    <div style="font-weight:700;color:#fff;margin-bottom:1rem;font-size:1.1rem;">
                        Состав заказа
                    </div>
                    <div style="display:grid;gap:1rem;">
                        ${data.items.slice(0, 5).map(item => {
    // СЕРВЕР УЖЕ ОТДАЛ ПРАВИЛЬНЫЙ image_url — БЕРЁМ ЕГО НАПРЯМУЮ!
    const imgSrc = item.image_url;
    const fallback = item.item_type === 'service' 
        ? '/static/assets/service-placeholder.png' 
        : '/static/assets/no-image.png';

    const totalPrice = ((item.price_cents || 0) * item.quantity / 100)
        .toFixed(2).replace('.', ',');

    return `
        <div style="display:flex;gap:1rem;align-items:center;background:rgba(255,255,255,0.05);padding:1rem;border-radius:16px;">
            <img src="${imgSrc || fallback}"
                 onerror="this.onerror=null; this.src='${fallback}'"
                 style="width:56px;height:56px;border-radius:12px;object-fit:cover;background:#222;flex-shrink:0;">
            <div style="flex:1;min-width:0;">
                <div style="font-weight:600;color:#fff;word-break:break-word;">${item.title}</div>
                <div style="color:#aaa;font-size:0.9rem;">
                    ${item.quantity} × ${item.price_str || (item.price_cents/100).toLocaleString('ru-RU', {minimumFractionDigits: 2}) + ' ₽'}
                </div>
            </div>
            <div style="font-weight:700;color:#00ff95;font-size:1.2rem;white-space:nowrap;">
                ${totalPrice} ₽
            </div>
        </div>
    `;
}).join('')}
                        ${data.items.length > 5 ? `
                            <div style="text-align:center;color:#888;padding:0.8rem;font-size:0.95rem;">
                                …и ещё ${data.items.length - 5} товаров
                            </div>
                        ` : ''}
                    </div>
                    <div style="margin-top:1.2rem;padding-top:1rem;border-top:1px solid rgba(255,255,255,0.1);text-align:right;">
                        <strong style="color:#00ff95;font-size:1.4rem;">
                            Итого: ${data.total_str || order.total_str}
                        </strong>
                    </div>
                </div>
                ` : ''}

                <!-- Кнопка отмены -->
                ${data.can_cancel && !isFinal ? `
                    <div style="text-align:center;margin-top:1.5rem;">
                        <button onclick="cancelOrder(${orderId})"
                                style="background:#ff4444;color:#fff;border:none;padding:0.9rem 2.2rem;
                                       border-radius:20px;font-weight:600;cursor:pointer;font-size:1.1rem;
                                       box-shadow:0 6px 20px rgba(255,68,68,0.5);">
                            Отменить заказ
                        </button>
                    </div>
                ` : ''}

                <!-- Причина отмены -->
                ${data.cancel_reason ? `
                    <div style="margin-top:1.5rem;padding:1.2rem;background:rgba(255,68,68,0.12);
                                 border-radius:16px;border-left:4px solid #ff4444;color:#ff7f7f;
                                 font-size:0.95rem;line-height:1.6;">
                        <div style="font-weight:700;color:#ff4444;margin-bottom:0.5rem;">
                            Причина отмены
                        </div>
                        <div style="white-space:pre-wrap;">
                            ${String(data.cancel_reason).replace(/</g, '&lt;').replace(/\n/g, '<br>')}
                        </div>
                    </div>
                ` : ''}
            `;

            if (isFinal) {
                clearInterval(pollInterval);
                pollInterval = null;
                setTimeout(() => chain.style.display = 'none', 6000);
            }
        } catch (e) {
            console.error('Ошибка в цепочке статусов:', e);
        }
    };

    poll();
    pollInterval = setInterval(poll, 3200);
};

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