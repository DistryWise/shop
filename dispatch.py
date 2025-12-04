# dispatch.py — Диспетчерская рассылки + отписка по токену (2025 edition)
import sqlite3
import time
import logging
import csv
import secrets  # ← для безопасных токенов
from flask import current_app, request, jsonify, send_file, session, redirect, render_template, url_for
from io import StringIO


logger = logging.getLogger(__name__)

DB_DISPATCH = 'dispatch.db'

def get_dispatch_conn():
    conn = sqlite3.connect(DB_DISPATCH)
    conn.row_factory = sqlite3.Row
    return conn

def init_dispatch_db():
    """Инициализация/обновление БД подписчиков — безопасно и навсегда"""
    conn = get_dispatch_conn()
    cursor = conn.cursor()
    
    try:
        # 1. Создаём таблицу БЕЗ старого UNIQUE(phone, email)
        conn.execute('''
            CREATE TABLE IF NOT EXISTS subscribers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phone TEXT,
                email TEXT,
                source TEXT DEFAULT 'site',
                ip TEXT,
                user_agent TEXT,
                subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                unsubscribed_at DATETIME,
                is_active BOOLEAN DEFAULT 1,
                unsubscribe_token TEXT UNIQUE,
                sms_consent INTEGER DEFAULT 0
            )
        ''')

        # 2. Добавляем sms_consent, если ещё нет
        cursor.execute("PRAGMA table_info(subscribers)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'sms_consent' not in columns:
            cursor.execute('ALTER TABLE subscribers ADD COLUMN sms_consent INTEGER DEFAULT 0')
            logger.info("Добавлена колонка sms_consent")

        # 3. Создаём правильные уникальные индексы (частичные — только где не NULL)
        cursor.execute('''
            CREATE UNIQUE INDEX IF NOT EXISTS uniq_phone 
            ON subscribers(phone) WHERE phone IS NOT NULL AND phone != ''
        ''')
        cursor.execute('''
            CREATE UNIQUE INDEX IF NOT EXISTS uniq_email 
            ON subscribers(email) WHERE email IS NOT NULL AND email != ''
        ''')

        # 4. Обычные индексы
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_phone ON subscribers(phone)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_active ON subscribers(is_active)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_token ON subscribers(unsubscribe_token)')

        conn.commit()
        logger.info("dispatch.db успешно обновлена: отдельная уникальность по phone/email + sms_consent")

    except Exception as e:
        logger.error(f"init_dispatch_db error: {e}")
        raise
    finally:
        conn.close()

def normalize_phone(phone: str) -> str:
    digits = ''.join(filter(str.isdigit, phone))
    if digits.startswith('8') and len(digits) == 11:
        digits = '7' + digits[1:]
    if len(digits) == 10:
        digits = '7' + digits
    if digits.startswith('7') and len(digits) == 11:
        return '+' + digits
    return ''

def subscribe(phone: str, email: str = None, source: str = 'site') -> dict:
    phone_clean = normalize_phone(phone)
    if not phone_clean:
        return {"success": False, "error": "Некорректный номер телефона"}

    email_clean = email.strip().lower() if email and '@' in email else None
    token = secrets.token_urlsafe(32)  # ← безопасный токен

    conn = get_dispatch_conn()
    try:
        existing = conn.execute(
            'SELECT is_active, unsubscribed_at FROM subscribers WHERE phone = ?',
            (phone_clean,)
        ).fetchone()

        if existing and existing['is_active']:
            return {"success": False, "error": "Вы уже подписаны на рассылку"}

        if existing and not existing['is_active']:
            # Реактивация + новый токен
            conn.execute('''
                UPDATE subscribers 
                SET is_active = 1, unsubscribed_at = NULL, subscribed_at = CURRENT_TIMESTAMP, unsubscribe_token = ?
                WHERE phone = ?
            ''', (token, phone_clean))
            conn.commit()
            logger.info(f"Реактивирован подписчик: {phone_clean}")
            return {"success": True, "message": "С возвращением! Вы снова в рассылке", "token": token}

        # Новая подписка
        conn.execute('''
            INSERT INTO subscribers (phone, email, source, ip, user_agent, unsubscribe_token)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (phone_clean, email_clean, source, request.remote_addr, request.headers.get('User-Agent'), token))
        conn.commit()
        logger.info(f"Новый подписчик: {phone_clean} | {email_clean or '—'} | токен: {token[:10]}...")
        return {"success": True, "message": "Спасибо! Вы успешно подписаны", "token": token}

    except sqlite3.IntegrityError as e:
        logger.warning(f"Дубль подписки: {phone_clean}")
        return {"success": False, "error": "Вы уже подписаны"}
    except Exception as e:
        logger.error(f"subscribe error: {e}")
        return {"success": False, "error": "Ошибка сервера"}
    finally:
        conn.close()

def unsubscribe_by_token(token: str) -> tuple[bool, str]:
    """Отписка по токену. Возвращает (успех, сообщение)"""
    if not token:
        return False, "Токен отсутствует"

    conn = get_dispatch_conn()
    try:
        row = conn.execute('SELECT phone, is_active FROM subscribers WHERE unsubscribe_token = ?', (token,)).fetchone()
        if not row:
            return False, "Ссылка недействительна или уже использована"

        if not row['is_active']:
            return False, "Вы уже отписаны от рассылки"

        conn.execute('''
            UPDATE subscribers 
            SET is_active = 0, unsubscribed_at = CURRENT_TIMESTAMP 
            WHERE unsubscribe_token = ?
        ''', (token,))
        conn.commit()
        logger.info(f"Отписка по токену: {row['phone']}")
        return True, "Вы успешно отписаны от рассылки"
    except Exception as e:
        logger.error(f"unsubscribe_by_token error: {e}")
        return False, "Ошибка сервера"
    finally:
        conn.close()

# === РОУТЫ ===

def get_subscribers(active_only=True):
    """Возвращает список всех подписчиков (для админки)"""
    conn = get_dispatch_conn()
    try:
        query = 'SELECT * FROM subscribers'
        if active_only:
            query += ' WHERE is_active = 1'
        query += ' ORDER BY subscribed_at DESC'
        rows = conn.execute(query).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def get_stats():
    """Статистика: всего, активных, за сегодня"""
    conn = get_dispatch_conn()
    try:
        total = conn.execute('SELECT COUNT(*) FROM subscribers').fetchone()[0]
        active = conn.execute('SELECT COUNT(*) FROM subscribers WHERE is_active = 1').fetchone()[0]
        today = conn.execute('''
            SELECT COUNT(*) FROM subscribers 
            WHERE DATE(subscribed_at) = DATE('now', 'localtime')
              AND is_active = 1
        ''').fetchone()[0]
        return {
            "total": total,
            "active": active,
            "today": today
        }
    finally:
        conn.close()

def register_dispatch_routes(app):
    from dispatch import (
        subscribe,
        get_subscribers,
        get_stats,
        unsubscribe_by_token
    )

    # === ОТПИСКА ===
    @app.route('/unsubscribe/<token>')
    def unsubscribe_page(token):
        success, message = unsubscribe_by_token(token)
        return render_template('unsubscribed.html', success=success, message=message)

    # === АДМИНКА ===
    @app.route('/admin_dispatch')
    def admin_dispatch():
        if not session.get('is_admin'):
            return redirect('/')
        subs = get_subscribers(active_only=False)
        stats = get_stats()

        from database_goods import get_conn as get_main_conn, DB_MAIN, DB_FEEDBACK

        conn_main = get_main_conn(DB_MAIN)
        conn_feedback = get_main_conn(DB_FEEDBACK)
        try:
            total_users = conn_main.execute('SELECT COUNT(*) FROM users').fetchone()[0]
            total_orders = conn_main.execute('SELECT COUNT(*) FROM orders').fetchone()[0]
            total_reviews = conn_main.execute('SELECT COUNT(*) FROM reviews').fetchone()[0]
            total_feedback = conn_feedback.execute('SELECT COUNT(*) FROM feedback').fetchone()[0]
        except Exception as e:
            logger.error(f"Ошибка получения общей статистики в admin_dispatch: {e}")
            total_users = total_orders = total_reviews = total_feedback = 0
        finally:
            conn_main.close()
            conn_feedback.close()
        return render_template(
            'admin_dispatch.html',
            subscribers=subs,
            stats=stats,
            total_users=total_users,
            total_orders=total_orders,
            total_reviews=total_reviews,
            total_feedback=total_feedback
        )

    # === ЭКСПОРТ CSV ===
    @app.route('/admin_dispatch/export/csv')
    def export_dispatch_csv():
        if not session.get('is_admin'):
            return "Forbidden", 403
        subs = get_subscribers(active_only=True)
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(['ID', 'Телефон', 'Email', 'Источник', 'Дата подписки', 'Отписка', 'Токен'])
        for s in subs:
            writer.writerow([
                s['id'], s['phone'] or '',
                s['email'] or '',
                s['source'], s['subscribed_at'],
                s['unsubscribed_at'] or '—',
                s['unsubscribe_token'][:20] + '...' if s['unsubscribe_token'] else ''
            ])
        output.seek(0)
        return send_file(
            output,
            mimetype='text/csv',
            as_attachment=True,
            download_name=f"subscribers_{time.strftime('%Y%m%d')}.csv"
        )

    # === ТЕСТ ОТПИСКИ ===
    @app.route('/test_unsubscribe/<int:user_id>')
    def test_unsubscribe(user_id):
        if not session.get('is_admin'):
            return "Нет доступа", 403
        conn = get_dispatch_conn()
        row = conn.execute('SELECT unsubscribe_token FROM subscribers WHERE id = ?', (user_id,)).fetchone()
        conn.close()
        if row and row['unsubscribe_token']:
            return f'<a href="{url_for("unsubscribe_page", token=row["unsubscribe_token"])}">Отписаться (тест)</a>'
        return "Токен не найден"

    # === УДАЛЕНИЕ ПОДПИСЧИКА С ПРОВЕРКОЙ ПАРОЛЯ ===
    @app.route('/api/delete_subscriber', methods=['POST'])
    def api_delete_subscriber():
        if not session.get('is_admin'):
            return jsonify({"success": False, "error": "Нет доступа"}), 403

        data = request.get_json()
        sub_id = data.get('id')
        password = data.get('password', '').strip()

        # ПРОВЕРЯЕМ ПАРОЛЬ!
        if password != 'admin123':
            logger.warning(f"Неверный пароль при удалении подписчика ID={sub_id}")
            return jsonify({"success": False, "error": "Неверный пароль"}), 403

        if not sub_id:
            return jsonify({"success": False, "error": "ID не указан"}), 400

        conn = get_dispatch_conn()
        try:
            c = conn.cursor()
            c.execute('DELETE FROM subscribers WHERE id = ?', (sub_id,))
            if c.rowcount == 0:
                return jsonify({"success": False, "error": "Подписчик не найден"}), 404
            
            conn.commit()
            logger.info(f"Админ удалил подписчика ID={sub_id} (пароль подтверждён)")
            return jsonify({"success": True})
            
        except Exception as e:
            logger.error(f"delete_subscriber error: {e}")
            return jsonify({"success": False, "error": "Ошибка сервера"}), 500
        finally:
            conn.close()

    @app.route('/api/get_subscribers')
    def api_get_subscribers():
        if not session.get('is_admin'):
            return jsonify({"success": False, "error": "Нет доступа"}), 403
        
        conn = get_dispatch_conn()
        try:
            # Показываем ВСЕХ, у кого есть телефон ИЛИ email, даже если отписан
            subs = conn.execute('''
                SELECT 
                    id, 
                    phone, 
                    email, 
                    sms_consent, 
                    subscribed_at,
                    is_active
                FROM subscribers 
                WHERE phone IS NOT NULL OR email IS NOT NULL
                ORDER BY subscribed_at DESC
            ''').fetchall()
            
            result = [dict(row) for row in subs]
            return jsonify({"success": True, "subscribers": result})
        except Exception as e:
            logger.error(f"get_subscribers error: {e}")
            return jsonify({"success": False, "error": str(e)}), 500
        finally:
            conn.close()

    @app.route('/api/subscribe', methods=['POST'])
    def api_subscribe():
        data = request.get_json() or {}
        phone_raw = data.get('phone', '').strip()
        email_raw = data.get('email', '').strip()
        sms_consent = int(data.get('sms_consent', 0))
        source = data.get('source', 'site')

        # Нормализуем телефон (только если он реально есть)
        phone = None
        if phone_raw and len(phone_raw) >= 10 and phone_raw.isdigit():
            phone = normalize_phone(phone_raw)

        # Валидация и нормализация email
        email = None
        if email_raw:
            email_lower = email_raw.lower()
            if '@' in email_lower:
                local, domain = email_lower.split('@', 1)
                if local and '.' in domain and len(domain.split('.')[-1]) >= 2:
                    email = email_lower

        # Должен быть хотя бы один контакт
        if not phone and not email:
            return jsonify({"success": False, "error": "Укажите телефон или email"}), 400

        conn = get_dispatch_conn()
        try:
            # ИЩЕМ ПО ТЕЛЕФОНУ ИЛИ ПО EMAIL (по любому из них!)
            existing = None

            if phone:
                existing = conn.execute(
                    'SELECT * FROM subscribers WHERE phone = ?', (phone,)
                ).fetchone()

            if not existing and email:
                existing = conn.execute(
                    'SELECT * FROM subscribers WHERE LOWER(email) = ?', (email,)
                ).fetchone()

            token = secrets.token_urlsafe(32)

            if existing:
                # НАШЛИ — объединяем данные (обновляем всё, что нужно)
                update_fields = []
                update_values = []

                # Обновляем email, если пришёл новый или был пустой
                if email and (existing['email'] is None or existing['email'].lower() != email):
                    update_fields.append('email = ?')
                    update_values.append(email)

                # Обновляем телефон, если пришёл новый
                if phone and existing['phone'] != phone:
                    update_fields.append('phone = ?')
                    update_values.append(phone)

                # Обновляем SMS-согласие
                if existing['sms_consent'] != sms_consent:
                    update_fields.append('sms_consent = ?')
                    update_values.append(sms_consent)

                # Всегда обновляем токен (безопасность)
                update_fields.append('unsubscribe_token = ?')
                update_values.append(token)

                # Обновляем источник и время активности
                update_fields.append('source = ?')
                update_values.append(source)


                if update_fields:
                    sql = f"UPDATE subscribers SET {', '.join(update_fields)} WHERE id = ?"
                    conn.execute(sql, update_values + [existing['id']])
                    conn.commit()

                return jsonify({
                    "success": True,
                    "already_subscribed": True,
                    "message": "Вы уже подписаны на рассылку"
                })

            else:
                # СОВСЕМ НОВАЯ ЗАПИСЬ
                conn.execute('''
                    INSERT INTO subscribers 
                    (phone, email, sms_consent, is_active, source, ip, user_agent, unsubscribe_token)
                    VALUES (?, ?, ?, 1, ?, ?, ?, ?)
                ''', (
                    phone, email, sms_consent, source,
                    request.remote_addr, request.headers.get('User-Agent'), token
                ))
                conn.commit()

                return jsonify({
                    "success": True,
                    "new_subscription": True,
                    "message": "Спасибо! Вы успешно подписаны"
                })

        except sqlite3.IntegrityError as e:
            logger.warning(f"Неожиданный дубликат (не должен быть): {e}")
            return jsonify({
                "success": True,
                "already_subscribed": True,
                "message": "Вы уже подписаны на рассылку"
            })

        except Exception as e:
            logger.error(f"api_subscribe error: {e}", exc_info=True)
            try:
                conn.rollback()
            except:
                pass
            return jsonify({"success": False, "error": "Ошибка сервера"}), 500

        finally:
            conn.close()