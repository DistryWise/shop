// static/js/goods.js
document.addEventListener('DOMContentLoaded', () => {
    // === DOM ЭЛЕМЕНТЫ ===
    const $ = (id) => document.getElementById(id);
    const $$ = (sel) => document.querySelector(sel);

    const el = {
        goodsGrid: $('goodsGrid'),
        catalogList: $('catalogList'),
        goodsSearch: $('goodsSearch'),
        priceFrom: $('priceFrom'),
        priceTo: $('priceTo'),
        sortSelect: $('sortSelect'),
        brandCheckboxes: $('brandCheckboxes'),
        filterToggle: $('filterToggle'),
        filtersPanel: $('filtersPanel'),
        modal: $('goodsModal'),
        modalBody: $('modalBody'),
        cartBadge: $('cartBadge'),
        toast: $('cartToast'),
        // Добавим минимальные элементы (если их нет — создадим)
    };

    // === СОЗДАЁМ ЗАГЛУШКИ, ЕСЛИ НЕТ ===
    if (!el.cartBadge) {
        const badge = document.createElement('span');
        badge.id = 'cartBadge';
        badge.className = 'cart-badge';
        badge.style.cssText = 'display:none;';
        document.body.appendChild(badge);
        el.cartBadge = badge;
    }

    if (!el.toast) {
        const toast = document.createElement('div');
        toast.id = 'cartToast';
        toast.className = 'toast';
        toast.style.cssText = 'position:fixed; bottom:20px; left:50%; transform:translateX(-50%); z-index:10000; display:none;';
        document.body.appendChild(toast);
        el.toast = toast;
    }

    // === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
    let currentCategory = 'all';

    // === ЗВЁЗДЫ ===
    const renderStars = (rating) => {
        rating = parseFloat(rating) || 0;
        if (rating === 0) return '☆☆☆☆☆';
        const full = Math.floor(rating);
        const hasHalf = rating - full >= 0.5;
        const empty = 5 - full - (hasHalf ? 1 : 0);
        return '★'.repeat(full) + (hasHalf ? '★' : '') + '☆'.repeat(empty);
    };

    // === АВТОПРОКРУТКА ФОТО ===
    const startImageSlider = (card) => {
        const imgs = card.querySelectorAll('.good-img');
        if (imgs.length <= 1) return;
        let current = 0;
        const next = () => {
            imgs[current].classList.remove('active');
            current = (current + 1) % imgs.length;
            imgs[current].classList.add('active');
        };
        const interval = setInterval(next, 3000);
        card.dataset.slider = interval;
        card.addEventListener('mouseenter', () => clearInterval(interval));
        card.addEventListener('mouseleave', () => card.dataset.slider = setInterval(next, 3000));
    };

    const stopSlider = (card) => {
        if (card.dataset.slider) clearInterval(card.dataset.slider);
    };

    // === ФИЛЬТРЫ ===
    const applyFilters = async () => {
        const params = new URLSearchParams();
        if (el.goodsSearch.value.trim()) params.append('search', el.goodsSearch.value.trim());
        if (el.priceFrom.value) params.append('min_price', el.priceFrom.value);
        if (el.priceTo.value) params.append('max_price', el.priceTo.value);
        params.append('category', currentCategory);
        document.querySelectorAll('#brandCheckboxes input:checked').forEach(cb => params.append('brand', cb.value));
        if (el.sortSelect.value !== 'default') params.append('sort', el.sortSelect.value);

        try {
            const res = await fetch(`/api/products?${params}`);
            const products = await res.json();

            document.querySelectorAll('.good-card').forEach(stopSlider);
            el.goodsGrid.innerHTML = '';

            if (!products.length) {
                el.goodsGrid.innerHTML = '<p style="color:#888; grid-column:1/-1; text-align:center; padding:2rem;">Товары не найдены</p>';
                return;
            }

            const reviewsData = await Promise.all(
                products.map(p => fetch(`/api/reviews/${p.id}`).then(r => r.ok ? r.json() : { avg_rating: 0, review_count: 0 }).catch(() => ({ avg_rating: 0, review_count: 0 })))
            );

            products.forEach((p, i) => {
                const rev = reviewsData[i];
                const avgRating = parseFloat(rev.avg_rating) || 0;
                const reviewCount = parseInt(rev.review_count) || 0;

                const card = document.createElement('div');
                card.className = 'good-card';
                card.dataset.id = p.id;
                card.onclick = () => openModal(p.id);

                const imageHtml = p.image_urls?.length
                    ? p.image_urls.map((url, idx) => `<img src="${url}" alt="${p.title}" class="good-img ${idx === 0 ? 'active' : ''}" loading="lazy">`).join('')
                    : '<img src="https://via.placeholder.com/600x400/111/888?text=No+Image" class="good-img active">';

                const starsHtml = avgRating > 0.1 ? `
                    <div class="rating-stars">
                        <span class="stars">${renderStars(avgRating)}</span>
                        <span>${avgRating.toFixed(1)} <small>(${reviewCount})</small></span>
                    </div>
                ` : '';

                card.innerHTML = `
                    <div class="good-img-container">
                        ${imageHtml}
                        ${starsHtml}
                    </div>
                    <div class="good-info">
                        <h3 class="good-title">${p.title}</h3>
                        <div class="good-price">${p.price_str}</div>
                        <div class="good-stock">
                            ${parseInt(p.stock) === -1 ? 'В наличии' : 
                             parseInt(p.stock) > 0 ? `В наличии (${parseInt(p.stock)} шт.)` : 'Нет в наличии'}
                        </div>
                        <p class="good-desc">${p.description || ''}</p>
                        <div class="good-actions">
                            <button class="good-add-cart ${p.stock === 0 ? 'disabled' : ''}" 
                                    onclick="event.stopPropagation(); addToCart('${p.title}')">
                                <i class="fas fa-plus"></i> В корзину
                            </button>
                        </div>
                    </div>
                `;
                el.goodsGrid.appendChild(card);
                setTimeout(() => {
                    card.classList.add('visible');
                    startImageSlider(card);
                }, i * 80);
            });
        } catch (err) {
            console.error('Ошибка фильтров:', err);
        }
    };

    // === МОДАЛКА ТОВАРА ===
    const openModal = async (productId) => {
        try {
            const [productRes, reviewsRes] = await Promise.all([
                fetch(`/api/product/${productId}`),
                fetch(`/api/reviews/${productId}`)
            ]);

            const p = await productRes.json();
            const revData = await reviewsRes.json();
            if (!revData.success) throw new Error();

            const reviews = revData.reviews || [];
            const avgRating = parseFloat(revData.avg_rating) || 0;
            const reviewCount = parseInt(revData.review_count) || 0;

            const images = p.image_urls || [];
            const mainImg = images.length ? images[0] : 'https://via.placeholder.com/600';

            const thumbsHtml = images.length > 1 ? `
                <div class="modal-thumbs" style="display:flex; gap:8px; margin-top:12px; overflow-x:auto; padding:4px 0;">
                    ${images.map((url, i) => `
                        <img src="${url}" alt="thumb" 
                             style="width:70px; height:70px; object-fit:cover; border-radius:12px; cursor:pointer; border:2px solid ${i===0?'var(--accent)':'transparent'};"
                             onclick="this.closest('.modal-gallery').querySelector('.modal-main-img').src=this.src;
                                      this.closest('.modal-thumbs').querySelectorAll('img').forEach(t=>t.style.border='2px solid transparent');
                                      this.style.border='2px solid var(--accent)'">
                    `).join('')}
                </div>
            ` : '';

            const reviewsHtml = reviews.length ? reviews.map(r => {
                const author = r.author || 'Аноним';
                return `
                    <div class="review-item">
                        <div class="review-avatar"><div class="avatar-initial">${author[0].toUpperCase()}</div></div>
                        <div class="review-content">
                            <div class="review-header">
                                <strong>${author}</strong>
                                <span class="review-rating">
                                    <span style="color:#FFD60A; letter-spacing:-2px; font-size:1rem;">${renderStars(r.rating)}</span>
                                    <small style="margin-left:4px; opacity:0.9;">${r.rating}.0</small>
                                </span>
                            </div>
                            <p class="review-text">${r.text || ''}</p>
                            <small class="review-date">${new Date(r.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</small>
                        </div>
                    </div>
                `;
            }).join('') : `
                <div class="no-reviews">
                    <i class="far fa-star"></i>
                    <p>Отзывов пока нет</p>
                    <small>Будьте первым!</small>
                </div>
            `;

            el.modalBody.innerHTML = `
                <div class="modal-product">
                    <div class="modal-gallery">
                        <img src="${mainImg}" alt="${p.title}" class="modal-main-img">
                        ${thumbsHtml}
                    </div>
                    <div class="modal-details">
                        <h2>${p.title}</h2>
                        <div class="modal-rating-big">
                            ${reviewCount > 0 ? `
                                <div class="big-stars" style="font-size:2.6rem; letter-spacing:-3px;">${renderStars(avgRating)}</div>
                                <div class="big-rating">${avgRating.toFixed(1)}</div>
                                <small>${reviewCount} отзыв${reviewCount === 1 ? '' : 'а'}</small>
                            ` : '<small style="opacity:0.7;">Нет оценок</small>'}
                        </div>
                        <p class="modal-price">${p.price_str}</p>
                        <p><strong>Наличие:</strong> 
                            ${parseInt(p.stock) === -1 ? 'В наличии' : 
                             parseInt(p.stock) > 0 ? `В наличии (${parseInt(p.stock)} шт.)` : 'Нет в наличии'}
                        </p>
                        <p class="modal-desc">${p.description || 'Описание отсутствует'}</p>
                    </div>
                </div>
                <div class="reviews-section">
                    <h3>Отзывы покупателей</h3>
                    <div class="reviews-list">${reviewsHtml}</div>
                </div>
            `;

            el.modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        } catch (err) {
            el.modalBody.innerHTML = `<div style="text-align:center;padding:3rem;color:#aaa"><p>Не удалось загрузить</p></div>`;
            el.modal.classList.add('active');
        }
    };

    window.closeModal = () => {
        el.modal.classList.remove('active');
        setTimeout(() => { document.body.style.overflow = ''; }, 400);
    };

    // === КОРЗИНА: ИСПОЛЬЗУЕМ bin.js ===
    window.addToCart = (title) => {
        if (typeof window.addToCart === 'function' && window.addToCart !== arguments.callee) {
            window.addToCart(title, 'product');
        } else {
            // Fallback
            alert(`Добавлено: ${title}`);
        }
        updateCartBadge();
    };

    const updateCartBadge = async () => {
        if (typeof loadCart === 'function') {
            await loadCart();
        }
        const cart = JSON.parse(localStorage.getItem('clientCart') || '[]');
        const count = cart.reduce((s, i) => s + i.quantity, 0);
        el.cartBadge.textContent = count;
        el.cartBadge.style.display = count > 0 ? 'inline-block' : 'none';
    };

    // === КАТЕГОРИИ И БРЕНДЫ ===
    const loadCategories = async () => {
        try {
            const res = await fetch('/api/categories');
            const cats = await res.json();
            el.catalogList.innerHTML = `<div class="catalog-item active" data-category="all"><div class="catalog-icon"><i class="fas fa-cube"></i></div><span>Все товары</span></div>`;
            cats.forEach(cat => {
                const item = document.createElement('div');
                item.className = 'catalog-item';
                item.dataset.category = cat;
                item.innerHTML = `<div class="catalog-icon"><i class="fas fa-tag"></i></div><span>${cat}</span>`;
                el.catalogList.appendChild(item);
            });
            attachCategoryListeners();
        } catch (err) { console.error(err); }
    };

    const loadBrands = async () => {
        try {
            const res = await fetch('/api/brands');
            const brands = await res.json();
            el.brandCheckboxes.innerHTML = '';
            brands.forEach(b => {
                const label = document.createElement('label');
                label.innerHTML = `<input type="checkbox" value="${b}"> ${b}`;
                el.brandCheckboxes.appendChild(document.createElement('br'));
                el.brandCheckboxes.appendChild(label);
            });
        } catch (err) { console.error(err); }
    };

    const attachCategoryListeners = () => {
        $$(`.catalog-item`).forEach(item => {
            item.addEventListener('click', () => {
                $$('.catalog-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                currentCategory = item.dataset.category;
                applyFilters();
            });
        });
    };

    // === СОБЫТИЯ ===
    el.goodsSearch.addEventListener('input', () => setTimeout(applyFilters, 300));
    [el.priceFrom, el.priceTo, el.sortSelect].forEach(input => input.addEventListener('input', applyFilters));
    el.brandCheckboxes.addEventListener('change', applyFilters);
    el.filterToggle.addEventListener('click', () => {
        el.filterToggle.classList.toggle('active');
        el.filtersPanel.classList.toggle('open');
    });

    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
    document.addEventListener('click', e => {
        if (!el.filterToggle.contains(e.target) && !el.filtersPanel.contains(e.target)) {
            el.filterToggle.classList.remove('active');
            el.filtersPanel.classList.remove('open');
        }
    });
    el.modal.addEventListener('click', e => { if (e.target === el.modal) closeModal(); });

    $$('.catalog-header').addEventListener('click', () => {
        $$('.catalog-header').classList.toggle('collapsed');
        el.catalogList.classList.toggle('open');
    });

    // === ИНИЦИАЛИЗАЦИЯ ===
    loadCategories();
    loadBrands();
    applyFilters();
    updateCartBadge();
    $$('.gradient-overlay').classList.add('active');
    $$('.catalog-sidebar').classList.add('visible');
});