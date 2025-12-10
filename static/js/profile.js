
  document.addEventListener('DOMContentLoaded', () => {
    const loader = document.querySelector('.loader');
    setTimeout(() => {
      loader.classList.add('hidden');
    }, 900); 
  });

// =================== contacts-mini.js — только то, что нужно для news.html ===================
document.addEventListener("DOMContentLoaded", () => {
  // === ПРЕЛОАДЕР ===
  const loader = document.getElementById('loader');
  if (loader) {
    setTimeout(() => {
      loader.style.opacity = '0';
      setTimeout(() => loader.remove(), 600);
    }, 400);
  }

  // === BACK TO TOP ===
  const backIoTop = document.querySelector('.back-to-top');
  if (backIoTop) {
    window.addEventListener('scroll', () => {
      backIoTop.classList.toggle('visible', window.scrollY > 600);
    });
    backIoTop.addEventListener('click', e => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // === ТЕМА (безопасно, даже если два toggle) ===
  const applyTheme = () => {
    const saved = localStorage.getItem('theme');
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    const theme = saved || (prefersLight ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);

    document.querySelectorAll('#theme-toggle, #theme-toggle-hanging').forEach(el => {
      if (el) el.checked = (theme === 'light');
    });
  };
  applyTheme();

  document.addEventListener('change', e => {
    if (e.target.matches('#theme-toggle, #theme-toggle-hanging')) {
      const isLight = e.target.checked;
      document.documentElement.setAttribute('data-theme', isLight ? 'light' : 'dark');
      localStorage.setItem('theme', isLight ? 'light' : 'dark');
    }
  });

  // === МОБИЛЬНЫЙ САЙДБАР (свайп влево) — ИСПРАВЛЕННАЯ ВЕРСИЯ БЕЗ ОШИБОК ===
  const sidebar = document.getElementById('mobileSidebar');
  if (sidebar) {
    let startX = 0, isDragging = false;
    const threshold = 80;

    const close = () => {
      sidebar.classList.remove('active');
      document.body.classList.remove('sidebar-open');
    };

    const handleStart = e => {
      if (!sidebar.classList.contains('active')) return;
      startX = e.touches?.[0].clientX || e.clientX;
      isDragging = true;
      sidebar.style.transition = 'none';
    };

    const handleMove = e => {
      if (!isDragging) return;
      const x = e.touches?.[0].clientX || e.clientX;
      const diff = x - startX;
      if (diff < 0) {
        e.preventDefault();
        sidebar.style.transform = `translateX(${diff}px)`;
      }
    };

    const handleEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      const diff = (event?.changedTouches?.[0]?.clientX || event?.clientX || startX) - startX;
      if (diff < -threshold) {
        sidebar.style.transition = 'transform 0.4s ease';
        sidebar.style.transform = 'translateX(-100%)';
        setTimeout(() => {
          close();
          sidebar.style.transition = '';
          sidebar.style.transform = '';
        }, 400);
      } else {
        sidebar.style.transition = 'transform 0.3s ease';
        sidebar.style.transform = 'translateX(0)';
        setTimeout(() => sidebar.style.transition = '', 300);
      }
    };

    // Открытие
    document.getElementById('openSidebarMenu')?.addEventListener('click', () => {
      sidebar.classList.add('active');
      document.body.classList.add('sidebar-open');
    });

    document.getElementById('closeSidebar')?.addEventListener('click', close);

    // Свайп + клик вне
    document.addEventListener('touchstart', handleStart, { passive: true });
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);

    document.addEventListener('click', e => {
      if (sidebar.classList.contains('active') && 
          !e.target.closest('#mobileSidebar') && 
          !e.target.closest('#openSidebarMenu')) close();
    });
  }

  // === МОБИЛЬНАЯ ОБРАТНАЯ СВЯЗЬ — свайп вниз (исправлено) ===
  const feedbackSheet = document.getElementById('mobileFeedbackSheet');
  if (feedbackSheet) {
    let startY = 0, dragging = false;
    const threshold = 120;

    const close = () => {
      feedbackSheet.classList.remove('active');
      document.body.style.overflow = '';
    };

    feedbackSheet.addEventListener('touchstart', e => {
      if (!feedbackSheet.classList.contains('active')) return;
      startY = e.touches[0].clientY;
      dragging = true;
      feedbackSheet.style.transition = 'none';
    }, { passive: true });

    feedbackSheet.addEventListener('touchmove', e => {
      if (!dragging) return;
      const y = e.touches[0].clientY;
      const diff = y - startY;
      if (diff > 0) {
        e.preventDefault();
        feedbackSheet.style.transform = `translateY(${diff}px)`;
      }
    }, { passive: false });

    feedbackSheet.addEventListener('touchend', () => {
      if (!dragging) return;
      dragging = false;
      const diff = (event?.changedTouches?.[0]?.clientY || startY) - startY;
      if (diff > threshold) {
        feedbackSheet.style.transition = 'transform 0.4s ease';
        feedbackSheet.style.transform = 'translateY(100%)';
        setTimeout(() => {
          close();
          feedbackSheet.style.transition = '';
          feedbackSheet.style.transform = '';
        }, 400);
      } else {
        feedbackSheet.style.transition = 'transform 0.3s ease';
        feedbackSheet.style.transform = 'translateY(0)';
        setTimeout(() => feedbackSheet.style.transition = '', 300);
      }
    });

    // Кнопки закрытия
    document.querySelectorAll('#closeMobileFeedback, .sheet-back-btn').forEach(btn => {
      btn.addEventListener('click', close);
    });
  }
});
// === МОБИЛЬНЫЙ САЙДБАР — РАБОЧАЯ ВЕРСИЯ 2025 (с классом .open) ===
const sidebar = document.getElementById('mobileSidebar');
if (sidebar) {
  let startX = 0, isDragging = false;
  const threshold = 80;

  const close = () => {
    sidebar.classList.remove('open');        // ← .open!
    document.body.classList.remove('sidebar-open');
  };

  const handleStart = e => {
    if (!sidebar.classList.contains('open')) return;
    startX = e.touches?.[0].clientX || e.clientX;
    isDragging = true;
    sidebar.style.transition = 'none';
  };

  const handleMove = e => {
    if (!isDragging) return;
    const x = e.touches?.[0].clientX || e.clientX;
    const diff = x - startX;
    if (diff < 0) {
      e.preventDefault();
      sidebar.style.transform = `translateX(${diff}px)`;
    }
  };

  const handleEnd = e => {
    if (!isDragging) return;
    isDragging = false;
    const currentX = e.changedTouches?.[0]?.clientX || e.clientX || startX;
    const diff = currentX - startX;

    if (diff < -threshold) {
      sidebar.style.transition = 'transform 0.44s cubic-bezier(0.22, 1, 0.36, 1)';
      sidebar.style.transform = 'translateX(-100%)';
      setTimeout(() => {
        close();
        sidebar.style.transition = '';
        sidebar.style.transform = '';
      }, 450);
    } else {
      sidebar.style.transition = 'transform 0.38s cubic-bezier(0.2, 0.9, 0.3, 1)';
      sidebar.style.transform = 'translateX(0)';
      setTimeout(() => sidebar.style.transition = '', 380);
    }
  };

  document.getElementById('openSidebarMenu')?.addEventListener('click', () => {
    sidebar.classList.add('open');           // ← .open!
    document.body.classList.add('sidebar-open');
  });

  document.getElementById('closeSidebar')?.addEventListener('click', close);

  document.addEventListener('touchstart', handleStart, { passive: true });
  document.addEventListener('touchmove', handleMove, { passive: false });
  document.addEventListener('touchend', handleEnd);

  document.addEventListener('click', e => {
    if (sidebar.classList.contains('open') && 
        !e.target.closest('#mobileSidebar') && 
        !e.target.closest('#openSidebarMenu')) {
      close();
    }
  });
}

// === МИНИ-КОРЗИНА — РАБОЧАЯ ВЕРСИЯ ИЗ contacts.js (2025) ===
document.addEventListener("DOMContentLoaded", () => {
  const cartBtn = document.getElementById('cartBtn');
  const miniCart = document.getElementById('miniCartDropdown');
  if (!cartBtn || !miniCart) return;

  const cartWrapper = cartBtn.closest('.cart-wrapper');
  let hoverTimeout;

  const openCart = () => {
    clearTimeout(hoverTimeout);
    miniCart.classList.add('show');
    if (typeof updateCart === 'function') updateCart();
  };

  const closeCart = () => {
    hoverTimeout = setTimeout(() => {
      if (!miniCart.matches(':hover') && !cartBtn.matches(':hover')) {
        miniCart.classList.remove('show');
      }
    }, 300);
  };

  // Hover (только на десктопе)
  if (window.innerWidth > 860) {
    cartBtn.addEventListener('mouseenter', openCart);
    cartWrapper.addEventListener('mouseleave', closeCart);
    miniCart.addEventListener('mouseenter', () => clearTimeout(hoverTimeout));
  }

  // Клик (для мобильных + если hover не сработал)
  cartBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    miniCart.classList.toggle('show');
    if (miniCart.classList.contains('show') && typeof updateCart === 'function') updateCart();
  });

  // Закрытие по клику вне
  document.addEventListener('click', (e) => {
    if (!cartWrapper.contains(e.target)) {
      miniCart.classList.remove('show');
    }
  });

  // Перейти в корзину
  document.getElementById('goToCartBtn')?.addEventListener('click', () => {
    location.href = '/bin';
  });
});

// === ОБРАТНАЯ СВЯЗЬ — ПОЛНАЯ БЛОКИРОВКА БЕЗ АВТОРИЗАЦИИ (ПК + МОБИЛКА) ===
document.addEventListener("DOMContentLoaded", () => {

  const isAuthenticated = () => !!(sessionStorage.getItem('phone') || localStorage.getItem('phone'));

  // Тост-алерт (один раз)
  if (!window.showCustomAlert) {
    window.showCustomAlert = (text, isError = true) => {
      document.querySelectorAll('.toast-alert').forEach(t => t.remove());
      const toast = document.createElement('div');
      toast.className = `toast-alert ${isError ? 'error' : ''}`;
      toast.innerHTML = `
        <div class="alert-text">
          <strong>${isError ? 'Ошибка' : 'Успех'}</strong>
          <span>${text}</span>
        </div>
        <button class="alert-close">×</button>
      `;
      document.body.appendChild(toast);
      requestAnimationFrame(() => toast.classList.add('show'));
      toast.querySelector('.alert-close').onclick = () => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
      };
      setTimeout(() => toast.isConnected && toast.classList.remove('show') && setTimeout(() => toast.remove(), 500), 5000);
    };
  }

  // === УДАЛЯЕМ ВСЕ СТАРЫЕ ОБРАБОТЧИКИ НА КНОПКАХ ===
  ['#feedbackBtn', '#feedbackBtnMobile'].forEach(selector => {
    document.querySelectorAll(selector).forEach(btn => {
      const newBtn = btn.cloneNode(true);
      btn.replaceWith(newBtn);
    });
  });

  // === ДЕСКТОПНАЯ КНОПКА (ПК) ===
  document.getElementById('feedbackBtn')?.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if (!isAuthenticated()) {
      showCustomAlert('Войдите в аккаунт', true);
      return;
    }

    // ТОЛЬКО если это ПК — открываем десктопную модалку
    if (window.innerWidth > 1024) {
      const modal = document.getElementById('feedbackModal');
      modal.classList.add('show');
      document.body.style.overflow = 'hidden';

      // Подставляем телефон
      const phone = sessionStorage.getItem('phone') || localStorage.getItem('phone');
      if (phone) {
        const clean = phone.replace(/\D/g, '');
        const formatted = clean.length === 11 
          ? `+7 (${clean.slice(1,4)}) ${clean.slice(4,7)}-${clean.slice(7,9)}-${clean.slice(9)}`
          : phone;
        const input = modal.querySelector('input[type="tel"]');
        if (input) input.value = formatted;

      }
    }
  });

  // === МОБИЛЬНАЯ КНОПКА ===
 // === МОБИЛЬНАЯ КНОПКА ПОДДЕРЖКИ — ПРАВИЛЬНЫЙ АЛЕРТ, КАК НА ДЕСКТОПЕ ===
document.getElementById('feedbackBtnMobile')?.addEventListener('click', function(e) {
  e.preventDefault();
  e.stopPropagation();

  if (!isAuthenticated()) {
    // ←←← ВОТ ТУТ БЫЛ ТОСТ, А ДОЛЖЕН БЫТЬ КРАСИВЫЙ АЛЕРТ
    const authAlert = document.getElementById('authAlert');
    authAlert.classList.add('show');
    document.body.style.overflow = 'hidden';

    // Кнопка "Войти" в алерте открывает модалку авторизации
    document.getElementById('authBtnFeedback')?.addEventListener('click', () => {
      authAlert.classList.remove('show');
      document.body.style.overflow = '';
      document.getElementById('authModal').style.display = 'flex';
    });

    // Закрытие алерта
    authAlert.querySelector('.alert-close')?.addEventListener('click', () => {
      authAlert.classList.remove('show');
      document.body.style.overflow = '';
    });

    // Клик вне контента — закрыть
    authAlert.addEventListener('click', (ev) => {
      if (ev.target === authAlert) {
        authAlert.classList.remove('show');
        document.body.style.overflow = '';
      }
    });

    return;
  }

  // Если авторизован — открываем мобильную шторку обратной связи
  const sheet = document.getElementById('mobileFeedbackSheet');
  sheet.classList.add('active');
  document.body.style.overflow = 'hidden';

  // Автозаполнение телефона
  const phone = sessionStorage.getItem('phone') || localStorage.getItem('phone');
  if (phone) {
    const clean = phone.replace(/\D/g, '');
    const formatted = clean.length === 11 
      ? `+7 (${clean.slice(1,4)}) ${clean.slice(4,7)}-${clean.slice(7,9)}-${clean.slice(9)}`
      : phone;
    const input = sheet.querySelector('input[type="tel"]');
    if (input) input.value = formatted;
  }
});

  // === ЗАКРЫТИЕ МОДАЛОК (чтобы не было конфликтов) ===
  document.getElementById('closeFeedback')?.addEventListener('click', () => {
    document.getElementById('feedbackModal').classList.remove('show');
    document.body.style.overflow = '';
  });

  document.getElementById('feedbackModal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('feedbackModal')) {
      document.getElementById('feedbackModal').classList.remove('show');
      document.body.style.overflow = '';
    }
  });

  // Мобильная шторка — закрытие
  document.querySelectorAll('#closeMobileFeedback, .sheet-back-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('mobileFeedbackSheet').classList.remove('active');
      document.body.style.overflow = '';
    });
  });
});

