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

// =============================================================
// АВТО-ПОДЪЁМ СТРОКИ ЧАТА НАД КЛАВИАТУРОЙ + АВТОФОКУС (2025)
// =============================================================
// =============================================================
// ПОДЪЁМ ЧАТА НАД КЛАВИАТУРОЙ — РАБОТАЕТ ВЕЗДЕ (iOS 16–18, Android 12–15, 2025)
// =============================================================
(() => {
  const chat = document.getElementById('ai-chat');
  const input = chat?.querySelector('.ai-chat-input input');
  if (!chat || !input) return;

  let keyboardHeight = 0;

  const updatePadding = () => {
    if (keyboardHeight > 60) {
      chat.classList.add('keyboard-open');
      chat.style.paddingBottom = `${keyboardHeight + 20}px`; // +20px отступ от клавиатуры
    } else {
      chat.classList.remove('keyboard-open');
      chat.style.paddingBottom = '';
    }
  };

  // Самый надёжный способ — visualViewport (работает на 99% устройств 2024–2025)
  const handleViewportChange = () => {
    if (!window.visualViewport) return;
    const vh = window.visualViewport.height;
    const diff = window.innerHeight - vh;
    keyboardHeight = diff > 0 ? diff : 0;
    updatePadding();
  };

  // Резервный вариант для старых браузеров
  let lastHeight = window.innerHeight;
  const handleResize = () => {
    const current = window.innerHeight;
    if (Math.abs(current - lastHeight) > 100) {
      keyboardHeight = lastHeight > current ? lastHeight - current : 0;
      updatePadding();
    }
    lastHeight = current;
  };

  // При фокусе — сразу поднимаем (iOS клавиатура появляется с задержкой)
  input.addEventListener('focus', () => {
    chat.classList.add('keyboard-open');
    setTimeout(handleViewportChange, 100);
    setTimeout(handleViewportChange, 400);
  });

  input.addEventListener('blur', () => {
    setTimeout(() => {
      if (document.activeElement !== input) {
        keyboardHeight = 0;
        updatePadding();
      }
    }, 150);
  });

  // Слушаем всё, что может изменить высоту
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleViewportChange);
    window.visualViewport.addEventListener('scroll', handleViewportChange);
  }
  window.addEventListener('resize', handleResize);
  window.addEventListener('orientationchange', () => setTimeout(handleViewportChange, 300));

  // Автофокус при открытии чата
  new MutationObserver(() => {
    if (chat.classList.contains('show')) {
      setTimeout(() => input.focus(), 450);
    }
  }).observe(chat, { attributes: true, attributeFilter: ['class'] });

})();
// AI ЧАТ — СВАЙП ВНИЗ ДЛЯ ЗАКРЫТИЯ — ФИНАЛЬНЫЙ, АБСОЛЮТНО РАБОЧИЙ 2025
(() => {
  const sheet = document.getElementById('ai-chat');
  if (!sheet || window.innerWidth > 1023) return;

  let startY = 0;
  let currentY = 0;
  let isDragging = false;
  const THRESHOLD = 130; // идеально под палец

  const handleStart = (e) => {
    if (!sheet.classList.contains('active')) return;

    const messages = sheet.querySelector('.ai-chat-messages');
    if (messages && messages.scrollTop > 8) return;

    startY = e.touches?.[0].clientY || e.clientY;
    isDragging = true;
    sheet.classList.add('dragging');
  };

  const handleMove = (e) => {
    if (!isDragging) return;

    currentY = e.touches?.[0].clientY || e.clientY;
    const diff = currentY - startY;

    if (diff > 0) {
      e.preventDefault();
      sheet.style.transform = `translateY(${diff}px)`;
    }
  };

  const handleEnd = () => {
    if (!isDragging) return;
    isDragging = false;

    const diff = currentY - startY;

    sheet.classList.remove('dragging');

    if (diff > THRESHOLD) {
      closeAIChat();        // шторка уезжает вниз + класс .active снимается
    } else {
      sheet.style.transform = '';  // плавно возвращается наверх
    }
  };

  sheet.addEventListener('touchstart', handleStart, { passive: true });
  sheet.addEventListener('touchmove',  handleMove,  { passive: false });
  sheet.addEventListener('touchend',   handleEnd);

  // для теста на десктопе мышкой
  sheet.addEventListener('mousedown', handleStart);
  document.addEventListener('mousemove', e => isDragging && handleMove(e));
  document.addEventListener('mouseup', handleEnd);
})();