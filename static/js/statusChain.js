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

    // Добавляем класс для мобильной адаптации
    const isMobile = window.innerWidth <= 768;
    if (isMobile) chain.classList.add('mobile-chain');

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

            // КРАСИВЫЙ НОМЕР ЗАКАЗА
            let displayId = '№0000';
            if (data.display_id) {
                displayId = data.display_id.startsWith('№') ? data.display_id : `№${data.display_id}`;
            } else if (window.activeOrders) {
                const found = window.activeOrders.find(o => o.id === orderId);
                if (found?.display_id) {
                    const match = found.display_id.match(/(\d{4})$/);
                    displayId = match ? `№${match[1]}` : found.display_id;
                }
            }

            // === МОБИЛЬНАЯ ВЕРТИКАЛЬНАЯ ЦЕПОЧКА + КРУПНЫЕ ТОВАРЫ ===
            const chainHTML = `
                <!-- Шапка с кнопками (только на мобилке) -->
                ${isMobile ? `
                <div style="position:sticky;top:0;background:rgba(15,15,25,0.95);backdrop-filter:blur(20px);
                              padding:calc(env(safe-area-inset-top) + 12px) 20px 16px;z-index:10;
                              border-bottom:1px solid rgba(255,255,255,0.08);display:flex;justify-content:space-between;align-items:center;">
                    <button onclick="document.getElementById('orderChain').style.display='none'" 
                            style="background:none;border:none;color:#fff;font-size:28px;cursor:pointer;padding:8px;">×</button>
                    <div style="font-weight:700;color:#fff;font-size:1.4rem;">Заказ ${displayId}</div>
                    <button onclick="document.getElementById('orderChain').style.display='none'" 
                            style="background:rgba(255,255,255,0.15);width:44px;height:44px;border-radius:50%;
                                   display:flex;align-items:center;justify-content:center;font-size:24px;cursor:pointer;">↑</button>
                </div>` : ''}

                <!-- Заголовок (на ПК) -->
                ${!isMobile ? `
                <div style="text-align:center;padding-top:2rem;margin-bottom:1.5rem;">
                    <div style="font-size:1.8rem;font-weight:800;color:#fff;">
                        Заказ <span style="color:#00ff95;">${displayId}</span>
                    </div>
                    ${data.label ? `<div style="color:#aaa;margin-top:0.5rem;font-size:1.1rem;">${data.label}</div>` : ''}
                </div>` : ''}

                <!-- Цепочка статусов — вертикальная на мобилке, горизонтальная на ПК -->
                <div class="status-chain-wrapper" style="${isMobile ? 'padding:20px 0;display:flex;flex-direction:column;gap:32px;align-items:center;' : 'display:flex;justify-content:center;gap:1.5rem;padding:2rem;flex-wrap:wrap;'}">
                    ${steps.map((step, i) => `
                        <div style="text-align:center;position:relative;${isMobile ? 'width:100%;' : 'flex:1;min-width:80px;'}">
                            <div class="chain-img-circle ${i === currentIdx ? 'active' : ''} ${i < currentIdx ? 'done' : ''}"
                                 style="width:${isMobile ? '84px' : '68px'};height:${isMobile ? '84px' : '68px'};border-radius:50%;margin:0 auto;
                                        border:5px solid ${i <= currentIdx && !isFinal ? '#00ff95' : '#444'};
                                        box-shadow:0 0 30px ${i === currentIdx ? 'rgba(0,255,149,0.7)' : 'transparent'};overflow:hidden;">
                                <img src="${icons[i]}" style="width:100%;height:100%;object-fit:contain;">
                            </div>
                            <div style="margin-top:12px;font-size:${isMobile ? '1.1rem' : '0.95rem'};font-weight:600;
                                        color:${i <= currentIdx ? '#fff' : '#888'};">${step.label}</div>
                            ${i < steps.length - 1 ? `
                                <div style="position:absolute;
                                           ${isMobile ? 'bottom:-44px;left:50%;transform:translateX(-50%);width:5px;height:60px;' : 'top:34px;left:70px;right:-40px;height:5px;'}
                                           background:${i < currentIdx ? '#00ff95' : '#444'};
                                           ${i < currentIdx ? 'box-shadow:0 0 20px rgba(0,255,149,0.5);' : ''}">
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>

                <!-- Товары — крупные карточки на мобилке -->
                ${data.items && data.items.length > 0 ? `
                <div style="margin:2rem 1rem 1rem;background:rgba(255,255,255,0.06);border-radius:24px;padding:1.6rem;">
                    <div style="font-weight:800;color:#fff;margin-bottom:1.2rem;font-size:1.3rem;">Состав заказа</div>
                    <div style="display:flex;flex-direction:column;gap:1.2rem;">
                        ${data.items.slice(0, isMobile ? 10 : 5).map(item => {
                            const imgSrc = item.image_url || (item.item_type === 'service' ? '/static/assets/service-placeholder.png' : '/static/assets/no-image.png');
                            const totalPrice = ((item.price_cents || 0) * item.quantity / 100).toFixed(2).replace('.', ',');
                            return `
                                <div style="display:flex;gap:1.2rem;align-items:center;background:rgba(255,255,255,0.06);padding:1.2rem;border-radius:20px;">
                                    <img src="${imgSrc}" onerror="this.src='/static/assets/no-image.png'"
                                         style="width:${isMobile ? '76px' : '60px'};height:${isMobile ? '76px' : '60px'};border-radius:16px;object-fit:cover;background:#222;flex-shrink:0;">
                                    <div style="flex:1;min-width:0;">
                                        <div style="font-weight:600;color:#fff;font-size:${isMobile ? '1.15rem' : '1rem'};line-height:1.4;">${item.title}</div>
                                        <div style="color:#aaa;font-size:0.95rem;margin-top:4px;">
                                            ${item.quantity} × ${item.price_str || (item.price_cents/100).toFixed(2) + ' ₽'}
                                        </div>
                                    </div>
                                    <div style="font-weight:700;color:#00ff95;font-size:1.4rem;white-space:nowrap;">
                                        ${totalPrice} ₽
                                    </div>
                                </div>
                            `;
                        }).join('')}
                        ${data.items.length > (isMobile ? 10 : 5) ? `<div style="text-align:center;color:#888;padding:1rem;">…и ещё ${data.items.length - (isMobile ? 10 : 5)} товаров</div>` : ''}
                    </div>
                    <div style="margin-top:1.6rem;padding-top:1.4rem;border-top:1px solid rgba(255,255,255,0.12);text-align:right;">
                        <strong style="color:#00ff95;font-size:1.8rem;font-weight:800;">
                            Итого: ${data.total_str || '—'}
                        </strong>
                    </div>
                </div>` : ''}

                <!-- Кнопка отмены -->
                ${data.can_cancel && !isFinal ? `
                    <div style="text-align:center;margin:2rem 1rem;">
                        <button onclick="cancelOrder(${orderId})"
                                style="background:#ff4444;color:#fff;border:none;padding:1rem 2.8rem;
                                       border-radius:24px;font-weight:700;font-size:1.3rem;cursor:pointer;
                                       box-shadow:0 8px 30px rgba(255,68,68,0.5);">
                            Отменить заказ
                        </button>
                    </div>
                ` : ''}

                <!-- Причина отмены -->
                ${data.cancel_reason ? `
                    <div style="margin:2rem 1rem;padding:1.6rem;background:rgba(255,68,68,0.15);
                                 border-radius:20px;border-left:5px solid #ff4444;color:#ff8c8c;">
                        <div style="font-weight:800;color:#ff4444;margin-bottom:0.8rem;">Причина отмены</div>
                        <div style="white-space:pre-wrap;line-height:1.6;">
                            ${String(data.cancel_reason).replace(/</g, '&lt;').replace(/\n/g, '<br>')}
                        </div>
                    </div>
                ` : ''}
            `;

            chain.innerHTML = chainHTML;

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
