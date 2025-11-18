
    const lightZone = document.getElementById('lightZone');
    const whiteOverlay = document.getElementById('whiteOverlay');
    const hero = document.getElementById('hero');
    const footer = document.getElementById('footer');
    const sideCatalog = document.getElementById('sideCatalog');
    document.getElementById('carouselSection').classList.remove('hidden');

    window.addEventListener('scroll', () => {
      const rect = lightZone.getBoundingClientRect();
      const distanceFromTop = rect.top;
      const startOffset = window.innerHeight * 13.4; // начинаем рано

      const triggerPoint = startOffset;
      const snapPoint = startOffset * 0.92; // когда включаем "щелчок"

      if (distanceFromTop < triggerPoint) {
        const progress = (triggerPoint - distanceFromTop) / (triggerPoint + window.innerHeight);
        const clamped = Math.min(Math.max(progress, 0), 1);

        // Фаза 1: плавно
        whiteOverlay.classList.add('active');
        whiteOverlay.classList.remove('snapped');

        // Фаза 2: ускоряем под конец
        if (clamped > 0.93) {
          whiteOverlay.classList.add('snapped');
          lightZone.classList.add('normal');
          footer.classList.add('normal');
          hero.classList.add('hidden');
          sideCatalog.classList.add('inverted');
        } else {
          whiteOverlay.classList.remove('snapped');
          lightZone.classList.remove('normal');
          footer.classList.remove('normal');
          hero.classList.remove('hidden');
        }
      } else {
        // Сброс
        whiteOverlay.classList.remove('active', 'snapped');
        lightZone.classList.remove('normal');
        footer.classList.remove('normal');
        hero.classList.remove('hidden');
      }
    });

    // Инверсия шторки
    new IntersectionObserver(([e]) => sideCatalog.classList.toggle('inverted', e.isIntersecting), { threshold: 0.3 })
      .observe(lightZone);

    // Карусель
    const slides = document.querySelectorAll('.slide');
    let i = 0;
    setInterval(() => {
      slides[i].classList.remove('active');
      i = (i + 1) % slides.length;
      slides[i].classList.add('active');
    }, 7000);

    // Футер
    new IntersectionObserver(([e]) => footer.classList.toggle('visible', e.isIntersecting), { threshold: 0.4 })
      .observe(footer);

    // Весь остальной функционал (фильтры, модалка и т.д.) — без изменений
    const catalogItems = document.querySelectorAll('.catalog-list li');
    const searchInput = document.getElementById('search');
    const cards = document.querySelectorAll('.card');
    const grid = document.getElementById('grid');
    const modal = document.getElementById('modal');

    function animateCards() {
      const visible = Array.from(cards).filter(c => c.style.display !== 'none');
      cards.forEach(c => c.classList.remove('visible'));
      visible.forEach((c, i) => setTimeout(() => c.classList.add('visible'), 100 + i * 160));
    }

    function applyFiltersAndSort() {
      const filter = document.querySelector('.catalog-list li.active').dataset.filter;
      const query = searchInput.value.toLowerCase();
      const sort = document.querySelector('.sort-btn.active')?.dataset.sort || 'default';

      let filtered = Array.from(cards).filter(card => {
        const cat = filter === 'all' || card.dataset.category === filter;
        const text = card.textContent.toLowerCase().includes(query);
        return cat && text;
      });

      if (sort === 'price') filtered.sort((a, b) => +a.dataset.price - +b.dataset.price);

      filtered.forEach((c, i) => c.style.order = i);
      cards.forEach(c => c.style.display = filtered.includes(c) ? 'block' : 'none');
      setTimeout(animateCards, 50);
    }

    document.querySelectorAll('.grid-btn').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('.grid-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      grid.className = 'grid' + (b.dataset.cols === '2' ? ' cols-2' : '');
    }));

    document.querySelectorAll('.sort-btn, .catalog-list li').forEach(el => {
      el.addEventListener('click', () => {
        if (el.classList.contains('sort-btn')) {
          document.querySelectorAll('.sort-btn').forEach(x => x.classList.remove('active'));
          el.classList.add('active');
        } else {
          catalogItems.forEach(x => x.classList.remove('active'));
          el.classList.add('active');
        }
        applyFiltersAndSort();
      });
    });

    searchInput.addEventListener('input', applyFiltersAndSort);

    cards.forEach(c => c.addEventListener('click', () => {
      document.getElementById('modal-img').src = c.querySelector('img').src;
      document.getElementById('modal-title').textContent = c.querySelector('h3').textContent;
      document.getElementById('modal-desc').textContent = c.querySelector('p').textContent;
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }));

    document.querySelector('.close').onclick = modal.onclick = e => {
      if (e.target === modal || e.target.classList.contains('close')) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
      }
    };

    window.addEventListener('load', () => setTimeout(animateCards, 600));

// === RICK OWENS ARROW HINT — ВСЕГДА ВИДНА, АДАПТИВНЫЙ ЦВЕТ ===
const catalogArrowHint = document.getElementById('catalogArrowHint');
let arrowTimeout;

function showArrow() {
  clearTimeout(arrowTimeout);
  catalogArrowHint.classList.remove('visible');
  arrowTimeout = setTimeout(() => {
    catalogArrowHint.classList.add('visible');
  }, 1400);
}

function hideArrow() {
  clearTimeout(arrowTimeout);
  catalogArrowHint.classList.remove('visible');
}

// Инициализация
window.addEventListener('load', showArrow);

// Отслеживаем переход
window.addEventListener('scroll', () => {
  const snapped = whiteOverlay.classList.contains('snapped');
  const inLightZone = snapped;

  // Меняем цвет
  if (inLightZone) {
    catalogArrowHint.classList.add('inverted');
  } else {
    catalogArrowHint.classList.remove('inverted');
  }

  // Показываем ВСЕГДА (кроме наведения)
  showArrow();
});



// Скрываем при наведении
sideCatalog.addEventListener('mouseenter', hideArrow);
sideCatalog.addEventListener('mouseleave', showArrow);
