// feedback.js — РИГА 10 НОЯБРЯ 2025 — ФИНАЛЬНАЯ РАБОЧАЯ ВЕРСИЯ (БЕЗ БАГОВ)
document.addEventListener('DOMContentLoaded', () => {
  console.clear();
  console.log('%cХуля пялишь ?', 'color: lime; font-size: 24px; font-weight: bold');

  const authAlert = document.getElementById('authAlert');
  const form = document.querySelector('.contact-form');
  const phoneWrapper = document.querySelector('.phone-field-wrapper');
  const phoneInput = phoneWrapper?.querySelector('input[type="tel"]');
  const nameInput = document.querySelector('.name-input');

  if (!authAlert || !form || !phoneWrapper || !phoneInput || !nameInput) {
    console.error('НЕ НАЙДЕНЫ ЭЛЕМЕНТЫ!');
    return;
  }

  phoneWrapper.style.position = 'relative';

  const isAuth = () => {
    const phone = localStorage.getItem('phone') || sessionStorage.getItem('phone');
    return !!phone;
  };

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

  // === КЛИЕНТСКИЙ КУЛДАУН 30 СЕКУНД ===
  const COOLDOWN_SECONDS = 30;
  let canSendMessage = true;

  const startClientCooldown = () => {
    canSendMessage = false;
    const submitBtn = form.querySelector('button[type="submit"]');
    if (!submitBtn) return;

    let secondsLeft = COOLDOWN_SECONDS;

    // Принудительно ставим начальное состояние
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.6';
    submitBtn.style.cursor = 'not-allowed';

    const tick = () => {
      if (secondsLeft <= 0) {
        canSendMessage = true;
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Отправить';
        submitBtn.style.opacity = '';
        submitBtn.style.cursor = '';
        return;
      }

      submitBtn.innerHTML = `Отправить (${secondsLeft})`;
      secondsLeft--;
      setTimeout(tick, 1000);
    };

    // Сразу пишем (30) — без задержки
    submitBtn.innerHTML = `Отправить (${secondsLeft})`;
    tick(); // запускаем через 0 мс, но с правильным первым кадром
  };

  // УСПЕШНАЯ ОТПРАВКА — САМАЯ ВАЖНАЯ ЧАСТЬ!
  const onSuccessfulSubmit = () => {
    // 1. СРАЗУ включаем таймер на кнопке — ДО reset()!
    startClientCooldown();

    //2. Только потом — успех и очистка
    showSuccess();
    
    //3. reset() делаем с небольшой задержкой, чтобы кнопка не "сбросилась"
    setTimeout(() => {
      form.reset();
      fillPhone(); // обновляем поле телефона
    }, 150);
  };

  // === ОТПРАВКА ФОРМЫ ===
  form.onsubmit = async e => {
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
    const email = document.querySelector('input[type="email"]')?.value.trim() || '';
    const msg = document.querySelector('textarea')?.value.trim();
    const phoneValue = phoneInput.value.replace(/\D/g, '');

    if (!name) return nameInput.focus(), showError('Укажите ФИО');
    if (!email || !/@/.test(email)) return document.querySelector('input[type="email"]')?.focus(), showError('Неверный email');
    if (!msg) return document.querySelector('textarea')?.focus(), showError('Напишите сообщение');
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
        onSuccessfulSubmit(); // ВСЁ РАБОТАЕТ!
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

  // === СЛУШАТЕЛИ ===
  authAlert.onclick = e => {
    if (e.target === authAlert || e.target.classList.contains('alert-close')) {
      authAlert.classList.remove('show');
      document.body.style.overflow = '';
    }
  };

  document.addEventListener('click', e => {
    if (e.target?.classList.contains('alert-login-btn')) {
      authAlert.classList.remove('show');
      document.body.style.overflow = '';
      document.getElementById('authBtn')?.click();
    }
  });

  phoneInput.addEventListener('input', () => {
    let v = phoneInput.value.replace(/\D/g, '').slice(0, 11);
    if (v && !v.startsWith('7')) v = '7' + v.slice(0,10);
    if (v.length === 11) v = v.slice(1);
    if (v) phoneInput.value = '+7 (' + v.slice(0,3) + ') ' + v.slice(3,6) + '-' + v.slice(6,8) + '-' + v.slice(8);
  });

  window.addEventListener('storage', fillPhone);
  window.addEventListener('authChanged', fillPhone);
  fillPhone();
});