# server.py — ФИНАЛЬНАЯ ВЕРСИЯ С ЗАЩИТОЙ ПО IP

from flask import Flask, render_template, session, redirect, url_for, flash, request, jsonify
import logging
import os
from functools import wraps



from database_goods import (
    init_all_dbs,
    get_all_feedback, delete_feedback,
    register_admin_routes,
    get_total_users
)
from use_db import init_users_db, users_bp, track_visits
from editor import zaza_editor, init_zaza_db

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
    def policy(): return render_template('policy.html')

    @app.route('/bin')
    def bin(): return render_template('bin.html')

    @app.route('/svg')
    def svg(): return render_template('svg.html')

    @app.route('/carousel-editor')
    def carousel_editor():
        return render_template('carousel_editor.html')

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

    @app.route('/api/logout', methods=['POST'])
    def api_logout():
        session.clear()
        return jsonify({"success": True})

    return app

if __name__ == '__main__':
    app = create_app()
    logger.info("Сервер запущен!")
    logger.info("Админка доступна ТОЛЬКО с IP: 188.123.58.214")
    logger.info("http://127.0.0.1:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)