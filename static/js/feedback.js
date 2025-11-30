// feedback.js — РИГА 28 НОЯБРЯ 2025 — ✅ ДВЕ ФОРМЫ РАБОТАЮТ!
document.addEventListener('DOMContentLoaded', () => {
  console.clear();
 
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
// === УНИВЕРСАЛЬНАЯ ФУНКЦИЯ ДЛЯ ЛЮБОЙ ФОРМЫ (ИСПРАВЛЕННАЯ) ===
const initForm = (form) => {
  if (!form) return;
  

  const phoneWrapper = form.querySelector('.phone-field-wrapper');
  const phoneInput = phoneWrapper?.querySelector('input[type="tel"]');
  const nameInput = form.querySelector('input[name="name"], .name-input');
  const emailInput = form.querySelector('input[type="email"]');
  const messageInput = form.querySelector('textarea[name="message"]');
  const submitBtn = form.querySelector('button[type="submit"]');

  if (!submitBtn || !nameInput || !emailInput || !messageInput || !phoneInput) {
    console.warn('Не все поля найдены в форме:', form.id);
    return;
  }

  // Сохраняем оригинальный текст кнопки
  if (!submitBtn.dataset.originalText) {
    submitBtn.dataset.originalText = submitBtn.querySelector('.btn-text')?.textContent || 
                                     submitBtn.textContent.trim() || 
                                     'Отправить';
  }

  // === ГЛОБАЛЬНЫЙ ФЛАГ КУЛДАУНА (ОДИН НА ВСЕ ФОРМЫ!) ===
  let canSend = true;
  const COOLDOWN = 30;

  const startCooldown = () => {
    if (!canSend) return;
    canSend = false;

    let seconds = COOLDOWN;
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.6';
    submitBtn.style.cursor = 'not-allowed';

    const updateButton = () => {
      if (seconds <= 0) {
        canSend = true;
        submitBtn.disabled = false;
        submitBtn.style.opacity = '';
        submitBtn.style.cursor = '';

        // Восстанавливаем текст (для обеих версий кнопок)
        const btnText = submitBtn.querySelector('.btn-text') || submitBtn;
        btnText.textContent = submitBtn.dataset.originalText;

        const cooldownSpan = submitBtn.querySelector('.btn-cooldown, .timer');
        if (cooldownSpan) cooldownSpan.style.display = 'none';

        return;
      }

      const cooldownSpan = submitBtn.querySelector('.btn-cooldown') || 
                          submitBtn.querySelector('.timer') || 
                          submitBtn;

      if (cooldownSpan) {
        cooldownSpan.style.display = 'inline';
        cooldownSpan.textContent = `${seconds}с`;
      } else {
        submitBtn.textContent = `Отправить (${seconds})`;
      }

      seconds--;
      setTimeout(updateButton, 1000);
    };

    updateButton();
  };

  // === АВТОЗАПОЛНЕНИЕ ТЕЛЕФОНА ===
    // === АВТОЗАПОЛНЕНИЕ ТЕЛЕФОНА — СТРОГОЕ, НЕЛЬЗЯ РЕДАКТИРОВАТЬ, КАК В contacts.js ===
  const fillPhone = () => {
    const raw = localStorage.getItem('phone') || sessionStorage.getItem('phone');
    
    // Удаляем старые кнопки "изменить", если вдруг были
    phoneWrapper.querySelectorAll('.edit-phone-btn').forEach(b => b.remove());

    if (!raw) {
      phoneInput.value = '+7 (';
      phoneInput.readOnly = false;
      return;
    }

    // Чистим и форматируем номер
    let clean = raw.replace(/\D/g, '');
    if (clean.length !== 11) clean = '7' + '0'.repeat(10); // на всякий случай
    if (clean.startsWith('8')) clean = '7' + clean.slice(1);

    const formatted = `+7 (${clean.slice(1,4)}) ${clean.slice(4,7)}-${clean.slice(7,9)}-${clean.slice(9)}`;
    phoneInput.value = formatted;

    // Делаем поле полностью нередактируемым
    phoneInput.readOnly = true;
    phoneInput.disabled = true;                    // ← важно! полностью блокируем ввод
    phoneInput.style.pointerEvents = 'none';
    phoneInput.style.userSelect = 'none';
    phoneInput.style.background = 'rgba(255,255,255,0.08)';
    phoneInput.style.color = '#fff';
    phoneInput.style.opacity = '0.9';

    // Добавляем красивую кнопку "изменить" (по желанию — можно убрать)
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.textContent = 'изменить';
    editBtn.className = 'edit-phone-btn';
    editBtn.style.cssText = `
      position:absolute;right:12px;top:50%;transform:translateY(-50%);
      background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.3);
      color:#fff;padding:6px 12px;border-radius:8px;font-size:0.8rem;
      backdrop-filter:blur(10px);cursor:pointer;z-index:10;
    `;
    editBtn.onclick = () => {
      phoneInput.disabled = false;
      phoneInput.readOnly = false;
      phoneInput.style.pointerEvents = 'auto';
      phoneInput.style.userSelect = 'text';
      phoneInput.style.background = '';
      phoneInput.style.opacity = '';
      phoneInput.value = '+7 (';
      phoneInput.focus();
      editBtn.remove();
    };

    phoneWrapper.style.position = 'relative';
    phoneWrapper.appendChild(editBtn);
  };

  // === МАСКА ТЕЛЕФОНА (остаётся без изменений) ===
  phoneInput.addEventListener('input', () => {
    let v = phoneInput.value.replace(/\D/g, '').slice(0, 11);
    if (v && !v.startsWith('7')) v = '7' + v.slice(0,10);
    if (v.length === 11) v = v.slice(1);
    if (v.length >= 10) {
      phoneInput.value = '+7 (' + v.slice(0,3) + ') ' + v.slice(3,6) + '-' + v.slice(6,8) + '-' + v.slice(8,10);
    } else if (v.length >= 7) {
      phoneInput.value = '+7 (' + v.slice(0,3) + ') ' + v.slice(3,6) + '-' + v.slice(6);
    } else if (v.length >= 4) {
      phoneInput.value = '+7 (' + v.slice(0,3) + ') ' + v.slice(3);
    } else if (v.length > 0) {
      phoneInput.value = '+7 (' + v.slice(0,3);
    }
  });

  // === ОТПРАВКА ФОРМЫ (УСИЛЕННАЯ ВАЛИДАЦИЯ + РЕАЛЬНЫЙ КУЛДАУН) ===
  form.onsubmit = async (e) => {
    e.preventDefault();

    if (!canSend) {
      showError('Подождите окончания таймера!');
      return;
    }

    if (!isAuth()) {
      authAlert?.classList.add('show');
      document.body.style.overflow = 'hidden';
      return;
    }

    // Строгая валидация
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const message = messageInput.value.trim();
    const phoneRaw = phoneInput.value.replace(/\D/g, '');

    if (!name || name.length < 2) {
      nameInput.focus();

      return;
    }

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      emailInput.focus();

      return;
    }

    if (!message || message.length < 5) {
      messageInput.focus();

      return;
    }

    if (phoneRaw.length !== 11) {
      phoneInput.focus();

      return;
    }

    // Блокируем кнопку сразу
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Отправка...';

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          message,
          phone: '+7' + phoneRaw.slice(1),
          sent_at_msk: new Date(Date.now() + 3*60*60*1000).toISOString().slice(0,19).replace('T', ' ')
        })
      });

      const data = await res.json().catch(() => ({}));

    if (res.ok && data.success) {
  showSuccess('Сообщение отправлено!');
  form.reset();
  fillPhone();
  startCooldown();
  
  // 🔥 ЖЁСТКОЕ ЗАКРЫТИЕ ШТОРКИ (ПРИНУДИТЕЛЬНО)!
  const mobileFeedbackTop = document.getElementById('mobileFeedbackTop');
  const mobileFeedbackSheet = document.getElementById('mobileFeedbackSheet');
  
  // 1. СНАЧАЛА убираем классы
  mobileFeedbackTop?.classList.remove('active');
  mobileFeedbackSheet?.classList.remove('active');
  document.body.classList.remove('sheet-open');
  
  // 2. ПОСЛЕ 100мс — ПРИНУДИТЕЛЬНО скрываем
  setTimeout(() => {
    mobileFeedbackTop.style.display = 'none';
    mobileFeedbackSheet.style.display = 'none';
    mobileFeedbackTop.style.transform = '';
    mobileFeedbackSheet.style.transform = '';
    document.body.style.overflow = '';
  }, 100);
} else if (res.status === 429) {
        startCooldown();
        showError('Слишком много сообщений. Подождите 30 секунд.');
      } else {
        throw new Error(data.error || 'Неизвестная ошибка');
      }
    } catch (err) {
      console.error(err);

      submitBtn.disabled = false;
      submitBtn.innerHTML = submitBtn.dataset.originalText;
    }
  };

  fillPhone();
  return { fillPhone };
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

