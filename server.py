# server.py — ФИНАЛЬНАЯ ВЕРСИЯ С ЗАЩИТОЙ ПО IP

from flask import Flask, render_template, session, redirect, url_for, flash, request, jsonify
import logging
import os
from functools import wraps
import sqlite3          
import time
import httpx
import asyncio
import json
from flask import stream_with_context, Response


from database_goods import (
    init_all_dbs,
    get_all_feedback, delete_feedback,
    register_admin_routes,
    get_total_users
)
from use_db import init_users_db, users_bp, track_visits
from editor import zaza_editor, init_zaza_db
from auth_backend import init_auth_db, generate_and_send_code, verify_user_code
from dispatch import init_dispatch_db, register_dispatch_routes, get_stats

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ТВОИ РАЗРЕШЁННЫЕ IP (меняй при смене интернета)
ALLOWED_ADMIN_IPS = [
    "188.123.58.214",   # ← ТВОЙ ОСНОВНОЙ IP
    "127.0.0.1",
    "::1",
    # Добавляй сюда новые IP при необходимости
]

def get_client_ip():
    """Точно определяет IP даже за Cloudflare/Nginx"""
    if request.headers.get("CF-Connecting-IP"):
        return request.headers.get("CF-Connecting-IP")
    if request.headers.get("X-Forwarded-For"):
        return request.headers.get("X-Forwarded-For").split(',')[0].strip()
    if request.headers.get("X-Real-IP"):
        return request.headers.get("X-Real-IP")
    return request.remote_addr



def create_app():
    app = Flask(__name__, static_folder='static', static_url_path='/static')
    app.secret_key = 'your-super-secret-key-1234567890-CHANGE-IT-NOW'
    app.config['UPLOAD_FOLDER'] = 'static/uploads'
    app.config['ADMIN_PASSWORD'] = 'admin123'
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    # === ИНИЦИАЛИЗАЦИЯ БД ===
    logger.info("Инициализация всех БД...")
    with app.app_context():
        init_all_dbs()
        init_zaza_db()
        init_users_db()
        init_auth_db()
        init_dispatch_db()
    logger.info("Все БД готовы!")

    # === ОТСЛЕЖИВАНИЕ ВИЗИТОВ ===
    track_visits(app)

    # === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
    @app.context_processor
    def inject_globals():
        return {
            'total_users': get_total_users() if session.get('is_admin') else 0,
            'current_user_id': session.get('user_id'),
            'is_admin': session.get('is_admin', False)
        }

    # === ЖЁСТКАЯ ЗАЩИТА АДМИНКИ ПО IP ===
    @app.before_request
    def protect_admin_routes():
        admin_paths = [
            '/admin', '/admin_', '/zaza_admin', '/admin_reviews',
            '/api/all_products', '/api/services',
            '/api/product/', '/api/service/'
        ]
        if any(request.path.startswith(p) for p in admin_paths):
            client_ip = get_client_ip()
            if client_ip not in ALLOWED_ADMIN_IPS:
                session.pop('is_admin', None)
                if request.path.startswith('/api/'):
                    return jsonify({"error": "Forbidden", "is_admin": False}), 403
                else:
                    return render_template("404.html"), 404
            # Если IP разрешён — даём админские права
            session['is_admin'] = True

    # === СТРАНИЦЫ ===
    @app.route('/')
    def index(): return render_template('index.html')

    @app.route('/goods')
    def goods(): return render_template('goods.html')

    @app.route('/services')
    def services(): return render_template('services.html')

    @app.route('/news')
    def news(): return render_template('news.html')

    @app.route('/zaza')
    def zaza(): return render_template('zaza.html')

    # Эти страницы теперь защищены по IP (через before_request)
    @app.route('/zaza_admin')
    def zaza_admin_page(): return render_template('zaza_admin.html')

    @app.route('/about_company')
    def about(): return render_template('about_company.html')

    @app.route('/policy')
    def policy(): return render_template('supports/policy.html')

    @app.route('/bin')
    def bin(): return render_template('bin.html')

    @app.route('/terms')
    def terms(): return render_template('supports/terms.html')

    @app.route('/delivery')
    def delivery(): return render_template('/supports/delivery.html')


    @app.route('/svg')
    def svg(): return render_template('svg.html')

    @app.route('/carousel-editor')
    def carousel_editor():
        return render_template('carousel_editor.html')
    
    from datetime import datetime

    @app.template_filter('format_date')
    def format_date(value):
        if value is None:
            return '—'
        if isinstance(value, int):
            try:
                return datetime.fromtimestamp(value).strftime('%d.%m.%Y')
            except:
                return '—'
        if isinstance(value, str) and len(value) >= 10:
            return value[:10].replace('-', '.')
        return '—'

    @app.route('/contacts')
    def contacts(): return render_template('contacts.html')

    # === API СЕССИИ ===
    @app.route('/api/session')
    def api_session():
        return jsonify({
            "logged_in": bool(session.get('user_id')),
            "phone": session.get('phone'),
            "is_admin": session.get('is_admin', False),
            "user_id": session.get('user_id')
        })

    # === ПРОВЕРКА АДМИНА ДЛЯ JS (по желанию) ===
    @app.route('/api/check_admin')
    def check_admin():
        client_ip = get_client_ip()
        is_admin = client_ip in ALLOWED_ADMIN_IPS
        return jsonify({"is_admin": is_admin})

    # === ПОДКЛЮЧЕНИЕ БЛЮПРИНТОВ ===
    app.register_blueprint(zaza_editor)
    app.register_blueprint(users_bp)

    # === АДМИН РОУТЫ (внутри register_admin_routes — они тоже защищены по IP) ===
    register_admin_routes(app)

    register_dispatch_routes(app)

    # === БЕЗОПАСНОСТЬ ===
    @app.after_request
    def add_security_headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response.headers['Content-Security-Policy'] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; "
            "img-src 'self' data: https:; "
            "font-src 'self' https://cdnjs.cloudflare.com; "
            "connect-src 'self'; "
            "frame-ancestors 'none';"
        )
        return response

    # === ОБРАБОТЧИКИ ОШИБОК ===
    @app.errorhandler(404)
    def not_found(e): return render_template('404.html'), 404

    @app.errorhandler(403)
    def forbidden(e):
        if request.path.startswith('/api/'):
            return jsonify({"error": "Forbidden", "is_admin": False}), 403
        return render_template('404.html'), 404

    @app.errorhandler(500)
    def server_error(e):
        logger.error(f"500 error: {e}")
        return render_template('500.html'), 500
    
    # === API АВТОРИЗАЦИИ ПО SMS ===

    @app.route('/api/send_code', methods=['POST'])
    def api_send_code():
        data = request.get_json()
        phone = data.get('phone')
        
        if not phone or len(phone.replace('+', '').replace('-', '')) < 10:
            return jsonify({"success": False, "error": "Некорректный номер"}), 400

        # Убираем всё лишнее, оставляем только цифры и +
        clean_phone = ''.join(filter(str.isdigit, phone))
        if phone.startswith('+'):
            clean_phone = '+' + clean_phone
        elif len(clean_phone) == 10:
            clean_phone = '+7' + clean_phone
        elif len(clean_phone) == 11 and clean_phone.startswith('8'):
            clean_phone = '+7' + clean_phone[1:]

        # Отправляем настоящий код через Exolve
        success, message = generate_and_send_code(clean_phone)
        
        if success:
            logger.info(f"Код успешно отправлен на {clean_phone}")
            return jsonify({"success": True})
        else:
            logger.error(f"Ошибка отправки кода на {clean_phone}: {message}")
            return jsonify({"success": False, "error": message}), 500
        


    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "AIzaSyBQWw2CY6oO8Uf4jq08mUFmCzRNs3sO8vY") 
    GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
    GEMINI_MODEL = "gemini-2.5-flash"
    
    SYSTEM_PROMPT = """Ты — юрист Priligrim. Отвечай строго по-русски, коротко (2–4 предложения), уверенно и профессионально.
    Темы: договор оферты, возврат товара в течение 14 дней, VIP-клуб, оплата криптовалютой, защита персональных данных.
    Если вопрос не по теме — ответь: «Я специализируюсь только на юридических вопросах нашего магазина. Задайте вопрос по договору, возврату или VIP-клубу.»"""

# ───── ЗАПРОС К GEMINI API ─────

    @app.route('/api/ai', methods=['POST'])
    def ai_chat():
        try:
            data = request.get_json(silent=True) or {}
            prompt = data.get('prompt', '').strip()
            if not prompt:
                return "Задайте вопрос.", 200

            # Синхронный запрос к API Gemini
            response = httpx.post(
                            GEMINI_API_URL, 
                            params={"key": GEMINI_API_KEY},
                            json={
                                "contents": [
                                    {
                                        "role": "user",
                                        "parts": [
                                            {"text": f"{SYSTEM_PROMPT}\n\nПользовательский вопрос: {prompt}"}
                                        ]
                                    }
                                ],
                                # ИСПРАВЛЕНО: 'config' заменено на 'generationConfig'
                                "generationConfig": {
                                    "temperature": 0.6,
                                    "maxOutputTokens": 900
                                }
                            },
                            timeout=60.0
                        )

            if response.status_code != 200:
                logger.error(f"Gemini API error ({response.status_code}): {response.text}")
                # Обработка ошибок
                if response.status_code == 400:
                    return "Ошибка: Неверный запрос к Gemini API.", 200
                if response.status_code == 403:
                    return "Ошибка: Недействительный или просроченный API-ключ Gemini.", 200
                return f"Сервис временно недоступен (код {response.status_code}).", 200

            # Парсинг ответа Gemini
            response_data = response.json()
            
            # Проверка наличия ответа
            if 'candidates' in response_data and response_data['candidates']:
                answer = response_data['candidates'][0]['content']['parts'][0]['text']
            else:
                answer = "Извините, Gemini не смог сгенерировать ответ."
                logger.warning(f"Gemini не сгенерировал ответ: {response.text}")
            
            return answer

        except Exception as e:
            logger.error(f"AI error: {e}")
            return "Сервис временно недоступен.", 200

    @app.route('/api/verify_code', methods=['POST'])
    def api_verify_code():
        data = request.get_json()
        phone = data.get('phone')
        code = data.get('code', '').strip()
        client_cart = data.get('cart', [])

        if not phone or not code:
            return jsonify({"success": False, "error": "Нет номера или кода"}), 400

        # Приводим номер к единому виду
        clean_phone = ''.join(filter(str.isdigit, phone))
        if len(clean_phone) == 10:
            clean_phone = '7' + clean_phone
        elif clean_phone.startswith('8'):
            clean_phone = '7' + clean_phone[1:]

        # ПРОВЕРЯЕМ НАСТОЯЩИЙ КОД ИЗ БД
        is_valid, message = verify_user_code('+' + clean_phone, code)

        if not is_valid:
            return jsonify({"success": False, "error": message}), 401

        # Код верный → ищем или создаём пользователя
        conn = sqlite3.connect('database.db')
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        cur.execute("SELECT id, is_admin, is_blocked FROM users WHERE phone = ?", (clean_phone,))
        user = cur.fetchone()

        if not user:
            # Создаём нового пользователя
            cur.execute("""
                INSERT INTO users (phone, is_admin, is_blocked, created_at)
                VALUES (?, 0, 0, ?)
            """, (clean_phone, int(time.time())))
            user_id = cur.lastrowid
            logger.info(f"Создан новый пользователь: {clean_phone} → ID {user_id}")
        else:
            user_id = user['id']
            if user['is_blocked']:
                conn.close()
                return jsonify({"success": False, "error": "Аккаунт заблокирован"}), 403

        conn.commit()
        conn.close()

        # Успешная авторизация
        session['user_id'] = user_id
        session['phone'] = clean_phone
        session['is_admin'] = bool(user['is_admin']) if user else False

        # Сливаем корзину гостя в аккаунт
        if client_cart:
            from database_goods import merge_cart_from_client
            merge_cart_from_client(user_id, client_cart)

        logger.info(f"Успешный вход: {clean_phone} (ID: {user_id})")

        return jsonify({
            "success": True,
            "user": {
                "id": user_id,
                "phone": clean_phone,
                "is_admin": session['is_admin']
            }
        })

    @app.route('/api/logout', methods=['POST'])
    def api_logout():
        session.clear()
        return jsonify({"success": True})

    return app

# ЭТО САМОЕ ГЛАВНОЕ ДЛЯ RENDER.COM
app = create_app()

if __name__ == '__main__':
    # Локально будет работать как раньше
    logger.info("Сервер запущен локально!")
    logger.info("Админка доступна ТОЛЬКО с разрешённых IP")
    app.run(host='0.0.0.0', port=5000, debug=True)
