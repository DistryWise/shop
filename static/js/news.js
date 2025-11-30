

// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
let newsData = [];
const sampleNews = [
  { title: "AI Revolutionizes Brand Identity", date: "11 ноября 2025", short_desc: "Кейс Piligrim AI Studio.", full_desc: "Генерация брендбуков за 3 минуты.", image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80", product_id: 1 },
  { title: "Dark Mode Design Trends 2025", date: "8 ноября 2025", short_desc: "94% премиум-сайтов используют тёмную тему.", full_desc: "Снижение нагрузки на глаза на 40%.", image: "https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=800&q=80", product_id: 2 }
];

// === ОБЪЯВЛЕНИЯ ДО DOMContentLoaded ===
const contactForm = document.getElementById('contactForm');
const submitBtn = document.getElementById('submitBtn');
const feedbackModal = document.getElementById('feedbackModal');

let currentSlide = 0;
let slideInterval = null;

window.openNewsModal = function(index) {
  const item = newsData[index];
  if (!item) return;

  const modal        = document.getElementById('finalNewsModal');
  const hero         = document.getElementById('finalHero');
  const content      = document.getElementById('finalContent');
  const carousel     = document.getElementById('finalCarousel');
  const dots         = document.getElementById('finalDots');
  const scrollContainer = modal.querySelector('.final-container'); // ← ЭТО КЛЮЧ

  // === Заполняем контент ===
  const images = (item.images && item.images.length) ? item.images : [item.image || '/static/assets/no-image.png'];
  
  carousel.innerHTML = images.map(src => 
    `<div class="final-slide" style="background-image:url('${src}')"></div>`
  ).join('');
  
  dots.innerHTML = images.map((_, i) => 
    `<div class="final-dot ${i === 0 ? 'active' : ''}" onclick="goToSlide(${i})"></div>`
  ).join('');

  document.getElementById('finalDate').textContent  = item.date || '';
  document.getElementById('finalTitle').textContent = item.title || '';
  document.getElementById('finalLead').textContent  = item.short_desc || '';
  document.getElementById('finalBody').innerHTML    = (item.full_desc || item.short_desc || '').replace(/\n/g, '<br><br>');

  // === Открываем модалку ===
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  // Сброс состояния
  hero.classList.remove('scrolled');
  content.classList.remove('visible');
  scrollContainer.scrollTop = 0;

  // === ОТСЛЕЖИВАНИЕ СКРОЛЛА (РАБОТАЕТ НА 100%) ===
  const handleScroll = () => {
    const scrolled = scrollContainer.scrollTop > 80; // можно 50, 100 — как нравится

    if (scrolled) {
      hero.classList.add('scrolled');
      content.classList.add('visible');
    } else {
      hero.classList.remove('scrolled');
      content.classList.remove('visible');
    }
  };

  // Убираем старый обработчик (чтобы не было дублей)
  scrollContainer.onscroll = null;
  scrollContainer.onscroll = handleScroll;

  // Проверка сразу (если контент короткий)
  handleScroll();
  currentSlide = 0;
  goToSlide(0);
  startAutoSlide();
};

window.closeFinalModal = function() {
  const modal = document.getElementById('finalNewsModal');
  const scrollContainer = modal.querySelector('.final-container');
  
  if (scrollContainer) scrollContainer.onscroll = null;
  
  modal.classList.remove('active');
  document.body.style.overflow = '';
};

window.goToSlide = function(index) {
  const carousel = document.getElementById('finalCarousel');
  const dots = document.querySelectorAll('.final-dot');
  const totalSlides = dots.length;

  if (!carousel || totalSlides === 0) return;

  currentSlide = (index + totalSlides) % totalSlides;

  // Сдвигаем карусель
  carousel.style.transform = `translateX(-${currentSlide * 100}%)`;

  // Обновляем точки
  dots.forEach((dot, i) => {
    dot.classList.toggle('active', i === currentSlide);
  });
};

// Автопрокрутка каждые 5 секунд
function startAutoSlide() {
  stopAutoSlide(); // на всякий случай
  const totalSlides = document.querySelectorAll('.final-slide').length;
  if (totalSlides <= 1) return;

  slideInterval = setInterval(() => {
    currentSlide = (currentSlide + 1) % totalSlides;
    goToSlide(currentSlide);
  }, 5000);
}

function stopAutoSlide() {
  if (slideInterval) {
    clearInterval(slideInterval);
    slideInterval = null;
  }
}

// Перезапуск автопрокрутки при клике по точке
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('final-dot')) {
    startAutoSlide(); // обновляем таймер после ручного переключения
  }
});
// === СТАРТ ===
document.addEventListener('DOMContentLoaded', () => {
  const observer = new IntersectionObserver(e => e.forEach(en => en.isIntersecting && en.target.classList.add('visible')), { threshold: 0.15 });
  observer.observe(document.querySelector('.news-intro'));

  // === БЛОКИРОВКА КНОПКИ ===
  if (contactForm && submitBtn) {
    contactForm.addEventListener('submit', function(e) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="btn-cooldown">Проверка...</span>';
    });
  }

  // === ЗАГРУЗКА НОВОСТЕЙ ===
async function loadNews() {
  try {
    const r = await fetch('/api/home_news');
    if (!r.ok) throw new Error('Failed to fetch');
    newsData = await r.json();
  } catch (err) {
    console.warn('Используем sampleNews:', err);
    newsData = sampleNews;
  }

  const container = document.getElementById('newsFeed');
  if (!container) return;

  container.innerHTML = '';

  newsData.forEach((item, i) => {
    const card = document.createElement('div');
    card.className = 'news-card';
    card.dataset.category = item.category || ''; // ← обязательно!

    const mainImg = item.images?.[0] || item.image || '/static/assets/no-image.png';

    card.innerHTML = `
      <div class="news-card-image-wrapper">
        <img src="${mainImg}" alt="${item.title}" class="news-card-image" 
             onerror="this.src='/static/assets/no-image.png'">
      </div>
      <div class="news-card-content">
        ${item.category ? `<span class="news-card-category">${item.category}</span>` : ''}
        <h3>${item.title}</h3>
        <p class="news-card-date">${item.date}</p>
        <p class="news-card-excerpt">${item.short_desc}</p>
        <a href="#" class="news-card-link" onclick="openNewsModal(${i}); return false;">
          Читать далее →
        </a>
      </div>
    `;

    container.appendChild(card);
  });

  // ← ВАЖНО: вызываем после того, как newsData заполнена!
  initNewsFilters();
}

  // === КАРТОЧКА ТОВАРА ===
  const productModal = document.getElementById('productModal');
  const closeProductModal = document.getElementById('closeProductModal');

  window.openProductModal = async (id) => {
    if (!productModal) return;
    productModal.classList.add('show');
    document.body.style.overflow = 'hidden';

    try {
      const res = await fetch(`/api/product?id=${id}`);
      const p = res.ok ? await res.json() : {
        title: 'Тестовый товар', price: 9990, rating: 4.8, reviews: 127,
        description: 'Премиальный товар с уникальным дизайном.', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80'
      };

      document.getElementById('productImg').src = p.image;
      document.getElementById('productTitle').textContent = p.title;
      document.getElementById('productPrice').textContent = `${p.price.toLocaleString()} ₽`;
      document.getElementById('productDescription').textContent = p.description;

      const stars = document.querySelector('.stars');
      stars.innerHTML = '';
      for (let i = 1; i <= 5; i++) {
        stars.innerHTML += `<i class="fas fa-star${i <= Math.round(p.rating) ? '' : i - 0.5 <= p.rating ? '-half-alt' : '-o'}"></i>`;
      }
      document.getElementById('productReviewsCount').textContent = `(${p.reviews || 0})`;

      document.getElementById('addToCartModal').onclick = () => {
        addToCart({ id, title: p.title, price: p.price, image: p.image });
        showToast('success', 'Добавлено', `${p.title} в корзине`);
      };
    } catch {
      showToast('error', 'Ошибка', 'Не удалось загрузить товар');
    }
  };

  const closeProduct = () => {
    productModal.classList.remove('show');
    document.body.style.overflow = '';
  };

  if (closeProductModal) closeProductModal.onclick = closeProduct;
  if (productModal) {
    productModal.onclick = (e) => { if (e.target === productModal) closeProduct(); };
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && productModal?.classList.contains('show')) closeProduct();
  });

  // === ОБРАТНАЯ СВЯЗЬ ===
  const openFeedback = () => {
    if (feedbackModal) {
      feedbackModal.style.display = 'flex';
      setTimeout(() => feedbackModal.classList.add('show'), 10);
    }
  };

  const closeFeedback = () => {
    if (feedbackModal) {
      feedbackModal.classList.remove('show');
      setTimeout(() => feedbackModal.style.display = 'none', 300);
    }
  };

  document.getElementById('feedbackBtn')?.addEventListener('click', openFeedback);
  document.getElementById('closeFeedback')?.addEventListener('click', closeFeedback);

  if (feedbackModal) {
    feedbackModal.onclick = (e) => {
      if (e.target === feedbackModal) closeFeedback();
    };
  }

  contactForm?.querySelectorAll('input, textarea').forEach(input => {
    input.addEventListener('input', () => {
      if (input.value.trim()) input.style.borderColor = '';
    });
  });

  // === ЗАКРЫТИЕ МОДАЛКИ НОВОСТИ ПО КЛИКУ ВНЕ ИЛИ ESC ===
  const newsModal = document.getElementById('newsModal');
  if (newsModal) {
    newsModal.onclick = (e) => {
      if (e.target === newsModal) closeNewsModal();
    };
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('newsModal')?.classList.contains('show')) {
      closeNewsModal();
    }
  });

  // === СТАРТ ===
  loadNews();
  document.body.classList.add('loaded');
});
  


// === СКРОЛЛ К НОВОСТЯМ ===
window.scrollToNews = () => {
  document.querySelector('.news-feed')?.scrollIntoView({ behavior: 'smooth' });
};



// === КНОПКА ВВЕРХ ===
const backToTop = document.querySelector('.back-to-top');
window.addEventListener('scroll', () => {
  backToTop.classList.toggle('visible', window.scrollY > 600);
  document.querySelector('header')?.classList.toggle('scrolled', window.scrollY > 50);
});
backToTop.onclick = e => {
  e.preventDefault();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// === ТОСТЫ ===
window.showToast = (type, title, text) => {
  document.querySelectorAll('.toast-alert').forEach(el => el.remove());
  const toast = document.createElement('div');
  toast.className = `toast-alert ${type}`;
  toast.innerHTML = `<div class="alert-text"><strong>${title}</strong><span>${text}</span></div><button class="alert-close">×</button>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 50);
  toast.querySelector('.alert-close').onclick = () => toast.remove();
  setTimeout(() => toast.remove(), 5000);
};

// === ТЕМА ===
const toggle = document.getElementById('theme-toggle');
const html = document.documentElement;

if (localStorage.getItem('theme') === 'light') {
  html.setAttribute('data-theme', 'light');
  if (toggle) toggle.checked = true;
} else {
  html.setAttribute('data-theme', 'dark');
  localStorage.setItem('theme', 'dark');
}

toggle?.addEventListener('change', () => {
  const isLight = toggle.checked;
  html.setAttribute('data-theme', isLight ? 'light' : 'dark');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
});


const cartBtn = document.getElementById('cartBtn');
const miniCart = document.getElementById('miniCartDropdown');

if (cartBtn && miniCart) {
  let hideTimeout = null;

  const showCart = () => {
    clearTimeout(hideTimeout);
    miniCart.style.display = 'block';
    // небольшая задержка, чтобы анимация успела отработать
    requestAnimationFrame(() => miniCart.classList.add('show'));
  };

  const hideCart = () => {
    miniCart.classList.remove('show');
    hideTimeout = setTimeout(() => {
      if (!miniCart.classList.contains('show')) {
        miniCart.style.display = 'none';
      }
    }, 400); // должно совпадать с длительностью transition в CSS (~0.35s → 0.4s)
  };

  // Открываем при наведении на кнопку
  cartBtn.addEventListener('mouseenter', showCart);

  // Закрываем только когда курсор ушёл и с кнопки, и с корзины
  cartBtn.addEventListener('mouseleave', () => {
    // проверяем, ушёл ли курсор в сторону мини-корзины
    if (!miniCart.matches(':hover')) {
      hideCart();
    }
  });

  miniCart.addEventListener('mouseenter', () => {
    clearTimeout(hideTimeout);        // отменяем закрытие, пока над корзиной
  });

  miniCart.addEventListener('mouseleave', hideCart);

  // Дополнительно: если кто-то кликнул вне — тоже закрываем
  document.addEventListener('click', (e) => {
    if (!cartBtn.contains(e.target) && !miniCart.contains(e.target)) {
      hideCart();
    }
  });
}


// ФИНАЛЬНАЯ ВЕРСИЯ — РАБОТАЕТ С ПЕРВОЙ СЕКУНДЫ
function initNewsFilters() {
  const filtersContainer = document.getElementById('newsFilters');
  if (!filtersContainer) return;

  // Генерируем кнопки категорий (если их ещё нет)
  const categories = [...new Set(newsData.map(n => n.category).filter(Boolean))];
  if (filtersContainer.children.length === 1) {
    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'filter-btn';
      btn.dataset.category = cat;
      btn.textContent = cat;
      filtersContainer.appendChild(btn);
    });
  }

  // Один обработчик на весь контейнер
  filtersContainer.addEventListener('click', function(e) {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;

    // Активируем кнопку
    filtersContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const category = btn.dataset.category;

    // Фильтрация
    document.querySelectorAll('.news-card').forEach(card => {
      const cardCat = card.dataset.category || '';
      if (category === 'all' || cardCat === '' || cardCat === category) {
        card.style.display = '';
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        setTimeout(() => {
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
        }, 50);
      } else {
        card.style.display = 'none';
      }
    });
  });

  // ВАЖНО: АВТОМАТИЧЕСКИ АКТИВИРУЕМ "ВСЕ НОВОСТИ" ПРИ ЗАГРУЗКЕ
  const allBtn = filtersContainer.querySelector('[data-category="all"]');
  if (allBtn) {
    allBtn.classList.add('active');
    allBtn.click(); // ← ЭТА СТРОКА ВСЁ ИСПРАВЛЯЕТ!
  }
}

// === ПЕРЕПИСАННАЯ ФУНКЦИЯ loadNews() — только заменить в ней генерацию карточек ===
async function loadNews() {
  try {
    const r = await fetch('/api/home_news');
    newsData = r.ok ? await r.json() : sampleNews;
  } catch {
    newsData = sampleNews;
  }

  const container = document.getElementById('newsFeed');
  if (!container) return;

  container.innerHTML = '';

  newsData.forEach((item, i) => {
    const card = document.createElement('div');
    card.className = 'news-card visible';
    card.dataset.category = item.category || ''; // ← ВОТ ЭТО КЛЮЧЕВОЕ!

    const images = item.images || [];
    const mainImg = images[0] || '/static/assets/no-image.png';

    card.innerHTML = `
      <div class="news-card-image-wrapper">
        <img src="${mainImg}" alt="${item.title}" onerror="this.src='/static/assets/no-image.png'">
      </div>
      <div class="news-card-content">
        ${item.category ? `<span class="news-card-category">${item.category}</span>` : ''}
        <h3>${item.title}</h3>
        <p class="news-card-date">${item.date}</p>
        <p class="news-card-excerpt">${item.short_desc}</p>
        <a href="#" class="news-card-link" onclick="openNewsModal(${i}); return false;">
          Читать далее
        </a>
      </div>
    `;

    container.appendChild(card);
    setTimeout(() => card.classList.add('visible'), i * 150);
  });

  // После загрузки новостей — инициализируем фильтры
  initNewsFilters();
}


// АБСОЛЮТНЫЙ ЯДЕРНЫЙ ФИКС — РАБОТАЕТ ДАЖЕ ЕСЛИ ВСЁ СЛОМАНО
(() => {
  const oldOpen = window.openProductModal;
  if (!oldOpen) return;

  window.openProductModal = async (id, type = 'product') => {
    // Принудительно правильные роуты
    const realType = type === 'service' || type === 'services' ? 'services' : 'goods';
    const url = `/api/${realType}/${id}`;
    
    console.log('ОТКРЫВАЮ КАРТОЧКУ →', url);
    
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        // Перезапускаем старую функцию, но с правильными данными
        document.querySelector('#productTitle').textContent = data.title || 'Товар';
        document.querySelector('#productPrice').textContent = data.price_str || 'Цена по запросу';
        document.querySelector('#productImg').src = (data.image_urls?.[0] || data.image_url || '/static/assets/no-image.png') + '?v=' + Date.now();
        document.querySelector('.product-modal').style.display = 'flex';
        document.body.style.overflow = 'hidden';
        return;
      }
    } catch(e) {}
    
    // Если не сработало — пускаем старую функцию (на случай если она уже исправлена)
    oldOpen(id, type);
  };
})();

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


  window.addEventListener('scroll', () => {
    document.querySelector('main')?.classList.toggle('scrolled', window.scrollY > 100);
  });

  document.addEventListener('DOMContentLoaded', () => {
    // Блокируем скролл
    document.body.style.overflow = 'hidden';

    // Через 1.8 сек — добавляем класс hidden
    setTimeout(() => {
      const loader = document.getElementById('loader');  // ← ИСПРАВЛЕНО
      if (loader) {
        loader.classList.add('hidden');

        // Через 0.7 сек — убираем из DOM
        setTimeout(() => {
          loader.remove();
          document.body.style.overflow = '';
          document.body.classList.add('loaded');
        }, 100);
      }
    }, 1600);
  });


  