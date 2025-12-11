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
  scrollToBottom();
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

(() => {
  const chat = document.getElementById('ai-chat');
  const inputWrapper = chat?.querySelector('.ai-chat-input');
  const input = chat?.querySelector('#ai-input');
  if (!chat || !inputWrapper || !input) return;

  // 1. Добавляем класс keyboard-open (нужен для CSS с env(keyboard-inset-height))
  const updateKeyboardClass = () => {
    const diff = (window.visualViewport?.height || window.innerHeight) - 
                 (window.visualViewport?.height || window.innerHeight);
    if (diff > 120) {
      chat.classList.add('keyboard-open');
    } else {
      chat.classList.remove('keyboard-open');
    }
  };

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateKeyboardClass);
  }

  // 2. Убираем баг с залипанием клавиатуры на iOS при быстром закрытии
  const originalClose = closeAIChat;
  closeAIChat = function() {
    originalClose();
    input.blur(); // ← критичная строчка
    setTimeout(() => input.blur(), 100); // двойная страховка
  };

  // 3. Фиксим баг с белой полосой снизу при открытой клавиатуре
  const fixBottomGap = () => {
    if (!chat.classList.contains('active')) return;
    const hasKeyboard = chat.classList.contains('keyboard-open');
    chat.style.paddingBottom = hasKeyboard ? `${window.visualViewport?.offsetTop || 0}px` : '';
  };
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', fixBottomGap);
  }

  // 4. Авто-фокус + прокрутка вниз при открытии (особенно после возврата из фона)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && chat.classList.contains('active')) {
      setTimeout(() => {
        input.focus();
        const messages = chat.querySelector('.ai-chat-messages');
        if (messages) messages.scrollTop = messages.scrollHeight;
      }, 300);
    }
  });
// Автоскролл к последнему сообщению — плавно и надёжно
function scrollToBottom() {
  const messages = document.querySelector('.ai-chat-messages');
  if (messages) {
    messages.scrollTop = messages.scrollHeight;
  }
}
  // 5. Запрещаем масштабирование страницы при двойном тапе (iOS Safari)
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });

  // 6. Убираем выделение текста при долгом тапе в чате
  chat.style.userSelect = 'none';
  chat.style.webkitUserSelect = 'none';
  chat.querySelector('.ai-chat-messages').style.userSelect = 'text'; // только сообщения можно выделять

  // 7. Добавляем вибрацию при отправке сообщения (только на мобильных)
  const sendBtn = inputWrapper.querySelector('button');
  if (sendBtn && 'vibrate' in navigator) {
    sendBtn.addEventListener('click', () => navigator.vibrate?.(30));
  }

  // 8. Плавная подсветка кнопки отправки при наборе текста
  input.addEventListener('input', () => {
    if (input.value.trim()) {
      sendBtn.style.transform = 'scale(1.08)';
      sendBtn.style.boxShadow = '0 0 20px rgba(212,175,55,0.6)';
    } else {
      sendBtn.style.transform = '';
      sendBtn.style.boxShadow = '';
    }
  });

  // 9. Поддержка отправки по Enter (но не по Shift+Enter)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });

  // 10. Авто-ресайз textarea (если вдруг захочешь многострочный ввод)
  input.style.height = 'auto';
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });

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
