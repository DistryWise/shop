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

/* ---------- КАСТОМНЫЙ КУРСОР — ТОЧНО КАК НА contacts.html ---------- */
const cursor = document.querySelector('.custom-cursor');

if (cursor) {
  // Скрываем обычный курсор
  document.body.style.cursor = 'none';

  document.addEventListener('mousemove', e => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
  });

  // При наведении на интерактив — эффект "hover"
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
      observer.unobserve(entry.target); // Оптимизация: больше не следим
    }
  });
}, { threshold: 0.15 });

document.querySelectorAll('.hero-content, .about-section, .clients-grid, .transition-to-carousel, .full-carousel-section, .bridging-section')
  .forEach(el => observer.observe(el));

/* ---------- ЕДИНЫЙ ОБРАБОТЧИК СКРОЛЛА ---------- */
const header = document.querySelector('header');
const backToTop = document.querySelector('.back-to-top');

window.addEventListener('scroll', () => {
  const scrolled = window.pageYOffset;

  // Хедер
  header.classList.toggle('scrolled', scrolled > 50);

  // Стрелка "Наверх" — появляется после 500px
  backToTop.classList.toggle('visible', scrolled > 500);
});

/* ========== КАРУСЕЛЬ: 100% РАБОЧАЯ ========== */
const slides = document.querySelectorAll('.full-carousel-slide');
const progressBars = document.querySelectorAll('.full-progress-bar');
let currentSlide = 0;
let autoPlay;
const autoPlayDelay = 5000;

function resetAllProgress() {
  progressBars.forEach(bar => {
    const fill = bar.querySelector('.full-progress-fill');
    fill.style.transition = 'none';
    fill.style.width = '0%';
  });
}

function startCurrentProgress() {
  const activeBar = progressBars[currentSlide];
  if (!activeBar) return;
  const fill = activeBar.querySelector('.full-progress-fill');
  void fill.offsetHeight; // reflow
  fill.style.transition = `width ${autoPlayDelay}ms linear`;
  fill.style.width = '100%';
}

function showSlide(n) {
  slides[currentSlide].classList.remove('active');
  progressBars[currentSlide].classList.remove('active');

  currentSlide = (n + slides.length) % slides.length;

  slides[currentSlide].classList.add('active');
  progressBars[currentSlide].classList.add('active');

  resetAllProgress();
  setTimeout(startCurrentProgress, 50);
}

// Глобальные функции для стрелок
window.nextFullSlide = () => showSlide(currentSlide + 1);
window.prevFullSlide = () => showSlide(currentSlide - 1);

function startAutoPlay() {
  stopAutoPlay();
  autoPlay = setInterval(() => nextFullSlide(), autoPlayDelay);
}

function stopAutoPlay() {
  if (autoPlay) clearInterval(autoPlay);
  autoPlay = null;
}

// Управление автоплеем при наведении
const container = document.querySelector('#full-carousel');
container.addEventListener('mouseenter', stopAutoPlay);
container.addEventListener('mouseleave', startAutoPlay);

/* ---------- ИНИЦИАЛИЗАЦИЯ КАРУСЕЛИ ---------- */
setTimeout(() => {
  resetAllProgress();
  showSlide(0);
  startAutoPlay();
  console.log('Карусель запущена!');
}, 100);

});