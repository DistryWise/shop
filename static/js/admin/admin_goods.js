'use strict';

let pendingAction = null;

function showFlash(message, type = 'success') {
    const flash = document.createElement('div');
    flash.className = `flash ${type}`;
    flash.textContent = message;
    const container = document.querySelector('.admin-container');
    if (container) {
        container.insertBefore(flash, container.firstChild);
        setTimeout(() => flash.remove(), 5000);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
}

function openPasswordModal() {
    const modal = document.getElementById('passwordModal');
    if (modal) modal.style.display = 'flex';
    const input = document.getElementById('adminPassword');
    if (input) input.focus();
    document.body.style.overflow = 'hidden';
}

function closePasswordModal() {
    const modal = document.getElementById('passwordModal');
    if (modal) modal.style.display = 'none';
    const input = document.getElementById('adminPassword');
    if (input) input.value = '';
    const error = document.getElementById('passwordError');
    if (error) error.style.display = 'none';
    pendingAction = null;
    document.body.style.overflow = '';
}

function prepareAction(actionType, productId = null, formElement = null) {
    let formData = null;
    if (formElement) {
        formData = new FormData(formElement);
        formData.append('action', actionType);
        if (actionType === 'edit') {
            const keepImages = Array.from(document.querySelectorAll('#editCurrentPreview img'))
                .map(img => img.dataset.filename || '');
            document.getElementById('keep_images').value = JSON.stringify(keepImages);
            formData.append('keep_images', document.getElementById('keep_images').value);
        }
    }

    pendingAction = { type: actionType, formData, productId };
    openPasswordModal();
}

async function executePendingAction() {
    const password = document.getElementById('adminPassword')?.value.trim();
    if (!password || !pendingAction) return;

    let formData = pendingAction.formData;
    if (pendingAction.type === 'delete') {
        formData = new FormData();
        formData.append('action', 'delete');
        formData.append('product_id', pendingAction.productId);
    }

    formData.append('password', password);
    formData.append('ajax', '1');

    try {
        const response = await fetch('/admin', { method: 'POST', body: formData });
        const result = await response.json();

        if (result.success) {
            showFlash(result.message || 'Успешно!', 'success');
            closePasswordModal();
            setTimeout(() => location.reload(), 800);
        } else {
            const errorEl = document.getElementById('passwordError');
            if (errorEl) {
                errorEl.textContent = result.message || 'Неверный пароль';
                errorEl.style.display = 'block';
            }
        }
    } catch (err) {
        console.error(err);
        showFlash('Ошибка сети', 'error');
    }
}

function openEditModal(btn) {
    const d = btn.dataset;
    document.getElementById('edit_id').value = d.id || '';
    document.getElementById('edit_title').value = d.title || '';
    document.getElementById('edit_price_rub').value = d.price_rub || '';
    document.getElementById('edit_category').value = d.category || '';
    document.getElementById('edit_brand').value = d.brand || '';
    document.getElementById('edit_description').value = d.description || '';
    document.getElementById('edit_stock').value = d.stock || '-1';
    document.getElementById('edit_in_stock').checked = d.in_stock === '1';

    const currentPreview = document.getElementById('editCurrentPreview');
    currentPreview.innerHTML = '';
    let images = [];
    try { images = JSON.parse(d.images || '[]'); } catch(e) {}

    images.forEach(filename => {
        const div = document.createElement('div');
        div.className = 'image-item';
        div.innerHTML = `
            <img src="/static/uploads/goods/${filename}" data-filename="${filename}">
            <button type="button" class="remove-img" onclick="this.parentNode.remove()">×</button>
        `;
        currentPreview.appendChild(div);
    });

    document.getElementById('editNewPreview').innerHTML = '';
    document.getElementById('editModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function setupDropZone(dropZoneId, previewId, fileInputId) {
    const dropZone = document.getElementById(dropZoneId);
    const preview = document.getElementById(previewId);
    const fileInput = document.getElementById(fileInputId);
    if (!dropZone || !preview || !fileInput) return;

    const handleFiles = (files) => {
        [...files].forEach(file => {
            if (!file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = e => {
                const div = document.createElement('div');
                div.className = 'image-item';
                div.innerHTML = `
                    <img src="${e.target.result}">
                    <button type="button" class="remove-img" onclick="this.parentNode.remove()">×</button>
                `;
                preview.appendChild(div);
            };
            reader.readAsDataURL(file);
        });
    };

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', () => handleFiles(fileInput.files));
}

window.filterProducts = () => {
    const query = (document.getElementById('searchInput')?.value || '').toLowerCase();
    document.querySelectorAll('.product-row').forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
    });
};

document.addEventListener('DOMContentLoaded', () => {
    setupDropZone('addDropZone', 'addPreview', 'addFileInput');
    setupDropZone('editDropZone', 'editNewPreview', 'editFileInput');

    document.getElementById('addSubmitBtn')?.addEventListener('click', () => {
        const form = document.getElementById('addForm');
        if (form && form.checkValidity()) {
            prepareAction('add', null, form);
        } else {
            form?.reportValidity();
        }
    });

    document.getElementById('editSubmitBtn')?.addEventListener('click', () => {
        const form = document.getElementById('editForm');
        if (form && form.checkValidity()) {
            prepareAction('edit', null, form);
        } else {
            form?.reportValidity();
        }
    });

    document.getElementById('adminPassword')?.addEventListener('keypress', e => {
        if (e.key === 'Enter') executePendingAction();
    });
});