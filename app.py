# app.py — БД, авторизация, API
from flask import Flask, session, request, jsonify, redirect, url_for
import sqlite3
import random
from datetime import datetime, timedelta
from functools import wraps

def create_app():
    app = Flask(__name__)
    app.secret_key = 'your-super-secret-key-change-in-production-123456789'

    # === ИНИЦИАЛИЗАЦИЯ БД ===
    def init_db():
        conn = sqlite3.connect('piligrim.db')
        c = conn.cursor()
        c.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phone TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        c.execute('''
            CREATE TABLE IF NOT EXISTS auth_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phone TEXT NOT NULL,
                code TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP
            )
        ''')
        c.execute('''
            CREATE TABLE IF NOT EXISTS news (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()
        conn.close()

    init_db()

    # === ДЕКОРАТОР ===
    def login_required(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if 'user_phone' not in session:
                return redirect(url_for('index', login=1))
            return f(*args, **kwargs)
        return decorated

    # === API: ОТПРАВКА КОДА ===
    @app.route('/api/send_code', methods=['POST'])
    def send_code():
        data = request.get_json(silent=True) or {}
        phone = data.get('phone', '').strip()

        if not phone or not phone.isdigit() or len(phone) != 11:
            return jsonify({'success': False, 'error': 'Неверный номер телефона'}), 400

        code = ''.join([str(random.randint(0, 9)) for _ in range(6)])
        expires_at = datetime.now() + timedelta(minutes=5)

        conn = sqlite3.connect('piligrim.db')
        c = conn.cursor()
        c.execute('DELETE FROM auth_codes WHERE phone = ?', (phone,))
        c.execute('INSERT INTO auth_codes (phone, code, expires_at) VALUES (?, ?, ?)',
                  (phone, code, expires_at))
        c.execute('INSERT OR IGNORE INTO users (phone) VALUES (?)', (phone,))
        conn.commit()
        conn.close()

        print(f"[SMS] Код для {phone}: {code}")
        return jsonify({'success': True})

    # === API: ПРОВЕРКА КОДА (ИСПРАВЛЕНО: user_id + phone) ===
    @app.route('/api/verify_code', methods=['POST'])
    def verify_code():
        data = request.get_json(silent=True) or {}
        phone = data.get('phone')
        code = data.get('code')

        if not phone or not code:
            return jsonify({'success': False, 'error': 'Нет данных'}), 400

        conn = sqlite3.connect('piligrim.db')
        c = conn.cursor()
        c.execute('SELECT code, expires_at FROM auth_codes WHERE phone = ?', (phone,))
        row = c.fetchone()

        if not row:
            conn.close()
            return jsonify({'success': False, 'error': 'Код не найден'}), 400

        db_code, expires_at = row
        try:
            expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
        except:
            expires_at = datetime.fromisoformat(expires_at)

        if datetime.now() > expires_at:
            c.execute('DELETE FROM auth_codes WHERE phone = ?', (phone,))
            conn.commit()
            conn.close()
            return jsonify({'success': False, 'error': 'Код истёк'}), 400

        if code != db_code:
            conn.close()
            return jsonify({'success': False, 'error': 'Неверный код'}), 400

        # === УДАЛЕНИЕ КОДА ===
        c.execute('DELETE FROM auth_codes WHERE phone = ?', (phone,))
        conn.commit()
        conn.close()

        # === НАХОДИМ ИЛИ СОЗДАЁМ ПОЛЬЗОВАТЕЛЯ ===
        conn = sqlite3.connect('piligrim.db')
        c = conn.cursor()
        c.execute('SELECT id FROM users WHERE phone = ?', (phone,))
        user_row = c.fetchone()

        if not user_row:
            # Создаём нового пользователя
            c.execute('INSERT INTO users (phone, created_at) VALUES (?, ?)', 
                    (phone, datetime.now().isoformat()))
            conn.commit()
            user_id = c.lastrowid
        else:
            user_id = user_row[0]

        conn.close()

        # === СОХРАНЯЕМ В СЕССИЮ ===
        session['user_id'] = user_id        # ← ВАЖНО!
        session['user_phone'] = phone       # ← для обратной связи

        # === ВОЗВРАЩАЕМ ДАННЫЕ ДЛЯ JS ===
        return jsonify({
            'success': True,
            'user': {
                'id': user_id,
                'phone': phone,
                'is_admin': False  # ← добавь, если нужно
            }
        })

    # === ВЫХОД ===
    @app.route('/logout')
    def logout():
        session.pop('user_phone', None)
        return redirect(url_for('index'))


    # === НОВОСТИ (для server.py) ===
    @app.route('/api/news')
    def api_news():
        conn = sqlite3.connect('piligrim.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute('SELECT * FROM news ORDER BY created_at DESC')
        news_list = c.fetchall()
        conn.close()
        return jsonify([dict(row) for row in news_list])

    return app