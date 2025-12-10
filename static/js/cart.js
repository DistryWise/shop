
document.addEventListener('DOMContentLoaded', () => {

const getCartActionCount = () => Number(sessionStorage.getItem('cartSpamCount') || '0');
const incrementCartActionCount = () => {
    const count = getCartActionCount() + 1;
    sessionStorage.setItem('cartSpamCount', count);
    return count;
};
const resetCartActionCount = () => sessionStorage.removeItem('cartSpamCount');
const getCartBlockedUntil = () => Number(sessionStorage.getItem('cartBlockedUntil') || '0');
const setCartBlockedUntil = (time) => sessionStorage.setItem('cartBlockedUntil', time);

    const $ = (id) => document.getElementById(id);
    const $$ = (sel) => document.querySelector(sel);

    // === ЭЛЕМЕНТЫ ===
    const elements = {
    cartBtn: $('cartBtn'),
    cartCount: $('cartCount'),
    cartModal: $('cartModal'),
    miniCartItems: $('miniCartItems'),
    miniCartTotal: $('miniCartTotal'),
    closeCartModal: $('closeCartModal'),
    goToCartBtn: $('goToCartBtn'),
    
    // ✅ ДОБАВЬТЕ МОБИЛЬНЫЕ:
    mobileCartBtn: $('mobileCartBtn'),
    mobileCartSheet: $('mobileCartSheet'),
    mobileCartBackdrop: $('mobileCartBackdrop'),
    mobileMiniCartItems: $('mobileMiniCartItems'),
    mobileMiniCartTotal: $('mobileMiniCartTotal'),
    mobileCloseCart: $('mobileCloseCart'),
    mobileGoToCartBtn: $('mobileGoToCartBtn'),
    mobileCartHeaderCount: $('mobileCartHeaderCount')
};

    // === ПЕРЕМЕННЫЕ ===
    let cartItems = [];
    let clientCart = JSON.parse(localStorage.getItem('clientCart') || '[]');
    let hoverTimeout = null;
    let cartAnimating = false;
    let overlay = null;

    // === УТИЛИТЫ ===
const formatPrice = (cents) => {
    // Если явно передали 0 — показываем 0.00 ₽ (это для пустой корзины!)
    if (cents === 0) return '0.00 ₽';

    // Если null, undefined, пустая строка — тоже 0
    if (!cents) return '0.00 ₽';

    // Только если строка и содержит "по запросу" — оставляем как есть
    if (typeof cents === 'string' && cents.toLowerCase().includes('по запросу')) {
        return 'Цена по запросу';
    }

    const num = Number(cents);
    if (isNaN(num) || num <= 0) return '0.00 ₽';

    const rub = Math.floor(num / 100);
    const kop = (num % 100).toString().padStart(2, '0');

    return `${rub.toLocaleString('ru-RU')}.${kop} ₽`;
};
    const calculateTotal = (items) => {
        const totalCents = items.reduce((sum, i) => sum + (i.price_cents || 0) * i.quantity, 0);
        const count = items.reduce((s, i) => s + i.quantity, 0);
        return { count, totalCents, sumStr: formatPrice(totalCents) };
    };

    const escapeJS = (str) => str
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');

        const notifyCartUpdated = () => {
    const { count, sumStr } = calculateTotal(cartItems);
    
    // ✅ ДОБАВЬТЕ СИНХРОНИЗАЦИЮ МОБИЛЬНЫХ СЧЁТЧИКОВ:
    const desktopCount = document.getElementById('cartCount');
    const mobileBottomCount = document.getElementById('mobileCartCount');
    const mobileHeaderCount = document.getElementById('mobileCartHeaderCount');
    
    if (desktopCount) {
        desktopCount.textContent = count;
        desktopCount.classList.toggle('show', count > 0);
    }
    if (mobileBottomCount) {
        mobileBottomCount.textContent = count;
        mobileBottomCount.style.display = count > 0 ? 'flex' : 'none';
    }
    if (mobileHeaderCount) {
        mobileHeaderCount.textContent = count;
        mobileHeaderCount.style.display = count > 0 ? 'flex' : 'none';
    }
    
    // ⭐ СТАРЫЙ КОД:
    document.dispatchEvent(new CustomEvent('cartUpdated', {
        detail: { items: cartItems, count, total: sumStr }
    }));
};



    const showToast = (title, message = '', error = false, duration = 3000) => {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 10000;
            background: ${error ? 'rgba(255,107,107,0.96)' : 'rgba(0,0,0,0.9)'};
            color: white; padding: 1rem 1.5rem; border-radius: 12px;
            backdrop-filter: blur(10px); font-size: 0.95rem; font-weight: 500;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3); transform: translateX(120%);
            transition: transform 0.4s ease;
        `;
        toast.innerHTML = `<strong>${title}</strong><br><small>${message}</small>`;
        document.body.appendChild(toast);
        setTimeout(() => toast.style.transform = 'translateX(0)', 50);
        setTimeout(() => {
            toast.style.transform = 'translateX(120%)';
            setTimeout(() => toast.remove(), 400);
        }, duration);
    };

    // === API ЗАПРОСЫ ===
    const api = async (url, options = {}) => {
        try {
            const res = await fetch(url, {
                headers: { 'Content-Type': 'application/json' },
                ...options
            });
            return { ok: res.ok, data: await res.json() };
        } catch (e) {
            return { ok: false, data: { error: 'Нет сети' } };
        }
    };

window.addToCart = async function(id, type = 'product', quantity = 1) {
    // === Антиспам (оставляем как есть) ===
    const now = Date.now();
    const blockedUntil = Number(localStorage.getItem('cart_blocked_until') || '0');
    if (now < blockedUntil) {
        const sec = Math.ceil((blockedUntil - now) / 1000);
        showToast('Стоп!', `Подождите ${sec} сек.`, true);
        return;
    }

    let spamData = JSON.parse(localStorage.getItem('cart_spam_v2') || '[]');
    spamData = spamData.filter(t => now - t < 2000);
    if (spamData.length >= 5) {
        localStorage.setItem('cart_blocked_until', now + 30000);
        localStorage.removeItem('cart_spam_v2');
        showToast('Блокировка!', 'Слишком много действий. Ждите 30 сек.', true);
        return;
    }
    spamData.push(now);
    localStorage.setItem('cart_spam_v2', JSON.stringify(spamData));

    const btn = event?.target?.closest('button');
    if (btn) {
        btn.disabled = true;
        const oldText = btn.innerHTML;
        btn.innerHTML = 'Добавляем...';
    }

    try {
        const isLoggedIn = !!sessionStorage.getItem('user_id');

        if (isLoggedIn) {
            // Авторизованный — как было
            const res = await fetch('/api/cart/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    [type === 'product' ? 'product_id' : 'service_id']: id,
                    quantity
                })
            });
            const data = await res.json();
            if (!data.success) {
                showToast('Не добавлено', data.error || 'Ошибка', true);
                return;
            }
        } else {
            // ГОСТЬ — просто добавляем через сервер, БЕЗ clientCart!
            const res = await fetch('/api/cart/guest/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    [type === 'product' ? 'product_id' : 'service_id']: id,
                    quantity
                })
            });
            const data = await res.json();
            if (!data.success) {
                showToast('Не добавлено', data.error || 'Недостаточно товара', true);
                return;
            }
        }

        // ← ВСЁ! Больше НИЧЕГО НЕ ДЕЛАЕМ ВРУЧНУЮ
        await loadCart();
        showToast('Добавлено в корзину!');
        notifyCartUpdated();

    } catch (e) {
        showToast('Ошибка', 'Не удалось добавить', true);
    } finally {
        if (btn) {
            setTimeout(() => {
                btn.disabled = false;
                btn.innerHTML = oldText;
            }, 600);
        }
    }
};
// === УНИВЕРСАЛЬНЫЙ ПОВТОР ЗАКАЗА ИЗ АРХИВА ===
document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.repeat-order-btn');
    if (!btn) return;

    e.preventDefault();
    const id = btn.dataset.id;
    const type = btn.dataset.type || 'product';
    const title = btn.dataset.title || 'Товар';

    if (!id) return;

    // Визуально блокируем кнопку
    const oldText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Добавляем...';

    try {
        // Используем ТОТ ЖЕ addToCart, что и везде — с защитой!
        if (typeof window.addToCart === 'function') {
            await window.addToCart(id, type, 1);
        } else {
            // Если вдруг cart.js не загрузился — fallback
            await fetch('/api/cart/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [type === 'product' ? 'product_id' : 'service_id']: id, quantity: 1 })
            });
            showToast('Добавлено!', title);
            await loadCart();
        }
    } catch (err) {
        showToast('Ошибка добавления', '', true);
    } finally {
        setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = oldText;
        }, 600);
    }
});
// Остальные функции — без изменений (но можно тоже защитить, если хочешь)
window.removeFromCart = async (id, type = 'product') => {
    const isLoggedIn = !!sessionStorage.getItem('user_id');
    const url = isLoggedIn ? '/api/cart/update' : '/api/cart/guest/update';

    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                [type === 'product' ? 'product_id' : 'service_id']: id,
                quantity: 0
            })
        });
    } catch (err) {
        console.error('Ошибка удаления из корзины:', err);
    }

    await loadCart();           // ← обновляем с сервера
    notifyCartUpdated();        // ← обновляем мини-корзину и /bin
    showToast('Удалено');
};

// 2. updateQuantity — ГОСТЬ (правильная версия!)
window.updateQuantity = async (id, type, delta) => {
    const isLoggedIn = !!sessionStorage.getItem('user_id');

    if (isLoggedIn) {
        // Авторизованный — как было
        const item = cartItems.find(i => i.id === id && i.type === type);
        if (!item) return;
        const newQty = Math.max(0, item.quantity + delta);

        if (delta > 0 && item.max_available !== -1 && newQty > item.max_available) {
            showToast('Нельзя больше', `В наличии только ${item.max_available} шт.`, true);
            return;
        }

        const res = await fetch('/api/cart/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                [type === 'product' ? 'product_id' : 'service_id']: id,
                quantity: newQty
            })
        });
        const data = await res.json();
        if (data.success || newQty === 0) {
            await loadCart();
            notifyCartUpdated();
        } else {
            showToast('Ошибка', data.error || 'Не удалось обновить', true);
            await loadCart();
        }
    } else {
        // ГОСТЬ — используем правильный эндпоинт update!
        const item = cartItems.find(i => i.id === id && i.type === type);
        if (!item) return;

        const newQty = item.quantity + delta;

        if (delta > 0 && item.max_available !== -1 && newQty > item.max_available) {
            showToast('Нельзя больше', `В наличии только ${item.max_available} шт.`, true);
            return;
        }

        if (newQty <= 0) {
            // Удаляем
            await fetch('/api/cart/guest/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    [type === 'product' ? 'product_id' : 'service_id']: id,
                    quantity: 0
                })
            });
        } else {
            // Обновляем количество
            await fetch('/api/cart/guest/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    [type === 'product' ? 'product_id' : 'service_id']: id,
                    quantity: newQty
                })
            });
        }

        await loadCart();
        notifyCartUpdated();
    }
};

    // === ЗАГРУЗКА КОРЗИНЫ ===
window.loadCart = async () => {
    const isLoggedIn = !!sessionStorage.getItem('user_id');
    let items = [];

    if (isLoggedIn) {
        const { ok, data } = await api('/api/cart/get');
        if (ok && Array.isArray(data)) items = data;
    } else {
        // ← НОВОЕ: просто GET, без отправки clientCart!
        const { ok, data } = await api('/api/cart/guest/get');
        if (ok && Array.isArray(data)) items = data;
    }

    cartItems = items.map(i => ({
        id: i.id,
        title: i.title,
        type: i.type,
        quantity: i.quantity,
        price_cents: Number(i.price_cents) || 0,
        image_url: i.image_url || '/static/assets/no-image.png',
        max_available: i.max_available ?? -1
    }));

    renderMiniCart();
    notifyCartUpdated();
};

const renderMiniCart = () => {
    const { count, sumStr } = calculateTotal(cartItems);

    elements.cartCount.textContent = count;
    elements.cartCount.classList.toggle('show', count > 0);
    elements.miniCartTotal.textContent = `Итого: ${sumStr}`;

    elements.miniCartItems.innerHTML = cartItems.length === 0
        ? '<div style="padding:1.5rem;text-align:center;color:#888;font-size:0.9rem;">Корзина пуста</div>'
        : cartItems.map(item => {
            const max = item.max_available ?? -1;  // если нет поля — бесконечно
            const canAddMore = max === -1 || item.quantity < max;

            return `
    <div class="mini-cart-item" 
         onclick="openProductModal(${item.id}, '${item.type}')">
         
        <img src="${item.image_url}" 
             class="mini-cart-img" 
             onerror="this.src='/static/assets/no-image.png'">

        <div class="mini-cart-info">
            <h4>${escapeJS(item.title)}</h4>
            <div class="mini-cart-price">${formatPrice(item.price_cents || 0)}</div>
            
            ${max !== -1 ? `<small style="color:#888; font-size:0.85rem;">Осталось: ${max} шт.</small>` : ''}

            <div class="mini-quantity-controls">
                <button class="quantity-btn" 
                        onclick="event.stopPropagation(); updateQuantity(${item.id}, '${item.type}', -1)">−</button>
                <span>${item.quantity}</span>
                <button class="quantity-btn" 
                        onclick="event.stopPropagation(); updateQuantity(${item.id}, '${item.type}', 1)"
                        ${!canAddMore ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}>+</button>
            </div>
        </div>

        <button class="clear-cart-btn" 
                onclick="event.stopPropagation(); removeFromCart(${item.id}, '${item.type}')">
            <i class="fas fa-trash"></i>
        </button>
    </div>
`;
        }).join('');

    // === МОБИЛЬНАЯ ШТОРКА — ТОТ ЖЕ КОД ===
    if (elements.mobileMiniCartItems && elements.mobileCartSheet?.classList.contains('active')) {
        elements.mobileMiniCartItems.innerHTML = cartItems.length === 0
            ? '<div style="padding:3rem 1.5rem;text-align:center;color:#888;"><i class="fas fa-shopping-bag" style="font-size:3rem;margin-bottom:1rem;opacity:0.3;"></i><p>Корзина пуста</p></div>'
            : cartItems.map(item => {
                const max = item.max_available ?? -1;
                const canAddMore = max === -1 || item.quantity < max;

                return `
    <div class="sheet-cart-item" 
         onclick="openProductModal(${item.id}, '${item.type}')">
         
        <img src="${item.image_url}" 
             class="sheet-cart-img" 
             onerror="this.src='/static/assets/no-image.png'">

        <div class="sheet-cart-info">
            <h4 class="sheet-cart-title">${escapeJS(item.title)}</h4>
            <div class="sheet-cart-price">${formatPrice(item.price_cents || 0)}</div>
            
            ${max !== -1 ? `<small style="color:#888; font-size:0.85rem;">Осталось: ${max} шт.</small>` : ''}

            <div class="sheet-quantity-controls">
                <button class="quantity-btn" 
                        onclick="event.stopPropagation(); updateQuantity(${item.id}, '${item.type}', -1)">−</button>
                <span>${item.quantity}</span>
                <button class="quantity-btn" 
                        onclick="event.stopPropagation(); updateQuantity(${item.id}, '${item.type}', 1)"
                        ${!canAddMore ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}>+</button>
            </div>
        </div>

        <button class="clear-cart-btn" 
                onclick="event.stopPropagation(); removeFromCart(${item.id}, '${item.type}')">
            <i class="fas fa-trash"></i>
        </button>
    </div>
`;
            }).join('');

        if (elements.mobileMiniCartTotal) {
            elements.mobileMiniCartTotal.textContent = sumStr;
        }
    }
};
    // === АНИМАЦИЯ КОРЗИНЫ ===
    const openCartModal = () => {
        if (cartAnimating || !elements.cartModal) return;
        cartAnimating = true;

        // Создаём overlay один раз
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'cartOverlay';
            overlay.style.cssText = `
                position: fixed; inset: 0; background: transparent; z-index: 998;
                display: none; cursor: default;
            `;
            document.body.appendChild(overlay);
        }

        const icon = $('#cartIcon');
        if (icon) {
            const rect = icon.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            elements.cartModal.style.top = `${rect.bottom + scrollTop + 8}px`;
            elements.cartModal.style.right = `${window.innerWidth - rect.right}px`;
        }

        loadCart();
        elements.cartModal.classList.add('active');
        overlay.style.display = 'block';
        overlay.classList.add('active');

        setTimeout(() => { cartAnimating = false; }, 350);
    };

    const closeCartModal = () => {
        if (cartAnimating || !elements.cartModal) return;
        cartAnimating = true;

        elements.cartModal.classList.remove('active');
        overlay?.classList.remove('active');

        setTimeout(() => {
            overlay && (overlay.style.display = 'none');
            cartAnimating = false;
        }, 350);
    };

    // === ОПРЕДЕЛЕНИЕ ТАЧ-УСТРОЙСТВА ===
    const isTouchDevice = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // === ХОВЕР + КЛИК (РАЗДЕЛЕНИЕ ПО УСТРОЙСТВАМ) ===
    if (elements.cartBtn) {
        const isTouch = isTouchDevice();

        if (!isTouch) {
            // === ДЕСКТОП: HOVER + КЛИК ДЛЯ ЗАКРЫТИЯ ===
            let hoverIntent = false;

            const enterHandler = () => {
                hoverIntent = true;
                clearTimeout(hoverTimeout);
                if (!elements.cartModal.classList.contains('active') && !cartAnimating) {
                    openCartModal();
                }
            };

            const leaveHandler = () => {
                hoverIntent = false;
                hoverTimeout = setTimeout(() => {
                    if (!hoverIntent && elements.cartModal.classList.contains('active')) {
                        closeCartModal();
                    }
                }, 300);
            };

            elements.cartBtn.addEventListener('mouseenter', enterHandler);
            elements.cartBtn.addEventListener('mouseleave', leaveHandler);

            elements.cartModal?.addEventListener('mouseenter', () => {
                hoverIntent = true;
                clearTimeout(hoverTimeout);
            });

            elements.cartModal?.addEventListener('mouseleave', () => {
                hoverIntent = false;
                hoverTimeout = setTimeout(() => {
                    if (!hoverIntent && elements.cartModal.classList.contains('active')) {
                        closeCartModal();
                    }
                }, 200);
            });

            // Клик по кнопке — только закрытие (если открыто)
            elements.cartBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (elements.cartModal.classList.contains('active')) {
                    closeCartModal();
                }
            });

        } else {
            // === МОБИЛКА: ТОЛЬКО КЛИК ===
            elements.cartBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                elements.cartModal.classList.contains('active') ? closeCartModal() : openCartModal();
            });
        }

        



        // === ОБЩИЕ СОБЫТИЯ ===
        elements.closeCartModal?.addEventListener('click', closeCartModal);
        elements.goToCartBtn?.addEventListener('click', () => location.href = '/bin');

        // Клик вне корзины
                // Закрытие десктопной корзины по клику вне — но НЕ при активной мобильной шторке
        document.addEventListener('click', (e) => {
            if (elements.mobileCartSheet?.classList.contains('active')) return;

            const clickedInside = 
                elements.cartBtn?.contains(e.target) || 
                elements.cartModal?.contains(e.target);
            const clickedOverlay = e.target.id === 'cartOverlay';

            if (!clickedInside || clickedOverlay) {
                closeCartModal();
            }
        });
    }
    // === МОБИЛЬНАЯ ШТОРКА ===
// === МОБИЛЬНАЯ ШТОРКА — ФИНАЛЬНАЯ ВЕРСИЯ 2025 (БЕЗ БАГОВ) ===
// === МОБИЛЬНАЯ ШТОРКА — ПОСЛЕДНЯЯ ВЕРСИЯ, БЕЗ ЕДИНОГО БАГА ===
(() => {
  const sheet = document.getElementById('mobileCartSheet');
  const backdrop = document.getElementById('mobileCartBackdrop');
  const mobileBtn = document.getElementById('mobileCartBtn');
  if (!sheet || !backdrop || !mobileBtn) return;

  let startY = 0;
  let isDragging = false;
  let isClosing = false;
  const threshold = 150;

const openSheet = () => {
  if (sheet.classList.contains('active') || isClosing) return;
  isClosing = false;
  sheet.classList.add('active');
  document.body.classList.add('no-scroll');
  
  loadCart(); // ← ЭТА СТРОЧКА ВСЁ ИСПРАВИТ
};

  const closeSheet = () => {
    if (isClosing || !sheet.classList.contains('active')) return;
    isClosing = true;

    sheet.classList.remove('active');
    document.body.classList.remove('no-scroll');

    // ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
    // ЭТО РЕШЕНИЕ РАБОТАЕТ НА ВСЕХ УСТРОЙСТВАХ НАВСЕГДА
    setTimeout(() => {
      const dummy = document.createElement('div');
      dummy.style.position = 'fixed';
      dummy.style.top = '0';
      dummy.style.left = '-100px';
      dummy.style.width = '1px';
      dummy.style.height = '1px';
      document.body.appendChild(dummy);
      dummy.click();                    // ← имитируем клик вне кнопки
      dummy.remove();
    }, 50);
    // ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←

    const cleanup = () => {
      sheet.style.transition = '';
      sheet.style.transform = '';
      isClosing = false;
    };
    sheet.addEventListener('transitionend', cleanup, { once: true });
    setTimeout(cleanup, 600);
  };

  // Открытие
  mobileBtn.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    openSheet();
  });

  // Закрытие
  document.getElementById('mobileCloseCart')?.addEventListener('click', closeSheet);
  backdrop.addEventListener('click', closeSheet);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && sheet.classList.contains('active')) closeSheet();
  });

  // Свайп вниз
  const handleStart = e => {
    if (!sheet.classList.contains('active') || isClosing) return;
    startY = e.touches?.[0].clientY || e.clientY;
    isDragging = true;
    sheet.style.transition = 'none';
  };

  const handleMove = e => {
    if (!isDragging) return;
    const currentY = e.touches?.[0].clientY || e.clientY;
    const diff = currentY - startY;
    if (diff > 0) {
      e.preventDefault();
      sheet.style.transform = `translateY(${diff}px)`;
    }
  };

  const handleEnd = () => {
    if (!isDragging) return;
    isDragging = false;

    const diff = (event?.changedTouches?.[0]?.clientY || event?.clientY || startY) - startY;

    if (diff > threshold) {
      closeSheet(); // ← здесь срабатывает наш dummy-клик
    } else {
      sheet.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.9, 0.35, 1)';
      sheet.style.transform = 'translateY(0)';
      setTimeout(() => sheet.style.transition = '', 410);
    }
  };

  sheet.addEventListener('touchstart', handleStart, { passive: true });
  sheet.addEventListener('touchmove', handleMove, { passive: false });
  sheet.addEventListener('touchend', handleEnd);

  // Десктоп тест
  sheet.addEventListener('mousedown', handleStart);
  document.addEventListener('mousemove', e => isDragging && handleMove(e));
  document.addEventListener('mouseup', handleEnd);

  document.getElementById('mobileGoToCartBtn')?.addEventListener('click', () => {
    closeSheet();
    setTimeout(() => location.href = '/bin', 400);
  });

})();
    // === ИНИЦИАЛИЗАЦИЯ ===
    loadCart();
    document.addEventListener('userLoggedOut', () => {
        cartItems = [];
        clientCart = [];
        localStorage.removeItem('clientCart');

        // Обновляем визуально мини-корзину
        renderMiniCart();

        // Скрываем бейджик с количеством
        if (elements.cartCount) {
            elements.cartCount.textContent = '0';
            elements.cartCount.classList.remove('show');
        }

        // Обновляем итого
        if (elements.miniCartTotal) {
            elements.miniCartTotal.textContent = 'Итого: 0 ₽';
        }

        // Уведомляем большую корзину на /bin (чтобы и там почистилось)
        document.dispatchEvent(new CustomEvent('cartUpdated', {
            detail: { items: [], count: 0, total: '0 ₽' }
        }));

        // Закрываем модалку мини-корзины, если она открыта
        if (elements.cartModal?.classList.contains('active')) {
            closeCartModal();
        }

        console.log('Мини-корзина очищена при выходе из аккаунта');
    });

    // Дополнительная страховка: если sessionStorage почистился вручную
    const originalRemoveItem = sessionStorage.removeItem;
    sessionStorage.removeItem = function(key) {
        if (key === 'user_id' || key === 'token' || key === 'phone') {
            setTimeout(() => {
                if (!sessionStorage.getItem('user_id')) {
                    document.dispatchEvent(new CustomEvent('userLoggedOut'));
                }
            }, 50);
        }
        return originalRemoveItem.apply(this, arguments);
    };
    
});
