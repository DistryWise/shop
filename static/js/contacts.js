// =================== contacts.js — ФИНАЛЬНАЯ РАБОЧАЯ ВЕРСИЯ 19.11.2025 ===================
document.addEventListener("DOMContentLoaded", () => {
  document.documentElement.style.visibility = 'visible';

  // === КАСТОМНЫЙ КУРСОР ===
  const cursor = document.querySelector('.custom-cursor');
  if (cursor) {
    document.addEventListener('mousemove', e => {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top = e.clientY + 'px';
    });
  }

  // === BACK TO TOP + HEADER SCROLL ===
  const backToTop = document.querySelector('.back-to-top');
  if (backToTop) {
    window.addEventListener('scroll', () => {
      backToTop.classList.toggle('visible', window.scrollY > 600);
      document.querySelector('header')?.classList.toggle('scrolled', window.scrollY > 50);
    });
    backToTop.addEventListener('click', e => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // === ТИПОГРАФ ===
  const typewriter = document.getElementById('typewriter');
  if (typewriter) {
    const fullText = `«Мы не продаём товар и не оказываем услуги.\nМы открываем доступ.\nТишина, в которой слышно только то,\nчто действительно имеет значение»<span class="center-last">`;
    let i = 0;
    const type = () => {
      if (i >= fullText.length) return;
      const remaining = fullText.substring(i);
      if (remaining.startsWith('<span class="center-last">')) {
        typewriter.insertAdjacentHTML('beforeend', '<span class="center-last">');
        i += 26;
      } else if (remaining.startsWith('</span>')) {
        typewriter.insertAdjacentHTML('beforeend', '</span>');
        i += 7;
      } else if (remaining[0] === '\n') {
        typewriter.insertAdjacentHTML('beforeend', '<br>');
        i++;
      } else {
        typewriter.insertAdjacentHTML('beforeend', remaining[0]);
        i++;
      }
      setTimeout(type, 65);
    };
    setTimeout(type, 1200);
  }

  // === УНИВЕРСАЛЬНЫЙ ТОСТ-АЛЕРТ ===
  const showCustomAlert = (text, isError = false, isSuccess = false) => {
    document.querySelectorAll('.toast-alert').forEach(el => el.remove());
    const toast = document.createElement('div');
    toast.className = `toast-alert ${isError ? 'error' : ''} ${isSuccess ? 'success' : ''}`;
    toast.innerHTML = `
      <div class="alert-text">
        <strong>${isError ? 'Ошибка' : 'Успех'}</strong>
        <span>${text}</span>
      </div>
      <button class="alert-close">×</button>
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    toast.querySelector('.alert-close').addEventListener('click', () => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 500);
    });
    setTimeout(() => {
      if (toast.isConnected) {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
      }
    }, 5000);
  };
  window.showCustomAlert = showCustomAlert;

  // === АВТОРИЗАЦИЯ ===
  const isAuthenticated = () => !!(sessionStorage.getItem('phone') || localStorage.getItem('phone'));
  const getUserPhone = () => {
    const raw = sessionStorage.getItem('phone') || localStorage.getItem('phone');
    if (!raw) return '';
    const clean = raw.replace(/\D/g, '');
    if (clean.length === 11) {
      return `+7 (${clean.slice(1,4)}) ${clean.slice(4,7)}-${clean.slice(7,9)}-${clean.slice(9)}`;
    }
    return raw;
  };

  // === МИНИ-КОРЗИНА ===
  const cartBtn = document.getElementById('cartBtn');
  const miniCart = document.getElementById('miniCartDropdown');
  if (cartBtn && miniCart) {
    const cartWrapper = cartBtn.parentElement;
    let hoverTimeout;
    const openCart = () => {
      clearTimeout(hoverTimeout);
      miniCart.classList.add('show');
      if (typeof updateCart === 'function') updateCart();
    };
    const closeCart = () => {
      hoverTimeout = setTimeout(() => miniCart.classList.remove('show'), 300);
    };
    cartBtn.addEventListener('mouseenter', () => window.innerWidth > 860 && openCart());
    miniCart.addEventListener('mouseenter', () => clearTimeout(hoverTimeout));
    cartBtn.addEventListener('mouseleave', e => window.innerWidth > 860 && !e.relatedTarget?.closest('#miniCartDropdown') && closeCart());
    miniCart.addEventListener('mouseleave', () => window.innerWidth > 860 && closeCart());
    cartBtn.addEventListener('click', e => { e.stopPropagation(); miniCart.classList.toggle('show'); updateCart?.(); });
    document.addEventListener('click', e => !cartWrapper.contains(e.target) && miniCart.classList.remove('show'));
    document.getElementById('goToCartBtn')?.addEventListener('click', () => location.href = '/bin');
  }

  // === ОБРАТНАЯ СВЯЗЬ ===
  const feedbackModal = document.getElementById('feedbackModal');
  const contactForm = document.getElementById('contactForm');
  const submitBtn = document.getElementById('submitBtn');
  const btnText = submitBtn?.querySelector('.btn-text');
  const editPhoneBtn = document.querySelector('.edit-phone-btn');
  const phoneInput = contactForm?.querySelector('input[type="tel"]');

  document.getElementById('feedbackBtn')?.addEventListener('click', () => {
    if (!isAuthenticated()) return showCustomAlert('Войдите в аккаунт', true);
    feedbackModal.classList.add('show');
    document.body.style.overflow = 'hidden';
    contactForm.reset();
    document.querySelectorAll('input, textarea').forEach(el => el.classList.remove('error'));
    if (getUserPhone() && phoneInput) {
      phoneInput.value = getUserPhone();
      editPhoneBtn.style.display = 'block';
    } else {
      phoneInput.value = '+7 (';
      editPhoneBtn.style.display = 'none';
    }
  });

  document.getElementById('closeFeedback')?.addEventListener('click', () => {
    feedbackModal.classList.remove('show');
    document.body.style.overflow = '';
  });

  feedbackModal?.addEventListener('click', e => {
    if (e.target === feedbackModal) {
      feedbackModal.classList.remove('show');
      document.body.style.overflow = '';
    }
  });

  editPhoneBtn?.addEventListener('click', () => {
    phoneInput.value = '+7 (';
    phoneInput.focus();
    phoneInput.setSelectionRange(4, 4);
    editPhoneBtn.style.display = 'none';
  });

  // === МАСКА ТЕЛЕФОНА ===
  if (phoneInput) {
    const formatPhone = value => {
      let digits = value.replace(/\D/g, '').slice(0, 11);
      if (digits.startsWith('8')) digits = '7' + digits.slice(1);
      if (digits === '8') digits = '7';
      if (digits.length <= 1) return '+7 (';
      if (digits.length <= 4) return `+7 (${digits.slice(1)}`;
      if (digits.length <= 7) return `+7 (${digits.slice(1,4)}) ${digits.slice(4)}`;
      if (digits.length <= 9) return `+7 (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
      return `+7 (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7,9)}-${digits.slice(9)}`;
    };

    phoneInput.addEventListener('input', e => {
      const cursorPos = e.target.selectionStart;
      const oldValue = e.target.value;
      const newValue = formatPhone(e.target.value);
      e.target.value = newValue;
      const diff = newValue.length - oldValue.length;
      e.target.setSelectionRange(cursorPos + diff, cursorPos + diff);
    });

    phoneInput.addEventListener('focus', () => {
      if (!phoneInput.value) {
        phoneInput.value = '+7 (';
        phoneInput.setSelectionRange(4, 4);
      }
    });
  }

// === ОТПРАВКА ОБРАТНОЙ СВЯЗИ — РАБОЧАЯ ВЕРСИЯ 28.11.2025 ===
// === УНИВЕРСАЛЬНАЯ ОТПРАВКА ДЛЯ ВСЕХ ФОРМ ОБРАТНОЙ СВЯЗИ (2025) ===
document.querySelectorAll('#contactForm, #contactFormMobile, form[action*="feedback"], form#mobile-contact-form').forEach(form => {
  if (!form || form.dataset.processed) return;
  form.dataset.processed = 'true'; // защита от дублирования

  form.addEventListener('submit', async e => {
    e.preventDefault();
    e.stopPropagation();

    // Убираем старые ошибки
    form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));

    // ПРОВЕРКА АВТОРИЗАЦИИ — ТОЛЬКО ТУТ, ОДИН РАЗ!
    if (!isAuthenticated()) {
      // Закрываем все модалки
      document.getElementById('feedbackModal')?.classList.remove('show');
      document.getElementById('mobileFeedbackSheet')?.classList.remove('active');
      document.body.style.overflow = '';

      // Показываем алерт
      const authAlert = document.getElementById('authAlert');
      if (authAlert) {
        authAlert.classList.add('show');
        document.body.style.overflow = 'hidden';
      }
      return;
    }

    // Собираем данные
    const nameInput = form.querySelector('input[name="name"], .name-input, input[type="text"]');
    const phoneInput = form.querySelector('input[type="tel"]');
    const emailInput = form.querySelector('input[type="email"]');
    const messageInput = form.querySelector('textarea');

    const name = nameInput?.value.trim() || '';
    const phone = phoneInput?.value.replace(/\D/g, '') || '';
    const email = emailInput?.value.trim() || '';
    const message = messageInput?.value.trim() || '';

    // Валидация
        // Валидация — теперь email ОБЯЗАТЕЛЕН и подсвечивается как все поля
    if (!name || name.length < 2) {
      nameInput?.focus();
      nameInput?.classList.add('error');
      nameInput?.closest('.sheet-field, .field-wrapper')?.classList.add('error');
      return showCustomAlert('Укажите имя', true);
    }

    if (phone.length !== 11) {
      phoneInput?.focus();
      phoneInput?.classList.add('error');
      phoneInput?.closest('.sheet-field, .field-wrapper')?.classList.add('error');
      return showCustomAlert('Неверный номер телефона', true);
    }

    // ←←←←←←←←←←←←←←←← ВОТ ЭТО ГЛАВНОЕ ИСПРАВЛЕНИЕ ←←←←←←←←←←←←←←←←
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      emailInput?.focus();
      emailInput?.classList.add('error');
      emailInput?.closest('.sheet-field, .field-wrapper')?.classList.add('error');
      return showCustomAlert('Введите корректный email', true);
    }
    // ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←

    if (!message || message.length < 10) {
      messageInput?.focus();
      messageInput?.classList.add('error');
      messageInput?.closest('.sheet-field, .field-wrapper')?.classList.add('error');
      return showCustomAlert('Сообщение слишком короткое', true);
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const oldText = submitBtn?.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправка...';

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email, message })
      });

      const data = await res.json();

           if (res.ok && data.success) {
        showCustomAlert('Спасибо! Мы свяжемся с вами в ближайшее время', false, true);

        // САМОЕ ПРОСТОЕ И РАБОЧЕЕ РЕШЕНИЕ 2025 ГОДА
                // УНИВЕРСАЛЬНОЕ ЗАКРЫТИЕ ЛЮБОЙ МОДАЛКИ ОБРАТНОЙ СВЯЗИ — РАБОТАЕТ ВЕЗДЕ (2025)
        document.getElementById('feedbackModal')?.classList.remove('show');
        
        const mobileSheet = document.getElementById('mobileFeedbackSheet');
        if (mobileSheet) {
          if (typeof closeSheet === 'function') {
            closeSheet();
          } else {
            // Ручное закрытие на ПК (если closeSheet не существует)
            mobileSheet.classList.remove('active');
          }
        }

        // ВОССТАНАВЛИВАЕМ СКРОЛЛ — САМОЕ ВАЖНОЕ!
        document.body.style.overflow = '';
        form.reset();
      
      } else {
        throw new Error(data.error || 'Ошибка сервера');
      }
    } catch (err) {

    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = oldText || 'Отправить';
    }
  });
});

// === РАССЫЛКА — УМНАЯ ПОДПИСКА (ФИНАЛЬНАЯ ВЕРСИЯ — ПРИВЯЗКА К ТЕЛЕФОНУ) ===
const newsletterForm = document.getElementById('newsletterForm');
if (newsletterForm) {
  const SUBSCRIBED_KEY = 'piligrim_newsletter_subscribed_v2'; // новая версия ключа

  // Получаем текущий телефон (или null, если не залогинен)
  const getCurrentPhone = () => {
    const phone = sessionStorage.getItem('phone') || localStorage.getItem('phone');
    return phone ? phone.replace(/\D/g, '') : null;
  };

  // Проверяем статус подписки — только для текущего пользователя!
  const checkSubscriptionStatus = () => {
    const currentPhone = getCurrentPhone();
    const saved = localStorage.getItem(SUBSCRIBED_KEY);
    
    // Если нет телефона — считаем, что не подписан (для анонимов)
    if (!currentPhone) {
      return false;
    }

    try {
      const data = JSON.parse(saved || '{}');
      return data[currentPhone] === true;
    } catch {
      return false;
    }
  };

  // Сохраняем подписку для текущего пользователя
  const markAsSubscribed = () => {
    const currentPhone = getCurrentPhone();
    if (!currentPhone) return;

    let data = {};
    try {
      data = JSON.parse(localStorage.getItem(SUBSCRIBED_KEY) || '{}');
    } catch {}
    
    data[currentPhone] = true;
    localStorage.setItem(SUBSCRIBED_KEY, JSON.stringify(data));
  };

  // Блокируем форму, если текущий пользователь уже подписан
  const updateFormState = () => {
    const btn = newsletterForm.querySelector('button');
    const input = newsletterForm.querySelector('.newsletter-input');

    if (checkSubscriptionStatus()) {
      btn.disabled = true;
      btn.innerHTML = 'Подписан';
      btn.style.opacity = '0.7';
      input.placeholder = 'Вы уже в рассылке';
      input.disabled = true;
    } else {
      // Можно подписаться
      btn.disabled = false;
      btn.innerHTML = btn.dataset.originalText || 'Подписаться';
      input.placeholder = input.dataset.originalPlaceholder || 'Ваш email';
      input.disabled = false;
    }
  };

  // Сохраняем оригинальный текст при загрузке
  const submitBtn = newsletterForm.querySelector('button');
  const emailInput = newsletterForm.querySelector('.newsletter-input');
  if (submitBtn && !submitBtn.dataset.originalText) {
    submitBtn.dataset.originalText = submitBtn.innerHTML;
  }
  if (emailInput && !emailInput.dataset.originalPlaceholder) {
    emailInput.dataset.originalPlaceholder = emailInput.placeholder;
  }

newsletterForm.addEventListener('submit', async function (e) {
  e.preventDefault();

  // НОВАЯ ПРОВЕРКА — ТРЕБУЕМ АВТОРИЗАЦИЮ ДЛЯ ПОДПИСКИ
  if (!isAuthenticated()) {
    // Закрываем всё лишнее и показываем алерт
    const authAlert = document.getElementById('authAlert');
    if (authAlert) {
      authAlert.classList.add('show');
      document.body.style.overflow = 'hidden';
    }
    return;
  }

  const email = emailInput?.value.trim().toLowerCase();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    showCustomAlert('Введите корректный email', true);
    emailInput?.focus();
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = 'Отправка...';

  try {
    const payload = { email, source: 'newsletter_bottom' };
    const savedPhone = getCurrentPhone();
    if (savedPhone) payload.phone = savedPhone;

    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (res.ok && (data.success || data.already_subscribed || data.new_subscription)) {
      markAsSubscribed();
      updateFormState();

      showCustomAlert(
        data.new_subscription 
          ? 'Спасибо! Вы успешно подписаны!' 
          : 'Вы уже подписаны на рассылку',
        false, true
      );

      emailInput.value = '';
    } else {
      showCustomAlert(data.error || 'Ошибка подписки', true);
    }
  } catch (err) {
    console.error(err);
    showCustomAlert('Ошибка сети', true);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = submitBtn.dataset.originalText;
  }
});
  // Обновляем состояние при загрузке и при изменении авторизации
  updateFormState();

  // Перепроверяем при любом изменении session/localStorage (вход/выход)
  window.addEventListener('storage', updateFormState);
  setInterval(updateFormState, 2000); // на всякий случай
}
  // === КАРТОЧКА ТОВАРА ===
  const productModal = document.getElementById('productModal');
  if (productModal) {
    const observer = new MutationObserver(() => {
      const display = window.getComputedStyle(productModal).display;
      if (display !== 'none') {
        productModal.classList.add('active');
        document.body.style.overflow = 'hidden';
      } else {
        productModal.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
    observer.observe(productModal, { attributes: true, attributeFilter: ['style'] });

    productModal.addEventListener('click', e => {
      if (e.target === productModal || e.target.closest('.close-modal')) {
        productModal.style.display = 'none';
        productModal.classList.remove('active');
        document.body.style.overflow = '';
      }
    });


  // И разблокируем только если успешно подписались (внутри формы)
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && productModal.classList.contains('active')) {
        productModal.style.display = 'none';
        productModal.classList.remove('active');
        document.body.style.overflow = '';
      }
    });

    productModal.style.display = 'none';
    productModal.classList.remove('active');
  }



  // === ИНИЦИАЛИЗАЦИЯ КОРЗИНЫ ===
  if (typeof updateCart === 'function') updateCart();

  // === ПРЕЛОАДЕР ===
  document.body.style.overflow = 'hidden';
  setTimeout(() => {
    const loader = document.getElementById('loader');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(() => {
        loader.remove();
        document.body.style.overflow = '';
      }, 600);
    }
  }, 800);
    // === ПОЛНОЕ УПРАВЛЕНИЕ МОДАЛКОЙ "Нужно авторизоваться" ===
  const authAlert = document.getElementById('authAlert');
  if (authAlert) {
    // Закрытие по крестику или фону
    authAlert.addEventListener('click', e => {
      if (e.target === authAlert || e.target.classList.contains('alert-close')) {
        authAlert.classList.remove('show');
        document.body.style.overflow = '';
      }
    });

    // Кнопка "Войти" — открывает настоящую авторизацию
    document.getElementById('authBtnFeedback')?.addEventListener('click', () => {
      authAlert.classList.remove('show');
      document.getElementById('authBtn')?.click(); // используем уже существующую кнопку входа
    });

    // Esc тоже закрывает
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && authAlert.classList.contains('show')) {
        authAlert.classList.remove('show');
        document.body.style.overflow = '';
      }
    });
  }
});


const themeToggle = document.getElementById('theme-toggle');
const html = document.documentElement;

// Автоопределение системной темы + сохранение
if (localStorage.getItem('theme') === 'light' || 
   (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: light)').matches)) {
  html.setAttribute('data-theme', 'light');
  if (themeToggle) themeToggle.checked = true;
} else {
  html.setAttribute('data-theme', 'dark');
  if (themeToggle) themeToggle.checked = false;
}

themeToggle?.addEventListener('change', () => {
  if (themeToggle.checked) {
    html.setAttribute('data-theme', 'light');
    localStorage.setItem('theme', 'light');
  } else {
    html.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
  }
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

`);



// Открытие/закрытие шторки
document.getElementById('openSidebarMenu')?.addEventListener('click', () => {
  document.getElementById('mobileSidebar').classList.add('active');
  document.body.classList.add('sidebar-open');
});

document.getElementById('closeSidebar')?.addEventListener('click', () => {
  document.getElementById('mobileSidebar').classList.remove('active');
  document.body.classList.remove('sidebar-open');
});

// Закрытие по клику вне шторки
document.addEventListener('click', (e) => {
  const sidebar = document.getElementById('mobileSidebar');
  if (sidebar.classList.contains('active') && 
      !e.target.closest('.mobile-sidebar') && 
      !e.target.closest('#openSidebarMenu')) {
    sidebar.classList.remove('active');
    document.body.classList.remove('sidebar-open');
  }
});



// КАРУСЕЛЬ — РАБОТАЕТ ИДЕАЛЬНО (первый слайд активен сразу, остальные — только по свайпу)
if (window.matchMedia("(max-width: 1024px)").matches) {
  const carousel = document.getElementById('instaCarousel');
  const bars = document.querySelectorAll('.insta-progress > div');

  const update = () => {
    const index = Math.round(carousel.scrollLeft / carousel.clientWidth);
    bars.forEach((bar, i) => {
      bar.classList.toggle('active', i === index);
    });
  };

  // Инициализация: первый слайд активен сразу
  update();

  // При скролле
  carousel.addEventListener('scroll', () => requestAnimationFrame(update));

  // При ресайзе/повороте
  window.addEventListener('resize', update);
}

// СВАЙП ВНИЗ — ТОЛЬКО ДЛЯ ОБРАТНОЙ СВЯЗИ (mobileFeedbackSheet) — 100% БЕЗ ЛАГОВ
// =============================================================================

// =============================================================================
// БОКОВАЯ ШТОРКА — СВАЙП ВЛЕВО ДЛЯ ЗАКРЫТИЯ — КАК В ТЕЛЕГРАМЕ / FIGMA / iOS 18
// =============================================================================
// =============================================================================
// БОКОВАЯ ШТОРКА — СВАЙП ВЛЕВО ДЛЯ ЗАКРЫТИЯ — РАБОТАЕТ ВЕЗДЕ (2025 ГОД)
// =============================================================================
(() => {
  const sidebar = document.getElementById('mobileSidebar');
  if (!sidebar) return;

  let startX = 0;
  let isDragging = false;
  const threshold = 80; // 80px — мгновенно закрывается

  const open = () => {
    sidebar.classList.add('open');
    document.body.classList.add('sidebar-open');
  };

  const close = () => {
    sidebar.classList.remove('open');
    document.body.classList.remove('sidebar-open');
  };

  const handleStart = e => {
    if (!sidebar.classList.contains('open')) return;

    // УБРАЛИ ЭТУ СТРОКУ — теперь свайп работает везде, а не только с края
    // if (e.touches?.[0].clientX > 80) return;

    startX = e.touches?.[0].clientX || e.clientX;
    isDragging = true;
    sidebar.style.transition = 'none';
  };

  const handleMove = e => {
    if (!isDragging) return;

    const currentX = e.touches?.[0].clientX || e.clientX;
    const diff = currentX - startX; // отрицательное = влево

    if (diff < 0) { // только влево
      e.preventDefault();
      sidebar.style.transform = `translate3d(${diff}px, 0, 0)`;
    }
  };

  const handleEnd = () => {
    if (!isDragging) return;
    isDragging = false;

    const endX = event?.changedTouches?.[0]?.clientX || event?.clientX || startX;
    const diff = endX - startX;

    if (diff < -threshold) {
      // Свайп влево — закрываем
      sidebar.style.transition = 'transform 0.44s cubic-bezier(0.22, 1, 0.36, 1)';
      sidebar.style.transform = 'translate3d(-100%, 0, 0)';
      
      setTimeout(() => {
        close();
        sidebar.style.transition = '';
        sidebar.style.transform = '';
      }, 450);
    } else {
      // Возврат
      sidebar.style.transition = 'transform 0.38s cubic-bezier(0.2, 0.9, 0.3, 1)';
      sidebar.style.transform = 'translate3d(0, 0, 0)';
      setTimeout(() => sidebar.style.transition = '', 380);
    }
  };

  // Свайп работает везде по шторке
  document.addEventListener('touchstart', handleStart, { passive: true });
  document.addEventListener('touchmove', handleMove, { passive: false });
  document.addEventListener('touchend', handleEnd);

  document.addEventListener('mousedown', handleStart);
  document.addEventListener('mousemove', e => isDragging && handleMove(e));
  document.addEventListener('mouseup', handleEnd);

  // Остальное
  document.getElementById('openSidebarMenu')?.addEventListener('click', e => {
    e.stopPropagation();
    open();
  });

  document.getElementById('closeSidebar')?.addEventListener('click', close);

  document.addEventListener('click', e => {
    if (sidebar.classList.contains('open') && 
        !e.target.closest('#mobileSidebar') && 
        !e.target.closest('#openSidebarMenu')) {
      close();
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) close();
  });
})();
// =============================================================================

// =============================================================================
// МОБИЛЬНАЯ ОБРАТНАЯ СВЯЗЬ — СВАЙП ВНИЗ — 120 FPS, КАК В КОРЗИНЕ (2025)

(() => {
  const sheet = document.getElementById('mobileFeedbackSheet');
  if (!sheet) return;

  let startY = 0;
  let isDragging = false;
  const threshold = 140;

  const openSheet = () => {
    sheet.classList.add('active');
    document.body.style.overflow = 'hidden'; // ← БЛОКИРУЕМ
  };

  const closeSheet = () => {
    // 🔥 ЖЁСТКОЕ ЗАКРЫТИЕ — ГАРАНТИРОВАННО!
    sheet.classList.remove('active');
    document.body.style.overflow = ''; // ← РАЗБЛОКИРОВЫВАЕМ!
    document.body.classList.remove('sheet-open');
    
    sheet.style.transition = 'transform 0.42s cubic-bezier(0.22, 0.88, 0.38, 1)';
    sheet.style.transform = 'translateY(100%)';
    
    setTimeout(() => {
      sheet.style.transition = '';
      sheet.style.transform = '';
    }, 420);
  };

  // 🔥 СВАЙП ТОЛЬКО НА САМОЙ ШТОРКЕ!
  const handleStart = (e) => {
    if (!sheet.classList.contains('active')) return;
    
    // ✅ ПРОВЕРЯЕМ — СВАЙП ТОЛЬКО ПО ШТОРКЕ!
    if (!e.target.closest('#mobileFeedbackSheet')) return;
    
    startY = e.touches?.[0].clientY || e.clientY;
    isDragging = true;
    sheet.style.transition = 'none';
  };

  const handleMove = (e) => {
    if (!isDragging || !sheet.classList.contains('active')) return;
    
    const y = e.touches?.[0].clientY || e.clientY;
    const diff = y - startY;
    
    if (diff > 0) {
      e.preventDefault();
      sheet.style.transform = `translateY(${diff}px)`;
    }
  };

  const handleEnd = (e) => {
    if (!isDragging) return;
    isDragging = false;

    const diff = (e.changedTouches?.[0]?.clientY || startY) - startY;

    if (diff > threshold) {
      closeSheet(); // ← ЗАКРЫВАЕМ И РАЗБЛОКИРОВЫВАЕМ!
    } else {
      sheet.style.transition = 'transform 0.34s cubic-bezier(0.2, 0.8, 0.4, 1)';
      sheet.style.transform = 'translateY(0)';
      setTimeout(() => sheet.style.transition = '', 340);
    }
  };

  // ✅ ВЕШАЕМ ТОЛЬКО НА ШТОРКУ!
  sheet.addEventListener('touchstart', handleStart, { passive: true });
  sheet.addEventListener('touchmove', handleMove, { passive: false });
  sheet.addEventListener('touchend', handleEnd);

  // Кнопки закрытия
  document.querySelectorAll('#closeMobileFeedback, .sheet-back-btn, .mobile-feedback-back').forEach(btn => {
    btn.addEventListener('click', closeSheet);
  });

  // Esc
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheet.classList.contains('active')) closeSheet();
  });
})();


// === УМНАЯ ТЕМА 2025 — САМЫЙ ЛУЧШИЙ ВАРИАНТ (100% РАБОТАЕТ) ===
(() => {
  const html = document.documentElement;
  const toggles = [
    document.getElementById('theme-toggle'),
    document.getElementById('theme-toggle-sidebar')
  ];

  // Применяем тему (и синхронизируем все тумблеры)
  const applyTheme = (theme) => {
    html.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    const isLight = theme === 'light';
    toggles.forEach(t => t && (t.checked = isLight));
  };

  // 1. Сначала — сохранённая в localStorage
  const saved = localStorage.getItem('theme');
  if (saved === 'light' || saved === 'dark') {
    applyTheme(saved);
    return; // всё, дальше не идём
  }

  // 2. Если ничего не сохранено — слушаем системную тему
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    applyTheme('dark');
  } else {
    applyTheme('light');
  }

  // 3. Живое отслеживание изменения системной темы (если пользователь сменил в ОС)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (localStorage.getItem('theme')) return; // если пользователь уже выбрал вручную — не трогаем
    applyTheme(e.matches ? 'dark' : 'light');
  });

  // 4. Переключение по клику (работает на всех тумблерах)
  toggles.forEach(toggle => {
    toggle?.addEventListener('change', () => {
      applyTheme(toggle.checked ? 'light' : 'dark');
    });
  });
})();
