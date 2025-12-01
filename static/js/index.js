

    // === ЭЛИТНЫЙ СКРОЛЛ ===
    let scrollIndex = 0;
    const sections = ['#landing', '#contact', '#faq'];
    let isScrolling = false;

    window.addEventListener('wheel', (e) => {
      if (isScrolling) return;
      isScrolling = true;

      if (e.deltaY > 0) {
        scrollIndex = Math.min(scrollIndex + 1, sections.length - 1);
      } else {
        scrollIndex = Math.max(scrollIndex - 1, 0);
      }

      document.querySelector(sections[scrollIndex]).scrollIntoView({ behavior: 'smooth' });

      setTimeout(() => { isScrolling = false; }, 800);
    });

    function updateScale() {
      const baseWidth = 1200;
      const baseHeight = 675;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const scaleX = viewportWidth / baseWidth;
      const scaleY = viewportHeight / baseHeight;
      const scale = Math.min(scaleX, scaleY);
      document.documentElement.style.setProperty('--scale', scale);
    }



    // === АНИМАЦИЯ ГРАФФИТИ + СТРЕЛКА ===
    function createGraffitiText(element, text, delay = 0) {
      element.innerHTML = '';
      const chars = text.split('');
      chars.forEach((char, i) => {
        const span = document.createElement('span');
        span.textContent = char === ' ' ? '\u00A0' : char;
        
        const rot = (Math.random() - 0.5) * 18;
        const x = (Math.random() - 0.5) * 7;
        const y = (Math.random() - 0.5) * 5;
        
        span.style.setProperty('--rot', `${rot}deg`);
        span.style.setProperty('--x', `${x}px`);
        span.style.setProperty('--y', `${y}px`);
        span.style.animationDelay = `${delay + i * 0.07}s`;
        
        element.appendChild(span);
      });
    }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const left = document.getElementById('graffiti-left');
        const right = document.getElementById('graffiti-right');
        const arrowWrapper = document.querySelector('.simple-arrow-wrapper');

        createGraffitiText(left, "Обратная связь:\nВы можете связаться с нами", 0.4);
        createGraffitiText(right, "Авторизуйтесь по  номеру телефона,  заполните анкету — и мы свяжемся с вами", 1.9);

        // Показать PNG-стрелку через 2.8с
        setTimeout(() => {
          arrowWrapper.classList.add('visible');
        }, 2800);

        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  observer.observe(document.getElementById('contact'));

    function scrollToContact() {
      document.querySelector('#contact').scrollIntoView({ behavior: 'smooth' });
    }

    window.addEventListener('resize', updateScale);
    window.addEventListener('scroll', () => {
      document.querySelector('header').classList.toggle('scrolled', window.scrollY > 50);
    });

    document.querySelectorAll('.faq-item').forEach((el, i) => {
      setTimeout(() => {
        const obs = new IntersectionObserver((e) => {
          e.forEach(en => en.isIntersecting && en.target.classList.add('visible'));
        }, { threshold: 0.3 });
        obs.observe(el);
      }, i * 180);
    });

    updateScale();

    const faqData = [
  { q: "Как оформить заказ?", a: "Добавьте товар в корзину → оформление → менеджер свяжется в течение 15 минут." },
  { q: "Доставка за границу?", a: "Да: DHL, FedEx, EMS. 3–7 дней." },
  { q: "Возврат?", a: "14 дней. За наш счёт." },
  { q: "Оплата криптовалютой?", a: "BTC, ETH, USDT — принимаем." },
  { q: "Есть VIP-клуб?", a: "Да. Скидки до 40%, закрытые коллекции, личный стилист." }
];

function renderFAQ(filter = '') {
  const grid = document.querySelector('.faq-grid');
  grid.innerHTML = '';
  
  const filtered = faqData.filter(item => 
    item.q.toLowerCase().includes(filter.toLowerCase()) ||
    item.a.toLowerCase().includes(filter.toLowerCase())
  );

  filtered.forEach((item, i) => {
    const card = document.createElement('div');
    card.className = 'faq-card';
    card.innerHTML = `
      <div class="question">${item.q}</div>
      <div class="answer">${item.a}</div>
    `;
    card.onclick = () => card.classList.toggle('active');
    card.style.animationDelay = `${i * 0.15}s`;
    grid.appendChild(card);

    // Анимация появления
    setTimeout(() => card.style.opacity = '1', 100);
  });
}

function searchFAQ() {
  const query = document.getElementById('faq-search').value;
  renderFAQ(query);
}

// Инициализация
renderFAQ();

// === КАРУСЕЛЬ — 100% КАК В РЕДАКТОРЕ PILIGRIM 2025 (ФИНАЛЬНАЯ ВЕРСИЯ) ===
document.addEventListener('DOMContentLoaded', () => {
  const slides = document.querySelectorAll('#landing .slide');
  const progressBars = document.querySelectorAll('.progress-bar');
  const inner = document.querySelector('.carousel-inner');
  const nextBtn = document.querySelector('.carousel-arrow.next');
  const prevBtn = document.querySelector('.carousel-arrow.prev');

  let currentSlide = 0;
  let isTransitioning = false;
  let autoTimer = null;
  let homeSlides = [];

  // === ЗАГРУЗКА СЛАЙДОВ С СЕРВЕРА ===
  async function loadCarousel() {
    try {
      const res = await fetch('/api/landing/carousel/home');
      if (!res.ok) throw new Error('API error');
      const data = await res.json();

      homeSlides = data.map(s => ({
        background: s.background?.url || '/static/assets/fallback.jpg',
        layers: (s.layers || []).map(l => ({
          type: l.type,
          content: l.content || '',
          url: l.url || l.src || '',
          style: l.style || {}
        })),
        hotspots: (s.hotspots || []).map(h => ({
          x: parseFloat(h.x) || 0,
          y: parseFloat(h.y) || 0,
          w: parseFloat(h.w) || 10,
          h: parseFloat(h.h) || 10,
          url: h.url || '#'
        }))
      }));

      // Дополняем до 5 слайдов
      while (homeSlides.length < 5) {
        homeSlides.push({ background: '/static/assets/fallback.jpg', layers: [], hotspots: [] });
      }

      // УСТАНАВЛИВАЕМ ФОНЫ ТОЧНО КАК В РЕДАКТОРЕ — БЕЗ ЗУМА!
      slides.forEach((slide, i) => {
        slide.style.cssText = `
          background-image: url("${homeSlides[i].background}") !important;
          background-size: cover !important;
          background-position: center center !important;
          background-repeat: no-repeat !important;
        `;
      });

      renderSlide(0);
      showSlide(0);
      startAutoPlay();
    } catch (err) {
      console.error('Карусель не загрузилась:', err);
      slides.forEach(slide => {
        slide.style.cssText = `
          background-image: url("/static/assets/fallback.jpg") !important;
          background-size: cover !important;
          background-position: center center !important;
        `;
      });
      renderSlide(0);
      showSlide(0);
      startAutoPlay();
    }
  }

  // === РЕНДЕР СЛОЁВ И ХОТСПТОВ (ПИКСЕЛЬ В ПИКСЕЛЬ КАК В РЕДАКТОРЕ) ===
  function renderSlide(index) {
    if (!inner || !homeSlides[index]) return;
    inner.innerHTML = '';

    const slide = homeSlides[index];

    // Слои: текст и картинки
    slide.layers.forEach(layer => {
      const el = document.createElement('div');
      el.className = 'slide-element';

      // Копируем ВСЕ стили из редактора
      Object.assign(el.style, {
        position: 'absolute',
        left: layer.style.left || '0%',
        top: layer.style.top || '0%',
        width: layer.style.width || 'auto',
        height: layer.style.height || 'auto',
        transform: layer.style.transform || 'none',
        transformOrigin: 'center center',
        pointerEvents: 'none',
        zIndex: '10'
      });

      if (layer.type === 'text') {
        el.textContent = layer.content;
        el.style.fontSize = layer.style.fontSize || '48px';
        el.style.color = layer.style.color || '#ffffff';
        el.style.fontFamily = (layer.style.fontFamily || 'Inter') + ', sans-serif';
        el.style.fontWeight = '600';
        el.style.textShadow = '0 4px 30px rgba(0,0,0,0.7)';
        el.style.lineHeight = '1.2';
        el.style.whiteSpace = 'pre-wrap';

        if (layer.style.animation && layer.style.animation !== 'none') {
          el.classList.add('animate__animated', 'animate__' + layer.style.animation);
        }
      }

      if (layer.type === 'image') {
        const img = document.createElement('img');
        img.src = layer.url;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.draggable = false;
        el.appendChild(img);
      }

      inner.appendChild(el);
    });

    // Хотспоты — ТОЧНО КАК В РЕДАКТОРЕ
    slide.hotspots.forEach(h => {
      const spot = document.createElement('a');
      spot.href = h.url;
      spot.target = h.url !== '#' ? '_blank' : '';
      spot.rel = 'noopener';
      spot.className = 'hotspot';
      spot.style.cssText = `
        position: absolute;
        left: ${h.x}%;
        top: ${h.y}%;
        width: ${h.w}%;
        height: ${h.h}%;
        transform: translate(-50%, -50%);
        cursor: pointer;
        z-index: 20;
      `;

      spot.onclick = e => {
        e.stopPropagation();
        if (h.url && h.url !== '#') {
          window.open(h.url, '_blank');
          fetch('/api/landing/click', {
            method: 'POST',
            body: JSON.stringify({ kind: 'home', slide: index, url: h.url }),
            headers: { 'Content-Type': 'application/json' }
          }).catch(() => {});
        }
      };

      inner.appendChild(spot);
    });
  }

  // === ПЕРЕКЛЮЧЕНИЕ СЛАЙДОВ ===
    // === ПЕРЕЗАПУСК АВТОПЛЕЯ ПОСЛЕ ЛЮБОГО ПЕРЕКЛЮЧЕНИЯ (главное исправление) ===
  function showSlide(n) {
    if (isTransitioning) return;
    isTransitioning = true;

    slides[currentSlide].classList.remove('active');
    progressBars[currentSlide].classList.remove('active');

    currentSlide = (n + slides.length) % slides.length;

    slides[currentSlide].classList.add('active');
    progressBars[currentSlide].classList.add('active');

    renderSlide(currentSlide);
    resetProgressBar();
    startAutoPlay();        // ← вот эта строчка делает автоплей вечным

    setTimeout(() => isTransitioning = false, 400);
  }

  function nextSlide() { showSlide(currentSlide + 1); }
  function prevSlide() { showSlide(currentSlide - 1); }

  // Стрелки
  nextBtn?.addEventListener('click', e => { e.stopPropagation(); nextSlide(); });
  prevBtn?.addEventListener('click', e => { e.stopPropagation(); prevSlide(); });

// ——— СВАЙПЫ НА МОБИЛКЕ (один раз вставить) ———
// ——— СВАЙПЫ НА МОБИЛКЕ — НОВЫЙ 2025 ВАРИАНТ (работает + скролл вниз!) ———
let touchStartX = 0;
let touchStartY = 0;

document.querySelector('.carousel-container')?.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

document.querySelector('.carousel-container')?.addEventListener('touchend', e => {
  if (!touchStartX || !touchStartY) return;

  const touchEndX = e.changedTouches[0].clientX;
  const touchEndY = e.changedTouches[0].clientY;

  const diffX = touchStartX - touchEndX;
  const diffY = touchStartY - touchEndY;

  // Главное волшебство: если пользователь тянул больше вниз/вверх — это скролл страницы
  if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 30) {
    // Это вертикальный свайп → ничего не делаем, пусть страница скроллится
    touchStartX = touchStartY = 0;
    return;
  }

  // Если же тянул больше влево/вправо — переключаем слайд (твой старый код)
  if (Math.abs(diffX) > 50) {
    if (diffX > 0) {
      nextSlide();    // влево → следующий
    } else {
      prevSlide();    // вправо → предыдущий
    }
    document.querySelector('.carousel-container').classList.add('swiped');
  }

  touchStartX = touchStartY = 0;
}, { passive: true });
  
  // === ПРОГРЕСС-БАР ===
  function resetProgressBar() {
    progressBars.forEach((bar, i) => {
      const fill = bar.querySelector('.progress-fill');
      fill.style.transition = 'none';
      fill.style.width = '0%';
      void fill.offsetWidth;
      if (i === currentSlide) {
        fill.style.transition = 'width 5s linear';
        fill.style.width = '100%';
      }
    });
  }

  // === АВТОПЛЕЙ ===
  function startAutoPlay() {
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => {
      nextSlide();
      startAutoPlay();
    }, 5000);
  }

  // Пауза при наведении
  document.querySelector('.carousel-content')?.addEventListener('mouseenter', () => clearTimeout(autoTimer));
  document.querySelector('.carousel-content')?.addEventListener('mouseleave', startAutoPlay);

  // Стрелки — работают!
  nextBtn?.addEventListener('click', e => { e.stopPropagation(); nextSlide(); });
  prevBtn?.addEventListener('click', e => { e.stopPropagation(); prevSlide(); });

  // Клавиши ← →
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') nextSlide();
    if (e.key === 'ArrowLeft') prevSlide();
  });

  // Кнопка "Главная" — возвращает карусель
  document.querySelector('a[href="#landing"]')?.addEventListener('click', e => {
    e.preventDefault();
    document.querySelector('#landing').scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => {
      currentSlide = -1;
      showSlide(0);
      startAutoPlay();
    }, 700);
  });

  // === ЗАПУСК ===
  loadCarousel();
});

  // === УЛЬТРА-ФИКС: ОТКРЫТИЕ КАРТОЧКИ ТОВАРА ЛЮБЫМ СПОСОБОМ ===
  document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('productModal');
    if (!modal) return;

    // 1. Следим за display (search.js)
    const observer = new MutationObserver(() => {
      const display = window.getComputedStyle(modal).display;
      if (display !== 'none') {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      } else {
        modal.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['style'] });

    // 2. Клик вне или на крестик
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.closest('.close-modal')) {
        modal.style.display = 'none';
        modal.classList.remove('active');
        document.body.style.overflow = '';
      }
    });

    // 3. Esc
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        modal.style.display = 'none';
        modal.classList.remove('active');
        document.body.style.overflow = '';
      }
    });

    // 4. Принудительно скрываем при загрузке
    modal.style.display = 'none';
    modal.classList.remove('active');
  });

  

// === ФИНАЛЬНАЯ ВЕРСИЯ 6.0 — ВСЁ РАБОТАЕТ: ОТПРАВКА, АЛЕРТЫ, BACKSPACE, ИЗМЕНИТЬ ===
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('.contact-form');
  const submitBtn = form.querySelector('button[type="submit"]');
  const phoneWrapper = form.querySelector('.phone-field-wrapper') || form.querySelector('input[type="tel"]').parentNode;
  const phoneInput = form.querySelector('input[type="tel"]');
  let isCooldown = false;
  const COOLDOWN_KEY = 'feedback_cooldown_until';

  // Флаг: пользователь нажал "Изменить" → автозаполнение отключено
  let userChangedPhone = false;

  // Кнопка "Изменить"
  const changeBtn = document.createElement('button');
changeBtn.type = 'button';
changeBtn.textContent = 'Изменить';
changeBtn.className = 'change-phone-btn';
changeBtn.style.cssText = `
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  background: rgba(255,255,255,0.15); color: #fff; border: none; border-radius: 12px;
  padding: 7px 14px; font-size: 0.85rem; font-weight: 600; cursor: pointer; z-index: 10;
  opacity: 0; pointer-events: none; transition: all 0.32s ease; backdrop-filter: blur(10px);

  /* ← ДОБАВЛЕНО: адаптив + светлая тема (всего 5 строк) */
  font-family: 'Inter', sans-serif;
  box-shadow: 0 4px 12px rgba(0,0,0,0.25);
  ${document.documentElement.getAttribute('data-theme') === 'light' 
    ? 'background: rgba(0,0,0,0.1) !important; color: #111 !important; box-shadow: 0 4px 15px rgba(0,0,0,0.18) !important;' 
    : ''
  }
  ${window.innerWidth <= 480 
    ? 'padding: 9px 16px; font-size: 0.92rem; right: 8px;' 
    : ''
  }
`;

phoneWrapper.style.position = 'relative';
phoneWrapper.appendChild(changeBtn);

  // === ПОЛУЧЕНИЕ НОМЕРА ===
  const getCurrentPhone = () => {
    let phone = sessionStorage.getItem('phone');
    if (phone && phone.length === 10) return phone;
    phone = localStorage.getItem('phone');
    if (phone && phone.length === 10) {
      sessionStorage.setItem('phone', phone);
      return phone;
    }
    return null;
  };
  const isAuthenticated = () => !!getCurrentPhone();

  // === ФОРМАТИРОВАНИЕ ===
  const formatPhone = (digits) => {
    if (!digits || digits.length < 1) return '';
    let r = '+7';
    if (digits.length > 1) r += ` (${digits.slice(1,4)}`;
    if (digits.length >= 4) r += `) ${digits.slice(4,7)}`;
    if (digits.length >= 7) r += `-${digits.slice(7,9)}`;
    if (digits.length >= 9) r += `-${digits.slice(9,11)}`;
    return r;
  };

  // === АВТОЗАПОЛНЕНИЕ ===
  const autofillPhone = () => {
    if (userChangedPhone) return;
    if (!isAuthenticated()) {
      phoneInput.value = '';
      changeBtn.style.opacity = '0';
      changeBtn.style.pointerEvents = 'none';
      return;
    }
    const saved = getCurrentPhone();
    if (saved) {
      phoneInput.value = formatPhone('7' + saved);
      changeBtn.style.opacity = '1';
      changeBtn.style.pointerEvents = 'auto';
    }
  };

  // === САМАЯ УМНАЯ МАСКА В МИРЕ (Backspace везде работает!) ===
  phoneInput.addEventListener('input', function(e) {
    const cursorPos = this.selectionStart;
    const oldValue = this.value;

    let digits = this.value.replace(/\D/g, '');
    if (digits.startsWith('7')) digits = digits.slice(1);
    if (digits.length > 10) digits = digits.slice(0, 10);

    const newValue = digits ? formatPhone('7' + digits) : '';
    this.value = newValue;

    const wasDeletion = e.inputType?.includes('delete') || oldValue.length > newValue.length;

    let newPos = cursorPos;
    if (wasDeletion) {
      while (newPos > 3 && !/\d/.test(newValue[newPos - 1] || '')) newPos--;
    } else {
      while (newPos < newValue.length && !/\d/.test(newValue[newPos] || '')) newPos++;
    }
    newPos = Math.max(3, Math.min(newPos, newValue.length));

    requestAnimationFrame(() => this.setSelectionRange(newPos, newPos));

    const isFull = newValue.length >= 18;
    changeBtn.style.opacity = isFull ? '1' : '0';
    changeBtn.style.pointerEvents = isFull ? 'auto' : 'none';
  });

  phoneInput.addEventListener('focus', () => {
    if (!phoneInput.value && !userChangedPhone) {
      phoneInput.value = '+7';
      requestAnimationFrame(() => phoneInput.setSelectionRange(3, 3));
    }
  });

  phoneInput.addEventListener('keydown', e => {
    if (e.key === 'Backspace' && phoneInput.selectionStart <= 3 && phoneInput.value === '+7') {
      e.preventDefault();
    }
  });

  changeBtn.addEventListener('click', () => {
    userChangedPhone = true;
    phoneInput.value = '+7';
    phoneInput.focus();
    requestAnimationFrame(() => phoneInput.setSelectionRange(3, 3));
    changeBtn.style.opacity = '0';
    changeBtn.style.pointerEvents = 'none';
  });

  // === КУЛДАУН ===
  const startCooldown = (seconds = 30) => {
    isCooldown = true;
    const until = Date.now() + seconds * 1000;
    sessionStorage.setItem(COOLDOWN_KEY, until);
    const tick = () => {
      const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      if (left > 0) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `Ждите... ${left}s`;
        setTimeout(tick, 1000);
      } else {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Отправить';
        isCooldown = false;
        sessionStorage.removeItem(COOLDOWN_KEY);
      }
    };
    tick();
  };
  const checkCooldown = () => {
    const saved = sessionStorage.getItem(COOLDOWN_KEY);
    if (saved && parseInt(saved) > Date.now()) {
      startCooldown(Math.ceil((parseInt(saved) - Date.now()) / 1000));
    }
  };
  checkCooldown();

  // === ОТПРАВКА ФОРМЫ (ВСЁ ПОЛНОСТЬЮ РАБОТАЕТ) ===
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    if (isCooldown) return;

    // Проверка авторизации
    if (!isAuthenticated()) {
      document.getElementById('authBtn')?.click();
      return;
    }

    // Проверка остальных полей
    let hasError = false;
    form.querySelectorAll('input[required], textarea[required]').forEach(field => {
      if (field !== phoneInput && !field.value.trim()) {
        field.style.borderColor = '#ff5555';
        hasError = true;
      } else {
        field.style.borderColor = '';
      }
    });

    // Проверка телефона (должен быть полным)
    const phoneDigits = phoneInput.value.replace(/\D/g, '');
    if (phoneDigits.length !== 11) hasError = true;

    if (hasError) {
      document.getElementById('feedbackErrorModal')?.classList.add('show');
      setTimeout(() => document.getElementById('feedbackErrorModal')?.classList.remove('show'), 3000);
      return;
    }

    // Отправка
        // РЕАЛЬНАЯ ОТПРАВКА НА СЕРВЕР
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';

    fetch('/api/feedback', {                  // ← если у тебя другой путь — поменяй только здесь
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]')?.value || 
                       document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
      },
      body: JSON.stringify({
        name:    form.querySelector('input[placeholder="Имя"]').value.trim(),
        phone:   '+' + phoneInput.value.replace(/\D/g, ''),
        email:   form.querySelector('input[type="email"]').value.trim(),
        message: form.querySelector('textarea').value.trim()
      })
    })
    .then(r => {
      if (!r.ok) throw new Error('Server error ' + r.status);
      return r.json();
    })
    .then(() => {
      // УСПЕШНО
      document.getElementById('feedbackModal')?.classList.add('show');
      setTimeout(() => document.getElementById('feedbackModal')?.classList.remove('show'), 3000);

      form.querySelectorAll('input, textarea').forEach(f => {
        if (f !== phoneInput) f.value = '';
      });

      submitBtn.innerHTML = 'Отправлено!';
      setTimeout(() => {
        submitBtn.innerHTML = 'Отправить';
        submitBtn.disabled = false;
      }, 800);

      startCooldown(30);
    })

    });

  // === СЛЕЖЕНИЕ ЗА АВТОРИЗАЦИЕЙ ===
  const updatePhoneField = () => {
    if (userChangedPhone) return;
    autofillPhone();
  };

  updatePhoneField();
  window.addEventListener('authChanged', updatePhoneField);
  window.addEventListener('userLoggedOut', () => {
    userChangedPhone = false;
    updatePhoneField();
  });
  setInterval(updatePhoneField, 2000);

  // Дублирование телефона при входе/выходе
  const origSet = sessionStorage.setItem;
  sessionStorage.setItem = function(k, v) {
    if (k === 'phone' && v?.length === 10) localStorage.setItem('phone', v);
    return origSet.call(this, k, v);
  };
  const origRemove = sessionStorage.removeItem;
  sessionStorage.removeItem = function(k) {
    if (k === 'phone') {
      localStorage.removeItem('phone');
      userChangedPhone = false;
      updatePhoneField();
    }
    return origRemove.call(this, k);
  };
});

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
<style>
@keyframes slideDown {
  from { transform: translateX(-50%) translateY(-100px); opacity: 0; }
  to   { transform: translateX(-50%) translateY(0); opacity: 1; }
}
#global-cart-flood-alert i { font-size: 1.8rem; }
</style>
`);

// УЛЬТРА-КРАСИВАЯ АДМИН-ИКОНКА В ХЕДЕРЕ — 2025 СТИЛЬ
const ADMIN_CHECK_INTERVAL = setInterval(async () => {
  try {
    const res = await fetch('/api/session');
    if (!res.ok) return;
    const data = await res.json();

    const isAdmin = data.is_real_admin || 
                    data.real_admin || 
                    data.is_admin || 
                    data.admin || 
                    data.is_staff || 
                    data.superuser || 
                    data.role === "admin" || 
                    data.role === "administrator";

    if (isAdmin && !document.getElementById('adminHeaderBtn')) {
      // Удаляем проверку каждые 2 сек — больше не нужна
      clearInterval(ADMIN_CHECK_INTERVAL);

      // Вставляем иконку в хедер (рядом с корзиной)
      const headerIcons = document.querySelector('.header-icons');
      if (!headerIcons) return;

      headerIcons.insertAdjacentHTML('beforeend', `
  <a href="/admin" id="adminHeaderBtn" class="icon-btn admin-glow" title="Админ-панель">
    <svg viewBox="0 0 100 100" width="28" height="28" class="admin-svg">
      <defs>
        <linearGradient id="adminGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ff00cc"/>
          <stop offset="100%" stop-color="#ff3399"/>
        </linearGradient>
      </defs>
      
      <!-- Тонкая чёрная рамка (видна только в светлой теме) -->
      <circle cx="50" cy="50" r="48" fill="none" stroke="#000" stroke-width="1" opacity="0.12"/>
      
      <!-- Основной градиентный круг -->
      <circle cx="50" cy="50" r="44" fill="none" stroke="url(#adminGrad)" stroke-width="8"/>
      
      <!-- Буква A -->
      <text x="50" y="68" text-anchor="middle" fill="white" font-size="38" font-weight="900" font-family="Arial Black">A</text>
    </svg>
    <span class="admin-pulse"></span>
  </a>
`);

      console.log("АДМИН-ИКОНКА В ХЕДЕРЕ АКТИВИРОВАНА — ДОСТУП РАЗРЕШЁН");

      // Добавляем CSS-анимацию пульсации
      const style = document.createElement('style');
      style.textContent = `
        #adminHeaderBtn {
          position: relative;
          animation: adminFloat 4s ease-in-out infinite;
        }
        .admin-pulse {
          position: absolute;
          top: 50%; left: 50%;
          width: 36px; height: 36px;
          background: radial-gradient(circle, #ff00ff 0%, transparent 70%);
          border-radius: 50%;
          transform: translate(-50%, -50%);
          animation: adminPulse 2s infinite;
          pointer-events: none;
        }
        @keyframes adminPulse {
          0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.8; }
          70% { transform: translate(-50%, -50%) scale(1.6); opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(1.8); opacity: 0; }
        }
        @keyframes adminFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .icon-btn.admin-glow:hover {
          transform: scale(1.15);
          filter: drop-shadow(0 0 16px #ff00ff) !important;
        }
      `;
      document.head.appendChild(style);
    }
  } catch (e) {}
}, 1800); // проверяем каждые 1.8 сек — быстрее реагирует

// Привязываем скролл к ВСЕМ кнопкам с id="feedbackBtn" (и десктоп, и мобильная)
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#feedbackBtn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Плавный скролл к блоку обратной связи
      document.querySelector('#contact').scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });

      // Опционально: можно подсветить форму
      setTimeout(() => {
        document.querySelector('.contact-form')?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }, 600);
    });
  });
});

// Пересчёт 100vh на мобильных (фикс бага с адресной строкой)
function setVH() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}
setVH();
window.addEventListener('resize', setVH);
window.addEventListener('orientationchange', () => setTimeout(setVH, 100));
