// =================== contacts.js — ИСПРАВЛЕНО 11.11.2025 05:33 CET ===================
document.addEventListener("DOMContentLoaded", () => {
  document.documentElement.style.visibility = 'visible';

  // === КУРСОР, BACK TO TOP, ТИПОГРАФ — без изменений ===
  const cursor = document.querySelector('.custom-cursor');
  if (cursor) {
    document.addEventListener('mousemove', e => {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top = e.clientY + 'px';
    });
  }

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

  const typewriter = document.getElementById('typewriter');
  if (typewriter) {
    const fullText = `«Мы создаём вещи, которые не кричат.<br>Они шепчут. Но слышат их только те,<br>кто готов слушать.»`;
    let i = 0;
    const type = () => {
      if (i < fullText.length) {
        if (fullText.substr(i, 4) === '<br>') {
          typewriter.innerHTML += '<br>';
          i += 4;
        } else {
          typewriter.innerHTML += fullText[i];
          i++;
        }
        setTimeout(type, 60);
      }
    };
    setTimeout(type, 800);
  }

  // === ТОСТ-АЛЕРТЫ — ИСПРАВЛЕНО: УБРАН alert.className! ===
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

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

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

  // === КОРЗИНА — ИСПРАВЛЕНО: НЕ ДЕРГАЕТСЯ ПРИ НАВЕДЕНИИ ===
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
      hoverTimeout = setTimeout(() => {
        miniCart.classList.remove('show');
      }, 300);
    };

    cartBtn.addEventListener('mouseenter', () => {
      if (window.innerWidth > 860) openCart();
    });

    miniCart.addEventListener('mouseenter', () => {
      clearTimeout(hoverTimeout);
    });

    cartBtn.addEventListener('mouseleave', (e) => {
      if (window.innerWidth > 860 && !e.relatedTarget?.closest('#miniCartDropdown')) {
        closeCart();
      }
    });

    miniCart.addEventListener('mouseleave', () => {
      if (window.innerWidth > 860) closeCart();
    });

    cartBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      miniCart.classList.toggle('show');
      if (typeof updateCart === 'function') updateCart();
    });

    document.addEventListener('click', (e) => {
      if (!cartWrapper.contains(e.target)) {
        miniCart.classList.remove('show');
      }
    });

    document.getElementById('goToCartBtn')?.addEventListener('click', () => {
      window.location.href = '/cart';
    });
  }

  // === ОБРАТНАЯ СВЯЗЬ ===
  const feedbackModal = document.getElementById('feedbackModal');
  const contactForm = document.getElementById('contactForm');
  const submitBtn = document.getElementById('submitBtn');
  const btnText = submitBtn?.querySelector('.btn-text');
  const btnCooldown = submitBtn?.querySelector('.btn-cooldown');
  const timerEl = submitBtn?.querySelector('.timer');
  const editPhoneBtn = document.querySelector('.edit-phone-btn');
  const phoneInput = contactForm?.querySelector('input[type="tel"]');
  let cooldownInterval = null;

  document.getElementById('feedbackBtn')?.addEventListener('click', () => {
    if (!isAuthenticated()) {
      showCustomAlert('Войдите в аккаунт', true);
      return;
    }
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
    const formatPhone = (value) => {
      let digits = value.replace(/\D/g, '').slice(0, 11);
      if (digits.startsWith('8')) digits = '7' + digits.slice(1);
      if (digits === '8') digits = '7';
      if (digits.length === 0) return '';
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

  // === КУЛДАУН ===
  const startCooldown = (seconds) => {
    let remaining = seconds;
    submitBtn.disabled = true;
    submitBtn.classList.add('cooldown');
    btnCooldown.classList.add('active');
    timerEl.textContent = remaining;

    clearInterval(cooldownInterval);
    cooldownInterval = setInterval(() => {
      remaining--;
      timerEl.textContent = remaining;
      if (remaining <= 0) {
        clearInterval(cooldownInterval);
        submitBtn.disabled = false;
        submitBtn.classList.remove('cooldown');
        btnCooldown.classList.remove('active');
      }
    }, 1000);
  };

  // === ОТПРАВКА ФОРМЫ ===
  contactForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    contactForm.querySelectorAll('.error').forEach(el => el.classList.remove('error'));

    const name = contactForm.querySelector('input[type="text"], .name-input').value.trim();
    const phone = phoneInput.value.replace(/\D/g, '');
    const email = contactForm.querySelector('input[type="email"]').value.trim();
    const message = contactForm.querySelector('textarea').value.trim();

    if (!name || name.length < 2) return showFieldError(contactForm.querySelector('input[type="text"], .name-input'), 'Укажите имя');
    if (phone.length !== 11) return showFieldError(phoneInput, 'Неверный номер');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showFieldError(contactForm.querySelector('input[type="email"]'), 'Неверный email');
    if (!message || message.length < 10) return showFieldError(contactForm.querySelector('textarea'), 'Сообщение слишком короткое');

    submitBtn.disabled = true;
    btnText.textContent = 'Отправка...';

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
      } else if (res.status === 429 && data.retry_after) {
        startCooldown(data.retry_after);
        showCustomAlert(`Подождите ${data.retry_after} секунд`, true);
      } else {
        showCustomAlert(data.error || 'Ошибка отправки', true);
        submitBtn.disabled = false;
        btnText.textContent = 'Отправить сообщение';
      }
    } catch (err) {
      showCustomAlert('Нет соединения с сервером', true);
      submitBtn.disabled = false;
      btnText.textContent = 'Отправить сообщение';
    }
  });

  const showFieldError = (field, msg) => {
    field.classList.add('error');
    field.focus();
    showCustomAlert(msg, true);
  };


    // Универсальная функция показа тоста
    window.showToast = function(type, title, text) {
    document.querySelectorAll('.toast-alert').forEach(el => el.remove());

    const toast = document.createElement('div');
    toast.className = `toast-alert ${type}`;
    toast.innerHTML = `
        <div class="alert-text">
        <strong>${title}</strong>
        <span>${text}</span>
        </div>
        <button class="alert-close">×</button>
    `;

    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 50);
    toast.querySelector('.alert-close').onclick = () => toast.remove();
    setTimeout(() => toast.remove(), 5000);
    };


  // === ЗАКРЫТИЕ МОДАЛКИ ===
  function closeFeedbackModal() {
    const modal = document.getElementById('feedbackModal');
    modal.classList.remove('show');
    setTimeout(() => modal.style.display = 'none', 400);
  }

  // === ПОЛНЫЙ РАБОЧИЙ КУЛДАУН + ЗАКРЫТИЕ ===
  function showCooldown(seconds) {
    const btn = document.getElementById('submitBtn');
    if (!btn) return;

    btn.classList.add('cooldown');
    const cooldown = btn.querySelector('.btn-cooldown');
    const timer = cooldown.querySelector('.timer');
    cooldown.classList.add('active');

    let timeLeft = seconds;
    timer.textContent = timeLeft;

    const interval = setInterval(() => {
      timeLeft--;
      timer.textContent = timeLeft;
      if (timeLeft <= 0) {
        clearInterval(interval);
        btn.classList.remove('cooldown');
        cooldown.classList.remove('active');
      }
    }, 1000);
  }

  // === ОБРАБОТКА ФОРМЫ (вместо feedback.js) ===
  document.getElementById('contactForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = new FormData(this);
    const btn = document.getElementById('submitBtn');
    const isResend = btn.classList.contains('cooldown');

    if (isResend) {
      showCooldown(30);
      showToast('error', 'Подождите', 'Повторная отправка через 30 сек');
      return;
    }

    try {
      btn.disabled = true;
      showCooldown(30);


    } catch (err) {
      showToast('error', 'Ошибка', 'Не удалось отправить');
    } finally {
      btn.disabled = false;
    }
  });

  // === ТОСТ (оставляем) ===
  window.showToast = function(type, title, text) {
    document.querySelectorAll('.toast-alert').forEach(el => el.remove());
    const toast = document.createElement('div');
    toast.className = `toast-alert ${type}`;
    toast.innerHTML = `
      <div class="alert-text">
        <strong>${title}</strong>
        <span>${text}</span>
      </div>
      <button class="alert-close">×</button>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 50);
    toast.querySelector('.alert-close').onclick = () => toast.remove();
    setTimeout(() => toast.remove(), 5000);
  };

  // === ГАРАНТИРОВАННОЕ ОТКРЫТИЕ КАРТОЧКИ ТОВАРА ===
  document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('productModal');
    if (!modal) return;

    // Следим за display (search.js меняет style.display)
    const observer = new MutationObserver(() => {
      const display = window.getComputedStyle(modal).display;
      if (display !== 'none') {
        openProductModal();
      } else {
        closeProductModal();
      }
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['style'] });

    // Функции
    function openProductModal() {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeProductModal() {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }

    // Клик по фону или крестику
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.closest('.close-modal')) {
        modal.style.display = 'none';
        closeProductModal();
      }
    });

    // Esc
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        modal.style.display = 'none';
        closeProductModal();
      }
    });


  // === РАССЫЛКА ===
  document.getElementById('newsletterForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const email = e.target.querySelector('input').value.trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      showCustomAlert('Введите корректный email', true);
      return;
    }
    showCustomAlert('Спасибо за подписку!', false, true);
    e.target.reset();
  });

  // === КАРТОЧКА ТОВАРА — ИСПРАВЛЕНО: РАБОТАЕТ С search.js ===
  const productModal = document.getElementById('productModal');
  if (productModal) {
    // Следим за display (search.js меняет style.display)
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

    // Клик вне или на крестик
    productModal.addEventListener('click', (e) => {
      if (e.target === productModal || e.target.closest('.close-modal')) {
        productModal.style.display = 'none';
        productModal.classList.remove('active');
        document.body.style.overflow = '';
      }
    });

    // Esc
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && productModal.classList.contains('active')) {
        productModal.style.display = 'none';
        productModal.classList.remove('active');
        document.body.style.overflow = '';
      }
    });

    // Принудительно скрываем при загрузке
    productModal.style.display = 'none';
    productModal.classList.remove('active');
  }

  // === ИНИЦИАЛИЗАЦИЯ КОРЗИНЫ ===
  if (typeof updateCart === 'function') updateCart();
});

 // Инициализация
    modal.style.display = 'none';
    closeProductModal();
  });

  document.addEventListener('DOMContentLoaded', () => {
  document.body.style.overflow = 'hidden';

  setTimeout(() => {
    const loader = document.getElementById('loader');
    loader.style.transition = 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
    loader.style.opacity = '0';

    setTimeout(() => {
      loader.remove();
      document.body.style.overflow = '';
      document.body.style.opacity = '1';
    }, 600);
  }, 800);
});
