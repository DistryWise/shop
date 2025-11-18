# app.py (теперь — factory function)
import os
from flask import Flask

def create_app():
    app = Flask(__name__)

    # === КОНФИГ ===
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    app.config['UPLOAD_FOLDER'] = os.path.join(BASE_DIR, 'static', 'uploads')  # ← ПУТЬ ОТ app.py (../static/uploads)
    app.config['ADMIN_PASSWORD'] = 'admin123'
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB

    # Создаём папку
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    print(f"UPLOAD_FOLDER в create_app: {app.config['UPLOAD_FOLDER']}")

    # === ИМПОРТ РОУТОВ (только регистрация, без дубликатов!) ===
    from database_goods import (
        init_goods_db, init_news_db, init_services_db,
        register_admin_routes
    )

    # Инициализация БД
    init_goods_db()
    init_news_db()
    init_services_db()

    # Регистрация роутов
    register_admin_routes(app)

    # === ОСНОВНЫЕ СТРАНИЦЫ (только здесь, без дубликатов в server.py!) ===
    @app.route('/')
    def index():
        return render_template('index.html')

    @app.route('/goods')
    def goods():
        return render_template('goods.html')

    # ... (добавь другие роуты, если нужно, но лучше перенеси ВСЕ в server.py)

    return app  # ← ВОЗВРАЩАЕМ app!

if __name__ == '__main__':
    app = create_app()  # Теперь работает
    app.run(debug=True)