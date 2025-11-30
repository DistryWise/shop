// ГЛАВНОЕ — УКАЖИ СВОЙ ДОМЕН ЗДЕСЬ:
const AI_API = '/api/ai';   // ←←←←← ЭТО ОБЯЗАТЕЛЬНО!

async function callAI(prompt) {
  try {
    const res = await fetch(AI_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt.trim() })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let answer = "";

    // Печатаем по буквам в реальном времени
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      answer += chunk;

      const aiMsg = document.querySelector('.ai-chat-messages .msg.ai:last-child');
      if (aiMsg) {
        aiMsg.textContent = "Анализирую правовую базу...\n\n" + answer;
        aiMsg.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }

    // Финальный текст без "Анализирую..."
    const finalAnswer = answer.trim();
    const aiMsg = document.querySelector('.ai-chat-messages .msg.ai:last-child');
    if (aiMsg) aiMsg.textContent = finalAnswer;

    return finalAnswer;

  } catch (err) {
    console.error("Ошибка связи с AI:", err);
    return "Сервис временно недоступен. Попробуйте позже.";
  }
}
// === ОБЛАЧКИ ===
const greetings = [
  "Нужна помощь с договором?",
  "Возврат? 14 дней — за наш счёт!",
  "Оплата криптой — легально",
  "VIP-клуб: скидки до 40%",
  "Задайте юридический вопрос"
];

let bubbleTimeout;
function showGreeting() {
  const bubble = document.querySelector('.ai-bubble');
  if (!bubble) return;
  const text = greetings[Math.floor(Math.random() * greetings.length)];
  bubble.textContent = text;
  bubble.style.display = 'block';
  setTimeout(() => { bubble.style.display = 'none'; }, 3000);
  bubbleTimeout = setTimeout(showGreeting, Math.random() * 5000 + 6000);
}

// === УТИЛИТА ДЛЯ РАСЧЁТА transform-origin ===
function setTransformOriginFromIcon() {
  const chat = document.getElementById('ai-chat');
  const icon = document.getElementById('ai-assistant');
  if (!chat || !icon) return;
  const iconRect = icon.getBoundingClientRect();
  const chatRect = chat.getBoundingClientRect();
  const originX = iconRect.right - chatRect.left;
  const originY = iconRect.bottom - chatRect.top;
  chat.style.transformOrigin = `${originX}px ${originY}px`;
}

// === ОТКРЫТИЕ ===
function openAIChat() {
  const chat = document.getElementById('ai-chat');
  if (!chat) return;

  if (window.innerWidth <= 1023) {
    // МОБИЛКА — только класс .active
    chat.classList.add('active');
    document.body.classList.add('no-scroll');
  } else {
    // ДЕСКТОП — старая scale-анимация
    chat.style.display = 'flex';
    setTransformOriginFromIcon();
    void chat.offsetWidth;
    requestAnimationFrame(() => chat.classList.add('show'));
  }

  // Пузырь
  const bubble = document.querySelector('.ai-bubble');
  if (bubble) bubble.style.display = 'none';
}
function closeAIChat() {
  const chat = document.getElementById('ai-chat');
  if (!chat) return;

  // Снимаем класс — начинается анимация ухода вниз
  chat.classList.remove('active');
  document.body.classList.remove('no-scroll');

  // Через 600 мс (чуть больше длительности анимации 0.54с) — убираем остатки transform
  setTimeout(() => {
    chat.style.transform = '';
  }, 600);

  // Показываем приветственный баббл
  setTimeout(() => {
    bubbleTimeout = setTimeout(showGreeting, 4000);
  }, 600);
}

// === ПОЛНОЭКРАННЫЙ РЕЖИМ ===
function toggleAIChatSize() {
  const chat = document.getElementById('ai-chat');
  const willBeFullscreen = !chat.classList.contains('fullscreen');
  if (willBeFullscreen) {
    chat.classList.add('fullscreen-transition');
    requestAnimationFrame(() => chat.classList.add('fullscreen'));
  } else {
    chat.classList.remove('fullscreen');
    setTimeout(() => chat.classList.remove('fullscreen-transition'), 400);
  }
  updateMinimizeButton();
}

function updateMinimizeButton() {
  const btn = document.querySelector('.ai-btn-minimize i');
  if (!btn) return;
  const isFullscreen = document.getElementById('ai-chat').classList.contains('fullscreen');
  btn.className = isFullscreen ? 'fas fa-compress-arrows-alt' : 'fas fa-expand-arrows-alt';
}

// === ОТПРАВКА СООБЩЕНИЯ ===
async function sendAIMessage(text) {
  if (!text.trim()) return;
  const messages = document.querySelector('.ai-chat-messages');

  const userMsg = document.createElement('div');
  userMsg.className = 'msg user';
  userMsg.textContent = text;
  messages.appendChild(userMsg);

  const aiMsg = document.createElement('div');
  aiMsg.className = 'msg ai';
  aiMsg.textContent = "Анализирую правовую базу...";
  messages.appendChild(aiMsg);

  messages.scrollTop = messages.scrollHeight;

  const answer = await callAI(text);
  aiMsg.textContent = answer;
  messages.scrollTop = messages.scrollHeight;
}

// === ИНИЦИАЛИЗАЦИЯ ===
document.getElementById('ai-assistant')?.addEventListener('click', openAIChat);
setTimeout(showGreeting, 3000);

// === СВАЙП ВНИЗ — ФИНАЛЬНЫЙ РАБОЧИЙ 2025 (Telegram-style) ===
(() => {
  const sheet = document.getElementById('ai-chat');
  if (!sheet || window.innerWidth > 1023) return;

  let startY = 0;
  let isDragging = false;
  const THRESHOLD = 160;        // чуть больше — чтобы случайно не закрывалось
  const VELOCITY_THRESHOLD = 0.5; // скорость для инерции

  let lastY = 0;
  let velocity = 0;
  let animationFrame;

  const start = (e) => {
    if (!sheet.classList.contains('active')) return;
    if (sheet.querySelector('.ai-chat-messages')?.scrollTop > 10) return;

    startY = lastY = e.touches?.[0].clientY || e.clientY;
    isDragging = true;
    velocity = 0;

    sheet.classList.add('dragging');
    sheet.style.transition = 'none';

    cancelAnimationFrame(animationFrame);
  };

  const move = (e) => {
    if (!isDragging) return;

    const currentY = e.touches?.[0].clientY || e.clientY;
    const diff = currentY - lastY;
    velocity = diff;

    const translate = currentY - startY;
    if (translate > 0) {
      e.preventDefault();
      sheet.style.transform = `translateY(${translate}px)`;
    }

    lastY = currentY;
  };

  const end = () => {
    if (!isDragging) return;
    isDragging = false;

    const traveled = lastY - startY;
    const fastEnough = Math.abs(velocity) > VELOCITY_THRESHOLD * 100;

    sheet.classList.remove('dragging');
    sheet.style.transition = 'transform 0.42s cubic-bezier(0.22, 0.88, 0.36, 1)';

    // Закрываем, если прошёл порог ИЛИ быстро дёрнули
    if (traveled > THRESHOLD || (traveled > 80 && fastEnough)) {
      sheet.style.transform = `translateY(100dvh)`;
      setTimeout(closeAIChat, 100); // чтобы анимация доиграла
    } else {
      // Плавно возвращаем наверх (учитываем клавиатуру!)
      const keyboardOffset = window.visualViewport?.offsetTop || 0;
      sheet.style.transform = `translateY(${keyboardOffset}px)`;
    }
  };

  // Touch
  sheet.addEventListener('touchstart', start, { passive: true });
  sheet.addEventListener('touchmove', move, { passive: false });
  sheet.addEventListener('touchend', end);
  sheet.addEventListener('touchcancel', end);

  // Mouse (для теста на десктопе)
  sheet.addEventListener('mousedown', start);
  document.addEventListener('mousemove', e => isDragging && move(e));
  document.addEventListener('mouseup', end);
})();

// === ПОДЪЁМ ЧАТА НАД КЛАВИАТУРОЙ — КАК В ТЕЛЕГРАММЕ (2025, работает везде) ===
// === УНИВЕРСАЛЬНЫЙ ПОДЪЁМ ЧАТА НАД КЛАВИАТУРОЙ — РАБОТАЕТ НА ЛЮБОМ ТЕЛЕФОНЕ 2025 ГОДА ===
(() => {
  const chat = document.getElementById('ai-chat');
  const input = chat?.querySelector('#ai-input');
  if (!chat || !input || window.innerWidth > 1023) return;

  let isDragging = false;
  let initialViewportHeight = window.visualViewport?.height || window.innerHeight;

  const updatePosition = () => {
    if (isDragging) return;

    // Текущая высота видимой области
    const currentViewportHeight = window.visualViewport?.height || window.innerHeight;
    const diff = initialViewportHeight - currentViewportHeight;

    // Клавиатура считается открытой, если экран уменьшился минимум на 100px
    if (diff > 100) {
      // Самая главная хитрость 2025 года:
      // На iPhone используем именно diff (не offsetTop!)
      // На Android тоже diff даёт точную высоту клавиатуры
      chat.style.transform = `translateY(-${diff}px)`;
      chat.style.transition = 'transform 0.34s cubic-bezier(0.2, 0.85, 0.2, 1)';
    } else {
      // Клавиатура закрыта
      if (chat.classList.contains('active') && !chat.classList.contains('dragging')) {
        chat.style.transform = 'translateY(0)';
      }
    }
  };

  // Запоминаем высоту экрана при открытии чата (до появления клавиатуры)
  const saveInitialHeight = () => {
    initialViewportHeight = window.visualViewport?.height || window.innerHeight;
  };

  // События
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      updatePosition();
      // На некоторых телефонах resize срабатывает с задержкой — дублируем
      setTimeout(updatePosition, 100);
    });
  } else {
    window.addEventListener('resize', updatePosition);
  }

  // При фокусе — сразу сохраняем начальную высоту и поднимаем
  input.addEventListener('focus', () => {
    saveInitialHeight();
    setTimeout(updatePosition, 50);
    setTimeout(updatePosition, 250);
    setTimeout(updatePosition, 500);
  });

  // При закрытии клавиатуры — плавно опускаем
  input.addEventListener('blur', () => {
    setTimeout(updatePosition, 150);
  });

  // Отслеживаем свайп вниз (чтобы не конфликтовал с клавиатурой)
  chat.addEventListener('touchstart', () => isDragging = true, { passive: true });
  chat.addEventListener('touchend', () => {
    setTimeout(() => {
      isDragging = false;
      updatePosition();
    }, 250);
  });
  chat.addEventListener('touchcancel', () => {
    setTimeout(() => {
      isDragging = false;
      updatePosition();
    }, 250);
  });

  // Автофокус при открытии чата
  new MutationObserver((mutations) => {
    if (chat.classList.contains('active')) {
      saveInitialHeight();
      setTimeout(() => input.focus(), 450);
    }
  }).observe(chat, { attributes: true, attributeFilter: ['class'] });
})();

// === ДЕСКТОП: ЗАКРЫТИЕ КРЕСТИКОМ + КЛИКОМ ВНЕ + ESC (ФИНАЛЬНО, 100% РАБОТАЕТ) ===
(() => {
  const chat = document.getElementById('ai-chat');
  const icon = document.getElementById('ai-assistant');
  if (!chat || !icon) return;

  // Универсальная функция закрытия для десктопа
  const closeDesktop = () => {
    chat.classList.remove('show');
    chat.style.display = 'none';
    document.removeEventListener('click', outsideHandler);
  };

  // Клик вне чата
  const outsideHandler = (e) => {
    if (chat.classList.contains('show') && 
        !chat.contains(e.target) && 
        !icon.contains(e.target)) {
      closeDesktop();
    }
  };

  // Переопределяем openAIChat только для десктопа
  const originalOpen = openAIChat;
  openAIChat = function () {
    originalOpen.apply(this, arguments);

    if (window.innerWidth > 1023) {
      chat.style.display = 'flex';
      requestAnimationFrame(() => chat.classList.add('show'));

      // Добавляем обработчик клика вне через небольшую задержку
      setTimeout(() => {
        document.addEventListener('click', outsideHandler);
      }, 100);
    }
  };

  // Переопределяем closeAIChat — чистим слушатель
  const originalClose = closeAIChat;
  closeAIChat = function () {
    originalClose.apply(this, arguments);
    if (window.innerWidth > 1023) {
      document.removeEventListener('click', outsideHandler);
    }
  };

  // Крестик (на случай, если onclick перезаписался)
  chat.querySelector('.ai-btn-close')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (window.innerWidth > 1023) closeDesktop();
    else closeAIChat();
  });

  // Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && chat.classList.contains('show')) {
      closeDesktop();
    }
  });
})();