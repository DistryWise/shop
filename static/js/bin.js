
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
document.body.insertAdjacentHTML('beforeend', `
<div id="activeOrdersLimitModal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.88); backdrop-filter:blur(28px); z-index:99999; justify-content:center; align-items:center; padding:16px;">
  <div style="background:rgba(20,20,35,0.98); border-radius:28px; max-width:420px; width:100%; text-align:center; padding:2.5rem 2rem; box-shadow:0 40px 100px rgba(0,0,0,0.8); border:1px solid rgba(255,255,255,0.1);">
    <div style="width:90px; height:90px; margin:0 auto 1.5rem; background:#ff4444; border-radius:50%; display:flex; align-items:center; justify-content:center;">
      <i class="fas fa-exclamation-triangle" style="font-size:3rem; color:white;"></i>
    </div>
    <h2 style="margin:0 0 1rem; font-size:1.9rem; color:#fff;">Лимит активных заказов</h2>
    <p style="margin:0 0 2rem; color:#ccc; font-size:1.1rem; line-height:1.5;">
      У вас уже есть <strong>активные заказа</strong>.<br>
      Дождитесь завершения хотя бы одного, чтобы оформить новый.
    </p>
    <button onclick="document.getElementById('activeOrdersLimitModal').style.display='none'" 
            style="background:#00ff95; color:#000; border:none; padding:1rem 2.5rem; border-radius:22px; font-size:1.1rem; font-weight:700; cursor:pointer; width:100%;">
      Понятно, жду
    </button>
    <div style="margin-top:1.5rem;">
      <button onclick="openMultiOrderModal(); document.getElementById('activeOrdersLimitModal').style.display='none'" 
              style="background:transparent; color:#00ff95; border:none; font-size:1rem; cursor:pointer; text-decoration:underline;">
        Посмотреть текущие заказы →
      </button>
    </div>
  </div>
</div>
`);

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
document.getElementById('openArchiveBtn')?.addEventListener('click', async () => {
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
        if (allOrders.length === 0) {
            loadOrders(true);
        } else {
            renderOrders();
        }
    }
});

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

    // Показываем лоадер только при первой загрузке
    if (currentPage === 1 && allOrders.length === 0) {
        list.innerHTML = '<div style="text-align:center;padding:3rem;color:#aaa;">Загружаем заказы...</div>';
    }

    try {
        const res = await fetch(`/api/user_orders?page=${currentPage}&per=${PER_PAGE}&t=${Date.now()}`, {
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

        // Показать/скрыть "Загрузить ещё"
        loadMoreContainer.style.display = newOrders.length === PER_PAGE ? 'block' : 'none';

        // Обновляем бейдж активных заказов
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

    let filtered = allOrders.filter(order => {
        if (currentTab === 'active') return !['completed', 'cancelled'].includes(order.status);
        if (currentTab === 'completed') return ['completed', 'cancelled'].includes(order.status);
        return true;
    });

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
    const productImages = {};
    const serviceImages = {};

    // Заполняем кэш из уже загруженных данных (они у тебя где-то есть в глобале)
    if (window.allProducts) {
        window.allProducts.forEach(p => {
            if (p.image_urls && p.image_urls.length > 0) {
                productImages[p.id] = p.image_urls[0];
            }
        });
    }
    if (window.allServices) {
        window.allServices.forEach(s => {
            if (s.image_urls && s.image_urls.length > 0) {
                serviceImages[s.id] = s.image_urls[0];
            }
        });
    }

    list.innerHTML = filtered.map(order => {
        const statusInfo = {
            pending:    { text: 'Ожидает оплаты',   color: '#ffa726' },
            processing: { text: 'В обработке',      color: '#00ff95' },
            shipping:   { text: 'В доставке',       color: '#00bfff' },
            completed:  { text: 'Завершён',         color: '#4ade80' },
            cancelled:  { text: 'Отменён',          color: '#ff6b6b' },
        };
        const current = statusInfo[order.status] || { text: order.status, color: '#aaa' };
        const isActive = !['completed', 'cancelled'].includes(order.status);

        const safeReason = order.cancel_reason
            ? String(order.cancel_reason)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\n/g, '<br>')
            : '';

        return `
            <div class="cart-item archive-item clickable-order" data-order-id="${order.id}">
                <div style="width:100%;">
                    <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:1rem;">
                        <div>
                            <h3 style="margin:0;font-size:1.4rem;font-weight:600;">
                                Заказ ${order.display_id || '№' + order.id}
                                <span style="color:${current.color};font-size:0.9rem;margin-left:0.8rem;font-weight:500;">
                                    ${current.text}
                                </span>
                            </h3>
                            <div style="color:#888;font-size:0.9rem;">
                                ${new Date(order.created_at).toLocaleString('ru-RU')}
                            </div>
                        </div>
                        <div style="text-align:right;font-size:1.6rem;font-weight:700;color:#00ff95;">
                            ${order.total_str}
                        </div>
                    </div>

                    ${isActive ? `
                    <div class="mini-status-chain" id="archive-chain-${order.id}">
                        <div class="mini-step ${order.status !== 'pending' ? 'active' : ''}">
                            <div class="mini-dot"></div><div class="mini-label">Принят</div>
                        </div>
                        <div class="mini-connector ${['shipping','completed'].includes(order.status) ? 'active' : ''}"></div>
                        <div class="mini-step ${['shipping','completed'].includes(order.status) ? 'active' : ''}">
                            <div class="mini-dot"></div><div class="mini-label">В обработке</div>
                        </div>
                        <div class="mini-connector ${order.status === 'completed' ? 'active' : ''}"></div>
                        <div class="mini-step ${order.status === 'completed' ? 'active' : ''}">
                            <div class="mini-dot"></div><div class="mini-label">Готово</div>
                        </div>
                    </div>` : ''}

                    ${!isActive ? `
                    <div style="margin:2rem 0;text-align:center;">
                        <i class="fas ${order.status === 'completed' ? 'fa-check-circle' : 'fa-times-circle'}"
                           style="font-size:3.2rem;color:${current.color};opacity:0.9;"></i>
                    </div>` : ''}

                    <div style="margin-top:1.5rem;display:grid;gap:0.8rem;">
                        ${order.items.slice(0, 3).map(item => {
                            let imgSrc = '/static/assets/no-image.png';

                            if (item.item_type === 'product' && productImages[item.item_id]) {
                                imgSrc = productImages[item.item_id];
                            } else if (item.item_type === 'service' && serviceImages[item.item_id]) {
                                imgSrc = serviceImages[item.item_id];
                            } else if (item.item_type === 'service') {
                                imgSrc = '/static/assets/service-placeholder.png'; // можно сделать свою заглушку
                            }

                            return `
                                <div style="display:flex;align-items:center;gap:1rem;padding:0.8rem;background:rgba(255,255,255,0.05);border-radius:14px;">
                                    <img src="${imgSrc}" 
                                         style="width:48px;height:48px;border-radius:10px;object-fit:cover;background:#222;"
                                         onerror="this.src='/static/assets/no-image.png'">
                                    <div style="flex:1;">
                                        <div style="font-weight:600;">${item.title}</div>
                                        <div style="color:#aaa;font-size:0.9rem;">
                                            ${item.quantity} × ${item.price_str || (item.price_cents/100).toFixed(2) + ' ₽'}
                                        </div>
                                    </div>
                                    <button onclick="event.stopPropagation();addToCart('${(item.title||'').replace(/'/g, "\\'")}', '${item.item_type || 'product'}')"
                                            style="padding:0.5rem 1rem;background:#fff;color:#000;border-radius:12px;font-weight:600;font-size:0.85rem;">
                                        Повторить
                                    </button>
                                </div>
                            `;
                        }).join('')}
                        ${order.items.length > 3 ? 
                            `<div style="text-align:center;color:#888;padding:0.6rem;">…и ещё ${order.items.length - 3}</div>` : ''}
                    </div>

                    <!-- КОМПАКТНЫЙ БЛОК ОТМЕНЫ -->
                    ${order.status === 'cancelled' && safeReason ? `
                    <div style="
                        margin: 1.3rem 0 0;
                        padding: 0.9rem 1.1rem;
                        background: rgba(255,68,68,0.08);
                        border: 1px solid rgba(255,68,68,0.2);
                        border-radius: 14px;
                        color: #ff6b6b;
                        font-size: 0.9rem;
                        line-height: 1.5;
                    ">
                        <div style="font-weight:700;font-size:0.94rem;color:#ff4444;margin-bottom:0.3rem;display:flex;align-items:center;gap:0.4rem;">
                            <i class="fas fa-info-circle"></i> Причина отмены
                        </div>
                        <div style="white-space:pre-wrap;opacity:0.92;">
                            ${safeReason}
                        </div>
                    </div>
                    ` : ''}
                </div>
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
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = btn.dataset.tab;
        renderOrders();
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


// КАРУСЕЛЬ — РАБОТАЕТ ИДЕАЛЬНО (первый слайд активен сразу, остальные — только по свайпу)
if (window.matchMedia("(max-width: 1024px)").matches) {
  const carousel = document.getElementById('instaCarousel');
  const bars = document.querySelectorAll('.insta-progress > div');

  const update = () => {
    const index = Math.round(carousel.scrollLeft / carousel.clientWidth);
    bars.forEach((bar, i) => {
      bar.classList.toggle('active', i === index);
    });
  };

  // Инициализация: первый слайд активен сразу
  update();

  // При скролле
  carousel.addEventListener('scroll', () => requestAnimationFrame(update));

  // При ресайзе/повороте
  window.addEventListener('resize', update);
}


const themeToggle = document.getElementById('theme-toggle');
const html = document.documentElement;

// Автоопределение системной темы + сохранение
if (localStorage.getItem('theme') === 'light' || 
   (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: light)').matches)) {
  html.setAttribute('data-theme', 'light');
  if (themeToggle) themeToggle.checked = true;
} else {
  html.setAttribute('data-theme', 'dark');
  if (themeToggle) themeToggle.checked = false;
}

themeToggle?.addEventListener('change', () => {
  if (themeToggle.checked) {
    html.setAttribute('data-theme', 'light');
    localStorage.setItem('theme', 'light');
  } else {
    html.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
  }
});

// УНИВЕРСАЛЬНЫЙ АНТИСПАМ 2025 — РАБОТАЕТ НА ВСЕХ КНОПКАХ "В КОРЗИНУ" И ИЗМЕНЕНИЯ КОЛИЧЕСТВА
// Защищает от спама: + / – / удалить / любые onclick="addToCart(...)" / кнопки с классами
const GlobalAddToCartProtection = (() => {
  const STORAGE_KEY = 'cart_flood_protection_2025';
  const COOLDOWN_MS = 20000;    // 20 сек блок после спама
  const MAX_CLICKS = 9;         // сколько быстрых кликов разрешено

  let clickCount = 0;
  let resetTimer = null;
  let blockedUntil = 0;

  // Загружаем состояние
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      blockedUntil = data.blockedUntil || 0;
    }
  } catch (e) {}

  const block = () => {
    blockedUntil = Date.now() + COOLDOWN_MS;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ blockedUntil }));

    // Красивый красный алерт с таймером
    const alert = document.createElement('div');
    alert.id = 'global-cart-flood-alert';
    alert.innerHTML = `
      <i class="fas fa-hand-paper"></i>
      <div>
        <strong>Слишком быстро!</strong><br>
        <small>Подождите <span class="timer">20</span> сек</small>
      </div>
    `;
    Object.assign(alert.style, {
      position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
      background: 'linear-gradient(135deg,#ff453a,#ff2d55)', color: 'white',
      padding: '16px 32px', borderRadius: '26px', fontSize: '1.15rem',
      fontWeight: '600', boxShadow: '0 20px 50px rgba(255,45,85,0.5)',
      backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', gap: '14px',
      zIndex: '999999', animation: 'slideDown 0.5s ease'
    });
    document.body.appendChild(alert);

    let seconds = 20;
    const timerSpan = alert.querySelector('.timer');
    const interval = setInterval(() => {
      seconds--;
      timerSpan.textContent = seconds;
      if (seconds <= 0) {
        clearInterval(interval);
        alert.remove();
      }
    }, 1000);

    setTimeout(() => alert.remove(), COOLDOWN_MS + 1000);
  };

  return {
    check() {
      const now = Date.now();
      if (blockedUntil > now) return false;

      clickCount++;
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => { clickCount = 0; }, 10000);

      if (clickCount > MAX_CLICKS) {
        block();
        clickCount = 0;
        return false;
      }
      return true;
    }
  };
})();

// УНИВЕРСАЛЬНЫЙ ПЕРЕХВАТЧИК — ЛОВИТ ВСЁ
document.addEventListener('click', function(e) {
  const target = e.target.closest(
    'button, .add-to-cart-btn, .buy-btn, .apple-qty-btn, .apple-remove-btn, ' +
    '.quantity-btn, .clear-cart-btn, [onclick*="addToCart("]'
  );

  if (!target) return;

  // Проверяем, это действие с корзиной?
  const onclick = target.getAttribute('onclick') || '';
  const isCartAction = 
    onclick.includes('addToCart(') ||
    target.classList.contains('apple-qty-btn') ||
    target.classList.contains('apple-remove-btn') ||
    target.classList.contains('quantity-btn') ||
    target.classList.contains('clear-cart-btn') ||
    target.classList.contains('add-to-cart-btn') ||
    target.classList.contains('buy-btn');

  if (isCartAction && !GlobalAddToCartProtection.check()) {
    e.preventDefault();
    e.stopImmediatePropagation();
    e.stopPropagation();
    return false;
  }
}, true); // true = capture phase → срабатывает раньше всех остальных обработчиков

// Анимация алерта
document.head.insertAdjacentHTML('beforeend', `

`);

// Открытие/закрытие шторки
document.getElementById('openSidebarMenu')?.addEventListener('click', () => {
  document.getElementById('mobileSidebar').classList.add('active');
  document.body.classList.add('sidebar-open');
});

document.getElementById('closeSidebar')?.addEventListener('click', () => {
  document.getElementById('mobileSidebar').classList.remove('active');
  document.body.classList.remove('sidebar-open');
});

// Закрытие по клику вне шторки
document.addEventListener('click', (e) => {
  const sidebar = document.getElementById('mobileSidebar');
  if (sidebar.classList.contains('active') && 
      !e.target.closest('.mobile-sidebar') && 
      !e.target.closest('#openSidebarMenu')) {
    sidebar.classList.remove('active');
    document.body.classList.remove('sidebar-open');
  }
});



// СВАЙП ВЛЕВО — ЗАКРЫТИЕ ШТОРКИ ИЗ ЛЮБОЙ ТОЧКИ ЭКРАНА (Telegram / Wildberries 2025)
(() => {
  const sidebar = document.getElementById('mobileSidebar');
  if (!sidebar) return;

  let startX = 0;
  let currentX = 0;
  let isDragging = false;

  const close = () => {
    sidebar.classList.remove('active');
    document.body.classList.remove('sidebar-open');
    // Сбрасываем стили
    sidebar.style.transition = '';
    sidebar.style.transform = '';
  };

  const handleTouchStart = (e) => {
    if (!sidebar.classList.contains('active')) return;

    startX = e.touches[0].clientX;
    currentX = startX;
    isDragging = true;

    // Отключаем плавность для мгновенной реакции
    sidebar.style.transition = 'none';
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;

    currentX = e.touches[0].clientX;
    const diff = currentX - startX;

    // Разрешаем тянуть только влево (и только если начали с левой части или тянем влево)
    if (diff < 0 || startX < window.innerWidth * 0.3) {
      e.preventDefault(); // критично для плавного свайпа
      sidebar.style.transform = `translateX(${Math.max(diff, -window.innerWidth)}px)`;
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    isDragging = false;

    const diff = currentX - startX;

    // Если проскроллили больше 100px влево — закрываем
    if (diff < -100) {
      sidebar.style.transition = 'transform 0.28s cubic-bezier(0.22, 0.88, 0.38, 1)';
      sidebar.style.transform = 'translateX(-100%)';
      
      setTimeout(() => {
        close();
      }, 280);
    } else {
      // Возвращаем на место
      sidebar.style.transition = 'transform 0.32s cubic-bezier(0.2, 0.8, 0.4, 1)';
      sidebar.style.transform = 'translateX(0)';
      
      setTimeout(() => {
        sidebar.style.transition = '';
      }, 320);
    }
  };

  // Вешаем на весь документ — чтобы ловить свайп из любой зоны
  document.addEventListener('touchstart', handleTouchStart, { passive: true });
  document.addEventListener('touchmove', handleTouchMove, { passive: false });
  document.addEventListener('touchend', handleTouchEnd);

  // Опционально: поддержка мыши на планшетах/ноутбуках с тачскрином
  document.addEventListener('mousedown', handleTouchStart);
  document.addEventListener('mousemove', (e) => {
 if (isDragging) handleTouchMove({ touches: [{ clientX: e.clientX }] });
   });
  document.addEventListener('mouseup', handleTouchEnd);
})();

// КАРУСЕЛЬ — РАБОТАЕТ ИДЕАЛЬНО (первый слайд активен сразу, остальные — только по свайпу)
if (window.matchMedia("(max-width: 1024px)").matches) {
  const carousel = document.getElementById('instaCarousel');
  const bars = document.querySelectorAll('.insta-progress > div');

  const update = () => {
    const index = Math.round(carousel.scrollLeft / carousel.clientWidth);
    bars.forEach((bar, i) => {
      bar.classList.toggle('active', i === index);
    });
  };

  // Инициализация: первый слайд активен сразу
  update();

  // При скролле
  carousel.addEventListener('scroll', () => requestAnimationFrame(update));

  // При ресайзе/повороте
  window.addEventListener('resize', update);
}



// УНИВЕРСАЛЬНЫЙ ПЕРЕХВАТЧИК — ЛОВИТ ВСЁ
document.addEventListener('click', function(e) {
  const target = e.target.closest(
    'button, .add-to-cart-btn, .buy-btn, .apple-qty-btn, .apple-remove-btn, ' +
    '.quantity-btn, .clear-cart-btn, [onclick*="addToCart("]'
  );

  if (!target) return;

  // Проверяем, это действие с корзиной?
  const onclick = target.getAttribute('onclick') || '';
  const isCartAction = 
    onclick.includes('addToCart(') ||
    target.classList.contains('apple-qty-btn') ||
    target.classList.contains('apple-remove-btn') ||
    target.classList.contains('quantity-btn') ||
    target.classList.contains('clear-cart-btn') ||
    target.classList.contains('add-to-cart-btn') ||
    target.classList.contains('buy-btn');

  if (isCartAction && !GlobalAddToCartProtection.check()) {
    e.preventDefault();
    e.stopImmediatePropagation();
    e.stopPropagation();
    return false;
  }
}, true); // true = capture phase → срабатывает раньше всех остальных обработчиков

// Анимация алерта
document.head.insertAdjacentHTML('beforeend', `
<style>
@keyframes slideDown {
  from { transform: translateX(-50%) translateY(-100px); opacity: 0; }
  to   { transform: translateX(-50%) translateY(0); opacity: 1; }
}
#global-cart-flood-alert i { font-size: 1.8rem; }
</style>
`);

// Открытие/закрытие шторки
document.getElementById('openSidebarMenu')?.addEventListener('click', () => {
  document.getElementById('mobileSidebar').classList.add('active');
  document.body.classList.add('sidebar-open');
});

document.getElementById('closeSidebar')?.addEventListener('click', () => {
  document.getElementById('mobileSidebar').classList.remove('active');
  document.body.classList.remove('sidebar-open');
});

// Закрытие по клику вне шторки
document.addEventListener('click', (e) => {
  const sidebar = document.getElementById('mobileSidebar');
  if (sidebar.classList.contains('active') && 
      !e.target.closest('.mobile-sidebar') && 
      !e.target.closest('#openSidebarMenu')) {
    sidebar.classList.remove('active');
    document.body.classList.remove('sidebar-open');
  }
});

// СВАЙП ВЛЕВО — ЗАКРЫТИЕ ШТОРКИ ИЗ ЛЮБОЙ ТОЧКИ ЭКРАНА (Telegram / Wildberries 2025)
(() => {
  const sidebar = document.getElementById('mobileSidebar');
  if (!sidebar) return;

  let startX = 0;
  let currentX = 0;
  let isDragging = false;

  const close = () => {
    sidebar.classList.remove('active');
    document.body.classList.remove('sidebar-open');
    // Сбрасываем стили
    sidebar.style.transition = '';
    sidebar.style.transform = '';
  };

  const handleTouchStart = (e) => {
    if (!sidebar.classList.contains('active')) return;

    startX = e.touches[0].clientX;
    currentX = startX;
    isDragging = true;

    // Отключаем плавность для мгновенной реакции
    sidebar.style.transition = 'none';
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;

    currentX = e.touches[0].clientX;
    const diff = currentX - startX;

    // Разрешаем тянуть только влево (и только если начали с левой части или тянем влево)
    if (diff < 0 || startX < window.innerWidth * 0.3) {
      e.preventDefault(); // критично для плавного свайпа
      sidebar.style.transform = `translateX(${Math.max(diff, -window.innerWidth)}px)`;
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    isDragging = false;

    const diff = currentX - startX;

    // Если проскроллили больше 100px влево — закрываем
    if (diff < -100) {
      sidebar.style.transition = 'transform 0.28s cubic-bezier(0.22, 0.88, 0.38, 1)';
      sidebar.style.transform = 'translateX(-100%)';
      
      setTimeout(() => {
        close();
      }, 280);
    } else {
      // Возвращаем на место
      sidebar.style.transition = 'transform 0.32s cubic-bezier(0.2, 0.8, 0.4, 1)';
      sidebar.style.transform = 'translateX(0)';
      
      setTimeout(() => {
        sidebar.style.transition = '';
      }, 320);
    }
  };

  // Вешаем на весь документ — чтобы ловить свайп из любой зоны
  document.addEventListener('touchstart', handleTouchStart, { passive: true });
  document.addEventListener('touchmove', handleTouchMove, { passive: false });
  document.addEventListener('touchend', handleTouchEnd);

  // Опционально: поддержка мыши на планшетах/ноутбуках с тачскрином
  document.addEventListener('mousedown', handleTouchStart);
  document.addEventListener('mousemove', (e) => {
 if (isDragging) handleTouchMove({ touches: [{ clientX: e.clientX }] });
   });
  document.addEventListener('mouseup', handleTouchEnd);
})();

// КАРУСЕЛЬ — РАБОТАЕТ ИДЕАЛЬНО (первый слайд активен сразу, остальные — только по свайпу)
if (window.matchMedia("(max-width: 1024px)").matches) {
  const carousel = document.getElementById('instaCarousel');
  const bars = document.querySelectorAll('.insta-progress > div');

  const update = () => {
    const index = Math.round(carousel.scrollLeft / carousel.clientWidth);
    bars.forEach((bar, i) => {
      bar.classList.toggle('active', i === index);
    });
  };

  // Инициализация: первый слайд активен сразу
  update();

  // При скролле
  carousel.addEventListener('scroll', () => requestAnimationFrame(update));

  // При ресайзе/повороте
  window.addEventListener('resize', update);
}

