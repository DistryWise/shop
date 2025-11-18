// === AI API ===
const AI_API = '/api/ai';

async function callAI(prompt) {
  try {
    const res = await fetch(AI_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const data = await res.json();
    return data.response || "Я — юрист Priligrim. Задайте вопрос по договору, возврату или VIP-клубу.";
  } catch {
    return "Сервис временно недоступен.";
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
  const iconRect = icon.getBoundingClientRect();
  const chatRect = chat.getBoundingClientRect();

  const originX = iconRect.right - chatRect.left;
  const originY = iconRect.bottom - chatRect.top;

  chat.style.transformOrigin = `${originX}px ${originY}px`;
}

// === ОТКРЫТИЕ ===
function openAIChat() {
  const chat = document.getElementById('ai-chat');

  // 1. Сбрасываем возможные старые классы
  chat.classList.remove('closing', 'fullscreen');
  chat.style.display = 'flex';

  // 2. Устанавливаем точку роста из иконки
  setTransformOriginFromIcon();

  // 3. Принудительно сбрасываем масштаб, чтобы анимация началась с 0
  chat.classList.remove('show');
  void chat.offsetWidth; // reflow

  // 4. Запускаем анимацию открытия
  requestAnimationFrame(() => {
    chat.classList.add('show');
  });

  clearTimeout(bubbleTimeout);
  document.querySelector('.ai-bubble').style.display = 'none';
  updateMinimizeButton();
}

// === ЗАКРЫТИЕ ===
function closeAIChat() {
  const chat = document.getElementById('ai-chat');

  setTransformOriginFromIcon();

  chat.classList.remove('show');
  chat.classList.add('closing');

  // Ждём окончания анимации закрытия
  setTimeout(() => {
    chat.style.display = 'none';
    chat.classList.remove('closing');
    chat.style.transformOrigin = 'bottom right';
    bubbleTimeout = setTimeout(showGreeting, 4000);
  }, 400); // чуть больше, чем длительность анимации
}

// === ПОЛНОЭКРАННЫЙ РЕЖИМ ===
function toggleAIChatSize() {
  const chat = document.getElementById('ai-chat');
  const willBeFullscreen = !chat.classList.contains('fullscreen');

  // Если переходим в полноэкранный — плавно растягиваем
  if (willBeFullscreen) {
    chat.classList.add('fullscreen-transition');
    requestAnimationFrame(() => {
      chat.classList.add('fullscreen');
    });
  } else {
    // Выходим из полноэкранного
    chat.classList.remove('fullscreen');
    // После окончания анимации убираем переходный класс
    setTimeout(() => {
      chat.classList.remove('fullscreen-transition');
    }, 400);
  }

  updateMinimizeButton();
}

function updateMinimizeButton() {
  const btn = document.querySelector('.ai-btn-minimize i');
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
}

// === ИНИЦИАЛИЗАЦИЯ ===
document.getElementById('ai-assistant').onclick = openAIChat;
setTimeout(showGreeting, 3000);