// statuschain.js — ФИНАЛЬНАЯ ВЕРСИЯ 2025 + КНОПКА ОТМЕНЫ ВЕРНУЛАСЬ!

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
        { status: 'pending',     label: 'В процессе',   type: 'pending' },
        { status: 'processing',  label: 'Обработка',    type: 'processing' },
        { status: 'shipping',    label: 'В доставке',   type: 'shipping' },
        { status: 'completed',   label: 'Выполнено',    type: 'completed' },
        { status: 'cancelled',   label: 'Отменён',      type: 'cancelled' }
    ];

    const poll = async () => {
        try {
            const res = await fetch(`/api/order_status/${orderId}?t=${Date.now()}`);
            if (!res.ok) return;
            const data = await res.json();
            if (!data.status) return;

            const currentIdx = steps.findIndex(s => s.status === data.status);
            const isFinal = ['completed', 'cancelled'].includes(data.status);

            // КЛЮЧЕВОЕ СОБЫТИЕ — МОДАЛКА СРАЗУ УЗНАЁТ О СМЕНЕ СТАТУСА
            dispatchOrderStatusChange(orderId, data.status, isFinal);

            const icons = steps.map(s => createStatusIcon(s.type));

            chain.innerHTML = `
                <div style="display:flex;justify-content:center;align-items:center;gap:1rem;padding:1rem;flex-wrap:wrap;">
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

                <div style="text-align:center;margin-top:1rem;color:#aaa;">
                    Заказ #${orderId} — <strong style="color:#00ff95;">${data.label || data.status}</strong>
                </div>

                <!-- ВЕРНУЛИ КНОПКУ ОТМЕНЫ -->
                ${data.can_cancel && !isFinal ? `
                    <div style="text-align:center;margin-top:1.2rem;">
                        <button onclick="cancelOrder(${orderId})" 
                                style="background:#ff4444;color:#fff;border:none;padding:0.7rem 1.8rem;
                                       border-radius:16px;font-weight:600;cursor:pointer;font-size:1rem;
                                       box-shadow:0 4px 15px rgba(255,68,68,0.4);">
                            Отменить заказ
                        </button>
                    </div>
                ` : ''}

                ${data.cancel_reason ? `
                    <div style="color:#ff6b6b;font-size:0.9rem;margin-top:0.8rem;text-align:center;font-style:italic;">
                        Причина отмены: ${data.cancel_reason}
                    </div>
                ` : ''}
            `;

            if (isFinal) {
                clearInterval(pollInterval);
                pollInterval = null;
                setTimeout(() => chain.style.display = 'none', 5000);
            }
        } catch (e) {
            console.error(e);
        }
    };

    poll();
    pollInterval = setInterval(poll, 3000);
};

// НОВАЯ КРАСИВАЯ ОТМЕНА С APPLE-МОДАЛКОЙ
window.cancelOrder = function(orderId) {
  // Открываем модалку
  document.getElementById('cancelModalOrderId').textContent = orderId;
  document.getElementById('cancelReasonInput').value = '';
  document.getElementById('cancelOrderModal').style.display = 'flex';
  setTimeout(() => document.getElementById('cancelReasonInput').focus(), 300);
};

// Закрытие по клику вне
document.getElementById('cancelOrderModal')?.addEventListener('click', function(e) {
  if (e.target === this) this.style.display = 'none';
});

// === ФИНАЛЬНЫЙ ФИКС 2025: КНОПКА ОТМЕНЫ — РАБОТАЕТ 100%, НЕ ОТКРЫВАЕТ МОДАЛКУ САМА ===
document.getElementById('confirmCancelFinalBtn')?.addEventListener('click', async function(e) {
    e.stopPropagation(); // ← КРИТИЧЕСКИ ВАЖНО! Предотвращает всплытие и случайное открытие

    const modal = document.getElementById('cancelOrderModal');
    const reasonInput = document.getElementById('cancelReasonInput');
    const reason = reasonInput.value.trim();
    const orderId = parseInt(document.getElementById('cancelModalOrderId').textContent, 10);

    // Валидация
    if (!reason || reason.length < 5) {
        reasonInput.style.borderColor = '#ff4444';
        setTimeout(() => reasonInput.style.borderColor = '', 3000);
        reliableToast('Укажите причину', 'Минимум 5 символов', true);
        return;
    }

    const btn = this;
    btn.disabled = true;
    btn.textContent = 'Отменяем...';

    try {
        const res = await fetch('/api/cancel_order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: orderId, reason: reason })
        });

        const data = await res.json();

        if (res.ok && data.success) {
            // УСПЕХ → ЗАКРЫВАЕМ МОДАЛКУ И ОБНОВЛЯЕМ
            modal.style.display = 'none';
            reliableToast('Заказ отменён', '', false);

            dispatchOrderStatusChange(orderId, 'cancelled', true);
            window.startOrderChain(orderId); // обновит статус в цепочке

        } else {
            reliableToast('Ошибка', data.error || 'Не удалось отменить', true);
        }
    } catch (err) {
        console.error(err);
        reliableToast('Нет связи', 'Проверьте интернет', true);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Отменить заказ';
    }
});