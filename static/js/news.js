

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

// === КУРСОР ===
const cursor = document.querySelector('.custom-cursor');
if (cursor) {
  document.addEventListener('mousemove', e => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
  });
}

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
  let timeout;

  cartBtn.addEventListener('mouseenter', () => {
    clearTimeout(timeout);
    miniCart.style.display = 'block';
    setTimeout(() => miniCart.classList.add('show'), 10);
  });

  const hideCart = () => {
    miniCart.classList.remove('show');
    timeout = setTimeout(() => {
      miniCart.style.display = 'none';
    }, 350);
  };

  cartBtn.addEventListener('mouseleave', hideCart);
  miniCart.addEventListener('mouseenter', () => clearTimeout(timeout));
  miniCart.addEventListener('mouseleave', hideCart);
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