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
        id: p.id,
        title: p.title,
        price_str: p.price_str || formatPrice(p.price_cents || p.price),
        image_url: p.image_urls?.[0] || p.image_url || '/static/assets/no-image.png',
        type: 'product'
      })),
      ...services.map(s => ({
        id: s.id,
        title: s.title,
        price_str: s.price_str || formatPrice(s.price_cents || s.price),
        image_url: s.image_urls?.[0] || '/static/assets/no-image.png',
        type: 'service'
      }))
    ].slice(0, 6);

    autocompleteList.innerHTML = all.length === 0
      ? `<div class="autocomplete-empty">Ничего не найдено</div>`
      : all.map(item => `
          <div class="autocomplete-item" onclick="selectAutocomplete(${item.id}, '${item.type}')">
            <img src="${item.image_url}" onerror="this.src='/static/assets/no-image.png'">
            <div class="item-info">
              <div class="item-title">${item.title.replace(
                new RegExp(`(${escapeRegExp(query)})`, 'gi'),
                '<strong>$1</strong>'
              )}</div>
              <div class="item-type">${item.type === 'product' ? 'Товар' : 'Услуга'}</div>
            </div>
            <small>${item.price_str}</small>
            <div class="autocomplete-add" 
                 onclick="event.stopPropagation(); addToCart(${item.id}, '${item.type}')">
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

  // Приводим к числу (может быть строка, число, с пробелами и т.д.)
  let num = parseInt(String(raw).replace(/\D/g, ''), 10);
  if (isNaN(num)) return 'Цена по запросу';

  // ЕСЛИ ЦЕНА В КОПЕЙКАХ (например 1000000) — делим на 100
  // ЕСЛИ ЦЕНА В РУБЛЯХ (например 10000) — оставляем как есть
  // Автоопределение: если число > 100000 → скорее всего в копейках
  if (num > 100000) {
    num = Math.round(num / 100);
  }

  return `${num.toLocaleString('ru-RU')} ₽`;
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
 window.selectAutocomplete = (id, type) => {
  searchInput.value = '';
  autocompleteList.classList.remove('active');
  close();
  openProductModal(id, type); // ← теперь по ID!
};



  // === ОТКРЫТИЕ МОДАЛКИ С ФОРМАТИРОВАНИЕМ ЦЕНЫ ===
 // === ОТКРЫТИЕ МОДАЛКИ С ОТЗЫВАМИ ===
window.openProductModal = async (id, type = 'product') => {
  const modal = document.querySelector('.product-modal');
  if (!modal) return;

  // Сброс состояния
  modal.querySelector('#productTitle').textContent = 'Загрузка...';
  modal.querySelector('#productPrice').textContent = '—';
  modal.querySelector('#productDescription').textContent = 'Загрузка...';
  modal.querySelector('.stars').innerHTML = '';
  modal.querySelector('#productReviewsCount').textContent = '—';
  modal.querySelector('.reviews-list').innerHTML = '<div style="text-align:center;padding:2rem;color:#888;">Загрузка отзывов...</div>';
  modal.querySelector('#productImg').src = '/static/assets/no-image.png';

  try {
    // Прямой запрос по ID — быстро и надёжно
    const res = await fetch(`/api/${type === 'service' ? 'service' : 'product'}/${id}`);
    if (!res.ok) throw new Error(`Товар не найден (${res.status})`);

    const item = await res.json();

    // === ОТЗЫВЫ ===
    let revData = { avg_rating: 0, review_count: 0, reviews: [] };
    try {
      const endpoint = type === 'service' ? `/api/service_reviews/${id}` : `/api/reviews/${id}`;
const revRes = await fetch(endpoint);
      if (revRes.ok) revData = await revRes.json();
    } catch (e) {
      console.warn('Отзывы не загрузились:', e);
    }

    const avgRating = parseFloat(revData.avg_rating) || 0;
    const reviewCount = parseInt(revData.review_count) || 0;
    const reviews = revData.reviews || [];

    // Картинка
    const imgUrl = parseImageUrls(item.image_urls || item.image_url)[0];
    modal.querySelector('#productImg').src = imgUrl + '?v=' + Date.now();

    // Данные
    modal.querySelector('#productTitle').textContent = item.title || 'Без названия';
    modal.querySelector('#productPrice').textContent = formatPrice(item.price_str || item.price_cents || item.price);
    modal.querySelector('#productDescription').textContent = item.description || 'Описание отсутствует';
    modal.querySelector('.stars').innerHTML = renderStars(avgRating);
    const word = reviewCount === 1 ? 'отзыв' : 
            (reviewCount >= 2 && reviewCount <= 4) ? 'отзыва' : 'отзывов';

modal.querySelector('#productReviewsCount').textContent = 
  reviewCount > 0 
    ? `${avgRating.toFixed(1)} ★ ${reviewCount} ${word}`
    : 'Отзывов пока нет';

    // Отзывы (тот же код, что был)
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
        const date = new Date(r.date || r.created_at).toLocaleDateString('ru-RU', {
  day: 'numeric', month: 'long', year: 'numeric'
}).replace('.', ''); // убираем точку в конце
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

    // Кнопка "В корзину" в модалке
    modal.querySelector('#addToCartModal').onclick = () => {
      addToCart(id, type);  // ← теперь передаём ID, а не title!
      modal.classList.remove('active');
    };

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

  } catch (err) {
    console.error('Ошибка загрузки товара по ID:', err);
    modal.querySelector('#productTitle').textContent = 'Ошибка';
    modal.querySelector('#productDescription').textContent = 'Не удалось загрузить товар. Попробуйте позже.';
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
  // Удаляем старый тост, если есть
  const old = document.querySelector('.custom-toast');
  if (old) old.remove();

  const toast = document.createElement('div');
  toast.className = `custom-toast ${error ? 'error' : 'success'}`;
  toast.innerHTML = `
    <strong>${title}</strong>
    ${msg ? `<div style="margin-top:4px;font-size:0.9em;opacity:0.9;">${msg}</div>` : ''}
  `;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: error ? '#d32f2f' : '#1e7e34',
    color: 'white',
    padding: '14px 24px',
    borderRadius: '12px',
    boxShadow: '0 8px 25px rgba(0,0,0,0.3)',
    zIndex: 9999,
    fontSize: '1em',
    fontWeight: '500',
    maxWidth: '90%',
    textAlign: 'center',
    animation: 'toastSlide 0.4s ease',
    pointerEvents: 'none'
  });

  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), duration);
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
  // === АНТИСПАМ ДЛЯ КНОПКИ "+" В АВТОКОМПЛИТЕ ===
  let addButtonClicks = 0;
  let cooldownActive = false;
  let resetTimer = null;

  // Сбрасываем счётчик каждые 30 секунд
  const startClickCounter = () => {
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      addButtonClicks = 0; // обнуляем после 30 секунд бездействия
    }, 30000);
  };

  // Показ тоста в стиле сайта (используем твою функцию showToast)
  const triggerCooldown = () => {
    if (cooldownActive) return;

    cooldownActive = true;
    showToast('Слишком быстро!', 'Подождите 10 секунд перед следующим добавлением', true, 5000);

    // Блокируем все кнопки "+" на 10 секунд
    document.querySelectorAll('.autocomplete-add').forEach(btn => {
      btn.style.pointerEvents = 'none';
      btn.style.opacity = '0.5';
      btn.innerHTML = '<i class="fas fa-hourglass-half"></i>';
    });

    setTimeout(() => {
      cooldownActive = false;
      document.querySelectorAll('.autocomplete-add').forEach(btn => {
        btn.style.pointerEvents = '';
        btn.style.opacity = '';
        btn.innerHTML = '<i class="fas fa-plus"></i>';
      });
    }, 10000);
  };

  // Перехватываем клики по всем кнопкам "+" в автокомплите
  document.addEventListener('click', (e) => {
    const addBtn = e.target.closest('.autocomplete-add');
    if (!addBtn) return;

    // Если кулдаун активен — просто игнорируем
    if (cooldownActive) {
      e.stopPropagation();
      e.preventDefault();
      return false;
    }

    addButtonClicks++;
    startClickCounter(); // перезапускаем таймер окна в 30 сек

    if (addButtonClicks > 10) {
      e.stopPropagation();
      e.preventDefault();
      triggerCooldown();
      addButtonClicks = 0; // можно обнулить, чтобы не накапливалось
      if (resetTimer) clearTimeout(resetTimer);
    }
  }, true); // используем capturing, чтобы перехватить до onclick в разметке
});