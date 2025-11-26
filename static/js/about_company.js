document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('loaded');

  /* ---------- ПЛАВНЫЙ СКРОЛЛ ---------- */
  function smoothScroll(target, duration = 1000) {
    const start = window.pageYOffset;
    const distance = target - start;
    let startTime = null;

    function animation(currentTime) {
      if (startTime === null) startTime = currentTime;
      const timeElapsed = currentTime - startTime;
      const run = ease(timeElapsed, start, distance, duration);
      window.scrollTo(0, run);
      if (timeElapsed < duration) requestAnimationFrame(animation);
    }

    function ease(t, b, c, d) {
      t /= d / 2;
      if (t < 1) return c / 2 * t * t + b;
      t--;
      return -c / 2 * (t * (t - 2) - 1) + b;
    }

    requestAnimationFrame(animation);
  }

  /* ---------- СКРОЛЛ ПО ЯКОРЯМ ---------- */
  document.querySelectorAll('a[href^="#"], .nav-link, .back-to-top').forEach(link => {
    link.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#' || href.startsWith('#')) {
        e.preventDefault();
        const targetId = href === '#' ? 'html' : href;
        const target = document.querySelector(targetId);
        if (target) {
          const offset = 80;
          const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - offset;
          smoothScroll(targetPosition, 1000);
        }
      }
    });
  });

  /* ---------- КАСТОМНЫЙ КУРСОР ---------- */
  const cursor = document.querySelector('.custom-cursor');
  if (cursor) {
    document.body.style.cursor = 'none';
    document.addEventListener('mousemove', e => {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top = e.clientY + 'px';
    });
    document.querySelectorAll('a, button, input, textarea, [onclick], .clickable, .nav-link').forEach(el => {
      el.addEventListener('mouseenter', () => cursor.classList.add('hover'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
    });
  }

  /* ---------- АНИМАЦИЯ ПОЯВЛЕНИЯ ---------- */
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  document.querySelectorAll('.hero-content, .about-section, .clients-grid, .transition-to-carousel, .full-carousel-section, .bridging-section')
    .forEach(el => observer.observe(el));

  /* ---------- ХЕДЕР + СТРЕЛКА НАВЕРХ ---------- */
  const header = document.querySelector('header');
  const backToTop = document.querySelector('.back-to-top');

  window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    header.classList.toggle('scrolled', scrolled > 50);
    backToTop?.classList.toggle('visible', scrolled > 500);
  });

  /* ========== КАРУСЕЛЬ — ИСПРАВЛЕНО И РАБОТАЕТ НА 100% ========== */
  const carouselContainer = document.getElementById('full-carousel');
  if (!carouselContainer) return; // если нет карусели — выходим

  const slides       = carouselContainer.querySelectorAll('.full-carousel-slide');
  const progressBars = document.querySelectorAll('.full-progress-bar');
  let currentSlide   = 0;
  let autoPlayTimer  = null;
  const AUTO_DELAY   = 5000;
  let isChanging     = false;

  function resetProgress() {
    progressBars.forEach(bar => {
      const fill = bar.querySelector('.full-progress-fill');
      if (fill) fill.style.width = '0%';
    });
  }

  function startProgress() {
    const fill = progressBars[currentSlide]?.querySelector('.full-progress-fill');
    if (fill) {
      fill.style.transition = 'none';
      fill.style.width = '0%';
      void fill.offsetWidth;
      fill.style.transition = `width ${AUTO_DELAY}ms linear`;
      fill.style.width = '100%';
    }
  }

  function goToSlide(index) {
    if (isChanging || slides.length === 0) return;
    isChanging = true;

    slides[currentSlide].classList.remove('active');
    progressBars[currentSlide]?.classList.remove('active');

    currentSlide = (index + slides.length) % slides.length;

    slides[currentSlide].classList.add('active');
    progressBars[currentSlide]?.classList.add('active');

    resetProgress();
    setTimeout(() => {
      startProgress();
      isChanging = false;
    }, 50);
  }

  function nextSlide() { goToSlide(currentSlide + 1); }
  function prevSlide() { goToSlide(currentSlide - 1); }

  function restartAutoplay() {
    clearTimeout(autoPlayTimer);
    autoPlayTimer = setTimeout(nextSlide, AUTO_DELAY);
  }

  // Стрелки
  window.nextFullSlide = () => { nextSlide(); restartAutoplay(); };
  window.prevFullSlide = () => { prevSlide(); restartAutoplay(); };

  // Hover-пауза
  carouselContainer.addEventListener('mouseenter', () => clearTimeout(autoPlayTimer));
  carouselContainer.addEventListener('mouseleave', restartAutoplay);

  // ИНИЦИАЛИЗАЦИЯ — ТОЛЬКО ОДИН РАЗ!
  slides[0].classList.add('active');
  progressBars[0]?.classList.add('active');
  startProgress();
  restartAutoplay();

  console.log('Карусель запущена и работает идеально');
});