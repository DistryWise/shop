

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

// === ОТКРЫТИЕ КРАСИВОЙ МОДАЛКИ НОВОСТИ ===
window.openNewsModal = function(index) {
  const item = newsData[index];
  if (!item) return;

  const modal = document.getElementById('newsModal');
  if (!modal) return;

  document.getElementById('modalNewsImg').src = item.image || '/static/assets/no-image.png';
  document.getElementById('modalNewsDate').textContent = item.date;
  document.getElementById('modalNewsTitle').textContent = item.title;
  document.getElementById('modalNewsContent').innerHTML = `<p>${item.full_desc || item.short_desc}</p>`;

  modal.classList.add('show');
  document.body.style.overflow = 'hidden';
};

// === ЗАКРЫТИЕ МОДАЛКИ ===
window.closeNewsModal = function() {
  const modal = document.getElementById('newsModal');
  if (modal) {
    modal.classList.remove('show');
    document.body.style.overflow = '';
  }
};

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
      newsData = r.ok ? await r.json() : sampleNews;
    } catch {
      newsData = sampleNews;
    }

    const container = document.getElementById('newsFeed');
    if (!container) return;

    container.innerHTML = '';
    newsData.forEach((item, i) => {
      const card = document.createElement('div');
      card.className = 'news-card';
      card.innerHTML = `
        <img src="${item.image}" alt="${item.title}" class="news-card-image" onerror="this.src='https://via.placeholder.com/800x600/111/fff?text=NO+IMAGE'">
        <div class="news-card-content">
          <h3>${item.title}</h3>
          <p class="news-card-date">${item.date}</p>
          <p class="news-card-excerpt">${item.short_desc}</p>
          <a href="#" class="news-card-link" onclick="${
            item.product_id 
              ? `openProductModal(${item.product_id})` 
              : `openNewsModal(${i})`
          }; return false;">
            ${item.product_id ? 'Посмотреть товар' : 'Читать далее'}
          </a>
        </div>
      `;
      container.appendChild(card);
      setTimeout(() => observer.observe(card), i * 250);
    });
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
