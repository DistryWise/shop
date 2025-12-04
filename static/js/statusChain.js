// statuschain.js — ФИНАЛЬНАЯ ВЕРСИЯ 2025 + КРАСИВЫЙ НОМЕР ЗАКАЗА

// ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
// ГЛОБАЛЬНАЯ ФУНКЦИЯ — РАБОТАЕТ ВЕЗДЕ И ВСЕГДА
const freshImg = url => url ? `${url}?t=${Date.now()}${Math.random().toFixed(5)}` : '/static/assets/no-image.png';
// ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑

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
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
            const bg = isLight ? '255,255,255' : '15,15,30';
            const cardBg = isLight ? '255,255,255' : '30,30,40';
            const border = isLight ? '0,0,0,0.08' : '255,255,255,0.1';
            const text = isLight ? '#000' : '#fff';
            const text2 = isLight ? '#555' : '#ccc';
            const accent = isLight ? '#00d47a' : '#00ff95';
            const cancel = isLight ? '#ff3b30' : '#ff453a';
            const shadow = isLight ? '0,0,0,0.12' : '0,0,0,0.5';
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

// ←←←←←←←←←← ФИНАЛ: ПК = 100% ТВОЯ ВЕРСИЯ | МОБИЛКА = СТАТУС ВЫДЕЛЯЕТСЯ ЯРКО И СРАЗУ БРОСАЕТСЯ В ГЛАЗА ←←←←←←←←←←
const isMobile = window.innerWidth <= 768;

const chainHTML = isMobile ? `
<!-- МОБИЛЬНАЯ ВЕРСИЯ — ПОЛНАЯ ПОДДЕРЖКА СВЕТЛОЙ ТЕМЫ -->
<div style="padding:16px;font-family:-apple-system,system-ui,'SF Pro Display',sans-serif;color:${text};">
  <div style="background:rgba(${cardBg},0.98);
              border-radius:28px;overflow:hidden;position:relative;
              border:1px solid rgba(${border});
              box-shadow:0 20px 50px rgba(${shadow});
              backdrop-filter:blur(20px);">

    <!-- Полоска слева -->
    <div style="position:absolute;left:0;top:0;bottom:0;width:7px;
                background:${data.status==='cancelled'?cancel:accent};
                box-shadow:0 0 30px ${data.status==='cancelled'?cancel+'99':accent+'99'};
                border-radius:28px 0 0 28px;
                animation:${data.status==='cancelled'?'none':'pulse 2.2s infinite'};"></div>
    <style>@keyframes pulse{0%,100%{opacity:0.8;transform:scaleY(1)}50%{opacity:1;transform:scaleY(1.15);box-shadow:0 0 40px ${accent}99}}</style>

    <div style="padding:32px 24px 24px;text-align:center;">
      <div style="font-size:13px;color:${text2};letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Текущий статус</div>
      <div style="font-size:28px;font-weight:900;
                  background:linear-gradient(90deg,${accent},${accent}dd);
                  -webkit-background-clip:text;background-clip:text;color:transparent;
                  text-shadow:0 0 30px ${accent}66;line-height:1.1;">
        ${steps[currentIdx].label}
      </div>
      <div style="font-size:16px;color:${text2};margin-top:8px;">
        ${currentIdx === 0 ? 'Ожидаем оплату' :
          currentIdx === 1 ? 'Собираем ваш заказ' :
          currentIdx === 2 ? 'Передан курьеру' :
          currentIdx === 3 ? 'Едет к вам' : 'Готов к выдаче'}
      </div>
    </div>

    <div style="text-align:center;padding:0 24px 28px;border-bottom:1px solid rgba(${border});">
      <div style="font-size:36px;font-weight:900;letter-spacing:-1.8px;color:${text};">Заказ ${displayId}</div>
      <div style="font-size:32px;font-weight:800;color:${accent};margin-top:6px;">${data.total_str || '—'}</div>
    </div>

    ${data.items && data.items.length > 0 ? `
      <div style="padding:24px 20px 20px;">
        <div style="display:flex;gap:16px;overflow-x:auto;scrollbar-width:none;padding:8px 0;">
          ${data.items.map(item => `
            <div style="flex-shrink:0;width:100px;text-align:center;">
              <img src="${freshImg(item.image_url)}"
                   style="width:100px;height:100px;border-radius:24px;object-fit:cover;
                          box-shadow:0 12px 30px rgba(${shadow});"
                   onerror="this.src='/static/assets/no-image.png'">
              <div style="margin-top:8px;font-size:13px;color:${text2};">
                ${item.quantity > 1 ? item.quantity+'× ' : ''}${item.title.length > 17 ? item.title.slice(0,17)+'...' : item.title}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    ${data.can_cancel && data.status !== 'cancelled' && data.status !== 'completed' ? `
      <div style="padding:20px 24px 32px;text-align:center;">
        <button onclick="cancelOrder(${orderId})"
                style="background:transparent;color:${cancel};border:2px solid ${cancel};
                       padding:14px 32px;border-radius:18px;font-size:17px;font-weight:700;
                       width:100%;max-width:300px;cursor:pointer;">
          Отменить заказ
        </button>
      </div>
    ` : ''}

    ${data.status === 'cancelled' ? `
      <div style="position:absolute;left:0;top:0;bottom:0;width:7px;background:${cancel};
                  box-shadow:0 0 30px ${cancel}99;border-radius:28px 0 0 28px;"></div>
      <div style="padding:20px 24px 32px;background:${cancel}12;text-align:center;">
        <div style="font-size:22px;font-weight:900;color:${cancel};">Заказ отменён</div>
        ${data.cancel_reason ? `<div style="margin-top:10px;font-size:15px;color:${cancel}cc;">${data.cancel_reason}</div>` : ''}
      </div>
    ` : ''}
  </div>
</div>
` : `
<!-- ДЕСКТОПНАЯ ВЕРСИЯ — ТОЖЕ С ПОДДЕРЖКОЙ СВЕТЛОЙ ТЕМЫ -->
<div style="padding:24px 20px;font-family:-apple-system,system-ui,'SF Pro Display',sans-serif;color:${text};">
  <div style="background:rgba(${cardBg},0.98);
              border-radius:28px;padding:24px 28px 28px;
              border:1px solid rgba(${border});
              box-shadow:0 20px 50px rgba(${shadow});
              backdrop-filter:blur(20px);">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;">
      <div>
        <div style="font-size:32px;font-weight:800;letter-spacing:-1.2px;color:${text};">Заказ ${displayId}</div>
        <div style="font-size:24px;font-weight:700;color:${accent};margin-top:6px;">${data.total_str || '—'}</div>
      </div>
      ${data.can_cancel && data.status !== 'cancelled' && data.status !== 'completed' ? `
        <button onclick="cancelOrder(${orderId})"
                style="width:56px;height:56px;background:${cancel}22;border:2px solid ${cancel};border-radius:18px;
                       display:flex;align-items:center;justify-content:center;cursor:pointer;">
          <i class="fas fa-times" style="font-size:24px;color:${cancel};"></i>
        </button>
      ` : ''}
    </div>

    <div style="display:flex;align-items:center;justify-content:center;gap:20px;margin:32px 0;">
      ${steps.slice(0,4).map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return `
          <div style="text-align:center;">
            <div style="width:60px;height:60px;margin:0 auto 10px;border-radius:50%;overflow:hidden;
                        border:4px solid ${done || active ? accent : 'rgba('+(isLight?'0,0,0,0.15':'255,255,255,0.15')+')'};
                        box-shadow:${active ? '0 0 40px '+accent+'88' : 'none'};">
              <img src="${icons[i]}" style="width:100%;height:100%;object-fit:contain;">
            </div>
            <div style="font-size:13px;font-weight:700;color:${done || active ? text : text2}">${step.label}</div>
          </div>
          ${i < 3 ? `<div style="flex:1;height:3px;background:${done ? accent : 'rgba('+(isLight?'0,0,0,0.15':'255,255,255,0.15')+')'};
                             box-shadow:${done ? '0 0 16px '+accent+'66' : 'none'};"></div>` : ''}
        `;
      }).join('')}
    </div>

    ${data.status === 'cancelled' ? `
      <div style="margin:20px -28px -28px;padding:20px 28px;background:${cancel}22;
                  border-radius:0 0 28px 28px;text-align:center;">
        <div style="font-size:18px;font-weight:700;color:${cancel};">Заказ отменён</div>
        ${data.cancel_reason ? `<div style="margin-top:8px;font-size:15px;color:${cancel}cc;">${data.cancel_reason}</div>` : ''}
      </div>
    ` : ''}

    ${data.items && data.items.length > 0 ? `
      <div style="margin-top:28px;">
        <div style="font-size:15px;color:${text2};margin-bottom:12px;font-weight:600;">
          ${data.items.length} товар${data.items.length > 4 ? 'ов' : data.items.length === 1 ? '' : 'а'}
        </div>
        <div style="display:flex;gap:12px;overflow-x:auto;padding-bottom:8px;scrollbar-width:none;">
          ${data.items.map(item => `
            <div style="flex-shrink:0;width:80px;text-align:center;">
              <div style="width:80px;height:80px;border-radius:18px;overflow:hidden;
                          background:${isLight?'#f5f5f7':'#111'};box-shadow:0 8px 20px rgba(${shadow});margin-bottom:8px;">
                <img src="${freshImg(item.image_url)}"
                     style="width:100%;height:100%;object-fit:cover;"
                     onerror="this.src='/static/assets/no-image.png'">
              </div>
              <div style="font-size:12px;color:${text2};line-height:1.3;">
                ${item.quantity}× ${item.title.length > 20 ? item.title.slice(0,20)+'...' : item.title}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  </div>
</div>
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
    document.querySelector('[data-tab="active"] span')?.then(b => b.textContent = activeCount > 0 ? activeCount : '');
    document.querySelector('[data-tab="cancelled"] span')?.then(b => b.textContent = cancelledCount > 0 ? cancelledCount : '');
    document.querySelector('[data-tab="completed"] span')?.then(b => b.textContent = completedCount > 0 ? completedCount : '');

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