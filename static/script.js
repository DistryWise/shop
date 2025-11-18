// script.js
document.addEventListener('DOMContentLoaded', () => {
    // === ИНИЦИАЛИЗАЦИЯ КАРУСЕЛЕЙ ===
    document.querySelectorAll('.carousel-container').forEach(container => {
        const slides = container.querySelectorAll('.carousel-slide');
        const prevBtn = container.parentElement.querySelector('.carousel-prev');
        const nextBtn = container.parentElement.querySelector('.carousel-next');
        const dotsContainer = container.parentElement.querySelector('.carousel-dots');
        let currentIndex = 0;
        let autoPlayInterval = null;

        // Создание точек
        slides.forEach((_, i) => {
            const dot = document.createElement('div');
            dot.classList.add('dot');
            if (i === 0) dot.classList.add('active');
            dot.addEventListener('click', () => goToSlide(i));
            dotsContainer.appendChild(dot);
        });
        const dots = dotsContainer.querySelectorAll('.dot');

        // Показ слайда
        function showSlide(index) {
            slides.forEach((slide, i) => {
                slide.classList.toggle('active', i === index);
            });
            dots.forEach((dot, i) => {
                dot.classList.toggle('active', i === index);
            });
            currentIndex = index;
        }

        // Переход к слайду
        function goToSlide(n) {
            const newIndex = (n + slides.length) % slides.length;
            showSlide(newIndex);
            resetAutoPlay();
        }

        // Автопрокрутка (только для hero-carousel)
        function startAutoPlay() {
            if (container.closest('.hero-carousel')) {
                autoPlayInterval = setInterval(() => {
                    goToSlide(currentIndex + 1);
                }, 5000);
            }
        }

        function resetAutoPlay() {
            if (autoPlayInterval) clearInterval(autoPlayInterval);
            startAutoPlay();
        }

        // Обработчики кнопок
        if (prevBtn) prevBtn.addEventListener('click', () => goToSlide(currentIndex - 1));
        if (nextBtn) nextBtn.addEventListener('click', () => goToSlide(currentIndex + 1));

        // Инициализация
        showSlide(0);
        startAutoPlay();
    });

    // === FAQ АККОРДЕОН ===
    document.querySelectorAll('.faq-question').forEach(question => {
        question.addEventListener('click', () => {
            const answer = question.nextElementSibling;
            const icon = question.querySelector('i');
            const isActive = question.classList.contains('active');

            // Закрываем все другие
            document.querySelectorAll('.faq-question').forEach(q => {
                q.classList.remove('active');
                q.querySelector('i').classList.replace('fa-minus', 'fa-plus');
                q.nextElementSibling.classList.remove('active');
            });

            // Открываем текущий, если не был активен
            if (!isActive) {
                question.classList.add('active');
                icon.classList.replace('fa-plus', 'fa-minus');
                answer.classList.add('active');
            }
        });
    });

    // === ФОРМА ЗАЯВКИ ===
    const form = document.getElementById('contactForm');
    const processingMsg = document.getElementById('processingMsg');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const ageCheck = document.getElementById('ageCheck');
            if (!ageCheck.checked) {
                alert('Подтвердите, что вам исполнилось 18 лет');
                return;
            }

            processingMsg.style.display = 'block';

            const formData = {
                name: form[0].value.trim(),
                email: form[1].value.trim(),
                phone: form[2].value.trim()
            };

            try {
                // Замени '/submit' на свой endpoint при необходимости
                const response = await fetch('/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });

                if (response.ok) {
                    setTimeout(() => {
                        processingMsg.style.display = 'none';
                        form.reset();
                        alert('Заявка успешно отправлена!');
                    }, 1500);
                } else {
                    throw new Error('Ошибка сервера');
                }
            } catch (error) {
                setTimeout(() => {
                    processingMsg.style.display = 'none';
                    alert('Произошла ошибка. Попробуйте позже.');
                    console.error(error);
                }, 1500);
            }
        });
    }

    // === КОРЗИНА ===
    const cartCount = document.querySelector('.cart-count');
    document.querySelectorAll('.add-to-cart, .order-service').forEach(btn => {
        btn.addEventListener('click', () => {
            const current = parseInt(cartCount.textContent) || 0;
            cartCount.textContent = current + 1;
            cartCount.style.transform = 'scale(1.3)';
            setTimeout(() => cartCount.style.transform = 'scale(1)', 200);
        });
    });

    // === ДОБАВИТЬ АНИМАЦИЮ ПРИ ПРОКРУТКЕ (опционально) ===
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.section').forEach(sec => {
        sec.style.opacity = '0';
        sec.style.transform = 'translateY(20px)';
        sec.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(sec);
    });
});