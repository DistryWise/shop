// === ЛОАДЕР + ТЕМА + СВАЙП + КНОПКА НАВЕРХ ===
const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
  document.documentElement.setAttribute('data-theme', savedTheme);
} else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
  document.documentElement.setAttribute('data-theme', 'light');
}

// Лоадер — исчезает через 3.4 секунды (как у тебя было)
setTimeout(() => {
  document.body.classList.add('loaded');
  document.getElementById('loader')?.remove();
}, 1800);

// Показ полоски свайпа после скролла
window.addEventListener('scroll', () => {
  document.body.classList.toggle('scrolled', window.scrollY > 300);
});

// Кнопка наверх
const btnTop = document.getElementById('btnTop');
window.addEventListener('scroll', () => {
  btnTop.classList.toggle('visible', window.scrollY > 600);
});
btnTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// Свайп назад (iOS-style)
let startX = 0;
const hint = document.querySelector('.swipe-back-hint');
document.addEventListener('touchstart', e => startX = e.touches[0].clientX, { passive: true });
document.addEventListener('touchmove', e => {
  if (!startX || window.innerWidth > 1023) return;
  const diffX = e.touches[0].clientX - startX;
  if (diffX > 60 && startX < 50) {
    hint?.classList.add('active');
    clearTimeout(window.backTimeout);
    window.backTimeout = setTimeout(() => history.back(), 120);
  }
}, { passive: true });
document.addEventListener('touchend', () => {
  hint?.classList.remove('active');
  clearTimeout(window.backTimeout);
  startX = 0;
}, { passive: true });
