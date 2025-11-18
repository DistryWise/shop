document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);

  // === НОВАЯ СТРУКТУРА ИЗ BIN.CSS ===
  const searchContainer = document.querySelector('.search-container');
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  const autocompleteList = document.getElementById('autocompleteList');

  if (!searchContainer || !searchInput || !searchClear || !autocompleteList) {
    console.error('Поиск не найден — проверь HTML');
    return;
  }

  let searchTimeout = null;
  let selectedIndex = -1;

  // === ОТКРЫТЬ / ЗАКРЫТЬ ===
const open = () => {
  searchContainer.classList.add('active');
  setTimeout(() => searchInput.focus(), 250);
};

const close = () => {
  searchContainer.classList.remove('active');
  autocompleteList.classList.remove('active');
  selectedIndex = -1;
};

// Очистка поля — только после анимации
searchContainer.addEventListener('transitionend', (e) => {
  if (e.propertyName === 'width' && !searchContainer.classList.contains('active')) {
    searchInput.value = '';
    searchInput.blur();
  }
});


  // === КЛИК ПО ЛУПЕ ===
  document.querySelector('.search-icon').addEventListener('click', (e) => {
    e.stopPropagation();
    searchContainer.classList.contains('active') ? close() : open();
  });

  // === ХОВЕР (как в bin — открывается при наведении) ===
  let hoverTimeout;
  searchContainer.addEventListener('mouseenter', () => {
    if (!searchInput.value.trim()) {
      clearTimeout(hoverTimeout);
      open();
    }
  });

  // === ХОВЕР: закрытие при отводе (ТОЛЬКО если поле пустое) ===
searchContainer.addEventListener('mouseleave', () => {
  if (!searchInput.value.trim()) {
    hoverTimeout = setTimeout(close, 400);
  }
});

  // === ВВОД ===
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  const query = searchInput.value.trim();

  // КРЕСТИК МЁРТВ — НИКАКИХ СЛЕДОВ
  if (!query) {
    autocompleteList.classList.remove('active');
    return;
  }

  searchTimeout = setTimeout(() => fetchSuggestions(query), 200);
});


  // === КЛИК ВНЕ ===
  document.addEventListener('click', (e) => {
    if (!searchContainer.contains(e.target)) {
      close();
    }
  });

  // === КЛАВИАТУРА ===
  searchInput.addEventListener('keydown', (e) => {
    const items = autocompleteList.querySelectorAll('.autocomplete-item');
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % items.length;
      highlight(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + items.length) % items.length;
      highlight(items);
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      items[selectedIndex].click();
    } else if (e.key === 'Escape') {
      close();
    }
  });
  // === ПОИСК ПО ТОВАРАМ И УСЛУГАМ ===
const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const fetchSuggestions = async (query) => {
  if (!query.trim()) {
    autocompleteList.classList.remove('active');
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
        image_url: parseImageUrls(p.image_urls || p.image_url)[0],
        type: 'product'
      })),
      ...services.map(s => ({
        title: s.title,
        price_str: s.price,
        image_url: parseImageUrls(s.image_urls || s.image_url)[0],
        type: 'service'
      }))
    ].slice(0, 6);

    autocompleteList.innerHTML = all.length === 0
      ? `<div class="autocomplete-empty">Ничего не найдено</div>`
      : all.map(item => `
          <div class="autocomplete-item" onclick="selectAutocomplete('${escapeJS(item.title)}', '${item.type}')">
            <img src="${item.image_url}" onerror="this.src='/static/assets/no-image.png'">
            <div class="item-info">
              <div class="item-title">${item.title.replace(
                new RegExp(`(${escapeRegExp(query)})`, 'gi'),
                '<strong>$1</strong>'
              )}</div>
              <div class="item-type">${item.type === 'product' ? 'Товар' : 'Услуга'}</div>
            </div>
            <small>${item.price_str}</small>
            <div class="autocomplete-add" onclick="event.stopPropagation(); addToCart('${escapeJS(item.title)}', '${item.type}')">
              <i class="fas fa-plus"></i>
            </div>
          </div>
        `).join('');

    autocompleteList.classList.add('active');
  } catch (e) {
    console.error('Ошибка поиска:', e);
    autocompleteList.innerHTML = `<div class="autocomplete-empty">Ошибка сервера</div>`;
    autocompleteList.classList.add('active');
  }
};

  const escapeJS = (str) => str
  .replace(/\\/g, '\\\\')
  .replace(/'/g, "\\'")
  .replace(/"/g, '\\"')
  .replace(/\n/g, '\\n');

const parseImageUrls = (urls) => {
  if (!urls) return ['/static/assets/no-image.png'];
  const arr = Array.isArray(urls) ? urls : urls.split(',').map(u => u.trim()).filter(Boolean);
  return arr.length > 0 ? arr.map(u => u.startsWith('/') ? u : `/static/uploads/services/${u}`) : ['/static/assets/no-image.png'];
};

const formatPrice = (raw) => {
  if (!raw || raw === 'Цена по запросу') return 'Цена по запросу';
  const num = parseInt(String(raw).replace(/\D/g, ''), 10);
  if (isNaN(num)) return 'Цена по запросу';
  const rub = Math.floor(num / 100);
  const kop = (num % 100).toString().padStart(2, '0');
  return `${rub.toLocaleString('ru-RU')}.${kop} ₽`;
};

const renderStars = (rating) => {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '<i class="fas fa-star"></i>'.repeat(full) +
         (half ? '<i class="fas fa-star-half-alt"></i>' : '') +
         '<i class="far fa-star"></i>'.repeat(empty);
};



  const highlight = (items) => {
    items.forEach((item, i) => {
      item.classList.toggle('highlighted', i === selectedIndex);
    });
  };

  // === ГЛОБАЛЬНЫЕ ФУНКЦИИ ===
  window.selectAutocomplete = (title, type) => {
    searchInput.value = '';
    autocompleteList.classList.remove('active');
    close();
    openProductModal(title, type);
  };

  window.addToCart = async (title, type = 'product') => {
    const isLoggedIn = !!sessionStorage.getItem('user_id');
    if (isLoggedIn) {
      const payload = type === 'product'
        ? { product_title: title, quantity: 1 }
        : { service_title: title, quantity: 1 };
      await fetch('/api/cart/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      showToast('Добавлено!', '', false, 2000);
      await loadCart();
    } else {
      let clientCart = JSON.parse(localStorage.getItem('clientCart') || '[]');
      const existing = clientCart.find(i => i.title === title && i.type === type);
      if (existing) existing.quantity += 1;
      else clientCart.push({ title, type, quantity: 1, price_cents: 0, price_str: 'Цена по запросу', image_url: '/static/assets/no-image.png' });
      localStorage.setItem('clientCart', JSON.stringify(clientCart));
      showToast('Добавлено!', '', false, 2000);
      const { count } = calculateTotal(clientCart);
      $('cartBadge').textContent = count;
      $('cartBadge').classList.toggle('show', count > 0);
    }
  };

  // === ОТКРЫТИЕ МОДАЛКИ С ФОРМАТИРОВАНИЕМ ЦЕНЫ ===
 // === ОТКРЫТИЕ МОДАЛКИ С ОТЗЫВАМИ ===
window.openProductModal = async (title, type = 'product') => {
  const modal = document.querySelector('.product-modal');
  if (!modal) return;

  // Сброс
  modal.querySelector('#productTitle').textContent = 'Загрузка...';
  modal.querySelector('#productPrice').textContent = '—';
  modal.querySelector('#productDescription').textContent = 'Загрузка...';
  modal.querySelector('.stars').innerHTML = '';
  modal.querySelector('#productReviewsCount').textContent = '—';
  modal.querySelector('.reviews-list').innerHTML = '<div style="text-align:center;padding:2rem;color:#888;">Загрузка отзывов...</div>';
  modal.querySelector('#productImg').src = '/static/assets/no-image.png';

  try {
    const searchRes = await fetch(`/api/${type}s?search=${encodeURIComponent(title)}`);
    if (!searchRes.ok) throw new Error('API не отвечает');
    const items = await searchRes.json();
    const item = items.find(i => i.title === title) || items[0];
    if (!item) throw new Error('Товар не найден');

    // === БЕЗОПАСНЫЙ ID ===
    const itemId = item.id || item.product_id || item.service_id;
    if (!itemId) throw new Error('Нет ID товара');

    // === ОТЗЫВЫ ===
    let revData = { avg_rating: 0, review_count: 0, reviews: [] };
    try {
      const revRes = await fetch(`/api/reviews/${itemId}`);
      if (revRes.ok) revData = await revRes.json();
    } catch (e) {
      console.warn('Отзывы не загрузились:', e);
    }

    const avgRating = parseFloat(revData.avg_rating) || 0;
    const reviewCount = parseInt(revData.review_count) || 0;
    const reviews = revData.reviews || [];

    // === КАРТИНКА ===
    const imgUrl = parseImageUrls(item.image_urls || item.image_url)[0];
    modal.querySelector('#productImg').src = imgUrl + '?v=' + Date.now();

    // === ДАННЫЕ ===
    modal.querySelector('#productTitle').textContent = item.title;
    modal.querySelector('#productPrice').textContent = formatPrice(item.price_str || item.price);
    modal.querySelector('#productDescription').textContent = item.description || 'Описание отсутствует';
    modal.querySelector('.stars').innerHTML = renderStars(avgRating);
    modal.querySelector('#productReviewsCount').textContent = 
      `${avgRating.toFixed(1)} • ${reviewCount} отзыв${reviewCount % 10 === 1 && reviewCount !== 11 ? '' : 'ов'}`;

    // === ОТЗЫВЫ ===
    const reviewsContainer = modal.querySelector('.product-reviews');
    if (!reviews.length) {
      reviewsContainer.innerHTML = `<div style="text-align:center;padding:2rem;color:#888;">
        <i class="far fa-star" style="font-size:2.5rem;margin-bottom:0.5rem;display:block;"></i>
        <p>Отзывов пока нет</p><small>Будьте первым!</small>
      </div>`;
    } else {
      reviewsContainer.innerHTML = '<h4 class="reviews-title">Отзывы покупателей</h4><div class="reviews-list">' + reviews.map(r => {
        const author = r.author || 'Аноним';
        const emojis = ['😊','😎','🥰','🤩','😇','😋','🤔','😴','🥳','🤗','😜','😺','🐶','🐱','🦊','🐼','🦁','🐸','🐵','🤖','👻','🎃','💩','🦄','🍔','🍕'];
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
        const date = new Date(r.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
        return `
          <div class="review">
            <div class="review-header">
              <div style="width:40px;height:40px;border-radius:50%;background:#f0f0f0;display:flex;align-items:center;justify-content:center;font-size:26px;">
                ${randomEmoji}
              </div>
              <div>
                <strong>${author}</strong>
                <div class="review-stars">${renderStars(r.rating)}</div>
              </div>
            </div>
            <p>${r.text || ''}</p>
            <small>${date}</small>
          </div>
        `;
      }).join('') + '</div>';
    }

    modal.querySelector('#addToCartModal').onclick = () => {
      addToCart(item.title, type);
      modal.classList.remove('active');
    };

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

  } catch (err) {
    console.error('Ошибка модалки:', err);
    modal.querySelector('#productTitle').textContent = 'Ошибка';
    modal.querySelector('#productDescription').textContent = 'Не удалось загрузить товар.';
    modal.classList.add('active');
  }
};
  // === КНОПКА ОЧИСТКИ ===
  document.getElementById('searchClear')?.addEventListener('click', () => {
    searchInput.value = '';
    searchInput.focus();
    autocompleteList.classList.remove('active');
  });
  // === ЗАГЛУШКИ ===
  window.showToast = (title, msg = '', error = false, duration = 3000) => {
    alert(`${title}: ${msg}`);
  };

  const calculateTotal = (items) => {
    const count = items.reduce((s, i) => s + i.quantity, 0);
    return { count, sumStr: '...' };
  };
  
  const loadCart = async () => {
    const isLoggedIn = !!sessionStorage.getItem('user_id');
    if (isLoggedIn) {
      const res = await fetch('/api/cart/get');
      const items = res.ok ? await res.json() : [];
      const count = items.reduce((s, i) => s + i.quantity, 0);
      const badge = $('cartBadge');
      if (badge) {
        badge.textContent = count;
        badge.classList.toggle('show', count > 0);
      }
    }
  };

  loadCart();

});