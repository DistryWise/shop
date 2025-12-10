document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  
// МАКСИМАЛЬНАЯ ЗАЩИТА ОТ БОТОВ 2025: honeypot + canvas fingerprint + поведение
(async () => {
  let fingerprint = 'unknown';

  try {
    // Canvas fingerprint (очень сложно подделать)
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Hello, ботик!', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Hello, ботик!', 4, 17);

    // Дополнительные параметры
    const data = {
      ua: navigator.userAgent,
      lang: navigator.language || navigator.userLanguage,
      platform: navigator.platform,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: `${screen.width}x${screen.height}`,
      canvas: canvas.toDataURL(),
      webgl: (() => {
        try {
          const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          return debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        } catch (e) { return 'blocked'; }
      })(),
      touch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    };

    fingerprint = btoa(JSON.stringify(data)).replace(/=/g, '').slice(0, 120);
  } catch (e) {
    fingerprint = 'error_' + Date.now();
  }

  // Записываем в скрытое поле
  const fpInput = document.getElementById('fp_token');
  if (fpInput) fpInput.value = fingerprint;

  // Глобально доступен
  window.getFingerprint = () => fingerprint;
  window.isBot = () => {
    const honeypot = document.getElementById('honeypot');
    return honeypot && honeypot.value.length > 0;
  };

})();

// Проверка honeypot при отправке


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
// АВТОПОДХВАТ SMS-КОДА — РАБОТАЕТ НА iOS 17+, Android 14+, Chrome/Edge/Safari
if ('OTPCredential' in window) {
  const ac = new AbortController();

  navigator.credentials.get({
    otp: { transport: ['sms'] },
    signal: ac.signal
  }).then(otp => {
    if (otp && otp.code && /^\d{4,6}$/.test(otp.code)) {
      codeInput.value = otp.code.slice(0, 4);
      handleCodeInput();
      showToast('Код подхвачен из SMS!', 'Волшебство сработало');
      
      // Автоматически отправляем через 300мс (чтобы пользователь увидел магию)
      setTimeout(() => {
        if (codeInput.value.length === 4 && !isSubmitting) {
          verifyCodeBtn.click();
        }
      }, 300);
    }
  }).catch(() => {
    // Пользователь отменил или не поддерживается — просто молчим
  });

  // Отменяем запрос через 90 секунд
  setTimeout(() => ac.abort(), 90000);
}
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

  // ЗАЩИТА ОТ БОТОВ — РАННЯЯ ПРОВЕРКА
  if (window.isBot?.()) {
    showToast('Доступ запрещён', 'Поведение подозрительное', true);
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
        fp_token: window.getFingerprint?.() || '',  // ← ВОТ ОН! ОТПРАВЛЯЕТСЯ СРАЗУ
        cart: JSON.parse(localStorage.getItem('clientCart') || '[]')
      })
    });

    const data = await res.json();

    if (res.ok && data.success) {
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

      // ВСЁ НИЖЕ — ТВОЙ УСПЕШНЫЙ ВХОД (БЕЗ ИЗМЕНЕНИЙ)
      localStorage.setItem('phone', cleanPhone);
      sessionStorage.setItem('phone', cleanPhone);
      sessionStorage.setItem('user_id', data.user.id);
      sessionStorage.setItem('is_admin', data.user.is_admin ? '1' : '0');
      currentUser = { phone: cleanPhone, id: data.user.id };

      const notifyAuthChange = () => {
        updateAuthBtn();
        updateMobileAuthBtn();
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new Event('authChanged'));
        window.dispatchEvent(new CustomEvent('authChanged', { detail: { authenticated: true, phone: cleanPhone, userId: data.user.id } }));
        document.dispatchEvent(new Event('authChanged'));
        document.dispatchEvent(new Event('authSuccess'));

        

        setTimeout(() => { updateAuthBtn(); updateMobileAuthBtn(); }, 300);
      };
      notifyAuthChange();

      welcomePhone.innerHTML = `<div style="font-size:1.4rem;font-weight:700;margin-top:6px;">+7 (${cleanPhone.slice(0,3)}) ${cleanPhone.slice(3,6)}-${cleanPhone.slice(6,8)}-${cleanPhone.slice(8)}</div>`;
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
      wrongCodeAttempts++;
      codeInput.value = '';
      codeInput.focus();
      codeInput.style.borderColor = '#ff6b6b';
      codeInput.classList.add('shake');

      if (wrongCodeAttempts >= MAX_WRONG_ATTEMPTS) {
        isCodeBlocked = true;
        showToast('Слишком много попыток', 'Вернитесь назад', true);
        // ... твой блок с алертом (оставь как есть)
      } else {
        const left = MAX_WRONG_ATTEMPTS - wrongCodeAttempts;
        showToast('Неверный код', `Осталось попыток: ${left}`, true);
      }

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
    // Переход на шаг ввода кода — ИСПРАВЛЕННАЯ ВЕРСИЯ 2025
  const goToCodeStep = (fullPhone) => {
    maskedPhone.textContent = fullPhone.replace(/(\d{3})(\d{3})(\d{2})(\d{2})/, '$1 *** ** $4');
    stepPhone.style.display = 'none';
    stepCode.style.display = 'block';
    codeInput.value = '';
    codeInput.focus();

    // ←←← ИСПРАВЛЕНИЕ №1: УДАЛЯЕМ ВСЕ СТАРЫЕ КНОПКИ
    document.querySelectorAll('.change-phone-btn').forEach(btn => btn.remove());

    // ←←← ИСПРАВЛЕНИЕ №2: СОЗДАЁМ СВЕЖУЮ КНОПКУ КАЖДЫЙ РАЗ
    const newBtn = document.createElement('button');
    newBtn.textContent = 'Изменить номер';
    newBtn.className = 'change-phone-btn';
    newBtn.style.cssText = `
      background:transparent;color:#888;font-size:0.95rem;margin-top:12px;
      border:none;cursor:pointer;text-decoration:underline;
    `;
    newBtn.onclick = () => {
      localStorage.removeItem(SAVED_PHONE_KEY);
      stepCode.style.display = 'none';
      stepPhone.style.display = 'block';
      phoneInput.value = '';
      phoneInput.focus();
      document.querySelectorAll('.change-phone-btn').forEach(b => b.remove());
      resendTimerActive = false;
      resendCode.textContent = 'Отправить код заново';
      resendCode.style.pointerEvents = 'none';
      resendCode.style.opacity = '0.6';
    };

    stepCode.appendChild(newBtn); // добавляем новую кнопку
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

  // РАННЯЯ ПРОВЕРКА НА КЛИЕНТЕ
  if (window.isBot?.()) {
    showToast('Доступ запрещён', 'Бот обнаружен', true);
    return;
  }

  sendCodeBtn.disabled = true;
  sendCodeBtn.textContent = 'Отправка...';

  try {
    const res = await fetch('/api/send_code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        phone: fullPhone,
        fp_token: window.getFingerprint?.() || ''  // ← ВОТ ОНО! ОБЯЗАТЕЛЬНО!
      })
    });

    const data = await res.json();

    if (data.success) {
      localStorage.setItem(SAVED_PHONE_KEY, JSON.stringify({ countryCode, phoneDigits }));
      goToCodeStep(fullPhone);
      showToast('<span style="white-space:nowrap; font-size:1.02rem; font-weight:600; letter-spacing:0.5px">Код отправлен! Проверьте SMS</span>');
    } else {
      showToast('Ошибка', data.error || 'Попробуйте позже', true);
    }
  } catch (err) {
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
  body: JSON.stringify({ 
    phone: fullPhone,
    fp_token: window.getFingerprint?.() || ''  // ← ДОБАВЬ!
  })
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

  toast.innerHTML = window.innerWidth < 1026
    ? `<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">${title}${msg ? ' — ' + msg : ''}</div>`
    : `${title}${msg ? `<br><small style="font-weight:500; opacity:0.88; font-size:0.95rem;">${msg}</small>` : ''}`;

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
    position:fixed;
    inset:0;
    background:${isLight ? 'rgba(250,250,250,0.96)' : 'rgba(0,0,0,0.94)'};
    backdrop-filter:blur(32px);
    -webkit-backdrop-filter:blur(32px);
    display:flex;
    align-items:center;
    justify-content:center;
    z-index:99999;
    opacity:0;
    transition:opacity .5s cubic-bezier(0.22,1,0.36,1);
    padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
    box-sizing:border-box;
  `;

  // ВАЖНО: используем шаблонные строки + \ перед clamp, чтобы не сломать кавычки
alertBox.innerHTML = `
  <div style="
    background:${isLight ? '#ffffff' : 'rgba(18,18,18,0.98)'};
    border:${isLight ? '1.8px solid rgba(0,0,0,0.14)' : '1.5px solid rgba(255,255,255,0.16)'};
    border-radius:28px;
    padding:clamp(1.8rem, 6vw, 2.6rem) clamp(1.6rem, 5vw, 2.6rem);
    text-align:center;
    max-width:92vw;
    width:100%;
    box-shadow:${isLight 
      ? '0 32px 80px rgba(0,0,0,0.16), 0 16px 40px rgba(0,0,0,0.1)' 
      : '0 40px 100px rgba(0,0,0,0.7)'};
    animation:popIn 0.55s cubic-bezier(0.22,1,0.36,1) forwards;
  ">
    <!-- Иконка -->
    <i class="fas fa-sign-out-alt" style="
      font-size:clamp(2.8rem, 10vw, 3.6rem) !important;
      color:#ff453a;
      margin-bottom:clamp(0.9rem, 3vw, 1.4rem) !important;
      display:block;
    "></i>
    
    <!-- Заголовок — теперь с жёстким переносом -->
    <h3 style="
      margin:0 0 clamp(0.6rem, 2vw, 1rem);
      font-size:clamp(1.45rem, 5.2vw, 1.85rem) !important;
      font-weight:800;
      line-height:1.22;
      letter-spacing:-0.03em;
      color:${isLight ? '#000000' : '#ffffff'};
      max-width:100%;
      white-space:normal !important;
      overflow-wrap:anywhere;
      word-break:break-word;
      hyphens:auto;
    ">Выйти из аккаунта?</h3>
    
    <!-- Текст под иконкой — САМАЯ ГЛАВНАЯ ИСПРАВЛЕННАЯ ЧАСТЬ -->
    <p style="
      color:${isLight ? '#555555' : '#bbbbbb'};
      margin:0 0 clamp(1.6rem, 5vw, 2.2rem);
      line-height:1.52;
      font-size:clamp(0.95rem, 3.3vw, 1.08rem) !important;
      padding:0 clamp(0.4rem, 2vw, 0.8rem);
      max-width:100%;
      width:100%;
      box-sizing:border-box;
      white-space:normal !important;
      overflow-wrap:anywhere !important;
      word-break:break-word !important;
      hyphens:auto !important;
    ">Вы будете разлогинены со всех устройств</p>
    
    <!-- Кнопки -->
    <div style="
      display:flex;
      gap:clamp(0.9rem, 3vw, 1.2rem);
      justify-content:center;
      flex-wrap:wrap;
      margin-top:clamp(0.5rem, 2vw, 1rem);
    ">
      <button id="confirmLogout" style="
        background:#ff453a;
        color:#fff;
        border:none;
        padding:clamp(0.85rem, 3vw, 1rem) clamp(1.8rem, 5vw, 2.4rem);
        border-radius:20px;
        font-weight:700;
        font-size:clamp(0.98rem, 3.5vw, 1.1rem) !important;
        cursor:pointer;
        min-width:128px;
        box-shadow:0 12px 32px rgba(255,69,58,0.38);
        transition:all .3s ease;
      ">Выйти</button>
      
      <button id="cancelLogout" style="
        background:${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.11)'};
        color:${isLight ? '#000000' : '#ffffff'};
        border:${isLight ? '1.7px solid rgba(0,0,0,0.2)' : '1.6px solid rgba(255,255,255,0.24)'};
        padding:clamp(0.85rem, 3vw, 1rem) clamp(1.8rem, 5vw, 2.4rem);
        border-radius:20px;
        font-weight:700;
        font-size:clamp(0.98rem, 3.5vw, 1.1rem) !important;
        cursor:pointer;
        min-width:128px;
        transition:all .3s ease;
      ">Отмена</button>
    </div>
  </div>
`;

  // Анимация появления
  document.body.appendChild(alertBox);
  requestAnimationFrame(() => {
    alertBox.style.opacity = '1';
  });

  // Добавляем @keyframes один раз (если ещё нет)
  if (!document.getElementById('logoutPopInStyle')) {
    const style = document.createElement('style');
    style.id = 'logoutPopInStyle';
    style.textContent = `
      @keyframes popIn {
        from { transform:scale(0.86); opacity:0; }
        to   { transform:scale(1); opacity:1; }
      }
    `;
    document.head.appendChild(style);
  }

  return new Promise(resolve => {
    const confirmBtn = alertBox.querySelector('#confirmLogout');
    const cancelBtn = alertBox.querySelector('#cancelLogout');

    const closeModal = () => {
      alertBox.style.opacity = '0';
      setTimeout(() => {
        alertBox.remove();
      }, 500);
      resolve();
    };

    confirmBtn.onclick = async () => {
      try {
        await fetch('/api/logout', { method: 'POST' });
      } catch (e) {}

      localStorage.removeItem(SAVED_PHONE_KEY);
      localStorage.removeItem('phone');
      sessionStorage.clear();
      localStorage.removeItem('clientCart');

      document.dispatchEvent(new CustomEvent('userLoggedOut'));
      currentUser = null;

      updateAuthBtn();
      updateMobileAuthBtn();
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('authChanged', { detail: { authenticated: false } }));

      showToast('Вы вышли', 'До встречи!');
      if (typeof loadCart === 'function') await loadCart();

      closeModal();
    };

    cancelBtn.onclick = closeModal;
    alertBox.onclick = (e) => {
      if (e.target === alertBox) closeModal();
    };
  });
};

// Делаем доступным глобально
window.logout = logout;

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
  // А это — если пользователь вернулся из фона (например, из SMS)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && typeof checkSession === 'function') {
      setTimeout(checkSession, 300);
    }
  });

  // ====================================================================
  // ГЛАВНОЕ: ПЛАШКА С АКТИВНЫМИ ЗАКАЗАМИ ПОЯВЛЯЕТСЯ СРАЗУ ПОСЛЕ ЛОГИНА
  // ====================================================================
  document.addEventListener('authSuccess', () => {
    console.log('authSuccess сработал — показываем плашку заказов');

    // Сбрасываем старый кэш (обязательно при смене аккаунта!)
    if (window.activeOrders !== undefined) {
      delete window.activeOrders;
    }

    // Ждём, пока сервер точно создаст сессию (Flask/Render.com — 700–900 мс)
    setTimeout(() => {
      if (typeof updateFloatingPill === 'function') {
        updateFloatingPill();
      } else {
        // Страховка: если updateFloatingPill подгрузился позже
        const tryAgain = setInterval(() => {
          if (typeof updateFloatingPill === 'function') {
            clearInterval(tryAgain);
            updateFloatingPill();
          }
        }, 200);
        setTimeout(() => clearInterval(tryAgain), 5000); // максимум 5 сек
      }
    }, 850);
  });

  // Дополнительно — если пользователь уже залогинен при загрузке страницы
  if (sessionStorage.getItem('user_id')) {
    setTimeout(() => {
      if (typeof updateFloatingPill === 'function') updateFloatingPill();
    }, 1200);
  }

  // Конец DOMContentLoaded
});


