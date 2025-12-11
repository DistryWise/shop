
        // Функция для создания иконок статусов
        function createStatusIcon(type) {
            const size = 60;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#2a2a2a';
            ctx.fillRect(0, 0, size, size);
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#fff';

            switch (type) {
                case 'pending':
                    ctx.beginPath();
                    ctx.arc(size/2, size/2, 20, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(size/2, size/2);
                    ctx.lineTo(size/2, size/2 - 15);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(size/2, size/2, 3, 0, Math.PI * 2);
                    ctx.fillStyle = '#fff';
                    ctx.fill();
                    break;

                case 'processing':
                    const teeth = 8;
                    const r1 = 18, r2 = 22;
                    ctx.beginPath();
                    for (let i = 0; i < teeth; i++) {
                        const angle = (i / teeth) * Math.PI * 2;
                        const x1 = size/2 + r1 * Math.cos(angle);
                        const y1 = size/2 + r1 * Math.sin(angle);
                        const x2 = size/2 + r2 * Math.cos(angle);
                        const y2 = size/2 + r2 * Math.sin(angle);
                        if (i === 0) ctx.moveTo(x2, y2);
                        else ctx.lineTo(x2, y2);
                        ctx.lineTo(x1, y1);
                    }
                    ctx.closePath();
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(size/2, size/2, 10, 0, Math.PI * 2);
                    ctx.stroke();
                    break;

                case 'shipping':
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(15, 25, 30, 15);
                    ctx.fillRect(38, 20, 12, 20);
                    ctx.fillStyle = '#000';
                    ctx.beginPath();
                    ctx.arc(22, 42, 6, 0, Math.PI * 2);
                    ctx.arc(38, 42, 6, 0, Math.PI * 2);
                    ctx.fill();
                    break;

                case 'completed':
                    ctx.beginPath();
                    ctx.moveTo(18, 30);
                    ctx.lineTo(25, 37);
                    ctx.lineTo(42, 20);
                    ctx.lineWidth = 6;
                    ctx.stroke();
                    break;

                case 'cancelled':
                    ctx.beginPath();
                    ctx.moveTo(20, 20);
                    ctx.lineTo(40, 40);
                    ctx.moveTo(40, 20);
                    ctx.lineTo(20, 40);
                    ctx.lineWidth = 6;
                    ctx.strokeStyle = '#ff6b6b';
                    ctx.stroke();
                    break;
            }

            return canvas.toDataURL();
        }

        // Функция для отображения цепочки статусов
        let lastOrderId = null;
        let pollInterval = null;

        window.startOrderChain = async function(orderId) {
            if (pollInterval) clearInterval(pollInterval);
            lastOrderId = orderId;
            const chain = document.getElementById('orderChain');
            if (!chain) return;

            chain.style.display = 'block';
            chain.innerHTML = `<div class="chain-loading">Загружаем статус...</div>`;

            const steps = [
                { status: 'pending',     label: 'В процессе',   type: 'pending' },
                { status: 'processing',  label: 'В обработке',  type: 'processing' },
                { status: 'shipping',    label: 'В доставке',   type: 'shipping' },
                { status: 'completed',   label: 'Выполнено',    type: 'completed' },
                { status: 'cancelled',   label: 'Отменён',      type: 'cancelled' }
            ];

            const poll = async () => {
                try {
                    const res = await fetch(`/api/order_status/${orderId}?t=${Date.now()}`);
                    const data = await res.json();

                    if (!data.status) {
                        chain.innerHTML = `<div class="chain-error">Заказ не найден</div>`;
                        return;
                    }

                    const currentIdx = steps.findIndex(s => s.status === data.status);
                    const isDone = data.completed || data.status === 'cancelled';
                    const icons = steps.map(s => createStatusIcon(s.type));

                    chain.innerHTML = `
                        <div style="display:flex; justify-content:center; align-items:center; gap:1rem; flex-wrap:wrap; padding:0.5rem;">
                            ${steps.map((step, i) => `
                                <div style="text-align:center; position:relative; flex:1; min-width:70px;">
                                    <div class="chain-img-circle ${i === currentIdx ? 'active49' : ''} ${i < currentIdx ? 'done' : ''} ${i === currentIdx + 1 && !isDone ? 'clickable' : ''}"
                                         style="width:60px; height:60px; border-radius:50%; margin:0 auto; overflow:hidden;
                                                border:4px solid ${i <= currentIdx && !isDone ? '#fff' : '#444'};
                                                box-shadow:0 0 15px rgba(0,0,0,0.3); transition:all 0.4s ease;"
                                         ${i === currentIdx + 1 && !isDone ? `onclick="openStatusModal(${orderId}, '${step.status}', '${step.label}')"` : ''}>
                                        <img src="${icons[i]}" alt="${step.label}" style="width:100%; height:100%; object-fit:contain;">
                                    </div>
                                    <div style="margin-top:0.5rem; font-size:0.85rem; color:${i <= currentIdx ? '#fff' : '#888'};">${step.label}</div>
                                    ${i < steps.length - 1 ? `
                                        <div style="position:absolute; top:30px; left:70px; right:-30px; height:4px; 
                                                    background:${i < currentIdx ? '#fff' : '#444'}; z-index:-1; border-radius:2px;"></div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                        <div style="margin-top:1rem; font-size:0.95rem; color:var(--text-secondary); text-align:center;">
                            Заказ #${orderId} — <strong style="color:#fff;">${data.label}</strong>
                        </div>
                        ${data.cancel_reason ? `
                            <div style="color:#ff6b6b; font-size:0.85rem; margin-top:0.5rem; font-style:italic; text-align:center;">
                                Причина отмены: ${data.cancel_reason}
                            </div>
                        ` : ''}
                    `;

                    if (isDone) {
                        clearInterval(pollInterval);
                        setTimeout(() => chain.style.display = 'none', 3000);
                    }
                } catch (e) {
                    console.error('Ошибка загрузки статуса:', e);
                    chain.innerHTML = `<div class="chain-error">Ошибка загрузки</div>`;
                }
            };

            poll();
            pollInterval = setInterval(poll, 3000);
        };

        // Инициализация страницы
        document.addEventListener("DOMContentLoaded", () => {
            setTimeout(() => document.querySelector('.gradient-overlay').classList.add('active'), 100);
            const header = document.querySelector('.admin-header');
            const observer = new IntersectionObserver(e => e.forEach(en => en.isIntersecting && en.target.classList.add('visible')), { threshold: 0.1 });
            observer.observe(header);

            // ФИЛЬТРЫ
            const searchInput = document.getElementById('searchInput');
            const statusFilter = document.getElementById('statusFilter');
            const ordersContainer = document.getElementById('ordersContainer');
            const ordersTitle = document.getElementById('ordersTitle');

            const filterOrders = () => {
                const query = (searchInput.value || '').toLowerCase().trim();
                const status = statusFilter.value || '';

                let visible = 0;
                const orderItems = document.querySelectorAll('.order-item');
                
                if (orderItems.length === 0) {
                    console.warn('No orders found in DOM');
                    ordersTitle.textContent = 'Все заказы (0)';
                    return;
                }

                orderItems.forEach(item => {
                    const id = (item.dataset.id || '').toLowerCase();
                    const user = (item.dataset.user || '').toLowerCase();
                    const itemStatus = (item.dataset.status || '').toLowerCase();
                    const textContent = item.textContent.toLowerCase();

                    const matchesSearch = !query || textContent.includes(query) || id.includes(query) || user.includes(query);
                    const matchesStatus = !status || itemStatus === status;

                    if (matchesSearch && matchesStatus) {
                        item.style.display = 'block';
                        visible++;
                    } else {
                        item.style.display = 'none';
                    }
                });

                const statusText = status ? statusFilter.options[statusFilter.selectedIndex]?.text || 'Выбрано' : 'Все заказы';
                ordersTitle.textContent = `${statusText} (${visible})`;
            };

            if (searchInput) searchInput.addEventListener('input', filterOrders);
            if (statusFilter) statusFilter.addEventListener('change', filterOrders);
            filterOrders();

            const productModal = document.getElementById('productModal');
            if (productModal) {
                productModal.addEventListener('click', (e) => {
                    if (e.target === productModal) {
                        closeModal('productModal');
                    }
                });
            }
        });

        let lastFocusedElement = null;

        function toggleActions(button) {
            const actions = button.nextElementSibling;
            actions.classList.toggle('active');
        }

        function openStatusModal(orderId, newStatus, statusLabel) {
            lastFocusedElement = document.activeElement;
            const modal = document.getElementById('statusModal');
            modal.dataset.orderId = orderId;
            modal.dataset.newStatus = newStatus;
            document.getElementById('statusChangeText').textContent = `Сменить статус на "${statusLabel}"?`;
            document.getElementById('statusPassword').value = '';
            modal.classList.add('active');
            document.getElementById('statusPassword').focus();
        }

        function openCancelModal(orderId) {
            lastFocusedElement = document.activeElement;
            const modal = document.getElementById('cancelModal');
            modal.dataset.orderId = orderId;
            document.getElementById('cancelReason').value = '';
            modal.classList.add('active');
            document.getElementById('cancelReason').focus();
        }

        function openDeleteModal(orderId) {
            lastFocusedElement = document.activeElement;
            const modal = document.getElementById('deleteModal');
            modal.dataset.orderId = orderId;
            modal.classList.add('active');
            document.getElementById('deletePassword').focus();
        }

        function closeModal(id) {
            const modal = document.getElementById(id);
            modal.classList.remove('active');
            modal.querySelector('.error-message').style.display = 'none';
            if (lastFocusedElement) {
                lastFocusedElement.focus();
                lastFocusedElement = null;
            }
            if (id !== 'productModal') {
                const chain = document.getElementById('orderChain');
                if (chain) chain.style.display = 'none';
            }
        }

        async function submitForm(data) {
            const modal = document.getElementById(data.action.replace('delete_order', 'deleteModal').replace('cancel_order', 'cancelModal').replace('set_status', 'statusModal'));
            const errorMessage = modal.querySelector('.error-message');
            errorMessage.style.display = 'none';

            try {
                const response = await fetch('/admin_orders', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
                    },
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                if (result.success) {
                    window.location.reload();
                } else {
                    errorMessage.textContent = result.message || 'Ошибка при выполнении действия';
                    errorMessage.style.display = 'block';
                }
            } catch (error) {
                errorMessage.textContent = 'Ошибка сервера';
                errorMessage.style.display = 'block';
            }
        }

        function submitStatus() {
            const pwd = document.getElementById('statusPassword').value.trim();
            const modal = document.getElementById('statusModal');
            const status = modal.dataset.newStatus;
            if (!pwd) {
                modal.querySelector('.error-message').textContent = 'Введите пароль';
                modal.querySelector('.error-message').style.display = 'block';
                return;
            }
            submitForm({ action: 'set_status', order_id: modal.dataset.orderId, status, password: pwd });
        }

        function submitCancel() {
            const pwd = document.getElementById('cancelPassword').value.trim();
            const reason = document.getElementById('cancelReason').value.trim();
            if (!pwd || !reason) {
                document.getElementById('cancelModal').querySelector('.error-message').textContent = 'Укажите пароль и причину';
                document.getElementById('cancelModal').querySelector('.error-message').style.display = 'block';
                return;
            }
            submitForm({ action: 'cancel_order', order_id: document.getElementById('cancelModal').dataset.orderId, password: pwd, reason });
        }

        function submitDelete() {
            const pwd = document.getElementById('deletePassword').value.trim();
            if (!pwd) {
                document.getElementById('deleteModal').querySelector('.error-message').textContent = 'Введите пароль';
                document.getElementById('deleteModal').querySelector('.error-message').style.display = 'block';
                return;
            }
            submitForm({ action: 'delete_order', order_id: document.getElementById('deleteModal').dataset.orderId, password: pwd });
        }

        function showProductModal(el) {
            lastFocusedElement = document.activeElement;
            const modal = document.getElementById('productModal');
            document.getElementById('modalImg').src = el.dataset.img;
            document.getElementById('modalTitle').textContent = el.dataset.title;
            document.getElementById('modalDesc').innerHTML = el.dataset.desc.replace(/\\n/g, '<br>');
            document.getElementById('modalPrice').textContent = el.dataset.price;
            modal.classList.add('active');
        }

        