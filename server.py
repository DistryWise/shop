# server.py — ФИНАЛЬНАЯ ВЕРСИЯ С ЗАЩИТОЙ ПО IP

from flask import Flask, render_template, session, redirect, url_for, flash, request, jsonify,send_from_directory
import logging
import os
from functools import wraps
import sqlite3          
import time
import httpx
from flask_wtf.csrf import CSRFProtect
import asyncio
import json
from flask import stream_with_context, Response
from admin_goods import admin_goods_bp
from dotenv import load_dotenv

import os

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(name)s | %(message)s'
)
logger = logging.getLogger(__name__)

# ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
# ПРОПИСЫВАЕМ РУКАМИ — БЕЗ .env
ALLOWED_ADMIN_IPS = ["62.217.186.199", "188.123.58.214", "127.0.0.1", "::1"]
ADMIN_PHONES = ["79530357851"]          # ← ТВОЙ НОМЕР БЕЗ +7
# ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←

logger.info(f"IP whitelist (вшито в код): {ALLOWED_ADMIN_IPS}")
logger.info(f"Админ-телефоны (вшито в код): {ADMIN_PHONES}")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSy...твой_ключ_по_умолчанию_если_надо")
ADMIN_PASSWORD_HASH = os.getenv("ADMIN_PASSWORD_HASH", "")

# хэш пароля админа
ADMIN_PASSWORD_HASH = os.getenv("ADMIN_PASSWORD_HASH", "")

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
from profile import init_company_db, profile_bp
from bills import bills_bp
from documents import documents_bp


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
    app.secret_key = 'a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef'  
    app.config['UPLOAD_FOLDER'] = 'static/uploads'
    app.config['ADMIN_PASSWORD'] = 'admin123'
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
    
    csrf = CSRFProtect(app)  
    

    from flask_wtf.csrf import generate_csrf
    app.config['WTF_CSRF_ENABLED'] = True
    app.config['WTF_CSRF_CHECK_DEFAULT'] = True
    app.config['WTF_CSRF_METHODS'] = ['POST', 'PUT', 'PATCH', 'DELETE']
    app.config['SESSION_COOKIE_HTTPONLY'] = True    # JS не читает — оставляем всегда
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'   # Защита от CSRF — оставляем всегда

    # УМНОЕ ОПРЕДЕЛЕНИЕ: Secure только на HTTPS, на localhost — выключаем
    if app.debug or os.getenv('FLASK_ENV') == 'development':
        app.config['SESSION_COOKIE_SECURE'] = False   # ← Локально работает!
    else:
        app.config['SESSION_COOKIE_SECURE'] = True    # ← На проде — только HTTPS
    
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    # ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←

    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    # === ИНИЦИАЛИЗАЦИЯ БД ===
    logger.info("Инициализация всех БД...")
    with app.app_context():
        init_all_dbs()
        init_zaza_db()
        init_users_db()
        init_auth_db()
        init_dispatch_db()
        init_company_db()

    logger.info("Все БД готовы!")

    
    # === ОТСЛЕЖИВАНИЕ ВИЗИТОВ ===
    track_visits(app)
    
    # === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
    @app.context_processor
    def inject_globals():
        return {
            'total_users': get_total_users() if session.get('is_admin') else 0,
            'current_user_id': session.get('user_id'),
            'is_admin': session.get('is_admin', False),
            'is_real_admin': session.get('real_admin', False)  # ← ЭТО НОВОЕ! Кнопка будет только у настоящего админа
        }

    # === ЖЁСТКАЯ ЗАЩИТА АДМИНКИ ПО IP ===
    @app.before_request
    def protect_admin_routes():
        # Список всех админских путей (добавляй сюда новые, если будут)
        admin_paths = (
            '/admin', '/admin_', '/zaza_admin', '/carousel-editor',
            '/api/admin', '/admin_users', '/admin_reviews', '/admin_orders',
            '/admin_feedback','/admin_bills','/admin_documents'
        )

        if any(request.path.startswith(path) for path in admin_paths):
            client_ip = get_client_ip()

            # 1. Если IP НЕ в белом списке — сразу 404, как будто страницы нет
            if client_ip not in ALLOWED_ADMIN_IPS:
                logger.info(f"Попытка доступа к админке с чужого IP: {client_ip} → {request.path}")
                return render_template("404.html"), 404

            # 2. IP в списке, но нет метки real_admin → тоже 404 (не выдаём, что нужна авторизация)
            if 'real_admin' not in session or not session['real_admin']:
                logger.info(f"Доступ к админке без real_admin | IP: {client_ip} | Путь: {request.path}")
                return render_template("404.html"), 404

            # 3. Всё ок — пускаем
            session['is_admin'] = True
            return  # продолжаем

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

    @app.route('/admin_documents')
    def admin_documents(): return render_template('admin_documents.html')

    @app.route('/about_company')
    def about(): return render_template('about_company.html')

    @app.route('/profile/orders')
    def orders(): return render_template('orders.html')

    @app.route('/profile/agreements')
    def agreements(): return render_template('agreements.html')

    @app.route('/profile/bills')
    def bills(): return render_template('bills.html')

    @app.route('/admin_bills')
    def admin_profile(): return render_template('admin_bills.html')

    @app.route('/policy')
    def policy(): return render_template('supports/policy.html')

    from flask import request, render_template, redirect
    
    @app.route('/bin')
    def bin(): return render_template('/bin.html')

    @app.route('/favicon.ico')
    def favicon():
        return send_from_directory(os.path.join(app.root_path, 'static'),
                                'favicon.ico', mimetype='image/vnd.microsoft.icon')
    
    @app.route('/<filename>')
    def custom_favicon(filename):
        if filename in ['apple-touch-icon.png', 'favicon-32x32.png', 'favicon-16x16.png', 'site.webmanifest']:
            return send_from_directory('static', filename)
        return 'Not Found', 404  # или abort(404)

    @app.route('/cart-mobile')
    def cart_mobile():
        ua = request.headers.get('User-Agent', '').lower()
        is_mobile = any(x in ua for x in ['mobile', 'android', 'iphone', 'ipad', 'ipod', 'windows phone'])

        return redirect('/bin') if not is_mobile else render_template('cart-mobile.html')

    @app.route('/terms')
    def terms(): return render_template('supports/terms.html')

    @app.route('/delivery')
    def delivery(): return render_template('/supports/delivery.html')

    @app.route('/mobile-cart')
    def mobile(): return render_template('/mobile-cart.html')


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
    app.register_blueprint(admin_goods_bp)
    app.register_blueprint(bills_bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(documents_bp)

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
        
        # ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←← НОВАЯ CSP
        response.headers['Content-Security-Policy'] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; "
            "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; "
            "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; "
            "img-src 'self' data: blob: https:; "           # blob: для превью изображений
            "connect-src 'self'; "
            "frame-src 'self' blob:; "                     # ← КРИТИЧЕСКИ ВАЖНО для <object> и PDF
            "object-src 'self' blob:; "                    # ← для <object data="...">
            "child-src 'self' blob:; "
            "frame-ancestors 'self';"                      # ← вместо 'none' — разрешаем встраивание в себя
        )
        # ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
        
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
        data = request.get_json() or {}
        phone = data.get('phone')
        honeypot = data.get('honeypot', '').strip()
        fp_token = data.get('fp_token', '')

        # ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
        # ЗАЩИТА ОТ БОТОВ — ЕСЛИ НЕ ПРОЙДЁТ → БЛОК
        if honeypot or not fp_token:
            logger.warning(f"БОТ ЗАБЛОКИРОВАН → IP: {get_client_ip()}")
            return jsonify({"success": False, "error": "Ошибка"}), 403
        # Сохраняем fp_token как эталон для этого сеанса
        session['expected_fp_token'] = fp_token
        # ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←

        if not phone:
            return jsonify({"success": False, "error": "Некорректный номер"}), 400

        clean_phone = ''.join(filter(str.isdigit, phone))
        if len(clean_phone) == 10:
            clean_phone = '+7' + clean_phone
        elif clean_phone.startswith('8'):
            clean_phone = '+7' + clean_phone[1:]
        else:
            clean_phone = '+' + clean_phone

        success, message = generate_and_send_code(clean_phone)
        if success:
            return jsonify({"success": True})
        else:
            return jsonify({"success": False, "error": message}), 500
        


    # === DEEPSEEK API КОНФИГУРАЦИЯ ===
    DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "sk-bfab6af1ca424cd0b8280975a01b5774") 
    DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"
    DEEPSEEK_MODEL = "deepseek-chat"  # или "deepseek-reasoner"

    SYSTEM_PROMPT = """Ты — официальный AI-помощник маркетплейса Piligrim Services (piligrim-services.ru).

    Мы помогаем быстро и легально открыть и вести бизнес в России и за рубежом:
    • Регистрация ООО и ИП (с ЭЦП, без визита в налоговую)
    • Готовые компании с историей и оборотами
    • Лицензии (МЧС, ФСБ, алкоголь, медицина, строительство и др.)
    • Бухгалтерское обслуживание
    • Юридический адрес и массовые адреса
    • Открытие расчётных счетов
    • Крипто-лицензии и регистрация за рубежом
    • Консультации юристов и бухгалтеров

    Отвечай ТОЛЬКО на русском, коротко (2–5 предложений), уверенно, по делу и дружелюбно.
    Ты отлично знаешь весь каталог, актуальные цены и сроки оказания услуг.
    Никогда не говори, что ты «специализируешься только на юридических вопросах» — ты помощник по ВСЕМ услугам платформы.

    Важные правила ответа:
    - Если человек спрашивает про конкретную услугу — назови актуальную цену и срок сразу.
    - Если есть несколько вариантов — предложи самый популярный и самый быстрый.
    - Всегда предлагай перейти к оформлению: «Могу оформить для вас прямо сейчас» или «Готовы начать оформление?».
    - Если вопрос технический по сайту — отвечай чётко: как добавить в корзину, где найти чек, как оплатить криптой и т.д.

    Примеры правильных ответов:

    Вопрос: Сколько стоит регистрация ООО под ключ?
    Ответ: Регистрация ООО с ЭЦП и открытием счёта в банке — 14 900 ₽. Всё делаем удалённо за 3 рабочих дня. Готовы начать оформление прямо сейчас?

    Вопрос: Есть ли готовые ООО с оборотами?
    Ответ: Да, в наличии более 50 компаний от 6 месяцев до 3 лет, обороты от 10 млн до 1 млрд+. Самые популярные сейчас — строительные и торговые. Подберу под ваш вид деятельности за 2 минуты.

    Вопрос: Как оплатить криптовалютой?
    Ответ: После добавления услуги в корзину выбираете «Оплата криптовалютой» — система выдаст адрес кошелька (USDT, BTC, ETH). Зачисляем моментально, без комиссий с нашей стороны.

    Вопрос: Где найти договор оферты?
    Ответ: Публичная оферта находится в подвале сайта по ссылке «Договор-оферта», а также приходит на почту сразу после оплаты заказа.
    """

    # ───── ЗАПРОС К DEEPSEEK API ─────
    @app.route('/api/ai', methods=['POST'])
    def ai_chat():
        try:
            data = request.get_json(silent=True) or {}
            prompt = data.get('prompt', '').strip()
            if not prompt:
                return "Задайте вопрос.", 200

            # Формируем запрос в формате DeepSeek API
            headers = {
                "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": DEEPSEEK_MODEL,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": 900,
                "temperature": 0.6,
                "stream": False
            }

            # Синхронный запрос к API DeepSeek
            response = httpx.post(
                DEEPSEEK_API_URL,
                headers=headers,
                json=payload,
                timeout=60.0
            )

            if response.status_code != 200:
                logger.error(f"DeepSeek API error ({response.status_code}): {response.text}")
                if response.status_code == 401:
                    return "Ошибка: Недействительный API-ключ DeepSeek.", 200
                if response.status_code == 429:
                    return "Лимит запросов исчерпан. Попробуйте позже.", 200
                return f"Сервис временно недоступен (код {response.status_code}).", 200

            # Парсинг ответа DeepSeek
            response_data = response.json()
            
            # Извлекаем текст ответа
            if 'choices' in response_data and response_data['choices']:
                answer = response_data['choices'][0]['message']['content']
            else:
                answer = "Извините, DeepSeek не смог сгенерировать ответ."
                logger.warning(f"DeepSeek не сгенерировал ответ: {response.text}")
            
            return answer

        except httpx.TimeoutException:
            logger.error("DeepSeek API timeout")
            return "Сервис временно недоступен (таймаут).", 200
        except Exception as e:
            logger.error(f"AI error: {e}")
        return "Сервис временно недоступен.", 200

    @app.route('/api/verify_code', methods=['POST'])
    def api_verify_code():
        data = request.get_json() or {}
        phone = data.get('phone')
        code = data.get('code', '').strip()
        honeypot = data.get('honeypot', '').strip()
        fp_token = data.get('fp_token', '')

        # ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
        # ЗАЩИТА ОТ БОТОВ — СТРОГАЯ ПРОВЕРКА
        if honeypot or not fp_token or fp_token != session.get('expected_fp_token'):
            logger.warning(f"БОТ НА ПРОВЕРКЕ КОДА → IP: {get_client_ip()}")
            return jsonify({"success": False, "error": "Ошибка"}), 403
        # ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←

        if not phone or not code:
            return jsonify({"success": False, "error": "Нет данных"}), 400

        clean_phone = ''.join(filter(str.isdigit, phone))
        if len(clean_phone) == 10:
            clean_phone = '7' + clean_phone
        elif clean_phone.startswith('8'):
            clean_phone = '7' + clean_phone[1:]

        is_valid, message = verify_user_code('+' + clean_phone, code)
        if not is_valid:
            return jsonify({"success": False, "error": message}), 401

        # Ищем или создаём пользователя
        conn = sqlite3.connect('database.db')
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        cur.execute("SELECT id, is_admin, is_blocked FROM users WHERE phone = ?", (clean_phone,))
        user = cur.fetchone()

        if not user:
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

        # === ГЛАВНАЯ ЛОГИКА АДМИН-ДОСТУПА ===
        client_ip = get_client_ip()

        # ОТЛАДКА — теперь ты точно увидишь, что происходит
        logger.info(f"Проверка админа → IP: {client_ip} | в списке: {client_ip in ALLOWED_ADMIN_IPS}")
        logger.info(f"Проверка админа → Телефон: {clean_phone} | в списке: {clean_phone in ADMIN_PHONES}")

        # Это ТЫ? (IP + телефон из .env)
        is_real_admin = (client_ip in ALLOWED_ADMIN_IPS) and (clean_phone in ADMIN_PHONES)

        # Записываем флаги — без else, который всё ломает!
        session['real_admin'] = is_real_admin
        session['is_admin'] = is_real_admin or (user['is_admin'] if user else False)

        if is_real_admin:
            logger.warning(f"АДМИН ВОШЁЛ В СИСТЕМУ | {clean_phone} | IP: {client_ip}")
        else:
            logger.info(f"Обычный вход | {clean_phone} | IP: {client_ip}")

        # Записываем базовые данные в сессию
        session['user_id'] = user_id
        session['phone'] = clean_phone

        guest_id = session.get('guest_id')
        if guest_id:
            conn = sqlite3.connect('database.db')
            conn.row_factory = sqlite3.Row
            try:
                # Собираем товары гостя
                guest_items = conn.execute(
                    'SELECT product_id, quantity FROM guest_cart_items WHERE guest_id = ?',
                    (guest_id,)
                ).fetchall()
                # Собираем услуги гостя
                guest_services = conn.execute(
                    'SELECT service_id, quantity FROM guest_cart_services WHERE guest_id = ?',
                    (guest_id,)
                ).fetchall()

                # Переносим товары
                for row in guest_items:
                    conn.execute('''
                        INSERT INTO cart_items (user_id, product_id, quantity)
                        VALUES (?, ?, ?)
                        ON CONFLICT(user_id, product_id) DO UPDATE
                        SET quantity = quantity + excluded.quantity
                    ''', (user_id, row['product_id'], row['quantity']))

                # Переносим услуги
                for row in guest_services:
                    conn.execute('''
                        INSERT INTO cart_services (user_id, service_id, quantity)
                        VALUES (?, ?, ?)
                        ON CONFLICT(user_id, service_id) DO UPDATE
                        SET quantity = quantity + excluded.quantity
                    ''', (user_id, row['service_id'], row['quantity']))

                # Очищаем гостевую корзину
                conn.execute('DELETE FROM guest_cart_items WHERE guest_id = ?', (guest_id,))
                conn.execute('DELETE FROM guest_cart_services WHERE guest_id = ?', (guest_id,))
                conn.commit()

                # Удаляем guest_id из сессии
                session.pop('guest_id', None)

                logger.info(f"Корзина гостя {guest_id} перенесена пользователю {user_id}")
            except Exception as e:
                logger.error(f"Ошибка переноса корзины при входе: {e}")
                conn.rollback()
            finally:
                conn.close()
        # ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←

        # Финальный лог
        logger.info(f"Вход: {clean_phone} (ID: {user_id}) | is_admin: {session['is_admin']} | real_admin: {session['real_admin']}")

        return jsonify({
            "success": True,
            "cart_merged": bool(guest_id),  # ← вот это!
            "user": {
                "id": user_id,
                "phone": clean_phone,
                "is_admin": session['is_admin']
            }
        })
    # Это заставит Flask отдавать файлы из static/uploads
    @app.route('/static/uploads/<path:filename>')
    def uploaded_files(filename):
        return send_from_directory('static/uploads', filename)

    # Опционально: защита от обхода директорий
    @app.route('/static/uploads/')
    def uploaded_index():
        return "Доступ запрещён", 403

    @app.route('/api/logout', methods=['POST'])
    def api_logout():
        # Удаляем только данные пользователя — CSRF-токен остаётся живым!
        for key in ['user_id', 'phone', 'is_admin', 'real_admin', 'is_real_admin']:
            session.pop(key, None)
        
        return jsonify({"success": True})

    return app

# ЭТО САМОЕ ГЛАВНОЕ ДЛЯ RENDER.COM
app = create_app()

if __name__ == '__main__':
    # Локально будет работать как раньше
    logger.info("Сервер запущен локально!")
    logger.info("Админка доступна ТОЛЬКО с разрешённых IP")
    app.run(host='0.0.0.0', port=5000, debug=True)
