document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  



  let currentUser = null;  // ← ЭТО ВНЕ DOMContentLoaded!
  let isSubmitting = false;

  const modal = $('authModal');
  const closeModal = $('closeAuthModal');


const phoneInput = $('phoneInput');

// УБИРАЕМ ЛИШНЕЕ, СТАВИМ ТОЧНО ПОД НУЖНЫЙ ФОРМАТ
phoneInput.removeAttribute('maxlength'); // убираем старое ограничение
phoneInput.setAttribute('maxlength', '17');
phoneInput.setAttribute('size', '17');
phoneInput.style.minWidth = '290px';

// ИДЕАЛЬНЫЙ ФОРМАТ — (999) 999 99 99 → ровно 17 символов
phoneInput.addEventListener('input', function () {
  let digits = this.value.replace(/\D/g, '').slice(0, 10);

  let formatted = '';
  if (digits.length > 0)   formatted = '(' + digits.slice(0, 3);
  if (digits.length >= 4)  formatted += ') ' + digits.slice(3, 6);
  if (digits.length >= 7)  formatted += ' ' + digits.slice(6, 8);
  if (digits.length >= 9)  formatted += ' ' + digits.slice(8, 10); // последние 2 цифры

  this.value = formatted;
});

// Защита от ввода лишнего — даже если как-то обойдёт maxlength
phoneInput.addEventListener('keydown', function (e) {
  const value = this.value.replace(/\D/g, '');
  if (value.length >= 10 && !e.ctrlKey && !e.metaKey && e.key.length === 1) {
    e.preventDefault();
  }
});

// Дополнительно: чтобы при полном стирании не оставалось "("
phoneInput.addEventListener('keydown', function (e) {
  if (e.key === 'Backspace' && phoneInput.value === '(') {
    e.preventDefault();
    phoneInput.value = '';
  }
});
// Чтобы при полном стирании не оставалось "("
phoneInput.addEventListener('keydown', function (e) {
  // Если нажали Backspace и в поле только "(", очистим полностью
  if (e.key === 'Backspace' && phoneInput.value === '(') {
    phoneInput.value = '';
  }
});
  
  const codeInput = $('codeInput');
  const verifyCodeBtn = $('verifyCodeBtn');
  const sendCodeBtn = $('sendCodeBtn');

  const privacyCheck = $('privacyCheck');

const updateSendBtnState = () => {
  const has10Digits = phoneInput.value.replace(/\D/g, '').length === 10;
  const isPrivacyChecked = privacyCheck?.checked;

  if (has10Digits && isPrivacyChecked) {
    sendCodeBtn.disabled = false;
    sendCodeBtn.style.opacity = '1';
    sendCodeBtn.style.cursor = 'pointer';
  } else {
    sendCodeBtn.disabled = true;
    sendCodeBtn.style.opacity = '0.5';
    sendCodeBtn.style.cursor = 'not-allowed';
  }
};

// Слушаем галочку и ввод номера
privacyCheck?.addEventListener('change', updateSendBtnState);
phoneInput.addEventListener('input', updateSendBtnState);

// Первичная проверка (чтобы кнопка была неактивна при открытии модалки)
updateSendBtnState();


  verifyCodeBtn.onclick = async () => {
    if (isSubmitting) return;
    isSubmitting = true;

    const code = codeInput.value.trim();
    if (!code || code.length < 4) {
      codeInput.style.borderColor = '#ff6b6b';
      codeInput.classList.add('shake');
      showToast('Введите код', '', true);
      isSubmitting = false;
      return;
    }

    verifyCodeBtn.disabled = true;
    verifyCodeBtn.textContent = 'Проверка...';

    const fullPhone = selectedCountry.querySelector('.code').textContent + phoneInput.value.replace(/\D/g, '');

    try {
      const res = await fetch('/api/verify_code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: fullPhone,
          code: code,
          cart: JSON.parse(localStorage.getItem('clientCart') || '[]')
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
      const cleanPhone = phoneInput.value.replace(/\D/g, ''); // это всегда 10 цифр после +7

              // ИСПРАВЛЕННЫЙ БЛОК — РАБОТАЕТ НА 100%
              const subscribeCheck = document.getElementById('subscribeCheck');
              const smsConsentGiven = subscribeCheck ? subscribeCheck.checked : false;

              await fetch('/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  phone: '7' + cleanPhone,
                  sms_consent: smsConsentGiven ? 1 : 0
                })
              });

        localStorage.setItem('phone', cleanPhone);
        sessionStorage.setItem('phone', cleanPhone);
        sessionStorage.setItem('user_id', data.user.id);
        sessionStorage.setItem('is_admin', data.user.is_admin ? '1' : '0');

        currentUser = { phone: cleanPhone, id: data.user.id };

        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('authChanged', { detail: { authenticated: true, phone: cleanPhone, userId: data.user.id } }));

        welcomePhone.innerHTML = `
          <div style="font-size:1.4rem; font-weight:700; margin-top:6px;">
            +7 (${cleanPhone.slice(0,3)}) ${cleanPhone.slice(3,6)}-${cleanPhone.slice(6,8)}-${cleanPhone.slice(8)}
          </div>
        `;

        stepCode.style.display = 'none';
        stepSuccess.style.display = 'block';
        stepSuccess.style.animation = 'none';
        requestAnimationFrame(() => stepSuccess.style.animation = '');

        showToast('Добро пожаловать!', 'Вы успешно вошли');

        if (typeof mergeClientCart === 'function') await mergeClientCart();
        if (typeof loadCart === 'function') await loadCart();

        localStorage.removeItem(SAVED_PHONE_KEY);
        updateAuthBtn();
        setTimeout(closeModalFunc, 1800);

        if (document.getElementById('subsBody')) {
          setTimeout(() => loadSubscribers?.(), 2200);
      }


      } else {
        codeInput.value = '';
        codeInput.focus();
        codeInput.style.borderColor = '#ff6b6b';
        codeInput.classList.add('shake');
        showToast('Неверный код', 'Попробуйте ещё раз', true);

        verifyCodeBtn.disabled = true;
        verifyCodeBtn.style.opacity = '0.5';
        verifyCodeBtn.style.cursor = 'not-allowed';
        verifyCodeBtn.textContent = 'Войти';
      }
    } catch {
      showToast('Ошибка сервера', 'Попробуйте позже', true);
      codeInput.classList.add('shake');
    } finally {
      isSubmitting = false;
    }
  };

const handleCodeInput = () => {
  let value = codeInput.value.replace(/\D/g, '').slice(0, 4);
  codeInput.value = value;

  if (value.length === 4) {
    verifyCodeBtn.disabled = false;
    verifyCodeBtn.style.opacity = '1';
    verifyCodeBtn.style.cursor = 'pointer';

    // Автоотправка с защитой от дублей
    clearTimeout(window.codeAutoSubmitTimer); // очищаем предыдущий таймер
    window.codeAutoSubmitTimer = setTimeout(() => {
      if (codeInput.value.length === 4 && !isSubmitting) {
        verifyCodeBtn.click();
      }
    }, 400);

  } else {
    verifyCodeBtn.disabled = true;
    verifyCodeBtn.style.opacity = '0.5';
    verifyCodeBtn.style.cursor = 'not-allowed';
    clearTimeout(window.codeAutoSubmitTimer);
  }
};

  codeInput.addEventListener('input', handleCodeInput);
  codeInput.addEventListener('focus', () => {
    codeInput.style.borderColor = '';
    codeInput.classList.remove('shake');
  });

  verifyCodeBtn.disabled = true;
  verifyCodeBtn.style.opacity = '0.5';
  verifyCodeBtn.style.cursor = 'not-allowed';

  // ИНИЦИАЛИЗАЦИЯ: кнопка изначально выключена
  verifyCodeBtn.disabled = true;
  verifyCodeBtn.style.opacity = '0.5';
  verifyCodeBtn.style.cursor = 'not-allowed';
  const resendCode = $('resendCode');
  const maskedPhone = $('maskedPhone');
  const welcomePhone = $('welcomePhone');
  const stepPhone = $('stepPhone');
  const stepCode = $('stepCode');
  const stepSuccess = $('stepSuccess');
  const selectedCountry = $('selectedCountry');
  const countryDropdown = $('countryDropdown');

    // === ВЫБОР СТРАНЫ — РАБОЧАЯ ШТОРКА ===
  selectedCountry.style.cursor = 'pointer';
  selectedCountry.onclick = (e) => {
    e.stopPropagation();
    const isShown = countryDropdown.classList.contains('show');
    
    // Закрываем все другие дропдауны (на всякий случай)
    document.querySelectorAll('.country-dropdown').forEach(d => d.classList.remove('show'));
    
    // Переключаем текущий
    countryDropdown.classList.toggle('show', !isShown);
  };

  // Клик по пункту страны
  countryDropdown.addEventListener('click', (e) => {
    const item = e.target.closest('.country-item');
    if (!item) return;

    const code = item.dataset.code;
    const flag = item.dataset.flag || (code === '+7' ? 'RU' : 'KZ');

    selectedCountry.querySelector('.code').textContent = code;
    selectedCountry.querySelector('.flag').textContent = flag;

    countryDropdown.classList.remove('show');

    // Сбрасываем поле ввода при смене страны
    phoneInput.value = '';
    phoneInput.focus();
    updateSendBtnState();
  });

  // Закрытие при клике вне
  document.addEventListener('click', () => {
    countryDropdown.classList.remove('show');
  });

  // Чтобы клик по дропдауну не закрывал его
  countryDropdown.addEventListener('click', (e) => e.stopPropagation());

  // Кнопка "Изменить номер"
  const changePhoneBtn = document.createElement('button');
  changePhoneBtn.textContent = 'Изменить номер';
  changePhoneBtn.className = 'change-phone-btn';
  changePhoneBtn.style.cssText = `
    background: transparent; color: #888; font-size: 0.95rem; margin-top: 12px;
    border: none; cursor: pointer; text-decoration: underline;
  `;

  let resendTimerActive = false;
  let resendCountdown = 0;
  const SAVED_PHONE_KEY = 'auth_pending_phone';

  // Переход на шаг ввода кода
  const goToCodeStep = (fullPhone) => {
    maskedPhone.textContent = fullPhone.replace(/(\d{3})(\d{3})(\d{2})(\d{2})/, '$1 *** ** $4');
    stepPhone.style.display = 'none';
    stepCode.style.display = 'block';
    codeInput.focus();

    if (!document.querySelector('.change-phone-btn')) {
      stepCode.appendChild(changePhoneBtn);
    }
    startResendTimer();
  };

  // === КНОПКА АВТОРИЗАЦИИ ===
  const authBtn = document.getElementById('authBtn');
  if (!authBtn) return;

  const authBtnFresh = authBtn.cloneNode(true);
  authBtn.parentNode.replaceChild(authBtnFresh, authBtn);

  // ОБНОВЛЕНИЕ КНОПКИ: ВОЙТИ / ВЫЙТИ + СЛУЧАЙНЫЕ ЭМОДЗИ

const updateAuthBtn = () => {
  if (currentUser) {
    authBtnFresh.classList.add('logged-in');

    // ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
    // НАСТОЯЩИЕ СМАЙЛИКИ — БРАУЗЕР ИХ ПОКАЖЕТ!
    const emojis = ['😊','😎','😍','🤩','😇','😋','🤔','😴','🥳','🤗','🤪','😏','🐱','🐶','🦊','🐼','🦁','🐸','🐵','🤖','👻','🎃','💩','🦄','😀','😂','🤣','🤠','🤡','👽','🥷','🦸','🧙','🕵️'];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

authBtnFresh.innerHTML = `
      <div class="live-emoji">${randomEmoji}</div>
      <span class="logout-text">Выйти</span>
    `;

    // АНИМАЦИЯ ПРИ КАЖДОМ ВХОДЕ
    const avatar = authBtnFresh.querySelector('.live-emoji');
    avatar.style.animation = 'none';
    requestAnimationFrame(() => avatar.style.animation = '');

    // КЛИК = ВЫХОД
    authBtnFresh.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.logout();
    };

  } else {
    // === ТЫ НЕ ВОШЁЛ ===
    authBtnFresh.classList.remove('logged-in');
    authBtnFresh.innerHTML = `
      <i class="fas fa-user"></i>
      <span class="login-text">Войти</span>
    `;

    // КЛИК = ОТКРЫТЬ МОДАЛКУ
    authBtnFresh.onclick = () => openModalWithState();
  }
};

  // Открытие модалки с восстановлением состояния
  const openModalWithState = () => {
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';

    const saved = localStorage.getItem(SAVED_PHONE_KEY);
    if (saved) {
      const { countryCode, phoneDigits } = JSON.parse(saved);
      selectedCountry.querySelector('.code').textContent = countryCode;
      selectedCountry.querySelector('.flag').textContent = countryCode === '+7' ? 'RU' : 'KZ';

      phoneInput.value = phoneDigits.replace(/(\d{3})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4');
      const fullPhone = countryCode + phoneDigits;
      goToCodeStep(fullPhone);
    } else {
      phoneInput.focus();
    }
  };

  // Закрытие модалки (localStorage НЕ стирается!)
  const closeModalFunc = () => {
    modal.classList.remove('show');
    document.body.style.overflow = '';
  };

  closeModal.addEventListener('click', closeModalFunc);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModalFunc(); });

  // Кнопка "Изменить номер"
  changePhoneBtn.onclick = () => {
    localStorage.removeItem(SAVED_PHONE_KEY);
    stepCode.style.display = 'none';
    stepPhone.style.display = 'block';     // ← ИСПРАВЛЕНО!
    stepSuccess.style.display = 'none';    // ← ИСПРАВЛЕНО!

    phoneInput.value = '';
    phoneInput.focus();
    changePhoneBtn.remove();
    resendTimerActive = false;
    resendCode.textContent = 'Отправить код заново';
    resendCode.style.pointerEvents = 'none';
    resendCode.style.opacity = '0.6';
  };

  // Отправка кода + сохранение номера
  sendCodeBtn.addEventListener('click', async () => {
    const countryCode = selectedCountry.querySelector('.code').textContent;
    const phoneDigits = phoneInput.value.replace(/\D/g, '');
    const fullPhone = countryCode + phoneDigits;

    if (phoneDigits.length !== 10) {
      showToast('Ошибка', 'Введите полный номер', true);
      return;
    }

    sendCodeBtn.disabled = true;
    sendCodeBtn.textContent = 'Отправка...';

    try {
      const res = await fetch('/api/send_code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone })
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem(SAVED_PHONE_KEY, JSON.stringify({ countryCode, phoneDigits }));
        goToCodeStep(fullPhone);
        showToast('Код отправлен!', 'Проверьте SMS');
      } else {
        showToast('Ошибка', data.error || 'Попробуйте позже', true);
      }
    } catch {
      showToast('Нет сети', '', true);
    } finally {
      sendCodeBtn.disabled = false;
      sendCodeBtn.textContent = 'Получить код';
    }
  });


  // Таймер повторной отправки
  const startResendTimer = () => {
    if (resendTimerActive) return;
    resendTimerActive = true;
    resendCountdown = 60;
    resendCode.textContent = `Повторить через 60с`;
    resendCode.style.pointerEvents = 'none';
    resendCode.style.opacity = '0.6';

    const timer = setInterval(() => {
      resendCountdown--;
      if (resendCountdown <= 0) {
        clearInterval(timer);
        resendCode.textContent = 'Отправить код заново';
        resendCode.style.pointerEvents = '';
        resendCode.style.opacity = '1';
        resendTimerActive = false;
      } else {
        resendCode.textContent = `Повторить через ${resendCountdown}с`;
      }
    }, 1000);
  };

  // Повторная отправка
  resendCode.addEventListener('click', async () => {
    if (resendTimerActive) return;
    const saved = localStorage.getItem(SAVED_PHONE_KEY);
    if (!saved) return;

    const { countryCode, phoneDigits } = JSON.parse(saved);
    const fullPhone = countryCode + phoneDigits;

    sendCodeBtn.disabled = true;
    sendCodeBtn.textContent = 'Отправка...';

    try {
      const res = await fetch('/api/send_code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone })
      });
      const data = await res.json();

      if (data.success) {
        codeInput.value = '';
        codeInput.focus();
        showToast('Код отправлен повторно!', 'Проверьте SMS');
        startResendTimer();
      } else {
        showToast('Ошибка', data.error || 'Попробуйте позже', true);
      }
    } catch {
      showToast('Нет сети', '', true);
    } finally {
      sendCodeBtn.disabled = false;
      sendCodeBtn.textContent = 'Получить код';
    }
  });

  // Проверка сессии при загрузке
  const checkSession = async () => {
    try {
      const res = await fetch('/api/session');
      const data = await res.json();
      if (data.logged_in) {
        currentUser = { phone: data.phone };
        sessionStorage.setItem('user_id', data.user_id);
        sessionStorage.setItem('phone', data.phone);
        sessionStorage.setItem('is_admin', data.is_admin);
        
        updateAuthBtn();
      }
    } catch {}
  };
  window.checkSession = checkSession;
  checkSession();

  window.checkSession = checkSession;
  checkSession();

  // === ТОСТЫ ===
  function showToast(title, msg = '', error = false) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
      background: ${error ? 'rgba(255,107,107,0.94)' : 'rgba(255,255,255,0.96)'};
      color: ${error ? '#fff' : '#000'};
      padding: 1.2rem 2.4rem; border-radius: 20px; z-index: 99999;
      font-weight: 700; font-size: 1.1rem; box-shadow: 0 20px 50px rgba(0,0,0,0.5);
      backdrop-filter: blur(15px); border: 1.5px solid rgba(255,255,255,0.15);
      animation: toastPop 0.6s cubic-bezier(0.22,1,0.36,1);
    `;
    toast.innerHTML = `${title}${msg ? '<br><small style="font-weight:500;opacity:0.85;">' + msg + '</small>' : ''}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  const style = document.createElement('style');
  style.textContent = `
    @keyframes toastPop {
      0% { transform: translateX(-50%) translateY(40px) scale(0.85); opacity: 0; }
      100% { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
    }
  `;
  document.head.appendChild(style);

  // === ESC ===
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('show')) {
      closeModalFunc()
    }
  });

const logout = async () => {
  const alertBox = document.createElement('div');
  alertBox.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.92);backdrop-filter:blur(28px);
    display:flex;align-items:center;justify-content:center;z-index:99999;opacity:0;
    transition:opacity .4s ease;
  `;
  alertBox.innerHTML = `
    <div style="background:rgba(15,15,15,0.98);border:1.5px solid rgba(255,255,255,0.15);border-radius:28px;
                padding:2rem 2.5rem;text-align:center;max-width:90vw;box-shadow:0 30px 80px rgba(0,0,0,0.7);">
      <i class="fas fa-sign-out-alt" style="font-size:3rem;color:#ff6b6b;margin-bottom:1rem;display:block;"></i>
      <h3 style="margin:0 0 1rem;font-size:1.6rem;color:#fff;">Выйти из аккаунта?</h3>
      <p style="color:#aaa;margin-bottom:1.5rem;">Вы будете разлогинены</p>
      <div style="display:flex;gap:1rem;justify-content:center;">
        <button id="confirmLogout" style="background:#ff6b6b;color:#fff;border:none;padding:.8rem 1.8rem;border-radius:16px;font-weight:600;cursor:pointer;">
          Выйти
        </button>
        <button id="cancelLogout" style="background:rgba(255,255,255,0.1);color:#fff;border:1.5px solid rgba(255,255,255,0.2);padding:.8rem 1.8rem;border-radius:16px;font-weight:600;cursor:pointer;">
          Отмена
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(alertBox);
  setTimeout(() => alertBox.style.opacity = '1', 10);

  return new Promise(resolve => {
    alertBox.querySelector('#confirmLogout').onclick = async () => {
      try {
        await fetch('/api/logout', { method: 'POST' });
      } catch (e) {}

      // ГЛАВНОЕ: чистим ВСЁ, что может «запомнить» старый вход
      localStorage.removeItem(SAVED_PHONE_KEY);   // ← было только здесь, теперь надёжно
      localStorage.removeItem('phone');
      sessionStorage.clear();
      localStorage.removeItem('clientCart');

      // ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
      // ЭТО САМАЯ ВАЖНАЯ СТРОКА — БЕЗ НЕЁ НИЧЕГО НЕ РАБОТАЕТ!
      document.dispatchEvent(new CustomEvent('userLoggedOut'));
      // ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←

      currentUser = null;

      // Сразу возвращаем модалку авторизации в начальное состояние
      const modal = $('authModal');
      const stepPhone = $('stepPhone');
      const stepCode = $('stepCode');
      const stepSuccess = $('stepSuccess');
      const phoneInput = $('phoneInput');
      const codeInput = $('codeInput');

      if (modal) modal.classList.remove('show');
      if (document.body.style.overflow === 'hidden') document.body.style.overflow = '';
      if (stepPhone) stepPhone.style.display = 'block';
      if (stepCode) stepCode.style.display = 'none';
      if (stepSuccess) stepSuccess.style.display = 'none';
      if (phoneInput) phoneInput.value = '';
      if (codeInput) codeInput.value = '';

      updateAuthBtn();
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('authChanged', { detail: { authenticated: false } }));

      showToast('Вы вышли', 'До встречи!');
      if (typeof loadCart === 'function') await loadCart();

      alertBox.remove();
      resolve();
    };

    alertBox.querySelector('#cancelLogout').onclick = () => {
      alertBox.remove();
      resolve();
    };

    alertBox.onclick = (e) => {
      if (e.target === alertBox) {
        alertBox.remove();
        resolve();
      }
    };
  });
};

  // САМАЯ ГЛАВНАЯ СТРОКА — ДЕЛАЕТ logout ДОСТУПНЫМ ИЗ updateAuthBtn
  window.logout = logout;

  // Инициализация кнопки при старте
  updateAuthBtn();

    // === КНОПКА "ВОЙТИ" В АЛЕРТЕ authAlert (feedback.js) ===
  document.addEventListener('click', (e) => {
    if (e.target && e.target.matches('#authAlert .alert-login-btn')) {
      e.preventDefault();
      document.getElementById('authAlert')?.classList.remove('show');
      document.body.style.overflow = '';
      
      // Открываем настоящую авторизацию
      const authBtn = document.getElementById('authBtn');
      if (authBtn) authBtn.click();
    }
  });
});


