# profile.py — ЧИСТАЯ ВЕРСИЯ 2025, в стиле твоего проекта (sqlite3, как у бога)

from flask import (
    Blueprint, render_template, session, redirect, request,
    jsonify, send_from_directory, current_app, abort
)
from datetime import datetime
import os
import re
import sqlite3
import json
import secrets  # ← ЭТОТ ИМПОРТ ТЫ ЗАБЫЛ!
import logging
from dispatch import normalize_phone
logger = logging.getLogger(__name__)
profile_bp = Blueprint('profile', __name__, template_folder='templates')
from flask_wtf.csrf import CSRFProtect, generate_csrf

@profile_bp.route('/api/csrf-token')
def get_csrf():
    return jsonify({"csrf_token": generate_csrf()})

# Это важно! Подключаем уже существующий CSRFProtect из главного app
csrf = CSRFProtect()

# Путь к основной базе (та же, где users)
DB_PATH = 'database.db'

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# ===============================================
# ИНИЦИАЛИЗАЦИЯ ТАБЛИЦЫ — ТОЧНО КАК У ТЕБЯ В database_goods.py
# ===============================================
def init_company_db():
    conn = get_conn()
    try:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS company_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE NOT NULL,
                full_name TEXT,
                short_name TEXT,
                inn TEXT,
                ogrn TEXT,
                kpp TEXT,
                okpo TEXT,
                okved TEXT,
                legal_address TEXT,
                actual_address TEXT,
                activity TEXT,
                budget TEXT,
                director TEXT,
                company_status TEXT DEFAULT 'Действующая',
                tax_system TEXT DEFAULT 'ОСНО (плательщик НДС)',
                avatar TEXT DEFAULT 'default-company-avatar.png',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        ''')
        conn.commit()
        print("Таблица company_profiles создана/обновлена")
    except Exception as e:
        print(f"Ошибка создания company_profiles: {e}")
    finally:
        conn.close()


# ===============================================
# ИНИЦИАЛИЗАЦИЯ ТАБЛИЦЫ user_contacts
# ===============================================
def init_user_contacts_db():
    conn = get_conn()
    try:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS user_contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE NOT NULL,
                contact_person TEXT,
                work_phone TEXT,
                personal_phone TEXT,
                documents_email TEXT,
                notifications_email TEXT,
                telegram TEXT,
                whatsapp TEXT,
                max_phone TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        ''')
        conn.commit()
        print("Таблица user_contacts создана/обновлена")
    except Exception as e:
        print(f"Ошибка создания user_contacts: {e}")
    finally:
        conn.close()

# ВЫЗЫВАЕМ СРАЗУ ПРИ ЗАГРУЗКЕ МОДУЛЯ — ВАЖНО!
init_user_contacts_db()

# ===============================================
# РОУТЫ
# ===============================================

@profile_bp.route('/profile')
def profile_page():
    user_authenticated = 'user_id' in session
    return render_template('profile.html', user_authenticated=user_authenticated)

@profile_bp.route('/api/company', methods=['GET'])
def get_company():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    user_id = session['user_id']
    phone = session.get('phone')  # ← берём телефон из сессии

    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM company_profiles WHERE user_id = ?",
            (user_id,)
        ).fetchone()

        if not row:
            conn.execute("INSERT INTO company_profiles (user_id) VALUES (?)", (user_id,))
            conn.commit()
            row = conn.execute("SELECT * FROM company_profiles WHERE user_id = ?", (user_id,)).fetchone()

        data = dict(row)

        avatar_url = (
            f"/static/uploads/company/{data['avatar']}"
            if data['avatar'] and data['avatar'] != "default-company-avatar.png"
            else None  # ← ВАЖНО! None, а не путь к картинке!
        )

        # === ПОДПИСКИ НА РАССЫЛКИ ===
        sms_subscribe = True
        email_subscribe = True

        if phone:
            # ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
            # ГЛАВНОЕ ИСПРАВЛЕНИЕ — НОРМАЛИЗАЦИЯ ТЕЛЕФОНА!
            phone_normalized = '+' + phone if not phone.startswith('+') else phone
            # ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←

            try:
                from dispatch import get_dispatch_conn
                disp_conn = get_dispatch_conn()
                sub = disp_conn.execute(
                    "SELECT sms_consent, email FROM subscribers WHERE phone = ?",
                    (phone_normalized,)  
                ).fetchone()
                disp_conn.close()

                if sub:
                    sms_subscribe = bool(sub['sms_consent'])
                    email_subscribe = bool(sub['email'] and str(sub['email']).strip() != '')
            except Exception as e:
                current_app.logger.warning(f"Ошибка чтения подписок для {phone_normalized}: {e}")

        return jsonify({
            "fullName": data['full_name'] or "",
            "companyName": data['short_name'] or "",
            "inn": data['inn'] or "",
            "ogrn": data['ogrn'] or "",
            "kpp": data['kpp'] or "",
            "okpo": data['okpo'] or "",
            "okved": data['okved'] or "",
            "legalAddress": data['legal_address'] or "",
            "actualAddress": data['actual_address'] or data['legal_address'] or "",
            "activity": data['activity'] or "",
            "budget": data['budget'] or "",
            "director": data['director'] or "",
            "companyStatus": data['company_status'] or "Действующая",
            "taxSystem": data['tax_system'] or "ОСНО (плательщик НДС)",
            "avatar": avatar_url,  # ← None если логотипа нет
            "regDate": (
                f"{data['created_at'][8:10]}.{data['created_at'][5:7]}.{data['created_at'][:4]}"
                if data['created_at'] else ""
            ),
            "smsSubscribe": sms_subscribe,
            "emailSubscribe": email_subscribe,
        })
    finally:
        conn.close()

@profile_bp.route('/api/company', methods=['POST'])
def save_company():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    user_id = session['user_id']
    data = request.form.to_dict()
    files = request.files
    conn = get_conn()

    try:
        # Получаем текущий профиль
        row = conn.execute(
            "SELECT * FROM company_profiles WHERE user_id = ?",
            (user_id,)
        ).fetchone()

        if not row:
            conn.execute("INSERT INTO company_profiles (user_id) VALUES (?)", (user_id,))
            conn.commit()

        # Обновляем поля
        updates = []
        params = []

        mapping = {
            'fullName': 'full_name',
            'companyName': 'short_name',
            'inn': 'inn',
            'ogrn': 'ogrn',
            'kpp': 'kpp',
            'okpo': 'okpo',
            'okved': 'okved',
            'legalAddress': 'legal_address',
            'actualAddress': 'actual_address',
            'activity': 'activity',
            'budget': 'budget',
            'director': 'director',
            'companyStatus': 'company_status',
            'taxSystem': 'tax_system',
        }

        for js_key, db_key in mapping.items():
            if js_key in data:
                value = data[js_key].strip() or None
                updates.append(f"{db_key} = ?")
                params.append(value)

        if updates:
            params.append(user_id)
            conn.execute(
                f"UPDATE company_profiles SET {', '.join(updates)} WHERE user_id = ?",
                params
            )

        # === АВАТАР ===
        remove_avatar_flag = request.form.get('remove_avatar') == '1'
        has_new_avatar = 'avatar' in files and files['avatar'].filename

        if remove_avatar_flag and not has_new_avatar:
            # Пользователь нажал крестик и не загрузил новую фотку → удаляем полностью
            if row and row['avatar'] and row['avatar'] != "default-company-avatar.png":
                old_path = os.path.join(current_app.root_path, 'static', 'uploads', 'company', row['avatar'])
                if os.path.exists(old_path):
                    try:
                        os.remove(old_path)
                        current_app.logger.info(f"Удалена аватарка: {old_path}")
                    except Exception as e:
                        current_app.logger.warning(f"Не удалось удалить файл {old_path}: {e}")

            # Сбрасываем в БД на дефолт (или можно NULL)
            conn.execute(
                "UPDATE company_profiles SET avatar = ? WHERE user_id = ?",
                ("default-company-avatar.png", user_id)  # или NULL, если хочешь чисто
            )

        elif has_new_avatar:
            # Загружаем новую фотку (твой старый рабочий код)
            file = files['avatar']
            
            # Удаляем старую (если была не дефолтная)
            if row and row['avatar'] and row['avatar'] != "default-company-avatar.png":
                old_path = os.path.join(current_app.root_path, 'static', 'uploads', 'company', row['avatar'])
                if os.path.exists(old_path):
                    try: os.remove(old_path)
                    except: pass

            ext = os.path.splitext(file.filename)[1].lower()
            if ext not in {'.jpg', '.jpeg', '.png', '.webp'}:
                ext = '.jpg'

            filename = f"company_{user_id}_{int(datetime.now().timestamp())}{ext}"
            upload_path = os.path.join(current_app.root_path, 'static', 'uploads', 'company')
            os.makedirs(upload_path, exist_ok=True)
            file.save(os.path.join(upload_path, filename))

            conn.execute(
                "UPDATE company_profiles SET avatar = ? WHERE user_id = ?",
                (filename, user_id)
            )

        conn.commit()
        return jsonify({"success": True, "data": "ok"})
    except Exception as e:
        conn.rollback()
        current_app.logger.error(f"Ошибка сохранения профиля: {e}")
        return jsonify({"success": False, "error": "Ошибка сервера"}), 500
    finally:
        conn.close()


@profile_bp.route('/api/toggle_subscriptions', methods=['POST'])
def toggle_subscriptions():
    if 'user_id' not in session:
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    data = request.get_json() or {}
    sms = int(data.get('smsSubscribe', 1))
    email = int(data.get('emailSubscribe', 1))

    phone = session.get('phone')
    if not phone:
        return jsonify({"success": False, "error": "Телефон не найден"}), 400

    phone_normalized = '+' + phone if not phone.startswith('+') else phone

    from dispatch import get_dispatch_conn
    conn = get_dispatch_conn()
    try:
        row = conn.execute(
            "SELECT id FROM subscribers WHERE phone = ?", 
            (phone_normalized,)
        ).fetchone()

        if row:
            conn.execute('''
    UPDATE subscribers 
    SET sms_consent = ?
    WHERE phone = ?
''', (sms, phone_normalized))
            
            if email == 0:
                conn.execute("UPDATE subscribers SET email = NULL WHERE phone = ?", (phone_normalized,))
            logger.info(f"Обновлена подписка: {phone_normalized} → SMS: {sms}, Email: {email}")
        else:
            token = secrets.token_urlsafe(32)
            conn.execute('''
                INSERT INTO subscribers 
                (phone, sms_consent, is_active, unsubscribe_token, source)
                VALUES (?, ?, ?, ?, 'profile')
            ''', (phone_normalized, sms, email, token))
            logger.info(f"Создана новая подписка: {phone_normalized}")

        conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"toggle_subscriptions error: {e}")
        return jsonify({"success": False, "error": "Ошибка"}), 500
    finally:
        conn.close()
# Безопасная отдача аватарок
@profile_bp.route('/static/uploads/company/<filename>')
def company_avatar(filename):
    if '..' in filename or filename.startswith('/') or filename.startswith('\\'):
        abort(403)
    if not re.match(r'^[a-zA-Z0-9_.-]+\.(jpg|jpeg|png|webp)$', filename, re.IGNORECASE):
        abort(403)

    directory = os.path.join(current_app.root_path, 'static', 'uploads', 'company')
    return send_from_directory(directory, filename)

@profile_bp.route('/api/set_email', methods=['POST'])
def set_email():
    if 'user_id' not in session:
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()

    if not email or '@' not in email:
        return jsonify({"success": False, "error": "Некорректный email"}), 400

    phone = session.get('phone')
    if not phone:
        return jsonify({"success": False, "error": "Телефон не найден"}), 400

    phone_normalized = normalize_phone(phone)
    if not phone_normalized:
        return jsonify({"success": False, "error": "Ошибка телефона"}), 400

    from dispatch import get_dispatch_conn
    conn = get_dispatch_conn()
    try:
        # Ищем запись
        row = conn.execute("SELECT id FROM subscribers WHERE phone = ?", (phone_normalized,)).fetchone()

        if row:
            conn.execute("UPDATE subscribers SET email = ? WHERE phone = ?", (email, phone_normalized))
        else:
            token = secrets.token_urlsafe(32)
            conn.execute('''
                INSERT INTO subscribers 
                (phone, email, sms_consent, is_active, unsubscribe_token, source)
                VALUES (?, ?, 0, 1, ?, 'profile_email')
            ''', (phone_normalized, email, token))

        conn.commit()
        logger.info(f"Email установлен: {phone_normalized} → {email}")
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"set_email error: {e}")
        return jsonify({"success": False, "error": "Серверная ошибка"}), 500
    finally:
        conn.close()

        # ===============================================
# КОНТАКТЫ ПОЛЬЗОВАТЕЛЯ — 2025 EDITION
# ===============================================

@profile_bp.route('/api/contacts', methods=['GET'])
def get_contacts():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    user_id = session['user_id']
    phone_from_session = session.get('phone', '')

    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM user_contacts WHERE user_id = ?",
            (user_id,)
        ).fetchone()

        if not row:
            # Создаём запись + автозаполнение телефона
            norm_phone = normalize_phone(phone_from_session) if phone_from_session else None
            conn.execute(
                "INSERT INTO user_contacts (user_id, work_phone) VALUES (?, ?)",
                (user_id, norm_phone)
            )
            conn.commit()
            row = conn.execute("SELECT * FROM user_contacts WHERE user_id = ?", (user_id,)).fetchone()

        data = dict(row)

        return jsonify({
            "contactPerson": data.get('contact_person') or "",
            "workPhone": data.get('work_phone') or "",
            "personalPhone": data.get('personal_phone') or "",
            "documentsEmail": data.get('documents_email') or "",
            "notificationsEmail": data.get('notifications_email') or "",
            "telegram": data.get('telegram') or "",
            "whatsapp": data.get('whatsapp') or "",
            "maxPhone": data.get('max_phone') or "",
        })
    except Exception as e:
        logger.error(f"get_contacts error: {e}")
        return jsonify({"error": "Server error"}), 500
    finally:
        conn.close()


@profile_bp.route('/api/contacts', methods=['POST'])
def save_contacts():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    user_id = session['user_id']
    data = request.get_json() or {}

    conn = get_conn()
    try:
        row = conn.execute("SELECT id, work_phone FROM user_contacts WHERE user_id = ?", (user_id,)).fetchone()

        updates = []
        params = []

        errors = []

        # === УНИВЕРСАЛЬНАЯ НОРМАЛИЗАЦИЯ ТЕЛЕФОНА ===
        def normalize_phone_input(raw):
            if not raw:
                return None
            digits = ''.join(filter(str.isdigit, str(raw)))
            if digits.startswith('8') and len(digits) == 11:
                digits = '7' + digits[1:]
            if len(digits) == 10:
                digits = '7' + digits
            if digits.startswith('7') and len(digits) == 11:
                return '+' + digits
            return None

        # Валидация и очистка полей
        updates.append("contact_person = ?")
        params.append(data.get('contactPerson', '').strip() or None)

        # Телефоны — принимаем любой формат
        personal = normalize_phone_input(data.get('personalPhone', ''))
        if data.get('personalPhone') and not personal:
            errors.append("Некорректный личный телефон")
        updates.append("personal_phone = ?")
        params.append(personal)

        whatsapp = normalize_phone_input(data.get('whatsapp', ''))
        if data.get('whatsapp') and not whatsapp:
            errors.append("Некорректный WhatsApp")
        updates.append("whatsapp = ?")
        params.append(whatsapp)

        max_phone = normalize_phone_input(data.get('max', ''))
        if data.get('max') and not max_phone:
            errors.append("Некорректный MAX")
        updates.append("max_phone = ?")
        params.append(max_phone)

        # Email
        def validate_email(email):
            if not email:
                return None
            email = email.strip().lower()
            if re.match(r'^.+@.+\..+$', email):
                return email
            return None

        doc_email = validate_email(data.get('documentsEmail'))
        if data.get('documentsEmail') and not doc_email:
            errors.append("Некорректный email для документов")
        updates.append("documents_email = ?")
        params.append(doc_email)

        notif_email = validate_email(data.get('notificationsEmail'))
        if data.get('notificationsEmail') and not notif_email:
            errors.append("Некорректный email для уведомлений")
        updates.append("notifications_email = ?")
        params.append(notif_email)

        # Telegram
        tg = data.get('telegram', '').strip().replace('@', '')
        if tg and not re.match(r'^[a-zA-Z0-9_]{5,32}$', tg):
            errors.append("Telegram: только латиница, цифры и _, от 5 символов")
        updates.append("telegram = ?")
        params.append(tg if tg else None)

        # Рабочий телефон — нельзя менять (если уже есть)
        if not row or not row['work_phone']:
            session_phone = session.get('phone', '')
            norm_work_phone = normalize_phone(session_phone) if session_phone else None
            updates.append("work_phone = ?")
            params.append(norm_work_phone)

        updates.append("updated_at = CURRENT_TIMESTAMP")

        if errors:
            return jsonify({"success": False, "errors": errors}), 400

        if row:
            sql = f"UPDATE user_contacts SET {', '.join(updates)} WHERE user_id = ?"
            params.append(user_id)
            conn.execute(sql, params)
        else:
            # При первом создании — добавляем все поля
            cols = ['user_id'] + [u.split(' = ')[0] for u in updates if 'updated_at' not in u]
            placeholders = ','.join(['?'] * len(cols))
            values = [user_id] + params[:-1]  # без updated_at
            sql = f"INSERT INTO user_contacts ({', '.join(cols)}) VALUES ({placeholders})"
            conn.execute(sql, values)

        conn.commit()
        return jsonify({"success": True})

    except Exception as e:
        logger.error(f"save_contacts error: {e}")
        conn.rollback()
        return jsonify({"success": False, "error": "Ошибка сервера"}), 500
    finally:
        conn.close()