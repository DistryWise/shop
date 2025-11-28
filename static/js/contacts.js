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
contactForm?.addEventListener('submit', async e => {
  e.preventDefault();
  contactForm.querySelectorAll('.error').forEach(el => el.classList.remove('error'));

  // КРИТИЧЕСКАЯ ПРОВЕРКА: авторизован ли?
  if (!isAuthenticated()) {
    // 1. Закрываем форму обратной связи
    feedbackModal.classList.remove('show');
    
    // 2. Показываем алерт "Нужно войти"
    const authAlert = document.getElementById('authAlert');
    if (authAlert) {
      authAlert.classList.add('show');
      document.body.style.overflow = 'hidden'; // остаётся скрытым
    }
    
    return;
  }

  // ← дальше всё как было, только чуть чище
  const name = contactForm.querySelector('input[type="text"], .name-input')?.value.trim() || '';
  const phone = phoneInput?.value.replace(/\D/g, '') || '';
  const email = contactForm.querySelector('input[type="email"]')?.value.trim() || '';
  const message = contactForm.querySelector('textarea')?.value.trim() || '';

  if (!name || name.length < 2) return showFieldError(contactForm.querySelector('input[type="text"], .name-input'), 'Укажите имя');
  if (phone.length !== 11) return showFieldError(phoneInput, 'Неверный номер');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showFieldError(contactForm.querySelector('input[type="email"]'), 'Неверный email');
  if (!message || message.length < 10) return showFieldError(contactForm.querySelector('textarea'), 'Сообщение слишком короткое');

  submitBtn.disabled = true;
  btnText && (btnText.textContent = 'Отправка...');

  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email, message })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      showCustomAlert('Спасибо! Мы свяжемся с вами в ближайшее время', false, true);
      feedbackModal.classList.remove('show');
      document.body.style.overflow = '';
      contactForm.reset();
      editPhoneBtn.style.display = 'none';
    } else {
      throw new Error(data.error || 'Ошибка отправки');
    }
  } catch (err) {
    showCustomAlert('Ошибка отправки. Попробуйте позже', true);
    submitBtn.disabled = false;
    btnText && (btnText.textContent = 'Отправить сообщение');
  }
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