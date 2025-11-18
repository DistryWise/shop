// statuschain.js — ПОЛНАЯ СИНХРОНИЗАЦИЯ С АДМИНКОЙ

let lastOrderId = null;
let pollInterval = null;

// === РИСУЕМ ИКОНКУ ЧЕРЕЗ CANVAS ===
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
            ctx.beginPath();
            ctx.arc(size/2, size/2, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
            break;

        case 'processing':
            const teeth = 8;
            const r1 = 18, r2 = 22;
            ctx.beginPath();
            for (let i = 0; i < teeth; i++) {
                const angle = (i / teeth) * Math.PI * 2;
                const x1 = size/2 + r1 * Math.cos(angle);
                const y1 = size/2 + r1 * Math.sin(angle);
                const x2 = size/2 + r2 * Math.cos(angle);
                const y2 = size/2 + r2 * Math.sin(angle);
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

// === ЦЕПОЧКА СТАТУСОВ ===
window.startOrderChain = async function(orderId) {
    if (pollInterval) clearInterval(pollInterval);
    lastOrderId = orderId;
    const chain = document.getElementById('orderChain');
    if (!chain) return;

    chain.style.display = 'block';
    chain.innerHTML = `<div class="chain-loading">Загружаем статус...</div>`;

    const steps = [
        { status: 'pending',     label: 'В процессе',   type: 'pending' },
        { status: 'processing',  label: 'В обработке',  type: 'processing' },
        { status: 'shipping',    label: 'В доставке',   type: 'shipping' },
        { status: 'completed',   label: 'Выполнено',    type: 'completed' },
        { status: 'cancelled',   label: 'Отменён',      type: 'cancelled' }
    ];

    const poll = async () => {
        try {
            const res = await fetch(`/api/order_status/${orderId}?t=${Date.now()}`);
            const data = await res.json();

            if (!data.status) {
                chain.innerHTML = `<div class="chain-error">Заказ не найден</div>`;
                return;
            }

            const currentIdx = steps.findIndex(s => s.status === data.status);
            const isDone = data.completed || data.status === 'cancelled';
            const icons = steps.map(s => createStatusIcon(s.type));

            chain.innerHTML = `
                <div style="display:flex; justify-content:center; align-items:center; gap:1rem; flex-wrap:wrap; padding:0.5rem;">
                    ${steps.map((step, i) => `
                        <div style="text-align:center; position:relative; flex:1; min-width:70px;">
                            <div class="chain-img-circle ${i === currentIdx ? 'active' : ''} ${i < currentIdx ? 'done' : ''}"
                                 style="width:60px; height:60px; border-radius:50%; margin:0 auto; overflow:hidden;
                                        border:4px solid ${i <= currentIdx && !isDone ? '#fff' : '#444'};
                                        box-shadow:0 0 15px rgba(0,0,0,0.3); transition:all 0.4s ease;">
                                <img src="${icons[i]}" alt="${step.label}" style="width:100%; height:100%; object-fit:contain;">
                            </div>
                            <div style="margin-top:0.5rem; font-size:0.85rem; color:${i <= currentIdx ? '#fff' : '#888'};">${step.label}</div>
                            ${i < steps.length - 1 ? `
                                <div style="position:absolute; top:30px; left:70px; right:-30px; height:4px; 
                                            background:${i < currentIdx ? '#fff' : '#444'}; z-index:-1; border-radius:2px;"></div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
                <div style="margin-top:1rem; font-size:0.95rem; color:var(--text-secondary); text-align:center;">
                    Заказ #${orderId} — <strong style="color:#fff;">${data.label}</strong>
                </div>
                ${data.cancel_reason ? `
                    <div style="color:#ff6b6b; font-size:0.85rem; margin-top:0.5rem; font-style:italic; text-align:center;">
                        Причина отмены: ${data.cancel_reason}
                    </div>
                ` : ''}
                ${data.can_cancel && !isDone ? `
                    <button onclick="cancelOrder(${orderId})" 
                            style="margin-top:0.8rem; background:#ff6b6b; color:#fff; border:none; 
                                   padding:0.5rem 1.2rem; border-radius:12px; font-size:0.85rem; cursor:pointer;">
                        Отменить
                    </button>
                ` : ''}
                ${data.completed ? `<div style="color:#a0e7a0; margin-top:0.8rem; font-weight:600;">Заказ выполнен!</div>` : ''}
            `;

            if (isDone) {
                clearInterval(pollInterval);
                setTimeout(() => chain.style.display = 'none', 3000);
                if (document.getElementById('archiveModal').style.display === 'flex') {
                    window.loadUserOrders();
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    poll();
    pollInterval = setInterval(poll, 3000);
};

// === ОТМЕНА ЗАКАЗА (ПОЛЬЗОВАТЕЛЬ) ===
window.cancelOrder = async function(orderId) {
    const reason = prompt('Причина отмены:');
    if (!reason?.trim()) return;

    try {
        const res = await fetch('/api/cancel_order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: orderId, reason: reason.trim() })
        });
        const data = await res.json();

        if (data.success) {
            alert('Заказ отменён');
            window.startOrderChain(orderId);
        } else {
            alert(data.error || 'Ошибка');
        }
    } catch (e) {
        alert('Ошибка сервера');
    }
};

// === АРХИВ ЗАКАЗОВ ===
window.loadUserOrders = async function() {
    const list = document.getElementById('ordersList');
    if (!list) return;

    try {
        const res = await fetch('/api/user_orders?t=' + Date.now());
        const orders = await res.json();

        if (orders.length === 0) {
            list.innerHTML = '<div class="empty-cart">Архив пуст</div>';
            return;
        }

        list.innerHTML = orders.map(order => `
            <div class="order-card" style="background:rgba(255,255,255,0.05); border-radius:16px; padding:1.2rem; margin-bottom:1rem;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <h4 style="margin:0;">Заказ #${order.id}</h4>
                    <span style="background:${order.status_label[1]}; color:${order.status_label[2]}; padding:0.3rem 0.7rem; border-radius:10px; font-size:0.8rem;">
                        ${order.status_label[0]}
                    </span>
                </div>
                <p style="margin:0.4rem 0; font-size:0.85rem; color:var(--text-secondary);">
                    ${new Date(order.created_at).toLocaleDateString()} ${new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </p>
                <p style="font-weight:600; color:var(--primary); margin:0.4rem 0;">
                    ${order.total_str}
                </p>
                <div style="font-size:0.8rem; margin-top:0.5rem;">
                    ${order.items.map(i => `${i.title} × ${i.quantity}`).join(' • ')}
                </div>
                ${order.cancel_reason ? `
                    <p style="color:#ff6b6b; font-size:0.8rem; margin-top:0.5rem; font-style:italic;">
                        Причина отмены: ${order.cancel_reason}
                    </p>
                ` : ''}
            </div>
        `).join('');
    } catch (e) {
        list.innerHTML = '<div class="empty-cart">Ошибка загрузки</div>';
    }
};

// === ИНИЦИАЛИЗАЦИЯ ===
document.addEventListener('DOMContentLoaded', () => {
    const openBtn = document.getElementById('openArchiveBtn');
    const modal = document.getElementById('archiveModal');
    const closeBtn = document.getElementById('closeArchive');

    if (openBtn && modal) {
        openBtn.addEventListener('click', () => {
            modal.style.display = 'flex';
            window.loadUserOrders();
        });
    }
    if (closeBtn) closeBtn.addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });

    // Автозапуск
    setTimeout(async () => {
        if (sessionStorage.getItem('user_id')) {
            try {
                const res = await fetch('/api/user_orders?t=' + Date.now());
                const orders = await res.json();
                const active = orders.find(o => !['completed', 'cancelled'].includes(o.status));
                if (active) window.startOrderChain(active.id);
            } catch (e) {}
        }
    }, 1200);
});