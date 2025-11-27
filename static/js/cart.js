
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
        goToCartBtn: $('goToCartBtn')
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

        // КРИТИЧНО: БЕРЁМ КАРТИНКУ ТОЧНО ТАК ЖЕ, КАК В АВТОКОМПЛИТЕ!
        let image_url = '/static/assets/no-image.png';

        // 1. Из модалки (если открыта)
        const modalImg = document.getElementById('modal-img') || document.getElementById('productImg');
        if (modalImg?.src && !modalImg.src.includes('no-image')) {
            image_url = modalImg.src;
        }
        // 2. Из карточки в каталоге
        else if (event?.target) {
            const card = event.target.closest('.card') || event.target.closest('.autocomplete-item');
            const img = card?.querySelector('img');
            if (img?.src && !img.src.includes('no-image')) {
                image_url = img.src;
            }
        }

        if (isLoggedIn) {
            await fetch('/api/cart/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    [type === 'product' ? 'product_id' : 'service_id']: id,
                    quantity,
                    image_url  // ← ВОТ ЭТО ВСЁ ИСПРАВИЛО
                })
            });
        } else {
            const existing = clientCart.find(i => i.id === id && i.type === type);
            if (existing) {
                existing.quantity += quantity;
            } else {
                clientCart.push({ id, type, quantity, image_url });
            }
            localStorage.setItem('clientCart', JSON.stringify(clientCart));
        }

        showToast('Добавлено в корзину!');
        await loadCart();
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
window.removeFromCart = async (id, type) => {
    const isLoggedIn = !!sessionStorage.getItem('user_id');

    if (isLoggedIn) {
        await api('/api/cart/update', {
            method: 'POST',
            body: JSON.stringify({
                [type === 'product' ? 'product_id' : 'service_id']: id,
                quantity: 0
            })
        });
    } else {
        clientCart = clientCart.filter(i => !(i.id === id && i.type === type));
        localStorage.setItem('clientCart', JSON.stringify(clientCart));
    }
    await loadCart();
    notifyCartUpdated();
    showToast('Удалено');
};

window.updateQuantity = async (id, type, delta) => {
    const isLoggedIn = !!sessionStorage.getItem('user_id');
    let newQty;

    if (isLoggedIn) {
        const item = cartItems.find(i => i.id === id && i.type === type);
        if (!item) return;
        newQty = Math.max(0, item.quantity + delta);
        await api('/api/cart/update', {
            method: 'POST',
            body: JSON.stringify({
                [type === 'product' ? 'product_id' : 'service_id']: id,
                quantity: newQty
            })
        });
    } else {
        const item = clientCart.find(i => i.id === id && i.type === type);
        if (!item) return;
        newQty = Math.max(0, item.quantity + delta);
        if (newQty === 0) {
            clientCart = clientCart.filter(i => !(i.id === id && i.type === type));
        } else {
            item.quantity = newQty;
        }
        localStorage.setItem('clientCart', JSON.stringify(clientCart));
    }
    await loadCart();
    notifyCartUpdated();
};

    window.updateQuantity = async (id, type, delta) => {
    const isLoggedIn = !!sessionStorage.getItem('user_id');
    let newQty;

    if (isLoggedIn) {
        const item = cartItems.find(i => i.id === id && i.type === type);
        if (!item) return;
        newQty = Math.max(0, item.quantity + delta);
        await api('/api/cart/update', {
            method: 'POST',
            body: JSON.stringify({
                [type === 'product' ? 'product_id' : 'service_id']: id,
                quantity: newQty
            })
        });
    } else {
        const item = clientCart.find(i => i.id === id && i.type === type);
        if (!item) return;
        newQty = Math.max(0, item.quantity + delta);
        if (newQty === 0) {
            clientCart = clientCart.filter(i => !(i.id === id && i.type === type));
        } else {
            item.quantity = newQty;
        }
        localStorage.setItem('clientCart', JSON.stringify(clientCart));
    }
    await loadCart();
    notifyCartUpdated();
};

    // === ЗАГРУЗКА КОРЗИНЫ ===
window.loadCart = async () => {
    const isLoggedIn = !!sessionStorage.getItem('user_id');
    let items = [];

    if (isLoggedIn) {
        const { ok, data } = await api('/api/cart/get');
        if (ok && Array.isArray(data)) items = data;
    } else {
        // Гость — отправляем список {id, type, quantity} → сервер возвращает полные данные
        const { ok, data } = await api('/api/cart/get-guest', {
            method: 'POST',
            body: JSON.stringify({ cart: clientCart })
        });
        if (ok && Array.isArray(data)) items = data;
    }

    cartItems = items.map(i => ({
        id: i.id || i.product_id || i.service_id,
        title: i.title,
        type: i.type,
        quantity: i.quantity,
        price_cents: Number(i.price_cents) || 0,
        image_url: i.image_url || '/static/assets/no-image.png',
        old_price_cents: i.old_price_cents || null
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
        : cartItems.map(item => `
            <div class="mini-cart-item">
                <img src="${item.image_url}" class="mini-cart-img" onerror="this.src='/static/assets/no-image.png'">
                <div class="mini-cart-info">
                    <h4>${escapeJS(item.title)}</h4>
                    <div class="mini-cart-price">${formatPrice(item.price_cents || 0)}</div>
                    <div class="mini-quantity-controls">
                        <button class="quantity-btn" onclick="updateQuantity(${item.id}, '${item.type}', -1)">−</button>
                        <span>${item.quantity}</span>
                        <button class="quantity-btn" onclick="updateQuantity(${item.id}, '${item.type}', 1)">+</button>
                    </div>
                </div>
                <button class="clear-cart-btn" onclick="removeFromCart(${item.id}, '${item.type}')">
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
