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
  chat.classList.remove('closing', 'fullscreen');
  chat.style.display = 'flex';
  setTransformOriginFromIcon();
  chat.classList.remove('show');
  void chat.offsetWidth; // reflow
  requestAnimationFrame(() => chat.classList.add('show'));

  clearTimeout(bubbleTimeout);
  const bubble = document.querySelector('.ai-bubble');
  if (bubble) bubble.style.display = 'none';
  updateMinimizeButton();
}

// === ЗАКРЫТИЕ ===
function closeAIChat() {
  const chat = document.getElementById('ai-chat');
  setTransformOriginFromIcon();
  chat.classList.remove('show');
  chat.classList.add('closing');
  setTimeout(() => {
    chat.style.display = 'none';
    chat.classList.remove('closing');
    chat.style.transformOrigin = 'bottom right';
    bubbleTimeout = setTimeout(showGreeting, 4000);
  }, 400);
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