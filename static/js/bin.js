
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

  // Универсальные тосты
  const showToast = (title, message = '', error = false, duration = 3000) => {
    const toast = document.createElement('div');
    toast.className = `toast-alert ${error ? 'error' : 'success'}`;
    toast.innerHTML = `
      <div class="alert-content">
        <i class="fas ${error ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i>
        <div class="alert-text">
          <strong>${title}</strong>
          <span>${message}</span>
        </div>
        <button class="alert-close">×</button>
      </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 500);
    }, duration);
    toast.querySelector('.alert-close').onclick = () => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 500);
    };
  };

const reliableToast = (title, message = '', isError = false, duration = 4000) => {
  // Удаляем все предыдущие тосты
  document.querySelectorAll('.reliable-toast').forEach(t => t.remove());

  const toast = document.createElement('div');
  toast.className = 'reliable-toast';
  toast.innerHTML = `
    <div class="toast-content">
      <i class="fas ${isError ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i>
      <div>
        <strong>${title}</strong>
        ${message ? `<div style="font-size:0.92rem; opacity:0.92; margin-top:4px;">${message}</div>` : ''}
      </div>
    </div>
  `;

  // Стили — всё в одном месте, красиво и без багов
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '30px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: isError ? '#ff4444' : '#00ff95',
    color: isError ? 'white' : 'black',
    padding: '16px 28px',
    borderRadius: '22px',
    boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
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
    fontFamily: 'Inter, sans-serif'
  });

  document.body.appendChild(toast);

  // Авто-исчезновение
  setTimeout(() => {
    toast.style.animation = 'toastDown 0.4s ease forwards';
    setTimeout(() => toast.remove(), 400);
  }, duration);
};

// Анимации — вставь один раз в <head или в этот же скрипт
const toastStyles = document.createElement('style');
toastStyles.textContent = `
  @keyframes toastUp {
    from { transform: translateX(-50%) translateY(100px); opacity: 0; }
    to   { transform: translateX(-50%) translateY(0); opacity: 1; }
  }
  @keyframes toastDown {
    to { transform: translateX(-50%) translateY(80px); opacity: 0; }
  }
  .reliable-toast i { font-size: 1.6rem; }
`;
document.head.appendChild(toastStyles);

// Красивая модалка "Лимит достигнут"
// === КРАСИВАЯ МОДАЛКА "ЛИМИТ ДОСТИГНУТ" — АВТО-ПОДДЕРЖКА СВЕТЛОЙ/ТЁМНОЙ ТЕМЫ ===
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

// === СТИЛИ С ПОДДЕРЖКОЙ ТЁМНОЙ И СВЕТЛОЙ ТЕМЫ ===
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

  .limit-modal-icon i {
    font-size: 3rem;
    color: white;
  }

  .limit-modal-title {
    margin: 0 0 1rem;
    font-size: 1.9rem;
    font-weight: 800;
    color: #fff;
  }

  .limit-modal-text {
    margin: 0 0 2rem;
    color: #ccc;
    font-size: 1.1rem;
    line-height: 1.5;
  }

  .limit-modal-text strong {
    color: #fff;
  }

  .limit-modal-btn-primary {
    background: #00ff95;
    color: #000;
    border: none;
    padding: 1rem 2.5rem;
    border-radius: 22px;
    font-size: 1.1rem;
    font-weight: 700;
    cursor: pointer;
    width: 100%;
    transition: all 0.3s;
  }

  .limit-modal-btn-primary:hover {
    background: #00ffaa;
    transform: translateY(-2px);
    box-shadow: 0 10px 30px rgba(0, 255, 149, 0.4);
  }

  .limit-modal-link {
    background: transparent;
    color: #00ff95;
    border: none;
    font-size: 1rem;
    cursor: pointer;
    text-decoration: underline;
    margin-top: 1.5rem;
    padding: 0;
    transition: opacity 0.2s;
  }

  .limit-modal-link:hover {
    opacity: 0.8;
  }

  /* === СВЕТЛАЯ ТЕМА === */
  html[data-theme="light"] .limit-modal-content {
    background: rgba(255, 255, 255, 0.98);
    border: 1px solid rgba(0, 0, 0, 0.1);
    box-shadow: 0 40px 100px rgba(0, 0, 0, 0.15);
  }

  html[data-theme="light"] .limit-modal-title {
    color: #111;
  }

  html[data-theme="light"] .limit-modal-text {
    color: #555;
  }

  html[data-theme="light"] .limit-modal-text strong {
    color: #000;
  }

  html[data-theme="light"] .limit-modal-btn-primary {
    background: #00cc77;
    color: white;
  }

  html[data-theme="light"] .limit-modal-btn-primary:hover {
    background: #00bb66;
  }

  html[data-theme="light"] .limit-modal-link {
    color: #00aa66;
  }

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

// === ОБНОВЛЁННЫЙ ОБРАБОТЧИК КНОПКИ "ОФОРМИТЬ ЗАКАЗ" ===
// === КНОПКА "ОФОРМИТЬ ЗАКАЗ" ВНИЗУ СТРАНИЦЫ (ГЛАВНАЯ) ===
elements.checkoutBtn?.addEventListener('click', async () => {
  const itemsCount = parseInt(document.getElementById('summaryCount')?.textContent || '0', 10);

  // Если корзина пуста — показываем красивый алерт с кнопками "К товарам" и "К услугам"
  if (itemsCount === 0) {
    // Удаляем старый алерт, если был
    document.querySelectorAll('#emptyCartMainAlert').forEach(el => el.remove());

    const alert = document.createElement('div');
    alert.id = 'emptyCartMainAlert';
    alert.innerHTML = `
      <div style="text-align:center; padding:2.8rem 1.8rem 2.2rem;">
        <i class="fas fa-shopping-bag" style="font-size:5.5rem; color:#00ff95; opacity:0.88; margin-bottom:1.6rem; display:block;"></i>
        <h3 style="margin:0 0 1rem; font-size:2.1rem; font-weight:800; color:#fff;">
          Корзина пуста
        </h3>
        <p style="margin:0 0 2.4rem; color:#ccc; font-size:1.22rem; line-height:1.6; max-width:420px; margin-left:auto; margin-right:auto;">
          Добавьте товары или услуги, чтобы оформить заказ
        </p>
        <div style="display:flex; gap:1.4rem; justify-content:center; flex-wrap:wrap;">
          <a href="/goods" style="
            background:#00ff95; color:#000; padding:1.1rem 2.4rem; 
            border-radius:26px; font-weight:700; text-decoration:none; font-size:1.15rem;
            box-shadow:0 8px 25px rgba(0,255,149,0.3);
            transition:all 0.3s;
          " onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 12px 35px rgba(0,255,149,0.4)'"
             onmouseout="this.style.transform=''; this.style.boxShadow='0 8px 25px rgba(0,255,149,0.3)'">
            К товарам
          </a>
          <a href="/services" style="
            background:rgba(255,255,255,0.1); color:#fff; padding:1.1rem 2.4rem; 
            border-radius:26px; font-weight:600; text-decoration:none; font-size:1.15rem;
            border:1px solid rgba(255,255,255,0.18); backdrop-filter:blur(10px);
            transition:all 0.3s;
          " onmouseover="this.style.background='rgba(255,255,255,0.18)'"
             onmouseout="this.style.background='rgba(255,255,255,0.1)'">
            К услугам
          </a>
        </div>
        <button style="
          position:absolute; top:18px; right:24px; background:none; border:none; 
          color:#fff; font-size:2.4rem; cursor:pointer; opacity:0.6; 
          transition:opacity 0.3s;
        " onclick="this.closest('#emptyCartMainAlert')?.remove()">
          ×
        </button>
      </div>
    `;

    Object.assign(alert.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'rgba(15,15,30,0.98)',
      backdropFilter: 'blur(40px)',
      WebkitBackdropFilter: 'blur(40px)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '36px',
      maxWidth: '520px',
      width: '92%',
      boxShadow: '0 50px 120px rgba(0,0,0,0.7)',
      zIndex: '999999',
      animation: 'modalPop 0.5s cubic-bezier(0.22,0.61,0.36,1)',
      fontFamily: 'Inter, sans-serif'
    });

    document.body.appendChild(alert);

    // Закрытие по клику вне контента
    alert.addEventListener('click', (e) => {
      if (e.target === alert) alert.remove();
    });

    return; // прерываем выполнение
  }

  // Если корзина НЕ пустая — открываем модалку оформления (как раньше)
  try {
    const sessionRes = await fetch('/api/session');
    const sessionData = await sessionRes.json();
    if (!sessionData.logged_in) {
      elements.authBtn.click();
      return;
    }

    const canPlaceOrder = await checkActiveOrdersLimit();
    if (!canPlaceOrder) {
      document.getElementById('activeOrdersLimitModal').style.display = 'flex';
      return;
    }

    const rawPhone = sessionData.phone || '—';
    const formatted = rawPhone === '—' ? '—' : `+7 (${rawPhone.slice(1,4)}) ${rawPhone.slice(4,7)}-${rawPhone.slice(7,9)}-${rawPhone.slice(9,11)}`;
    const premiumBlock = document.getElementById('checkoutPhonePremium');
    const formattedEl = document.getElementById('checkoutPhoneFormatted');
    if (premiumBlock && formattedEl) {
      formattedEl.textContent = formatted;
      premiumBlock.style.display = 'flex';
      document.getElementById('checkoutPhoneManual')?.style.setProperty('display', 'none');
    }

    document.getElementById('checkoutCount').textContent = itemsCount;
    document.getElementById('checkoutTotal').textContent = document.getElementById('summaryTotal').textContent;
    elements.checkoutModal.style.display = 'flex';
    elements.fullName.focus();
  } catch (e) {
    reliableToast('Ошибка связи', 'Попробуйте позже', true, 4000);
  }
});

// === НОВЫЙ ФИНАЛЬНЫЙ ОБРАБОТЧИК ОФОРМЛЕНИЯ ЗАКАЗА (2025) ===
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

      // КРАСИВЫЙ ТОСТ — ВСЁ ЧЕРЕЗ reliableToast
      reliableToast(`Заказ ${data.display_id} создан!`, 'Он уже в работе', false, 4000);

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
    if (selectedStars === 0) return showToast('Выберите оценку', '', true);
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
// ОТКРЫТИЕ АРХИВА — РАБОТАЕТ НА ПК И НА МОБИЛЕ С ОДНИМ ID!
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
    if (forceReload) {
        allOrders = [];
        currentPage = 1;
    }

    const list = document.getElementById('ordersList');
    const loadMoreContainer = document.getElementById('loadMoreContainer');

    if (currentPage === 1 && allOrders.length === 0) {
        list.innerHTML = '<div style="text-align:center;padding:3rem;color:#aaa;">Загружаем заказы...</div>';
    }

    try {
        // ←←←←←←←←←←←←←←← ЭТО КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ ←←←←←←←←←←←←←←←
        const endpoint = (currentTab === 'all' || currentTab === 'completed')
    ? '/api/user_archived_orders'
    : '/api/user_orders';
        // ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←

        const res = await fetch(`${endpoint}?page=${currentPage}&per=${PER_PAGE}&t=${Date.now()}`, {
            cache: 'no-store'
        });

        if (!res.ok) throw new Error('Server error');
        const newOrders = await res.json();

        if (forceReload) {
            allOrders = newOrders;
        } else {
            allOrders = [...allOrders, ...newOrders];
        }

        renderOrders();
        loadMoreContainer.style.display = newOrders.length === PER_PAGE ? 'block' : 'none';

        const activeCount = allOrders.filter(o => !['completed', 'cancelled'].includes(o.status)).length;
        const badge = document.querySelector('[data-tab="active"] span');
        if (badge) badge.textContent = activeCount || '';

    } catch (err) {
        console.error(err);
        list.innerHTML = '<div style="text-align:center;padding:3rem;color:#ff6b6b;">Ошибка загрузки</div>';
    }
}
// === НОВАЯ ВЕРСИЯ renderOrders() — РЕАЛ-ТАЙМ ЦЕПОЧКИ + ПРИЧИНА ОТМЕНЫ ===
function renderOrders() {
    const list = document.getElementById('ordersList');
    const search = document.getElementById('orderSearch').value.toLowerCase();

    let filtered = allOrders;

if (currentTab === 'active') {
    filtered = allOrders.filter(o => !['completed', 'cancelled'].includes(o.status));
} else if (currentTab === 'all') {
    filtered = allOrders.filter(o => ['completed', 'cancelled'].includes(o.status));
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
        // ВСЁ! image_url уже приходит с бэкенда — просто берём его!
        const img = item.image_url || '/static/assets/no-image.png';

        return `
            <div class="archive-item-row">
                <img src="${img}" 
                     class="archive-item-thumb" 
                     onerror="this.src='/static/assets/no-image.png'" 
                     loading="lazy">
                <div class="archive-item-info">
                    <div class="archive-item-name">${item.title || 'Без названия'}</div>
                    <div class="archive-item-details">
                        ${item.quantity || 1} × ${item.price_str || '—'}
                    </div>
                </div>
                <button class="archive-repeat-btn" 
                        onclick="event.stopPropagation(); repeatOrderItem(${item.item_id}, '${item.item_type}')">
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
            loadOrders(true); // полная перезагрузка архива — чисто и надёжно
        }, 1500);
    }
});

// Переключение табов
// Переключение табов — ПОЛНАЯ ПЕРЕЗАГРУЗКА ДАННЫХ!
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = btn.dataset.tab;

        // ←←←←←←←←←←←←←←← ЭТО ГЛАВНОЕ ←←←←←←←←←←←←←←←
        allOrders = [];      // очищаем старое
        currentPage = 1;     // сбрасываем пагинацию
        loadOrders(true);    // ← ПЕРЕЗАГРУЖАЕМ с правильного endpoint!
        // ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
    });
});
// Поиск
document.getElementById('orderSearch').addEventListener('input', () => renderOrders());

// Загрузить ещё
document.getElementById('loadMoreBtn')?.addEventListener('click', () => {
    currentPage++;
    loadOrders();
});

  // === ОБРАТНАЯ СВЯЗЬ ===
  elements.feedbackBtn?.addEventListener('click', () => {
    if (!sessionStorage.getItem('user_id')) {
      elements.authBtn.click();
      return;
    }
    const phoneInput = $('feedbackPhoneInput');
    const editBtn = $('editPhoneBtn');
    const rawPhone = sessionStorage.getItem('phone') || '';
    if (rawPhone && rawPhone !== '—') {
      phoneInput.value = `+7 (${rawPhone.slice(1,4)}) ${rawPhone.slice(4,7)}-${rawPhone.slice(7,9)}-${rawPhone.slice(9,11)}`;
      phoneInput.readOnly = true;
      editBtn.style.display = 'block';
    } else {
      phoneInput.value = '';
      phoneInput.readOnly = false;
      editBtn.style.display = 'none';
    }
    elements.feedbackModal.style.display = 'flex';
    editBtn.onclick = () => { phoneInput.readOnly = false; phoneInput.focus(); editBtn.style.display = 'none'; };
  });

  $('closeFeedbackModal')?.addEventListener('click', () => elements.feedbackModal.style.display = 'none');
  elements.feedbackModal?.addEventListener('click', e => { if (e.target === elements.feedbackModal) elements.feedbackModal.style.display = 'none'; });

  $('feedbackForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.target;
    const name = form.name.value.trim();
    const phone = form.phone.value.trim();
    const email = form.email.value.trim();
    const message = form.message.value.trim();
    if (!name || !phone || !email || !message) return reliableToast('Заполните все поля', '', true);

    const submitBtn = $('feedbackSubmitBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const cooldown = submitBtn.querySelector('.btn-cooldown');
    const timer = cooldown.querySelector('.timer');
    submitBtn.disabled = true; btnText.style.display = 'none'; cooldown.style.display = 'inline';
    let seconds = 30; timer.textContent = seconds;
    const interval = setInterval(() => { seconds--; timer.textContent = seconds; if (seconds <= 0) { clearInterval(interval); submitBtn.disabled = false; btnText.style.display = 'inline'; cooldown.style.display = 'none'; } }, 1000);

    try {
      const res = await fetch('/api/feedback', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name, phone, email, message}) });
      const data = await res.json();
      if (res.ok && data.success) {
        reliableToast('Спасибо! Сообщение отправлено', 'Мы свяжемся с вами скоро', false, 5000);
        elements.feedbackModal.style.display = 'none';
        form.reset();
      } else {
        reliableToast('Ошибка отправки', data.error || 'Попробуйте позже', true);
      }
    } catch (err) {
      reliableToast('Нет связи с сервером', 'Проверьте интернет', true);
    }
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

// === СВАЙП ВВЕРХ С НИЖНЕЙ ЧАСТИ ЭКРАНА → ЗАКРЫТИЕ ШТОРКИ multiOrderModal (2025 стиль) ===
(() => {
  const modal = document.getElementById('multiOrderModal');
  if (!modal) return;

  const sheet = modal.querySelector('div[style*="background:var(--modal-bg)"]');
  if (!sheet) return;

  let startY = 0;
  let isDragging = false;
  const threshold = 100; // пикселей вверх → закрываем

  // Функция: получаем текущую видимую высоту шторки
  const getSheetBottomY = () => {
    const rect = sheet.getBoundingClientRect();
    return rect.bottom; // координата нижнего края шторки
  };

  const handleStart = (e) => {
    if (window.innerWidth > 1026) return; // только телефоны
    if (!modal.classList.contains('show')) return;

    const touch = e.touches[0];
    const sheetBottom = getSheetBottomY();

    // Разрешаем начать свайп, если коснулись НИЖЕ нижнего края шторки
    // (или совсем чуть выше — на 30px, чтобы можно было схватить за край)
    if (touch.clientY < sheetBottom - 30) return;

    startY = touch.clientY;
    isDragging = true;
    sheet.style.transition = 'none';
    e.preventDefault();
  };

  const handleMove = (e) => {
    if (!isDragging) return;

    const touch = e.touches[0];
    const deltaY = startY - touch.clientY; // >0 = тянем вверх

    if (deltaY > 0) {
      sheet.style.transform = `translateY(-${deltaY}px)`;
      e.preventDefault();
    }
  };

  const handleEnd = () => {
    if (!isDragging) return;
    isDragging = false;

    const moved = parseFloat(sheet.style.transform?.replace(/[^0-9.-]/g, '') || '0');
    const movedUp = -moved;

    if (movedUp > threshold) {
      sheet.style.transition = 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
      sheet.style.transform = 'translateY(-100%)';

      sheet.addEventListener('transitionend', () => {
        modal.style.display = 'none';
        modal.classList.remove('show');
        sheet.style.transform = '';
        sheet.style.transition = '';
      }, { once: true });
    } else {
      sheet.style.transition = 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)';
      sheet.style.transform = 'translateY(0)';
      setTimeout(() => sheet.style.transition = '', 500);
    }
  };

  // Слушаем по всему документу — ловим свайп даже в пустой области под шторкой
  document.addEventListener('touchstart', handleStart, { passive: false });
  document.addEventListener('touchmove', handleMove, { passive: false });
  document.addEventListener('touchend', handleEnd);

  // Дополнительно — на саму шторку (если вдруг кто-то тянет за контент)
  sheet.addEventListener('touchstart', handleStart, { passive: false });

  // Пересчитываем при изменении содержимого (например, после renderVerticalOrders)
  const observer = new MutationObserver(() => {
    // Просто триггерим пересчёт при любом изменении внутри шторки
    if (isDragging) return;
    // Ничего не делаем — getSheetBottomY() и так всегда актуальна
  });
  observer.observe(sheet, { childList: true, subtree: true, attributes: true });

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

  // ЭТО БЫЛО ПРОПУЩЕНО — СЕЙЧАС ВСЁ РАБОТАЕТ!
  const updateQuantity = async (id, type, change) => {
    const item = currentCartItems.find(i => i.id == id && (i.type || 'product') === type);
    if (!item) return;

    const newQty = item.quantity + change;
    if (newQty < 0) return;

    try {
      const res = await fetch('/api/cart/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [type === 'service' ? 'service_id' : 'product_id']: id,
          quantity: newQty > 0 ? newQty : 0
        })
      });

      if (res.ok) {
        await loadCart(); // универсальная функция из cart.js — обновит всё
      }
    } catch (err) {
      console.error('Ошибка обновления количества:', err);
    }
  };

  const removeFromCart = async (id, type) => {
    try {
      const res = await fetch('/api/cart/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [type === 'service' ? 'service_id' : 'product_id']: id,
          quantity: 0
        })
      });

      if (res.ok) {
        await loadCart();
      }
    } catch (err) {
      console.error('Ошибка удаления:', err);
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
  document.getElementById('checkoutBtn')?.setAttribute('disabled', '');

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
  document.getElementById('checkoutBtn')?.removeAttribute('disabled');
};

  // Слушаем обновления от мини-корзины и от себя
  document.addEventListener('cartUpdated', e => renderFullCart(e.detail.items || []));

  // Инициализация
  if (window.cartItems && Array.isArray(window.cartItems)) {
    renderFullCart(window.cartItems);
  }

  // Резервная загрузка
  const fallback = setTimeout(() => {
    if (!hasRendered && localStorage.getItem('clientCart')) {
      loadCart?.();
    }
  }, 1200);
  document.addEventListener('cartUpdated', () => clearTimeout(fallback), { once: true });
});



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

// Универсальный обработчик кликов
document.addEventListener('click', e => {
  const btn = e.target.closest('.apple-qty-btn, .apple-remove-btn, .quantity-btn, .clear-cart-btn');
  if (btn && !GlobalCartProtection.check()) {
    e.preventDefault();
    e.stopImmediatePropagation();
    e.stopPropagation();
  }
}, true);

// Опционально: можно добавить визуальный таймер в шапку или корзину




// Кнопка закрытия цепочки (с очисткой поллинга)
document.getElementById('orderChainToggle')?.addEventListener('click', () => {
    document.getElementById('orderChainContainer').style.display = 'none';
    if (window.pollInterval) {
        clearInterval(window.pollInterval);
        window.pollInterval = null;
    }
});




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
function updateFloatingPill() {
  const bar = document.getElementById('floatingOrderBar');
  const badge = document.getElementById('activeOrdersBadge');
  const main = document.getElementById('pillMainText');
  const sub = document.getElementById('pillSubText');

  if (!activeOrders.length) {
    bar.style.opacity = '0';
    bar.style.visibility = 'hidden';
    bar.style.transform = 'translateX(-50%) translateY(20px)'; // лёгкий уезд вниз
    document.body.classList.remove('has-active-orders'); // ← УБИРАЕМ ОТСТУП
    return;
  }

  // Есть заказы — показываем плашку
  badge.textContent = activeOrders.length;
  badge.style.display = activeOrders.length > 1 ? 'flex' : 'none';
  main.textContent = activeOrders.length === 1
    ? `Заказ ${activeOrders[0].display_id || activeOrders[0].id} в работе`
    : `${activeOrders.length} заказа в работе`;
  sub.textContent = activeOrders.length === 1 ? "Нажмите для подробностей" : "Нажмите, чтобы посмотреть все";

  bar.style.opacity = '1';
  bar.style.visibility = 'visible';
  bar.style.transform = 'translateX(-50%) translateY(0)';
  
  document.body.classList.add('has-active-orders'); // ← ДОБАВЛЯЕМ ОТСТУП
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
  container.innerHTML = '';

  if (activeOrders.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:80px 20px;color:var(--text-secondary);opacity:0.7;">
      <i class="fas fa-receipt" style="font-size:56px;margin-bottom:16px;opacity:0.3;"></i>
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
    `;

    card.onmouseenter = () => card.style.transform = 'translateY(-2px)';
    card.onmouseleave = () => card.style.transform = '';

   card.innerHTML = `
  <!-- Заголовок карточки -->
  <div class="order-header" style="padding:16px 18px;display:flex;align-items:center;gap:14px;">
    <div style="width:52px;height:52px;background:var(--order-icon-bg);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
      <i class="fas fa-truck" style="font-size:24px;color:var(--order-icon-color);"></i>
    </div>
    <div style="flex:1;min-width:0;">
      <div style="font-weight:800;font-size:17px;color:var(--text-primary);margin-bottom:3px;">
        Заказ ${order.display_id || order.id}
      </div>
      <div style="font-size:14px;color:var(--text-secondary);">
        ${order.total_str || '—'} • ${new Date(order.created_at).toLocaleDateString('ru-RU', {day:'numeric', month:'short', year:'numeric'})}
      </div>
    </div>
    <i class="fas fa-chevron-down expand-icon" style="color:var(--text-secondary);font-size:20px;transition:transform 0.3s;"></i>
  </div>

  <!-- Раскрывающаяся часть — теперь идеально в обеих темах -->
  <div class="order-details" style="max-height:0;overflow:hidden;transition:max-height 0.5s cubic-bezier(0.22,1,0.36,1);background:var(--order-details-bg);border-top:1px solid var(--order-details-border);">
    <div style="padding:18px 18px 22px;">
      <div id="chain-${order.id}"></div>
    </div>
  </div>
`;

    // Раскрытие по клику
    card.querySelector('.order-header').onclick = (e) => {
      e.stopPropagation();
      const details = card.querySelector('.order-details');
      const icon = card.querySelector('.expand-icon');
      const isOpen = details.style.maxHeight && details.style.maxHeight !== '0px';

      if (isOpen) {
        details.style.maxHeight = '0';
        icon.style.transform = 'rotate(0deg)';
      } else {
        // Авто-подгон высоты под содержимое
        details.style.maxHeight = details.scrollHeight + 40 + 'px';
        icon.style.transform = 'rotate(180deg)';
      }
    };

    container.appendChild(card);

    // Вставляем цепочку статусов (работает как раньше)
    setTimeout(() => {
      const target = document.getElementById(`chain-${order.id}`);
      if (!target) return;

      const real = Document.prototype.getElementById;
      Document.prototype.getElementById = id => id === 'orderChain' ? target : real.call(this, id);
      window.startOrderChain?.(order.id);
      Document.prototype.getElementById = real;
    }, 150);
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
  if (window.innerWidth <= 1026) {
    multiModal.classList.remove('show');

    // Дожидаемся окончания анимации и только потом скрываем
    modalInner.addEventListener('transitionend', function hide() {
      multiModal.style.display = 'none';
      multiModal.classList.remove('show'); // на всякий случай
      modalInner.removeEventListener('transitionend', hide);
    }, { once: true });
  } else {
    multiModal.style.display = 'none';
  }
}

// ——— КНОПКА "ЗАКРЫТЬ" ———
document.querySelector('#multiOrderModal button[onclick="closeMultiOrderModal()"]')
  ?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeMultiOrderModal();
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

// Перехват оформления заказа
window.startOrderChain = async function(orderId) {
  try {
    const res = await fetch(`/api/order/${orderId}?t=${Date.now()}`);
    const order = res.ok ? await res.json() : { id: orderId };

    // Добавляем в начало, максимум 3
    if (!activeOrders.find(o => o.id === order.id)) {
      activeOrders.unshift(order);
      if (activeOrders.length > 3) activeOrders.pop();
    }

    updateFloatingPill();
    
    // Автоматически открываем модалку при новом заказе
    if (document.getElementById('multiOrderModal').style.display !== 'flex') {
      openMultiOrderModal();
    } else {
      renderVerticalOrders();
    }
  } catch (err) {
    console.warn('Не удалось загрузить заказ', orderId);
    if (!activeOrders.find(o => o.id === orderId)) {
      activeOrders.unshift({ id: orderId });
      if (activeOrders.length > 3) activeOrders.pop();
    }
    updateFloatingPill();
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