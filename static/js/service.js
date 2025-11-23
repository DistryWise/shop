
    // === ОТСЛЕЖИВАНИЕ ПОПАДАНИЯ В БЕЛУЮ ЗОНУ ДЛЯ ШТОРКИ ===
    const lightZone = document.getElementById('lightZone');
    const sideCatalog = document.getElementById('sideCatalog');

    const catalogObserver = new IntersectionObserver(
        ([entry]) => {
            if (entry.isIntersecting) {
                lightZone.classList.add('active-catalog');
            } else {
                lightZone.classList.remove('active-catalog');
            }
        },
        { threshold: 0.3, rootMargin: '0px 0px -10% 0px' }
    );
    catalogObserver.observe(lightZone);

    document.addEventListener('DOMContentLoaded', () => {
      const lightZone = document.getElementById('lightZone');
      const whiteOverlay = document.getElementById('whiteOverlay');
      const hero = document.getElementById('hero');
      const footer = document.getElementById('footer');
      const sideCatalog = document.getElementById('sideCatalog');
      const grid = document.getElementById('grid');
      const modal = document.getElementById('modal');
      const catalogList = document.querySelector('.catalog-list');
      const searchInput = document.getElementById('search');
      const catalogArrowHint = document.getElementById('catalogArrowHint');

      let allProducts = [];
      let visibleCards = [];

      // === УВЕДОМЛЕНИЯ ===
      function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span class="icon">${type === 'success' ? '✓' : '✗'}</span><span>${message}</span>`;
        document.getElementById('toast-container').appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
          toast.classList.remove('show');
          setTimeout(() => toast.remove(), 400);
        }, 3000);
      }

      // === СКРОЛЛ-ЭФФЕКТ ===
// === ГЛАВНЫЙ SCROLL-ХЕНДЛЕР + ПОЛНАЯ ЛОГИКА КНОПКИ ВЫХОДА ===
window.addEventListener('scroll', () => {
  const rect = lightZone.getBoundingClientRect();
  const distanceFromTop = rect.top;
  const startOffset = window.innerHeight * 13.4;
  const triggerPoint = startOffset;
  const snapPoint = startOffset * 0.92;

  if (distanceFromTop < triggerPoint) {
    const progress = (triggerPoint - distanceFromTop) / (triggerPoint + window.innerHeight);
    const clamped = Math.min(Math.max(progress, 0), 1);

    whiteOverlay.classList.add('active');
    whiteOverlay.classList.remove('snapped');

    if (clamped > 0.93) {
      whiteOverlay.classList.add('snapped');
      lightZone.classList.add('normal');
      footer.classList.add('normal');
      hero.classList.add('hidden');
      sideCatalog.classList.add('inverted');
      document.body.classList.add('white');

      // ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
      // ВКЛЮЧАЕМ СТЕНУ ЧЕРЕЗ 1.5 СЕКУНДЫ (как у тебя было)
      if (!delayTimer && !locked) {
        delayTimer = setTimeout(() => {
          if (!exiting) {
            locked = true;
            updateWall();
            exitBtn.classList.add('show');
          }
        }, 1500);
      }
    } else {
      whiteOverlay.classList.remove('snapped');
      lightZone.classList.remove('normal');
      footer.classList.remove('normal');
      hero.classList.remove('hidden');
      sideCatalog.classList.remove('inverted');
      document.body.classList.remove('white');

      // ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
      // СБРАСЫВАЕМ СТЕНУ, ЕСЛИ ЕЩЁ НЕ snapped
      disableLock(); // твой же disableLock() из IIFE
    }
  } else {
    // Полный выход из белой зоны
    whiteOverlay.classList.remove('active', 'snapped');
    lightZone.classList.remove('normal');
    footer.classList.remove('normal');
    hero.classList.remove('hidden');
    sideCatalog.classList.remove('inverted');
    document.body.classList.remove('white');
    disableLock();
  }

  // ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
  // ЛОГИКА ВИДИМОСТИ КНОПКИ "НАВЕРХ · В NOIR"
  const btn = document.getElementById('exitWhiteZoneBtn');
  if (!btn) return;

  if (locked && !exiting) {
    // Мы у стены?
    const nearWall = window.pageYOffset <= wallY + 120;
    if (nearWall) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible'); // ←←← ВОТ ЭТО И БЫЛО НУЖНО!
    }
  } else {
    btn.classList.remove('visible');
  }
}, { passive: true });



      // Футер
      new IntersectionObserver(([e]) => footer.classList.toggle('visible', e.isIntersecting), { threshold: 0.4 })
        .observe(footer);

async function loadMainCarousel() {
  try {
    const res = await fetch('/api/landing/carousel/main');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const slides = await res.json();

    const hero = document.getElementById('hero');
    document.querySelectorAll('.slide').forEach(s => s.remove());

    if (!Array.isArray(slides) || slides.length === 0) return;

    slides.forEach((slide, i) => {
      const slideEl = document.createElement('div');
      slideEl.className = 'slide' + (i === 0 ? ' active' : '');

      // === ФОН ===
      const bgImg = document.createElement('img');
      bgImg.src = slide.background?.url || '/static/assets/fallback.jpg';
      bgImg.style.cssText = `
        width:100%; height:100%; object-fit:cover;
        position:absolute; top:0; left:0;
        filter:brightness(0.78) contrast(1.36);
        z-index:0; pointer-events:none;
      `;
      slideEl.appendChild(bgImg);

      // === СЛОИ: текст + картинки ===
      (slide.layers || []).forEach(layer => {
        if (layer.hidden) return;

 else if (layer.type === 'text') {
  const textEl = document.createElement('div');
  textEl.textContent = layer.content || '';

  const s = layer.style || {};

  // БАЗОВЫЕ СТИЛИ
  textEl.style.cssText = `
    position: absolute;
    left: ${s.left || '50%'};
    top: ${s.top || '50%'};
    font-size: ${s.fontSize || '48px'};
    color: ${s.color || '#ffffff'};
    font-family: ${s.fontFamily || 'Inter, sans-serif'};
    font-weight: ${s.fontWeight || '600'};
    text-shadow: 0 2px 10px rgba(0,0,0,0.8);
    z-index: 12;
    pointer-events: none;
    margin: 0;
    padding: 0;
    line-height: ${s.lineHeight || '1.2'};
    letter-spacing: ${s.letterSpacing || 'normal'};
    white-space: ${s.whiteSpace || 'pre-wrap'};
    text-align: ${s.textAlign || 'center'};
    width: ${s.width && s.width !== 'auto' ? s.width : 'auto'};
    max-width: 90%;
    box-sizing: border-box;
  `;

  // САМОЕ ГЛАВНОЕ — ЭТО РЕШАЕТ ВСЁ
  // Если в редакторе включено центрирование (а оно почти всегда включено)
  if (s.left && s.top && 
      (s.left.includes('50') || s.top.includes('50')) || 
      s.transform?.includes('translate')) {
    textEl.style.transform = 'translate(-50%, -50%)';
    textEl.style.transformOrigin = 'center center';
  } else {
    // Если позиция не по центру — оставляем как есть
    if (s.transform) {
      textEl.style.transform = s.transform;
    // rotate, scale и т.д.
    }
  }

  // Анимация
  if (s.animation && s.animation !== 'none') {
    textEl.classList.add('animate__animated', `animate__${s.animation}`);
  }

  slideEl.appendChild(textEl);
}

         else if (layer.type === 'image' && layer.url) {
          const wrapper = document.createElement('div');
          wrapper.style.cssText = `
            position: absolute;
            left: ${layer.style?.left || '20%'};
            top: ${layer.style?.top || '20%'};
            width: ${layer.style?.width || '30%'};
            height: ${layer.style?.height || 'auto'};
            z-index: 11;
            pointer-events: none;
            transform: ${layer.style?.transform || 'none'};
            border-radius: ${layer.style?.borderRadius || '0'};
            overflow: hidden;
            box-shadow: ${layer.style?.shadow || 'none'};
          `;

          const imgEl = document.createElement('img');
          imgEl.src = layer.url; // base64 или ссылка
          imgEl.style.cssText = 'width:100%; height:100%; object-fit:contain; display:block;';
          wrapper.appendChild(imgEl);
          slideEl.appendChild(wrapper);
        }
      });

      // === HOTSPOTS (кликабельные зоны) ===
(slide.hotspots || []).forEach(h => {
  if (h.hidden || !h.url) return;

  const hotspot = document.createElement('div');     // ← div, а не a
  hotspot.className = 'hotspot';
  hotspot.style.cursor = 'pointer';
  hotspot.title = '';                                // ← УБИРАЕТ СТАНДАРТНЫЙ ТУЛТИП НАВСЕГДА

  const left = (typeof h.x === 'string' && h.x.includes('%')) ? h.x : `${h.x}%`;
  const top = (typeof h.y === 'string' && h.y.includes('%')) ? h.y : `${h.y}%`;

  hotspot.style.cssText = `
    position: absolute;
    left: ${left};
    top: ${top};
    width: ${h.w || 12}%;
    height: ${h.h || 12}%;
    z-index: 99999;
    pointer-events: auto;
  `;

  // Превью
  const preview = document.createElement('div');
  preview.className = 'hotspot-preview';
  preview.innerHTML = `
    <div class="url">${h.url}</div>
    <img class="thumb loading" alt="">
  `;
  hotspot.appendChild(preview);

  hotspot.addEventListener('mouseenter', () => preview.classList.add('show'));
  hotspot.addEventListener('mouseleave', () => preview.classList.remove('show'));

  // og:image
  fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(h.url)}`)
    .then(r => r.json())
    .then(data => {
      const match = data.contents.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
      if (match?.[1]) {
        const thumb = preview.querySelector('.thumb');
        thumb.src = match[1];
        thumb.onload = () => {
          thumb.classList.remove('loading');
          thumb.style.display = 'block';
        };
      }
    })
    .catch(() => {});

  // Клик
hotspot.addEventListener('click', () => {
  fetch('/api/landing/click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'services', slide: i, url: h.url })
  });

  // Если ссылка на нашу услугу — открываем модалку, а не новую вкладку
  if (h.url.includes('/services#') || h.url.startsWith('#')) {
    const slug = h.url.split('#')[1];
    if (slug) {
      // Если уже на /services — просто открываем
      if (window.location.pathname.includes('/services')) {
        history.replaceState(null, null, `#${slug}`);
        handleHashOnLoad();
      } else {
        // Если не на /services — переходим нормально
        window.location.href = `/services#${slug}`;
      }
    }
  } else {
    // Если это внешняя ссылка — открываем в новой вкладке
    window.open(h.url, '_blank', 'noopener,noreferrer');
  }
});

  // Добавляем прямо в hero (главная карусель)
  document.getElementById('hero').appendChild(hotspot);
});

      hero.appendChild(slideEl);
    });

    // Автосмена слайдов
    let current = 0;
    const nextSlide = () => {
      document.querySelectorAll('.slide').forEach((s, idx) => {
        s.classList.toggle('active', idx === current);
      });
      current = (current + 1) % slides.length;
    };
    setInterval(nextSlide, 7000);

  } catch (err) {
    console.error('loadMainCarousel error:', err);
  }
}

// === ВТОРАЯ КАРУСЕЛЬ — ПОЛНОСТЬЮ ИСПРАВЛЕНА ===
async function loadSecondaryCarousel() {
  try {
    const res = await fetch('/api/landing/carousel/services');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const slides = await res.json();

    const container = document.getElementById('services-carousel-inner');
    const indicatorsContainer = container?.parentElement?.querySelector('.indicators');

    if (!container || !indicatorsContainer) {
      console.error('secondary-carousel не найден');
      return;
    }

    container.innerHTML = '';
    indicatorsContainer.innerHTML = '';

    if (!Array.isArray(slides) || slides.length === 0) {
      console.warn('Нет слайдов для второй карусели');
      return;
    }

    slides.forEach((slide, i) => {
      const slideEl = document.createElement('div');
      slideEl.className = 'carousel-slide' + (i === 0 ? ' active' : '');

      // === ФОН ===
      const bgImg = document.createElement('img');
      bgImg.src = slide.background?.url || '/static/assets/fallback.jpg';
      bgImg.alt = '';
      bgImg.style.cssText = `
        width:100%; height:100%; object-fit:cover;
        position:absolute; top:0; left:0; z-index:1;
        filter:brightness(0.86) contrast(1.22);
      `;
      if (slide.background?.animation) {
        bgImg.onload = () => bgImg.classList.add('animate__animated', `animate__${slide.background.animation}`);
      }
      slideEl.appendChild(bgImg);

      // === СЛОИ: текст + картинки ===
      (slide.layers || []).forEach(layer => {
        if (layer.hidden) return;

                if (layer.type === 'text') {
          const textEl = document.createElement('div');
          textEl.textContent = layer.content || '';

          const s = layer.style || {};

          // Базовые стили — как у тебя было, но с правильной логикой центрирования
          let cssText = `
            position: absolute;
            left: ${s.left || '50%'};
            top: ${s.top || '50%'};
            width: ${s.width || 'auto'};
            height: ${s.height || 'auto'};
            font-size: ${s.fontSize || '36px'};
            color: ${s.color || '#ffffff'};
            font-family: ${s.fontFamily || 'Inter, sans-serif'};
            font-weight: ${s.fontWeight || '600'};
            text-shadow: 0 2px 10px rgba(0,0,0,0.85);
            z-index: 12;
            pointer-events: none;
            line-height: ${s.lineHeight || '1.2'};
            letter-spacing: ${s.letterSpacing || 'normal'};
            white-space: ${s.whiteSpace || 'pre-wrap'};
            text-align: ${s.textAlign || 'center'};
            max-width: 94%;
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          `;

          // КЛЮЧЕВАЯ ЛОГИКА: когда применять translate(-50%, -50%)
          const shouldCenter = 
            s.left === '50%' || 
            (typeof s.left === 'string' && s.left.includes('50')) ||
            s.top === '50%' || 
            (typeof s.top === 'string' && s.top.includes('50')) ||
            (s.transform && s.transform.includes('translate'));

          if (shouldCenter) {
            cssText += `transform: translate(-50%, -50%);`;
            cssText += `transform-origin: center center;`;
          } else if (s.transform && s.transform !== 'none') {
            cssText += `transform: ${s.transform};`;
          }

          textEl.style.cssText = cssText;

          // Анимация
          if (s.animation && s.animation !== 'none') {
            textEl.classList.add('animate__animated', `animate__${s.animation}`);
          }

          slideEl.appendChild(textEl);
        }

         else if (layer.type === 'image' && layer.url) {
          const wrapper = document.createElement('div');
          wrapper.style.cssText = `
            position:absolute;
            left:${layer.style?.left || '20%'};
            top:${layer.style?.top || '20%'};
            width:${layer.style?.width || '30%'};
            height:${layer.style?.height || 'auto'};
            z-index:11;
            pointer-events:none;
            transform:${layer.style?.transform || 'none'};
            border-radius:${layer.style?.borderRadius || '8px'};
            overflow:hidden;
            box-shadow:${layer.style?.shadow || '0 8px 32px rgba(0,0,0,0.4)'};
          `;

          const imgEl = document.createElement('img');
          imgEl.src = layer.url; // base64 или внешняя ссылка
          imgEl.style.cssText = 'width:100%; height:100%; object-fit:contain; display:block;';
          wrapper.appendChild(imgEl);
          slideEl.appendChild(wrapper);
        }
      });

      // === HOTSPOTS ===
      (slide.hotspots || []).forEach(h => {
        if (h.hidden || !h.url) return;

        const hotspot = document.createElement('a');
        hotspot.className = 'hotspot';
        hotspot.href = 'javascript:void(0)';
        hotspot.target = '_blank';
        hotspot.rel = 'noopener noreferrer';

        // Правильно обрабатываем проценты и числа
        const left = (typeof h.x === 'string' && h.x.includes('%')) ? h.x : `${h.x}%`;
        const top = (typeof h.y === 'string' && h.y.includes('%')) ? h.y : `${h.y}%`;

        hotspot.style.cssText = `
          position:absolute;
          left:${left};
          top:${top};
          width:${h.w || 10}%;
          height:${h.h || 10}%;
          z-index:9999;
          cursor:pointer;
        `;

        // Превью с URL и миниатюрой
        const preview = document.createElement('div');
        preview.className = 'hotspot-preview';
        preview.innerHTML = `
          <div class="url">${h.url}</div>
          <img class="thumb loading" alt="Загрузка...">
        `;
        hotspot.appendChild(preview);

        // Показ/скрытие превью
        hotspot.addEventListener('mouseenter', () => {
          const rect = hotspot.getBoundingClientRect();
          const spaceAbove = rect.top;
          const spaceBelow = window.innerHeight - rect.bottom;

          if (spaceAbove < 120 && spaceBelow > spaceAbove) {
            preview.style.bottom = 'auto';
            preview.style.top = '100%';
            preview.style.transform = 'translateX(-50%) translateY(12px)';
          } else {
            preview.style.bottom = '100%';
            preview.style.top = 'auto';
            preview.style.transform = 'translateX(-50%) translateY(-12px)';
          }
          preview.classList.add('show');
        });

        hotspot.addEventListener('mouseleave', () => {
          preview.classList.remove('show');
        });

        // Загрузка og:image
        fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(h.url)}`)
          .then(r => r.json())
          .then(data => {
            const match = data.contents.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
            if (match?.[1]) {
              const thumb = preview.querySelector('.thumb');
              thumb.src = match[1];
              thumb.onload = () => {
                thumb.classList.remove('loading');
                thumb.style.display = 'block';
              };
            }
          })
          .catch(() => {});

        // Клик
        hotspot.addEventListener('click', () => {
          fetch('/api/landing/click', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind: 'services', slide: i, url: h.url })
          }).catch(() => {});
          window.open(h.url, '_blank', 'noopener,noreferrer');
        });

        slideEl.appendChild(hotspot);
      });

      container.appendChild(slideEl);
    });

    // Индикаторы
    slides.forEach((_, i) => {
      const ind = document.createElement('div');
      ind.className = 'indicator' + (i === 0 ? ' active' : '');
      ind.onclick = () => goToSlide(i);
      indicatorsContainer.appendChild(ind);
    });

    let current = 0;
    const goToSlide = (n) => {
      current = n;
      container.querySelectorAll('.carousel-slide').forEach((s, idx) => {
        s.classList.toggle('active', idx === current);
      });
      indicatorsContainer.querySelectorAll('.indicator').forEach((ind, idx) => {
        ind.classList.toggle('active', idx === current);
      });
    };

    setInterval(() => {
      current = (current + 1) % slides.length;
      goToSlide(current);
    }, 6000);

  } catch (err) {
    console.error('Ошибка второй карусели:', err);
    showToast('Ошибка загрузки карусели услуг', 'error');
  }
}

      // === RICK OWENS ARROW HINT ===
      let arrowTimeout;
      function showArrow() {
        clearTimeout(arrowTimeout);
        catalogArrowHint.classList.remove('visible');
        arrowTimeout = setTimeout(() => {
          catalogArrowHint.classList.add('visible');
        }, 1400);
      }
      function hideArrow() {
        clearTimeout(arrowTimeout);
        catalogArrowHint.classList.remove('visible');
      }

      window.addEventListener('load', showArrow);
      window.addEventListener('scroll', () => {
        const snapped = whiteOverlay.classList.contains('snapped');
        catalogArrowHint.classList.toggle('inverted', snapped);
        showArrow();
      });
      sideCatalog.addEventListener('mouseenter', hideArrow);
      sideCatalog.addEventListener('mouseleave', showArrow);

function createCard(p) {
  if (!p || !p.id) return null;

  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.category = p.category || 'all';
  card.dataset.price = parsePrice(p.price);
  card.dataset.productId = p.id;

  let imgUrl = '/static/assets/no-image.png';
  if (p.image_urls && p.image_urls.length > 0) {
    imgUrl = p.image_urls[0];  // ← БОЛЬШЕ НИЧЕГО НЕ ДЕЛАЙ!
  }

  const desc = p.full_desc || p.short_desc || 'Описание отсутствует';

  card.innerHTML = `
    <img src="${imgUrl}" alt="${p.title}" 
         onerror="this.onerror=null; this.src='/static/assets/no-image.png';">
    <div class="overlay">
      <h3>${p.title}</h3>
      <p>${desc}</p>
      <span class="price">₽ ${p.price || '—'}</span>
    </div>
  `;

  card.addEventListener('click', () => openModal(p.id, true));
  return card;
}
      // === ПАРСИНГ ЦЕНЫ ===
      function parsePrice(str) {
        if (!str) return 0;
        return parseInt(str.replace(/[^0-9]/g, '')) || 0;
      }



      function renderAdBanner() {
        const track = document.getElementById('adBannerTrack');
        if (!track) {
          console.error('adBannerTrack не найден!');
          return;
        }

        track.innerHTML = '';

        const start = adIndex * 3;
        const items = adBannerData.slice(start, start + 3);

        items.forEach(ad => {
          const card = document.createElement('div');
          card.style.cssText = `
            position:relative;height:620px;overflow:hidden;cursor:pointer;
            border-radius:16px;
            opacity:0;transform:perspective(2400px) rotateX(14deg) translateY(140px) scale(0.92);
            transition:all 1.4s cubic-bezier(0.16,1,0.3,1);
            box-shadow:0 30px 60px rgba(0,0,0,0.3);
          `;

          const imgUrl = ad.background?.url || '/static/assets/fallback.jpg';

          card.innerHTML = `
            <img src="${imgUrl}" style="width:100%;height:100%;object-fit:cover;filter:brightness(0.86) contrast(1.22);transition:transform 1.8s;">
            <div style="position:absolute;inset:0;background:linear-gradient(transparent 35%, rgba(0,0,0,0.88));padding:80px 60px;display:flex;flex-direction:column;justify-content:flex-end;color:#fff;">
              <h3 style="font-size:30px;letter-spacing:18px;margin-bottom:16px;text-transform:uppercase;">${ad.title || 'NOIR EXCLUSIVE'}</h3>
              <p style="font-size:15px;line-height:1.9;opacity:0.9;max-width:80%;">${ad.desc || 'Доступ только для избранных.'}</p>
            </div>
          `;

          if (ad.url) {
            card.onclick = () => window.open(ad.url, '_blank');
          }

          card.addEventListener('mouseenter', () => {
            card.style.transform = 'perspective(2400px) rotateX(3deg) translateY(-50px) scale(1.01)';
            card.querySelector('img').style.transform = 'scale(1.08)';
          });
          card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(2400px) rotateX(0) translateY(0) scale(1)';
            card.querySelector('img').style.transform = 'scale(1)';
          });

          track.appendChild(card);
          setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'perspective(2400px) rotateX(0) translateY(0) scale(1)';
          }, 100);
        });

        updateAdBannerButtons();
      }

      function setupAdBannerControls() {
        const prev = document.getElementById('adPrev');
        const next = document.getElementById('adNext');

        if (!prev || !next) return;

        prev.onclick = () => {
          if (adIndex > 0) {
            adIndex--;
            renderAdBanner();
          }
        };

        next.onclick = () => {
          if ((adIndex + 1) * 3 < adBannerData.length) {
            adIndex++;
            renderAdBanner();
          }
        };

        updateAdBannerButtons();
      }

      function updateAdBannerButtons() {
        const prev = document.getElementById('adPrev');
        const next = document.getElementById('adNext');
        if (prev) prev.style.display = adIndex > 0 ? 'block' : 'none';
        if (next) next.style.display = (adIndex + 1) * 3 < adBannerData.length ? 'block' : 'none';
      }

      async function renderInitialCards() {
          if (!grid) return console.error('grid не найден');

          grid.innerHTML = '';
          visibleCards = [];

          if (allProducts.length === 0) {
              updateLoadMore();
              return;
          }

          const first9 = allProducts.slice(0, 9);
          first9.forEach(p => {
              const card = createCard(p);
              if (card) {
                  grid.appendChild(card);
                  visibleCards.push(card);
              }
          });

          if (allProducts.length >= 9) {
              console.log('Initial render: Showing adBannerSection'); // Отладка
              const bannerWrapper = document.createElement('div');
              bannerWrapper.className = 'ad-banner-wrapper';
              bannerWrapper.style.cssText = 'grid-column:1/-1;margin:2px 0;';

              const bannerSection = document.getElementById('adBannerSection');
              if (bannerSection) {
                  bannerSection.style.display = 'block';
                  bannerWrapper.appendChild(bannerSection);
                  loadSecondaryCarousel(); // ← УДАЛИ ЭТУ СТРОКУ!

              } else {
                  console.error('adBannerSection не найден');
              }
              grid.appendChild(bannerWrapper);
          }

          const next9 = allProducts.slice(9, 18);
          next9.forEach(p => {
              const card = createCard(p);
              if (card) {
                  grid.appendChild(card);
                  visibleCards.push(card);
              }
          });

          setTimeout(animateCards, 600);
          updateLoadMore();
      }

      async function loadProducts() {
        try {
          const res = await fetch('/api/services');
          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          const data = await res.json();
          if (!Array.isArray(data)) throw new Error('API вернул не массив');

          allProducts = data;

          const catalogList = document.querySelector('.catalog-list');
          catalogList.innerHTML = '';

          const allLi = document.createElement('li');
          allLi.className = 'active';
          allLi.dataset.filter = 'all';
          allLi.innerHTML = '<a>ALL SERVICES</a>';
          catalogList.appendChild(allLi);

          const categories = [...new Set(allProducts.map(p => p.category).filter(Boolean))];

          if (categories.length === 0) {
            console.warn('В API нет поля "category" — каталог будет пустым');
            const fallbackCats = [...new Set(allProducts.map(p => {
              const words = (p.title || '').trim().split(' ');
              return words.length > 1 ? words[0].toUpperCase() : 'UNCATEGORIZED';
            }))];
            fallbackCats.forEach(cat => {
              const li = document.createElement('li');
              li.dataset.filter = cat;
              li.innerHTML = `<a>${cat}</a>`;
              catalogList.appendChild(li);
            });
          } else {
            categories.forEach(cat => {
              const li = document.createElement('li');
              li.dataset.filter = cat;
              li.innerHTML = `<a>${cat.toUpperCase()}</a>`;
              catalogList.appendChild(li);
            });
          }

          renderInitialCards();
          setupEventListeners();
          if (window.location.hash) {
            setTimeout(handleHashOnLoad, 800);  // 200 мс — чтобы карточки успели отрисоваться и анимироваться
          }
        } catch (err) {
          console.error('ОШИБКА ЗАГРУЗКИ:', err);
          grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:200px;color:#000;">Ошибка: ${err.message}</div>`;
        }
      }

async function openModal(id, pushHistory = true) {
  try {
    // Если передан slug вместо id — найдём по нему
    let productId = id;
    if (typeof id === 'string' && isNaN(id)) {
      const product = allProducts.find(p => 
        p.slug === id || 
        p.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') === id
      );
      if (!product) throw new Error('Услуга не найдена');
      productId = product.id;
    }

    const res = await fetch(`/api/service/${productId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const p = await res.json();

    // === Заполняем модалку ===
    const mainImg = document.getElementById('modal-img');
    const thumbs = document.getElementById('modal-thumbs');
    thumbs.innerHTML = '';

    const images = (p.image_urls || []).map(url => 
      url.startsWith('/') ? url : `/static/uploads/services/${url}`
    );
    if (images.length === 0) images.push('/static/assets/no-image.png');
    mainImg.src = images[0];

    images.forEach((src, i) => {
      const thumb = document.createElement('img');
      thumb.src = src;
      if (i === 0) thumb.classList.add('active');
      thumb.onclick = () => {
        mainImg.src = src;
        thumbs.querySelectorAll('img').forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
      };
      thumbs.appendChild(thumb);
    });

    document.getElementById('modal-title').textContent = p.title || '';
    document.getElementById('modal-price').textContent = p.price ? `₽ ${p.price}` : 'ПО ЗАПРОСУ';
    document.getElementById('modal-desc').textContent = p.full_desc || 'Описание отсутствует';

    await loadReviews(productId);

    // === ОТКРЫВАЕМ МОДАЛКУ ===
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // === ОБНОВЛЯЕМ URL (только если нужно) ===
    if (pushHistory) {
      const slug = p.slug || p.title?.toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-').replace(/^-|-$/g, '') || productId;
      const newUrl = `${window.location.pathname}#${slug}`;
      history.pushState({ modal: true, id: productId }, '', newUrl);
    }

  } catch (err) {
    console.error('[MODAL] Ошибка:', err);
    showToast('Услуга не найдена', 'error');
  }
}

      async function loadReviews(serviceId) {
        console.log('[REVIEWS] Загрузка для услуги ID:', serviceId);
        try {
          const res = await fetch(`/api/service_reviews/${serviceId}`);
          if (!res.ok) {
            console.warn(`[REVIEWS] HTTP ${res.status} → /api/service_reviews/${serviceId}`);
            throw new Error(`HTTP ${res.status}`);
          }

          const data = await res.json();
          if (!data.success) throw new Error('API error');

          const reviews = data.reviews || [];
          const avgRating = data.avg_rating || 0;
          const reviewCount = data.review_count || 0;

          const reviewsEl = document.getElementById('modal-reviews');
          const noReviews = document.getElementById('no-reviews');
          reviewsEl.innerHTML = '';

          if (reviews.length > 0) {
            noReviews.style.display = 'none';
            reviews.forEach(r => {
              const div = document.createElement('div');
              div.className = 'review';
              div.innerHTML = `
                <div class="review-header">
                  <div class="review-author">${r.author}</div>
                  <div class="review-date">${formatDate(r.date)}</div>
                </div>
                <div class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
                <div class="review-text">${escapeHtml(r.text)}</div>
              `;
              reviewsEl.appendChild(div);
            });
          } else {
            noReviews.style.display = 'block';
          }

          const ratingEl = document.getElementById('modal-rating');
          const starsEl = ratingEl.querySelector('.stars');
          const valueEl = ratingEl.querySelector('.value');
          const countEl = ratingEl.querySelector('.count');

          valueEl.textContent = avgRating;
          countEl.textContent = `(${reviewCount})`;

          const full = Math.floor(avgRating);
          const empty = 5 - full;
          starsEl.innerHTML = '★'.repeat(full) + '<span style="color:#ccc">' + '☆'.repeat(empty) + '</span>';

        } catch (err) {
          console.error('[REVIEWS] Ошибка:', err);
          document.getElementById('modal-reviews').innerHTML = '<p style="color:#ccc">Отзывы временно недоступны</p>';
        }
      }

      function formatDate(iso) {
        try {
          return new Date(iso).toLocaleDateString('ru', { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric' 
          });
        } catch {
          return '—';
        }
      }

      function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      }

      function setupReviewForm(serviceId) {
        const form = document.getElementById('reviewForm');
        const stars = document.querySelectorAll('#starRating span');
        const submitBtn = document.getElementById('submitReview');
        let selectedRating = 5;

        stars.forEach(star => {
          star.onclick = () => {
            selectedRating = star.dataset.value;
            stars.forEach(s => {
              s.classList.toggle('active', s.dataset.value <= selectedRating);
            });
          };
        });

        submitBtn.onclick = async () => {
          const name = document.getElementById('reviewName').value.trim();
          const text = document.getElementById('reviewText').value.trim();

          if (!name || !text) {
            alert('Заполните все поля');
            return;
          }

          try {
            const res = await fetch('/api/reviews', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                serviceId,
                author: name,
                stars: parseInt(selectedRating),
                text
              })
            });

            if (res.ok) {
              alert('Отзыв отправлен!');
              form.reset();
              stars.forEach(s => s.classList.remove('active'));
              stars[4].classList.add('active');
              await loadReviews(serviceId);
            } else {
              alert('Ошибка отправки');
            }
          } catch (err) {
            console.error(err);
            alert('Ошибка сети');
          }
        };
      }


function closeModal() {
  modal.classList.remove('active');
  document.body.style.overflow = '';

  // Убираем хеш ТОЛЬКО если модалка реально была открыта и мы её закрываем вручную
  if (window.location.hash) {
    history.replaceState(null, null, window.location.pathname + window.location.search);
  }
}

// Крестик / оверлей / ESC
document.querySelector('.modal-close-btn')?.addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modal.classList.contains('active')) closeModal();
});

// === ПОДДЕРЖКА ПРЯМЫХ ССЫЛОК И КНОПОК НАЗАД/ВПЕРЁД ===
window.addEventListener('popstate', e => {
  if (e.state?.modal) {
    // Кнопка «вперёд» — открываем модалку
    openModal(e.state.id, false);
  } else {
    // Кнопка «назад» или прямой переход без state → закрываем
    if (modal.classList.contains('active')) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
      // НЕ чистим хеш здесь — он уже будет пустой или нужный
    }
  }
});

function handleHashOnLoad() {
  if (!window.location.hash) return;

  const hash = window.location.hash.substring(1).toLowerCase();

  const product = allProducts.find(p => {
    const slug = (p.slug || '').toLowerCase();
    const titleSlug = (p.title || '')
      .toLowerCase()
      .replace(/[^a-zа-я0-9]+/gi, '-')
      .replace(/^-|-$/g, '');

    return slug === hash || titleSlug === hash;
  });

  if (!product) return;

  const waitForCard = () => {
    const card = document.querySelector(`[data-product-id="${product.id}"]`);
    if (card || visibleCards.some(c => c.dataset.productId == product.id)) {
      openModal(product.id, false);
    } else {
      requestAnimationFrame(waitForCard);
    }
  };

  waitForCard();
}



      function animateCards() {
        const visible = visibleCards.filter(c => c.style.display !== 'none');
        visibleCards.forEach(c => c.classList.remove('visible'));
        visible.forEach((c, i) => setTimeout(() => c.classList.add('visible'), 100 + i * 160));
      }

      function applyFiltersAndSort() {
          const activeLi = document.querySelector('.catalog-list li.active');
          const filter = activeLi ? activeLi.dataset.filter : 'all';
          const query = (searchInput.value || '').trim().toLowerCase();
          const sort = document.querySelector('.sort-btn.active')?.dataset.sort || 'default';

          let filtered = allProducts.filter(p => {
              const matchesCategory = filter === 'all' || p.category === filter;
              const searchText = `${p.title} ${p.full_desc || ''} ${p.short_desc || ''} ${p.price || ''}`.toLowerCase();
              const matchesSearch = !query || searchText.includes(query);
              return matchesCategory && matchesSearch;
          });

          console.log('applyFiltersAndSort: filter:', filter, 'filtered count:', filtered.length); // Отладка

          if (sort === 'price') {
              filtered.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
          }

          renderWithBanner(filtered);
      }
async function renderWithBanner(products) {
    // УДАЛЯЕМ ТОЛЬКО КАРТОЧКИ И СООБЩЕНИЕ "НИЧЕГО НЕ НАЙДЕНО"
    grid.querySelectorAll('.card, .empty-message').forEach(el => el.remove());

    // Удаляем старый враппер баннера, если он был (но НЕ трогаем сам #adBannerSection!)
    const oldWrapper = grid.querySelector('.ad-banner-wrapper');
    if (oldWrapper) oldWrapper.remove();

    visibleCards = [];

    // НИЧЕГО НЕ НАЙДЕНО
    if (products.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-message';
        empty.style.cssText = 'grid-column:1/-1;text-align:center;padding:240px 40px;font-size:28px;letter-spacing:12px;color:#000;opacity:0.4;pointer-events:none;';
        empty.textContent = 'НИЧЕГО НЕ НАЙДЕНО';
        grid.appendChild(empty);

        // Просто скрываем баннер
        const banner = document.getElementById('adBannerSection');
        if (banner) banner.style.display = 'none';

        updateLoadMore();
        return;
    }

    // Первые 9 карточек
    products.slice(0, 9).forEach(p => {
        const card = createCard(p);
        if (card) {
            grid.appendChild(card);
            visibleCards.push(card);
        }
    });

    // === ВСТАВЛЯЕМ БАННЕР ПОСЛЕ 9-Й КАРТОЧКИ ===
    if (products.length >= 9) {
        const bannerSection = document.getElementById('adBannerSection');
        if (bannerSection) {
            bannerSection.style.display = 'block'; // показываем

            // Создаём враппер только если его ещё нет
            let wrapper = grid.querySelector('.ad-banner-wrapper');
            if (!wrapper) {
                wrapper = document.createElement('div');
                wrapper.className = 'ad-banner-wrapper';
                wrapper.style.cssText = 'grid-column:1/-1;margin:120px 0;';
                wrapper.appendChild(bannerSection); // ← вставляем сам блок с каруселью
                grid.appendChild(wrapper);
            }
        }
    } else {
        // Если товаров меньше 9 — скрываем баннер
        const banner = document.getElementById('adBannerSection');
        if (banner) banner.style.display = 'none';
    }

    // Карточки 10–18
    products.slice(9, 18).forEach(p => {
        const card = createCard(p);
        if (card) {
            grid.appendChild(card);
            visibleCards.push(card);
        }
    });

    setTimeout(animateCards, 100);
    updateLoadMore();
}
      function allVisibleCards() {
        return Array.from(grid.querySelectorAll('.card'));
      }

      function updateLoadMore() {
        const loadMoreSection = document.querySelector('.load-more-section');
        if (!loadMoreSection) return;

        const activeFilter = document.querySelector('.catalog-list li.active')?.dataset.filter || 'all';
        const query = (searchInput.value || '').trim().toLowerCase();

        const totalFiltered = allProducts.filter(p => {
          const matchesCategory = activeFilter === 'all' || p.category === activeFilter;
          const searchText = `${p.title} ${p.full_desc || ''} ${p.short_desc || ''} ${p.price || ''}`.toLowerCase();
          const matchesSearch = !query || searchText.includes(query);
          return matchesCategory && matchesSearch;
        }).length;

        const shownCards = visibleCards.length;
        loadMoreSection.style.display = shownCards < totalFiltered ? 'block' : 'none';
      }

      document.querySelector('.load-more-btn').addEventListener('click', (e) => {
        e.preventDefault();

        const activeFilter = document.querySelector('.catalog-list li.active')?.dataset.filter || 'all';
        const query = (searchInput.value || '').trim().toLowerCase();

        const filtered = allProducts.filter(p => {
          const matchesCategory = activeFilter === 'all' || p.category === activeFilter;
          const searchText = `${p.title} ${p.full_desc || ''} ${p.short_desc || ''} ${p.price || ''}`.toLowerCase();
          const matchesSearch = !query || searchText.includes(query);
          return matchesCategory && matchesSearch;
        });

        const start = visibleCards.length;
        const end = Math.min(start + 6, filtered.length);

        if (start >= end) return;

        const newCards = filtered.slice(start, end).map(createCard);
        newCards.forEach(c => {
          if (c) {
            grid.appendChild(c);
            visibleCards.push(c);
          }
        });

        animateCards();
        updateLoadMore();
      });

      document.querySelectorAll('.grid-btn').forEach(b => b.addEventListener('click', () => {
        document.querySelectorAll('.grid-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        grid.className = 'grid' + (b.dataset.cols === '2' ? ' cols-2' : '');
      }));

    function setupEventListeners() {
        document.querySelector('.catalog-list').addEventListener('click', (e) => {
            const li = e.target.closest('li');
            if (!li || !li.dataset.filter) return;

            // Сбрасываем активный класс
            document.querySelectorAll('.catalog-list li').forEach(x => x.classList.remove('active'));
            li.classList.add('active');

            // Плавный скролл к lightZone, если sideCatalog не инвертирован и lightZone не видима
            if (!sideCatalog.classList.contains('inverted') && !lightZone.classList.contains('active-catalog')) {
                const lightZoneTop = lightZone.getBoundingClientRect().top + window.pageYOffset;
                window.scrollTo({
                    top: lightZoneTop - 50, // Небольшой отступ сверху
                    behavior: 'smooth'
                });
            }

            applyFiltersAndSort();
        });


        document.querySelectorAll('.sort-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.sort-btn').forEach(x => x.classList.remove('active'));
                btn.classList.add('active');
                applyFiltersAndSort();
            });
        });

        searchInput.addEventListener('input', () => {
            applyFiltersAndSort();
        });
    }

      const scrollIndicator = document.querySelector('.scroll-indicator');
      if (scrollIndicator) {
        const hide = () => {
          if (window.scrollY > 100) {
            scrollIndicator.style.opacity = '0';
            scrollIndicator.style.pointerEvents = 'none';
          }
        };
        window.addEventListener('scroll', hide);
        hide();
      }

      loadMainCarousel();
      loadProducts();

    });
// === УМНАЯ ОБРАБОТКА #slug — РАБОТАЕТ ВО ВСЕХ СЛУЧАЯХ ===
// Добавь этот код вместо всего старого блока
document.addEventListener('DOMContentLoaded', () => {
  // Если у нас уже есть хэш при загрузке страницы
  if (window.location.hash) {
    const hash = window.location.hash.substring(1);

    // Если мы УЖЕ на странице /services — просто открываем модалку (НИКАКИХ редиректов)
    if (window.location.pathname === '/services' || window.location.pathname === '/services/') {
      setTimeout(() => handleHashOnLoad(), 1000);
      return;
    }

    // Если мы НЕ на /services и пришли ИЗНУТРИ сайта — переходим на /services#hash
    if (document.referrer && document.referrer.includes(window.location.origin)) {
      window.location.href = `/services#${hash}`;
      return;
    }

    // Если мы НЕ на /services и пришли СНАРУЖИ — открываем в новой вкладке
    if (!document.referrer || !document.referrer.includes(window.location.origin)) {
      window.open(`/services#${hash}`, '_blank', 'noopener,noreferrer');
      // Можно закрыть текущую вкладку, если это был редирект-страница
      // window.close();
      return;
    }
  }
});

// Обрабатываем клики по хотспотам в карусели (главное — НЕ делать window.open!)
document.addEventListener('click', e => {
  const hotspot = e.target.closest('.hotspot');
  if (!hotspot) return;

  // Если ссылка ведёт на наш же /services#что-то
  const url = hotspot.dataset.url || hotspot.href || '';
  const isOurServiceLink = url.includes('/services#') || url.startsWith('#');

  if (isOurServiceLink && window.location.pathname.includes('/services')) {
    e.preventDefault(); // ← КРИТИЧНО! Блокируем переход

    const hash = url.split('#')[1];
    if (hash) {
      history.replaceState(null, null, `#${hash}`);
      handleHashOnLoad();
    }
  }
});


// Клик — плавный скролл наверх
document.getElementById('exitWhiteZoneBtn')?.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ЖЁСТКАЯ СТЕНА С ЗАДЕРЖКОЙ 3 СЕКУНДЫ ПОСЛЕ ВХОДА В БЕЛУЮ ЗОНУ
(() => {
  const lightZone = document.getElementById('lightZone');
  const whiteOverlay = document.getElementById('whiteOverlay');
  const exitBtn = document.getElementById('exitWhiteZoneBtn');
  const header = document.querySelector('.catalog-header h1');

  let wallY = 0;
  let locked = false;           // стена активна
  let delayTimer = null;        // таймер на 3 секунды
  let vibrating = false;
  let exiting = false;

  const updateWall = () => {
    if (!header) return;
    const rect = header.getBoundingClientRect();
    wallY = window.pageYOffset + rect.top - 120;
    if (wallY < 0) wallY = 0;
  };

  const vibrate = () => {
    if (vibrating || !lightZone) return;
    vibrating = true;
    lightZone.classList.add('light-zone-hit');
    setTimeout(() => lightZone.classList.remove('light-zone-hit'), 400);
    setTimeout(() => vibrating = false, 600);
  };

  // Включаем блокировку через 3 секунды после входа в snapped
  const startLockDelay = () => {
    if (delayTimer) clearTimeout(delayTimer);

    delayTimer = setTimeout(() => {
      if (exiting) return;
      locked = true;
      updateWall();
      exitBtn.classList.add('show');
    }, 1500); // ← ровно 3 секунды свободы
  };

  // Отключаем всё при выходе или если шторка опустилась
  const disableLock = () => {
    if (delayTimer) {
      clearTimeout(delayTimer);
      delayTimer = null;
    }
    locked = false;
    exitBtn.classList.remove('show');
  };

  // Проверка состояния
  const checkZone = () => {
    const inWhiteZone = document.body.classList.contains('white') &&
                        whiteOverlay.classList.contains('snapped');

    if (inWhiteZone && !exiting) {
      if (!locked && !delayTimer) {
        startLockDelay(); // запускаем таймер на 3 сек
      }
    } else {
      disableLock();
    }
  };

  // Жёсткая блокировка только после активации locked
  const blockUp = (e) => {
    if (exiting || !locked) return;

    if (window.pageYOffset <= wallY + 50 && e.deltaY < 0) {
      e.preventDefault();
      window.scrollTo({ top: wallY, behavior: 'instant' });
      vibrate();
    }
  };

  window.addEventListener('wheel', blockUp, { passive: false });
  window.addEventListener('touchmove', blockUp, { passive: false });

  // При скролле — если стена уже активна, не даём уйти вверх
  window.addEventListener('scroll', () => {
    if (locked && !exiting && window.pageYOffset < wallY) {
      window.scrollTo({ top: wallY, behavior: 'instant' });
      vibrate();
    }

    // Стрелка видна только когда стена активна и мы у верха
    if (locked) {
      exitBtn.classList.toggle('show', window.pageYOffset <= wallY + 100);
    }
  }, { passive: true });

  // Кнопка выхода — мгновенно убирает всё
  exitBtn.addEventListener('click', () => {
    exiting = true;
    disableLock();

    document.body.classList.remove('white');
    whiteOverlay.classList.remove('active', 'snapped');
    lightZone.classList.remove('normal');
    document.getElementById('hero')?.classList.remove('hidden');
    document.querySelector('#sideCatalog')?.classList.remove('inverted');

    window.scrollTo({ top: 0, behavior: 'smooth' });

    setTimeout(() => exiting = false, 1800);
  });

  // Отслеживаем вход/выход из snapped
  const observer = new MutationObserver(checkZone);
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  observer.observe(whiteOverlay, { attributes: true, attributeFilter: ['class'] });

  window.addEventListener('resize', () => locked && updateWall());

  // Надёжная страховка
  setInterval(checkZone, 300);

  // Инициализация
  setTimeout(checkZone, 800);
})();



