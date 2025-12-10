
// === АВТООЧИСТКА ВСЕГО ПРИ ВЫХОДЕ ИЗ АККАУНТА ===
document.addEventListener('click', function(e) {
    const logoutBtn = e.target.closest('button, a, div');
    if (!logoutBtn) return;

    const logoutTexts = ['выйти', 'выход', 'logout', 'sign out', 'выйти из аккаунта'];
    const text = logoutBtn.textContent?.toLowerCase() || '';
    const href = logoutBtn.getAttribute('href') || '';
    
    if (logoutTexts.some(t => text.includes(t)) || href.includes('/logout') || href.includes('/api/logout')) {
        // 1. Убиваем всё, что связано с заказами
        document.getElementById('floatingOrderBar')?.remove();
        document.getElementById('multiOrderModal')?.remove();
        document.getElementById('orderChainContainer')?.remove();
        
        // 2. Останавливаем все поллинги
        if (window.pollInterval) { clearInterval(window.pollInterval); window.pollInterval = null; }
        if (window.activeOrdersInterval) clearInterval(window.activeOrdersInterval);
        
        // 3. Чистим глобальные массивы
        window.activeOrders = [];
        window.allOrders = [];
        
        // 4. Убираем тосты и алерты
        document.querySelectorAll('.toast-alert, .reliable-toast, #cancelFloodAlert, .custom-alert').forEach(el => el.remove());
        
        // 5. Принудительно скрываем всё, что может остаться
        document.querySelectorAll('.modal, .auth-modal, [style*="display: flex"], [style*="display: block"]').forEach(el => {
            if (el.id !== 'authModal') el.style.display = 'none';
        });
        
        // 6. Сбрасываем бейджи
        document.querySelectorAll('.cart-count, #activeOrdersBadge, #activeCount').forEach(el => {
            if (el) el.textContent = '';
        });
    }
});

// МОБИЛЬНАЯ КНОПКА «ОФОРМИТЬ ЗАКАЗ» — 100% РАБОТАЕТ С 2025 ГОДА
document.addEventListener('DOMContentLoaded', () => {
  const mobileBtn = document.getElementById('mobileCheckoutBtn');
  const desktopBtn = document.getElementById('checkoutBtn');
  const modal = document.getElementById('checkoutModal');

  if (!mobileBtn || !modal) return;

  // Синхронизация состояния disabled
  const syncButtonState = () => {
    const hasItems = document.querySelectorAll('.apple-cart-item').length > 0;
    if (hasItems) {
      mobileBtn.removeAttribute('disabled');
    } else {
      mobileBtn.setAttribute('disabled', 'disabled');
    }
  };

  // Клик = открываем ту же модалку, что и на десктопе
  mobileBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (mobileBtn.hasAttribute('disabled')) return;

    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';

    // Если у тебя есть глобальная функция открытия — вызываем и её
    if (typeof openCheckoutModal === 'function') openCheckoutModal();
    if (typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new Event('checkoutModalOpened'));
    }
  });

  // Синхронизируем при обновлении корзины
  document.addEventListener('cartUpdated', syncButtonState);
  syncButtonState(); // при загрузке

  // На всякий случай — через секунду ещё раз (если cart.js грузится дольше)
  setTimeout(syncButtonState, 1000);
});

// ─────── НОВЫЙ БЕЗОПАСНЫЙ СВАЙП ТОЛЬКО ДЛЯ multiOrderModal (2025) ───────
(() => {
  const modal = document.getElementById('multiOrderModal');
  if (!modal) return;

  // Это именно та шторка, которую мы тянем (у тебя она с инлайновыми стилями)
  const sheet = modal.children[0]; // первый дочерний div с background:var(--modal-bg)
  if (!sheet) return;

  let startY = 0;
  let isDragging = false;
  const threshold = 120;

  const handleStart = (e) => {
    // Работает только когда шторка реально открыта
    if (!modal.classList.contains('show') && modal.style.display !== 'flex') return;

    const touch = e.touches[0];
    const sheetRect = sheet.getBoundingClientRect();

    // Разрешаем свайп только если тач в нижней половине шторки или ниже неё
    if (touch.clientY < sheetRect.bottom - 80) return;

    startY = touch.clientY;
    isDragging = true;
    sheet.style.transition = 'none';
    e.preventDefault();
  };

  const handleMove = (e) => {
    if (!isDragging) return;

    const currentY = e.touches[0].clientY;
    const delta = startY - currentY; // >0 — тянем вверх

    if (delta > 0) {
      sheet.style.transform = `translateY(-${delta}px)`;
      e.preventDefault();
    }
  };

  const handleEnd = () => {
    if (!isDragging) return;
    isDragging = false;

    const moved = parseFloat(sheet.style.transform?.match(/-?\d+\.?\d*/)?.[0] || '0');

    if (-moved > threshold) {
      // Закрываем с анимацией
      sheet.style.transition = 'transform 0.6s cubic-bezier(0.22,1,0.36,1)';
      sheet.style.transform = 'translateY(-100%)';
      sheet.addEventListener('transitionend', () => {
        modal.style.display = 'none';
        modal.classList.remove('show');
        sheet.style.transform = '';
        sheet.style.transition = '';
      }, { once: true });
    } else {
      // Возвращаем обратно
      sheet.style.transition = 'transform 0.5s cubic-bezier(0.22,1,0.36,1)';
      sheet.style.transform = 'translateY(0)';
      setTimeout(() => sheet.style.transition = '', 550);
    }
  };

  // ←←← ВЕШАЕМ СОБЫТИЯ ТОЛЬКО НА САМУ ШТОРКУ И НА БЭКДРОП ←←←
  modal.addEventListener('touchstart', handleStart, { passive: false });
  modal.addEventListener('touchmove',  handleMove,  { passive: false });
  modal.addEventListener('touchend',   handleEnd );

  // На всякий случай — если кто-то тянет за граббер или пустую область
  sheet.addEventListener('touchstart', handleStart, { passive: false });
})();
//СВАЙП ШТОРКИ ОФОРМИТЬ ЗАКАЗ
(() => {
  const modal = document.getElementById('archiveModal');
  if (!modal) return;

  const sheet = modal.querySelector('.smart-sheet');
  if (!sheet) return;

  let startY = 0;
  let isDragging = false;
  const THRESHOLD = 100;

  // Разрешаем начинать свайп только за граббер или верхние 100px шторки
  const canStartDrag = (y) => {
    if (window.innerWidth > 1026) return false;
    const grabber = modal.querySelector('.grabber');
    if (grabber) {
      const rect = grabber.getBoundingClientRect();
      if (y >= rect.top - 20 && y <= rect.bottom + 60) return true;
    }
    return y <= 120; // верхняя часть экрана
  };

  const handleStart = (e) => {
    if (window.innerWidth > 1026) return;
    if (modal.style.display !== 'flex' && !modal.classList.contains('show')) return;

    const touch = e.touches ? e.touches[0] : e;
    if (!canStartDrag(touch.clientY)) return;

    startY = touch.clientY;
    isDragging = true;
    sheet.style.transition = 'none';
  };

  const handleMove = (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const delta = touch.clientY - startY;

    if (delta > 0) {
      sheet.style.transform = `translateY(${delta}px)`;
      e.preventDefault();
    }
  };

  const handleEnd = () => {
    if (!isDragging) return;
    isDragging = false;

    const moved = parseFloat(sheet.style.transform.replace(/[^0-9.-]/g, '') || '0');

    if (moved > THRESHOLD) {
      sheet.style.transition = 'transform 0.45s cubic-bezier(0.34, 1, 0.64, 1)';
      sheet.style.transform = 'translateY(100vh)';
      sheet.addEventListener('transitionend', () => {
        modal.style.display = 'none';
        modal.classList.remove('show');
        sheet.style.transform = '';
        sheet.style.transition = '';
        document.body.style.overflow = '';
      }, { once: true });
    } else {
      sheet.style.transition = 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)';
      sheet.style.transform = 'translateY(0)';
    }
  };

  // Слушаем ТОЛЬКО внутри самой модалки — НИГДЕ больше!
  modal.addEventListener('touchstart', handleStart, { passive: false });
  modal.addEventListener('touchmove', handleMove, { passive: false });
  modal.addEventListener('touchend', handleEnd);
  modal.addEventListener('mousedown', handleStart);
  modal.addEventListener('mousemove', handleMove);
  modal.addEventListener('mouseup', handleEnd);

  // При открытии — гарантированно сбрасываем transform
  const resetOnOpen = () => {
    if (modal.style.display === 'flex' || modal.classList.contains('show')) {
      requestAnimationFrame(() => {
        sheet.style.transform = 'translateY(0)';
        sheet.style.transition = 'none';
        requestAnimationFrame(() => sheet.style.transition = '');
      });
    }
  };

  // Отслеживаем открытие (вдруг кто-то открывает через display = 'flex')
  new MutationObserver(resetOnOpen).observe(modal, { attributes: true });

  // Если кто-то открывает через твой старый код — тоже сбросим
  modal.addEventListener('click', (e) => {
    if (e.target === modal) resetOnOpen();
  });

})();

// ГЛОБАЛЬНЫЙ АНТИСПАМ — Сохраняется при обновлении страницы! (2025 версия)
const GlobalCartProtection = (() => {
  const STORAGE_KEY = 'cart_protection_blocked_until';
  const COOLDOWN_MS = 20000; // 20 секунд
  const MAX_CLICKS = 10;

  // Загружаем состояние из localStorage
  let blockedUntil = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
  let clickCount = 0;
  let resetTimer = null;

  // Функция блокировки — сохраняет время в localStorage
  const block = () => {
    blockedUntil = Date.now() + COOLDOWN_MS;
    localStorage.setItem(STORAGE_KEY, blockedUntil.toString());

    // Блокируем кнопки
    document.querySelectorAll('.apple-qty-btn, .apple-remove-btn, .quantity-btn, .clear-cart-btn').forEach(b => {
      b.disabled = true;
      b.style.opacity = '0.4';
      b.style.pointerEvents = 'none';
      b.style.cursor = 'not-allowed';
    });

    // Показываем алерт
    const alert = document.createElement('div');
    alert.id = 'global-cart-block-alert';
    alert.innerHTML = `<i class="fas fa-hand-paper"></i> <strong>Слишком быстро!</strong><br><small>Подождите <span>20</span> сек</small>`;
    Object.assign(alert.style, {
      position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: '999999',
      background: 'linear-gradient(135deg,#ff453a,#ff3b30)', color: 'white', padding: '16px 32px',
      borderRadius: '26px', fontSize: '1.1rem', boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
      backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: '600',
      transition: 'all 0.4s ease'
    });
    document.body.appendChild(alert);

    // Обновляем таймер каждую секунду
    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((blockedUntil - Date.now()) / 1000));
      const span = alert.querySelector('span');
      if (span) span.textContent = remaining;

      if (remaining <= 0) {
        localStorage.removeItem(STORAGE_KEY);
        alert.remove();
        unblockButtons();
      }
    };

    updateTimer();
    const interval = setInterval(() => {
      updateTimer();
      if (blockedUntil <= Date.now()) {
        clearInterval(interval);
      }
    }, 1000);

    // Автоочистка при истечении
    setTimeout(() => {
      if (document.getElementById('global-cart-block-alert')) {
        localStorage.removeItem(STORAGE_KEY);
        alert.remove();
        unblockButtons();
      }
    }, COOLDOWN_MS + 1000);
  };

  // Разблокировка кнопок (с проверкой минимального количества)
  const unblockButtons = () => {
    document.querySelectorAll('.apple-qty-btn, .apple-remove-btn, .quantity-btn, .clear-cart-btn').forEach(b => {
      const isMinus = b.classList.contains('minus') || b.textContent.trim() === '−' || b.textContent.trim() === '-';
      if (isMinus) {
        const qtySpan = b.closest('.quantity-controls')?.querySelector('span') || b.parentNode.querySelector('span');
        if (qtySpan && parseInt(qtySpan.textContent) <= 1) {
          return; // оставляем disabled для минуса при 1
        }
      }
      b.disabled = false;
      b.style.opacity = '';
      b.style.pointerEvents = '';
      b.style.cursor = '';
    });
  };

  // Проверяем, не заблокированы ли мы уже при загрузке страницы
  if (blockedUntil > Date.now()) {
    block(); // восстанавливаем блокировку + таймер
  }

  return {
    check() {
      // Если уже заблокированы — сразу отказ
      if (blockedUntil > Date.now()) {
        return false;
      }

      clickCount++;

      // Сбрасываем счётчик через 20 сек
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        clickCount = 0;
      }, COOLDOWN_MS);

      if (clickCount > MAX_CLICKS) {
        block();
        clickCount = 0;
        return false;
      }

      return true;
    },

    // Для дебага (можно удалить потом)
    debug: () => console.log({ blockedUntil, timeLeft: blockedUntil - Date.now(), clickCount })
  };
})();

 // Автоматом показываем красивую пустоту, если архив пуст
  document.addEventListener('DOMContentLoaded', () => {
    const ordersList = document.getElementById('ordersList');
    const emptyState = document.querySelector('.archive-empty');

    const checkEmpty = () => {
      if (ordersList && ordersList.children.length === 1 && 
          ordersList.querySelector('.empty-cart') && 
          ordersList.querySelector('.empty-cart').textContent.includes('пуст')) {
        ordersList.style.display = 'none';
        emptyState.style.display = 'block';
      }
    };

    // Проверяем сразу и после обновления
    setTimeout(checkEmpty, 100);
    const observer = new MutationObserver(checkEmpty);
    if (ordersList) observer.observe(ordersList, { childList: true, subtree: true });
  });

// ГОРЯЧИЙ ФИКС 2025: делаем так, чтобы старый statuschain.js работал с новой разметкой
document.addEventListener('DOMContentLoaded', () => {
    // Создаём виртуальный #orderChain, который старый скрипт ищет
    if (!document.getElementById('orderChain')) {
        const fakeChain = document.createElement('div');
        fakeChain.id = 'orderChain';
        fakeChain.style.display = 'none';
        document.body.appendChild(fakeChain);

        // Перехватываем window.startOrderChain и перенаправляем в новый контейнер
        const oldStart = window.startOrderChain;
        window.startOrderChain = function(orderId) {
            // Показываем твой красивый контейнер
            const container = document.getElementById('orderChainContainer');
            if (container) {
                container.style.display = 'block';
                document.getElementById('chainOrderId').textContent = orderId;
            }

            // А теперь пускаем старый код — он нарисует в #orderChain (который мы создали выше)
            if (typeof oldStart === 'function') {
                oldStart(orderId);
            }
        };
    }
});

// === ФИНАЛЬНАЯ ВЕРТИКАЛЬНАЯ ВЕРСИЯ 2025 — КРАСИВО, ЧИТАЕМО, БЕЗ ГОРИЗОНТАЛЬНОГО СКРОЛЛА ===
let activeOrders = [];

// Блокировка глобального рендера цепочки
function blockGlobalChain() {
  const orig = Document.prototype.getElementById;
  Document.prototype.getElementById = function(id) {
    if (id === 'orderChain') {
      const fake = document.createElement('div');
      fake.id = 'fake-chain';
      fake.style.display = 'none';
      return fake;
    }
    return orig.call(this, id);
  };
}
blockGlobalChain();

// Обновление плашки снизу
async function updateFloatingPill() {
  const bar = document.getElementById('floatingOrderBar');
  const badge = document.getElementById('activeOrdersBadge');
  const main = document.getElementById('pillMainText');
  const sub = document.getElementById('pillSubText');

  if (!bar) return;

  let orders = [];

  // Сначала пробуем взять из глобальной переменной (если уже загружено)
  if (typeof activeOrders !== 'undefined' && Array.isArray(activeOrders) && activeOrders.length > 0) {
    orders = activeOrders;
  } else {
    // Если нет — делаем запрос к API (один раз!)
    try {
      const res = await fetch('/api/active_orders', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        orders = data.list || [];  // ← важно: у тебя в API должен быть массив в .list
        window.activeOrders = orders; // сохраняем глобально, чтобы не запрашивать снова
      }
    } catch (err) {
      console.log('Не удалось загрузить заказы для плашки');
    }
  }

  // Если заказов нет — скрываем
  if (orders.length === 0) {
    bar.style.opacity = '0';
    bar.style.visibility = 'hidden';
    bar.style.transform = 'translateX(-50%) translateY(20px)';
    document.body.classList.remove('has-active-orders');
    return;
  }

  // Есть заказы — показываем
  const count = orders.length;
  badge.textContent = count;
  badge.style.display = count > 1 ? 'flex' : 'none';

  main.textContent = count === 1
    ? `Заказ ${orders[0].display_id || orders[0].id} в работе`
    : `${count} заказа в работе`;

  sub.textContent = count === 1
    ? "Нажмите для подробностей"
    : "Нажмите, чтобы посмотреть все";

  // Показываем плавно
  bar.style.display = 'flex';
  bar.style.opacity = '1';
  bar.style.visibility = 'visible';
  bar.style.transform = 'translateX(-50%) translateY(0)';

  document.body.classList.add('has-active-orders');
}

// Анимация — вставь один раз в <head> или прямо над шторкой
const style = document.createElement('style');
style.textContent = `
  @keyframes pillSlideUp {
    from { opacity:0; transform:translateX(-50%) translateY(50px) scale(0.94); }
    to   { opacity:1; transform:translateX(-50%) translateY(0) scale(1); }
  }
`;
document.head.appendChild(style);

function renderVerticalOrders() {
  const container = document.getElementById('ordersVerticalList');
  if (!container) return;
  container.innerHTML = '';

  if (activeOrders.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:80px 20px;color:var(--text-secondary);opacity:0.7;">
      <svg style="width:64px;height:64px;margin-bottom:16px;opacity:0.3;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M9 12h6m-6-4h6m-6 8h6m-2 4H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4l-2 2-2-2Z"/>
      </svg>
      <div style="font-weight:600;font-size:17px;">Активных заказов нет</div>
    </div>`;
    return;
  }

  activeOrders.forEach(order => {
    const card = document.createElement('div');
    card.style.cssText = `
      background:rgba(255,255,255,0.09);
      border-radius:20px;
      margin-bottom:12px;
      overflow:hidden;
      border-left:5px solid #00ff95;
      transition:all 0.4s cubic-bezier(0.22,1,0.36,1);
      cursor:pointer;
      box-shadow:0 4px 16px rgba(0,0,0,0.18);
    `;

    // ←←← ВОТ ЭТО ГЛАВНОЕ: НОМЕР ЗАКАЗА В ДВЕ СТРОКИ + ЦЕПОЧКА СТАТУСОВ ВНУТРИ
    card.innerHTML = `
      <div class="order-header" style="
        padding:clamp(14px, 4vw, 18px) clamp(16px, 4.5vw, 20px);
        display:flex;
        align-items:center;
        gap:clamp(12px, 3.5vw, 16px);
      ">
        <div style="
          width:clamp(48px, 13vw, 56px);
          height:clamp(48px, 13vw, 56px);
          background:var(--order-icon-bg, rgba(0,255,149,0.12));
          border-radius:16px;
          display:flex;align-items:center;justify-content:center;
          flex-shrink:0;
        ">
          <i class="fas fa-truck" style="font-size:clamp(20px, 6vw, 26px);color:#00ff95;"></i>
        </div>

        <div style="flex:1;min-width:0;">
          <!-- "Заказ" — сверху -->
          <div style="
            font-size:clamp(12px, 3.4vw, 13.5px);
            color:var(--text-secondary);
            text-transform:uppercase;
            letter-spacing:0.5px;
            font-weight:600;
            opacity:0.9;
            margin-bottom:2px;
          ">Заказ</div>

          <!-- Номер заказа — снизу, крупно, без переносов -->
          <div style="
            font-weight:900;
            font-size:clamp(17px, 5.2vw, 21px);
            color:var(--text-primary);
            line-height:1.1;
            white-space:nowrap;
            overflow:hidden;
            text-overflow:ellipsis;
            letter-spacing:-0.5px;
          ">
            ${order.display_id || order.id}
          </div>

          <!-- Цена + дата — в одну строку -->
          <div style="
            margin-top:6px;
            font-size:clamp(13px, 3.7vw, 15px);
            color:var(--text-secondary);
            line-height:1.4;
          ">
            <span style="font-weight:700;color:#00ff95;font-size:clamp(14px, 4vw, 16.5px);">
              ${order.total_str || '—'}
            </span>
            <span style="opacity:0.7;margin:0 8px;">•</span>
            <span style="opacity:0.85;">
              ${new Date(order.created_at).toLocaleDateString('ru-RU', {day:'numeric', month:'short'}).replace('.', '')}
            </span>
          </div>
        </div>

        <i class="fas fa-chevron-down expand-icon" style="
          color:var(--text-secondary);
          font-size:clamp(19px, 5.5vw, 23px);
          transition:transform 0.38s cubic-bezier(0.22,1,0.36,1);
          flex-shrink:0;
        "></i>
      </div>

      <!-- ВНУТРЕННЯЯ МОДАЛКА — ЦЕПОЧКА СТАТУСОВ С КРАСИВОЙ МОБИЛЬНОЙ АДАПТАЦИЕЙ -->
      <div class="order-details" style="
        max-height:0;overflow:hidden;
        transition:max-height 0.6s cubic-bezier(0.22,1,0.36,1);
        background:rgba(255,255,255,0.04);
        border-top:1px solid rgba(255,255,255,0.08);
      ">
        <div style="
          padding:clamp(20px, 5.5vw, 32px) clamp(16px, 4.5vw, 20px);
        ">
          <div id="chain-${order.id}" class="mobile-chain-content" style="
            font-size:clamp(13.8px, 3.9vw, 15.8px);
            line-height:1.6;
            color:var(--text-primary);
            word-break:break-word;
            hyphens:none;
            overflow-wrap:anywhere;
          "></div>
        </div>
      </div>
    `;

    // Клик — открытие цепочки
    card.querySelector('.order-header').addEventListener('click', (e) => {
      e.stopPropagation();
      const details = card.querySelector('.order-details');
      const icon = card.querySelector('.expand-icon');
      const target = document.getElementById(`chain-${order.id}`);

      const isOpen = details.dataset.open === 'true';

      if (isOpen) {
        details.style.maxHeight = '0px';
        details.dataset.open = 'false';
        icon.style.transform = 'rotate(0deg)';
      } else {
        details.dataset.open = 'true';
        icon.style.transform = 'rotate(180deg)';

        // Подмена для statuschain.js
        const real = Document.prototype.getElementById;
        Document.prototype.getElementById = (id) => id === 'orderChain' ? target : real.call(this, id);

        if (!target.dataset.loaded) {
          window.startOrderChain?.(order.id);
          target.dataset.loaded = 'true';
        }

        Document.prototype.getElementById = real;

        details.style.maxHeight = '6000px';
        setTimeout(() => {
          if (details.dataset.open === 'true') {
            details.style.maxHeight = (details.scrollHeight + 80) + 'px';
          }
        }, 100);
      }
    });

    container.appendChild(card);
  });
}

// === РАБОЧАЯ ВЕРСИЯ 2025 — КНОПКА "ЗАКРЫТЬ" РАБОТАЕТ НА МОБИЛКЕ НА 100% ===

const multiModal = document.getElementById('multiOrderModal');
const modalInner = multiModal.querySelector('div[style*="background:var(--modal-bg)"]');

function openMultiOrderModal() {
  multiModal.style.display = 'flex';

  // Добавляем граббер один раз (iOS-style)
  if (window.innerWidth <= 1026 && !multiModal.querySelector('.ios-grabber')) {
    const grabber = document.createElement('div');
    grabber.className = 'ios-grabber';
    grabber.style.cssText = 'width:40px;height:5px;background:rgba(255,255,255,0.3);border-radius:3px;margin:12px auto 8px;';
    modalInner.insertBefore(grabber, modalInner.firstChild);
  }

  // На мобильных — просто добавляем класс .show (анимация в CSS)
  if (window.innerWidth <= 1026) {
    requestAnimationFrame(() => {
      multiModal.classList.add('show');
    });
  }

  setTimeout(renderVerticalOrders, 100);
}

function closeMultiOrderModal() {
    const modal = document.getElementById('multiOrderModal');
    const sheet = modal?.querySelector('div[style*="background:var(--modal-bg)"]') || modal?.firstElementChild;

    if (!modal) return;

    if (window.innerWidth <= 1026) {
        modal.classList.remove('show');

        // Принудительно скрываем через 600мс — даже если transitionend не сработает
        const forceHide = () => {
            modal.style.display = 'none';
            modal.classList.remove('show');
            document.body.style.overflow = '';
        };

        // Пытаемся поймать transitionend
        if (sheet) {
            sheet.addEventListener('transitionend', forceHide, { once: true });
        }

        // Но если не сработает — всё равно скроем через 600мс
        setTimeout(forceHide, 600);
    } else {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

// ——— КНОПКА "ЗАКРЫТЬ" ———
// ГАРАНТИРОВАННОЕ ЗАКРЫТИЕ КНОПКОЙ "ЗАКРЫТЬ"
document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (btn && btn.textContent.trim() === 'Закрыть' && btn.closest('#multiOrderModal')) {
        e.preventDefault();
        e.stopPropagation();
        closeMultiOrderModal();
    }
});

// ——— ЗАКРЫТИЕ ПО БЭКДРОПУ ———
multiModal.addEventListener('click', (e) => {
  if (e.target === multiModal) {
    closeMultiOrderModal();
  }
});

// ——— КЛИК ПО ПЛАШКЕ СНИЗУ ———
document.getElementById('multiOrderPill')?.addEventListener('click', openMultiOrderModal);

// Клик по плашке — теперь умный
document.getElementById('multiOrderPill')?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  openMultiOrderModal();
});

// Закрытие по бэкдропом (оставляем как было)
document.getElementById('multiOrderModal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('multiOrderModal')) {
    closeMultiOrderModal();
  }
});


// Закрытие по клику вне
document.getElementById('multiOrderModal').addEventListener('click', e => {
  if (e.target === document.getElementById('multiOrderModal')) closeMultiOrderModal();
});

// === ПЕРЕОПРЕДЕЛЯЕМ window.startOrderChain — РАБОТАЕТ МОМЕНТАЛЬНО И С ЦЕНОЙ ===
window.startOrderChain = async function(orderId) {
  try {
    // 1. Делаем запрос и ЖДЁМ ПОЛНЫЕ данные заказа
    const res = await fetch(`/api/order/${orderId}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch order');

    const freshOrder = await res.json();

    // 2. Формируем объект точно так же, как везде
    const order = {
      ...freshOrder,
      display_id: freshOrder.display_id || freshOrder.user_order_number || `№${orderId}`,
      total_str: freshOrder.total_str || (freshOrder.total ? `${freshOrder.total.toLocaleString()} ₽` : '—'),
      created_at: freshOrder.created_at || new Date().toISOString(),
    };

    // 3. Обновляем глобальный массив (удаляем старый, если был)
    activeOrders = activeOrders.filter(o => o.id !== order.id);
    activeOrders.unshift(order); // новый — в начало
    if (activeOrders.length > 10) activeOrders.pop(); // ограничение

    // 4. ОБНОВЛЯЕМ ВСЁ СРАЗУ — с правильной ценой!
    updateFloatingPill();
    renderVerticalOrders();        // ← теперь с реальной ценой
    openMultiOrderModal();         // ← открываем уже с заполненными данными

  } catch (err) {
    console.warn('Не удалось загрузить детали заказа для модалки', err);

    // Даже если упало — всё равно показываем хотя бы номер
    const fallbackOrder = {
      id: orderId,
      display_id: `№${orderId}`,
      total_str: '—',
      created_at: new Date().toISOString(),
    };

    activeOrders = activeOrders.filter(o => o.id !== orderId);
    activeOrders.unshift(fallbackOrder);

    updateFloatingPill();
    renderVerticalOrders();
    openMultiOrderModal();
  }
};

// Автозагрузка при входе
document.addEventListener('DOMContentLoaded', () => {
  const userId = sessionStorage.getItem('user_id');
  if (!userId) {
    // Не авторизован → точно нет заказов → убираем отступ сразу
    document.body.classList.remove('has-active-orders');
    return;
  }

  fetch('/api/user_orders?t=' + Date.now(), { cache: 'no-store' })
    .then(r => r.ok ? r.json() : [])
    .then(orders => {
      activeOrders = orders
        .filter(o => !['completed', 'cancelled'].includes(o.status))
        .map(o => ({ ...o, display_id: o.display_id || '№' + o.user_order_number }))
        .slice(0, 3);

      // ←←← ВОТ ЭТА СТРОКА САМА ВСЁ СДЕЛАЕТ (и класс добавит, и плашку покажет) ←←←
      updateFloatingPill();

      // На всякий случай дублируем (если вдруг в updateFloatingPill что-то сломается)
      if (activeOrders.length > 0) {
        document.body.classList.add('has-active-orders');
      } else {
        document.body.classList.remove('has-active-orders');
      }
    })
    .catch(err => {
      console.warn('Не удалось загрузить активные заказы при старте', err);
      document.body.classList.remove('has-active-orders'); // на случай ошибки
    });
});

// === ЛОВИМ СОБЫТИЯ ИЗ statuschain.js И МГНОВЕННО ОБНОВЛЯЕМ МОДАЛКУ ===
document.addEventListener('orderStatusChanged', (e) => {
  const { orderId, status, isFinal } = e.detail;

  if (isFinal && ['completed', 'cancelled'].includes(status)) {
    activeOrders = activeOrders.filter(o => o.id !== orderId);
    updateFloatingPill();

    // Если модалка открыта — обновляем
    if (document.getElementById('multiOrderModal').style.display === 'flex') {
      renderVerticalOrders();
    }
  }
});
// Также обновляем при любом изменении статуса (даже промежуточном)
document.addEventListener('orderStatusChanged', () => {
    if (document.getElementById('multiOrderModal').style.display === 'flex') {
        setTimeout(() => refreshActiveOrders(true), 600);
    }
});

// ОКОНЧАТЕЛЬНЫЙ НЕПРОБИВАЕМЫЙ КУЛДАУН НА ОТМЕНУ ЗАКАЗОВ — РАБОТАЕТ НА 1000% (2025)
// 4 отмены за 10 минут → 5 минут полной блокировки
const COOLDOWN_KEY = 'piligrim_cancel_flood_2025';

function getData() {
    try {
        const d = localStorage.getItem(COOLDOWN_KEY);
        return d ? JSON.parse(d) : { cancels: [], blockedUntil: 0 };
    } catch { return { cancels: [], blockedUntil: 0 }; }
}

function saveData(data) {
    localStorage.setItem(COOLDOWN_KEY, JSON.stringify(data));
}

function isBlocked() {
    const data = getData();
    if (data.blockedUntil > Date.now()) {
        return Math.ceil((data.blockedUntil - Date.now()) / 1000);
    }
    // Очистка старых отмен
    const now = Date.now();
    data.cancels = data.cancels.filter(ts => now - ts < 10 * 60 * 1000);
    if (data.cancels.length >= 4) {
        data.blockedUntil = now + 5 * 60 * 1000;
        data.cancels = []; // обнуляем, чтобы не накапливалось
    }
    saveData(data);
    return data.blockedUntil > now ? Math.ceil((data.blockedUntil - now) / 1000) : 0;
}

function registerCancel() {
    const data = getData();
    data.cancels.push(Date.now());
    saveData(data);
    // Сразу проверяем — может уже блок
    const blocked = isBlocked();
    if (blocked > 0) showAlert(blocked);
}

// Красивый алерт с таймером
function showAlert(seconds) {
    document.querySelectorAll('#cancelFloodAlert').forEach(el => el.remove());
    const alert = document.createElement('div');
    alert.id = 'cancelFloodAlert';
    alert.innerHTML = `
        <i class="fas fa-ban"></i>
        <div>
            <strong>Слишком много отмен</strong><br>
            <small>Подождите <strong id="timer">${Math.floor(seconds/60)}:${(seconds%60).toString().padStart(2,'0')}</strong></small>
        </div>
    `;
    Object.assign(alert.style, {
        position:'fixed', top:'24px', left:'50%', transform:'translateX(-50%)', zIndex:'999999',
        background:'linear-gradient(135deg,#ff3b5c,#ff4444)', color:'white',
        padding:'16px 32px', borderRadius:'24px', fontSize:'1.15rem', fontWeight:'600',
        boxShadow:'0 20px 60px rgba(255,68,68,0.6)', display:'flex', alignItems:'center', gap:'16px',
        backdropFilter:'blur(20px)', animation:'slideDown 0.5s ease'
    });
    document.body.appendChild(alert);

    const timer = alert.querySelector('#timer');
    const int = setInterval(() => {
        seconds--;
        if (seconds <= 0) { clearInterval(int); alert.remove(); return; }
        timer.textContent = `${Math.floor(seconds/60)}:${(seconds%60).toString().padStart(2,'0')}`;
    }, 1000);
}

// САМОЕ ГЛАВНОЕ: ЖЁСТКО ПЕРЕХВАТЫВАЕМ КЛИК ПО КНОПКЕ "ОТМЕНИТЬ ЗАКАЗ"
document.addEventListener('click', function(e) {
    const btn = e.target.closest('#confirmCancelFinalBtn') || 
                 e.target.closest('button') && e.target.closest('button').textContent.includes('Отменить заказ');

    if (btn) {
        const blockedSeconds = isBlocked();
        if (blockedSeconds > 0) {
            e.preventDefault();
            e.stopImmediatePropagation();
            e.stopPropagation();
            showAlert(blockedSeconds);
            return false;
        }
    }
}, true); // true = capture phase — перехватывает ДО всех остальных обработчиков

// Перехват fetch — считаем только УСПЕШНУЮ отмену
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    const url = args[0];
    const options = args[1] || {};

    if (url.includes('/api/cancel_order') && options.method === 'POST') {
        const blockedSeconds = isBlocked();
        if (blockedSeconds > 0) {
            showAlert(blockedSeconds);
            // ВОЗВРАЩАЕМ ФЕЙКОВЫЙ ОТВЕТ — запрос даже не уйдёт!
            return new Response(JSON.stringify({ success: false, error: 'Слишком много отмен' }), {
                status: 429,
                statusText: 'Too Many Requests'
            });
        }
    }

    const response = await originalFetch(...args);

    if (url.includes('/api/cancel_order') && response.ok) {
        const cloned = response.clone();
        cloned.json().then(data => {
            if (data.success) {
                registerCancel();
            }
        }).catch(() => {});
    }

    return response;
};

// Блокируем кнопку визуально при загрузке
function updateButtonState() {
    const seconds = isBlocked();
    const btn = document.getElementById('confirmCancelFinalBtn');
    if (!btn) return;

    if (seconds > 0) {
        btn.disabled = true;
        btn.style.opacity = '0.4';
        btn.style.pointerEvents = 'none';
        btn.textContent = `Подождите ${seconds}с`;
    } else {
        btn.disabled = false;
        btn.style.opacity = '';
        btn.style.pointerEvents = '';
        btn.textContent = 'Отменить заказ';
    }
}

// Запускаем при загрузке и каждые 2 сек
document.addEventListener('DOMContentLoaded', () => {
    updateButtonState();
    setInterval(updateButtonState, 2000);
});

// Анимация
document.head.insertAdjacentHTML('beforeend', `
<style>
@keyframes slideDown{from{transform:translateX(-50%) translateY(-100px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}
#cancelFloodAlert i {font-size:1.8rem;}
</style>
`);


// ГЛОБАЛЬНЫЕ ФУНКЦИИ ОТКРЫТИЯ/ЗАКРЫТИЯ КАРТОЧКИ ТОВАРА (работают везде) -->

// УНИВЕРСАЛЬНЫЕ ФУНКЦИИ — РАБСОЛЮТНО ВСЕ СТРАНИЦЫ РАБОТАЮТ С НИМИ
window.openProductModal = function(id) {
  // Если у тебя другой путь — просто замени строку ниже
  fetch(`/api/product?id=${id}`)
    .then(r => {
      if (!r.ok) throw new Error('404');
      return r.json();
    })
    .then(data => {
      document.getElementById('productTitle').textContent = data.name || data.title || 'Без названия';
      document.getElementById('productImg').src = data.image || data.image_url || '/static/assets/no-image.png';
      document.getElementById('productPrice').textContent = 
        data.price ? (data.price).toLocaleString() + ' ₽' : 'Цена по запросу';
      document.getElementById('productDescription').innerHTML = data.description || 'Описания нет';

      const modal = document.getElementById('productModal');
      modal.style.display = 'flex';
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    })
    .catch(err => {
      alert('Товар не найден или ошибка сервера');
      console.error(err);
    });
};

window.closeProductModal = function() {
  const modal = document.getElementById('productModal');
  modal.style.display = 'none';
  modal.classList.remove('active');
  document.body.style.overflow = '';
};

// === СИНХРОНИЗАЦИЯ ТЕМЫ: Лампочка ↔ Шторка (2025 — работает на 100%) ===
document.addEventListener('DOMContentLoaded', () => {
  const root = document.documentElement;
  const mainToggle = document.getElementById('theme-toggle');
  const sidebarToggle = document.getElementById('theme-toggle-sidebar');

  if (!mainToggle || !sidebarToggle) return;

  // Функция переключения темы
  const applyTheme = (isDark) => {
    root.setAttribute('data-theme', isDark ? 'dark' : 'light');
    mainToggle.checked = isDark;
    sidebarToggle.checked = isDark;
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  };

  // Загружаем сохранённую тему
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialDark = saved ? saved === 'dark' : prefersDark;
  applyTheme(initialDark);

  // Обработчики
  mainToggle.addEventListener('change', () => applyTheme(mainToggle.checked));
  sidebarToggle.addEventListener('change', () => applyTheme(sidebarToggle.checked));
});

document.addEventListener('cartUpdated', (e) => {
  const items = e?.detail?.items || [];
  document.body.classList.toggle('has-cart-items', items.length > 0);
});

document.addEventListener('DOMContentLoaded', () => {
  const check = () => {
    const hasItems = document.querySelectorAll('#cartItemsList .apple-cart-item').length > 0;
    document.body.classList.toggle('has-cart-items', hasItems);
  };
  check();
  setTimeout(check, 800);
});

(() => {
  const modal = document.getElementById('checkoutModal');
  if (!modal) return;

  const sheet = modal.querySelector('.checkout-modal-beauty');
  if (!sheet) return;

  let startY = 0;
  let isDragging = false;
  const THRESHOLD = 120; // пикселей для закрытия

  // Разрешаем начинать свайп только за граббер или верхние ~120px
  const canStartDrag = (y) => {
    if (window.innerWidth > 1025) return false;
    const rect = sheet.getBoundingClientRect();
    return y <= rect.top + 120; // верхняя часть шторки
  };

  const openCheckout = () => {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => {
      modal.classList.add('show');
      // Сбрасываем transform на всякий случай
      sheet.style.transition = 'none';
      sheet.style.transform = 'translateY(0)';
      requestAnimationFrame(() => sheet.style.transition = '');
    });
  };

  const closeCheckout = () => {
    sheet.style.transition = 'transform 0.55s cubic-bezier(0.34, 1, 0.64, 1)';
    sheet.style.transform = 'translateY(100dvh)';
    sheet.addEventListener('transitionend', () => {
      modal.style.display = 'none';
      modal.classList.remove('show');
      sheet.style.transform = '';
      sheet.style.transition = '';
      document.body.style.overflow = '';
    }, { once: true });
  };

  // === СВАЙП ВНИЗ ===
  const handleStart = (e) => {
    if (window.innerWidth > 1025) return;
    if (!modal.classList.contains('show')) return;

    const touch = e.touches ? e.touches[0] : e;
    if (!canStartDrag(touch.clientY)) return;

    startY = touch.clientY;
    isDragging = true;
    sheet.style.transition = 'none';
  };

  const handleMove = (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const delta = touch.clientY - startY;
    if (delta > 0) {
      sheet.style.transform = `translateY(${delta}px)`;
      e.preventDefault();
    }
  };

  const handleEnd = () => {
    if (!isDragging) return;
    isDragging = false;

    const moved = parseFloat(sheet.style.transform.replace(/[^0-9.-]/g, '') || '0');
    sheet.style.transition = '';

    if (moved > THRESHOLD) {
      closeCheckout();
    } else {
      sheet.style.transition = 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)';
      sheet.style.transform = 'translateY(0)';
    }
  };

  // События
  modal.addEventListener('touchstart', handleStart, { passive: false });
  modal.addEventListener('touchmove', handleMove, { passive: false });
  modal.addEventListener('touchend', handleEnd);

  modal.addEventListener('mousedown', handleStart);
  modal.addEventListener('mousemove', handleMove);
  modal.addEventListener('mouseup', handleEnd);

  document.addEventListener('click', e => {
  const btn = e.target.closest('#checkoutBtn, #mobileCheckoutBtn, .go-to-cart-btn, #mobileGoToCartBtn');
  if (!btn) return;

  e.preventDefault();

  // === ПРОВЕРКА АВТОРИЗАЦИИ ===
  const isAuth = !!sessionStorage.getItem('user_id') || 
                 !!localStorage.getItem('user_id') || 
                 document.body.classList.contains('authenticated'); // если у тебя есть такой класс

  if (!isAuth) {
    // Открываем модалку авторизации вместо оформления
    document.getElementById('authModal').style.display = 'flex';
    document.getElementById('authModal').classList.add('show');
    document.body.style.overflow = 'hidden';
    return;
  }

  // Если авторизован — открываем оформление
  openCheckout();
});

  // Закрытие по крестику и бэкдропу
  document.getElementById('closeCheckout')?.addEventListener('click', closeCheckout);
  modal.addEventListener('click', e => {
    if (e.target === modal) closeCheckout();
  });

  // Принудительный сброс при открытии (на случай если кто-то делает display = flex вручную)
  new MutationObserver(() => {
    if (modal.style.display === 'flex') {
      requestAnimationFrame(() => sheet.style.transform = 'translateY(0)');
    }
  }).observe(modal, { attributes: true, attributeFilter: ['style'] });

})();

document.addEventListener('DOMContentLoaded', () => {
  const pill = document.getElementById('multiOrderPill');
  const bar = document.getElementById('floatingOrderBar');

  // Показываем плашку только если есть заказы
  if (typeof activeOrdersCount !== 'undefined' && activeOrdersCount > 0) {
    bar.style.opacity = '1';
    bar.style.visibility = 'visible';
    bar.style.transform = 'translateX(-50%) translateY(0)';
    document.getElementById('activeOrdersBadge').textContent = activeOrdersCount;
  }

  // Вешаем клик через JS — это безопасно на мобилках
  pill?.addEventListener('click', (e) => {
    e.stopPropagation();
    openMultiOrderModal();
  });
  
});

