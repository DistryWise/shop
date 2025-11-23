let cartActionCount = 0;
let cartActionTimer = null;
let cartBlockedUntil = 0;
document.addEventListener('DOMContentLoaded', () => {
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
        goToCartBtn: $('goToCartBtn')
    };

    // === ПЕРЕМЕННЫЕ ===
    let cartItems = [];
    let clientCart = JSON.parse(localStorage.getItem('clientCart') || '[]');
    let hoverTimeout = null;
    let cartAnimating = false;
    let overlay = null;

    // === АНТИСПАМ ДЛЯ МИНИ-КОРЗИНЫ (10+ действий за 30 сек → блок на 10 сек) ===
let cartActionCount = 0;
let cartActionTimer = null;
let cartBlockedUntil = 0;

const blockCartActions = () => {
  cartBlockedUntil = Date.now() + 10000; // 10 секунд блокировки
  showToast('Слишком быстро!', 'Подожди 10 секунд', true, 5000);

  // Визуально блокируем кнопки
  document.querySelectorAll('.quantity-btn, .clear-cart-btn').forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = '0.4';
    btn.style.pointerEvents = 'none';
  });

  // Разблокируем через 10 секунд
  setTimeout(() => {
    document.querySelectorAll('.quantity-btn, .clear-cart-btn').forEach(btn => {
      btn.disabled = false;
      btn.style.opacity = '';
      btn.style.pointerEvents = '';
    });
  }, 10000);
};

const registerCartAction = () => {
  const now = Date.now();

  // Если уже заблокировано — игнорируем
  if (now < cartBlockedUntil) return false;

  cartActionCount++;

  // Сбрасываем счётчик через 30 секунд
  clearTimeout(cartActionTimer);
  cartActionTimer = setTimeout(() => {
    cartActionCount = 0;
  }, 30000);

  // Если больше 10 действий — блок
  if (cartActionCount > 10) {
    blockCartActions();
    cartActionCount = 0; // сбрасываем, чтобы не спамить алертами
    return false;
  }

  return true;
};

    // === УТИЛИТЫ ===
    const formatPrice = (cents) => {
        const rub = Math.floor(cents / 100);
        const kop = cents % 100;
        return `${rub.toLocaleString('ru-RU')}.${kop.toString().padStart(2, '0')} ₽`;
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
        document.dispatchEvent(new CustomEvent('cartUpdated', {
            detail: {
                items: cartItems,
                count,
                total: sumStr
            }
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

    // === ДОБАВЛЕНИЕ В КОРЗИНУ ===
window.addToCart = async (title, type = 'product', image_url = '/static/assets/no-image.png', price_str = 'Цена по запросу', quantity = 1) => {
  const isLoggedIn = !!sessionStorage.getItem('user_id');

  if (!isLoggedIn) {
    const existing = clientCart.find(i => i.title === title && i.type === type);
    if (existing) {
      existing.quantity += quantity;
    } else {
      clientCart.push({ title, type, quantity, price_cents: 0, price_str, image_url });
    }
    localStorage.setItem('clientCart', JSON.stringify(clientCart));
    showToast('Добавлено в корзину');
    await loadCart();
    notifyCartUpdated();
    return;
  }

        const { ok, data } = await api('/api/cart/add', {
            method: 'POST',
            body: JSON.stringify(type === 'product' ? { product_title: title, quantity } : { service_title: title, quantity })
        });

        if (ok) {
            showToast('Добавлено в корзину');
            await loadCart();
            notifyCartUpdated();
        } else {
            showToast('Ошибка', data.error || 'Не удалось добавить', true);
        }
    };

    window.removeFromCart = async (title, type) => {
        const isLoggedIn = !!sessionStorage.getItem('user_id');
        if (isLoggedIn) {
            await api('/api/cart/update', {
                method: 'POST',
                body: JSON.stringify({ title, type, quantity: 0 })
            });
        } else {
            clientCart = clientCart.filter(i => !(i.title === title && i.type === type));
            localStorage.setItem('clientCart', JSON.stringify(clientCart));
        }
        await loadCart();
        notifyCartUpdated();
        showToast('Удалено');
    };

    window.updateQuantity = async (title, type, delta) => {
        const isLoggedIn = !!sessionStorage.getItem('user_id');
        let newQty;

        if (isLoggedIn) {
            const item = cartItems.find(i => i.title === title && i.type === type);
            if (!item) return;
            newQty = Math.max(0, item.quantity + delta);
            if (newQty === 0) return removeFromCart(title, type);
            await api('/api/cart/update', {
                method: 'POST',
                body: JSON.stringify({ title, type, quantity: newQty })
            });
        } else {
            const item = clientCart.find(i => i.title === title && i.type === type);
            if (!item) return;
            newQty = Math.max(0, item.quantity + delta);
            if (newQty === 0) {
                clientCart = clientCart.filter(i => !(i.title === title && i.type === type));
            } else {
                item.quantity = newQty;
            }
            localStorage.setItem('clientCart', JSON.stringify(clientCart));
        }
        await loadCart();
        notifyCartUpdated();
    };

    // === ЗАГРУЗКА КОРЗИНЫ ===
// === ЗАГРУЗКА КОРЗИНЫ — ФИНАЛЬНАЯ ВЕРСИЯ 2025 ===
const loadCart = async () => {
    const isLoggedIn = !!sessionStorage.getItem('user_id');
    let items = [];

    if (isLoggedIn) {
        // Авторизованный пользователь — берём с сервера
        const { ok, data } = await api('/api/cart/get');
        if (ok && Array.isArray(data)) {
            items = data.map(i => ({
                ...i,
                // Сервер может присылать image или image_url — берём любой
                image_url: i.image_url || i.image || '/static/assets/no-image.png'
            }));
        }
    } else {
        // Неавторизованный — берём из localStorage (clientCart)
        // ВАЖНО: НЕ ПЕРЕТИРАЕМ image_url — он уже сохранён при добавлении!
        items = clientCart.map(i => ({
            ...i,
            // Просто копируем как есть. Если нет — ставим заглушку
            image_url: i.image_url || '/static/assets/no-image.png'
        }));
    }

    cartItems = items;
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
            : cartItems.map(item => `
                <div class="mini-cart-item">
                    <img src="${item.image_url}" class="mini-cart-img" onerror="this.src='/static/assets/no-image.png'">
                    <div class="mini-cart-info">
                        <h4>${item.title}</h4>
                        <div class="mini-cart-price">${item.price_str}</div>
                        <div class="mini-quantity-controls">
                            <button class="quantity-btn" onclick="updateQuantity('${escapeJS(item.title)}', '${item.type}', -1)">−</button>
                            <span>${item.quantity}</span>
                            <button class="quantity-btn" onclick="updateQuantity('${escapeJS(item.title)}', '${item.type}', 1)">+</button>
                        </div>
                    </div>
                    <button class="clear-cart-btn" onclick="removeFromCart('${escapeJS(item.title)}', '${item.type}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `).join('');
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

        

        // И вызывай её везде после изменения корзины:
        const loadCart = async () => {
            // ... загрузка ...
            cartItems = items;
            renderMiniCart();
            notifyCartUpdated(); // ← добавь
        };

        // === ОБЩИЕ СОБЫТИЯ ===
        elements.closeCartModal?.addEventListener('click', closeCartModal);
        elements.goToCartBtn?.addEventListener('click', () => location.href = '/bin');

        // Клик вне корзины
        document.addEventListener('click', (e) => {
            const clickedInside = elements.cartBtn?.contains(e.target) || elements.cartModal?.contains(e.target);
            const clickedOverlay = e.target.id === 'cartOverlay';
            if (!clickedInside || clickedOverlay) {
                closeCartModal();
            }
        });
    }

    // === ИНИЦИАЛИЗАЦИЯ ===
    loadCart();
        // === АКТИВАЦИЯ АНТИСПАМА НА КНОПКАХ КОРЗИНЫ ===
    // Перехватываем ВСЕХ кликов по кнопкам изменения количества и удаления
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.quantity-btn, .clear-cart-btn');
        if (!btn) return;

        // Если сейчас кулдаун — просто игнорируем клик
        if (Date.now() < cartBlockedUntil) {
            e.preventDefault();
            e.stopImmediatePropagation();
            return false;
        }

        // Регистрируем действие (считаем +1 к счётчику)
        if (!registerCartAction()) {
            // registerCartAction вернёт false, если превышен лимит → уже вызван блок
            e.preventDefault();
            e.stopImmediatePropagation();
            return false;
        }

        // Если всё ок — ничего не делаем, клик пройдёт в оригинальный onclick
    }, true); // ← capturing phase, чтобы сработает ДО onclick в разметке
});
