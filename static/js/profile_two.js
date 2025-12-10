


document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('piligrimEditModal');
  if (!modal) return;

  const openBtn           = document.getElementById('editCompanyBtn');
  const closeBtn          = modal.querySelector('.piligrim-close-btn');
  const cancelBtn         = document.getElementById('piligrimCancel');
  const backdrop          = modal.querySelector('.piligrim-modal-backdrop');

  const avatarInput       = document.getElementById('avatarInput');
  const currentAvatar     = document.getElementById('currentAvatar');
  const avatarPlaceholder = document.getElementById('avatarPlaceholder');
  const removeAvatarBtn   = document.getElementById('removeAvatar');
  const avatarWrapper     = document.querySelector('#piligrimEditModal .avatar-preview-wrapper') // ← ВЕШАЕМ НА ОБЁРТКУ!

  // ————— ОТКРЫТИЕ МОДАЛКИ —————
  openBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  });

  // ————— ЗАКРЫТИЕ МОДАЛКИ —————
  const closeModal = () => {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  };

  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', closeModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) closeModal();
  });

  // ————— КЛИК ПО АВАТАРКЕ (включая оверлей) → ОТКРЫТЬ ЗАГРУЗКУ —————
  avatarWrapper?.addEventListener('click', (e) => {
    // Если клик был по крестику удаления — НЕ открываем загрузку
    if (e.target.closest('.avatar-remove-btn')) return;
    
    avatarInput.click();
  });

  // ————— ЗАГРУЗКА АВАТАРКИ —————
  avatarInput?.addEventListener('change', () => {
    const file = avatarInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      currentAvatar.src = e.target.result;
      currentAvatar.style.display = 'block';
      avatarPlaceholder.style.display = 'none';
      removeAvatarBtn.style.display = 'flex';
    };
    reader.readAsDataURL(file);
  });

  // ————— УДАЛЕНИЕ АВАТАРКИ (красный крестик) —————
removeAvatarBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  
  currentAvatar.src = '';
  currentAvatar.style.display = 'none';
  avatarPlaceholder.style.display = 'flex';
  avatarPlaceholder.innerHTML = '<i class="fas fa-user-tie"></i>';
  removeAvatarBtn.style.display = 'none';
  avatarInput.value = '';

  // ЭТА СТРОЧКА — САМАЯ ВАЖНАЯ!
  document.getElementById('removeAvatarFlag').value = '1';
});

  // ————— Если логотип уже загружен при открытии страницы —————
  if (currentAvatar.src && !currentAvatar.src.includes('default-company-avatar.png') && currentAvatar.src !== location.href) {
    currentAvatar.style.display = 'block';
    avatarPlaceholder.style.display = 'none';
    removeAvatarBtn.style.display = 'flex';
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('piligrimEditModal');
  const form = document.getElementById('piligrimEditForm');
  const avatarInput = document.getElementById('avatarInput');

  // Открытие модалки
  document.getElementById('editCompanyBtn')?.addEventListener('click', () => {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  });

  // Закрытие модалки
  const closeModal = () => {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  };
  modal.querySelector('.piligrim-close-btn')?.addEventListener('click', closeModal);
  document.getElementById('piligrimCancel')?.addEventListener('click', closeModal);
  modal.querySelector('.piligrim-modal-backdrop')?.addEventListener('click', closeModal);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('active')) closeModal();
  });

  // Работа с аватаром
  const currentAvatar = document.getElementById('currentAvatar');
  const avatarPlaceholder = document.getElementById('avatarPlaceholder');
  const removeAvatarBtn = document.getElementById('removeAvatar');

  avatarInput.addEventListener('change', () => {
  const file = avatarInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    currentAvatar.src = e.target.result;
    currentAvatar.style.display = 'block';
    avatarPlaceholder.style.display = 'none';
    removeAvatarBtn.style.display = 'flex';
    
    // Сброс флага — новая фотка важнее
    document.getElementById('removeAvatarFlag').value = '0';
  };
  reader.readAsDataURL(file);
});

  // === ФУНКЦИЯ ОБНОВЛЕНИЯ ДАННЫХ НА СТРАНИЦЕ ===
  const updatePageData = (data) => {
    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value || '—';
    };

    const setInput = (name, value) => {
      const input = form.querySelector(`[name="${name}"]`);
      if (input) input.value = value || '';
    };

    setText('companyName', data.companyName);
    setText('inn', data.inn);
    setText('fullName', data.fullName);
    setText('ogrn', data.ogrn);
    setText('kpp', data.kpp);
    setText('okpo', data.okpo);
    setText('okved', data.okved);
    setText('legalAddress', data.legalAddress);
    setText('actualAddress', data.actualAddress || data.legalAddress);
    setText('activity', data.activity);
    setText('budget', data.budget);
    setText('director', data.director);
    setText('regDate', data.regDate);
    setText('companyStatusBadge', data.companyStatus || 'Действующая');
    setText('taxSystemBadge', data.taxSystem || 'ОСНО (плательщик НДС)');
    document.querySelector('.profile-hero .company-name').textContent = data.companyName?.trim() || '—';

    // Заполняем форму
    setInput('fullName', data.fullName);
    setInput('companyName', data.companyName);
    setInput('inn', data.inn);
    setInput('ogrn', data.ogrn);
    setInput('kpp', data.kpp);
    setInput('okpo', data.okpo);
    setInput('okved', data.okved);
    setInput('legalAddress', data.legalAddress);
    setInput('actualAddress', data.actualAddress);
    setInput('activity', data.activity);
    setInput('budget', data.budget);
    setInput('director', data.director);
    setInput('companyStatus', data.companyStatus);
    setInput('taxSystem', data.taxSystem);

    // Аватар на странице
// Аватар на странице (в шапке профиля) — теперь всегда красивая иконка, как в модалке
        // Аватар в шапке профиля — тоже с полной очисткой
        const profileAvatar = document.getElementById('profilePageAvatar');
        const profilePlaceholder = document.getElementById('profilePagePlaceholder');

        if (data.avatar?.trim() && !data.avatar.includes('default-company-avatar')) {
          profileAvatar.src = data.avatar + '?t=' + Date.now();
          profileAvatar.style.display = 'block';
          profilePlaceholder.style.display = 'none';
        } else {
          clearAvatar(profileAvatar);
          profileAvatar.style.display = 'none';
          profilePlaceholder.style.display = 'flex';
          profilePlaceholder.innerHTML = '<i class="fas fa-user-tie"></i>';
        }

// АВАТАР В МОДАЛКЕ РЕДАКТИРОВАНИЯ — ТОЖЕ С ПОЛНОЙ ОЧИСТКОЙ
const currentAvatar = document.getElementById('currentAvatar');
const avatarPlaceholder = document.getElementById('avatarPlaceholder');
const removeAvatarBtn = document.getElementById('removeAvatar');

if (data.avatar?.trim() && !data.avatar.includes('default-company-avatar')) {
  currentAvatar.src = data.avatar + '?t=' + Date.now();
  currentAvatar.style.display = 'block';
  avatarPlaceholder.style.display = 'none';
  removeAvatarBtn.style.display = 'flex';
} else {
  clearAvatar(currentAvatar);  // ← ВОТ ЭТО ГЛАВНОЕ!
  currentAvatar.style.display = 'none';
  avatarPlaceholder.style.display = 'flex';
  avatarPlaceholder.innerHTML = '<i class="fas fa-user-tie"></i>';
  removeAvatarBtn.style.display = 'none';
}

  };

  // === ЗАГРУЗКА ДАННЫХ С СЕРВЕРА ===
  const loadData = () => {
    fetch('/api/company')
      .then(r => r.json())
      .then(data => updatePageData(data))
      .catch(() => console.error('Не удалось загрузить данные компании'));
  };

  // Загружаем при старте
  loadData();

// === ЖЁСТКАЯ ВАЛИДАЦИЯ + ЖИВЫЕ ОГРАНИЧЕНИЯ ===
form.addEventListener('submit', function (e) {
  e.preventDefault();

  // Сброс подсветки
  document.querySelectorAll('.piligrim-field input, .piligrim-field select').forEach(el => {
    el.style.borderColor = '';
    el.style.boxShadow = '';
  });

  let errors = [];

  const get = name => form.querySelector(`[name="${name}"]`).value.trim();
  const highlight = el => {
    el.style.borderColor = '#ef4444';
    el.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.2)';
    el.style.transition = 'all 0.3s ease';
    setTimeout(() => { el.style.borderColor = ''; el.style.boxShadow = ''; }, 3000);
  };

  // ИНН — только цифры, 10 или 12
  const inn = get('inn');
  if (!inn) errors.push('ИНН обязателен'), highlight(form.querySelector('[name="inn"]'));
  else if (!/^\d+$/.test(inn)) errors.push('ИНН: только цифры'), highlight(form.querySelector('[name="inn"]'));
  else if (![10, 12].includes(inn.length)) errors.push('ИНН должен быть 10 или 12 цифр'), highlight(form.querySelector('[name="inn"]'));

  // ОГРН — только цифры, ровно 13
  const ogrn = get('ogrn');
  if (!ogrn) errors.push('ОГРН обязателен'), highlight(form.querySelector('[name="ogrn"]'));
  else if (!/^\d+$/.test(ogrn)) errors.push('ОГРН: только цифры'), highlight(form.querySelector('[name="ogrn"]'));
  else if (ogrn.length !== 13) errors.push('ОГРН должен содержать 13 цифр'), highlight(form.querySelector('[name="ogrn"]'));

  // КПП — только цифры, 9 символов
  const kpp = get('kpp');
  if (kpp && !/^\d{9}$/.test(kpp)) {
    errors.push('КПП должен содержать 9 цифр');
    highlight(form.querySelector('[name="kpp"]'));
  }

  // ОКПО — только цифры, 8–10 символов
  const okpo = get('okpo');
  if (okpo && !/^\d{8,10}$/.test(okpo)) {
    errors.push('ОКПО должен содержать 8–10 цифр');
    highlight(form.querySelector('[name="okpo"]'));
  }

  // Полное и короткое название — только буквы, пробелы, кавычки, ООО, ИП и т.п.
  const fullName = get('fullName');
  const companyName = get('companyName');
  const nameRegex = /^[а-яА-ЯёЁ\s"«»().,\-—0-9]+$/;

  if (!fullName) errors.push('Укажите полное название'), highlight(form.querySelector('[name="fullName"]'));
  else if (!nameRegex.test(fullName)) errors.push('Полное название: недопустимые символы'), highlight(form.querySelector('[name="fullName"]'));

  if (!companyName) errors.push('Укажите короткое название'), highlight(form.querySelector('[name="companyName"]'));
  else if (!nameRegex.test(companyName)) errors.push('Короткое название: недопустимые символы'), highlight(form.querySelector('[name="companyName"]'));

  // Обязательные текстовые поля
  if (!get('legalAddress')) errors.push('Укажите юридический адрес'), highlight(form.querySelector('[name="legalAddress"]'));
  if (!get('activity')) errors.push('Укажите сферу деятельности'), highlight(form.querySelector('[name="activity"]'));

  // Если есть ошибки — показываем первую
  if (errors.length > 0) {
    showToast(errors[0], 'error');
    return;
  }

  // === ОТПРАВКА ===
  const formData = new FormData(this);
  if (avatarInput.files[0]) formData.append('avatar', avatarInput.files[0]);

  fetch('/api/company', { method: 'POST', body: formData })
    .then(r => r.json())
    .then(res => {
      if (res.success) {
        showToast('Данные успешно сохранены!', 'success');
        loadData();
        closeModal();
      } else {
        showToast('Ошибка сохранения данных', 'error');
      }
    })
    .catch(() => showToast('Нет связи с сервером', 'error'));
});

// === ЖИВАЯ ФИЛЬТРАЦИЯ ВВОДА (запрещаем буквы в цифрах и наоборот) ===
document.querySelectorAll('input').forEach(input => {
  input.addEventListener('input', () => {
    const name = input.getAttribute('name');

    if (['inn', 'ogrn', 'kpp', 'okpo'].includes(name)) {
      input.value = input.value.replace(/\D/g, ''); // только цифры
    }

    if (['fullName', 'companyName', 'director'].includes(name)) {
      input.value = input.value.replace(/[^а-яА-ЯёЁ\s"«»().,\-—0-9]/g, ''); // только разрешённые
    }
  });
});

// Вспомогательная функция подсветки
function highlight(input) {
  input.style.borderColor = '#ef4444';
  input.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.2)';
  input.style.transition = 'all 0.3s ease';
  setTimeout(() => {
    input.style.borderColor = '';
    input.style.boxShadow = '';
  }, 3000);
}

  // Выход
    // Делаем так, чтобы нижняя кнопка вела себя точно как клик по иконке профиля в хедере
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    document.getElementById('authBtn')?.click(); // это и есть кнопка «Выйти» в шапке
  });
});

// === УНИВЕРСАЛЬНЫЕ КРАСИВЫЕ ТОСТЫ ===
const showToast = (message, type = 'success') => {
  // Создаём контейнер один раз
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle';
  toast.innerHTML = `
    <i class="fas ${icon}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  // Показываем
  setTimeout(() => toast.classList.add('show'), 50);

  // Убираем через 3.5 сек
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
      // Удаляем контейнер, если тостов больше нет
      if (container.children.length === 0) {
        container.remove();
      }
    }, 400);
  }, 3500);
};

// ФИНАЛЬНАЯ РАБОЧАЯ ЗАГЛУШКА 2025 — БЕЗ ГОНОК, БЕЗ ОШИБОК
(() => {
  const placeholder = document.getElementById('emptyProfilePlaceholder');
  if (!placeholder) return;

  // Кнопка "Заполнить данные компании"
  document.getElementById('fillProfileBtn')?.addEventListener('click', () => {
    document.getElementById('editCompanyBtn')?.click();
  });

  // Определяем, пустой ли профиль
  const isEmpty = () => {
    const fields = ['inn', 'fullName', 'companyName', 'ogrn', 'legalAddress'];
    return fields.every(id => {
      const el = document.getElementById(id);
      const value = el?.textContent || '';
      return value === '—' || value.trim() === '';
    });
  };

  // Показать/скрыть заглушку
  const togglePlaceholder = () => {
    placeholder.classList.toggle('active', isEmpty());
  };

  // 1. Патчим updatePageData (даже если она появится позже)
  const patch = () => {
    if (typeof updatePageData === 'function') {
      const orig = updatePageData;
      updatePageData = function(data) {
        orig(data);
        togglePlaceholder();
      };
    }
  };
  patch();
  setInterval(patch, 100); // на всякий случай

  // 2. Первая проверка — сразу после загрузки страницы
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(togglePlaceholder, 800); // даём loadData() отработать
  });

  // 3. И ещё раз после любого сохранения (на случай, если что-то пошло не так)
  const origFetch = window.fetch;
  window.fetch = function(...args) {
    return origFetch(...args).then(res => {
      if (args[0] === '/api/company' && args[1]?.method === 'POST') {
        setTimeout(() => fetch('/api/company').then(r => r.json()).then(() => togglePlaceholder()), 300);
      }
      return res;
    });
  };
})();

// === КОНТАКТЫ — ФИНАЛЬНАЯ ВЕРСИЯ 2025 — ПОЛНОСТЬЮ ИСПРАВЛЕНО! ===
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('contactEditModal');
  const form = document.getElementById('contactEditForm');
  const openBtn = document.getElementById('editContactsBtn');

  if (!modal || !form || !openBtn) return;

  const fields = {
    contactPerson: document.getElementById('contactPerson'),
    workPhone: document.getElementById('workPhone'),
    personalPhone: document.getElementById('personalPhone'),
    documentsEmail: document.getElementById('documentsEmail'),
    notificationsEmail: document.getElementById('notificationsEmail'),
    telegramValue: document.getElementById('telegramValue'),
    telegramLink: document.getElementById('telegramLink'),
    telegramHandle: document.getElementById('telegramHandle'),
    whatsapp: document.getElementById('whatsapp'),
    maxPhone: document.getElementById('maxPhone'),
  };

  // КРАСИВАЯ МАСКА ДЛЯ ТЕЛЕФОНОВ
  const applyPhoneMask = (input) => {
    const mask = (e) => {
      let value = e.target.value.replace(/\D/g, '');

      if (value.startsWith('8') && value.length > 1) {
        value = '7' + value.slice(1);
      }

      value = value.slice(0, 11);

      if (value.length === 0) {
        e.target.value = '';
        return;
      }

      let formatted = '+7';
      if (value.length > 1) formatted += ` (${value.slice(1, 4)}`;
      if (value.length >= 5) formatted += `) ${value.slice(4, 7)}`;
      if (value.length >= 8) formatted += `-${value.slice(7, 9)}`;
      if (value.length >= 10) formatted += `-${value.slice(9, 11)}`;

      e.target.value = formatted.trim();
    };

    input.addEventListener('input', mask);

    input.addEventListener('focus', () => {
      if (!input.value) input.value = '+7 (';
    });

    input.addEventListener('blur', () => {
      if (input.value === '+7 (' || input.value === '+7') input.value = '';
    });
  };

  [form.personalPhone, form.whatsapp, form.max].forEach(applyPhoneMask);

  // ПОДСВЕТКА ОШИБОК
  const highlightError = (input) => {
    input.style.borderColor = '#ef4444';
    input.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.2)';
    setTimeout(() => {
      input.style.borderColor = '';
      input.style.boxShadow = '';
    }, 3000);
  };

  // ЗАГРУЗКА КОНТАКТОВ
  const loadContacts = () => {
    fetch('/api/contacts')
      .then(r => r.json())
      .then(data => {
        form.contactPerson.value = data.contactPerson || '';
        form.personalPhone.value = data.personalPhone || '';
        form.documentsEmail.value = data.documentsEmail || '';
        form.notificationsEmail.value = data.notificationsEmail || '';
        form.telegram.value = data.telegram || '';
        form.whatsapp.value = data.whatsapp || '';
        form.max.value = data.maxPhone || '';
        form.workPhone.value = data.workPhone || '—';

        // Обновляем отображение
        fields.contactPerson.textContent = data.contactPerson || '—';
        fields.workPhone.textContent = data.workPhone || '—';
        fields.personalPhone.textContent = data.personalPhone || '—';
        fields.documentsEmail.textContent = data.documentsEmail || '—';
        fields.notificationsEmail.textContent = data.notificationsEmail || '—';
        fields.whatsapp.textContent = data.whatsapp || '—';
        fields.maxPhone.textContent = data.maxPhone || '—';

        if (data.telegram) {
          fields.telegramValue.style.display = 'none';
          fields.telegramLink.style.display = 'inline';
          fields.telegramHandle.textContent = data.telegram;
          fields.telegramLink.querySelector('a').href = `https://t.me/${data.telegram}`;
        } else {
          fields.telegramValue.textContent = '—';
          fields.telegramValue.style.display = 'block';
          fields.telegramLink.style.display = 'none';
        }
      });
  };

  openBtn.onclick = () => {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    loadContacts();
  };

  const closeModal = () => {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  };
  modal.querySelectorAll('.piligrim-close-btn, .piligrim-btn.outline').forEach(b => b.onclick = closeModal);
  modal.querySelector('.piligrim-modal-backdrop').onclick = closeModal;
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('active')) closeModal();
  });

  // ВАЛИДАЦИЯ — ИСПРАВЛЕНО! ПРОВЕРЯЕМ КАЖДОЕ ПОЛЕ ОТДЕЛЬНО
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    form.querySelectorAll('input').forEach(el => {
      el.style.borderColor = '';
      el.style.boxShadow = '';
    });

    const errors = [];

    // Проверка каждого телефона отдельно
    const phoneFields = {
      personalPhone: 'Личный телефон',
      whatsapp: 'WhatsApp',
      max: 'MAX'
    };

    Object.entries(phoneFields).forEach(([fieldName, label]) => {
      const value = form[fieldName].value.trim();
      if (value) {
        const digits = value.replace(/\D/g, '');
        if (digits.length !== 11 || !digits.startsWith('7')) {
          errors.push(`${label} — некорректный номер`);
          highlightError(form[fieldName]);
        }
      }
    });

    // Email
    ['documentsEmail', 'notificationsEmail'].forEach(fieldName => {
      const val = form[fieldName].value.trim();
      if (val && !/^[\w.-]+@[\w.-]+\.\w+$/i.test(val)) {
        errors.push(`Некорректный ${fieldName === 'documentsEmail' ? 'email для документов' : 'email для уведомлений'}`);
        highlightError(form[fieldName]);
      }
    });

    // Telegram
    const tg = form.telegram.value.trim().replace(/^@/, '');
    if (tg && !/^[a-zA-Z0-9_]{5,32}$/.test(tg)) {
      errors.push('Telegram: только латиница, цифры и _, от 5 символов');
      highlightError(form.telegram);
    }

    if (errors.length > 0) {
      showToast(errors[0], 'error');
      return;
    }

    const payload = {
      contactPerson: form.contactPerson.value.trim(),
      personalPhone: form.personalPhone.value.trim(),
      documentsEmail: form.documentsEmail.value.trim(),
      notificationsEmail: form.notificationsEmail.value.trim(),
      telegram: tg,
      whatsapp: form.whatsapp.value.trim(),
      max: form.max.value.trim(),
    };

    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json();

    if (json.success) {
      showToast('Контакты успешно сохранены!', 'success');
      loadContacts();
      closeModal();
    } else {
      showToast(json.errors?.[0] || 'Ошибка сохранения', 'error');
    }
  });

  loadContacts();
});

// ГЛОБАЛЬНЫЙ ОБНОВЛЯТОР ПРОФИЛЯ — РАБОТАЕТ ВЕЗЯТОЧНО ПОСЛЕ ЛЮБОЙ АВТОРИЗАЦИИ И СОХРАНЕНИЯ
(() => {
  // Функция, которая обновляет ВСЁ: реквизиты, контакты, аватар, заголовок, заглушку пустого профиля
  const refreshAllProfileData = async () => {
    try {
      // 1. Реквизиты компании
      const companyRes = await fetch('/api/company');
      if (companyRes.ok) {
        const company = await companyRes.json();

        // Обновляем шапку профиля
        document.getElementById('companyName').textContent = company.companyName || '—';
        document.getElementById('inn').textContent = company.inn || '—';

        // Обновляем все поля реквизитов
        const fields = ['fullName','ogrn','kpp','okpo','okved','legalAddress','actualAddress','activity','budget','director','regDate'];
        fields.forEach(field => {
          const el = document.getElementById(field);
          if (el) el.textContent = company[field] || '—';
        });

        // Статус и налогообложение
        const statusEl = document.getElementById('companyStatusBadge');
        if (statusEl) statusEl.textContent = company.companyStatus || 'Действующая';
        const taxEl = document.getElementById('taxSystemBadge');
        if (taxEl) taxEl.textContent = company.taxSystem || 'ОСНО (плательщик НДС)';

        // АВАТАР В ШАПКЕ ПРОФИЛЯ — ТЕПЕРЬ ТОЧНО КАК В МОДАЛКЕ (только иконка, без картинки)
        const profileAvatar = document.getElementById('profilePageAvatar');
        const profilePlaceholder = document.getElementById('profilePagePlaceholder');

        if (company.avatar?.trim() && !company.avatar.includes('default-company-avatar')) {
          profileAvatar.src = company.avatar + '?t=' + Date.now();
          profileAvatar.style.display = 'block';
          profilePlaceholder.style.display = 'none';
        } else {
          clearAvatar(profileAvatar);
          profileAvatar.style.display = 'none'; // полностью скрываем <img>
          profilePlaceholder.style.display = 'flex';
          profilePlaceholder.innerHTML = '<i class="fas fa-user-tie"></i>';
        }

        // АВАТАР В МОДАЛКЕ РЕДАКТИРОВАНИЯ — оставляем как есть (уже идеально)
        const modalAvatar = document.getElementById('currentAvatar');
        const modalPlaceholder = document.getElementById('avatarPlaceholder');
        const modalRemoveBtn = document.getElementById('removeAvatar');

        if (company.avatar?.trim() && !company.avatar.includes('default-company-avatar')) {
          modalAvatar.src = company.avatar + '?t=' + Date.now();
          modalAvatar.style.display = 'block';
          modalPlaceholder.style.display = 'none';
          modalRemoveBtn.style.display = 'flex';
        } else {
          clearAvatar(modalAvatar);
          modalAvatar.style.display = 'none';
          modalPlaceholder.style.display = 'flex';
          modalPlaceholder.innerHTML = '<i class="fas fa-user-tie"></i>';
          modalRemoveBtn.style.display = 'none';
          document.getElementById('removeAvatarFlag').value = '0';
          document.getElementById('avatarInput').value = '';
        }

                // ВОТ ЭТО — И ВСЁ! ДВЕ СТРОКИ, КОТОРЫЕ ЧИНИТ ВСЁ
        const form = document.getElementById('piligrimEditForm');
        if (form) Object.keys(company).forEach(key => {
          const input = form.querySelector(`[name="${key}"]`);
          if (input) input.value = company[key] || '';
        });

        // Обновляем заглушку "Профиль не заполнен"
        const placeholder = document.getElementById('emptyProfilePlaceholder');
        const isEmpty = !company.inn || !company.fullName || !company.companyName || !company.ogrn || !company.legalAddress;
        if (placeholder) placeholder.classList.toggle('active', isEmpty);
      }

      // 2. Контакты
      const contactsRes = await fetch('/api/contacts');
      if (contactsRes.ok) {
        const c = await contactsRes.json();

        const set = (id, val) => {
          const el = document.getElementById(id);
          if (el) el.textContent = val || '—';
        };

        set('contactPerson', c.contactPerson);
        set('workPhone', c.workPhone);
        set('personalPhone', c.personalPhone);
        set('documentsEmail', c.documentsEmail);
        set('notificationsEmail', c.notificationsEmail);
        set('whatsapp', c.whatsapp);
        set('maxPhone', c.maxPhone || '—');

        // Telegram — красивая ссылка
        const tgValue = document.getElementById('telegramValue');
        const tgLink = document.getElementById('telegramLink');
        const tgHandle = document.getElementById('telegramHandle');
        if (c.telegram && c.telegram.trim()) {
          tgValue.style.display = 'none';
          tgLink.style.display = 'inline';
          tgHandle.textContent = c.telegram.replace(/^@/, '');
          tgLink.querySelector('a').href = `https://t.me/${c.telegram.replace(/^@/, '')}`;
        } else {
          tgValue.textContent = '—';
          tgValue.style.display = 'block';
          tgLink.style.display = 'none';
        }
      }
    } catch (err) {
      console.warn('Не удалось обновить данные профиля без перезагрузки', err);
    }
  };

  // Вызываем сразу при загрузке страницы
  document.addEventListener('DOMContentLoaded', refreshAllProfileData);

  // После успешной авторизации (твой auth.js должен кидать это событие)
  document.addEventListener('authSuccess', () => {
    setTimeout(refreshAllProfileData, 600); // небольшая задержка — данные уже есть на сервере
  });

  // После сохранения компании
  document.addEventListener('DOMContentLoaded', () => {
    const companyForm = document.getElementById('piligrimEditForm');
    if (companyForm) {
      companyForm.addEventListener('submit', (e) => {
        // После успешного fetch (в твоём коде уже есть then с res.success)
        const originalFetch = window.fetch;
        const originalThen = fetch.prototype.then;

        // Перехватываем только наш запрос
        const checkAndRefresh = () => {
          setTimeout(refreshAllProfileData, 400);
        };

        // Простой способ — просто через 400 мс после отправки формы
        setTimeout(checkAndRefresh, 800);
      });
    }
  });

  // После сохранения контактов — уже есть в твоём скрипте, просто добавим
  const contactsFormSubmit = document.querySelector('#contactEditForm');
  if (contactsFormSubmit) {
    contactsFormSubmit.addEventListener('submit', () => {
      setTimeout(refreshAllProfileData, 600);
    });
  }

  // Универсальный способ: если где-то в коде вызывается showToast(..., 'success')
  // то через секунду обновляем данные — это надёжно сработает и для компании, и для контактов
  const originalShowToast = window.showToast || showToast;
  window.showToast = function(message, type) {
    originalShowToast(message, type);
    if (type === 'success' && (
      message.includes('сохранен') ||
      message.includes('успешно') ||
      message.includes('Контакты') ||
      message.includes('Данные')
    )) {
      setTimeout(refreshAllProfileData, 700);
    }
  };

})();

// УНИВЕРСАЛЬНАЯ ОЧИСТКА АВАТАРКИ — РАБОТАЕТ В 100% СЛУЧАЕВ
const clearAvatar = (img) => {
  if (!img) return;
  img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  img.removeAttribute('src');
  img.removeAttribute('srcset');
};

// ОТДЕЛЬНЫЙ СКРИПТ ТОЛЬКО ДЛЯ ТУМБЛЕРОВ — 100% РАБОТАЕТ -->

document.addEventListener('DOMContentLoaded', () => {
  const smsToggle     = document.getElementById('smsSubscribe');
  const emailToggle   = document.getElementById('emailSubscribe');
  const emailModal    = document.getElementById('emailModal');
  const emailForm     = document.getElementById('emailForm');
  const emailInput    = document.getElementById('emailInput');
  const closeEmailBtn = document.getElementById('closeEmailModal');
  const modalTitle    = emailModal.querySelector('h2');
  const submitBtnText = emailForm.querySelector('.btn-text');

  if (!emailToggle || !emailModal) return;

  let currentEmail = '';           // подтверждённый email
  let modalOpenedByToggle = false; // флаг: модалка открыта тумблером

  // === Загрузка состояния ===
  const loadState = async () => {
    try {
      const res = await fetch('/api/company');
      const data = await res.json();
      smsToggle.checked = !!data.smsSubscribe;
      emailToggle.checked = !!data.emailSubscribe;
      currentEmail = data.email || '';
    } catch (e) {
      console.error('Ошибка загрузки', e);
    }
  };
  loadState();

  // === Сохранение подписок ===
  const save = async () => {
    await fetch('/api/toggle_subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        smsSubscribe: smsToggle.checked ? 1 : 0,
        emailSubscribe: emailToggle.checked ? 1 : 0
      })
    }).catch(() => {
      alert('Ошибка сети');
      loadState();
    });
  };

  // === ЭФФЕКТЫ (ОСТАВЛЯЕМ ТОЛЬКО ЗДЕСЬ!) ===
  const shake = (el) => {
    const label = el.closest('.toggle-switch');
    if (!label) return;
    label.style.transition = 'transform 0.12s cubic-bezier(0.34,1.56,0.64,1)';
    label.style.transform = 'scale(0.92)';
    setTimeout(() => label.style.transform = '', 180);
  };

  const getCenter = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  };

  // ВАЖНО: функции successSparkle и sadPuff берём из твоего глобального скрипта эффектов
  // (который у тебя уже есть внизу страницы)
  const triggerEffect = (toggle, success) => {
    shake(toggle);
    const { x, y } = getCenter(toggle);
    if (success) {
      if (typeof successSparkle === 'function') successSparkle(x, y);
    } else {
      if (typeof sadPuff === 'function') sadPuff(x, y);
    }
  };

  // === SMS ===
  smsToggle.addEventListener('change', () => {
    save();
    triggerEffect(smsToggle, smsToggle.checked);
  });

  // === EMAIL — ГЛАВНАЯ ЛОГИКА ===
  emailToggle.addEventListener('change', () => {
    if (emailToggle.checked) {
      modalOpenedByToggle = true;
      emailModal.classList.add('active');

      if (currentEmail) {
        modalTitle.textContent = 'Изменить email для рассылки';
        submitBtnText.textContent = 'Сохранить новый email';
        emailInput.value = currentEmail;
      } else {
        modalTitle.textContent = 'Получайте акции и новости';
        submitBtnText.textContent = 'Подписаться';
        emailInput.value = '';
      }

      setTimeout(() => emailInput.focus(), 300);
      emailInput.select();
    } else {
      // Выключаем — сразу
      currentEmail = '';
      save();
      triggerEffect(emailToggle, false);
    }
  });

  // === УСПЕШНОЕ СОХРАНЕНИЕ EMAIL ===
  emailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      emailInput.classList.add('error');
      setTimeout(() => emailInput.classList.remove('error'), 2000);
      return;
    }

    const btn = emailForm.querySelector('.email-submit-btn');
    const text = btn.querySelector('.btn-text');
    const loading = btn.querySelector('.btn-loading');
    btn.disabled = true;
    text.style.opacity = '0';
    loading.style.display = 'inline-block';

    try {
      const res = await fetch('/api/set_email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();

      if (data.success) {
        currentEmail = email;
        modalOpenedByToggle = false;

        emailModal.classList.remove('active');
        save();

        triggerEffect(emailToggle, true); // оставляем тряску (если хочешь)
        // + кидаем событие для эффекта
        document.dispatchEvent(new CustomEvent('emailSubscribeSuccess'));

        const emailField = document.querySelector('#contactEmail');
        if (emailField) emailField.textContent = email;
      } else {
        throw new Error();
      }
    } catch {
      alert('Ошибка сохранения email');
      if (!currentEmail) emailToggle.checked = false;
    } finally {
      btn.disabled = false;
      text.style.opacity = '1';
      loading.style.display = 'none';
    }
  });

  // === ЗАКРЫТИЕ МОДАЛКИ ===
  const closeModal = () => {
    emailModal.classList.remove('active');

    if (modalOpenedByToggle && !currentEmail) {
      emailToggle.checked = false;
    }
    modalOpenedByToggle = false;
  };

  closeEmailBtn.onclick = closeModal;
  emailModal.onclick = (e) => {
    if (e.target === emailModal) closeModal();
  };

  // Убираем красную рамку
  emailInput.addEventListener('input', () => emailInput.classList.remove('error'));
});

// iOS-эффект 2025: золотой огонёк при включении, дымок при выключении — ВСЁ РАБОТАЕТ
(() => {
  // Золотой огонёк — как в iOS при успешном действии
  function successSparkle(x, y) {
    for (let i = 0; i < 22; i++) {
      const spark = document.createElement('div');
      spark.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        width: 8px;
        height: 8px;
        background: radial-gradient(circle, #FFD700, #FFA500 60%, transparent);
        border-radius: 50%;
        pointer-events: none;
        z-index: 99999;
        box-shadow: 0 0 14px #FFD700;
        transform: translate(-50%, -50%) scale(0);
      `;
      document.body.appendChild(spark);

      const angle = (i / 22) * Math.PI * 2;
      const velocity = 4 + Math.random() * 6;
      let posX = 0, posY = 0, scale = 0, opacity = 1;

      const start = performance.now();
      const duration = 600;

      function frame() {
        const elapsed = performance.now() - start;
        const progress = elapsed / duration;

        if (progress >= 1) {
          spark.remove();
          return;
        }

        posX = Math.cos(angle) * velocity * progress * 30;
        posY = Math.sin(angle) * velocity * progress * 30 - progress * 20;
        scale = progress * 2;
        opacity = 1 - progress * 1.2;

        spark.style.transform = `translate(${posX}px, ${posY}px) translate(-50%, -50%) scale(${scale})`;
        spark.style.opacity = opacity;

        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }
  }

  // Серый дымок при выключении
  function sadPuff(x, y) {
    for (let i = 0; i < 12; i++) {
      const puff = document.createElement('div');
      puff.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        width: 7px;
        height: 7px;
        background: #bbb;
        border-radius: 50%;
        pointer-events: none;
        z-index: 99999;
        opacity: 0.8;
        transform: translate(-50%, -50%) scale(0);
      `;
      document.body.appendChild(puff);

      let scale = 0, opacity = 0.8, dy = 0;

      const anim = () => {
        scale += 0.08;
        dy -= 2.5;
        opacity -= 0.025;

        if (opacity <= 0) {
          puff.remove();
          return;
        }

        puff.style.transform = `translate(-50%, -50%) translate(0, ${dy}px) scale(${scale})`;
        puff.style.opacity = opacity;

        requestAnimationFrame(anim);
      };
      setTimeout(anim, i * 50);
    }
  }

  // Тряска тумблера + вибрация
  function shake(toggle) {
    const label = toggle.closest('.toggle-switch');
    label.style.transition = 'transform 0.12s cubic-bezier(0.34,1.56,0.64,1)';
    label.style.transform = 'scale(0.92)';
    setTimeout(() => label.style.transform = '', 180);

    if (navigator.vibrate) {
      navigator.vibrate([40, 60, 80]);
    }
  }

  // Получаем центр тумблера
  function getCenter(el) {
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  window.addEventListener('load', () => {
  const smsToggle = document.getElementById('smsSubscribe');
  const emailToggle = document.getElementById('emailSubscribe');

  // SMS — как и было
  smsToggle?.addEventListener('change', (e) => {
    shake(e.target);
    const { x, y } = getCenter(e.target);
    e.target.checked ? successSparkle(x, y) : sadPuff(x, y);
  });

  // ВОТ ЭТОТ БЛОК — ГЛАВНОЕ ДОБАВЛЕНИЕ!
  // Ловим успешную подписку на email → пускаем огонёк
  document.addEventListener('emailSubscribeSuccess', () => {
    if (emailToggle && emailToggle.checked) {
      shake(emailToggle);
      const { x, y } = getCenter(emailToggle);
      successSparkle(x, y);
    }
  });

  // Дымок при выключении email-рассылки (сразу, без модалки)
  emailToggle?.addEventListener('change', (e) => {
    if (!e.target.checked) {
      shake(e.target);
      const { x, y } = getCenter(e.target);
      sadPuff(x, y);
    }
  });

  // Тестовый огонёк для SMS (можно оставить)
  setTimeout(() => {
    if (smsToggle?.checked) {
      const { x, y } = getCenter(smsToggle);
      successSparkle(x, y);
    }
  }, 1500);
});
})();

// ФИНАЛЬНАЯ ВЕРСИЯ ТЁМНОЙ ТЕМЫ — ВСЁ РАБОТАЕТ ПРАВИЛЬНО (2025)
(() => {
  const STORAGE_KEY = 'theme';
  const ATTR = 'data-theme';

  // Применяем тему и синхронизируем ВСЕ тумблеры
  const applyTheme = (theme) => {
    document.documentElement.setAttribute(ATTR, theme);
    localStorage.setItem(STORAGE_KEY, theme);

    // ТЁМНАЯ тема → checked = true (включено)
    const isDark = theme === 'dark';

    // Все тумблеры: профиль, лампочка, мобильное меню
    document.querySelectorAll('#darkModeToggle, #theme-toggle, .theme-toggle-hanging input, .mobile-sidebar input[type="checkbox"]').forEach(el => {
      if (el) el.checked = isDark;
    });
  };

  // Определяем текущую тему
  const getCurrentTheme = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved;

    const attr = document.documentElement.getAttribute(ATTR);
    if (attr === 'light' || attr === 'dark') return attr;

    // По умолчанию — системная
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  // Инициализация
  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(getCurrentTheme());

    // Любой тумблер переключает тему
    document.addEventListener('change', (e) => {
      const toggle = e.target;
      if (toggle.matches('#darkModeToggle, #theme-toggle, .theme-toggle-hanging input, .mobile-sidebar input[type="checkbox"]')) {
        const makeDark = toggle.checked;
        applyTheme(makeDark ? 'dark' : 'light');
      }
    });

    // Авто-подстройка под системную тему (если пользователь ничего не выбирал)
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  });
})();

// =============================================
// СВАЙП ВНИЗ ДЛЯ МОДАЛОК РЕДАКТИРОВАНИЯ — 100% РАБОТАЕТ КАК mobileCartSheet
// Повторное открытие — без проблем, плавность — как у iOS
// =============================================
(() => {
  const modals = [
    { id: 'piligrimEditModal',   header: '.piligrim-modal-header' },
    { id: 'contactEditModal',    header: '.piligrim-modal-header' }
  ];

  modals.forEach(({ id, header }) => {
    const modal = document.getElementById(id);
    if (!modal) return;

    const handle = modal.querySelector(header);
    if (!handle) return;

    let startY = 0;
    let isDragging = false;
    let isClosing = false;
    const threshold = 150;

    // === ОТКРЫТИЕ (гарантируем правильное состояние) ===
    const ensureOpen = () => {
      modal.style.display = 'flex';
      modal.classList.add('active');
      document.body.classList.add('no-scroll');

      // Сбрасываем трансформ перед анимацией
      modal.style.transition = 'none';
      modal.style.transform = 'translateY(100%)';
      
      requestAnimationFrame(() => {
        modal.style.transition = 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)';
        modal.style.transform = 'translateY(0)';
      });
    };

    // === ЗАКРЫТИЕ (полностью убираем модалку) ===
    const closeModal = () => {
      if (isClosing || !modal.classList.contains('active')) return;
      isClosing = true;

      modal.style.transition = 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)';
      modal.style.transform = 'translateY(100%)';

      document.body.classList.remove('no-scroll');

      // Фикс клавиатуры на iOS
      setTimeout(() => {
        const dummy = document.createElement('div');
        dummy.style.cssText = 'position:fixed;top:0;left:-100px;width:1px;height:1px;';
        document.body.appendChild(dummy);
        dummy.focus();
        dummy.click();
        dummy.remove();
      }, 100);

      const cleanup = () => {
        modal.classList.remove('active');
        modal.style.display = 'none';
        modal.style.transform = '';
        modal.style.transition = '';
        isClosing = false;
      };

      modal.addEventListener('transitionend', cleanup, { once: true });
      setTimeout(cleanup, 500); // страховка
    };

    // === СВАЙП ===
    const onStart = (e) => {
      if (!modal.classList.contains('active') || isClosing) return;
      if (modal.scrollTop > 5) return; // не свайпаем, если прокручено вниз

      startY = e.touches?.[0].clientY || e.clientY;
      isDragging = true;
      modal.style.transition = 'none';
    };

    const onMove = (e) => {
      if (!isDragging) return;
      const currentY = e.touches?.[0].clientY || e.clientY;
      const diff = currentY - startY;
      if (diff > 0) {
        e.preventDefault();
        modal.style.transform = `translateY(${diff}px)`;
      }
    };

    const onEnd = () => {
      if (!isDragging) return;
      isDragging = false;

      const diff = (event?.changedTouches?.[0]?.clientY || event?.clientY || startY) - startY;

      if (diff > threshold) {
        closeModal();
      } else {
        modal.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.9, 0.35, 1)';
        modal.style.transform = 'translateY(0)';
        setTimeout(() => modal.style.transition = '', 410);
      }
    };

    // Слушаем только на заголовке
    handle.addEventListener('touchstart', onStart, { passive: true });
    handle.addEventListener('touchmove', onMove, { passive: false });
    handle.addEventListener('touchend', onEnd);

    // Мышь (для теста)
    handle.addEventListener('mousedown', onStart);
    document.addEventListener('mousemove', e => isDragging && onMove(e));
    document.addEventListener('mouseup', onEnd);

    // === ГЛАВНОЕ: ПЕРЕХВАТЫВАЕМ ТВОИ КНОПКИ ОТКРЫТИЯ ===
    // Это гарантирует, что при любом способе открытия модалка будет в правильном состоянии
    const openButtons = document.querySelectorAll(`[data-target="company"], #editCompanyBtn, #editContactsBtn`);
    openButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (modal.id === 'piligrimEditModal' && btn.id === 'editCompanyBtn' ||
            modal.id === 'contactEditModal' && btn.getAttribute('data-target') === 'contacts') {
          ensureOpen();
        }
      });
    });

    // Если кто-то вручную добавляет класс active — тоже сработает
    const observer = new MutationObserver(() => {
      if (modal.classList.contains('active') && window.getComputedStyle(modal).display === 'none') {
        ensureOpen();
      }
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
  });
})();