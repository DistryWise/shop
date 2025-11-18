   document.addEventListener('DOMContentLoaded', () => {
        // === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
        let pos = { y: 0, velocity: 0, startY: 0, startTop: 0 };
        let ticking = false;
        let allProducts = [];
        let sortOrder = 'asc';
        
        

        // === УНИВЕРСАЛЬНЫЙ ОБРАБОТЧИК "ЗАГРУЗИТЬ ЕЩЁ" — ЕДИНСТВЕННЫЙ В МИРЕ! ===
        const loadMoreBtn = document.querySelector('.load-more-btn');
        if (loadMoreBtn) {
            const cleanBtn = loadMoreBtn.cloneNode(true);
            loadMoreBtn.parentNode.replaceChild(cleanBtn, loadMoreBtn);

            cleanBtn.addEventListener('click', () => {
                const grid2 = document.getElementById('productsGrid2');
                let remaining = [];

                if (window.lastSearchResults && window.lastSearchResults.length > 16) {
                    remaining = window.lastSearchResults.slice(16);
                    window.lastSearchResults = null;
                } else {
                    const activeFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
                    let filtered = [...allProducts];
                    if (activeFilter !== 'all') filtered = filtered.filter(p => p.category === activeFilter);
                    filtered.sort((a, b) => sortOrder === 'asc'
                        ? parseFloat(a.price) - parseFloat(b.price)
                        : parseFloat(b.price) - parseFloat(a.price)
                    );
                    remaining = filtered.slice(16);
                }

                remaining.forEach(p => renderCard(p, grid2));
                cleanBtn.style.display = 'none';

                requestAnimationFrame(() => {
                    grid2.querySelectorAll('.product-card').forEach((card, i) => {
                        if (!card.dataset.loaded) {
                            card.dataset.loaded = 'true';
                            card.style.opacity = '0';
                            card.style.transform = 'translateY(30px)';
                            setTimeout(() => {
                                card.style.transition = 'all 0.6s ease';
                                card.style.opacity = '1';
                                card.style.transform = 'translateY(0)';
                            }, i * 80);
                        }
                    });
                });
            });
        }

    // === ГЛОБАЛЬНЫЙ update — ДВИЖОК СКРОЛЛА ===
    window.update = function () {
        pos.y += pos.velocity;
        pos.velocity *= 0.98;

        const content = document.querySelector('.scroll-content');
        const maxScroll = content.scrollHeight - window.innerHeight;

        pos.y = Math.max(0, Math.min(pos.y, maxScroll));
        content.style.transform = `translateY(${-pos.y}px)`;

        if (Math.abs(pos.velocity) > 0.9) {
            requestAnimationFrame(window.update);
        } else {
            ticking = false;
        }
    };

    
        const originalUpdate = update; 
    
        // === ЗАГРУЗКА ТОВАРОВ ===
        async function loadProducts() {
            try {
                const res = await fetch('/api/services');
                allProducts = await res.json();
                renderCategories();
                renderProducts(allProducts);
                renderProductList();
            } catch (err) {
                document.getElementById('productsGrid1').innerHTML = '<p style="text-align:center;color:#333;">Ошибка загрузки</p>';
                document.getElementById('productsGrid2').innerHTML = '<p style="text-align:center;color:#333;">Ошибка загрузки</p>';
            }
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function renderCategories() {
            const categories = [...new Set(allProducts.map(p => p.category))];
            const filterButtons = document.querySelector('.filter-buttons');
            categories.forEach(cat => {
                const btn = document.createElement('button');
                btn.className = 'filter-btn';
                btn.dataset.filter = cat;
                btn.textContent = escapeHtml(cat);
                filterButtons.insertBefore(btn, filterButtons.querySelector('.filter-main-btn'));
            });
        }

        function renderProducts(products) {
            const grid1 = document.getElementById('productsGrid1');
            const grid2 = document.getElementById('productsGrid2');
            const grid2Section = document.getElementById('productsGrid2Section');
            const loadMoreBtn = document.querySelector('.load-more-btn');

            grid1.innerHTML = '';
            grid2.innerHTML = '';

            if (!products.length) {
                grid1.innerHTML = '<p style="text-align:center;color:#333;">Товары не найдены</p>';
                grid2Section.style.display = 'none';
                loadMoreBtn.style.display = 'none';
                return;
            }

            products.slice(0, 8).forEach(p => renderCard(p, grid1));
            const second = products.slice(8, 16);
            if (second.length) {
                grid2Section.style.display = 'flex';
                second.forEach(p => renderCard(p, grid2));
            } else grid2Section.style.display = 'none';

            loadMoreBtn.style.display = products.length > 16 ? 'block' : 'none';
        }

        function renderCard(p, grid) {
            let imageUrls = ['/static/assets/no-image.png'];
            if (p.image_urls) {
                imageUrls = Array.isArray(p.image_urls)
                    ? p.image_urls
                    : p.image_urls.split(',').map(u => u.trim()).filter(Boolean);
                imageUrls = imageUrls.map(u => u.startsWith('/') ? u : `/static/uploads/services/${u}`);
            }

            const card = document.createElement('div');
            card.className = 'product-card';
            card.dataset.productId = p.id;
            card.onclick = () => openModal(p.id);
            card.innerHTML = `
                <img src="${imageUrls[0]}" alt="${escapeHtml(p.title)}" onerror="this.src='/static/assets/no-image.png'">
                <div class="product-info">
                    <div class="product-details">
                        <h3>${escapeHtml(p.title)}</h3>
                        <div class="price">${p.price}</div>
                    </div>
                    <a href="#" class="btn" onclick="event.stopPropagation(); addToCart('${escapeHtml(p.title)}')">Купить</a>
                </div>
            `;
            grid.appendChild(card);
        }

        function renderProductList() {
            const ul = document.getElementById('product-list');
            ul.innerHTML = '';
            allProducts.forEach(p => {
                const li = document.createElement('li');
                li.textContent = escapeHtml(p.title);
                li.onclick = () => {
                    renderProducts([p]);
                    document.querySelector('.filter-main-btn').classList.remove('active');
                };
                ul.appendChild(li);
            });
        }

        // === ПОЛНОСТЬЮ ПЕРЕПИСАННЫЙ ПОИСК БЕЗ ДУБЛЕЙ ===
        document.getElementById('searchInput')?.addEventListener('input', function(e) {
            const query = e.target.value.toLowerCase().trim();
            const grid1 = document.getElementById('productsGrid1');
            const grid2 = document.getElementById('productsGrid2');
            const grid2Section = document.getElementById('productsGrid2Section');
            const loadMoreSection = document.querySelector('.load-more-section');

            if (!query) {
                if (window.searchBackup) {
                    grid1.innerHTML = window.searchBackup.grid1HTML;
                    grid2.innerHTML = window.searchBackup.grid2HTML;
                    grid2Section.style.display = window.searchBackup.grid2SectionDisplay || 'flex';
                    loadMoreSection.style.display = window.searchBackup.loadMoreDisplay || 'flex';
                    document.querySelectorAll('.product-card').forEach(card => {
                        const id = card.dataset.productId;
                        if (id) card.onclick = () => openModal(id);
                    });
                    delete window.searchBackup;
                }
                delete window.lastSearchResults;
                return;
            }

            if (!window.searchBackup) {
                window.searchBackup = {
                    grid1HTML: grid1.innerHTML,
                    grid2HTML: grid2.innerHTML,
                    grid2SectionDisplay: grid2Section.style.display,
                    loadMoreDisplay: loadMoreSection.style.display
                };
            }

            const results = allProducts.filter(p =>
                (p.title || '').toLowerCase().includes(query) ||
                (p.price || '').toString().includes(query) ||
                (p.full_desc || '').toLowerCase().includes(query)
            );

            window.lastSearchResults = results;

            grid1.innerHTML = '';
            grid2.innerHTML = '';
            grid2Section.style.display = 'none';
            loadMoreSection.style.display = 'none';

            if (!results.length) {
                grid1.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:160px 20px;">
                    <p style="font-size:1.8rem;color:#333;">Ничего не найдено</p>
                    <p style="font-size:1.1rem;color:#777;margin-top:12px;">Попробуйте «золото», «бриллиант», «серьги»</p>
                </div>`;
                return;
            }

            results.slice(0, 8).forEach(p => renderCard(p, grid1));
            const second = results.slice(8, 16);
            if (second.length) {
                grid2Section.style.display = 'flex';
                second.forEach(p => renderCard(p, grid2));
            }

            if (results.length > 16) loadMoreSection.style.display = 'flex';

            requestAnimationFrame(() => {
                document.querySelectorAll('.product-card').forEach((c, i) => {
                    c.style.opacity = '0';
                    c.style.transform = 'translateY(30px)';
                    setTimeout(() => {
                        c.style.transition = 'all 0.6s ease';
                        c.style.opacity = '1';
                        c.style.transform = 'translateY(0)';
                    }, i * 80);
                });
            });
        });

        // === ОТКРЫТИЕ МОДАЛКИ ===
        async function openModal(id) {
            try {
                const [pRes, rRes] = await Promise.all([
                    fetch(`/api/service/${id}`),
                    fetch(`/api/service_reviews/${id}`)
                ]);
                const p = await pRes.json();
                const data = await rRes.json();
                let reviews = data.success && Array.isArray(data.reviews) ? data.reviews : [];

                let imageUrls = ['/static/assets/no-image.png'];
                if (p.image_urls) {
                    imageUrls = Array.isArray(p.image_urls)
                        ? p.image_urls
                        : p.image_urls.split(',').map(u => u.trim()).filter(Boolean);
                    imageUrls = imageUrls.map(u => u.startsWith('/') ? u : `/static/uploads/services/${u}`);
                }

                const thumbsHtml = imageUrls.map((url, i) => `
                    <img src="${url}" class="${i === 0 ? 'active' : ''}" 
                         style="width:100px;height:100px;object-fit:cover;border:1px solid #ddd;margin-right:1.2rem;cursor:pointer;"
                         onclick="document.querySelector('.modal-main-img').src=this.src;
                                  document.querySelectorAll('.modal-thumbs img').forEach(t=>t.classList.remove('active'));
                                  this.classList.add('active');">
                `).join('');

                const formatDate = d => {
                    const date = new Date(d);
                    const diff = Date.now() - date;
                    const days = Math.floor(diff / 86400000);
                    if (days === 0) return 'Сегодня';
                    if (days === 1) return 'Вчера';
                    if (days < 7) return `${days} дн. назад`;
                    return date.toLocaleDateString('ru');
                };

                const renderStars = r => Array(5).fill().map((_, i) =>
                    `<i class="fa${i < r ? 's' : 'r'} fa-star" style="color:#FFD700;font-size:0.9rem;"></i>`
                ).join('');

                const reviewsHtml = reviews.length
                    ? reviews.map(r => `
                        <div class="review" style="border-top:1px solid #eee;padding:1rem 0;display:flex;gap:1rem;">
                            <div style="width:40px;height:40px;border-radius:50%;background:#eee;overflow:hidden;">
                                <img src="/static/assets/avatar.png" style="width:100%;height:100%;object-fit:cover;">
                            </div>
                            <div style="flex:1;">
                                <div style="display:flex;justify-content:space-between;">
                                    <strong>${escapeHtml(r.author || 'Аноним')}</strong>
                                    <small style="color:#888;">${formatDate(r.date)}</small>
                                </div>
                                <div style="margin:0.3rem 0;">${renderStars(r.rating)}</div>
                                <p style="font-size:0.9rem;color:#444;">${escapeHtml(r.text)}</p>
                            </div>
                        </div>
                    `).join('')
                    : '<p style="color:#888;text-align:center;padding:1rem;">Отзывов пока нет</p>';

                const avgRating = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '—';

                document.getElementById('modalBody').innerHTML = `
                    <div class="modal-images">
                        <img src="${imageUrls[0]}" class="modal-main-img" onerror="this.src='/static/assets/no-image.png'">
                        <div class="modal-thumbs">${thumbsHtml}</div>
                    </div>
                    <div class="modal-details">
                        <h2>${escapeHtml(p.title)}</h2>
                        <div class="price">${p.price}</div>
                        <p>${escapeHtml(p.full_desc || 'Описание отсутствует')}</p>
                        <a href="#" class="btn" onclick="event.preventDefault(); addToCart('${escapeHtml(p.title)}')">Купить</a>
                    </div>
                `;

                document.getElementById('modalReviews').innerHTML = `
                    <div style="display:flex;align-items:center;gap:0.5rem;margin:1.5rem 0;">
                        <div style="display:flex;">${renderStars(Math.round(avgRating))}</div>
                        <span style="font-weight:600;color:#333;">${avgRating} из 5</span>
                    </div>
                    <h3 style="margin:1rem 0;font-size:1.5rem;">Отзывы</h3>
                    ${reviewsHtml}
                `;

                document.getElementById('productModal').classList.add('active');
                document.getElementById('modalBackdrop').classList.add('active');
                document.body.style.overflow = 'hidden';

            } catch (err) {
                console.error(err);
                alert('Ошибка загрузки');
            }
        }

        window.closeModal = () => {
            document.getElementById('productModal').classList.remove('active');
            document.getElementById('modalBackdrop').classList.remove('active');
            setTimeout(() => document.body.style.overflow = '', 300);
        };

        async function addToCart(title) {
            try {
                await fetch('/api/cart/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ service_title: title, quantity: 1 })
                });
                alert('Добавлено в корзину!');
            } catch (err) {
                alert('Ошибка');
            }
        }

        document.addEventListener('click', e => {
            if (e.target.classList.contains('filter-btn')) {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                applyFilters();
            }
        });

        document.querySelector('.sort-btn').addEventListener('click', () => {
            sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
            document.querySelector('.sort-btn').textContent = `Сортировка (${sortOrder === 'asc' ? '↑' : '↓'} Цена)`;
            applyFilters();
        });

        function applyFilters() {
            const activeFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
            let filtered = [...allProducts];
            if (activeFilter !== 'all') filtered = filtered.filter(p => p.category === activeFilter);
            filtered.sort((a, b) => sortOrder === 'asc'
                ? parseFloat(a.price) - parseFloat(b.price)
                : parseFloat(b.price) - parseFloat(a.price)
            );
            renderProducts(filtered);
        }

        const filterMainBtn = document.querySelector('.filter-main-btn');
        filterMainBtn.addEventListener('click', () => filterMainBtn.classList.toggle('active'));
        document.addEventListener('click', e => {
            if (!filterMainBtn.contains(e.target) && !document.querySelector('.filter-dropdown').contains(e.target)) {
                filterMainBtn.classList.remove('active');
            }
        });

        // === КАРУСЕЛИ ===
        let currentSlideIndex = 0;
        const slides = document.querySelectorAll('.carousel .carousel-slide');
        const indicators = document.querySelectorAll('.carousel .indicator');
        const showSlide = i => {
            slides.forEach(s => s.classList.remove('active'));
            indicators.forEach(ind => ind.classList.remove('active'));
            slides[i].classList.add('active');
            indicators[i].classList.add('active');
        };
        setInterval(() => { currentSlideIndex = (currentSlideIndex + 1) % slides.length; showSlide(currentSlideIndex); }, 5000);
        window.currentSlide = i => { currentSlideIndex = i - 1; showSlide(currentSlideIndex); };
        showSlide(0);

        let currentSlideIndexSecondary = 0;
        const slidesSec = document.querySelectorAll('.secondary-carousel .carousel-slide');
        const indSec = document.querySelectorAll('.secondary-carousel .indicator');
        const showSlideSec = i => {
            slidesSec.forEach(s => s.classList.remove('active'));
            indSec.forEach(ind => ind.classList.remove('active'));
            slidesSec[i].classList.add('active');
            indSec[i].classList.add('active');
        };
        setInterval(() => { currentSlideIndexSecondary = (currentSlideIndexSecondary + 1) % slidesSec.length; showSlideSec(currentSlideIndexSecondary); }, 5000);
        window.currentSlideSecondary = i => { currentSlideIndexSecondary = i - 1; showSlideSec(currentSlideIndexSecondary); };
        showSlideSec(0);

        // === ИНЕРЦИОННЫЙ СКРОЛЛ ===
        (function() {
            const container = document.querySelector('.scroll-container');
            const content = document.querySelector('.scroll-content');

        const onWheel = e => { 
            e.preventDefault(); 
            pos.velocity += e.deltaY * 0.02; 
            if (!ticking) { 
                ticking = true; 
                requestAnimationFrame(window.update); // ГЛОБАЛЬНЫЙ
            } 
        };
            const onTouchStart = e => { pos.startY = e.touches[0].clientY; pos.startTop = pos.y; pos.velocity = 0; };
            const onTouchMove = e => { const delta = pos.startY - e.touches[0].clientY; pos.y = pos.startTop + delta; content.style.transform = `translateY(${-pos.y}px)`; };
            const onTouchEnd = () => { if (Math.abs(pos.velocity) < 1) pos.velocity = 0; };

            container.addEventListener('wheel', onWheel, { passive: false });
            container.addEventListener('touchstart', onTouchStart, { passive: true });
            container.addEventListener('touchmove', onTouchMove, { passive: true });
            container.addEventListener('touchend', onTouchEnd, { passive: true });

            window.scrollToProducts = () => {
                const target = document.getElementById('products-section');
                const targetY = target.getBoundingClientRect().top + pos.y - 80;
                pos.velocity = (targetY - pos.y) * 0.03;
                if (!ticking) { ticking = true; requestAnimationFrame(update); }
            };
        })();

        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
        document.getElementById('modalBackdrop').addEventListener('click', closeModal);



const scrollDownArrow = document.querySelector('.scroll-down'); // ТВОЯ СТРЕЛКА

if (scrollDownArrow) {
    // СКРЫВАЕМ СРАЗУ ПРИ СТАРТЕ — НА ВСЯКИЙ СЛУЧАЙ
    scrollDownArrow.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
}




// ДОПОЛНИТЕЛЬНАЯ СТРАХОВКА: СКРЫВАЕМ СТРЕЛКУ ПРИ ЛЮБОМ СКРОЛЛЕ
document.querySelector('.scroll-container').addEventListener('wheel', () => {
    if (pos.y > 150 && scrollDownArrow) {
        scrollDownArrow.style.opacity = '0';
        scrollDownArrow.style.pointerEvents = 'none';
    }
});

document.querySelector('.scroll-container').addEventListener('touchmove', () => {
    if (pos.y > 150 && scrollDownArrow) {
        scrollDownArrow.style.opacity = '0';
        scrollDownArrow.style.pointerEvents = 'none';
    }
});

        loadProducts();
    });


  document.addEventListener('DOMContentLoaded', () => {
    Promise.all([
      fetch('/api/landing/carousel/main').then(r => r.json()),
      fetch('/api/landing/carousel/services').then(r => r.json())
    ]).then(([mainRaw, servicesRaw]) => {
      const main = JSON.parse(JSON.stringify(mainRaw));
      const services = JSON.parse(JSON.stringify(servicesRaw));

      const mainContainer = document.getElementById('main-carousel-inner');
      const servicesContainer = document.querySelector('.secondary-carousel .carousel-inner');

      mainContainer.innerHTML = '';
      servicesContainer.innerHTML = '';

      // === УНИВЕРСАЛЬНЫЙ РЕНДЕР ===
      function renderSlide(slide, i, isActive, container, kind) {
        const slideEl = document.createElement('div');
        slideEl.className = 'carousel-slide' + (isActive ? ' active' : '');

        // ФОН
        const img = document.createElement('img');
        img.src = slide.background?.url || '/static/assets/fallback.jpg';
        img.alt = `Slide ${i+1}`;
        img.style.cssText = 'width:100%; height:100%; object-fit:cover; position:absolute; top:0; left:0; z-index:1;';
        if (slide.background?.animation && slide.background.animation !== 'none') {
          img.onload = () => img.classList.add('animate__animated', `animate__${slide.background.animation}`);
        }
        slideEl.appendChild(img);

        // === СЛОИ: ТЕКСТ ===
        (slide.layers || []).forEach(layer => {
        if (layer.hidden || layer.type !== 'text') return;
        const text = document.createElement('div');
        text.textContent = layer.content || '';
        const style = layer.style || {};
        text.style.cssText = `
            position: absolute;
            left: ${style.left || '20%'};
            top: ${style.top || '20%'};
            width: ${style.width || 'auto'};
            height: ${style.height || 'auto'};
            font-size: ${style.fontSize || '36px'};
            color: ${style.color || '#fff'};
            font-family: ${style.fontFamily || 'Playfair Display'}, serif;
            text-align: center;
            text-shadow: 0 2px 8px rgba(0,0,0,0.7);
            z-index: 10;
            pointer-events: none;
            transform: ${style.transform || ''};
        `;
        if (style.animation && style.animation !== 'none') {
            text.classList.add('animate__animated', `animate__${style.animation}`);
        }
        slideEl.appendChild(text);
        });

        // === СЛОИ: КАРТИНКИ ===
        (slide.layers || []).forEach(layer => {
        if (layer.hidden || layer.type !== 'image') return;
        const imgLayer = document.createElement('img');
        imgLayer.src = layer.url || '/static/assets/fallback.jpg';
        const style = layer.style || {};
        imgLayer.style.cssText = `
            position: absolute;
            left: ${style.left || '20%'};
            top: ${style.top || '20%'};
            width: ${style.width || '30%'};
            height: ${style.height || '30%'};
            object-fit: contain;
            z-index: 10;
            transform: ${style.transform || ''};
        `;
        slideEl.appendChild(imgLayer);
        });

        // HOTSPOTS — СЧЁТЧИК КЛИКОВ РАБОТАЕТ
        (slide.hotspots || []).forEach(h => {
        if (h.hidden) return;
        const a = document.createElement('a');
        a.href = 'javascript:void(0)';
        a.style.cssText = `
            position: absolute;
            left: ${h.x}%;
            top: ${h.y}%;
            width: ${h.w}%;
            height: ${h.h}%;
            z-index: 20;
            cursor: pointer;
        `;
          a.title = 'Перейти';

          // АНАЛИТИКА + ОТКРЫТИЕ
          a.onclick = (e) => {
            e.preventDefault();
            fetch('/api/landing/click', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                kind: kind,
                slide: i,
                url: h.url
              })
            })
            .then(() => {
              window.open(h.url, '_blank');
            })
            .catch(err => {
              console.error('Ошибка аналитики:', err);
              window.open(h.url, '_blank'); // всё равно открыть
            });
          };

          slideEl.appendChild(a);
        });

        container.appendChild(slideEl);
      }

      // === РЕНДЕР ===
      main.forEach((slide, i) => renderSlide(slide, i, i === 0, mainContainer, 'main'));
      services.forEach((slide, i) => renderSlide(slide, i, i === 0, servicesContainer, 'services'));

      // === КАРУСЕЛИ ===
      initCarousel(mainContainer, 'currentSlide');
      initCarousel(servicesContainer, 'currentSlideSecondary');
    }).catch(err => {
      console.error('Ошибка:', err);
    });
  });

  function initCarousel(container, funcPrefix) {
    const slides = container.querySelectorAll('.carousel-slide');
    const indicators = document.querySelectorAll(`[onclick^="${funcPrefix}"]`);
    let current = 0;

    function show(n) {
      slides.forEach((s, i) => s.classList.toggle('active', i === n));
      indicators.forEach((ind, i) => ind.classList.toggle('active', i === n));
    }

    window[funcPrefix] = function(n) {
      current = n - 1;
      show(current);
    };

    setInterval(() => {
      current = (current + 1) % slides.length;
      show(current);
    }, 5000);
  }



// 2. Получаем элементы по ПРАВИЛЬНЫМ ID
const mainLayer = document.getElementById('mainLayer');
const topLayer = document.getElementById('topLayer');
const flyShadow = document.getElementById('flyShadow');
const bottomLayer = document.getElementById('bottomLayer');
const scrollDownArrow = document.querySelector('.scroll-down');

// === В САМОМ КОНЦЕ svg.js — ПЕРЕОПРЕДЕЛЯЕМ ===
(() => {
    const originalUpdate = window.update;

    window.update = function() {
        // === 1. ОРИГИНАЛЬНЫЙ СКРОЛЛ ===
        originalUpdate();

        // === 2. АНИМАЦИЯ ===
        const posY = pos.y;
        const content = document.querySelector('.scroll-content');
        const maxScroll = content.scrollHeight - window.innerHeight;
        const triggerFooter = maxScroll - 1500;

        const topLayer = document.getElementById('topLayer');
        const bottomLayer = document.getElementById('bottomLayer');
        const mainLayer = document.getElementById('mainLayer');

        // КАРУСЕЛЬ УЛЕТАЕТ
        if (posY > 150) {
            const p = Math.min((posY - 150) / 400, 1);
            topLayer.style.opacity = 1 - p;
            topLayer.style.transform = `translateZ(${-200 * p}px) scale(${1 - p * 0.4})`;
            topLayer.style.pointerEvents = 'none';
        } else {
            topLayer.style.opacity = '1';
            topLayer.style.transform = 'translateZ(0) scale(1)';
            topLayer.style.pointerEvents = 'auto';
            topLayer.style.display = 'block';
            topLayer.style.zIndex = '10';
        }

        // mainLayer НАЛЕТАЕТ
        if (posY > 100) {
            const p = Math.min((posY - 100) / 500, 1);
            mainLayer.style.transform = `translateY(${600 - p * 800}px) translateZ(${100 + p * 400}px) rotateX(${28 - p * 28}deg)`;
        }

        // ФУТЕР ПОЯВЛЯЕТСЯ
        if (posY > triggerFooter || posY >= maxScroll - 100) {
            const p = Math.min((posY - triggerFooter) / 800, 1);
            const e = p < 0.5 ? 4 * p ** 3 : 1 - ((-2 * p + 2) ** 3) / 2;

            bottomLayer.style.opacity = e;
            bottomLayer.style.transform = `
                translateY(${120 - e * 120}px)
                translateZ(${-150 + e * 150}px)
                rotateX(${20 - e * 20}deg)
                scale(${0.9 + e * 0.1})
            `;

            topLayer.style.opacity = '0';
            topLayer.style.pointerEvents = 'none';
            topLayer.style.display = 'none';
            topLayer.style.zIndex = '1';

        } else {
            bottomLayer.style.opacity = '0';
            bottomLayer.style.transform = 'translateY(120px) translateZ(-150px) rotateX(20deg) scale(0.9)';

            if (posY <= 150) {
                topLayer.style.display = 'block';
                topLayer.style.zIndex = '10';
            }
        }
    };
})();