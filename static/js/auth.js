// /static/js/auth.js — ФИНАЛЬНАЯ ВЕРСИЯ: БЕЗ ДВОЙНОГО ОТКРЫТИЯ, РАБОТАЕТ ВСЁ
let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);

  const modal = $('authModal');
  const closeModal = $('closeAuthModal');
  const phoneInput = $('phoneInput');
  const codeInput = $('codeInput');
  const sendCodeBtn = $('sendCodeBtn');
  const verifyCodeBtn = $('verifyCodeBtn');
  const resendCode = $('resendCode');
  const maskedPhone = $('maskedPhone');
  const welcomePhone = $('welcomePhone');
  const stepPhone = $('stepPhone');
  const stepCode = $('stepCode');
  const stepSuccess = $('stepSuccess');
  const selectedCountry = $('selectedCountry');
  const countryDropdown = $('countryDropdown');

  // === КНОПКА АВТОРИЗАЦИИ ===
  const authBtn = document.getElementById('authBtn');
  if (!authBtn) return;

  // КЛОНИРУЕМ КНОПКУ — УБИРАЕМ ВСЕ СТАРЫЕ КЛИКИ
  const authBtnFresh = authBtn.cloneNode(true);
  authBtn.parentNode.replaceChild(authBtnFresh, authBtn);

  // === ОБНОВЛЕНИЕ КНОПКИ (ЕДИНСТВЕННАЯ ФУНКЦИЯ) ===
  const updateAuthBtn = () => {
    if (currentUser) {
      authBtnFresh.classList.add('logged-in');

      const emojis = ['😊','😎','🥰','🤩','😇','😋','🤔','😴','🥳','🤗','😜','😺','🐶','🐱','🦊','🐼','🦁','🐸','🐵','🤖','👻','🎃','💩','🦄'];
      const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

      authBtnFresh.innerHTML = `
        <div class="auth-avatar">
          ${randomEmoji}
        </div>
        <span class="logout-text">Выйти</span>
      `;

      // КЛИК = ВЫХОД
      authBtnFresh.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        logout();
      };

    } else {
      authBtnFresh.classList.remove('logged-in');
      authBtnFresh.innerHTML = `
        <i class="fas fa-user" style="color:#fff; font-size:1.35rem;"></i>
        <span class="login-text">Войти</span>
      `;

      // КЛИК = ВХОД
      authBtnFresh.onclick = () => {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        phoneInput.focus();
      };
    }
  };

  // === ГЛОБАЛЬНЫЙ ВЫХОД С КРАСИВЫМ АЛЕРТОМ ===

  const logout = async () => {
    const alertBox = document.createElement('div');
    alertBox.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.92); backdrop-filter: blur(28px);
      display: flex; align-items: center; justify-content: center; z-index: 99999; opacity: 0;
      transition: opacity 0.4s ease;
    `;
    alertBox.innerHTML = `
      <div style="background: rgba(15,15,15,0.98); border: 1.5px solid rgba(255,255,255,0.15); border-radius: 28px;
                  padding: 2rem 2.5rem; text-align: center; max-width: 90vw; box-shadow: 0 30px 80px rgba(0,0,0,0.7);">
        <i class="fas fa-sign-out-alt" style="font-size: 3rem; color: #ff6b6b; margin-bottom: 1rem; display: block;"></i>
        <h3 style="margin: 0 0 1rem; font-size: 1.6rem; color: #fff;">Выйти из аккаунта?</h3>
        <p style="color: #aaa; margin-bottom: 1.5rem;">Вы будете разлогинены</p>
        <div style="display: flex; gap: 1rem; justify-content: center;">
          <button id="confirmLogout" style="background: #ff6b6b; color: #fff; border: none; padding: 0.8rem 1.8rem; border-radius: 16px; font-weight: 600; cursor: pointer;">
            Выйти
          </button>
          <button id="cancelLogout" style="background: rgba(255,255,255,0.1); color: #fff; border: 1.5px solid rgba(255,255,255,0.2); padding: 0.8rem 1.8rem; border-radius: 16px; font-weight: 600; cursor: pointer;">
            Отмена
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(alertBox);
    setTimeout(() => alertBox.style.opacity = '1', 10);

    return new Promise(resolve => {
      const confirmBtn = alertBox.querySelector('#confirmLogout');
      const cancelBtn = alertBox.querySelector('#cancelLogout');

      confirmBtn.onclick = async () => {
        try { await fetch('/api/logout', { method: 'POST' }); } catch {}

        // УДАЛЯЕМ ВСЁ, ЧТОБЫ feedback.js СРАЗУ УВИДЕЛ ВЫХОД
        localStorage.removeItem('phone');
        sessionStorage.removeItem('phone');
        sessionStorage.clear();
        localStorage.removeItem('clientCart');

        currentUser = null;

        // ТРИГГЕРИМ ДЛЯ feedback.js
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('authChanged', { detail: { authenticated: false } }));

        showToast('Вы вышли', 'До встречи!');
        if (typeof loadCart === 'function') loadCart();

        alertBox.remove();
        updateAuthBtn();
        resolve();
      };

      cancelBtn.onclick = () => {
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

  // Делаем logout глобальным
  window.logout = logout;

  // === ОТКРЫТИЕ/ЗАКРЫТИЕ МОДАЛКИ ===
  function openModal() {
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    phoneInput.focus();
  }

  function closeModalFunc() {
    modal.classList.remove('show');
    document.body.style.overflow = '';
    stepPhone.style.display = 'block';
    stepCode.style.display = 'none';
    stepSuccess.style.display = 'none';
    phoneInput.value = '';
    codeInput.value = '';
  }

  closeModal.addEventListener('click', closeModalFunc);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModalFunc();
  });

  // === ВЫБОР СТРАНЫ ===
  selectedCountry.addEventListener('click', (e) => {
    e.stopPropagation();
    countryDropdown.classList.toggle('show');
  });

  document.querySelectorAll('.country-item').forEach(item => {
    item.addEventListener('click', () => {
      const code = item.dataset.code;
      const flag = item.dataset.flag;
      selectedCountry.querySelector('.flag').textContent = flag;
      selectedCountry.querySelector('.code').textContent = code;
      countryDropdown.classList.remove('show');
    });
  });

  document.addEventListener('click', () => countryDropdown.classList.remove('show'));

  // === МАСКА ТЕЛЕФОНА ===
  phoneInput.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 10);
    if (v.length >= 3) {
      v = v.replace(/(\d{3})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4');
    }
    e.target.value = v;
  });

  phoneInput.addEventListener('keydown', (e) => {
    if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
      e.preventDefault();
    }
  });

  // === ОТПРАВКА КОДА ===
  sendCodeBtn.addEventListener('click', async () => {
    const code = selectedCountry.querySelector('.code').textContent;
    const phone = code + phoneInput.value.replace(/\D/g, '');

    if (phone.length < 11) {
      showToast('Ошибка', 'Введите полный номер', true);
      return;
    }

    sendCodeBtn.disabled = true;
    sendCodeBtn.textContent = 'Отправка...';

    try {
      const res = await fetch('/api/send_code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });

      const data = await res.json();

      if (data.success) {
        maskedPhone.textContent = phone.replace(/(\d{3})(\d{3})(\d{2})(\d{2})/, '$1 *** ** $4');
        stepPhone.style.display = 'none';
        stepCode.style.display = 'block';
        codeInput.focus();
        showToast('Код отправлен!', 'Введите 1111');
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

  // === ПРОВЕРКА КОДА ===
  verifyCodeBtn.onclick = async () => {
    if (codeInput.value !== '1111') {
      codeInput.style.borderColor = '#ff6b6b';
      showToast('Неверный код', 'Попробуйте 1111', true);
      return;
    }

    const fullPhone = selectedCountry.querySelector('.code').textContent + phoneInput.value.replace(/\D/g, '');

    try {
      const res = await fetch('/api/verify_code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: fullPhone, 
          code: '1111', 
          cart: JSON.parse(localStorage.getItem('clientCart') || '[]') 
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // ЭТО ГЛАВНОЕ — СОХРАНЯЕМ ВО ВСЕХ МЕСТАХ
        const cleanPhone = fullPhone.replace(/\D/g, '');
        
        localStorage.setItem('phone', cleanPhone);
        sessionStorage.setItem('phone', cleanPhone);
        
        sessionStorage.setItem('user_id', data.user.id || '1');
        sessionStorage.setItem('is_admin', data.user.is_admin ? '1' : '0');

        currentUser = { phone: cleanPhone };

        // ТРИГГЕРИМ ОБНОВЛЕНИЕ feedback.js
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('authChanged', { detail: { authenticated: true, phone: cleanPhone } }));

        welcomePhone.innerHTML = `<div style="font-size:1.1rem; opacity:0.9;">Вы вошли как</div><div style="font-size:1.4rem; font-weight:700; margin-top:6px;">+7 (${cleanPhone.slice(1,4)}) ${cleanPhone.slice(4,7)}-${cleanPhone.slice(7,9)}-${cleanPhone.slice(9)}</div>`;
        stepCode.style.display = 'none';
        stepSuccess.style.display = 'block';

        showToast('Успешно!', 'Вы вошли');

        if (typeof mergeClientCart === 'function') await mergeClientCart();
        if (typeof loadCart === 'function') await loadCart();

        updateAuthBtn();
        setTimeout(closeModalFunc, 1800);
      } else {
        // ошибки...
      }
    } catch (e) {
      showToast('Ошибка сервера', '', true);
    }
  };

  resendCode.addEventListener('click', () => {
    stepCode.style.display = 'none';
    stepPhone.style.display = 'block';
    codeInput.value = '';
  });

  // === ПРОВЕРКА СЕССИИ ===
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
    } catch {
      // игнор
    }
  };

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

  // ИНИЦИАЛИЗАЦИЯ КНОПКИ ПРИ СТАРТЕ
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

