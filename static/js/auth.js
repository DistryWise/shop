document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  
  let currentUser = null;  // ← ЭТО ВНЕ DOMContentLoaded!
  let isSubmitting = false;

let wrongCodeAttempts = 0;        // ← СЧЁТЧИК НЕВЕРНЫХ ПОПЫТОК
const MAX_WRONG_ATTEMPTS = 5;     // ← После скольких попыток блокируем
let isCodeBlocked = false;        // ← Флаг блокировки

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

// Делаем поле ввода ПИН-кода идеальным для телефона
codeInput.setAttribute('inputmode', 'numeric');     // Главное — только цифры!
codeInput.setAttribute('pattern', '[0-9]*');        // iOS — открывает цифры сразу
codeInput.setAttribute('type', 'tel');              // Android — тоже цифры + лучше UX
codeInput.setAttribute('autocomplete', 'one-time-code'); // iOS: подхват SMS
codeInput.setAttribute('maxlength', '4');
codeInput.style.fontSize = '2rem';                  // iOS не открывает буквы при маленьком шрифте
codeInput.style.textAlign = 'center';
codeInput.style.letterSpacing = '0.5rem';
codeInput.style.caretColor = 'transparent';        // Скрываем курсор (опционально — красивее)

// Фокус — открываем клавиатуру с цифрами
codeInput.addEventListener('focus', () => {
  codeInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

// Блокируем всё, кроме цифр (на всякий случай)
codeInput.addEventListener('input', function () {
  this.value = this.value.replace(/\D/g, '').slice(0, 4);
  handleCodeInput(); // твоя функция из кода выше
});

// Запрещаем вставку букв (paste)
codeInput.addEventListener('paste', (e) => {
  const paste = (e.clipboardData || window.clipboardData).getData('text');
  if (!/^\d+$/.test(paste)) {
    e.preventDefault();
  }
});
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
  if (isSubmitting || isCodeBlocked) return;
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
      // УСПЕШНЫЙ ВХОД — сбрасываем счётчик
      wrongCodeAttempts = 0;
      isCodeBlocked = false;

      const cleanPhone = phoneInput.value.replace(/\D/g, '');

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

      // ... весь твой код успешного входа (остаётся без изменений)
      localStorage.setItem('phone', cleanPhone);
      sessionStorage.setItem('phone', cleanPhone);
      sessionStorage.setItem('user_id', data.user.id);
      sessionStorage.setItem('is_admin', data.user.is_admin ? '1' : '0');

      currentUser = { phone: cleanPhone, id: data.user.id };

      // Сразу после успешного входа — вместо двух dispatchEvent
const notifyAuthChange = () => {
  // 1. Принудительно обновляем обе кнопки
  updateAuthBtn();
  updateMobileAuthBtn();

  // 2. Кидаем ВСЕ возможные события — один из них точно сработает
  window.dispatchEvent(new Event('storage'));
  window.dispatchEvent(new Event('authChanged'));
  window.dispatchEvent(new CustomEvent('authChanged', { 
    detail: { authenticated: true, phone: cleanPhone, userId: data.user.id } 
  }));
  document.dispatchEvent(new Event('authChanged'));

  // 3. Страховка: через 300мс и 800мс ещё раз дёргаем (особенно для iOS)
  setTimeout(() => {
    updateAuthBtn();
    updateMobileAuthBtn();
  }, 300);
  setTimeout(() => {
    updateAuthBtn();
    updateMobileAuthBtn();
  }, 800);
};

// Вызывай вместо старого кода:
notifyAuthChange();

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
      // НЕВЕРНЫЙ КОД
      wrongCodeAttempts++;

      codeInput.value = '';
      codeInput.focus();
      codeInput.style.borderColor = '#ff6b6b';
      codeInput.classList.add('shake');

      if (wrongCodeAttempts >= MAX_WRONG_ATTEMPTS) {
        // БЛОКИРУЕМ ПОПЫТКИ
        isCodeBlocked = true;

        showToast('Слишком много попыток', 'Вернитесь назад', true);

        // Красивый алерт как при выходе
        const blockAlert = document.createElement('div');
        blockAlert.style.cssText = `
          position:fixed;inset:0;background:rgba(0,0,0,0.94);backdrop-filter:blur(28px);
          display:flex;align-items:center;justify-content:center;z-index:99999;opacity:0;
          transition:opacity .5s ease;
        `;
        blockAlert.innerHTML = `
          <div style="background:rgba(20,20,25,0.98);border:1.5px solid rgba(255,100,100,0.3);border-radius:28px;
                      padding:2.2rem 2.6rem;text-align:center;max-width:90vw;box-shadow:0 30px 80px rgba(0,0,0,0.8);">
            <div style="font-size:4.5rem;margin-bottom:1rem;">Locked</div>
            <h3 style="margin:0 0 1rem;font-size:1.7rem;color:#ff6b6b;">Слишком много попыток</h3>
            <p style="color:#ccc;margin:0 0 1.8rem;line-height:1.5;">
              Вы ввели неверный код 5 раз.<br>Для безопасности — возвращаемся к вводу номера.
            </p>
            <button id="backToPhoneBtn" style="background:#ff4444;color:#fff;border:none;padding:1rem 2.4rem;
                 border-radius:20px;font-weight:700;font-size:1.1rem;cursor:pointer;min-width:180px;">
              Вернуться к номеру
            </button>
          </div>
        `;
        document.body.appendChild(blockAlert);
        setTimeout(() => blockAlert.style.opacity = '1', 10);

        blockAlert.querySelector('#backToPhoneBtn').onclick = () => {
          // Возврат на шаг телефона
          localStorage.removeItem(SAVED_PHONE_KEY);
          stepCode.style.display = 'none';
          stepPhone.style.display = 'block';
          stepSuccess.style.display = 'none';
          phoneInput.value = '';
          phoneInput.focus();
          changePhoneBtn.remove();

          // Сброс состояния
          wrongCodeAttempts = 0;
          isCodeBlocked = false;
          resendTimerActive = false;
          resendCode.textContent = 'Отправить код заново';
          resendCode.style.pointerEvents = 'none';
          resendCode.style.opacity = '0.6';

          blockAlert.remove();
        };

        // Автозакрытие алерта через 8 секунд + возврат
        setTimeout(() => {
          if (document.body.contains(blockAlert)) {
            blockAlert.querySelector('#backToPhoneBtn')?.click();
          }
        }, 8000);

      } else {
        const left = MAX_WRONG_ATTEMPTS - wrongCodeAttempts;
        showToast('Неверный код', `Осталось попыток: ${left}`, true);
      }

      verifyCodeBtn.disabled = true;
      verifyCodeBtn.style.opacity = '0.5';
      verifyCodeBtn.style.cursor = 'not-allowed';
      verifyCodeBtn.textContent = 'Войти';
    }
  } catch (err) {
    showToast('Ошибка сервера', 'Попробуйте позже', true);
    codeInput.classList.add('shake');
  } finally {
    isSubmitting = false;
    if (!isCodeBlocked) {
      verifyCodeBtn.disabled = codeInput.value.length !== 4;
      verifyCodeBtn.style.opacity = codeInput.value.length === 4 ? '1' : '0.5';
      verifyCodeBtn.style.cursor = codeInput.value.length === 4 ? 'pointer' : 'not-allowed';
    }
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
const updateMobileAuthBtn = () => {
  const mobileAuthBtn = document.getElementById('mobileAuthBtn');
  if (!mobileAuthBtn) return;

  // Полностью очищаем кнопку — 100% надёжно
  mobileAuthBtn.innerHTML = '';

  if (currentUser) {
    const emojis = ['😊','😎','😍','🤩','😇','😋','🤔','😴','🥳','🤗','🤪','😏','🐱','🐶','🦊','🐼','🦁','🐸','🐵','🤖','👻','🎃','💩','🦄','😀','😂','🤣','🤠','🤡','👽','🥷','🦸','🧙','🕵️'];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

    const emojiSpan = document.createElement('div');
    emojiSpan.className = 'live-emoji';
    emojiSpan.textContent = randomEmoji;
    mobileAuthBtn.appendChild(emojiSpan);

    mobileAuthBtn.classList.add('logged-in');
    mobileAuthBtn.setAttribute('data-label', 'Выход');

    // Анимация появления эмодзи
    requestAnimationFrame(() => {
      emojiSpan.style.animation = 'none';
      requestAnimationFrame(() => emojiSpan.style.animation = '');
    });

  } else {
    const icon = document.createElement('i');
    icon.className = 'fas fa-user';
    mobileAuthBtn.appendChild(icon);

    mobileAuthBtn.classList.remove('logged-in');
    mobileAuthBtn.setAttribute('data-label', 'Вход');
  }
};

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
      sessionStorage.setItem('is_admin', data.is_admin || '0');

      updateAuthBtn();
      updateMobileAuthBtn();        // ← сразу
      ensureMobileAuthBtnUpdated(); // ← и через страховку
    }
  } catch (err) {
    console.error('Session check failed:', err);
  }
};
  window.checkSession = checkSession;
  checkSession();

  window.checkSession = checkSession;
  checkSession();

  // === ТОСТЫ ===
 function showToast(title, msg = '', error = false) {
  // Определяем текущую тему
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
                 document.body.classList.contains('dark');

  // Цвета под каждую тему
  const colors = {
    bg: error 
      ? 'rgba(255, 107, 107, 0.96)'                                 // красный для ошибок — одинаковый везде
      : isDark 
        ? 'rgba(35, 35, 40, 0.97)'                                 // тёмный фон в тёмной теме
        : 'rgba(255, 255, 255, 0.97)',                             // белый фон в светлой теме

    text: error 
      ? '#ffffff'                                                  // белый текст на ошибке
      : isDark 
        ? '#ffffff'                                                // белый текст в тёмной теме
        : '#000000',                                               // чёрный текст в светлой теме

    border: isDark 
      ? 'rgba(255, 255, 255, 0.18)' 
      : 'rgba(0, 0, 0, 0.12)'
  };

  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 28px;
    left: 50%;
    transform: translateX(-50%);
    background: ${colors.bg};
    color: ${colors.text};
    padding: 1.2rem 2.6rem;
    border-radius: 20px;
    border: 1.5px solid ${colors.border};
    z-index: 99999;
    font-weight: 700;
    font-size: 1.1rem;
    box-shadow: 0 20px 50px rgba(0,0,0,${isDark ? '0.6' : '0.35'});
    backdrop-filter: blur(16px);
    animation: toastPop 0.6s cubic-bezier(0.22,1,0.36,1);
    max-width: 90vw;
    text-align: center;
    line-height: 1.4;
  `;

  toast.innerHTML = `
    ${title}
    ${msg ? `<br><small style="font-weight:500; opacity:0.88; font-size:0.95rem;">${msg}</small>` : ''}
  `;

  document.body.appendChild(toast);

  // Автоудаление
  setTimeout(() => {
    toast.style.transition = 'all 0.4s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(20px) scale(0.9)';
    setTimeout(() => toast.remove(), 400);
  }, 3200);
}


  // === ESC ===
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('show')) {
      closeModalFunc()
    }
  });

const logout = async () => {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';

  const alertBox = document.createElement('div');
  alertBox.style.cssText = `
    position:fixed;inset:0;
    background:${isLight ? 'rgba(250,250,250,0.96)' : 'rgba(0,0,0,0.92)'};
    backdrop-filter:blur(28px);
    display:flex;align-items:center;justify-content:center;
    z-index:99999;opacity:0;transition:opacity .45s ease;
  `;

  alertBox.innerHTML = `
    <div style="
      background:${isLight ? '#ffffff' : 'rgba(15,15,15,0.98)'};
      border:${isLight ? '1.8px solid rgba(0,0,0,0.16)' : '1.5px solid rgba(255,255,255,0.15)'};
      border-radius:28px;padding:2.2rem 2.6rem;text-align:center;max-width:90vw;
      box-shadow:${isLight 
        ? '0 40px 100px rgba(0,0,0,0.18), 0 20px 60px rgba(0,0,0,0.12)' 
        : '0 30px 80px rgba(0,0,0,0.7)'};
    ">
      <i class="fas fa-sign-out-alt" style="
        font-size:3.2rem;color:#ff6b6b;margin-bottom:1rem;display:block;
      "></i>
      
      <h3 style="
        margin:0 0 1rem;font-size:1.7rem;font-weight:700;
        color:${isLight ? '#000000' : '#ffffff'};
      ">Выйти из аккаунта?</h3>
      
      <p style="
        color:${isLight ? '#444444' : '#aaaaaa'};
        margin-bottom:2rem;line-height:1.5;font-size:1.02rem;
      ">Вы будете разлогинены со всех устройств</p>
      
      <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;">
        <button id="confirmLogout" style="
          background:#ff3b30;color:#fff;border:none;
          padding:0.9rem 2rem;border-radius:18px;font-weight:600;
          font-size:1.05rem;cursor:pointer;min-width:130px;
          box-shadow:0 10px 30px rgba(255,59,48,0.35);
        ">Выйти</button>
        
        <button id="cancelLogout" style="
          background:${isLight ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.12)'};
          color:${isLight ? '#000000' : '#ffffff'};
          border:${isLight ? '1.7px solid rgba(0,0,0,0.22)' : '1.5px solid rgba(255,255,255,0.22)'};
          padding:0.9rem 2rem;border-radius:18px;font-weight:600;
          font-size:1.05rem;cursor:pointer;min-width:130px;
        ">Отмена</button>
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

      localStorage.removeItem(SAVED_PHONE_KEY);
      localStorage.removeItem('phone');
      sessionStorage.clear();
      localStorage.removeItem('clientCart');

      document.dispatchEvent(new CustomEvent('userLoggedOut'));
      currentUser = null;

      // Сброс модалки авторизации
      const modal = $('authModal');
      if (modal) modal.classList.remove('show');
      document.body.style.overflow = '';
      
      const stepPhone = $('stepPhone');
      const stepCode = $('stepCode');
      const stepSuccess = $('stepSuccess');
      const phoneInput = $('phoneInput');
      const codeInput = $('codeInput');

      if (stepPhone) stepPhone.style.display = 'block';
      if (stepCode) stepCode.style.display = 'none';
      if (stepSuccess) stepSuccess.style.display = 'none';
      if (phoneInput) phoneInput.value = '';
      if (codeInput) codeInput.value = '';

      updateAuthBtn();
      updateMobileAuthBtn();
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('authChanged', { detail: { authenticated: false } }));

      showToast('Вы вышли', 'До встречи!');
      if (typeof loadCart === 'function') await loadCart();

      alertBox.remove();
      resolve();
    };

    const closeAndResolve = () => {
      alertBox.remove();
      resolve();
    };

    alertBox.querySelector('#cancelLogout').onclick = closeAndResolve;
    alertBox.onclick = (e) => e.target === alertBox && closeAndResolve();
  });
};

// Делаем доступным глобально
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
    // === МОБИЛЬНАЯ КНОПКА АВТОРИЗАЦИИ — работает точно как десктопная (как в поиске) ===
  const mobileAuthBtn = $('mobileAuthBtn');
  if (mobileAuthBtn) {
    mobileAuthBtn.addEventListener('click', (e) => {
      e.preventDefault();
      currentUser ? window.logout() : openModalWithState();
    });
  }
});

// === ГАРАНТИРОВАННОЕ обновление мобильной кнопки авторизации ===
const ensureMobileAuthBtnUpdated = () => {
  const btn = document.getElementById('mobileAuthBtn');
  if (btn) {
    updateMobileAuthBtn();
    return;
  }

  // Если кнопки ещё нет — ждём её появления (максимум 5 секунд)
  let attempts = 0;
  const interval = setInterval(() => {
    const btn = document.getElementById('mobileAuthBtn');
    if (btn || attempts > 50) {  // 50 × 100мс = 5 сек
      clearInterval(interval);
      if (btn) updateMobileAuthBtn();
    }
    attempts++;
  }, 100);
};

// Запускаем сразу + через 300мс + через 1с — на все случаи жизни
ensureMobileAuthBtnUpdated();
setTimeout(ensureMobileAuthBtnUpdated, 300);
setTimeout(ensureMobileAuthBtnUpdated, 1000);

// Также обновляем при любом изменении авторизации
window.addEventListener('authChanged', ensureMobileAuthBtnUpdated);
window.addEventListener('storage', () => setTimeout(ensureMobileAuthBtnUpdated, 100));

  // Это сработает даже если JS загрузился позже DOM
  document.addEventListener('DOMContentLoaded', () => {
    // Проверяем сессию при каждой загрузке страницы
    if (typeof checkSession === 'function') {
      checkSession();
    }

    // И ещё раз через секунду — на случай, если пользователь вернулся из SMS
    setTimeout(() => {
      if (typeof checkSession === 'function') checkSession();
    }, 1000);
  });

  // А это — если страница уже загружена, но пользователь вернулся из фона
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && typeof checkSession === 'function') {
      setTimeout(checkSession, 300);
    }
  });

