fetch('/api/check_admin').then(r => r.json()).then(d => { if (!d.is_admin) location.href = '/404'; });

let pendingAction = null;
let pendingFormData = null;
const MAX_PHOTOS = 10;
const MAX_ADD_FILES = 4; // Новая константа для лимита добавления за раз

// === АЛЕРТЫ В СТИЛЕ ZAZA ===
function showAlert(message, type = 'success') {
    document.querySelectorAll('.zaza-toast').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `zaza-toast ${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i>
        <span>${message}</span>
        <button class="close" onclick="this.parentElement.style.transform='translateX(450px)';this.parentElement.style.opacity='0';setTimeout(()=>this.parentElement.remove(),600)">×</button>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity = '1';
    }, 50);

    setTimeout(() => {
        toast.style.transform = 'translateX(450px)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 600);
    }, 4000);
}

// =========================================================================
// === УНИВЕРСАЛЬНЫЙ DRAG & DROP ФОТО ДЛЯ ДОБАВЛЕНИЯ/РЕДАКТИРОВАНИЯ ===
// =========================================================================

function initPhotoUploader(dropZoneId, fileInputId, previewId) {
    const dropZone = document.getElementById(dropZoneId);
    const fileInput = document.getElementById(fileInputId);
    const preview = document.getElementById(previewId);

    if (!dropZone || !fileInput || !preview) return;

    // 1. Обработчики событий DropZone
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
        e.preventDefault(); dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) addFilesToCurrent(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', () => {
        addFilesToCurrent(fileInput.files);
        fileInput.value = ''; 
    });


    // 2. Логика добавления, обработки и лимита файлов
    function addFilesToCurrent(fileList) {
        const newFiles = Array.from(fileList).filter(f => f.type.startsWith('image/')).slice(0, MAX_ADD_FILES);

        if (!newFiles.length && fileList.length > 0) {
            showAlert('Поддерживаются только изображения.', 'error');
            return;
        }
        if (newFiles.length < fileList.length) {
             showAlert(`Можно добавить только до ${MAX_ADD_FILES} фото за раз. Лишние проигнорированы.`, 'info');
        }

        const currentFiles = Array.from(fileInput.files);
        const combinedFiles = [...currentFiles, ...newFiles];

        const uniqueFiles = new Map();
        combinedFiles.forEach(file => {
            const key = `${file.name}_${file.size}_${file.lastModified}`;
            if (!uniqueFiles.has(key)) uniqueFiles.set(key, file);
        });

        const finalFiles = Array.from(uniqueFiles.values()).slice(0, MAX_PHOTOS);
        
        const dt = new DataTransfer();
        finalFiles.forEach(f => dt.items.add(f));
        fileInput.files = dt.files;

        renderPreview(finalFiles);

        if (finalFiles.length === MAX_PHOTOS && uniqueFiles.size > MAX_PHOTOS) {
            showAlert(`Достигнут максимум (${MAX_PHOTOS}) фото. Лишние удалены.`, 'info');
        } else if (newFiles.length > 0) {
            showAlert(`Добавлено ${newFiles.length} фото.`, 'success');
        }
    }


    // 3. Логика отрисовки превью
    function renderPreview(files) {
        preview.innerHTML = '';
        files.forEach((file, i) => {
            const reader = new FileReader();
            reader.onload = e => {
                const item = document.createElement('div');
                item.className = 'image-item';
                item.draggable = true;
                item.dataset.index = i;
                
                const key = `${file.name}_${file.size}_${file.lastModified}`;

                item.innerHTML = `
                    <img src="${e.target.result}" style="width:80px;height:80px;object-fit:cover;border-radius:12px;">
                    ${i === 0 ? '<div class="main-badge">Главная</div>' : ''}
                    <button type="button" class="image-remove" onclick="removePhoto(this, '${fileInputId}')">×</button>
                    <input type="hidden" class="file-key" value="${key}">
                `;
                preview.appendChild(item);
                makePreviewDraggable(preview, fileInput);
            };
            reader.readAsDataURL(file);
        });
    }

    // 4. Удаление фото
    window.removePhoto = function(btn, inputId) {
        const item = btn.parentElement;
        const keyToRemove = item.querySelector('.file-key').value;
        const input = document.getElementById(inputId);
        const files = Array.from(input.files);

        const dt = new DataTransfer();
        
        files.forEach(file => {
             const fileKey = `${file.name}_${file.size}_${file.lastModified}`;
             if (fileKey !== keyToRemove) {
                 dt.items.add(file);
             }
        });

        input.files = dt.files;
        
        const remainingFiles = Array.from(input.files);
        renderPreview(remainingFiles);
        showAlert('Фото удалено', 'success');
    };

    // 5. Логика Drag & Drop внутри превью (обновление fileInput)
    function makePreviewDraggable(preview, fileInput) {
        // Удаляем старые слушатели, чтобы избежать дублирования
        preview.querySelectorAll('.image-item').forEach(item => {
            item.removeEventListener('dragstart', handleDragStart);
            item.addEventListener('dragstart', handleDragStart);
        });
        
        preview.removeEventListener('dragover', handleDragOver);
        preview.addEventListener('dragover', handleDragOver);
        
        preview.removeEventListener('dragend', handleDragEnd);
        preview.addEventListener('dragend', handleDragEnd);
        
        preview.removeEventListener('drop', handleDrop);
        preview.addEventListener('drop', handleDrop);

        let draggedItem = null;

        function handleDragStart(e) {
            draggedItem = e.target.closest('.image-item');
            if (draggedItem) {
                draggedItem.classList.add('dragging');
                const items = Array.from(preview.children);
                const index = items.indexOf(draggedItem);
                e.dataTransfer.setData('text/plain', index.toString());
            }
        }

        function handleDragOver(e) {
            e.preventDefault();
            const draggingEl = preview.querySelector('.dragging');
            const targetEl = e.target.closest('.image-item');
            if (draggingEl && targetEl && draggingEl !== targetEl) {
                const rect = targetEl.getBoundingClientRect();
                const dropBefore = e.clientX < rect.left + rect.width / 2;
                if (dropBefore) {
                    preview.insertBefore(draggingEl, targetEl);
                } else {
                    preview.insertBefore(draggingEl, targetEl.nextSibling);
                }
            }
        }

        function handleDragEnd() {
            preview.querySelectorAll('.image-item').forEach(el => el.classList.remove('dragging'));
            draggedItem = null;
        }

        function handleDrop(e) {
            e.preventDefault();
            
            // Получаем новый порядок DOM-элементов
            const items = Array.from(preview.children);
            const newOrderKeys = items.map(item => item.querySelector('.file-key').value);

            // Получаем старый массив файлов
            const oldFiles = Array.from(fileInput.files);
            const keyToFileMap = new Map(oldFiles.map(f => [`${f.name}_${f.size}_${f.lastModified}`, f]));

            // Создаем новый массив файлов в правильном порядке
            const newFiles = newOrderKeys.map(key => keyToFileMap.get(key));

            // Обновляем input.files
            const dt = new DataTransfer();
            newFiles.filter(f => f).forEach(f => dt.items.add(f));
            fileInput.files = dt.files;

            // Обновляем бейдж "Главная"
            items.forEach((item, i) => {
                item.querySelectorAll('.main-badge').forEach(b => b.remove());
                if (i === 0) item.insertAdjacentHTML('beforeend', '<div class="main-badge">Главная</div>');
            });
            
            showAlert('Порядок фото изменён', 'success');
        }
    }
}

// Инициализация загрузчиков
initPhotoUploader('addDropZone', 'addFileInput', 'addPreview');
initPhotoUploader('editDropZone', 'editFileInput', 'editNewPreview');

// =========================================================================
// === DRAG & DROP ТОВАРОВ В ТАБЛИЦЕ ===
// =========================================================================

const tbody = document.getElementById('productsTableBody');
let draggedRow = null;

if (tbody) {
    tbody.addEventListener('dragstart', e => {
        const row = e.target.closest('.product-row');
        if (!row) return;
        draggedRow = row;
        row.style.opacity = '0.5';
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', row.dataset.id);
    });
    tbody.addEventListener('dragend', () => { if (draggedRow) draggedRow.style.opacity = '1'; draggedRow = null; });
    tbody.addEventListener('dragover', e => e.preventDefault());
    tbody.addEventListener('drop', async e => {
        e.preventDefault();
        if (!draggedRow) return;
        
        const targetRow = e.target.closest('.product-row');
        if (!targetRow || targetRow === draggedRow) return;

        const rect = targetRow.getBoundingClientRect();
        const dropBefore = e.clientY < rect.top + rect.height / 2;

        if (dropBefore) {
             tbody.insertBefore(draggedRow, targetRow);
        } else {
             tbody.insertBefore(draggedRow, targetRow.nextSibling);
        }

        const newOrder = Array.from(tbody.querySelectorAll('.product-row')).map(r => r.dataset.id);

        const fd = new FormData();
        fd.append('action', 'reorder_goods');
        fd.append('order', JSON.stringify(newOrder));

        try {
            const resp = await fetch('/admin', { method: 'POST', body: fd });
            if (resp.ok) showAlert('Порядок товаров сохранён', 'success');
            else showAlert('Ошибка сохранения порядка', 'error');
        } catch (err) {
            showAlert('Нет связи с сервером', 'error');
        }
    });

    document.querySelectorAll('.product-row').forEach(row => {
        row.draggable = true;
        row.style.cursor = 'grab';
        row.title = 'Перетащите, чтобы изменить порядок';
    });
}

// =========================================================================
// === ЛОГИКА ДЕЙСТВИЯ И ОБРАБОТКИ ФОРМ ===
// =========================================================================

// === ПОДГОТОВКА ДЕЙСТВИЯ ===
function prepareAction(action, productId = null) {
    pendingAction = action;
    pendingFormData = new FormData();

    if (action === 'add') {
        const form = document.getElementById('addForm');
        
        const title = form.title.value.trim();
        const price = parseFloat(form.price_rub.value);
        const category = form.category.value.trim();

        if (!title) { showAlert('Заполните поле «Название»', 'error'); form.title.focus(); return; }
        if (!price || price <= 0) { showAlert('Укажите корректную цену больше 0', 'error'); form.price_rub.focus(); return; }
        if (!category) { showAlert('Заполните поле «Категория»', 'error'); form.category.focus(); return; }
        
        pendingFormData = new FormData(form);
        pendingFormData.append('action', 'add');
        pendingFormData.append('price', Math.round(price * 100));

    } else if (action === 'edit') {
        const edit_id = document.getElementById('edit_id').value;
        const edit_price_rub = document.getElementById('edit_price_rub').value;
        
        pendingFormData.append('action', 'edit');
        pendingFormData.append('product_id', edit_id);
        pendingFormData.append('title', document.getElementById('edit_title').value.trim());
        pendingFormData.append('price_rub', edit_price_rub);
        pendingFormData.append('price', Math.round(parseFloat(edit_price_rub || 0) * 100));
        pendingFormData.append('category', document.getElementById('edit_category').value.trim());
        pendingFormData.append('brand', document.getElementById('edit_brand').value.trim());
        pendingFormData.append('description', document.getElementById('edit_description').value);
        pendingFormData.append('stock', document.getElementById('edit_stock').value);
        pendingFormData.append('in_stock', document.getElementById('edit_in_stock').checked ? 1 : 0);
        
        // Сохраняем текущие (keep_images) в их новом порядке
        document.querySelectorAll('#editCurrentPreview input[name="keep_images"]').forEach(i => pendingFormData.append('keep_images', i.value));
        
        // Добавляем новые
        for (let file of document.getElementById('editFileInput').files) pendingFormData.append('images', file);

    } else if (action === 'delete') {
        pendingFormData.append('action', 'delete');
        pendingFormData.append('product_id', productId);
    }

    document.getElementById('passwordModal').classList.add('active');
    document.getElementById('adminPassword').value = '';
    document.getElementById('adminPassword').focus();
    document.getElementById('passwordError').style.display = 'none';
}


// === ВЫПОЛНЕНИЕ ДЕЙСТВИЯ С ПАРОЛЕМ ===
async function executePendingAction() {
    const password = document.getElementById('adminPassword').value.trim();
    if (!password) return;

    const fd = new FormData();
    for (let [k, v] of pendingFormData.entries()) if (k !== 'password') fd.append(k, v);
    fd.append('password', password);

    try {
        const resp = await fetch('/admin', { 
            method: 'POST', 
            body: fd,
            redirect: 'manual' 
        });

        if (resp.ok) {
             const msg = pendingAction === 'add' ? 'Товар успешно добавлен!' :
                                 pendingAction === 'edit' ? 'Изменения сохранены!' :
                                 'Товар удалён!';
             showAlert(msg, 'success');
             closeModal('passwordModal');
             setTimeout(() => location.reload(), 1200);
        } else {
            document.getElementById('passwordError').style.display = 'block';
            document.getElementById('adminPassword').value = '';
            document.getElementById('adminPassword').focus();
            showAlert('Неверный пароль администратора', 'error');
        }

    } catch (err) {
        document.getElementById('passwordError').style.display = 'block';
        showAlert('Нет связи с сервером', 'error');
    }
}


// === ПРИВЯЗКА ФОРМ ===
document.getElementById('addForm').onsubmit = function(e) {
    e.preventDefault();
    prepareAction('add');
};

document.querySelector('#editModal .btn-zaza-primary').onclick = () => {
    const edit_title = document.getElementById('edit_title').value.trim();
    const edit_price_rub = parseFloat(document.getElementById('edit_price_rub').value);
    const edit_category = document.getElementById('edit_category').value.trim();

    if (!edit_title) { showAlert('Заполните поле «Название»', 'error'); document.getElementById('edit_title').focus(); return; }
    if (!edit_price_rub || edit_price_rub <= 0) { showAlert('Укажите корректную цену больше 0', 'error'); document.getElementById('edit_price_rub').focus(); return; }
    if (!edit_category) { showAlert('Заполните поле «Категория»', 'error'); document.getElementById('edit_category').focus(); return; }

    prepareAction('edit');
};

// === ОТКРЫТИЕ МОДАЛКИ РЕДАКТИРОВАНИЯ ===
function openEditModal(btn) {
    const d = btn.dataset;

    // 1. Основные поля
    document.getElementById('edit_id').value = d.id;
    document.getElementById('edit_title').value = (d.title || '').replace(/&quot;/g, '"');
    document.getElementById('edit_price_rub').value = d.price_rub || '';
    document.getElementById('edit_category').value = (d.category || '').replace(/&quot;/g, '"');
    document.getElementById('edit_brand').value = (d.brand || '').replace(/&quot;/g, '"');
    document.getElementById('edit_description').value = (d.description || '').replace(/&quot;/g, '"');
    document.getElementById('edit_stock').value = d.stock || '-1';
    document.getElementById('edit_in_stock').checked = d.in_stock === '1';

    // 2. === ТЕКУЩИЕ ФОТО (keep_images) ===
    const currentPreview = document.getElementById('editCurrentPreview');
    currentPreview.innerHTML = '';
    
    let images = [];
    try {
        const raw = (d.images || '[]').replace(/&quot;/g, '"');
        images = JSON.parse(raw);
    } catch (e) {
        console.error('Не удалось распарсить фото товара:', e);
    }

    if (Array.isArray(images) && images.length > 0) {
        images.forEach((img, i) => {
            const div = document.createElement('div');
            div.className = 'image-item';
            div.draggable = true;
            div.innerHTML = `
                <img src="static/uploads/${img}" style="width:80px;height:80px;object-fit:cover;border-radius:12px;">
                ${i === 0 ? '<div class="main-badge">Главная</div>' : ''}
                <input type="hidden" name="keep_images" value="${img}">
                <button type="button" class="image-remove" onclick="this.parentElement.remove()">×</button>
            `;
            currentPreview.appendChild(div);
        });
        makePreviewDraggableForExisting(currentPreview);
    }

    // 3. Новые фото
    document.getElementById('editNewPreview').innerHTML = '';
    const dt = new DataTransfer();
    document.getElementById('editFileInput').files = dt.files;

    // 4. ОТКРЫВАЕМ МОДАЛКУ
    document.getElementById('editModal').classList.add('active');
}

/**
 * Активирует Drag & Drop для уже загруженных фото 
 */
function makePreviewDraggableForExisting(preview) {
    let draggedItem = null;
    
    // Переназначаем слушатели
    preview.querySelectorAll('.image-item').forEach(item => {
        item.removeEventListener('dragstart', handleDragStart);
        item.addEventListener('dragstart', handleDragStart);
    });
    
    preview.removeEventListener('dragover', handleDragOver);
    preview.addEventListener('dragover', handleDragOver);
    
    preview.removeEventListener('dragend', handleDragEnd);
    preview.addEventListener('dragend', handleDragEnd);
    
    preview.removeEventListener('drop', handleDrop);
    preview.addEventListener('drop', handleDrop);

    function handleDragStart(e) {
        draggedItem = e.target.closest('.image-item');
        if (draggedItem) draggedItem.classList.add('dragging');
    }

    function handleDragOver(e) { 
        e.preventDefault(); 
        const draggingEl = preview.querySelector('.dragging');
        const targetEl = e.target.closest('.image-item');
        if (draggingEl && targetEl && draggingEl !== targetEl) {
            const rect = targetEl.getBoundingClientRect();
            const dropBefore = e.clientX < rect.left + rect.width / 2;
            if (dropBefore) {
                preview.insertBefore(draggingEl, targetEl);
            } else {
                preview.insertBefore(draggingEl, targetEl.nextSibling);
            }
        }
    }

    function handleDragEnd() { preview.querySelectorAll('.image-item').forEach(el => el.classList.remove('dragging')); draggedItem = null; }

    function handleDrop(e) {
        e.preventDefault();
        
        // Обновляем бейдж "Главная" и порядок
        preview.querySelectorAll('.main-badge').forEach(b => b.remove());
        const items = Array.from(preview.children);

        if (items.length > 0) {
            // Главным становится первый элемент в DOM
            items[0].insertAdjacentHTML('beforeend', '<div class="main-badge">Главная</div>');
        }
        
        // Порядок скрытых input[name="keep_images"] теперь соответствует порядку в DOM
        // Этого достаточно, т.к. при save (prepareAction('edit')) мы считываем их в prepareAction

        showAlert('Порядок сохранённых фото изменён', 'success');
    }
}


// === МОДАЛЬНЫЕ ОКНА И ЗАКРЫТИЕ ===
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
function closeProductDetail() { 
    const detail = document.getElementById('productDetail');
    if (detail) detail.classList.remove('active'); 
    document.querySelectorAll('.product-row').forEach(r => r.classList.remove('active'));
}

document.addEventListener('click', e => {
    const detail = document.getElementById('productDetail');
    if (detail && detail.classList.contains('active') && !e.target.closest('.product-detail > .detail-grid') && !e.target.closest('.product-row')) {
        closeProductDetail();
    }
    ['editModal', 'passwordModal'].forEach(id => {
        const modal = document.getElementById(id);
        if (modal && modal.classList.contains('active') && !e.target.closest('.modal')) {
            closeModal(id);
        }
    });
});


// =========================================================================
// === КАРТОЧКА ТОВАРА ===
// =========================================================================

function showProductDetail(row) {
    try {
        const cells = row.cells;
        const detail = document.getElementById('productDetail');
        if (!detail) return;

        // 1. ТЕКСТОВАЯ ЧАСТЬ
        document.getElementById('detailTitle').textContent = cells[1].querySelector('div')?.textContent || '—';
        document.getElementById('detailPrice').textContent = cells[2].textContent || '—';
        document.getElementById('detailCategoryBrand').innerHTML = cells[3].innerHTML || '—';
        document.getElementById('detailStock').textContent = 'На складе: ' + (cells[4].textContent || '—');
        document.getElementById('detailDescription').textContent = 
             cells[1].querySelector('div:nth-child(2)')?.textContent || 'Нет описания';


        // 2. ФОТО и ГАЛЕРЕЯ
        const imagesDiv = document.getElementById('detailImages');
        imagesDiv.innerHTML = '';
        
        const editBtn = row.querySelector('.action-btn.edit');
        let images = [];
        if (editBtn?.dataset?.images) {
            try {
                const raw = editBtn.dataset.images.replace(/&quot;/g, '"');
                images = JSON.parse(raw);
            } catch (e) { console.warn('Не распарсили фото', e); }
        }

        if ((!images || images.length === 0) && cells[0].querySelector('img')?.src) {
            const src = cells[0].querySelector('img').src;
            const match = src.match(/\/uploads\/(.+)$/);
            if (match) images = [match[1]];
        }

        if (!images || images.length === 0) {
            imagesDiv.innerHTML = '<div style="width:320px;height:160px;background:#222;border-radius:16px;display:flex;align-items:center;justify-content:center;color:#666;font-size:1rem;">Нет фото</div>';
            detail.classList.add('active');
            row.classList.add('active');
            return;
        }

        // ГАЛЕРЕЯ С ПЕРЕКЛЮЧЕНИЕМ
        const galleryWrapper = document.createElement('div');
        galleryWrapper.style.cssText = `
            position: relative;
            width: 100%;
            max-width: 460px;
            aspect-ratio: 1 / 1;
            border-radius: 20px;
            overflow: hidden;
            border: 1.5px solid #333;
            box-shadow: 0 15px 50px rgba(0,0,0,0.7);
            background: #000;
        `;

        const mainImg = document.createElement('img');
        mainImg.id = 'mainDetailImg';
        mainImg.src = `static/uploads/${images[0]}`;
        mainImg.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: contain;
            transition: opacity 0.4s ease;
        `;
        galleryWrapper.appendChild(mainImg);

        if (images.length > 1) {
            const thumbsContainer = document.createElement('div');
            thumbsContainer.style.cssText = `
                position: absolute;
                bottom: 0; left: 0; right: 0;
                background: linear-gradient(transparent, rgba(0,0,0,0.8));
                padding: 12px 8px 8px;
                display: flex;
                gap: 6px;
                justify-content: center;
            `;

            images.slice(0, 4).forEach((filename, index) => {
                const thumb = document.createElement('div');
                thumb.textContent = index + 1;
                thumb.style.cssText = `
                    width: 32px; height: 32px;
                    border-radius: 8px;
                    background: ${index === 0 ? '#fff' : 'rgba(255,255,255,0.2)'};
                    color: ${index === 0 ? '#000' : '#fff'};
                    font-weight: 600;
                    font-size: 0.9rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    backdrop-filter: blur(4px);
                `;

                thumb.onclick = (e) => {
                    e.stopPropagation();
                    mainImg.style.opacity = '0';
                    setTimeout(() => {
                        mainImg.src = `static/uploads/${images[index]}`;
                        mainImg.style.opacity = '1';
                    }, 200);

                    thumbsContainer.querySelectorAll('div').forEach((t, i) => {
                        t.style.background = i === index ? '#fff' : 'rgba(255,255,255,0.2)';
                        t.style.color = i === index ? '#000' : '#fff';
                    });
                };

                thumbsContainer.appendChild(thumb);
            });

            if (images.length > 4) {
                const more = document.createElement('div');
                more.textContent = `+${images.length - 4}`;
                more.style.cssText = `
                    width: 32px; height: 32px;
                    border-radius: 8px;
                    background: rgba(255,255,255,0.15);
                    color: #fff;
                    font-weight: 600;
                    font-size: 0.8rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                `;
                more.onclick = (e) => {
                    e.stopPropagation();
                    openFullscreenGallery(images, 4);
                };
                thumbsContainer.appendChild(more);
            }

            galleryWrapper.appendChild(thumbsContainer);
        }

        mainImg.onclick = () => openFullscreenGallery(images, 0);

        imagesDiv.appendChild(galleryWrapper);


        // Активация карточки
        document.querySelectorAll('.product-row').forEach(r => r.classList.remove('active'));
        row.classList.add('active');
        detail.classList.add('active');

    } catch (err) {
        console.error('Ошибка в showProductDetail:', err);
    }
}


// =========================================================================
// === ПОИСК + ПАГИНАЦИЯ ===
// =========================================================================

function filterProducts() {
    const term = document.getElementById('searchInput')?.value.toLowerCase();
    const rows = Array.from(document.querySelectorAll('.product-row'));
    if (!term) {
        rows.forEach(row => row.style.display = '');
        renderPagination(rows);
        return;
    }
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
    });
    renderPagination(rows.filter(r => r.style.display !== 'none'));
}

function renderPagination(visibleRows) {
    const total = visibleRows.length;
    const itemsPerPage = 15;
    const pages = Math.ceil(total / itemsPerPage);
    const container = document.getElementById('pagination');
    if (!container) return;

    container.innerHTML = '';
    
    if (pages <= 1) {
        visibleRows.forEach(r => r.style.display = '');
        return;
    }
    
    for (let i = 1; i <= pages; i++) {
        const btn = document.createElement('button');
        btn.className = 'page-btn';
        btn.textContent = i;
        btn.onclick = () => {
            document.querySelectorAll('.page-btn.active')?.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            visibleRows.forEach((r, idx) => {
                r.style.display = (idx >= (i-1)*itemsPerPage && idx < i*itemsPerPage) ? '' : 'none';
            });
        };
        if (i === 1) btn.classList.add('active');
        container.appendChild(btn);
    }
    visibleRows.forEach((r, idx) => r.style.display = idx < itemsPerPage ? '' : 'none');
}

document.getElementById('searchInput')?.addEventListener('input', filterProducts);


// =========================================================================
// === ПОЛНОЭКРАННАЯ ГАЛЕРЕЯ ===
// =========================================================================

function openFullscreenGallery(images, startIndex = 0) {
    const existing = document.getElementById('fullscreenGallery');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'fullscreenGallery';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.98); z-index: 9999;
        display: flex; align-items: center; justify-content: center;
        opacity: 0; transition: opacity 0.4s ease;
        cursor: zoom-out;
    `;

    overlay.innerHTML = `
        <button style="position:absolute;top:20px;right:20px;background:none;border:none;color:white;font-size:3.5rem;cursor:pointer;z-index:10;opacity:0.8;" onclick="closeFullscreenGallery()">×</button>
        <button id="prevBtn" style="position:absolute;left:30px;top:50%;transform:translateY(-50%);background:none;border:none;color:white;font-size:3rem;cursor:pointer;z-index:10;opacity:0.8;" onclick="navigateGallery(-1)">❮</button>
        <button id="nextBtn" style="position:absolute;right:30px;top:50%;transform:translateY(-50%);background:none;border:none;color:white;font-size:3rem;cursor:pointer;z-index:10;opacity:0.8;" onclick="navigateGallery(1)">❯</button>
        <img id="fullscreenImg" src="static/uploads/${images[startIndex]}" style="max-width:90%;max-height:90%;object-fit:contain;">
    `;
    document.body.appendChild(overlay);

    let currentIndex = startIndex;
    const imgElement = document.getElementById('fullscreenImg');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    function updateGallery() {
        imgElement.style.opacity = '0';
        setTimeout(() => {
            imgElement.src = `static/uploads/${images[currentIndex]}`;
            imgElement.style.opacity = '1';
            prevBtn.style.display = currentIndex === 0 ? 'none' : 'block';
            nextBtn.style.display = currentIndex === images.length - 1 ? 'none' : 'block';
        }, 200);
    }
    updateGallery();

    window.navigateGallery = (direction) => {
        const newIndex = currentIndex + direction;
        if (newIndex >= 0 && newIndex < images.length) {
            currentIndex = newIndex;
            updateGallery();
        }
    };
    
    // Закрытие при клике вне картинки
    overlay.onclick = (e) => {
        if (e.target.id === 'fullscreenGallery') closeFullscreenGallery();
    };

    setTimeout(() => overlay.style.opacity = '1', 50);

    window.closeFullscreenGallery = () => {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 400);
    };  
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.product-row').forEach(row => {
        row.addEventListener('click', function(e) {
            if (e.target.closest('.action-buttons') || e.target.closest('.action-btn')) {
                return;
            }
            showProductDetail(this);
        });
    });
});