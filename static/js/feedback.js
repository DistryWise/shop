// feedback.js — РИГА 28 НОЯБРЯ 2025 — ✅ ДВЕ ФОРМЫ РАБОТАЮТ!
document.addEventListener('DOMContentLoaded', () => {
  console.clear();
  console.log('%c🔥 ФИДБЕК — ДВЕ ФОРМЫ РАБОТАЮТ! 🔥', 'color: #ff6b35; font-size: 20px; font-weight: bold');

  // === ГЛОБАЛЬНЫЕ ЭЛЕМЕНТЫ ===
  const authAlert = document.getElementById('authAlert');
  
  // ✅ ДВЕ ФОРМЫ!
  const desktopForm = document.getElementById('contactForm');
  const mobileForm = document.getElementById('contactFormMobile');

  // === ФУНКЦИЯ ПРОВЕРКИ АВТОРИЗАЦИИ ===
  const isAuth = () => {
    const phone = localStorage.getItem('phone') || sessionStorage.getItem('phone');
    return !!phone;
  };

  // ✅ УНИВЕРСАЛЬНАЯ ФУНКЦИЯ ДЛЯ ЛЮБОЙ ФОРМЫ
  const initForm = (form) => {
    if (!form) return;

    const phoneWrapper = form.querySelector('.phone-field-wrapper');
    const phoneInput = phoneWrapper?.querySelector('input[type="tel"]');
    const nameInput = form.querySelector('.name-input');
    
    if (!phoneWrapper || !phoneInput || !nameInput) {
      console.warn('❌ Не все поля формы найдены:', form.id);
      return;
    }

    phoneWrapper.style.position = 'relative';

    // ✅ АВТОЗАПОЛНЕНИЕ ТЕЛЕФОНА
    const fillPhone = () => {
      const phone = localStorage.getItem('phone') || sessionStorage.getItem('phone');
      document.querySelectorAll('.edit-phone-btn').forEach(b => b.remove());

      if (!phone) {
        phoneInput.value = '';
        phoneInput.readOnly = false;
        phoneInput.style.pointerEvents = 'auto';
        phoneInput.style.userSelect = 'text';
        phoneInput.style.cursor = 'text';
        return;
      }

      const clean = phone.replace(/\D/g, '');
      phoneInput.value = clean.replace(/(\d)(\d{3})(\d{3})(\d{2})(\d{2})/, '+7 ($2) $3-$4-$5');
      
      phoneInput.readOnly = true;
      phoneInput.style.pointerEvents = 'none';
      phoneInput.style.userSelect = 'none';
      phoneInput.style.cursor = 'default';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'edit-phone-btn';
      editBtn.textContent = 'изменить';
      editBtn.style.cssText = `
        position:absolute;right:12px;top:50%;transform:translateY(-50%);
        background:rgba(255,255,255,0.16);border:1.2px solid rgba(255,255,255,0.28);
        color:#fff;padding:8px 15px;border-radius:10px;font-size:0.85rem;
        font-weight:500;cursor:pointer;backdrop-filter:blur(14px);z-index:10;
      `;

      editBtn.onclick = () => {
        phoneInput.readOnly = false;
        phoneInput.style.pointerEvents = 'auto';
        phoneInput.style.userSelect = 'text';
        phoneInput.style.cursor = 'text';
        phoneInput.focus();
        phoneInput.select();
        phoneInput.value = '+7';
        editBtn.remove();
      };

      phoneWrapper.appendChild(editBtn);
    };

    // ✅ МАСКА ТЕЛЕФОНА
    phoneInput.addEventListener('input', () => {
      let v = phoneInput.value.replace(/\D/g, '').slice(0, 11);
      if (v && !v.startsWith('7')) v = '7' + v.slice(0,10);
      if (v.length === 11) v = v.slice(1);
      if (v) phoneInput.value = '+7 (' + v.slice(0,3) + ') ' + v.slice(3,6) + '-' + v.slice(6,8) + '-' + v.slice(8);
    });

    // ✅ КУЛДАУН И ОТПРАВКА
    const COOLDOWN_SECONDS = 30;
    let canSendMessage = true;

    const startClientCooldown = () => {
      canSendMessage = false;
      const submitBtn = form.querySelector('button[type="submit"]');
      if (!submitBtn) return;

      let secondsLeft = COOLDOWN_SECONDS;
      submitBtn.disabled = true;
      submitBtn.style.opacity = '0.6';
      submitBtn.style.cursor = 'not-allowed';

      const tick = () => {
        if (secondsLeft <= 0) {
          canSendMessage = true;
          submitBtn.disabled = false;
          submitBtn.innerHTML = submitBtn.dataset.originalText || 'Отправить';
          submitBtn.style.opacity = '';
          submitBtn.style.cursor = '';
          return;
        }
        submitBtn.innerHTML = `Отправить (${secondsLeft})`;
        secondsLeft--;
        setTimeout(tick, 1000);
      };
      submitBtn.innerHTML = `Отправить (${secondsLeft})`;
      tick();
    };

    // ✅ ОТПРАВКА ФОРМЫ
    form.onsubmit = async (e) => {
      e.preventDefault();

      if (!canSendMessage) {
        showError('Подождите окончания таймера!');
        return;
      }

      if (!isAuth()) {
        authAlert.classList.add('show');
        document.body.style.overflow = 'hidden';
        return;
      }

      const name = nameInput.value.trim();
      const email = form.querySelector('input[type="email"]')?.value.trim() || '';
      const msg = form.querySelector('textarea')?.value.trim();
      const phoneValue = phoneInput.value.replace(/\D/g, '');

      if (!name) return nameInput.focus(), showError('Укажите ФИО');
      if (!email || !/@/.test(email)) return form.querySelector('input[type="email"]')?.focus(), showError('Неверный email');
      if (!msg) return form.querySelector('textarea')?.focus(), showError('Напишите сообщение');
      if (phoneValue.length !== 11) return phoneInput.focus(), showError('Номер телефона неполный');

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Отправка...';

      try {
        const res = await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name, email, message: msg,
            phone: '+7' + phoneValue.slice(1),
            sent_at_msk: new Date(Date.now() + 3*60*60*1000).toISOString().slice(0,19).replace('T', ' ')
          })
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok && data.success) {
          startClientCooldown();
          showSuccess();
          setTimeout(() => form.reset(), 150);
          setTimeout(() => fillPhone(), 200);
        } else if (res.status === 429) {
          startClientCooldown();
          showError('Слишком много сообщений. Подождите 30 секунд.');
        } else {
          showError(data.error || 'Ошибка сервера');
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'Отправить';
        }
      } catch (err) {
        showError('Нет интернета');
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Отправить';
      }
    };

    // ✅ ИНИЦИАЛИЗАЦИЯ
    fillPhone();
    return { phoneInput, nameInput };
  };

  // ✅ ИНИЦИАЛИЗИРУЕМ ОБЕ ФОРМЫ!
  const desktopFormData = initForm(desktopForm);
  const mobileFormData = initForm(mobileForm);

  console.log('✅ Инициализированы формы:', { desktop: !!desktopFormData, mobile: !!mobileFormData });

  // === МОБИЛЬНАЯ ШТОРКА ===
  const mobileFeedbackBtn = document.getElementById('feedbackBtnMobile');
  const mobileFeedbackTop = document.getElementById('mobileFeedbackTop');
  const mobileFeedbackSheet = document.getElementById('mobileFeedbackSheet');

  if (mobileFeedbackBtn && mobileFeedbackTop && mobileFeedbackSheet) {
    mobileFeedbackBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (!isAuth()) {
        authAlert?.classList.add('show');
        document.body.style.overflow = 'hidden';
        return;
      }
      
      mobileFeedbackTop.classList.add('active');
      mobileFeedbackSheet.classList.add('active');
      document.body.classList.add('sheet-open');
      
      setTimeout(() => {
        const nameInput = mobileForm?.querySelector('.name-input');
        nameInput?.focus();
      }, 300);
    });

    // Закрытие шторки
    const closeBtns = document.querySelectorAll('#closeMobileFeedback, .mobile-feedback-back, .sheet-back-btn');
    closeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        mobileFeedbackTop.classList.remove('active');
        mobileFeedbackSheet.classList.remove('active');
        document.body.classList.remove('sheet-open');
      });
    });
  }

  // === ГЛОБАЛЬНЫЕ СОБЫТИЯ ===
  window.addEventListener('storage', () => {
    if (desktopFormData) desktopFormData.fillPhone?.();
    if (mobileFormData) mobileFormData.fillPhone?.();
  });

  // === ФУНКЦИИ УВЕДОМЛЕНИЙ (добавь если нет) ===
  const showError = (msg) => {
    const alert = document.createElement('div');
    alert.textContent = msg;
    alert.style.cssText = `
      position: fixed; top: 20px; right: 20px; background: #ef4444; 
      color: white; padding: 12px 20px; border-radius: 12px; 
      z-index: 10000; font-weight: 500; box-shadow: 0 10px 30px rgba(239,68,68,0.4);
    `;
    document.body.appendChild(alert);
    setTimeout(() => alert.remove(), 4000);
  };

  const showSuccess = () => {
    const alert = document.createElement('div');
    alert.innerHTML = '<i class="fas fa-check"></i> Сообщение отправлено!';
    alert.style.cssText = `
      position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
      background: #10b981; color: white; padding: 12px 24px; border-radius: 12px;
      z-index: 10000; font-weight: 500; box-shadow: 0 10px 30px rgba(16,185,129,0.4);
    `;
    document.body.appendChild(alert);
    setTimeout(() => alert.remove(), 3000);
  };

  // Закрытие алерта авторизации
  authAlert?.addEventListener('click', (e) => {
    if (e.target === authAlert || e.target.classList.contains('alert-close')) {
      authAlert.classList.remove('show');
      document.body.style.overflow = '';
    }
  });
});