# admin_goods.py — финальная безопасная версия

from flask import (
    Blueprint, render_template, request, session, redirect, flash,
    jsonify, current_app
)
import uuid
import os
import json
import re
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

from database_goods import (
    get_conn,           # ← эта функция
    DB_MAIN,            # ← путь к основной БД
    logger,             # ← если используешь логи
    init_goods_db,      # ← если нужно инициализировать при старте
    init_users_db,
    init_cart_db,
    migrate_cart_if_needed,
    get_total_users,
    get_all_feedback
)

admin_goods_bp = Blueprint(
    'admin_goods', __name__,
    template_folder='templates',
    static_folder='static'
)

# ====================== КОНФИГИ ======================
UPLOAD_FOLDER_GOODS = 'static/uploads/goods'
Path(UPLOAD_FOLDER_GOODS).mkdir(parents=True, exist_ok=True)  # создаём папку при старте


# ====================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ======================

def require_admin():
    if not session.get('is_admin'):
        flash('Доступ запрещён', 'error')
        return redirect('/')
    return None


def is_ajax_request():
    """Определяет, является ли запрос AJAX (по заголовкам или параметру ajax=1)"""
    return (
        request.headers.get('X-Requested-With') == 'XMLHttpRequest' or
        request.content_type and 'application/json' in request.content_type or
        request.form.get('ajax') == '1'
    )


def json_response(success: bool, message: str, status: int = 200):
    resp = jsonify({"success": success, "message": message})
    resp.status_code = status if success else (status if status >= 400 else 400)
    return resp


def flash_and_redirect(message: str, category: str = 'success'):
    flash(message, category)
    return redirect('/admin')


def get_upload_dir() -> Path:
    """Безопасно получаем путь к папке загрузок"""
    upload_dir = Path(current_app.root_path) / UPLOAD_FOLDER_GOODS
    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir.resolve()


def safe_unlink(filename: str):
    """Удаляет файл ТОЛЬКО из папки загрузок товаров"""
    if not filename or '/' in filename or '\\' in filename:
        return  # защита от ../ и пустых имён

    try:
        upload_dir = get_upload_dir()
        file_path = (upload_dir / filename).resolve()

        # Критически важно: файл должен быть строго внутри upload_dir
        if not file_path.is_relative_to(upload_dir):
            logger.warning(f"Попытка удалить файл вне разрешённой папки: {filename}")
            return

        if file_path.is_file():
            file_path.unlink()
            logger.info(f"Удалён файл товара: {filename}")
    except Exception as e:
        logger.warning(f"Ошибка при удалении файла {filename}: {e}")


def save_uploaded_images(files_list, max_images: int = 10):
    uploaded = []
    allowed_exts = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'}

    upload_dir = get_upload_dir()

    for file in files_list[:max_images]:
        if not file or not file.filename:
            continue

        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in allowed_exts:
            continue

        filename = f"{uuid.uuid4().hex}{ext}"
        filepath = upload_dir / filename
        file.save(filepath)
        uploaded.append(filename)

    return uploaded


def parse_price(price_raw) -> int | None:
    if not price_raw:
        return None
    price_str = str(price_raw).strip().replace(',', '.')
    if not re.fullmatch(r'\d+(\.\d{1,2})?', price_str):
        return None
    try:
        value = float(price_str)
        return int(round(value * 100)) if value > 0 else None
    except:
        return None


# ====================== ОСНОВНОЙ МАРШРУТ ======================

@admin_goods_bp.route('/admin', methods=['GET', 'POST'])
def admin():
    redirect_resp = require_admin()
    if redirect_resp:
        return redirect_resp

    is_ajax = is_ajax_request()
    conn = get_conn(DB_MAIN)
    products = []

    try:
        if request.method == 'POST':
            # === Проверка пароля ===
            password = request.form.get('password') or (request.get_json(silent=True) or {}).get('password')
            if not password or password != current_app.config['ADMIN_PASSWORD']:
                msg = "Неверный пароль!"
                return json_response(False, msg, 403) if is_ajax else flash_and_redirect(msg, 'error')

            # === Всегда используем request.form и request.files ===
            data = request.form.to_dict()
            files = request.files
            action = data.get('action')

            # === ДОБАВЛЕНИЕ ===
            if action == 'add':
                title = data.get('title', '').strip()
                category = data.get('category', '').strip()
                price_cents = parse_price(data.get('price_rub'))
                description = data.get('description', '').strip() or None
                brand = data.get('brand', '').strip() or None
                in_stock = 1 if data.get('in_stock') in ('on', '1', 'true', 'True') else 0
                stock = max(-1, int(data.get('stock', -1)))

                if not title or not category or price_cents is None:
                    return json_response(False, "Заполните обязательные поля") if is_ajax else flash_and_redirect("Ошибка", 'error')

                uploaded = save_uploaded_images(files.getlist('images'))
                if not uploaded:
                    return json_response(False, "Добавьте хотя бы одно фото") if is_ajax else flash_and_redirect("Добавьте фото", 'error')

                conn.execute('''
                    INSERT INTO products
                    (title, price, description, category, brand, image_filenames, in_stock, stock)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (title, price_cents, description, category, brand, json.dumps(uploaded), in_stock, stock))
                conn.commit()

                return json_response(True, "Товар успешно добавлен!") if is_ajax else flash_and_redirect("Товар добавлен!")

            # === РЕДАКТИРОВАНИЕ ===
            elif action == 'edit':
                pid = data.get('product_id')
                if not pid or not pid.isdigit():
                    return json_response(False, "Неверный ID") if is_ajax else flash_and_redirect("Ошибка", 'error')

                title = data.get('title', '').strip()
                category = data.get('category', '').strip()
                price_cents = parse_price(data.get('price_rub'))
                description = data.get('description', '').strip() or None
                brand = data.get('brand', '').strip() or None
                in_stock = 1 if data.get('in_stock') in ('on', '1', 'true', 'True') else 0
                stock = max(-1, int(data.get('stock', -1)))

                if not title or not category or price_cents is None:
                    return json_response(False, "Заполните обязательные поля") if is_ajax else flash_and_redirect("Ошибка", 'error')

                # Какие изображения оставить
                keep_json = data.get('keep_images', '[]')
                try:
                    keep_list = json.loads(keep_json)
                except:
                    keep_list = []

                new_uploaded = save_uploaded_images(files.getlist('images'), max_images=10)

                # Удаляем старые ненужные
                old_row = conn.execute('SELECT image_filenames FROM products WHERE id = ?', (pid,)).fetchone()
                old_imgs = json.loads(old_row['image_filenames'] or '[]') if old_row else []

                for img in old_imgs:
                    if img not in keep_list:
                        safe_unlink(img)

                final_imgs = [img for img in old_imgs if img in keep_list] + new_uploaded

                conn.execute('''
                    UPDATE products SET
                        title=?, price=?, description=?, category=?, brand=?,
                        image_filenames=?, in_stock=?, stock=?
                    WHERE id=?
                ''', (title, price_cents, description, category, brand,
                      json.dumps(final_imgs), in_stock, stock, int(pid)))
                conn.commit()

                return json_response(True, "Товар обновлён!") if is_ajax else flash_and_redirect("Товар обновлён!")

            # === УДАЛЕНИЕ ===
            elif action == 'delete':
                pid = data.get('product_id')
                if not pid or not pid.isdigit():
                    return json_response(False, "Неверный ID") if is_ajax else flash_and_redirect("Ошибка", 'error')

                row = conn.execute('SELECT image_filenames FROM products WHERE id = ?', (pid,)).fetchone()
                if row and row['image_filenames']:
                    for img in json.loads(row['image_filenames']):
                        safe_unlink(img)

                conn.execute('DELETE FROM products WHERE id = ?', (pid,))
                conn.commit()

                return json_response(True, "Товар удалён") if is_ajax else flash_and_redirect("Товар удалён")

            else:
                return json_response(False, "Неизвестное действие") if is_ajax else flash_and_redirect("Ошибка", 'error')

        # === GET — список товаров ===
        rows = conn.execute('SELECT * FROM products ORDER BY id DESC').fetchall()
        for row in rows:
            p = dict(row)
            imgs = json.loads(p.get('image_filenames') or '[]')
            p['image_urls'] = [f"/static/uploads/goods/{img}" for img in imgs]
            products.append(p)

    except Exception as e:
        conn.rollback()
        logger.error(f"Admin goods error: {e}", exc_info=True)
        msg = "Ошибка сервера"
        return json_response(False, msg, 500) if is_ajax else flash_and_redirect(msg, 'error')
    finally:
        conn.close()

    # Статистика
    try:
        stats_conn = get_conn(DB_MAIN)
        total_orders = stats_conn.execute('SELECT COUNT(*) FROM orders').fetchone()[0]
        total_reviews = stats_conn.execute('SELECT COUNT(*) FROM reviews').fetchone()[0]
        stats_conn.close()
    except:
        total_orders = total_reviews = 0

    return render_template('admin.html',
                           products=products,
                           total_users=get_total_users(),
                           total_orders=total_orders,
                           total_feedback=len(get_all_feedback()),
                           total_reviews=total_reviews)