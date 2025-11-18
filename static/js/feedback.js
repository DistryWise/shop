// feedback.js — РИГА 10 НОЯБРЯ 2025 — ФИНАЛЬНАЯ ВЕРСИЯ
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

  // === ТАЙМЕР ОТПРАВКИ ===
  let feedbackCooldown = null;
  const startFeedbackCooldown = (seconds) => {
    let cooldownEl = document.getElementById('feedbackCooldown');
    if (!cooldownEl) {
      cooldownEl = document.createElement('div');
      cooldownEl.id = 'feedbackCooldown';
      cooldownEl.style.cssText = 'display:none; margin:1rem 0; background:rgba(255,255,255,0.08); border-radius:16px; overflow:hidden; position:relative; height:48px; backdrop-filter:blur(10px);';
      cooldownEl.innerHTML = `
        <div id="cooldownProgress" style="position:absolute; left:0; top:0; height:100%; width:100%; background:var(--primary); transition:width 0.9s linear;"></div>
        <div id="cooldownText" style="position:relative; text-align:center; line-height:48px; color:#fff; font-weight:700; font-size:1.1rem;">Подождите 0:30</div>
      `;
      form.parentNode.insertBefore(cooldownEl, form.nextSibling);
    }

    const progressEl = cooldownEl.querySelector('#cooldownProgress');
    const textEl = cooldownEl.querySelector('#cooldownText');
    const submitBtn = form.querySelector('button[type="submit"]');

    cooldownEl.style.display = 'block';
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Подождите...';

    let remaining = seconds;
    const update = () => {
      if (remaining <= 0) {
        clearInterval(feedbackCooldown);
        cooldownEl.style.display = 'none';
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Отправить';
        return;
      }
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      textEl.textContent = `Подождите ${mins}:${secs.toString().padStart(2, '0')}`;
      progressEl.style.width = `${(remaining / seconds) * 100}%`;
      remaining--;
    };
    update();
    clearInterval(feedbackCooldown);
    feedbackCooldown = setInterval(update, 1000);
  };

  // === АЛЕРТЫ ===
  const showError = txt => {
    document.querySelector('.custom-error')?.remove();
    const d = document.createElement('div');
    d.className = 'custom-error';
    d.innerHTML = `<div class="error-content"><i class="fas fa-exclamation-triangle"></i><div><strong>Ошибка</strong><br><span>${txt}</span></div><button class="error-close">×</button></div>`;
    document.body.appendChild(d);
    setTimeout(() => d.classList.add('show'), 50);
    d.querySelector('.error-close').onclick = () => d.remove();
    setTimeout(() => d.remove(), 4000);
  };

  // УСПЕШНАЯ ОТПРАВКА — НОВАЯ ВЕРСИЯ
  const showSuccess = () => {
    document.querySelectorAll('.custom-success').forEach(el => el.remove());
    
    const d = document.createElement('div');
    d.className = 'custom-success';
    d.innerHTML = `
      <div class="success-content">
        <i class="fas fa-check-circle"></i>
        <div>
          <strong>Сообщение отправлено!</strong><br>
          <span style="font-size:0.95rem; opacity:0.9;">Мы ответим вам в течение часа</span>
        </div>
        <button class="success-close">×</button>
      </div>
    `;
    document.body.appendChild(d);
    
    setTimeout(() => d.classList.add('show'), 50);
    
    const close = () => {
      d.classList.remove('show');
      setTimeout(() => d.remove(), 600);
    };
    
    d.querySelector('.success-close').onclick = close;
    d.onclick = (e) => e.target === d && close();
    setTimeout(close, 5000);
  };

  // === ЗАКРЫТИЕ АЛЕРТА АВТОРИЗАЦИИ ===
  authAlert.onclick = e => {
    if (e.target === authAlert || e.target.classList.contains('alert-close')) {
      authAlert.classList.remove('show');
      document.body.style.overflow = '';
    }
  };

  // === КНОПКА "ВОЙТИ" В АЛЕРТЕ ===
  document.addEventListener('click', e => {
    if (e.target && e.target.classList.contains('alert-login-btn')) {
      authAlert.classList.remove('show');
      document.body.style.overflow = '';
      document.getElementById('authBtn')?.click();
    }
  });

  // === МАСКА ТЕЛЕФОНА ===
  phoneInput.addEventListener('input', () => {
    let v = phoneInput.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 0 && !v.startsWith('7')) v = '7' + v.slice(0, 10);
    if (v.length === 11) v = v.slice(1);
    if (v) {
      phoneInput.value = '+7 (' + v.slice(0,3) + ') ' + v.slice(3,6) + '-' + v.slice(6,8) + '-' + v.slice(8);
    }
  });

  // === ГЛАВНАЯ ОТПРАВКА ===
  form.onsubmit = async e => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuth()) {
      authAlert.classList.add('show');
      document.body.style.overflow = 'hidden';
      return;
    }

    const name = nameInput.value.trim();
    const email = document.querySelector('input[type="email"]')?.value.trim();
    const msg = document.querySelector('textarea')?.value.trim();
    const phoneValue = phoneInput.value.replace(/\D/g, '');

    // === ТВОЯ ВАЛИДАЦИЯ С ФОКУСОМ ===
    if (!name) { nameInput.focus(); showError('Заполните поле «ФИО»'); return; }
    if (!email) { document.querySelector('input[type="email"]')?.focus(); showError('Заполните поле «Email»'); return; }
    if (!/@/.test(email)) { document.querySelector('input[type="email"]')?.focus(); showError('Введите корректный Email'); return; }
    if (!msg) { document.querySelector('textarea')?.focus(); showError('Напишите ваше сообщение'); return; }
    if (phoneValue.length !== 11) { phoneInput.focus(); showError('Введите полный номер телефона'); return; }

    const phoneFormatted = `+7 (${phoneValue.slice(1,4)}) ${phoneValue.slice(4,7)}-${phoneValue.slice(7,9)}-${phoneValue.slice(9)}`;
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Отправка...';

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name, 
          email, 
          message: msg, 
          phone: phoneFormatted,
          // ПЕРЕДАЁМ ВРЕМЯ УЖЕ В МСК (+3 от Риги)
          sent_at_msk: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ')
        })
      });

      let data = {};
      try { data = await res.json(); } catch {}

      if (res.ok && data.success) {
        showSuccess();
        form.reset();
        setTimeout(fillPhone, 100);
      }
      else if (res.status === 429 && data.retry_after) {
        startFeedbackCooldown(data.retry_after);
        showError(`Слишком много сообщений. Подождите ${data.retry_after} сек.`);
      }
      else {
        showError(data.error || 'Ошибка сервера');
      }
    } catch (err) {
      showError('Нет интернета');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Отправить';
    }
  };

  // === СЛУШАТЕЛИ ===
  window.addEventListener('storage', fillPhone);
  window.addEventListener('authChanged', fillPhone);
  fillPhone();
});