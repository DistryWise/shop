# documents.py — бэкенд для /profile/agreements (Договоры и акты)
from flask import Blueprint, render_template, session, jsonify, request, current_app, send_from_directory
import sqlite3
import logging
from datetime import datetime
import os
import uuid

logger = logging.getLogger(__name__)
documents_bp = Blueprint('documents', __name__, template_folder='templates')

DB_PATH = 'database.db'
UPLOAD_FOLDER = os.path.join('static', 'uploads', 'documents')

# Создаём папку, если нет
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def check_admin_password():
    """Возвращает True, если пароль верный, иначе False"""
    data = request.get_json(silent=True) or {}
    admin_password = data.get('admin_password') or request.form.get('admin_password')
    
    # Лучше сразу вынести в env-переменную!
    correct_password = os.getenv('ADMIN_PASSWORD', 'admin123')  # fallback только для dev
    
    return admin_password == correct_password


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# ===============================================
# ИНИЦИАЛИЗАЦИЯ ТАБЛИЦЫ ДОКУМЕНТОВ
# ===============================================
def init_documents_table():
    conn = get_conn()
    try:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('contract', 'act')),  -- договор или акт
                original_pdf_path TEXT NOT NULL,       -- путь к оригинальному PDF
                signed_pdf_path TEXT DEFAULT NULL,     -- путь к подписанному скану (ручная подпись)
                signed_method TEXT DEFAULT NULL CHECK(signed_method IN ('edo', 'manual')), -- способ подписи
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                signed_at DATETIME DEFAULT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        ''')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id)')
        conn.commit()
        print("Таблица documents готова")
    except Exception as e:
        print(f"Ошибка создания таблицы documents: {e}")
    finally:
        conn.close()

init_documents_table()

# ===============================================
# РОУТЫ
# ===============================================

@documents_bp.route('/profile/agreements')
def agreements_page():
    user_authenticated = 'user_id' in session
    return render_template('agreements.html', user_authenticated=user_authenticated)


# API: Получить документы пользователя
@documents_bp.route('/api/user/documents', methods=['GET'])
def get_user_documents():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    user_id = session['user_id']
    conn = get_conn()
    try:
        rows = conn.execute('''
            SELECT 
                id, title, type, original_pdf_path, signed_pdf_path,
                created_at, signed_at, signed_method
            FROM documents 
            WHERE user_id = ?
            ORDER BY created_at DESC
        ''', (user_id,)).fetchall()

        pending = []
        signed = []

        base_url = request.url_root.rstrip('/')

        for r in rows:
            original_filename = os.path.basename(r['original_pdf_path'])
            item = {
                "id": r['id'],
                "title": r['title'],
                "type": r['type'],
                "created_at": r['created_at'],
                "pdf_url": f"/static/uploads/documents/{original_filename}"
            }

            if r['signed_at']:
                item["signed_at"] = r['signed_at']
                # Для подписанных — тоже относительный путь!
                signed_filename = os.path.basename(r['signed_pdf_path']) if r['signed_pdf_path'] else original_filename
                item["pdf_url"] = f"/static/uploads/documents/{signed_filename}"
                signed.append(item)
            else:
                pending.append(item)

        return jsonify({
            "pending": pending,
            "signed": signed
        })
    finally:
        conn.close()


from flask import send_file, abort
from werkzeug.utils import secure_filename
import os

@documents_bp.route('/static/uploads/documents/<filename>')
def uploaded_document(filename):
    # Защита от ../ атак
    safe_filename = os.path.basename(os.path.normpath(filename))
    if safe_filename != filename:
        abort(404)

    filepath = os.path.join(UPLOAD_FOLDER, safe_filename)
    if not os.path.exists(filepath):
        abort(404)

    return send_file(
        filepath,
        mimetype='application/pdf',
        as_attachment=False,      # важно: inline для просмотра в iframe
        conditional=True,         # поддержка Range (для больших PDF)
        max_age=0                 # не кэшировать в dev
        # УБРАЛИ download_name — он ломает встраивание!
    )


# Подпись через ЭДО (простая электронная подпись)
@documents_bp.route('/api/documents/<int:doc_id>/sign', methods=['POST'])
def sign_document_edo(doc_id):
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    user_id = session['user_id']
    conn = get_conn()
    try:
        doc = conn.execute('''
            SELECT id, signed_at FROM documents 
            WHERE id = ? AND user_id = ?
        ''', (doc_id, user_id)).fetchone()

        if not doc:
            return jsonify({"error": "Документ не найден"}), 404
        if doc['signed_at']:
            return jsonify({"error": "Документ уже подписан"}), 400

        conn.execute('''
            UPDATE documents 
            SET signed_at = CURRENT_TIMESTAMP, signed_method = 'edo'
            WHERE id = ?
        ''', (doc_id,))
        conn.commit()

        logger.info(f"Пользователь {user_id} подписал документ {doc_id} через ЭДО")
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Ошибка ЭДО-подписи: {e}")
        return jsonify({"error": "Ошибка сервера"}), 500
    finally:
        conn.close()


# Загрузка ручной подписи (скана)
@documents_bp.route('/api/documents/<int:doc_id>/upload-signed', methods=['POST'])
def upload_signed_scan(doc_id):
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    user_id = session['user_id']

    if 'signed_pdf' not in request.files:
        return jsonify({"error": "Файл не прикреплён"}), 400

    file = request.files['signed_pdf']
    if file.filename == '' or not file.filename.lower().endswith('.pdf'):
        return jsonify({"error": "Только PDF"}), 400

    conn = get_conn()
    try:
        doc = conn.execute('''
            SELECT id, signed_at FROM documents 
            WHERE id = ? AND user_id = ?
        ''', (doc_id, user_id)).fetchone()

        if not doc:
            return jsonify({"error": "Документ не найден"}), 404
        if doc['signed_at']:
            return jsonify({"error": "Документ уже подписан"}), 400

        # Сохраняем файл
        filename = f"signed_{uuid.uuid4().hex}_{file.filename}"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)

        relative_path = os.path.join('static', 'uploads', 'documents', filename).replace('\\', '/')

        conn.execute('''
            UPDATE documents 
            SET signed_at = CURRENT_TIMESTAMP, 
                signed_method = 'manual',
                signed_pdf_path = ?
            WHERE id = ?
        ''', (relative_path, doc_id))
        conn.commit()

        base_url = request.url_root.rstrip('/')
        signed_pdf_url = f"{base_url}/{relative_path}"

        logger.info(f"Пользователь {user_id} загрузил ручную подпись для документа {doc_id}")
        return jsonify({
            "success": True,
            "signed_pdf_url": signed_pdf_url
        })
    except Exception as e:
        logger.error(f"Ошибка загрузки скана: {e}")
        return jsonify({"error": "Ошибка сервера"}), 500
    finally:
        conn.close()


# === АДМИНСКИЕ РОУТЫ ===

# Поиск пользователей по телефону
@documents_bp.route('/api/admin_search_users')
def admin_search_users():
    if not session.get('is_admin'):
        return jsonify([])

    phone = request.args.get('phone', '')
    if len(phone) < 3:
        return jsonify([])

    conn = get_conn()
    try:
        rows = conn.execute("""\
            SELECT id, phone FROM users 
            WHERE phone LIKE ? 
            ORDER BY phone LIMIT 10
        """, (f'%{phone}%',)).fetchall()

        return jsonify([{'id': r['id'], 'phone': r['phone']} for r in rows])
    finally:
        conn.close()


# Создание документа админом (с загрузкой PDF)
@documents_bp.route('/api/admin_create_document', methods=['POST'])
def admin_create_document():
    if not session.get('is_admin'):
        return jsonify({"error": "Forbidden"}), 403
    if not check_admin_password():
        return jsonify({"error": "Неверный пароль"}), 403

    user_id = request.form.get('user_id')
    title = request.form.get('title')
    doc_type = request.form.get('type')  # 'contract' или 'act'

    if not all([user_id, title, doc_type in ['contract', 'act']]):
        return jsonify({"error": "Недостаточно данных"}), 400

    if 'pdf_file' not in request.files:
        return jsonify({"error": "PDF не прикреплён"}), 400

    file = request.files['pdf_file']
    if file.filename == '' or not file.filename.lower().endswith('.pdf'):
        return jsonify({"error": "Только PDF"}), 400

    conn = get_conn()
    try:
        # Проверка пользователя
        if not conn.execute("SELECT 1 FROM users WHERE id = ?", (user_id,)).fetchone():
            return jsonify({"error": "Пользователь не найден"}), 400

        # Сохранение файла
        filename = f"doc_{uuid.uuid4().hex}_{file.filename}"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)

        relative_path = os.path.join('static', 'uploads', 'documents', filename).replace('\\', '/')

        conn.execute('''
            INSERT INTO documents 
            (user_id, title, type, original_pdf_path, created_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ''', (user_id, title, doc_type, relative_path))
        conn.commit()

        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Ошибка создания документа: {e}")
        return jsonify({"error": "Ошибка сервера"}), 500
    finally:
        conn.close()


# Все документы (для админа)
@documents_bp.route('/api/admin_all_documents')
def admin_all_documents():
    if not session.get('is_admin'):
        return jsonify([])

    conn = get_conn()
    try:
        rows = conn.execute('''
            SELECT d.*, u.phone 
            FROM documents d
            JOIN users u ON d.user_id = u.id
            ORDER BY d.created_at DESC
        ''').fetchall()

        base_url = request.url_root.rstrip('/')
        result = []
        for r in rows:
            item = {
                "id": r['id'],
                "title": r['title'],
                "type": r['type'],
                "phone": r['phone'],
                "created_at": r['created_at'],
                "signed_at": r['signed_at'],
                "signed_method": r['signed_method'],
                "pdf_url": f"/static/uploads/documents/{os.path.basename(r['original_pdf_path'])}"
            }
            if r['signed_pdf_path']:
                item["signed_pdf_url"] = f"/static/uploads/documents/{os.path.basename(r['signed_pdf_path'])}"
            result.append(item)

        return jsonify(result)
    finally:
        conn.close()


# Удаление документа админом
@documents_bp.route('/api/admin_delete_document/<int:doc_id>', methods=['DELETE'])
def admin_delete_document(doc_id):
    if not session.get('is_admin'):
        return jsonify({"error": "Forbidden"}), 403
    if not check_admin_password():
        return jsonify({"error": "Неверный пароль"}), 403

    conn = get_conn()
    try:
        doc = conn.execute("SELECT original_pdf_path, signed_pdf_path FROM documents WHERE id = ?", (doc_id,)).fetchone()
        if not doc:
            return jsonify({"error": "Документ не найден"}), 404

        # Удаляем файлы
        for path in [doc['original_pdf_path'], doc['signed_pdf_path']]:
            if path:
                full_path = os.path.join(current_app.root_path, path)
                if os.path.exists(full_path):
                    os.remove(full_path)

        conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
        conn.commit()

        logger.info(f"Админ удалил документ ID={doc_id}")
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Ошибка удаления документа {doc_id}: {e}")
        return jsonify({"error": "Ошибка сервера"}), 500
    finally:
        conn.close()

@documents_bp.route('/api/check_admin_password', methods=['POST'])
def check_admin_password_api():
    if not session.get('is_admin'):
        return jsonify({"error": "Forbidden"}), 403
    if check_admin_password():  # твоя функция
        return jsonify({"valid": True})
    return jsonify({"error": "Invalid password"}), 403