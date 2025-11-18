// bin.js — ПОЛНЫЙ, ИСПРАВЛЕННЫЙ, С УСЛУГАМИ В ПОИСКЕ + КОРЗИНЕ + ВСЕМ ФУНКЦИОНАЛОМ
document.addEventListener('DOMContentLoaded', () => {
    // === DOM ЭЛЕМЕНТЫ ===
    const $ = (id) => document.getElementById(id);
    const $$ = (sel) => document.querySelector(sel);

    const elements = {
        cartBadge: $('cartBadge'),
        toast: $('cartToast'),
        toastTitle: $('toastTitle'),
        toastMessage: $('toastMessage'),
        cartItemsEl: $('cartItems'),
        cartSummary: $('cartSummary'),
        totalPriceEl: $('totalPrice'),
        miniCartTotal: $('miniCartTotal'),
        clearCartBtn: $('clearCartBtn'),
        feedbackSubmitBtn: $('feedbackSubmitBtn'),
        checkoutBtn: $('checkoutBtn'),
        authBtn: $('authBtn'),
        authText: $('authText'),
        modal: $('authModal'),
        stepPhone: $('stepPhone'),
        stepCode: $('stepCode'),
        phoneInput: $('phoneInput'),
        codeInput: $('codeInput'),
        sendCodeBtn: $('sendCodeBtn'),
        verifyCodeBtn: $('verifyCodeBtn'),
        sentPhone: $('sentPhone'),
        countrySelector: $('countrySelector'),
        selectedFlag: $('countrySelector')?.querySelector('.flag'),
        selectedCode: $('countrySelector')?.querySelector('.code'),
        agreePolicy: $('agreePolicy'),
        subscribeEmail: $('subscribeEmail'),
        codeError: $('codeError'),
        searchWrapper: $$('.search-wrapper'),
        searchContainer: $('searchContainer'),
        searchInput: $('searchInput'),
        autocompleteList: $('autocompleteList'),
        archiveModal: $('archiveModal'),
        ordersList: $('ordersList'),
        productModal: $('productModal'),
        productTitle: $('productTitle'),
        productImg: $('productImg'),
        productDesc: $('productDesc'),
        productPrice: $('productPrice'),
        addToCartModal: $('addToCartModal'),
        cartModal: $('cartModal'),
        closeCartModal: $('closeCartModal'),
        goToCartBtn: $('goToCartBtn'),
        feedbackModal: $('feedbackModal'),
        feedbackForm: $('feedbackForm'),
        feedbackToast: $('feedbackToast'),
        openFeedbackBtn: $('openFeedbackBtn'),
        checkoutModal: $('checkoutModal'),
        confirmOrderBtn: $('confirmOrderBtn'),
        fullName: $('fullName'),
        checkoutPhone: $('checkoutPhone'),
        reviewModal: $('reviewModal'),
        reviewItemName: $('reviewItemName'),
        reviewStars: $$('#reviewStars'),
        submitReview: $('submitReview'),
        skipReview: $('skipReview'),
        reviewText: $('reviewText'),
        closeModal: $('closeModal'),
        closeCheckout: $('closeCheckout'),
        closeReview: $('closeReview'),
        resendCode: $('resendCode'),
        openArchiveBtn: $('openArchiveBtn'),
        closeArchive: $('closeArchive'),
        servicesContainer: $('servicesContainer'),
        miniCartItems: $('miniCartItems')
    };

    // === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
    let cartItems = [];
    let clientCart = JSON.parse(localStorage.getItem('clientCart') || '[]');
    let reviewQueue = [];
    let currentReviewItem = null;
    let selectedStars = 0;
    let currentCountryCode = '+7';
    let currentMask = ' (___) ___-__-__';
    let searchTimeout = null;
    let hoverTimeout = null;

    // Кэши
    const cache = {
        products: new Map(),
        services: new Map(),
        allServices: null,
        session: null
    };

    // === УТИЛИТЫ ===
    const showToast = (title, message = '', error = false, duration = 3000) => {
        elements.toastTitle.textContent = title;
        elements.toastMessage.textContent = message;
        elements.toast.style.background = error ? 'rgba(255,107,107,0.96)' : 'var(--modal-bg)';
        elements.toast.classList.add('show');
        clearTimeout(elements.toast.hideTimeout);
        elements.toast.hideTimeout = setTimeout(() => elements.toast.classList.remove('show'), duration);
    };

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

    const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    const escapeJS = (str) => str
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');

    const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const safePlaceholder = () => '/static/assets/no-image.png';

    // === ИСПРАВЛЕННЫЙ parseImageUrls ===
    const parseImageUrls = (urls) => {
        if (!urls) return ['/static/assets/no-image.png'];
        let arr = [];
        if (Array.isArray(urls)) {
            arr = urls;
        } else if (typeof urls === 'string') {
            arr = urls.split(',').map(u => u.trim()).filter(Boolean);
        }
        return arr.length > 0
            ? arr.map(u => u.startsWith('/') ? u : `/static/uploads/services/${u}`)
            : ['/static/assets/no-image.png'];
    };

    // === API КЭШИРОВАНИЕ (только для полного списка) ===
    const apiCache = async (key, url, ttl = 60000) => {
        const now = Date.now();
        if (cache[key]?.timestamp && now - cache[key].timestamp < ttl) {
            return cache[key].data;
        }
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error();
            const data = await res.json();
            cache[key] = { data, timestamp: now };
            return data;
        } catch (e) {
            return cache[key]?.data || [];
        }
    };

    // === ЗАГРУЗКА ДЕТАЛЕЙ ТОВАРА/УСЛУГИ ===
// === НОВЫЙ loadItemDetails С ПОИСКОМ ===
    const buildItemResult = (item, type) => {
        const urls = item.image_urls || item.image_url;
        const image_url = parseImageUrls(urls)[0] || '/static/assets/no-image.png';

        const price_cents = type === 'product'
            ? parseInt(item.price_str.replace(/\D/g, '')) || 0
            : parseInt(item.price.replace(/\D/g, '')) * 100 || 0;

        return {
            id: item.id,
            title: item.title,
            price_cents,
            price_str: item.price_str || item.price || 'Цена по запросу',
            image_url,
            type
        };
    };

    const loadItemDetails = async (title, type) => {
        const cacheKey = `${type}:${title}`;
        if (type === 'product' && cache.products.has(cacheKey)) return cache.products.get(cacheKey);
        if (type === 'service' && cache.services.has(cacheKey)) return cache.services.get(cacheKey);

        // 1. Из полного списка
        let data = [];
        try {
            data = await apiCache(type + 's', type === 'product' ? '/api/products' : '/api/services');
        } catch (e) {}

        let item = data.find(x => x.title === title);
        if (item) {
            const result = buildItemResult(item, type);
            (type === 'product' ? cache.products : cache.services).set(cacheKey, result);
            return result;
        }

        // 2. Fallback: поиск по title
        try {
            const res = await fetch(`${type === 'product' ? '/api/products' : '/api/services'}?search=${encodeURIComponent(title)}`);
            if (res.ok) {
                const results = await res.json();
                item = results.find(x => x.title === title);
                if (item) {
                    const result = buildItemResult(item, type);
                    (type === 'product' ? cache.products : cache.services).set(cacheKey, result);
                    return result;
                }
            }
        } catch (e) {
            console.warn('Fallback search failed:', e);
        }

        return null;
    };
    // === ОБРАБОТКА ФОРМЫ ОБРАТНОЙ СВЯЗИ ===
    // === ГЛОБАЛЬНЫЕ ДЛЯ ТАЙМЕРА ===
let cooldownInterval = null;

// === ФУНКЦИЯ: Запуск таймера из retry_after ===
const startCooldown = (seconds) => {
    const cooldownEl = document.getElementById('feedbackCooldown');
    const progressEl = document.getElementById('cooldownProgress');
    const textEl = document.getElementById('cooldownText');
    const submitBtn = document.getElementById('feedbackSubmitBtn');

    if (!cooldownEl || !progressEl || !textEl || !submitBtn) return;

    cooldownEl.style.display = 'block';
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-clock"></i> Подождите...';

    let remaining = seconds;

    const update = () => {
        if (remaining <= 0) {
            clearInterval(cooldownInterval);
            cooldownEl.style.display = 'none';
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Отправить';
            return;
        }

        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        textEl.textContent = `Подождите ${mins}:${secs.toString().padStart(2, '0')}`;
        progressEl.style.width = `${(remaining / seconds) * 100}%`;
        remaining--;
    };

    update();
    clearInterval(cooldownInterval);
    cooldownInterval = setInterval(update, 1000);
};

    // === ОБРАБОТКА ФОРМЫ ===
    elements.feedbackForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        // === СБРАСЫВАЕМ ОШИБКИ ===
        const clearError = (field) => {
            field.style.borderColor = 'rgba(255,255,255,0.2)';
            field.classList.remove('error');
        };

        const showFieldError = (field, message) => {
            field.style.borderColor = '#ff6b6b';
            field.classList.add('error');
            field.focus();
            showToast('Ошибка', message, true);
        };

        const nameInput = elements.feedbackForm.querySelector('[name="name"]');
        const emailInput = elements.feedbackForm.querySelector('[name="email"]');
        const messageInput = elements.feedbackForm.querySelector('[name="message"]');

        [nameInput, emailInput, messageInput].forEach(clearError);

        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const message = messageInput.value.trim();

        // === ВАЛИДАЦИЯ ПО ОЧЕРЕДИ ===
        if (!name) { showFieldError(nameInput, 'Заполните ФИО'); return; }
        if (name.length < 2) { showFieldError(nameInput, 'ФИО слишком короткое'); return; }
        if (!email) { showFieldError(emailInput, 'Введите email'); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showFieldError(emailInput, 'Введите email с @'); return; }
        if (!message) { showFieldError(messageInput, 'Напишите сообщение'); return; }
        if (message.length < 10) { showFieldError(messageInput, 'Сообщение слишком короткое'); return; }

        // === ОТПРАВКА ===
        let res;
        try {
            res = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, message })
            });
        } catch (err) {
            console.error('Network error:', err);
            showToast('Ошибка сети', 'Проверьте подключение', true);
            return;
        }

        // === ПАРСИМ JSON ТОЛЬКО ПОСЛЕ УСПЕШНОГО fetch ===
        let data;
        try {
            data = await res.json();
        } catch (err) {
            console.error('JSON parse error:', err);
            showToast('Ошибка сервера', 'Некорректный ответ', true);
            return;
        }

        // === ОБРАБОТКА ОТВЕТА ===
        if (res.ok && data.success) {
            showToast('Спасибо!', data.message || 'Сообщение отправлено', false, 3000);
            elements.feedbackModal.style.display = 'none';
            elements.feedbackForm.reset();
            elements.feedbackPhone.textContent = '—';
        } 
        else if (res.status === 429 && data.retry_after) {
            startCooldown(data.retry_after);
            showToast('Защита от спама', `Подождите ${data.retry_after} сек.`, true);
        }
        else {
            showToast('Ошибка', data.error || 'Попробуйте позже', true);
        }
    });



    // === ДОБАВЛЕНИЕ В КОРЗИНУ ===
    window.addToCart = async (title, type = 'product', quantity = 1) => {
        const isLoggedIn = !!sessionStorage.getItem('user_id');

        // === ЕСЛИ НЕ АВТОРИЗОВАН — РАБОТАЕМ С localStorage ===
        // === ЕСЛИ НЕ АВТОРИЗОВАН ===
        if (!isLoggedIn) {
            let details = null;

            // 1. Пробуем из кэша
            try {
                details = await loadItemDetails(title, type);
            } catch (e) {}

            // 2. Если не нашли — делаем отдельный запрос по title (как в поиске)
            if (!details) {
                try {
                    const url = type === 'product' 
                        ? `/api/products?search=${encodeURIComponent(title)}`
                        : `/api/services?search=${encodeURIComponent(title)}`;
                    const res = await fetch(url);
                    if (res.ok) {
                        const results = await res.json();
                        const item = results.find(x => x.title === title);
                        if (item) {
                            const urls = item.image_urls || item.image_url;
                            const image_url = parseImageUrls(urls)[0] || '/static/assets/no-image.png';
                            details = {
                                title: item.title,
                                type,
                                price_cents: type === 'product'
                                    ? parseInt(item.price_str.replace(/\D/g, '')) || 0
                                    : parseInt(item.price.replace(/\D/g, '')) * 100 || 0,
                                price_str: item.price_str || item.price || 'Цена по запросу',
                                image_url
                            };
                        }
                    }
                } catch (e) {
                    console.warn('Fallback fetch failed:', e);
                }
            }

            // 3. Фолбэк, если вообще ничего
            if (!details) {
                details = {
                    title,
                    type,
                    price_cents: 0,
                    price_str: 'Цена по запросу',
                    image_url: '/static/assets/no-image.png'
                };
            }

            // 4. Сохраняем ВСЕГДА с image_url
            const existing = clientCart.find(i => i.title === title && i.type === type);
            if (existing) {
                existing.quantity += quantity;
                existing.image_url = details.image_url; // ← ОБНОВЛЯЕМ КАРТИНКУ!
            } else {
                clientCart.push({
                    title: details.title,
                    type: details.type,
                    quantity: quantity,
                    price_cents: details.price_cents,
                    price_str: details.price_str,
                    image_url: details.image_url
                });
            }

            localStorage.setItem('clientCart', JSON.stringify(clientCart));
            showToast('Добавлено!', '', false, 2000);
            await loadCart();

            const { count } = calculateTotal(clientCart);
            elements.cartBadge.textContent = count;
            elements.cartBadge.classList.toggle('show', count > 0);
            return;
        }

        // === ЕСЛИ АВТОРИЗОВАН — ОТПРАВЛЯЕМ НА СЕРВЕР ===
        const payload = type === 'product'
            ? { product_title: title, quantity }
            : { service_title: title, quantity };

        try {
            const res = await fetch('/api/cart/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Ошибка сервера');
            }

            showToast('Добавлено!', '', false, 2000);
            await loadCart();
        } catch (e) {
            console.error('Add to cart error:', e);
            showToast('Ошибка добавления', e.message, true);
        }
    };
    window.removeFromCart = async (title, type) => {
        const isLoggedIn = !!sessionStorage.getItem('user_id');
        if (isLoggedIn) {
            await fetch('/api/cart/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, type, quantity: 0 })
            });
        } else {
            clientCart = clientCart.filter(i => !(i.title === title && i.type === type));
            localStorage.setItem('clientCart', JSON.stringify(clientCart));
        }
        await Promise.all([loadCart(), loadMiniCart()]);
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
            await fetch('/api/cart/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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

        await Promise.all([loadCart(), loadMiniCart()]);
    };

    // === БЕЗОПАСНЫЙ mergeClientCart() ===
    const mergeClientCart = async () => {
        if (clientCart.length === 0) return;

        const validItems = [];
        for (const item of clientCart) {
            try {
                const exists = await loadItemDetails(item.title, item.type);
                if (exists) {
                    validItems.push({
                        title: item.title,
                        type: item.type,
                        quantity: item.quantity,
                        price_cents: item.price_cents || 0,
                        price_str: item.price_str || 'Цена по запросу',
                        image_url: item.image_url || '/static/assets/no-image.png'
                    });
                }
            } catch (e) {
                console.warn(`Не удалось загрузить деталь для ${item.title} (${item.type}):`, e);
                // Продолжаем с другими товарами
            }
        }

        if (validItems.length === 0) {
            localStorage.removeItem('clientCart');
            clientCart = [];
            return;
        }

        try {
            const res = await fetch('/api/cart/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cart: validItems })
            });

            if (res.ok) {
                localStorage.removeItem('clientCart');
                clientCart = [];
                showToast('Корзина синхронизирована!', '', false, 2000);
            } else {
                const err = await res.json();
                console.warn('Ошибка синхронизации корзины:', err);
                showToast('Не все товары синхронизированы', '', true);
            }
        } catch (e) {
            console.error('Критическая ошибка при mergeClientCart:', e);
            showToast('Ошибка сети при синхронизации', 'Попробуйте позже', true);
        }
    };

    // === ЗАГРУЗКА КОРЗИНЫ ===
    // === ОБНОВЛЁННЫЙ loadCart() — ГРУЗИТ КОРЗИНУ + АВТОМАТИЧЕСКИ ОБНОВЛЯЕТ МИНИ-КОРЗИНУ ===
    const loadCart = async () => {
        const isLoggedIn = !!sessionStorage.getItem('user_id');
        let items = [];

        if (isLoggedIn) {
            try {
                const res = await fetch('/api/cart/get');
                const serverItems = res.ok ? await res.json() : [];
                items = serverItems.map(i => ({
                    ...i,
                    image_url: i.image_url || '/static/assets/no-image.png'
                }));
            } catch (e) {
                console.error('Ошибка загрузки корзины с сервера:', e);
            }
        } else {
            items = clientCart.map(item => ({
                title: item.title,
                type: item.type,
                quantity: item.quantity,
                price_cents: item.price_cents || 0,
                price_str: item.price_str || 'Цена по запросу',
                image_url: item.image_url || '/static/assets/no-image.png'
            }));
        }

        // Синхронизируем глобальный массив
        cartItems = items;

        // Обновляем общую информацию
        const { count, sumStr } = calculateTotal(items);
        elements.cartSummary.textContent = `${count} товар(ов) • ${sumStr}`;
        elements.totalPriceEl.textContent = sumStr;
        elements.checkoutBtn.disabled = count === 0;

        // Рендерим большую корзину
        elements.cartItemsEl.innerHTML = items.length === 0
            ? '<div class="empty-cart">Корзина пуста</div>'
            : items.map(item => `
                <div class="cart-item">
                    <img src="${item.image_url}" class="cart-item-img" alt="${escapeHtml(item.title)}"
                        onerror="this.src='/static/assets/no-image.png'">
                    <div class="cart-item-info">
                        <h3>${escapeHtml(item.title)}</h3>
                        <div class="cart-item-price">${item.price_str}</div>
                        <div class="quantity-controls">
                            <button class="quantity-btn mini-quantity-btn" onclick="updateQuantity('${escapeJS(item.title)}', '${item.type}', -1)">-</button>
                            <span class="quantity-value">${item.quantity}</span>
                            <button class="quantity-btn mini-quantity-btn" onclick="updateQuantity('${escapeJS(item.title)}', '${item.type}', 1)">+</button>
                        </div>
                    </div>
                    <button class="clear-cart-btn" onclick="removeFromCart('${escapeJS(item.title)}', '${item.type}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `).join('');

        // АВТОМАТИЧЕСКИ обновляем мини-корзину
        loadMiniCart();
    };

    // === ОБНОВЛЁННЫЙ loadMiniCart() — СИНХРОННЫЙ, БЕЗ AWAIT ===
    const loadMiniCart = () => {
        const items = cartItems;
        const { count, sumStr } = calculateTotal(items);

        // Обновляем бейдж и сумму
        elements.miniCartTotal.textContent = `Итого: ${sumStr}`;
        elements.cartBadge.textContent = count;
        elements.cartBadge.classList.toggle('show', count > 0);

        if (!elements.miniCartItems) return;

        elements.miniCartItems.innerHTML = items.length === 0
            ? '<div class="empty-cart" style="padding:1.5rem;text-align:center;">Корзина пуста</div>'
            : items.map(item => `
                <div class="mini-cart-item" style="position:relative;padding-right:40px;">
                    <img src="${item.image_url}" class="mini-cart-img" onerror="this.src='/static/assets/no-image.png'">
                    <div class="mini-cart-info">
                        <h4>${escapeHtml(item.title)}</h4>
                        <div class="mini-cart-price">${item.price_str}</div>
                        <div class="mini-quantity-controls" style="display:flex;gap:0.5rem;align-items:center;">
                            <button class="quantity-btn mini-quantity-btn" onclick="updateQuantity('${escapeJS(item.title)}', '${item.type}', -1)">-</button>
                            <span style="min-width:1.5rem;text-align:center;">${item.quantity}</span>
                            <button class="quantity-btn mini-quantity-btn" onclick="updateQuantity('${escapeJS(item.title)}', '${item.type}', 1)">+</button>
                        </div>
                    </div>
                    <button class="clear-cart-btn" style="position:absolute;right:0.5rem;top:50%;transform:translateY(-50%);width:32px;height:32px;background:rgba(255,107,107,0.1);border:none;border-radius:8px;"
                            onclick="removeFromCart('${escapeJS(item.title)}', '${item.type}')">
                        <i class="fas fa-trash" style="color:#ff6b6b;"></i>
                    </button>
                </div>
            `).join('');
    };

    // === АРХИВ ===
    elements.openArchiveBtn?.addEventListener('click', async () => {
        if (!sessionStorage.getItem('user_id')) {
            elements.modal.classList.add('active');
            resetAuthModal();
            showToast('Войдите для просмотра архива', '', true);
            return;
        }

        elements.archiveModal.style.display = 'flex';
        elements.ordersList.innerHTML = '<div class="empty-cart">Загрузка...</div>';

        try {
            const res = await fetch('/api/user_archived_orders');
            const orders = res.ok ? await res.json() : [];

            if (orders.length === 0) {
                elements.ordersList.innerHTML = '<div class="empty-cart">Архив пуст</div>';
                return;
            }

            elements.ordersList.innerHTML = orders.map(order => {
                const itemsHtml = order.items.map(i => {
                    // === КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: parseImageUrls() ===
                    const imageUrl = i.image_url || '/static/assets/no-image.png';

                    return `
                        <div class="archive-item clickable" 
                            style="cursor:pointer;display:flex;align-items:center;gap:0.5rem;padding:0.5rem;background:rgba(255,255,255,0.05);border-radius:12px;margin:0.3rem 0;"
                            onclick="event.stopPropagation(); openArchiveItem('${escapeJS(i.title)}', '${i.type}')">
                            <img src="${imageUrl}" style="width:36px;height:36px;object-fit:cover;border-radius:8px;" 
                                onerror="this.src='/static/assets/no-image.png'">
                            <div style="flex:1;">
                                <div style="font-weight:600;">${escapeHtml(i.title)}</div>
                                <div style="font-size:0.85rem;color:var(--text-secondary);">
                                    ×${i.quantity} — ${i.price_str}
                                </div>
                            </div>
                            <button class="btn-primary" style="padding:0.4rem 0.8rem;font-size:0.8rem;"
                                    onclick="event.stopPropagation(); addToCart('${escapeJS(i.title)}', '${i.type}')">
                                Повторно
                            </button>
                        </div>
                    `;
                }).join('');

                const [statusText, statusColor, statusBg] = order.status_label;

                return `
                    <div class="cart-item" style="padding:1rem;background:rgba(255,255,255,0.05);border-radius:16px;margin-bottom:1rem;">
                        <div style="flex:1;">
                            <h3 style="margin:0 0 0.5rem;font-size:1.1rem;">Заказ #${order.id}</h3>
                            <div style="font-size:0.85rem;color:#aaa;margin-bottom:0.5rem;">
                                ${new Date(order.created_at).toLocaleString('ru', { dateStyle: 'short', timeStyle: 'short' })}
                            </div>
                            <div style="background:${statusColor};color:${statusBg};padding:0.3rem 0.8rem;border-radius:12px;display:inline-block;font-size:0.8rem;font-weight:600;">
                                ${statusText}
                            </div>
                            <div style="margin:1rem 0;">${itemsHtml}</div>
                            <div style="font-weight:700;color:var(--primary);font-size:1.2rem;">
                                Итого: ${order.total_str}
                            </div>
                            ${order.cancel_reason ? `
                            <div style="margin-top:0.5rem;color:#ff6b6b;font-size:0.9rem;background:rgba(255,107,107,0.1);padding:0.5rem;border-radius:8px;">
                                <strong>Причина отмены:</strong> ${escapeHtml(order.cancel_reason)}
                            </div>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        } catch (e) {
            console.error('Ошибка загрузки архива:', e);
            elements.ordersList.innerHTML = '<div class="empty-cart">Ошибка загрузки</div>';
        }
    });

    elements.closeArchive?.addEventListener('click', () => {
        elements.archiveModal.style.display = 'none';
    });

    elements.archiveModal?.addEventListener('click', (e) => {
        if (e.target === elements.archiveModal) elements.archiveModal.style.display = 'none';
    });

    // === ПОИСК — ИСПРАВЛЕННЫЙ ===
    if (elements.searchWrapper) {
        const fetchSuggestions = async (query) => {
            if (!query.trim()) {
                elements.autocompleteList.classList.remove('active');
                return;
            }

            try {
                const [prodRes, servRes] = await Promise.all([
                    fetch(`/api/products?search=${encodeURIComponent(query)}`),
                    fetch(`/api/services?search=${encodeURIComponent(query)}`)
                ]);

                const products = prodRes.ok ? await prodRes.json() : [];
                const services = servRes.ok ? await servRes.json() : [];

                const all = [
                    ...products.map(p => ({
                        title: p.title,
                        price_str: p.price_str,
                        image_url: parseImageUrls(p.image_urls)[0],
                        type: 'product'
                    })),
                    ...services.map(s => {
                        const img = parseImageUrls(s.image_urls)[0];
                        const price_cents = parseInt(s.price.replace(/\D/g, '')) * 100 || 0;
                        return {
                            title: s.title,
                            price_str: s.price,
                            price_cents,
                            image_url: img,
                            type: 'service'
                        };
                    })
                ].slice(0, 6);

                elements.autocompleteList.innerHTML = all.length === 0
                    ? `<div style="padding:1rem;text-align:center;color:var(--text-secondary);">Ничего не найдено</div>`
                    : all.map(item => {
                        const highlighted = item.title.replace(
                            new RegExp(`(${escapeRegExp(query)})`, 'gi'),
                            '<strong>$1</strong>'
                        );
                        return `
                            <div class="autocomplete-item" onclick="selectAutocomplete('${escapeJS(item.title)}', '${item.type}')">
                                ${item.type === 'product'
                                    ? `<img src="${item.image_url}" style="width:32px;height:32px;object-fit:cover;border-radius:6px;" onerror="this.src='/static/assets/no-image.png'">`
                                    : `<img src="${item.image_url}" style="width:32px;height:32px;object-fit:cover;border-radius:6px;background:rgba(0,210,255,0.1);" onerror="this.src='/static/assets/no-image.png'">`
                                }
                                <span>${highlighted}</span>
                                <small style="margin-left:auto;color:var(--text-secondary);">${item.price_str}</small>
                                <div class="autocomplete-add" onclick="event.stopPropagation(); addToCart('${escapeJS(item.title)}', '${item.type}');">
                                    <i class="fas fa-shopping-cart"></i>
                                </div>
                            </div>
                        `;
                    }).join('');

                elements.autocompleteList.classList.add('active');
            } catch (e) {
                console.error(e);
                elements.autocompleteList.innerHTML = `<div style="padding:1rem;text-align:center;color:var(--text-secondary);">Ошибка поиска</div>`;
                elements.autocompleteList.classList.add('active');
            }
        };

        elements.searchWrapper.addEventListener('mouseenter', () => {
            clearTimeout(searchTimeout);
            elements.searchContainer.classList.add('active');
            setTimeout(() => elements.searchInput.focus(), 300);
        });

        elements.searchWrapper.addEventListener('mouseleave', () => {
            if (!elements.searchInput.value.trim()) {
                searchTimeout = setTimeout(() => {
                    elements.searchContainer.classList.remove('active');
                    elements.autocompleteList.classList.remove('active');
                }, 300);
            }
        });

        elements.searchInput.addEventListener('input', () => {
            clearTimeout(window.searchInputTimeout);
            const query = elements.searchInput.value.trim();
            if (query.length === 0) {
                elements.autocompleteList.classList.remove('active');
                return;
            }
            window.searchInputTimeout = setTimeout(() => fetchSuggestions(query), 200);
        });

        document.addEventListener('click', (e) => {
            if (!elements.searchWrapper.contains(e.target)) {
                elements.searchContainer.classList.remove('active');
                elements.autocompleteList.classList.remove('active');
            }
        });

        elements.autocompleteList.addEventListener('click', e => e.stopPropagation());
    }

    window.selectAutocomplete = (title, type) => {
        elements.searchInput.value = '';
        elements.autocompleteList.classList.remove('active');
        openProduct(title, type);
    };

    window.openProduct = async (title, type = 'product') => {
    const item = await loadItemDetails(title, type);
    if (!item) return showToast('Не найдено', '', true);

    const modal = document.getElementById('productModal');
    const img = document.getElementById('productImg');

    // СБРАСЫВАЕМ СТАРУЮ КАРТИНКУ
    img.src = '/static/assets/no-image.png';

    // ЗАПОЛНЯЕМ
    document.getElementById('productTitle').textContent = item.title;
    document.getElementById('productPrice').textContent = item.price_str;

    // НОВАЯ КАРТИНКА
    img.onload = () => {
        modal.classList.add('active');
    };
    img.onerror = () => {
        img.src = '/static/assets/no-image.png';
        modal.classList.add('active');
    };
    img.src = item.image_url;

    // КНОПКА
    document.getElementById('addToCartModal').onclick = () => {
        addToCart(item.title, type);
        modal.classList.remove('active');
    };
    };

    // === КОРЗИНА МОДАЛКА ===
    const cartBtn = $('cartBtn');
    if (cartBtn) {
        cartBtn.addEventListener('mouseenter', () => {
            clearTimeout(hoverTimeout);
            loadMiniCart();
            elements.cartModal.classList.add('active');
        });

        cartBtn.addEventListener('mouseleave', () => {
            hoverTimeout = setTimeout(() => elements.cartModal.classList.remove('active'), 300);
        });
    }

    elements.cartModal?.addEventListener('mouseenter', () => clearTimeout(hoverTimeout));
    elements.cartModal?.addEventListener('mouseleave', () => {
        hoverTimeout = setTimeout(() => elements.cartModal.classList.remove('active'), 200);
    });

    cartBtn?.addEventListener('click', e => {
        e.stopPropagation();
        loadMiniCart();
        elements.cartModal.classList.toggle('active');
    });

    elements.closeCartModal?.addEventListener('click', () => elements.cartModal.classList.remove('active'));
    elements.goToCartBtn?.addEventListener('click', () => location.href = '/bin');

    document.addEventListener('click', (e) => {
        if (!cartBtn?.contains(e.target) && !elements.cartModal?.contains(e.target)) {
            elements.cartModal.classList.remove('active');
        }
    });

    // === АВТОРИЗАЦИЯ ===
    const resetAuthModal = () => {
        elements.stepPhone.style.display = 'block';
        elements.stepCode.style.display = 'none';
        elements.phoneInput.value = '';
        elements.codeInput.value = '';
        elements.codeError.classList.remove('show');
        elements.codeInput.classList.remove('error');
        elements.countrySelector?.classList.remove('active');
        updateSendButton();
    };

    const updateSendButton = () => {
        const digits = elements.phoneInput.value.replace(/\D/g, '').length;
        elements.sendCodeBtn.disabled = !(digits === 10 && elements.agreePolicy.checked);
    };

    if (elements.countrySelector) {
        const dropdown = elements.countrySelector.querySelector('.country-dropdown');
        let lastKey = null;
        let lastKeyTime = 0;
        let currentIndex = -1;

        elements.countrySelector.addEventListener('click', e => {
            e.stopPropagation();
            dropdown.classList.toggle('active');
        });

        document.querySelectorAll('.country-option').forEach(opt => {
            opt.addEventListener('click', e => {
                e.stopPropagation();
                currentCountryCode = opt.dataset.code;
                currentMask = opt.dataset.mask;
                elements.selectedFlag.textContent = opt.dataset.flag;
                elements.selectedCode.textContent = currentCountryCode;
                elements.phoneInput.value = '';
                elements.phoneInput.placeholder = currentMask.replace(/_/g, '9');
                dropdown.classList.remove('active');
                document.querySelectorAll('.country-option').forEach(o => o.classList.remove('highlighted'));
                lastKey = null;
                currentIndex = -1;
                updateSendButton();
            });
        });

        elements.phoneInput.addEventListener('input', () => {
            let digits = elements.phoneInput.value.replace(/\D/g, '').slice(0, 10);
            let result = '';
            let j = 0;
            for (let i = 0; i < currentMask.length && j < digits.length; i++) {
                result += currentMask[i] === '_' ? digits[j++] : currentMask[i];
            }
            elements.phoneInput.value = result;
            updateSendButton();
        });
    }

    elements.agreePolicy?.addEventListener('change', updateSendButton);

    elements.sendCodeBtn?.addEventListener('click', async () => {
        const phone = currentCountryCode.replace('+', '') + elements.phoneInput.value.replace(/\D/g, '');
        elements.sendCodeBtn.disabled = true;
        elements.sendCodeBtn.textContent = 'Отправка...';

        try {
            const res = await fetch('/api/send_code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, subscribe: elements.subscribeEmail.checked })
            });
            const data = await res.json();
            if (data.success) {
                elements.stepPhone.style.display = 'none';
                elements.stepCode.style.display = 'block';
                elements.sentPhone.textContent = `${currentCountryCode} ${elements.phoneInput.value}`;
                elements.codeInput.focus();
            } else {
                showToast('Ошибка', data.error || 'Не удалось', true);
            }
        } catch (e) {
            showToast('Ошибка сети', '', true);
        } finally {
            elements.sendCodeBtn.disabled = false;
            elements.sendCodeBtn.textContent = 'Получить код';
        }
    });

    elements.codeInput?.addEventListener('input', () => {
        elements.codeInput.value = elements.codeInput.value.replace(/\D/g, '').slice(0, 4);
        elements.codeError.classList.remove('show');
        elements.codeInput.classList.remove('error');
    });

    elements.verifyCodeBtn?.addEventListener('click', async () => {
        if (elements.codeInput.value !== '1111') {
            elements.codeInput.classList.add('error');
            elements.codeError.classList.add('show');
            return;
        }

        const phone = currentCountryCode.replace('+', '') + elements.phoneInput.value.replace(/\D/g, '');
        try {
            const res = await fetch('/api/verify_code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, code: '1111', cart: clientCart })
            });
            const data = await res.json();
            if (data.success) {
                sessionStorage.setItem('user_id', data.user.id || '1');
                sessionStorage.setItem('phone', phone);
                sessionStorage.setItem('is_admin', data.user.is_admin);
                elements.modal.classList.remove('active');
                updateAuthButton(true, phone);
                showToast('Успешно!', 'Вы вошли');

                // ЖЁСТКАЯ ПОСЛЕДОВАТЕЛЬНОСТЬ — ВОТ ТУТ ВСЁ РАБОТАЕТ
                await mergeClientCart();  // 1. Мигрируем localStorage → сервер
                await loadCart();         // 2. Грузим обновлённую корзину с сервера

                // Обновляем бейдж
                const { count } = calculateTotal(cartItems);
                elements.cartBadge.textContent = count;
                elements.cartBadge.classList.toggle('show', count > 0);
            } else {
                showToast('Ошибка входа', data.error, true);
            }
        } catch (e) {
            showToast('Ошибка', '', true);
        }
    });

    const updateAuthButton = (loggedIn, phone = '') => {
        if (loggedIn) {
            elements.authText.textContent = 'Выйти';
            elements.authBtn.innerHTML = `<i class="fas fa-sign-out-alt"></i> ${phone.slice(-4)}`;
            elements.authBtn.onclick = async () => {
                await fetch('/api/logout', { method: 'POST' });
                sessionStorage.clear();
                localStorage.removeItem('clientCart');
                clientCart = [];
                location.reload();
            };
        } else {
            elements.authText.textContent = 'Войти';
            elements.authBtn.innerHTML = `<i class="fas fa-sign-in-alt"></i> Войти`;
            elements.authBtn.onclick = () => {
                elements.modal.classList.add('active');
                resetAuthModal();
            };
        }
    };

    const checkSession = async () => {
        try {
            const res = await fetch('/api/session');
            const data = await res.json();
            if (data.logged_in) {
                sessionStorage.setItem('user_id', data.user_id);
                sessionStorage.setItem('phone', data.phone);
                sessionStorage.setItem('is_admin', data.is_admin);
            }
            updateAuthButton(data.logged_in, data.phone || '');
        } catch (e) {
            updateAuthButton(false);
        }
    };

    // === ЗАГРУЗКА ПО ID (НОВАЯ ФУНКЦИЯ) ===
    const loadItemDetailsById = async (id, type) => {
        const cacheKey = `${type}_id:${id}`;
        if (cache.products.has(cacheKey)) return cache.products.get(cacheKey);
        if (cache.services.has(cacheKey)) return cache.services.get(cacheKey);

        const url = type === 'product' ? '/api/products' : '/api/services';
        const data = await apiCache(type + 's', url);

        const item = data.find(x => x.id === id);
        if (!item) return null;

        const price_cents = type === 'product'
            ? parseInt(item.price_str.replace(/\D/g, '')) || 0
            : parseInt(item.price.replace(/\D/g, '')) * 100 || 0;

        const image_url = parseImageUrls(item.image_urls || item.image_url)[0];

        const result = {
            id: item.id,
            title: item.title,
            price_cents,
            price_str: item.price_str || item.price,
            image_url,
            type
        };

        (type === 'product' ? cache.products : cache.services).set(cacheKey, result);
        return result;
    };

    // === ОТЗЫВЫ ===
    const showNextReview = async () => {
        if (reviewQueue.length === 0) {
            elements.reviewModal.style.display = 'none';
            return;
        }

        currentReviewItem = reviewQueue.shift();

        // Название товара
        if (currentReviewItem.title) {
            elements.reviewItemName.textContent = `Оцените: ${currentReviewItem.title}`;
        } else {
            const details = await loadItemDetailsById(currentReviewItem.id, currentReviewItem.type);
            const title = details?.title || 'Товар/Услуга';
            currentReviewItem.title = title;
            elements.reviewItemName.textContent = `Оцените: ${title}`;
        }

        // Открываем модалку
        elements.reviewModal.style.display = 'flex';

        // Сброс звёзд
        selectedStars = 0;
        elements.reviewStars.querySelectorAll('i').forEach(s => {
            s.className = 'far fa-star';
        });

        // === ПРИВЯЗКА ЗВЁЗД ЗДЕСЬ ===
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
            return showToast('Выберите оценку', '', true);
        }
        if (!currentReviewItem) {
            return showToast('Ошибка', 'Нет товара', true);
        }

        // === ПОЛУЧАЕМ ТЕЛЕФОН ИЗ СЕССИИ ===
        const phone = sessionStorage.getItem('phone') || 'Аноним';

        // === ГАРАНТИРОВАННО ГРУЗИМ TITLE ===
        let title = currentReviewItem.title;
        if (!title) {
            const details = await loadItemDetailsById(currentReviewItem.id, currentReviewItem.type);
            title = details?.title || 'Без названия';
            currentReviewItem.title = title;
        }

        const payload = {
            item_id: currentReviewItem.id,
            item_type: currentReviewItem.type,
            title: title,
            rating: selectedStars,
            text: elements.reviewText.value.trim(),
            user_phone: phone
        };

        try {
            const res = await fetch('/api/review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Ошибка сервера');
            }

            showToast('Спасибо за отзыв!', '', false, 2000);
            elements.reviewText.value = '';
            elements.reviewModal.style.display = 'none';
            showNextReview();
        } catch (e) {
            console.error('Review error:', e);
            showToast('Ошибка отправки', e.message || 'Попробуйте позже', true);
        }
    });

    // === ОФОРМЛЕНИЕ ===
    elements.checkoutBtn.onclick = async () => {
        const { count, sumStr } = calculateTotal(cartItems);
        if (count === 0) return showToast('Корзина пуста', 'Добавьте товары', true);

        try {
            const res = await fetch('/api/session');
            const data = await res.json();
            if (!data.logged_in) {
                elements.modal.classList.add('active');
                resetAuthModal();
                showToast('Войдите для оформления', '', true);
                return;
            }

            // === КРАСИВЫЙ НОМЕР В ОФОРМЛЕНИИ ===
            const rawPhone = data.phone || sessionStorage.getItem('phone') || '—';
            const formatted = rawPhone === '—' ? '—' : `+7 (${rawPhone.slice(1,4)}) ${rawPhone.slice(4,7)}-${rawPhone.slice(7,9)}-${rawPhone.slice(9,11)}`;

            const premiumBlock = document.getElementById('checkoutPhonePremium');
            const formattedEl = document.getElementById('checkoutPhoneFormatted');
            const inputEl = document.getElementById('checkoutPhone');

            if (premiumBlock && formattedEl) {
                formattedEl.textContent = formatted;
                premiumBlock.style.display = 'flex';
                if (inputEl) inputEl.style.display = 'none';
            } else if (inputEl) {
                inputEl.value = rawPhone;
                inputEl.style.display = 'block';
            }

            // === ОСТАЛЬНОЕ ===
            elements.checkoutPhone.value = rawPhone; // для отправки
            const countEl = document.getElementById('checkoutCount');
            const totalEl = document.getElementById('checkoutTotal');
            if (countEl) countEl.textContent = count;
            if (totalEl) totalEl.textContent = sumStr;

            elements.checkoutModal.classList.add('active');
            elements.fullName.focus();
        } catch (e) {
            console.error('Ошибка при открытии оформления:', e);
            showToast('Ошибка', 'Не удалось загрузить данные', true);
        }
    };

    elements.confirmOrderBtn?.addEventListener('click', async () => {
        const fullName = elements.fullName.value.trim();
        const phone = elements.checkoutPhone.value;
        if (!fullName) return showToast('Введите ФИО', '', true);

        try {
            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ full_name: fullName, phone })
            });
            const data = await res.json();
            if (data.success) {
                elements.checkoutModal.classList.remove('active');
                showToast('Заказ оформлен!');
                window.startOrderChain(data.order_id);

                // ОТЗЫВЫ ПО ТОВАРАМ — ВСЕГДА С TITLE
                reviewQueue = data.items.map(i => ({
                    id: i.id,
                    type: i.type,
                    title: i.title || null
                }));

                await Promise.all([loadCart(), loadMiniCart()]);
                showNextReview();
            } else {
                showToast('Ошибка', data.error || 'Попробуйте позже', true);
            }
        } catch (e) {
            showToast('Ошибка сервера', '', true);
        }
    });

    // Форматирование номера
    const formatPhone = (phone) => {
        const digits = phone.replace(/\D/g, '');
        if (digits.length < 11) return phone;
        return `+7 (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7,9)}-${digits.slice(9,11)}`;
    };

    // При открытии модалки
    elements.openFeedbackBtn?.addEventListener('click', () => {
        if (!sessionStorage.getItem('user_id')) {
            elements.modal.classList.add('active');
            resetAuthModal();
            showToast('Войдите для обратной связи', '', true);
            return;
        }

        const rawPhone = sessionStorage.getItem('phone') || '—';
        const formatted = rawPhone === '—' ? '—' : formatPhone(rawPhone);

        const premium = document.getElementById('phoneDisplayPremium');
        const fallback = document.getElementById('phoneDisplayFallback');
        const formattedEl = document.getElementById('feedbackPhoneFormatted');

        if (premium && formattedEl) {
            formattedEl.textContent = formatted;
            premium.style.display = 'flex';
            if (fallback) fallback.style.display = 'none';
        } else if (fallback) {
            document.getElementById('feedbackPhone').textContent = formatted;
            fallback.style.display = 'flex';
        }

        elements.feedbackModal.style.display = 'flex';
    });

    elements.feedbackModal?.addEventListener('click', e => {
        if (e.target === elements.feedbackModal) elements.feedbackModal.style.display = 'none';
    });

    // === ЗАКРЫТИЕ МОДАЛОК ===
    elements.closeModal?.addEventListener('click', () => {
        elements.modal.classList.remove('active');
        resetAuthModal();
    });
    elements.modal?.addEventListener('click', e => {
        if (e.target === elements.modal) {
            elements.modal.classList.remove('active');
            resetAuthModal();
        }
    });
    elements.closeCheckout?.addEventListener('click', () => elements.checkoutModal.classList.remove('active'));
    elements.checkoutModal?.addEventListener('click', e => {
        if (e.target.id === 'checkoutModal') elements.checkoutModal.classList.remove('active');
    });
    elements.closeReview?.addEventListener('click', () => elements.reviewModal.classList.remove('active'));
    elements.resendCode?.addEventListener('click', e => {
        e.preventDefault();
        elements.stepCode.style.display = 'none';
        elements.stepPhone.style.display = 'block';
        elements.codeInput.value = '';
    });

    // === РЕНДЕР УСЛУГ ===
    const renderServices = async (retry = 0) => {
        if (!elements.servicesContainer) return;

        // Показываем "Загрузка..."
        elements.servicesContainer.innerHTML = '<div class="empty-cart">Загрузка услуг...</div>';

        let services = [];
        try {
            services = await apiCache('allServices', '/api/services', 10000); // кэш 10 сек
        } catch (e) {
            console.warn('API услуг недоступен:', e);
        }

        if (services.length === 0 && retry < 3) {
            // Повторяем 3 раза с задержкой
            setTimeout(() => renderServices(retry + 1), 1000);
            return;
        }

        if (services.length === 0) {
            elements.servicesContainer.innerHTML = '<div class="empty-cart">Услуги временно недоступны</div>';
            return;
        }

        elements.servicesContainer.innerHTML = services.map(s => {
            const img = parseImageUrls(s.image_urls)[0] || '/static/assets/no-image.png';
            return `
                <div class="service-card" onclick="addToCart('${escapeJS(s.title)}', 'service')">
                    <img src="${img}" class="service-img" alt="${escapeHtml(s.title)}" 
                        onerror="this.src='/static/assets/no-image.png'; this.onerror=null;">
                    <div class="service-content">
                        <h3 class="service-title">${escapeHtml(s.title)}</h3>
                        <p class="service-price">${s.price || 'Цена по запросу'}</p>
                        <p class="service-desc">${escapeHtml(s.short_desc || '')}</p>
                    </div>
                    <button class="add-to-cart-btn" onclick="event.stopPropagation(); addToCart('${escapeJS(s.title)}', 'service')">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
            `;
        }).join('');
    };

    // Кнопка выхода
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        if (!confirm('Выйти из аккаунта?')) return;
        
        try {
            const res = await fetch('/api/logout', { method: 'POST' });
            if (res.ok) {
                sessionStorage.clear();
                localStorage.removeItem('clientCart');
                clientCart = [];
                location.reload();
            } else {
                alert('Ошибка выхода');
            }
        } catch (e) {
            alert('Нет сети');
        }
    });

    // === ИНИЦИАЛИЗАЦИЯ ===
    const init = async () => {
        await checkSession();
        await renderServices();
        await Promise.all([loadCart(), loadMiniCart()]);
        setTimeout(() => $$('.gradient-overlay')?.classList.add('active'), 100);
    };

    init();
});