

// /static/js/bin.js — ВСЁ, КРОМЕ КОРЗИНЫ (корзина теперь живёт в cart.js)
document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);

  const elements = {
    authBtn: $('authBtn'),
    feedbackBtn: $('feedbackBtn'),
    openArchiveBtn: $('openArchiveBtn'),
    checkoutBtn: $('checkoutBtn'),
    feedbackModal: $('feedbackModal'),
    checkoutModal: $('checkoutModal'),
    reviewModal: $('reviewModal'),
    archiveModal: $('archiveModal'),
    feedbackForm: $('feedbackForm'),
    confirmOrderBtn: $('confirmOrderBtn'),
    fullName: $('fullName'),
    checkoutPhone: $('checkoutPhone'),
    reviewItemName: $('reviewItemName'),
    reviewStars: $('reviewStars'),
    submitReview: $('submitReview'),
    skipReview: $('skipReview'),
    reviewText: $('reviewText'),
    closeFeedbackModal: $('closeFeedbackModal'),
    closeCheckout: $('closeCheckout'),
    closeReview: $('closeReview'),
    closeArchive: $('closeArchive'),
  };

  // Глобальные переменные для отзывов
  let reviewQueue = [];
  let currentReviewItem = null;
  let selectedStars = 0;

// Универсальные тосты — ИСПРАВЛЕНО: текст по центру, красиво на ПК и телефоне
const showToast = (title, message = '', error = false, duration = 3000) => {
  const toast = document.createElement('div');
  toast.className = `toast-alert ${error ? 'error' : 'success'}`;
  toast.innerHTML = `
    <div class="alert-content">
      <i class="fas ${error ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i>
      <div class="alert-text">
        <strong>${title}</strong>
        ${message ? `<span>${message}</span>` : ''}
      </div>
      <button class="alert-close">×</button>
    </div>
  `;
  document.body.appendChild(toast);

  // Стили для нормального центрирования
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '30px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: error ? '#ff4444' : '#00ff95',
    color: error ? 'white' : 'black',
    padding: '14px 24px',
    borderRadius: '20px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
    zIndex: '99999',
    fontFamily: 'Inter, sans-serif',
    maxWidth: '90%',
    opacity: '0',
    transition: 'all 0.4s ease',
    pointerEvents: 'none'
  });

  // Контент — flex с центрированием
  const content = toast.querySelector('.alert-content');
  Object.assign(content.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    pointerEvents: 'auto'
  });

  const textDiv = toast.querySelector('.alert-text');
  Object.assign(textDiv.style, {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center'
  });

  const closeBtn = toast.querySelector('.alert-close');
  Object.assign(closeBtn.style, {
    marginLeft: 'auto',
    background: 'none',
    border: 'none',
    fontSize: '1.6rem',
    cursor: 'pointer',
    opacity: '0.8',
    padding: '0 4px'
  });

  setTimeout(() => toast.style.opacity = '1', 10);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 500);
  }, duration);

  closeBtn.onclick = () => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 500);
  };
};

// Главный надёжный тост — ТЕКСТ ПО ЦЕНТРУ, КРАСИВО, БЕЗ СДВИГОВ
const reliableToast = (title, message = '', isError = false, duration = 4000) => {
  // Удаляем старые
  document.querySelectorAll('.reliable-toast').forEach(t => t.remove());

  const toast = document.createElement('div');
  toast.className = 'reliable-toast';
  toast.innerHTML = `
    <div class="toast-content">
      <i class="fas ${isError ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i>
      <div class="toast-text-wrapper">
        <strong class="toast-title">${title}</strong>
        ${message ? `<div class="toast-message">${message}</div>` : ''}
      </div>
    </div>
  `;

  // Идеальные стили — выравнивание по центру 100%
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '30px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: isError ? '#ff4444' : '#00ff95',
    color: isError ? 'white' : 'black',
    padding: '16px 28px',
    borderRadius: '24px',
    boxShadow: '0 14px 40px rgba(0,0,0,0.38)',
    zIndex: '99999',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    fontSize: '1.15rem',
    fontWeight: '600',
    maxWidth: '90%',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    animation: 'toastUp 0.5s cubic-bezier(0.22, 0.61, 0.36, 1)',
    fontFamily: 'Inter, sans-serif',
    opacity: '0'
  });

  // Текст строго по центру
  const wrapper = toast.querySelector('.toast-text-wrapper');
  Object.assign(wrapper.style, {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    lineHeight: '1.35'
  });

  const titleEl = toast.querySelector('.toast-title');
  titleEl.style.margin = '0';

  const msgEl = toast.querySelector('.toast-message');
  if (msgEl) {
    Object.assign(msgEl.style, {
      fontSize: '0.94rem',
      opacity: '0.94',
      marginTop: '4px',
      fontWeight: '500'
    });
  }

  document.body.appendChild(toast);

  // Появление
  requestAnimationFrame(() => toast.style.opacity = '1');

  // Исчезновение
  setTimeout(() => {
    toast.style.animation = 'toastDown 0.4s ease forwards';
    setTimeout(() => toast.remove(), 450);
  }, duration);
};

// Анимации тостов — один раз
if (!document.getElementById('reliableToastStyles')) {
  const style = document.createElement('style');
  style.id = 'reliableToastStyles';
  style.textContent = `
    @keyframes toastUp {
      from { transform: translateX(-50%) translateY(80px); opacity: 0; }
      to   { transform: translateX(-50%) translateY(0); opacity: 1; }
    }
    @keyframes toastDown {
      to { transform: translateX(-50%) translateY(80px); opacity: 0; }
    }
    .reliable-toast i {
      font-size: 1.6rem;
      flex-shrink: 0;
    }
    .toast-alert i {
      font-size: 1.5rem;
      flex-shrink: 0;
    }
  `;
  document.head.appendChild(style);
}

// Красивая модалка "Лимит достигнут" — без изменений (уже идеальна)
document.body.insertAdjacentHTML('beforeend', `
<div id="activeOrdersLimitModal" class="limit-modal-overlay">
  <div class="limit-modal-content">
    <div class="limit-modal-icon">
      <i class="fas fa-exclamation-triangle"></i>
    </div>
    <h2 class="limit-modal-title">Лимит активных заказов</h2>
    <p class="limit-modal-text">
      У вас уже есть <strong>активные заказы</strong>.<br>
      Дождитесь завершения хотя бы одного, чтобы оформить новый.
    </p>
    <button class="limit-modal-btn-primary" onclick="document.getElementById('activeOrdersLimitModal').style.display='none'">
      Понятно, жду
    </button>
    <div class="limit-modal-footer">
      <button class="limit-modal-link" onclick="openMultiOrderModal(); document.getElementById('activeOrdersLimitModal').style.display='none'">
        Посмотреть текущие заказы →
      </button>
    </div>
  </div>
</div>
`);

// Стили модалки — без изменений
const limitModalStyles = document.createElement('style');
limitModalStyles.textContent = `
  #activeOrdersLimitModal {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.88);
    backdrop-filter: blur(28px);
    -webkit-backdrop-filter: blur(28px);
    z-index: 99999;
    justify-content: center;
    align-items: center;
    padding: 16px;
    font-family: 'Inter', system-ui, sans-serif;
  }
  .limit-modal-content {
    background: rgba(20, 20, 35, 0.98);
    border-radius: 28px;
    max-width: 420px;
    width: 100%;
    text-align: center;
    padding: 2.5rem 2rem;
    box-shadow: 0 40px 100px rgba(0, 0, 0, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
    animation: modalPop 0.5s cubic-bezier(0.22, 0.61, 0.36, 1);
  }
  .limit-modal-icon {
    width: 90px;
    height: 90px;
    margin: 0 auto 1.5rem;
    background: #ff4444;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .limit-modal-icon i { font-size: 3rem; color: white; }
  .limit-modal-title { margin: 0 0 1rem; font-size: 1.9rem; font-weight: 800; color: #fff; }
  .limit-modal-text { margin: 0 0 2rem; color: #ccc; font-size: 1.1rem; line-height: 1.5; }
  .limit-modal-text strong { color: #fff; }
  .limit-modal-btn-primary {
    background: #00ff95; color: #000; border: none; padding: 1rem 2.5rem;
    border-radius: 22px; font-size: 1.1rem; font-weight: 700; cursor: pointer;
    width: 100%; transition: all 0.3s;
  }
  .limit-modal-btn-primary:hover {
    background: #00ffaa; transform: translateY(-2px);
    box-shadow: 0 10px 30px rgba(0, 255, 149, 0.4);
  }
  .limit-modal-link {
    background: transparent; color: #00ff95; border: none;
    font-size: 1rem; cursor: pointer; text-decoration: underline;
    margin-top: 1.5rem; padding: 0; transition: opacity 0.2s;
  }
  .limit-modal-link:hover { opacity: 0.8; }
  html[data-theme="light"] .limit-modal-content {
    background: rgba(255, 255, 255, 0.98);
    border: 1px solid rgba(0, 0, 0, 0.1);
    box-shadow: 0 40px 100px rgba(0, 0, 0, 0.15);
  }
  html[data-theme="light"] .limit-modal-title { color: #111; }
  html[data-theme="light"] .limit-modal-text { color: #555; }
  html[data-theme="light"] .limit-modal-text strong { color: #000; }
  html[data-theme="light"] .limit-modal-btn-primary { background: #00cc77; color: white; }
  html[data-theme="light"] .limit-modal-btn-primary:hover { background: #00bb66; }
  html[data-theme="light"] .limit-modal-link { color: #00aa66; }
  @keyframes modalPop {
    from { transform: scale(0.8); opacity: 0; }
    to   { transform: scale(1); opacity: 1; }
  }
`;
document.head.appendChild(limitModalStyles);

// Проверка лимита перед открытием оформления
async function checkActiveOrdersLimit() {
  try {
    const res = await fetch('/api/user_orders?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return true;
    const orders = await res.json();
    const active = orders.filter(o => !['completed', 'cancelled'].includes(o.status));
    return active.length < 3;
  } catch {
    return true; // на случай ошибки сети — не блокируем пользователя
  }
}


document.addEventListener('click', async function(e) {
  const btn = e.target.closest('#checkoutBtn, #mobileCheckoutBtn');
  if (!btn) return;
if (!window.hasOwnProperty('cartItems') && !localStorage.getItem('clientCart')) {
    e.preventDefault();
    e.stopImmediatePropagation();
    setTimeout(() => btn.click(), 100);
    return;
  }
  e.preventDefault();
  e.stopImmediatePropagation();

  // УМНАЯ ПРОВЕРКА — РАБОТАЕТ ВЕЗДЕ И ВСЕГДА (ИСПРАВЛЕНО 2025!)
  let itemsCount = 0;

  // 1. САМЫЙ НАДЁЖНЫЙ ИСТОЧНИК — глобальная переменная cartItems (всегда актуальна!)
  if (window.cartItems && Array.isArray(window.cartItems)) {
    itemsCount = window.cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
  }

  // 2. Если вдруг window.cartItems ещё не инициализирована — смотрим localStorage (гости)
  if (itemsCount === 0) {
    try {
      const saved = localStorage.getItem('clientCart');
      if (saved) {
        const cart = JSON.parse(saved);
        if (Array.isArray(cart)) {
          itemsCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
        }
      }
    } catch (e) {
      console.warn('Ошибка чтения clientCart из localStorage:', e);
    }
  }

  // 3. ТОЛЬКО В КРАЙНЕМ СЛУЧАЕ — DOM (может быть не готов на момент клика!)
  if (itemsCount === 0) {
    const countEl = document.querySelector('#summaryCount, [data-cart-count], .cart-summary-count');
    const text = countEl?.textContent?.trim();
    if (text && !isNaN(text)) {
      itemsCount = parseInt(text, 10) || 0;
    }
  }

  // ТЕПЕРЬ ПРОВЕРЯЕМ
  if (itemsCount === 0) {
  document.querySelectorAll('#emptyCartMainAlert').forEach(el => el.remove());

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const isMobile = window.innerWidth <= 1026;

  const emptyAlert = document.createElement('div');
  emptyAlert.id = 'emptyCartMainAlert';
  emptyAlert.innerHTML = `
    <div class="empty-cart-backdrop"></div>
    <div class="empty-cart-sheet">
      ${isMobile ? '<div class="empty-cart-grabber"></div>' : ''}
      <div class="empty-cart-content">
        <i class="fas fa-shopping-bag"></i>
        <h3>Корзина пуста</h3>
        <p>Добавьте товары или услуги, чтобы оформить заказ</p>
        <div class="empty-cart-buttons">
          <a href="/goods" class="empty-cart-btn primary">К товарам</a>
          <a href="/services" class="empty-cart-btn secondary">К услугам</a>
        </div>
        <button class="empty-cart-close">×</button>
      </div>
    </div>
  `;


document.body.appendChild(emptyAlert);

// ←←← ВСЁ НИЖЕ — ДОЛЖНО БЫТЬ ДО visibility! ←←←
// Базовые стили
Object.assign(emptyAlert.style, {
  position: 'fixed',
  inset: '0',
  zIndex: '999999',
  fontFamily: 'Inter, system-ui, sans-serif',
  pointerEvents: 'none',
  overflow: 'hidden',
});

const backdrop = emptyAlert.querySelector('.empty-cart-backdrop');
const sheet = emptyAlert.querySelector('.empty-cart-sheet');
const content = emptyAlert.querySelector('.empty-cart-content');

if (isMobile) {
  backdrop.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.45);backdrop-filter:blur(12px);opacity:0;transition:opacity 0.45s ease;';
  sheet.style.cssText = `
    position:absolute;bottom:0;left:0;right:0;
    background:${isDark ? '#000' : '#fff'};
    border-radius:28px 28px 0 0;
    box-shadow:0 -20px 60px rgba(0,0,0,0.5);
    transform:translateY(100%);
    transition:transform 0.6s cubic-bezier(0.22,1,0.36,1);
    pointer-events:auto;
  `;
    content.style.padding = '1.5rem 1.8rem 2.5rem';
  } else {
    backdrop.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(20px);opacity:0;transition:opacity 0.55s ease;';
    sheet.style.cssText = `
      position:absolute;top:50%;left:50%;
      transform:translate(-50%,-50%) scale(0.88);
      width:92%;max-width:520px;
      background:${isDark ? 'rgba(0,0,0,0.98)' : 'rgba(255,255,255,0.98)'};
      border-radius:36px;
      border:1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'};
      box-shadow:${isDark ? '0 50px 120px rgba(0,0,0,0.8)' : '0 50px 120px rgba(0,0,0,0.2)'};
      padding:2.8rem 1.8rem 2.4rem;
      opacity:0;
      transition:all 0.55s cubic-bezier(0.22,0.61,0.36,1);
      pointer-events:auto;
    `;
  }

  content.style.cssText += `text-align:center;position:relative;color:${isDark ? '#fff' : '#111'};`;
  emptyAlert.querySelector('i').style.cssText = 'font-size:5.5rem;color:#00ff95;opacity:0.88;margin-bottom:1.6rem;display:block;';
  emptyAlert.querySelector('h3').style.cssText = 'margin:0 0 1rem;font-size:2.1rem;font-weight:800;';
  emptyAlert.querySelector('p').style.cssText = `margin:0 0 2.4rem;font-size:1.22rem;line-height:1.6;max-width:420px;margin-left:auto;margin-right:auto;color:${isDark ? '#ccc' : '#555'};`;

  if (isMobile) {
    emptyAlert.querySelector('.empty-cart-grabber').style.cssText = 'width:40px;height:5px;background:rgba(255,255,255,0.3);border-radius:3px;margin:12px auto 4px;pointer-events:none;';
  }

  const styleEl = document.createElement('style');
  styleEl.textContent = `
    #emptyCartMainAlert .empty-cart-btn{display:inline-block;padding:1.1rem 2.4rem;border-radius:26px;font-weight:700;font-size:1.15rem;text-decoration:none;transition:all .3s;margin:0 .7rem;}
    #emptyCartMainAlert .empty-cart-btn.primary{background:#00ff95;color:#000;box-shadow:0 8px 25px rgba(0,255,149,0.3);}
    #emptyCartMainAlert .empty-cart-btn.primary:hover{transform:translateY(-3px);box-shadow:0 12px 35px rgba(0,255,149,0.4);}
    #emptyCartMainAlert .empty-cart-btn.secondary{background:${isDark?'rgba(255,255,255,0.1)':'rgba(0,0,0,0.06)'};color:${isDark?'#fff':'#111'};border:1px solid ${isDark?'rgba(255,255,255,0.18)':'rgba(0,0,0,0.12)'};}
    #emptyCartMainAlert .empty-cart-btn.secondary:hover{background:${isDark?'rgba(255,255,255,0.18)':'rgba(0,0,0,0.12)'};}
    #emptyCartMainAlert .empty-cart-close{position:absolute;top:18px;right:24px;background:none;border:none;font-size:2.4rem;cursor:pointer;opacity:0.6;color:${isDark?'#fff':'#111'};width:44px;height:44px;display:flex;align-items:center;justify-content:center;}
    #emptyCartMainAlert .empty-cart-close:hover{opacity:1;}
  `;
  document.head.appendChild(styleEl);


  requestAnimationFrame(() => {
    backdrop.style.opacity = '1';
    emptyAlert.style.pointerEvents = 'auto';
    if (isMobile) {
      sheet.style.transform = 'translateY(0)';
    } else {
      sheet.style.transform = 'translate(-50%,-50%) scale(1)';
      sheet.style.opacity = '1';
    }
  });

const close = () => {
  backdrop.style.opacity = '0';
  if (isMobile) {
    sheet.style.transform = 'translateY(100%)';
  } else {
    sheet.style.transform = 'translate(-50%,-50%) scale(0.88)';
    sheet.style.opacity = '0';
  }

  // ГАРАНТИРОВАННОЕ УДАЛЕНИЕ — РАБОТАЕТ НА ВСЕХ ТЕЛЕФОНАХ
  setTimeout(() => {
    emptyAlert.remove();
  }, 600);
};

  emptyAlert.querySelector('.empty-cart-close').onclick = close;
  backdrop.onclick = close;

  if (isMobile) {
    let startY = 0;
    const start = e => { startY = e.touches[0].clientY; sheet.style.transition = 'none'; };
    const move = e => {
      const delta = e.touches[0].clientY - startY;
      if (delta > 0) { sheet.style.transform = `translateY(${delta}px)`; e.preventDefault(); }
    };
    const end = () => {
      sheet.style.transition = '';
      if (parseFloat(sheet.style.transform.match(/[\d.]+/)?.[0] || 0) > 100) close();
      else sheet.style.transform = 'translateY(0)';
    };
    sheet.addEventListener('touchstart', start, { passive: false });
    sheet.addEventListener('touchmove', move, { passive: false });
    sheet.addEventListener('touchend', end);
  }

  return; // ← ВАЖНО: выходим, чтобы не открывать шторку оформления
}

  // 2. Лимит 3 активных заказа — железная блокировка
  // 2. Лимит активных заказов — АКТУАЛЬНАЯ проверка с сервера!
const canCreateOrder = await (async () => {
  try {
    const res = await fetch('/api/user_orders?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return true; // если ошибка — не блокируем
    const orders = await res.json();
    const active = orders.filter(o => !['completed', 'cancelled'].includes(o.status));
    if (active.length >= 3) {
      document.getElementById('activeOrdersLimitModal').style.display = 'flex';
      return false;
    }
    return true;
  } catch {
    return true; // нет сети — не блокируем
  }
})();

if (!canCreateOrder) return; // ← блокируем оформление

  // 3. Не авторизован → открываем вход
  if (!sessionStorage.getItem('user_id') && !localStorage.getItem('user_id')) {
    document.getElementById('authBtn')?.click();
    return;
  }

  // 4. ВСЁ ОК — ОТКРЫВАЕМ ШТОРКУ ОФОРМЛЕНИЯ
  const modal = document.getElementById('checkoutModal');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  // Анимация открытия (для мобильной шторки)
  requestAnimationFrame(() => {
    modal.classList.add('show');
    const sheet = modal.querySelector('.checkout-modal-beauty');
    if (sheet) {
      sheet.style.transition = 'none';
      sheet.style.transform = 'translateY(0)';
      requestAnimationFrame(() => sheet.style.transition = '');
    }
  });

  // === ВСЁ, ЧТО НУЖНО ПОДСТАВИТЬ (работает и на ПК, и на мобилке) ===
  setTimeout(() => {
    // Количество и сумма
    const count = document.getElementById('summaryCount')?.textContent || '0';
    const total = document.getElementById('summaryTotal')?.textContent || '0 ₽';
    const checkoutCountEl = document.getElementById('checkoutCount');
    const checkoutTotalEl = document.getElementById('checkoutTotal');
    if (checkoutCountEl) checkoutCountEl.textContent = count;
    if (checkoutTotalEl) checkoutTotalEl.textContent = total;

    // Телефон — с надёжным ожиданием появления блоков в DOM
    const applyPhone = () => {
      const premium = document.getElementById('checkoutPhonePremium');
      const textEl = document.getElementById('checkoutPhoneFormatted');
      const manual = document.getElementById('checkoutPhoneManual');

      if (premium && textEl) {
        const phone = sessionStorage.getItem('phone') || localStorage.getItem('phone');
        if (phone && phone !== '—' && phone.length >= 11) {
          const formatted = `+7 (${phone.slice(1,4)}) ${phone.slice(4,7)}-${phone.slice(7,9)}-${phone.slice(9,11)}`;
          textEl.textContent = formatted;
          premium.style.display = 'flex';
          if (manual) manual.style.display = 'none';
        }
        return true;
      }
      return false;
    };

    if (!applyPhone()) {
      // Если блоков ещё нет — ждём до 2 секунд (хватит за глаза)
      let attempts = 0;
      const interval = setInterval(() => {
        if (applyPhone() || attempts++ > 60) {
          clearInterval(interval);
        }
      }, 30);
    }

    // Фокус на ФИО
    document.getElementById('fullName')?.focus();

  }, 80); // 80 мс — идеально для всех анимаций открытия шторки

}, true); // true = capture phase — ловит клик первым

// === НОВЫЙ ФИНАЛЬНЫЙ ОБРАБОТЧИК ОФОРМЛЕНИЯ ЗАКАЗА (2025) — ИСПРАВЛЕНО ===
elements.confirmOrderBtn?.addEventListener('click', async () => {
  const fullName = elements.fullName.value.trim();
  if (!fullName) {
    reliableToast('Введите ФИО полностью', '', true, 3500);
    return;
  }

  const phone = sessionStorage.getItem('phone') || elements.checkoutPhone.value.trim();
  if (!phone || phone === '—') {
    reliableToast('Укажите номер телефона', '', true, 3500);
    return;
  }

  elements.confirmOrderBtn.disabled = true;
  document.querySelector('.btn-text').style.display = 'none';
  document.querySelector('.btn-loader').style.display = 'inline';

  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName, phone }),
    });
    const data = await res.json();

    if (data.success && data.order_id) {
      elements.checkoutModal.style.display = 'none';

      // Очистка корзины
      localStorage.removeItem('clientCart');
      allCartItems = [];
      document.dispatchEvent(new CustomEvent('cartUpdated', {
        detail: { items: [], count: 0, total: '0 ₽' }
      }));

      // Добавляем заказ в активные
      const newOrder = {
        id: data.order_id,
        display_id: data.display_id || '№' + data.order_id,
        status: 'pending',
        total_str: document.getElementById('summaryTotal').textContent,
        created_at: new Date().toISOString(),
        items: allCartItems.map(i => ({ title: i.title }))
      };

      activeOrders.unshift(newOrder);
      if (activeOrders.length > 3) activeOrders.pop();
      updateFloatingPill();
      openMultiOrderModal();



      setTimeout(() => window.startOrderChain(data.order_id), 800);

      if (data.items?.length) {
        reviewQueue = data.items.map(i => ({ id: i.id, type: i.type, title: i.title }));
        showNextReview();
      }
    } else {
      reliableToast('Ошибка оформления', data.error || 'Попробуйте позже', true, 4500);
    }
  } catch (e) {
    console.error(e);
    reliableToast('Нет связи с сервером', 'Проверьте интернет', true, 4500);
  } finally {
    elements.confirmOrderBtn.disabled = false;
    document.querySelector('.btn-text').style.display = 'inline';
    document.querySelector('.btn-loader').style.display = 'none';
  }
});

  // === ОТЗЫВЫ ===
  const showNextReview = async () => {
    if (reviewQueue.length === 0) {
      elements.reviewModal.style.display = 'none';
      return;
    }
    currentReviewItem = reviewQueue.shift();
    const title = currentReviewItem.title || 'Товар/Услуга';
    elements.reviewItemName.textContent = `Оцените: ${title}`;
    elements.reviewModal.style.display = 'flex';
    selectedStars = 0;
    elements.reviewStars.querySelectorAll('i').forEach(s => s.className = 'far fa-star');

    elements.reviewStars.querySelectorAll('i').forEach(star => {
      star.onclick = () => {
        selectedStars = parseInt(star.dataset.value);
        elements.reviewStars.querySelectorAll('i').forEach((s, i) => {
          s.classList.toggle('fas', i < selectedStars);
          s.classList.toggle('far', i >= selectedStars);
        });
      };
    });
  };

  elements.skipReview?.addEventListener('click', () => {
    elements.reviewText.value = '';
    elements.reviewModal.style.display = 'none';
    showNextReview();
  });

elements.submitReview?.addEventListener('click', async () => {
  if (selectedStars === 0) {
    // Адаптивный тост — маленький на мобильных, обычный на ПК
    if (window.innerWidth <= 1026) {
      reliableToast('Выберите оценку ⭐', '', true, 3000);
    } else {
      showToast('Выберите оценку', '', true);
    }
    return;
  }
    const phone = sessionStorage.getItem('phone') || 'Аноним';
    const title = currentReviewItem.title || 'Без названия';

    const payload = {
      item_id: currentReviewItem.id,
      item_type: currentReviewItem.type,
      title,
      rating: selectedStars,
      text: elements.reviewText.value.trim(),
      user_phone: phone,
    };

    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Спасибо за отзыв!', '', false, 2000);
        elements.reviewText.value = '';
        elements.reviewModal.style.display = 'none';
        showNextReview();
      } else {
        throw new Error(data.error || 'Ошибка');
      }
    } catch (e) {
      showToast('Ошибка отправки', e.message || 'Попробуйте позже', true);
    }
  });

// ОТКРЫТИЕ АРХИВА — ОДИН РАЗ + ЗАЩИТА ОТ ДУБЛИРОВАНИЯ
document.querySelectorAll('#openArchiveBtn').forEach(btn => btn.addEventListener('click', async () => {
    // Проверяем сессию быстро и без лишних запросов
    const userId = sessionStorage.getItem('user_id');
    if (!userId) {
        // НЕ АВТОРИЗОВАН → открываем модалку входа
        document.getElementById('authBtn')?.click();
        return;
    }

    // АВТОРИЗОВАН → открываем архив как обычно
    const modal = document.getElementById('archiveModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // важно!

        if (allOrders.length === 0) {
            loadOrders(true);
        } else {
            renderOrders();
            updateArchiveTabsCounts();
        }
        
    }
    
}));

// Глобальные переменные (должны быть объявлены снаружи!)
let allOrders = [];
let currentTab = 'active';
let currentPage = 1;
const PER_PAGE = 10;

// ЗАГРУЗКА ЗАКАЗОВ — БЕЗ ДУБЛИРОВАНИЯ
async function loadOrders(forceReload = false) {
    const list = document.getElementById('ordersList');
    const loadMoreContainer = document.getElementById('loadMoreContainer');

    // ←←← ГЛАВНОЕ ИСПРАВЛЕНИЕ №1 — ОЧИЩАЕМ ТОЛЬКО ПРИ forceReload И ПРИ ПЕРЕКЛЮЧЕНИИ ТАБА
    if (forceReload || currentPage === 1) {
        allOrders = [];
        currentPage = 1;
        if (list) list.innerHTML = '<div style="text-align:center;padding:3rem;color:#aaa;">Загружаем заказы...</div>';
    }

    try {
        const endpoint = (currentTab === 'all' || currentTab === 'completed')
            ? '/api/user_archived_orders'
            : '/api/user_orders';

        const res = await fetch(`${endpoint}?page=${currentPage}&per=${PER_PAGE}&t=${Date.now()}`, {
            cache: 'no-store'
        });

        if (!res.ok) throw new Error('Server error');

        const newOrders = await res.json();

        // ←←← ГЛАВНОЕ ИСПРАВЛЕНИЕ №2 — УБИРАЕМ ДУБЛИ ПО ID!
        const existingIds = new Set(allOrders.map(o => o.id));
        const uniqueNewOrders = newOrders.filter(order => !existingIds.has(order.id));

        // Добавляем только новые
        allOrders = [...allOrders, ...uniqueNewOrders];

        renderOrders();

        // Показываем/скрываем кнопку "Загрузить ещё"
        if (loadMoreContainer) {
            if (uniqueNewOrders.length < PER_PAGE) {
                loadMoreContainer.style.display = 'none'; // больше нет заказов
            } else {
                loadMoreContainer.style.display = 'block';
            }
        }

        // ←←← ОБНОВЛЯЕМ КРУЖКИ (из activeOrders, как мы починили раньше)
        setTimeout(() => {
            const activeCount = activeOrders.filter(o => o && !['completed', 'cancelled'].includes(o.status)).length;
            const completedCount = allOrders.filter(o => ['completed', 'cancelled'].includes(o.status)).length;
            const totalCount = allOrders.length;

            document.querySelector('[data-tab="active"] span')?.then(b => b.textContent = activeCount || '');
            document.querySelector('[data-tab="completed"] span')?.then(b => b.textContent = completedCount || '');
            document.querySelector('[data-tab="all"] span')?.then(b => b.textContent = totalCount || '');
        }, 250);

    } catch (err) {
        console.error(err);
        if (currentPage === 1) {
            list.innerHTML = '<div style="text-align:center;padding:3rem;color:#ff6b6b;">Ошибка загрузки</div>';
        }
    }
}
// === НОВАЯ ВЕРСИЯ renderOrders() — РЕАЛ-ТАЙМ ЦЕПОЧКИ + ПРИЧИНА ОТМЕНЫ ===
function renderOrders() {
    const list = document.getElementById('ordersList');
    const search = document.getElementById('orderSearch').value.toLowerCase();

    let filtered = allOrders;

// === ФИЛЬТРАЦИЯ ПО ТАБУ ===
    if (currentTab === 'active') {
        filtered = allOrders.filter(o => !['completed', 'cancelled'].includes(o.status));
    } else if (currentTab === 'cancelled') {
        filtered = allOrders.filter(o => o.status === 'cancelled');
    } else if (currentTab === 'completed') {
        filtered = allOrders.filter(o => o.status === 'cancelled');
    }
    else if (currentTab === 'completed') {
        filtered = allOrders.filter(o => o.status === 'cancelled');
    }

    if (search) {
        filtered = filtered.filter(order =>
            order.id.toString().includes(search) ||
            order.items.some(i => i.title.toLowerCase().includes(search))
        );
    }

    if (filtered.length === 0) {
        list.innerHTML = '';
        const emptyId = currentTab === 'all' ? 'emptyAll' : 'emptyActive';
        const el = document.getElementById(emptyId);
        if (el) el.style.display = 'block';
        return;
    }

    document.querySelectorAll('.archive-empty').forEach(el => el.style.display = 'none');
    const activeCount = allOrders.filter(o => !['completed', 'cancelled'].includes(o.status)).length;
    const badge = document.getElementById('activeCount');
    if (badge) badge.textContent = activeCount || '';

    // === КЭШИРОВАНИЕ КАРТИНОК (чтобы не искать каждый раз) ===
     window.productImages = window.productImages || {};
    window.serviceImages = window.serviceImages || {};

    // Заполняем кэш из уже загруженных данных (они у тебя где-то есть в глобале)
         if (window.allProducts) {
        window.allProducts.forEach(p => {
            if (p.image_urls?.length > 0) window.productImages[p.id] = p.image_urls[0];
        });
    }
    if (window.allServices) {
        window.allServices.forEach(s => {
            if (s.image_urls?.length > 0) window.serviceImages[s.id] = s.image_urls[0];
        });
    }

    list.innerHTML = filtered.map(order => {
        const isCancelled = order.status === 'cancelled';
        const isCompleted = order.status === 'completed';

        // Определяем, какие шаги уже пройдены
        const steps = [
            { key: 'pending',    label: 'Принят' },
            { key: 'confirmed',  label: 'Подтверждён' },
            { key: 'processing', label: 'В обработке' },
            { key: 'shipping',   label: 'В доставке' },
            { key: 'completed',  label: 'Готово' }
        ];

        // Находим индекс текущего статуса
        const currentIndex = steps.findIndex(s => s.key === order.status);
        const filledCount = currentIndex >= 0 ? currentIndex + 1 : 0;

        const safeReason = order.cancel_reason 
            ? String(order.cancel_reason)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\n/g, '<br>')
            : '';

        return `
            <div class="apple-archive-order" data-order-id="${order.id}">
                <!-- Заголовок -->
                <div class="archive-order-header">
                    <div class="archive-order-title">
                        Заказ ${order.display_id || order.id}
                        <span class="archive-status-badge">
                            ${isCompleted ? 'Выполнен' : isCancelled ? 'Отменён' : 'В работе'}
                        </span>
                    </div>
                    <div class="archive-order-meta">
                        <div class="archive-order-date">
                            ${new Date(order.created_at).toLocaleDateString('ru-RU', {
                                day: 'numeric', month: 'short', year: 'numeric'
                            })}
                        </div>
                        <div class="archive-order-total">${order.total_str}</div>
                    </div>
                </div>

                <!-- 5 точек прогресса — ВСЕ ОСТАЛИСЬ! -->
                ${!isCompleted && !isCancelled ? `
                    <div class="archive-progress-chain">
                        ${steps.map((step, i) => `
                            <div class="progress-step ${i < filledCount ? 'filled' : ''}">
                                <div class="progress-dot"></div>
                                ${i < steps.length - 1 ? '<div class="progress-line"></div>' : ''}
                            </div>
                        `).join('')}
                    </div>
                    <div class="progress-labels">
                        ${steps.map((step, i) => `
                            <div class="progress-label ${i < filledCount ? 'filled' : ''}">
                                ${step.label}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                <!-- Иконка завершения/отмены -->
                ${isCompleted || isCancelled ? `
                    <div class="archive-final-status">
                        <div class="final-icon ${isCompleted ? 'completed' : 'cancelled'}">
                            ${isCompleted ? '✓' : '✕'}
                        </div>
                    </div>
                ` : ''}

                <!-- Товары -->
<div class="archive-items-list">
    ${order.items.slice(0, 4).map(item => {
        const imgId = `archive-thumb-${order.id}-${item.item_id}`;
        const isService = item.item_type === 'service';
const apiUrl = isService 
    ? `/api/service/${item.item_id}?t=${Date.now()}`
    : `/api/product/${item.item_id}?t=${Date.now()}`;

        // Сначала ставим то, что уже есть (для архивных заказов)
        let initialSrc = item.image_url 
    ? item.image_url + (item.image_url.includes('?') ? '&' : '?') + 't=' + Date.now()
    : '/static/assets/no-image.png';

        // Асинхронно подгружаем реальную фотку, если её не было
        if (!item.image_url && item.item_id) {
            setTimeout(() => {
                fetch(apiUrl, { credentials: 'include', cache: 'no-store' })
                    .then(r => r.ok ? r.json() : null)
                    .then(data => {
                        if (!data) return;
                        const url = data.image_url || data.image_urls?.[0] || data.image;
                        if (url) {
                            const img = document.getElementById(imgId);
                            if (img) img.src = url;
                            // Кешируем
                            if (isService) {
                                window.serviceImages = window.serviceImages || {};
                                window.serviceImages[item.item_id] = url;
                            } else {
                                window.productImages = window.productImages || {};
                                window.productImages[item.item_id] = url;
                            }
                        }
                    })
                    .catch(() => {});
            }, 80);
        }

        return `
            <div class="archive-item-row">
<img id="${imgId}"
     src="${initialSrc + (initialSrc.includes('?') ? '&' : '?') + 't=' + Date.now()}"
     class="archive-item-thumb"
     onerror="this.onerror=null; this.src='/static/assets/no-image.png?t=' + Date.now()"
     loading="lazy">
                <div class="archive-item-info">
                    <div class="archive-item-name">${item.title || 'Без названия'}</div>
                    <div class="archive-item-details">
                        ${item.quantity || 1} × ${item.price_str || '—'}
                    </div>
                </div>
                <button class="archive-repeat-btn" 
                        onclick="event.stopPropagation(); repeatOrderItem(${item.item_id}, '${item.item_type || 'product'}')">
                    Повторить
                </button>
            </div>
        `;
    }).join('')}
    ${order.items.length > 4 ? `<div class="archive-more-items">…и ещё ${order.items.length - 4}</div>` : ''}
</div>

                <!-- Причина отмены -->
                ${isCancelled && safeReason ? `
                    <div class="archive-cancel-reason">
                        <div class="cancel-reason-title">Причина отмены</div>
                        <div class="cancel-reason-text">${safeReason}</div>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
    // Клик по карточке — как было
    list.onclick = function(e) {
        let card = e.target.closest('.clickable-order');
        if (!card) return;
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;

        const orderId = card.dataset.orderId;
        const container = document.getElementById('orderChainContainer');
        if (container) {
            container.style.display = 'block';
            container.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        if (window.pollInterval) clearInterval(window.pollInterval);
        window.startOrderChain(orderId);
    };
    window.repeatOrderItem = async function(itemId, type = 'product') {
    if (!itemId) return;
    await fetch('/api/cart/add', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
            type === 'service' ? { service_id: itemId } : { product_id: itemId }
        )
    });
    document.dispatchEvent(new CustomEvent('cartUpdated'));
};
}

// === ГЛАВНОЕ: ЛОВИМ ИЗМЕНЕНИЕ СТАТУСА И ОБНОВЛЯЕМ МИНИ-ЦЕПОЧКУ В АРХИВЕ ===
document.addEventListener('orderStatusChanged', (e) => {
    const { orderId, status, isFinal } = e.detail;
    const chainElement = document.getElementById(`archive-chain-${orderId}`);
    if (!chainElement) return; // если заказ не в активных — ничего не делаем

    // Обновляем классы у шагов
    const steps = chainElement.querySelectorAll('.mini-step');
    const connectors = chainElement.querySelectorAll('.mini-connector');

    // Сброс
    steps.forEach(s => s.classList.remove('active'));
    connectors.forEach(c => c.classList.remove('active'));

    if (status === 'pending') {
        steps[0].classList.add('active');
    } else if (status === 'processing' || status === 'shipping') {
        steps[0].classList.add('active');
        steps[1].classList.add('active');
        connectors[0].classList.add('active');
    } else if (status === 'completed') {
        steps.forEach(s => s.classList.add('active'));
        connectors.forEach(c => c.classList.add('active'));
    }

    // Если завершён — можно убрать карточку или перерисовать весь список
    if (isFinal) {
        setTimeout(() => {
        if (typeof allOrders !== 'undefined' && Array.isArray(allOrders)) {
            updateArchiveTabsCounts();
        }
    }, 500);
    }
});

// Переключение табов

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = btn.dataset.tab;
        currentPage = 1;

        // ←←←←←←←←←←←←←←← ГЛАВНОЕ ИСПРАВЛЕНИЕ ←←←←←←←←←←←←←←←
        if (currentTab === 'active') {
            // Только активные — грузим с /api/user_orders и НЕ трогаем allOrders
            loadOrders(true);
        } else {
            // «Все» или «Завершённые» — грузим архивные, но ПЕРЕД ЭТИМ возвращаем активные!
            fetch('/api/user_orders?t=' + Date.now(), { cache: 'no-store' })
                .then(r => r.ok ? r.json() : [])
                .then(activeOnes => {
                    allOrders = activeOnes.filter(o => !['completed', 'cancelled'].includes(o.status));
                    loadOrders(true); // теперь добавит завершённые к активным
                })
                .catch(() => loadOrders(true));
        }
        // ←←←←←←←←←←←←←←← КОНЕЦ ГЛАВНОГО ИСПРАВЛЕНИЯ ←←←←←←←←←←←←←←←
    });
});
// Поиск
document.getElementById('orderSearch').addEventListener('input', () => renderOrders());

// Загрузить ещё
document.getElementById('loadMoreBtn')?.addEventListener('click', () => {
    currentPage++;
    loadOrders();
});

  // Закрытие цепочки по кнопке
document.getElementById('orderChainToggle')?.addEventListener('click', () => {
    document.getElementById('orderChainContainer').style.display = 'none';
    if (window.pollInterval) clearInterval(window.pollInterval);
});
  // === ЗАКРЫТИЕ МОДАЛОК ===
  elements.closeFeedbackModal?.addEventListener('click', () => elements.feedbackModal.style.display = 'none');
  elements.feedbackModal?.addEventListener('click', e => { if (e.target === elements.feedbackModal) elements.feedbackModal.style.display = 'none'; });
  elements.closeCheckout?.addEventListener('click', () => elements.checkoutModal.style.display = 'none');
  elements.checkoutModal?.addEventListener('click', e => { if (e.target === elements.checkoutModal) elements.checkoutModal.style.display = 'none'; });
  elements.closeReview?.addEventListener('click', () => elements.reviewModal.style.display = 'none');
  elements.closeArchive?.addEventListener('click', () => elements.archiveModal.style.display = 'none');
  elements.archiveModal?.addEventListener('click', e => { if (e.target === elements.archiveModal) elements.archiveModal.style.display = 'none'; });
  
});

document.addEventListener('DOMContentLoaded', () => {
  const cartItemsList = document.getElementById('cartItemsList');
  const summaryCount  = document.getElementById('summaryCount');
  const summaryTotal  = document.getElementById('summaryTotal');
  const checkoutBtn   = document.getElementById('checkoutBtn');

  if (!cartItemsList) return;

  let hasRendered = false;
  let currentCartItems = [];

  const formatPrice = (cents) => {
    if (cents == null || cents === 0) return 'Цена по запросу';
    const rub = Math.floor(cents / 100);
    const kop = (cents % 100).toString().padStart(2, '0');
    return `${rub.toLocaleString('ru-RU')}.${kop} ₽`;
  };

const updateQuantity = async (id, type = 'product', change) => {
    const isLoggedIn = !!sessionStorage.getItem('user_id');
    const item = currentCartItems.find(i => i.id == id && (i.type || 'product') === type);
    if (!item) return;

    const newQty = item.quantity + change;
    if (newQty < 0) return;

    const url = isLoggedIn ? '/api/cart/update' : '/api/cart/guest/update';

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                [type === 'service' ? 'service_id' : 'product_id']: id,
                quantity: newQty > 0 ? newQty : 0
            })
        });

        // Даже если сервер вернул ошибку — всё равно обновляем (чтобы не было рассинхрона)
        if (typeof loadCart === 'function') {
            await loadCart();
        }
    } catch (err) {
        console.error('Ошибка изменения количества:', err);
        // На всякий случай — принудительно обновляем с сервера
        if (typeof loadCart === 'function') await loadCart();
    }
};

const removeFromCart = async (id, type = 'product') => {
    const isLoggedIn = !!sessionStorage.getItem('user_id');
    const url = isLoggedIn ? '/api/cart/update' : '/api/cart/guest/update';

    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                [type === 'service' ? 'service_id' : 'product_id']: id,
                quantity: 0
            })
        });

        if (typeof loadCart === 'function') {
            await loadCart();
        }
    } catch (err) {
        console.error('Ошибка удаления:', err);
        if (typeof loadCart === 'function') await loadCart();
    }
};

  // КНОПКИ ТЕПЕРЬ РАБОТАЮТ!
  const handleCartClick = (e) => {
    const btn = e.target.closest('.apple-qty-btn, .apple-remove-btn');
    if (!btn) return;

    const itemEl = btn.closest('.apple-cart-item');
    if (!itemEl) return;

    const id = itemEl.dataset.id;
    const type = itemEl.dataset.type || 'product';

    if (!id) return;

    if (btn.classList.contains('apple-remove-btn')) {
      removeFromCart(id, type);
    } else if (btn.classList.contains('apple-qty-btn')) {
      const change = btn.classList.contains('plus') ? 1 : -1;
      updateQuantity(id, type, change);
    }
  };

  document.addEventListener('click', handleCartClick);

const renderFullCart = (items = []) => {
  if (hasRendered && items.length === 0 && currentCartItems.length === 0) return;
  currentCartItems = items.slice();
window.cartItems = items.slice();

  hasRendered = true;

  const isMobile = window.innerWidth <= 1026;

  // Контейнеры
  const desktopContainer = document.querySelector('.cart-items-desktop');
  const mobileContainer  = document.querySelector('.cart-items-mobile');

// === ПУСТАЯ КОРЗИНА ===
if (items.length === 0) {
  const emptyHtml = `
    <div class="cart-empty-apple" style="text-align:center;padding:4rem 1rem;color:#888;">
      <i class="fas fa-shopping-bag" style="font-size:3.5rem;margin-bottom:1rem;opacity:0.3;"></i>
      <div class="empty-title" style="font-size:1.4rem;font-weight:600;">Корзина пуста</div>
      <div class="empty-subtitle" style="margin-top:0.5rem;">Добавьте товары и они появятся здесь</div>
    </div>`;

  if (desktopContainer) desktopContainer.innerHTML = emptyHtml;
  if (mobileContainer)  mobileContainer.innerHTML  = emptyHtml;

  // ← ВАЖНО: СНАЧАЛА ОБНОВЛЯЕМ ИТОГИ, ПОТОМ ВЫХОДИМ!
  document.querySelectorAll('#summaryCount').forEach(el => el.textContent = '0');
  document.querySelectorAll('#summaryTotal').forEach(el => el.textContent = '0 ₽');
  // Делаем кнопку КЛИКАБЕЛЬНОЙ, но визуально неактивной
// Делаем кнопку кликабельной ПРИНУДИТЕЛЬНО и защищаем от перезаписи
setTimeout(() => {
  document.querySelectorAll('#checkoutBtn, #mobileCheckoutBtn').forEach(btn => {
    if (!btn) return;

    // Самое главное — убираем атрибут disabled полностью
    btn.removeAttribute('disabled');
    btn.disabled = false;

    // Визуально неактивна, но кликабельна
    btn.style.opacity = '0.45';
    btn.style.pointerEvents = 'auto';
    btn.style.cursor = 'pointer';

    // Страховка: если кто-то после нас снова поставит disabled — всё равно сработает
    btn.addEventListener('click', e => {
      if (btn.hasAttribute('disabled') || btn.disabled) {
        e.stopImmediatePropagation();
        e.preventDefault();
        // Принудительно запускаем логику оформления (то же самое, что делает твой обработчик)
        document.querySelector('#checkoutBtn')?.click();
        // или просто диспатчим кастомное событие
        // document.dispatchEvent(new CustomEvent('forceCheckoutClick'));
      }
    }, { once: false });
  });
}, 100); // 100 мс — хватает, чтобы все остальные скрипты отработали

  return; // теперь можно выйти — итоги уже обновлены везде!
}


  const totalCents = items.reduce((s, i) => s + (i.price_cents || 0) * i.quantity, 0);
  const totalCount = items.reduce((s, i) => s + i.quantity, 0);

  // === ПК ВЕРСИЯ (твоя старая, красивая) ===
  const desktopHtml = items.map(item => `
    <div class="apple-cart-item" data-id="${item.id}" data-type="${item.type || 'product'}">
      <div class="apple-cart-image">
        <img src="${item.image_url || '/static/assets/no-image.png'}"
           onerror="this.src='/static/assets/no-image.png'" alt="${item.title}">
      </div>
      <div class="apple-cart-info">
        <h3 class="apple-cart-title">${item.title}</h3>
        <div class="apple-cart-price">${formatPrice(item.price_cents)}</div>
      </div>
      <div class="apple-quantity-control">
        <button class="apple-qty-btn minus" ${item.quantity <= 1 ? 'disabled' : ''}>
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M5 12h14" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>
        </button>
        <span class="apple-qty-value">${item.quantity}</span>
        <button class="apple-qty-btn plus">
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <button class="apple-remove-btn">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M3 6h18M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1-1v2M8 6h8m-9 0v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6H7Z"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

    </div>
  `).join('');

  // === МОБИЛЬНАЯ ВЕРСИЯ (новая, шикарная) ===
const mobileHtml = items.map(item => `
  <div class="mobile-cart-item apple-cart-item" data-id="${item.id}" data-type="${item.type || 'product'}">
    
    <!-- Фото -->
    <div class="mobile-cart-image">
      <img src="${item.image_url || '/static/assets/no-image.png'}"
           onerror="this.src='/static/assets/no-image.png'" alt="${item.title}">
    </div>

    <!-- Основная инфа -->
    <div class="mobile-cart-content">
      <h3 class="mobile-cart-title">${item.title}</h3>
      
      <div class="mobile-cart-footer">
        <div class="mobile-cart-price">${formatPrice(item.price_cents)}</div>
        
        <div class="mobile-quantity-control">
          <button class="apple-qty-btn minus" ${item.quantity <= 1 ? 'disabled' : ''}>−</button>
          <span class="apple-qty-value">${item.quantity}</span>
          <button class="apple-qty-btn plus">+</button>
        </div>
        
        <div class="mobile-cart-total-price">
          ${formatPrice((item.price_cents || 0) * item.quantity)}
        </div>
      </div>
    </div>

    <!-- Мусорка — В САМОМ ПРАВОМ ВЕРХНЕМ УГЛУ -->
<button 
  class="mobile-remove-btn apple-remove-btn" 
  aria-label="Удалить"
  style="position: relative; z-index: 1;">
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
    <path d="M3 6h18M10 11v6M14 11v6M5 6l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
  </svg>
</button>
  </div>
`).join('');

  // Рендерим в нужные контейнеры
  if (desktopContainer) desktopContainer.innerHTML = desktopHtml;
  if (mobileContainer)  mobileContainer.innerHTML  = mobileHtml;

  // Обновляем итоги (одни и те же элементы)
 document.querySelectorAll('#summaryCount').forEach(el => el.textContent = totalCount);
document.querySelectorAll('#summaryTotal').forEach(el => el.textContent = formatPrice(totalCents));
  // ←←←← НОВЫЕ ТРИ СТРОЧКИ — ДЕЛАЮТ МАГИЮ НА МОБИЛКЕ ←←←←
  const allCountEls  = document.querySelectorAll('#summaryCount');
  const allTotalEls  = document.querySelectorAll('#summaryTotal');
  
  allCountEls.forEach(el => el.textContent = totalCount);
  allTotalEls.forEach(el => el.textContent = formatPrice(totalCents));
  // ←←←← КОНЕЦ НОВЫХ СТРОЧЕК ←←←←
  // Возвращаем кнопке нормальный вид, когда есть товары
document.querySelectorAll('#checkoutBtn, #mobileCheckoutBtn').forEach(btn => {
  if (btn) {
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
  }
});
};

  // Слушаем обновления от мини-корзины и от себя
  document.addEventListener('cartUpdated', e => renderFullCart(e.detail.items || []));

  // Инициализация
    // ГАРАНТИРОВАННАЯ ИНИЦИАЛИЗАЦИЯ СРАЗУ — БЕЗОПАСНО И БЫСТРО
  (function() {
    let cart = [];

    // 1. Сначала из localStorage (гости)
    try {
      const saved = localStorage.getItem('clientCart');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          cart = parsed;
        }
      }
    } catch (e) {}

    // 2. Если пусто — пробуем window.cartItems
    if (cart.length === 0 && window.cartItems && Array.isArray(window.cartItems) && window.cartItems.length > 0) {
      cart = window.cartItems;
    }

    // 3. Если хоть что-то нашли — сразу рендерим и синхронизируем глобалку
    if (cart.length > 0) {
      window.cartItems = cart.slice();  // ← ЭТО ГЛАВНОЕ
      renderFullCart(cart);
      return;
    }

    // 4. Если корзина точно пуста — сразу ставим 0 и синхронизируем
    window.cartItems = [];
    document.querySelectorAll('#summaryCount, [data-cart-count]').forEach(el => el.textContent = '0');
    document.querySelectorAll('#summaryTotal').forEach(el => el.textContent = '0 ₽');
  })();
  
});

// Универсальный обработчик кликов
document.addEventListener('click', e => {
  const btn = e.target.closest('.apple-qty-btn, .apple-remove-btn, .quantity-btn, .clear-cart-btn');
  if (btn && !GlobalCartProtection.check()) {
    e.preventDefault();
    e.stopImmediatePropagation();
    e.stopPropagation();
  }
}, true);


// Кнопка закрытия цепочки (с очисткой поллинга)
document.getElementById('orderChainToggle')?.addEventListener('click', () => {
    document.getElementById('orderChainContainer').style.display = 'none';
    if (window.pollInterval) {
        clearInterval(window.pollInterval);
        window.pollInterval = null;
    }

    
});

 

