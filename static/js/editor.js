// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
const canvas = document.getElementById('canvas');
const bgUpload = document.getElementById('bg-upload');
const bgScale = document.getElementById('bg-scale');
const bgScaleVal = document.getElementById('bg-scale-val');
const slidesPanel = document.getElementById('slides-panel');
const previewModal = document.getElementById('preview-modal');
const previewContainer = document.getElementById('preview-container');

let selected = null;
let layers = [];
let slides = Array(5).fill().map(() => ({ background: '', bgSize: 'cover', elements: [] }));
let currentSlide = 0;
let letterMode = false;

const fonts = [
  'Inter', 'Cormorant Garamond', 'Playfair Display', 'Montserrat',
  'Shadows Into Light', 'Great Vibes', 'Dancing Script', 'Raleway',
  'Bebas Neue', 'Oswald', 'Anton', 'Cinzel Decorative', 'Sacramento'
];

const animations = [
  'none', 'fadeIn', 'slideUp', 'scaleIn', 'rotateIn', 'typewriter', 'glow'
];

// === ИНИЦИАЛИЗАЦИЯ ===
function initSlides() {
  slidesPanel.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const btn = document.createElement('button');
    btn.className = 'slide-btn';
    btn.textContent = `Слайд ${i + 1}`;
    btn.onclick = () => loadSlide(i);
    slidesPanel.appendChild(btn);
  }
}

// === ЗАГРУЗКА СЛАЙДА ===
function loadSlide(index) {
  saveCurrentSlide();
  currentSlide = index;
  document.querySelectorAll('.slide-btn').forEach((b, i) => b.classList.toggle('active', i === index));

  const slide = slides[index];
  canvas.style.backgroundImage = slide.background ? `url("${slide.background}")` : '';
  canvas.style.backgroundSize = slide.bgSize || 'cover';

  bgScale.value = slide.bgSize.includes('%') ? parseInt(slide.bgSize) : 100;
  bgScaleVal.textContent = bgScale.value + '%';

  canvas.innerHTML = '<div class="grid"></div>';
  layers = [];

  (slide.elements || []).forEach(data => {
    let el;
    if (data.type === 'text') {
      el = createTextElement(data.content);
    } else if (data.type === 'image') {
      el = createImageElement(data.content);
    } else if (data.type === 'svg') {
      el = createSVGElement(data.content);
    } else if (data.type === 'letter') {
      el = createLetterElement(data.content, data);
    }
    if (el) {
      applyElementData(el, data);
      canvas.appendChild(el);
      if (data.type !== 'letter') makeDraggable(el);
      addLayer(el, data.name || data.content.substring(0, 20));
    }
  });

  selected = null;
  updateProps();
  updateLayers();
}

function saveCurrentSlide() {
  const slide = slides[currentSlide];
  slide.background = canvas.style.backgroundImage.slice(5, -2);
  slide.bgSize = canvas.style.backgroundSize;
  slide.elements = Array.from(canvas.querySelectorAll('.canvas-item')).map(getElementData);
}

// === ФОН ===
bgUpload.onchange = e => {
  const file = e.target.files[0];
  const reader = new FileReader();
  reader.onload = ev => {
    canvas.style.backgroundImage = `url("${ev.target.result}")`;
    canvas.style.backgroundSize = `${bgScale.value}%`;
    saveCurrentSlide();
  };
  reader.readAsDataURL(file);
};

bgScale.oninput = () => {
  bgScaleVal.textContent = bgScale.value + '%';
  canvas.style.backgroundSize = `${bgScale.value}%`;
  saveCurrentSlide();
};

// === ЭЛЕМЕНТЫ ===
function getElementData(el) {
  const isText = el.dataset.type === 'text';
  const isLetter = el.dataset.type === 'letter';
  const rect = el.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();

  return {
    type: el.dataset.type,
    content: isText || isLetter ? el.textContent : (el.querySelector('img')?.src || el.innerHTML),
    name: el.dataset.name || el.textContent.substring(0, 20),
    x: parseInt(el.style.left) || 0,
    y: parseInt(el.style.top) || 0,
    width: el.offsetWidth,
    height: el.offsetHeight,
    fontSize: isText || isLetter ? parseInt(el.style.fontSize) || 48 : null,
    color: isText || isLetter ? el.style.color : null,
    fontWeight: isText || isLetter ? el.style.fontWeight || '400' : null,
    fontStyle: isText || isLetter ? el.style.fontStyle || 'normal' : null,
    textDecoration: isText || isLetter ? el.style.textDecoration || 'none' : null,
    textShadow: isText || isLetter ? el.style.textShadow : null,
    fontFamily: isText || isLetter ? el.style.fontFamily : null,
    background: el.style.background || null,
    webkitBackgroundClip: el.style.webkitBackgroundClip || null,
    webkitTextStroke: el.style.webkitTextStroke || null,
    animation: el.dataset.animation || 'none',
    rotation: el.style.transform || 'rotate(0deg)',
    opacity: el.style.opacity || 1,
    mixBlendMode: el.style.mixBlendMode || 'normal',
    href: el.classList.contains('clickable') ? (el.dataset.href || '') : null,
    filter: el.style.filter || 'none'
  };
}

function createTextElement(text) {
  const el = document.createElement('div');
  el.className = 'canvas-item text';
  el.textContent = text;
  el.dataset.type = 'text';
  el.style.fontFamily = "'Cormorant Garamond', serif";
  el.style.fontSize = '48px';
  el.style.color = '#ffffff';
  return el;
}

function createImageElement(src) {
  const img = document.createElement('img');
  img.src = src;
  const el = document.createElement('div');
  el.className = 'canvas-item';
  el.appendChild(img);
  el.dataset.type = 'image';
  return el;
}

function createSVGElement(svgCode) {
  const el = document.createElement('div');
  el.className = 'canvas-item';
  el.innerHTML = svgCode;
  el.dataset.type = 'svg';
  return el;
}

function createLetterElement(char, data) {
  const span = document.createElement('span');
  span.className = 'canvas-item letter';
  span.textContent = char;
  span.dataset.type = 'letter';
  span.dataset.parent = data.parentId;
  return span;
}

function applyElementData(el, data) {
  el.style.left = data.x + 'px';
  el.style.top = data.y + 'px';
  el.style.width = data.width + 'px';
  el.style.height = data.height + 'px';
  el.style.transform = data.rotation;
  el.style.opacity = data.opacity;
  el.style.filter = data.filter;
  el.dataset.animation = data.animation || 'none';
  el.dataset.name = data.name;

  if (data.type === 'text' || data.type === 'letter') {
    el.textContent = data.content;
    el.style.fontSize = (data.fontSize || 48) + 'px';
    el.style.color = data.color || '#fff';
    el.style.fontWeight = data.fontWeight || '400';
    el.style.fontStyle = data.fontStyle || 'normal';
    el.style.textDecoration = data.textDecoration || 'none';
    el.style.textShadow = data.textShadow || '0 2px 8px rgba(0,0,0,0.7)';
    el.style.fontFamily = data.fontFamily || "'Cormorant Garamond', serif";
    if (data.background) el.style.background = data.background;
    if (data.webkitBackgroundClip) el.style.webkitBackgroundClip = data.webkitBackgroundClip;
    if (data.webkitTextStroke) el.style.webkitTextStroke = data.webkitTextStroke;
    if (data.color === 'transparent') el.style.color = 'transparent';
    applyAnimation(el, data.animation);
  } else if (data.type === 'image') {
    const img = el.querySelector('img');
    if (img) img.src = data.content;
    el.style.mixBlendMode = data.mixBlendMode || 'normal';
  } else if (data.type === 'svg') {
    el.innerHTML = data.content;
  }

  if (data.href) {
    el.classList.add('clickable');
    el.dataset.href = data.href;
    el.style.cursor = 'pointer';
  } else {
    el.classList.remove('clickable');
    el.style.cursor = 'move';
  }
}

function applyAnimation(el, anim) {
  el.classList.remove(...animations.map(a => `anim-${a}`));
  if (anim && anim !== 'none') {
    el.classList.add(`anim-${anim}`);
  }
}

// === ДОБАВЛЕНИЕ ТЕКСТА ПО БУКВАМ ===
let currentTextElement = null;
document.querySelector('[data-tool="text"]').onclick = () => {
  const text = prompt('Введите текст:', 'абв');
  if (!text) return;

  letterMode = confirm('Редактировать по буквам?');
  if (letterMode) {
    const wrapper = document.createElement('div');
    wrapper.className = 'canvas-item text';
    wrapper.dataset.type = 'text';
    wrapper.style.left = '200px'; wrapper.style.top = '200px';
    wrapper.style.whiteSpace = 'nowrap';
    wrapper.dataset.id = 'text_' + Date.now();

    text.split('').forEach((char, i) => {
      const span = createLetterElement(char, { parentId: wrapper.dataset.id });
      span.style.display = 'inline-block';
      span.style.position = 'relative';
      span.style.left = (i * 40) + 'px';
      wrapper.appendChild(span);
      makeDraggable(span);
    });

    canvas.appendChild(wrapper);
    currentTextElement = wrapper;
    addLayer(wrapper, text);
    select(wrapper);
  } else {
    const el = createTextElement(text);
    el.style.left = '200px'; el.style.top = '200px';
    canvas.appendChild(el);
    makeDraggable(el);
    addLayer(el, text.substring(0,20));
    select(el);
  }
  saveCurrentSlide();
};

// === ДОБАВЛЕНИЕ ИЗОБРАЖЕНИЯ ===
document.querySelector('[data-tool="image"]').onclick = () => {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = e => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = ev => {
      const el = createImageElement(ev.target.result);
      el.style.width = '250px'; el.style.height = '250px';
      el.style.left = '200px'; el.style.top = '150px';
      canvas.appendChild(el);
      makeDraggable(el);
      addLayer(el, 'Изображение');
      select(el);
      saveCurrentSlide();
    };
    reader.readAsDataURL(file);
  };
  input.click();
};

// === ДОБАВЛЕНИЕ SVG ===
document.querySelector('[data-tool="svg"]').onclick = () => {
  const svg = prompt('Вставьте SVG код:', `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#d4af37"/></svg>`);
  if (!svg) return;
  const el = createSVGElement(svg);
  el.style.width = '200px'; el.style.height = '200px';
  el.style.left = '300px'; el.style.top = '200px';
  canvas.appendChild(el);
  makeDraggable(el);
  addLayer(el, 'SVG');
  select(el);
  saveCurrentSlide();
};

// === DRAG & RESIZE ===
function makeDraggable(el) {
  let dragging = false, resizing = false, handle = null;
  let startX, startY, startW, startH, startL, startT;

  el.onmousedown = e => {
    if (e.target.classList.contains('drag-handle')) {
      resizing = true; handle = e.target;
    } else if (e.target === el || el.contains(e.target)) {
      dragging = true;
    }
    startX = e.clientX; startY = e.clientY;
    startW = el.offsetWidth; startH = el.offsetHeight;
    startL = el.offsetLeft; startT = el.offsetTop;
    select(el);
    e.preventDefault();
  };

  document.onmousemove = e => {
    if (!dragging && !resizing) return;
    let dx = e.clientX - startX, dy = e.clientY - startY;
    const snap = 10;

    if (dragging) {
      let newL = Math.round((startL + dx) / snap) * snap;
      let newT = Math.round((startT + dy) / snap) * snap;
      el.style.left = newL + 'px';
      el.style.top = newT + 'px';
    }
    if (resizing) {
      let w = startW, h = startH, l = startL, t = startT;
      if (handle.classList.contains('br')) { w += dx; h += dy; }
      if (handle.classList.contains('bl')) { w -= dx; h += dy; l += dx; }
      if (handle.classList.contains('tr')) { w += dx; h -= dy; t += dy; }
      if (handle.classList.contains('tl')) { w -= dx; h -= dy; l += dx; t += dy; }
      if (w > 30 && h > 30) {
        w = Math.round(w / snap) * snap;
        h = Math.round(h / snap) * snap;
        el.style.width = w + 'px'; el.style.height = h + 'px';
        el.style.left = l + 'px'; el.style.top = t + 'px';
      }
    }
  };

  document.onmouseup = () => {
    if (dragging || resizing) saveCurrentSlide();
    dragging = false; resizing = false;
  };

  if (el.dataset.type !== 'letter') {
    ['tl','tr','bl','br'].forEach(pos => {
      const h = document.createElement('div');
      h.className = `drag-handle ${pos}`;
      el.appendChild(h);
    });
  }
}

// === ВЫБОР И СВОЙСТВА ===
function select(el) {
  document.querySelectorAll('.canvas-item').forEach(i => i.classList.remove('selected'));
  el.classList.add('selected');
  selected = el;
  updateProps();
  updateLayers();
}

canvas.onclick = e => {
  if (e.target === canvas || e.target.classList.contains('grid')) {
    selected = null;
    document.querySelectorAll('.canvas-item').forEach(i => i.classList.remove('selected'));
    updateProps();
    updateLayers();
  }
};

function updateProps() {
  const p = document.getElementById('prop-content');
  if (!selected) {
    p.innerHTML = '<p style="color:#aaa; text-align:center;">Выберите элемент</p>';
    return;
  }

  const isText = selected.dataset.type === 'text' || selected.dataset.type === 'letter';
  const isLetter = selected.dataset.type === 'letter';
  const isImage = selected.dataset.type === 'image';
  const isClickable = selected.classList.contains('clickable');
  const href = selected.dataset.href || '';
  const rotate = selected.style.transform?.match(/-?\d+/)?.[0] || '0';
  const anim = selected.dataset.animation || 'none';

  let html = `
    <div class="prop-group">
      <label class="prop-label">Кликабельный</label>
      <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
        <input type="checkbox" class="toggle-clickable" ${isClickable ? 'checked' : ''}>
        <span>Включить ссылку</span>
      </label>
    </div>
    ${isClickable ? `
    <div class="prop-group">
      <label class="prop-label">Ссылка</label>
      <input type="text" class="link-input" value="${href}" placeholder="https://">
    </div>` : ''}

    ${isText ? `
      <div class="prop-group">
        <label class="prop-label">Текст</label>
        <textarea rows="2" class="text-content">${selected.textContent}</textarea>
      </div>

      <div class="prop-group">
        <label class="prop-label">Шрифт</label>
        <select class="font-family">
          ${fonts.map(f => `<option value="${f}" ${selected.style.fontFamily.includes(f) ? 'selected' : ''}>${f}</option>`).join('')}
        </select>
      </div>

      <div class="prop-group">
        <label class="prop-label">Размер</label>
        <input type="range" min="12" max="300" value="${parseInt(selected.style.fontSize)}" class="font-size">
        <div class="range-val">${selected.style.fontSize || '48px'}</div>
      </div>

      <div class="prop-group">
        <label class="prop-label">Стиль</label>
        <div style="display:flex; gap:0.5rem;">
          <button class="btn-secondary ${selected.style.fontWeight >= 700 ? 'active' : ''}" onclick="toggleBold()">Ж</button>
          <button class="btn-secondary ${selected.style.fontStyle === 'italic' ? 'active' : ''}" onclick="toggleItalic()">К</button>
          <button class="btn-secondary ${selected.style.textDecoration.includes('underline') ? 'active' : ''}" onclick="toggleUnderline()">П</button>
        </div>
      </div>

      <div class="prop-group">
        <label class="prop-label">Цвет</label>
        <input type="color" value="${selected.style.color === 'transparent' ? '#ffffff' : (selected.style.color || '#ffffff')}" class="text-color">
      </div>

      <div class="prop-group">
        <label class="prop-label">Градиент</label>
        <input type="text" class="gradient-input" value="${selected.style.background || ''}" placeholder="linear-gradient(45deg, #fff, #d4af37)">
      </div>

      <div class="prop-group">
        <label class="prop-label">Обводка</label>
        <input type="text" class="stroke-input" value="${selected.style.webkitTextStroke || ''}" placeholder="2px #000">
      </div>

      <div class="prop-group">
        <label class="prop-label">Фильтр</label>
        <select class="filter-select">
          <option value="none">Без фильтра</option>
          <option value="blur(5px)">Размытие</option>
          <option value="brightness(1.5)">Яркость</option>
          <option value="contrast(2)">Контраст</option>
          <option value="drop-shadow(0 0 10px #d4af37)">Тень</option>
        </select>
      </div>

      <div class="prop-group">
        <label class="prop-label">Анимация</label>
        <select class="animation">
          ${animations.map(a => `<option value="${a}" ${anim === a ? 'selected' : ''}>${a === 'none' ? 'Без анимации' : a}</option>`).join('')}
        </select>
      </div>
    ` : isImage ? `
      <div class="prop-group">
        <label class="prop-label">Прозрачность</label>
        <input type="range" min="0" max="100" value="${Math.round((selected.style.opacity || 1) * 100)}" class="opacity">
        <div class="range-val">${Math.round((selected.style.opacity || 1) * 100)}%</div>
      </div>
      <div class="prop-group">
        <label class="prop-label">Наложение</label>
        <select class="blend-mode">
          ${['normal','multiply','screen','overlay','darken','lighten','color-dodge','hue','luminosity'].map(m => `<option value="${m}" ${selected.style.mixBlendMode === m ? 'selected' : ''}>${m}</option>`).join('')}
        </select>
      </div>
    ` : ''}

    <div class="prop-group">
      <label class="prop-label">Поворот</label>
      <input type="range" min="-180" max="180" value="${rotate}" class="rotate">
      <div class="range-val">${rotate}°</div>
    </div>

    <div class="actions">
      <button class="btn" onclick="deleteSelected()">Удалить</button>
      <button class="btn btn-secondary" onclick="duplicateSelected()">Дублировать</button>
      <button class="btn btn-secondary" onclick="bringToFront()">На передний</button>
      <button class="btn btn-secondary" onclick="sendToBack()">На задний</button>
    </div>
  `;

  p.innerHTML = html;

  setTimeout(() => {
    const toggle = p.querySelector('.toggle-clickable');
    const linkInput = p.querySelector('.link-input');

    if (toggle) {
      toggle.onchange = () => {
        if (toggle.checked) {
          selected.classList.add('clickable');
          selected.dataset.href = linkInput?.value || 'https://';
          selected.style.cursor = 'pointer';
        } else {
          selected.classList.remove('clickable');
          delete selected.dataset.href;
          selected.style.cursor = 'move';
        }
        updateProps();
        saveCurrentSlide();
      };
    }

    if (linkInput) linkInput.oninput = e => { selected.dataset.href = e.target.value; saveCurrentSlide(); };

    if (isText) {
      const textarea = p.querySelector('.text-content');
      const font = p.querySelector('.font-family');
      const size = p.querySelector('.font-size');
      const color = p.querySelector('.text-color');
      const gradient = p.querySelector('.gradient-input');
      const stroke = p.querySelector('.stroke-input');
      const filter = p.querySelector('.filter-select');
      const animSelect = p.querySelector('.animation');

      textarea.oninput = e => { 
        selected.textContent = e.target.value; 
        if (isLetter && selected.parentElement) {
          selected.parentElement.dataset.name = e.target.value;
          updateLayers();
        }
        saveCurrentSlide(); 
      };
      font.onchange = e => { selected.style.fontFamily = e.target.value; saveCurrentSlide(); };
      size.oninput = e => {
        selected.style.fontSize = e.target.value + 'px';
        p.querySelector('.range-val').textContent = e.target.value + 'px';
        saveCurrentSlide();
      };
      color.oninput = e => { 
        selected.style.color = e.target.value;
        if (selected.style.background) selected.style.color = 'transparent';
        saveCurrentSlide(); 
      };
      gradient.oninput = e => {
        if (e.target.value) {
          selected.style.background = e.target.value;
          selected.style.webkitBackgroundClip = 'text';
          selected.style.color = 'transparent';
        } else {
          selected.style.background = '';
          selected.style.webkitBackgroundClip = '';
          selected.style.color = p.querySelector('.text-color').value;
        }
        saveCurrentSlide();
      };
      stroke.oninput = e => {
        selected.style.webkitTextStroke = e.target.value;
        saveCurrentSlide();
      };
      filter.onchange = e => {
        selected.style.filter = e.target.value;
        saveCurrentSlide();
      };
      animSelect.onchange = e => {
        selected.dataset.animation = e.target.value;
        applyAnimation(selected, e.target.value);
        saveCurrentSlide();
      };
    } else if (isImage) {
      const opacity = p.querySelector('.opacity');
      const blend = p.querySelector('.blend-mode');
      opacity.oninput = e => {
        selected.style.opacity = e.target.value / 100;
        p.querySelector('.range-val').textContent = e.target.value + '%';
        saveCurrentSlide();
      };
      blend.onchange = e => { selected.style.mixBlendMode = e.target.value; saveCurrentSlide(); };
    }

    const rotate = p.querySelector('.rotate');
    rotate.oninput = e => {
      selected.style.transform = `rotate(${e.target.value}deg)`;
      p.querySelector('.range-val').textContent = e.target.value + '°';
      saveCurrentSlide();
    };
  }, 0);
}

window.toggleBold = () => { selected.style.fontWeight = selected.style.fontWeight >= 700 ? '400' : '700'; saveCurrentSlide(); updateProps(); };
window.toggleItalic = () => { selected.style.fontStyle = selected.style.fontStyle === 'italic' ? 'normal' : 'italic'; saveCurrentSlide(); updateProps(); };
window.toggleUnderline = () => { selected.style.textDecoration = selected.style.textDecoration.includes('underline') ? 'none' : 'underline'; saveCurrentSlide(); updateProps(); };

function deleteSelected() {
  if (selected) {
    selected.remove();
    layers = layers.filter(l => l.el !== selected);
    selected = null;
    updateProps();
    updateLayers();
    saveCurrentSlide();
  }
}

function duplicateSelected() {
  if (!selected) return;
  const data = getElementData(selected);
  data.x += 40; data.y += 40;
  let el;
  if (data.type === 'text') el = createTextElement(data.content);
  else if (data.type === 'image') el = createImageElement(data.content);
  else if (data.type === 'svg') el = createSVGElement(data.content);
  applyElementData(el, data);
  canvas.appendChild(el);
  makeDraggable(el);
  addLayer(el, data.name + ' (копия)');
  select(el);
  saveCurrentSlide();
}

function bringToFront() {
  if (!selected) return;
  const maxZ = Math.max(...Array.from(canvas.querySelectorAll('.canvas-item')).map(el => parseInt(el.style.zIndex) || 10), 10);
  selected.style.zIndex = maxZ + 1;
  saveCurrentSlide();
}

function sendToBack() {
  if (!selected) return;
  const minZ = Math.min(...Array.from(canvas.querySelectorAll('.canvas-item')).map(el => parseInt(el.style.zIndex) || 10), 10);
  selected.style.zIndex = minZ - 1;
  saveCurrentSlide();
}

// === СЛОИ ===
function addLayer(el, name) {
  layers.push({ el, name, visible: true });
  updateLayers();
}

function updateLayers() {
  const container = document.getElementById('layers');
  container.innerHTML = '<div class="tool-title">СЛОИ</div>';
  layers.slice().reverse().forEach((layer, i) => {
    const div = document.createElement('div');
    div.className = 'tool-btn';
    if (layer.el === selected) div.classList.add('active');
    const isLink = layer.el.classList.contains('clickable') ? ' (ссылка)' : '';
    div.innerHTML = `
      <i class="fas ${layer.visible ? 'fa-eye' : 'fa-eye-slash'}" onclick="toggleLayer(${layers.length-1-i}, event)"></i>
      <span ondblclick="renameLayer(this, ${layers.length-1-i})">${layer.name}${isLink}</span>
      <i class="fas fa-trash" style="margin-left:auto; opacity:0.6;" onclick="deleteLayer(${layers.length-1-i}, event)"></i>
    `;
    div.onclick = e => { if (!e.target.tagName.match(/I|SPAN/)) select(layer.el); };
    container.appendChild(div);
  });
}

window.toggleLayer = (idx, e) => {
  e.stopPropagation();
  layers[idx].visible = !layers[idx].visible;
  layers[idx].el.style.display = layers[idx].visible ? 'block' : 'none';
  updateLayers();
  saveCurrentSlide();
};

window.renameLayer = (span, idx) => {
  const newName = prompt('Новое имя:', span.textContent.replace(/ \(ссылка\)$/, ''));
  if (newName) {
    layers[idx].name = newName;
    span.textContent = newName + (layers[idx].el.classList.contains('clickable') ? ' (ссылка)' : '');
    layers[idx].el.dataset.name = newName;
  }
};

window.deleteLayer = (idx, e) => {
  e.stopPropagation();
  if (confirm('Удалить слой?')) {
    layers[idx].el.remove();
    layers.splice(idx, 1);
    selected = null;
    updateProps();
    updateLayers();
    saveCurrentSlide();
  }
};

// === ПРЕДПРОСМОТР ===
function openPreview() {
  saveCurrentSlide();
  previewContainer.innerHTML = '';

  const previewHTML = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>PILIGRM — Preview</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Shadows+Into+Light&display=swap" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" rel="stylesheet">
  <style>
    :root {
      --white: #ffffff;
      --gray: #e0e0e0;
      --bg: #000000;
      --glass: rgba(255, 255, 255, 0.08);
      --border: rgba(255, 255, 255, 0.15);
      --transition: all 0.35s ease;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { font-size: 16px; overflow-x: hidden; }
    body { 
      font-family: 'Inter', sans-serif; 
      background: var(--bg); 
      color: var(--white); 
      min-height: 100vh; 
      overflow: hidden;
    }

    header { 
      position: fixed; top: 0; left: 0; right: 0; z-index: 1000; 
      padding: 1.8rem 5%; height: 90px;
      display: flex; justify-content: space-between; align-items: center; 
      backdrop-filter: blur(20px); 
      background: rgba(0, 0, 0, 0.6); 
      border-bottom: 1px solid var(--border); 
      transition: var(--transition);
    }
    header.scrolled { 
      padding: 1.2rem 5%; height: 76px;
      background: rgba(0, 0, 0, 0.85); 
      box-shadow: 0 10px 30px rgba(0,0,0,0.4); 
    }

    .logo-text { 
      font-weight: 700; font-size: 2.4rem; color: var(--white); letter-spacing: 1.5px; 
    }

    nav { display: flex; gap: 2.4rem; align-items: center; margin-left: 5rem; }
    .nav-link { 
      font-weight: 500; font-size: 1.05rem; color: var(--gray); 
      letter-spacing: 1.2px; position: relative; padding: 6px 0; 
      transition: var(--transition); 
      pointer-events: none;
    }
    .nav-link::after { 
      content: ''; position: absolute; bottom: 0; left: 50%; width: 0; 
      height: 1.5px; background: var(--white); transition: var(--transition); 
      transform: translateX(-50%); 
    }
    .nav-link:hover { color: var(--white); }
    .nav-link:hover::after { width: 100%; }

    .header-icons { display: flex; gap: 1.1rem; align-items: center; }
    .icon-btn { 
      width: 44px; height: 44px; border-radius: 50%; 
      display: flex; align-items: center; justify-content: center; 
      background: var(--glass); 
      border: 1.2px solid var(--border); 
      backdrop-filter: blur(10px);
      pointer-events: none;
      transition: var(--transition);
    }
    .icon-btn:hover { 
      background: rgba(255, 255, 255, 0.2); 
      transform: scale(1.12); 
      box-shadow: 0 0 20px rgba(255, 255, 255, 0.3); 
    }
    .icon-btn i { font-size: 1.3rem; color: var(--white); }

    #landing {
      position: relative; width: 100vw; height: 100vh; overflow: hidden;
      background: #000; z-index: 1;
    }

    .slide {
      position: absolute; inset: 0; width: 100vw; height: 100vh;
      background-size: cover; background-position: center;
      opacity: 0; transition: opacity 1.6s ease; z-index: 1;
    }
    .slide.active { opacity: 1; z-index: 2; }
    .slide::before { 
      content: ''; position: absolute; inset: 0; 
      background: linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(0,0,0,0.65)); 
      z-index: 3; 
    }

    .carousel-content { position: absolute; inset: 0; display: flex; justify-content: center; align-items: center; z-index: 4; pointer-events: none; }
    .carousel-container { position: relative; width: 100%; height: 100%; pointer-events: auto; display: flex; justify-content: center; align-items: center; }
    .carousel-inner { position: relative; width: 1200px; height: 675px; transform: scale(var(--scale, 1)); transform-origin: center center; }

    .carousel-arrow {
      position: absolute; width: 40px; height: 40px; background: rgba(255, 255, 255, 0.1);
      border: 1.5px solid rgba(255, 255, 255, 0.3); border-radius: 50%;
      display: flex; align-items: center; justify-content: center; cursor: pointer;
      z-index: 10; transition: var(--transition); backdrop-filter: blur(8px);
    }
    .carousel-arrow:hover { background: rgba(255, 255, 255, 0.25); border-color: var(--white); transform: scale(1.15); }
    .carousel-arrow i { font-size: 1.1rem; color: var(--white); }
    .carousel-arrow.prev { left: 20px; top: 50%; transform: translateY(-50%); }
    .carousel-arrow.next { right: 20px; top: 50%; transform: translateY(-50%); }

    .carousel-progress {
      position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%);
      display: flex; gap: 12px; z-index: 10;
    }
    .progress-bar {
      width: 60px; height: 3px; background: rgba(255,255,255,0.3); border-radius: 2px; overflow: hidden;
    }
    .progress-fill { height: 100%; background: var(--white); width: 0%; border-radius: 2px; transition: width 5s linear; }
    .progress-bar.active .progress-fill { width: 100%; }

    .slide-element {
      position: absolute; user-select: none; z-index: 5; transform-origin: top left;
    }
    .slide-element.text {
      color: #fff; font-weight: 600; text-shadow: 0 2px 8px rgba(0,0,0,0.6);
      white-space: normal; line-height: 1.3; font-family: 'Inter', sans-serif;
    }
    .slide-element img { width: 100%; height: 100%; object-fit: contain; pointer-events: none; }

    @media (max-width: 768px) {
      nav { display: none; }
      .carousel-arrow { width: 36px; height: 36px; }
      .progress-bar { width: 40px; }
    }
  </style>
</head>
<body>

  <header>
    <div class="logo">
      <div class="logo-text">PILIGRIM</div>
    </div>
    <nav>
      <span class="nav-link">Главная</span>
      <span class="nav-link">Товары</span>
      <span class="nav-link">Услуги</span>
      <span class="nav-link">Новости</span>
      <span class="nav-link">О компании</span>
      <span class="nav-link">Контакты</span>
    </nav>
    <div class="header-icons">
      <div class="icon-btn"><i class="fas fa-search"></i></div>
      <div class="icon-btn"><i class="fas fa-user"></i></div>
      <div class="icon-btn"><i class="fas fa-shopping-bag"></i></div>
      <div class="icon-btn"><i class="fas fa-envelope"></i></div>
    </div>
  </header>

  <section id="landing">
    <div class="slide active" id="preview-slide-0"></div>
    <div class="slide" id="preview-slide-1"></div>
    <div class="slide" id="preview-slide-2"></div>
    <div class="slide" id="preview-slide-3"></div>
    <div class="slide" id="preview-slide-4"></div>

    <div class="carousel-content">
      <div class="carousel-container">
        <div class="carousel-arrow prev" onclick="prevPreviewSlide()"><i class="fas fa-chevron-left"></i></div>
        <div class="carousel-arrow next" onclick="nextPreviewSlide()"><i class="fas fa-chevron-right"></i></div>
        <div class="carousel-progress" id="preview-progress"></div>
        <div class="carousel-inner" id="preview-inner"></div>
      </div>
    </div>
  </section>

  <script>
    let currentPreviewSlide = 0;
    const previewData = ${JSON.stringify(slides)};

    function updateScale() {
      const baseWidth = 1200, baseHeight = 675;
      const scale = Math.min(window.innerWidth / baseWidth, window.innerHeight / baseHeight);
      document.documentElement.style.setProperty('--scale', scale);
    }

    function showPreviewSlide(n) {
      document.querySelectorAll('.slide').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.progress-bar').forEach(b => b.classList.remove('active'));
      
      currentPreviewSlide = (n + 5) % 5;
      const slideEl = document.getElementById('preview-slide-' + currentPreviewSlide);
      slideEl.classList.add('active');
      
      const progress = document.getElementById('preview-progress');
      progress.innerHTML = '';
      for (let i = 0; i < 5; i++) {
        const bar = document.createElement('div');
        bar.className = 'progress-bar';
        if (i === currentPreviewSlide) bar.classList.add('active');
        const fill = document.createElement('div');
        fill.className = 'progress-fill';
        if (i === currentPreviewSlide) fill.style.width = '100%';
        bar.appendChild(fill);
        progress.appendChild(bar);
      }

      const inner = document.getElementById('preview-inner');
      inner.innerHTML = '';
      const data = previewData[currentPreviewSlide];
      if (data.background) {
        slideEl.style.backgroundImage = 'url("' + data.background + '")';
      }

      data.elements.forEach(el => {
        const elem = document.createElement('div');
        elem.className = 'slide-element ' + el.type;
        elem.style.left = el.x + 'px';
        elem.style.top = el.y + 'px';
        elem.style.width = el.width + 'px';
        elem.style.height = el.height + 'px';
        elem.style.transform = el.rotation || 'rotate(0deg)';
        elem.style.opacity = el.opacity || 1;

        if (el.type === 'text') {
          elem.textContent = el.content;
          elem.style.fontSize = el.fontSize + 'px';
          elem.style.color = el.color || '#ffffff';
          elem.style.fontWeight = el.fontWeight || '600';
          elem.style.fontFamily = el.fontFamily || "'Inter', sans-serif";
          if (el.background) {
            elem.style.background = el.background;
            elem.style.webkitBackgroundClip = 'text';
            elem.style.color = 'transparent';
          }
          if (el.webkitTextStroke) elem.style.webkitTextStroke = el.webkitTextStroke;
        } else if (el.type === 'image') {
          const img = document.createElement('img');
          img.src = el.content;
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.objectFit = 'contain';
          elem.appendChild(img);
        } else if (el.type === 'svg') {
          elem.innerHTML = el.content;
        }

        if (el.href) {
          elem.style.cursor = 'pointer';
          elem.onclick = function(e) {
            e.stopPropagation();
            window.open(el.href, '_blank');
          };
        }

        inner.appendChild(elem);
      });

      clearTimeout(window.previewTimeout);
      window.previewTimeout = setTimeout(nextPreviewSlide, 5000);
    }

    window.prevPreviewSlide = function() {
      clearTimeout(window.previewTimeout);
      showPreviewSlide(currentPreviewSlide - 1);
    };

    window.nextPreviewSlide = function() {
      clearTimeout(window.previewTimeout);
      showPreviewSlide(currentPreviewSlide + 1);
    };

    updateScale();
    showPreviewSlide(0);
    window.addEventListener('resize', updateScale);
  </script>
</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.style.background = '#000';
  previewContainer.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(previewHTML);
  doc.close();

  previewModal.classList.add('active');
}

function closePreview() {
  previewModal.classList.remove('active');
}

previewModal.onclick = e => { if (e.target === previewModal) closePreview(); };

// === ЭКСПОРТ PNG ===
function exportPNG() {
  saveCurrentSlide();
  html2canvas(canvas, { backgroundColor: null, scale: 2 }).then(canvas => {
    const link = document.createElement('a');
    link.download = `zaza-slide-${currentSlide + 1}.png`;
    link.href = canvas.toDataURL();
    link.click();
  });
}

// === СОХРАНЕНИЕ / ЗАГРУЗКА ===
async function saveProject() {
  saveCurrentSlide();
  const data = { slides: slides.map((s, i) => ({ slide: i + 1, ...s })) };
  try {
    const r = await fetch('/api/landing/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const res = await r.json();
    alert(res.success ? 'Сохранено!' : 'Ошибка: ' + (res.error || ''));
  } catch { alert('Ошибка сети'); }
}

fetch('/api/landing/load')
  .then(r => r.json())
  .then(data => {
    if (data.slides) {
      const sorted = Array(5).fill().map(() => ({ background: '', bgSize: 'cover', elements: [] }));
      data.slides.forEach(s => {
        const idx = (s.slide || 1) - 1;
        if (idx >= 0 && idx < 5) sorted[idx] = s;
      });
      slides = sorted;
    }
    initSlides();
    loadSlide(0);
  })
  .catch(() => { initSlides(); loadSlide(0); });

// === ИНИЦИАЛИЗАЦИЯ ===
initSlides();
loadSlide(0);

window.addEventListener('message', (e) => {
  if (e.data.type === 'preview') {
    localStorage.setItem('zazaPreviewData', JSON.stringify(e.data.data));
    location.reload();
  }
});

const saved = localStorage.getItem('zazaPreviewData');
if (saved) {
  try {
    const data = JSON.parse(saved);
    slides = data.slides.map(s => ({
      background: s.background || '',
      bgSize: s.bgSize || 'cover',
      elements: (s.elements || []).map(el => ({
        ...el,
        x: el.x || 0, y: el.y || 0,
        width: el.width || 200, height: el.height || 200,
        fontSize: el.fontSize || 48, opacity: el.opacity || 1
      }))
    }));
    localStorage.removeItem('zazaPreviewData');
    initSlides();
    loadSlide(0);
  } catch (e) { console.error(e); }
}