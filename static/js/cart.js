// static/js/cart.js
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
    window.addToCart = async (title, type = 'product', quantity = 1) => {
        const isLoggedIn = !!sessionStorage.getItem('user_id');

        if (!isLoggedIn) {
            const existing = clientCart.find(i => i.title === title && i.type === type);
            if (existing) {
                existing.quantity += quantity;
            } else {
                clientCart.push({ title, type, quantity, price_cents: 0, price_str: 'Цена по запросу', image_url: '/static/assets/no-image.png' });
            }
            localStorage.setItem('clientCart', JSON.stringify(clientCart));
            showToast('Добавлено в корзину');
            await loadCart();
            return;
        }

        const { ok, data } = await api('/api/cart/add', {
            method: 'POST',
            body: JSON.stringify(type === 'product' ? { product_title: title, quantity } : { service_title: title, quantity })
        });

        if (ok) {
            showToast('Добавлено в корзину');
            await loadCart();
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
    };

    // === ЗАГРУЗКА КОРЗИНЫ ===
    const loadCart = async () => {
        const isLoggedIn = !!sessionStorage.getItem('user_id');
        let items = [];

        if (isLoggedIn) {
            const { ok, data } = await api('/api/cart/get');
            items = ok ? data.map(i => ({
                ...i,
                image_url: i.image_url || '/static/assets/no-image.png'
            })) : [];
        } else {
            items = clientCart.map(i => ({
                ...i,
                image_url: i.image_url || '/static/assets/no-image.png'
            }));
        }

        cartItems = items;
        renderMiniCart();
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
});