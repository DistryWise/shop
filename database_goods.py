# database_goods.py — ФИНАЛЬНАЯ ВЕРСИЯ 500% (ЗАКАЗЫ + СТАТУСЫ + ОТМЕНА + ЦЕПОЧКА + АДМИНКА)
import sqlite3
import os
import json
import threading
import time
import logging
import uuid
import hashlib
import urllib.parse
from flask import (
    request, flash, redirect, url_for,
    render_template, send_from_directory,
    jsonify, current_app, session
)
from werkzeug.utils import secure_filename
from markupsafe import escape
from datetime import datetime
from flask import send_from_directory, current_app, abort
from markupsafe import Markup
from datetime import datetime, timedelta



logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# === ПУТИ К БД ===
DB_MAIN = 'database.db'
DB_NEWS = 'news.db'
DB_SERVICES = 'services.db'
DB_FEEDBACK = 'feedback.db'


    # Кэш для rate limit (в памяти, перезапускается при рестарте)
_feedback_cooldown = {}  # { (ip, user_id): timestamp }

COOLDOWN_SECONDS = 5 * 60  # 5 минут




status_map = {
    'pending': ('В процессе', '#8fb3ff', '#0b0d12'),
    'processing': ('В обработке', '#a3bffa', '#0b0d12'),
    'shipping': ('В доставке', '#ffd93d', '#0b0d12'),
    'completed': ('Выполнено', '#a0e7a0', '#0b0d12'),
    'cancelled': ('Отменён', '#ff6b6b', '#0b0d12'),
}

def get_conn(db_name):
    conn = sqlite3.connect(db_name)
    conn.row_factory = sqlite3.Row
    return conn

# === БЕЗОПАСНЫЕ УТИЛИТЫ ===
def safe_placeholder(text):
    safe = urllib.parse.quote(str(text or "Товар")[:20].encode('utf-8'))
    return f"https://via.placeholder.com/600x300/1a1a1a/00d2ff?text={safe}"


def cleanup_cooldown():
    threading.Timer(1800, cleanup_cooldown).start()  # каждые 30 мин
    now = time.time()
    to_remove = [k for k, t in _feedback_cooldown.items() if now - t > COOLDOWN_SECONDS]
    for k in to_remove:
        del _feedback_cooldown[k]

cleanup_cooldown()  # запуск

# === АВТО-МИГРАЦИЯ КОРЗИНЫ ===
def migrate_cart_if_needed():
    conn = get_conn(DB_MAIN)
    try:
        conn.execute("SELECT 1 FROM cart_items LIMIT 1")
        cur = conn.execute("PRAGMA table_info(cart_items)")
        columns = [row['name'] for row in cur.fetchall()]
        if 'user_id' not in columns or 'product_id' not in columns:
            raise Exception("Нет колонок")
        cur = conn.execute("PRAGMA index_list(cart_items)")
        indexes = cur.fetchall()
        has_unique = any(
            idx['unique'] and 'user_id' in [i['name'] for i in conn.execute(f"PRAGMA index_info({idx['name']})").fetchall()]
            for idx in indexes
        )
        if has_unique:
            logger.info("Корзина уже с UNIQUE — миграция не нужна")
            return
        raise Exception("Нет UNIQUE")
    except Exception as e:
        logger.warning(f"Мигрируем корзину: {e}")
        try:
            conn.execute('ALTER TABLE cart_items RENAME TO cart_items_old')
            conn.execute('''
                CREATE TABLE cart_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    product_id INTEGER NOT NULL,
                    quantity INTEGER DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                    FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
                    UNIQUE(user_id, product_id)
                )
            ''')
            conn.execute('''
                INSERT INTO cart_items (user_id, product_id, quantity)
                SELECT user_id, product_id, SUM(quantity)
                FROM cart_items_old
                GROUP BY user_id, product_id
                ON CONFLICT(user_id, product_id) DO UPDATE SET quantity = excluded.quantity
            ''')
            conn.execute('DROP TABLE cart_items_old')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_cart_user ON cart_items(user_id)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_cart_product ON cart_items(product_id)')
            conn.commit()
            logger.info("Корзина УСПЕШНО мигрирована!")
        except Exception as mig_e:
            logger.error(f"Ошибка миграции корзины: {mig_e}")
            conn.rollback()
        finally:
            conn.close()

# database_goods.py — только логика БД
def create_product(title, price, description, category, brand, image_filenames):
    conn = get_conn(DB_MAIN)
    try:
        conn.execute("""
            INSERT INTO products 
            (title, price, description, category, brand, image_filenames, in_stock, stock)
            VALUES (?, ?, ?, ?, ?, ?, 1, -1)
        """, (title, price, description, category, brand, json.dumps(image_filenames)))
        conn.commit()
        return conn.lastrowid
    except Exception as e:
        logger.error(f"create_product error: {e}")
        conn.rollback()
        return None
    finally:
        conn.close()

# === ИНИЦИАЛИЗАЦИЯ БД ===
def init_goods_db():
    conn = get_conn(DB_MAIN)
    try:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                price INTEGER NOT NULL,
                description TEXT,
                category TEXT NOT NULL,
                brand TEXT,
                image_filenames TEXT DEFAULT '[]',
                in_stock BOOLEAN DEFAULT 1,
                stock INTEGER DEFAULT -1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()
        try:
            conn.execute("SELECT image_filenames FROM products LIMIT 1")
        except sqlite3.OperationalError:
            conn.execute("ALTER TABLE products ADD COLUMN image_filenames TEXT DEFAULT '[]'")
            conn.commit()
        if conn.execute('SELECT COUNT(*) FROM products').fetchone()[0] == 0:
            conn.execute('''
                INSERT INTO products (title, price, description, category, brand, image_filenames, in_stock, stock)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', ('iPhone 15 Pro', 12999000, 'Титановый корпус, A17 Pro, 48 МП камера', 'phones', 'Apple', '[]', 1, -1))
            conn.commit()
            logger.info("Добавлен тестовый товар")
    except Exception as e:
        logger.error(f"init_goods_db: {e}")
    finally:
        conn.close()

def init_users_db():
    conn = get_conn(DB_MAIN)
    try:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phone TEXT UNIQUE NOT NULL,
                is_admin BOOLEAN DEFAULT 0,
                is_blocked BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()
        try:
            conn.execute("SELECT is_blocked FROM users LIMIT 1")
        except sqlite3.OperationalError:
            conn.execute("ALTER TABLE users ADD COLUMN is_blocked BOOLEAN DEFAULT 0")
            conn.commit()
        test_users = [
            ('+79990000001', 1, 0),
            ('+79001234567', 0, 0),
            ('+79009876543', 0, 1),
            ('+79161234567', 0, 0),
            ('+79261234567', 0, 0),
            ('+79361234567', 0, 0),
        ]
        for phone, is_admin, is_blocked in test_users:
            try:
                conn.execute('INSERT INTO users (phone, is_admin, is_blocked) VALUES (?, ?, ?)', (phone, is_admin, is_blocked))
            except sqlite3.IntegrityError:
                pass
        conn.commit()
        logger.info("Добавлены тестовые пользователи")
    except Exception as e:
        logger.error(f"init_users_db: {e}")
    finally:
        conn.close()

def init_cart_db():
    conn = get_conn(DB_MAIN)
    try:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS cart_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                quantity INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
                UNIQUE(user_id, product_id)
            )
        ''')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_cart_user ON cart_items(user_id)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_cart_product ON cart_items(product_id)')
        conn.commit()
        logger.info("Корзина товаров создана с UNIQUE")
    except Exception as e:
        logger.error(f"init_cart_db: {e}")
    finally:
        conn.close()

def init_guest_cart_db():
    conn = get_conn(DB_MAIN)
    try:
        # Товары в гостевой корзине
        conn.execute('''
            CREATE TABLE IF NOT EXISTS guest_cart_items (
                guest_id TEXT NOT NULL,
                product_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 1,
                PRIMARY KEY (guest_id, product_id),
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
            )
        ''')
        # Услуги в гостевой корзине
        conn.execute('''
            CREATE TABLE IF NOT EXISTS guest_cart_services (
                guest_id TEXT NOT NULL,
                service_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 1,
                PRIMARY KEY (guest_id, service_id)
            )
        ''')
        # Индексы для скорости
        conn.execute('CREATE INDEX IF NOT EXISTS idx_guest_items_guest ON guest_cart_items(guest_id)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_guest_services_guest ON guest_cart_services(guest_id)')
        conn.commit()
        logger.info("Гостевые таблицы корзины созданы успешно!")
    except Exception as e:
        logger.error(f"init_guest_cart_db error: {e}")
    finally:
        conn.close()

def init_cart_services():
    conn = get_conn(DB_MAIN)
    try:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS cart_services (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                service_id INTEGER NOT NULL,
                quantity INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE,
                UNIQUE(user_id, service_id)
            )
        ''')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_cart_serv_user ON cart_services(user_id)')
        conn.commit()
        logger.info("Таблица cart_services создана")
    except Exception as e:
        logger.error(f"init_cart_services: {e}")
    finally:
        conn.close()

def init_reviews_db():
    conn = get_conn(DB_MAIN)
    try:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS reviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                user_phone TEXT,
                item_type TEXT NOT NULL CHECK(item_type IN ('product', 'service')),
                item_id INTEGER NOT NULL,
                rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
                text TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
            )
        ''')

        # === ГАРАНТИРОВАННО ДОБАВЛЯЕМ СТОЛБЦЫ ===
        cur = conn.execute("PRAGMA table_info(reviews)")
        columns = [row['name'] for row in cur.fetchall()]

        if 'item_title' not in columns:
            conn.execute("ALTER TABLE reviews ADD COLUMN item_title TEXT")
            logger.info("Добавлен столбец item_title в reviews")

        if 'user_phone' not in columns:
            conn.execute("ALTER TABLE reviews ADD COLUMN user_phone TEXT")
            logger.info("Добавлен столбец user_phone в reviews")

        conn.commit()
        logger.info("Таблица reviews готова")
    except Exception as e:
        logger.error(f"init_reviews_db: {e}")
    finally:
        conn.close()

def init_orders_db():
    conn = get_conn(DB_MAIN)
    cursor = conn.cursor()
    try:
        # === 1. Создаём таблицу orders — БЕЗ UNIQUE на display_id! ===
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                full_name TEXT NOT NULL,
                phone TEXT NOT NULL,
                total_cents INTEGER NOT NULL,
                status TEXT DEFAULT 'pending',
                cancel_reason TEXT,
                display_id TEXT,                          -- ← УБРАЛИ UNIQUE! Личный номер → дубли разрешены!
                user_order_number INTEGER NOT NULL DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        ''')

        # === 2. УБИРАЕМ UNIQUE с display_id, если он был (главная причина ошибки!) ===
        try:
            cursor.execute("DROP INDEX IF EXISTS orders_display_id_idx")
            cursor.execute("DROP INDEX IF EXISTS uniq_display_id")
            cursor.execute("DROP INDEX IF EXISTS idx_orders_display_id")
            # На случай, если UNIQUE был встроен в саму таблицу — пересоздаём колонку
            cursor.execute("PRAGMA table_info(orders)")
            columns = [row[1] for row in cursor.fetchall()]
            if 'display_id' in columns:
                # Проверяем, есть ли UNIQUE в определении колонки
                cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'")
                table_sql = cursor.fetchone()[0]
                if 'UNIQUE' in table_sql.upper() and 'DISPLAY_ID' in table_sql.upper():
                    logger.info("Обнаружен UNIQUE на display_id → пересоздаём таблицу без него")
                    cursor.execute("ALTER TABLE orders RENAME TO orders_with_unique")
                    cursor.execute('''
                        CREATE TABLE orders (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            user_id INTEGER NOT NULL,
                            full_name TEXT NOT NULL,
                            phone TEXT NOT NULL,
                            total_cents INTEGER NOT NULL,
                            status TEXT DEFAULT 'pending',
                            cancel_reason TEXT,
                            display_id TEXT,
                            user_order_number INTEGER NOT NULL DEFAULT 1,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                        )
                    ''')
                    cursor.execute('''
                        INSERT INTO orders SELECT 
                            id, user_id, full_name, phone, total_cents, 
                            status, cancel_reason, display_id, user_order_number, created_at
                        FROM orders_with_unique
                    ''')
                    cursor.execute("DROP TABLE orders_with_unique")
                    logger.info("Таблица orders пересоздана БЕЗ UNIQUE на display_id — теперь всё работает!")
        except Exception as e:
            logger.warning(f"Не удалось убрать UNIQUE индекс: {e}")

        # === 3. Добавляем display_id и user_order_number, если их нет ===
        cursor.execute("PRAGMA table_info(orders)")
        columns = {row[1] for row in cursor.fetchall()}

        if 'display_id' not in columns:
            cursor.execute("ALTER TABLE orders ADD COLUMN display_id TEXT")
            logger.info("Добавлена колонка display_id")

        if 'user_order_number' not in columns:
            cursor.execute("ALTER TABLE orders ADD COLUMN user_order_number INTEGER NOT NULL DEFAULT 1")
            logger.info("Добавлена колонка user_order_number")

        if 'created_at' not in columns:
            cursor.execute("ALTER TABLE orders ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP")
            logger.info("Добавлена колонка created_at")

        # === 4. order_items ===
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                item_type TEXT NOT NULL CHECK(item_type IN ('product', 'service')),
                item_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                price_cents INTEGER NOT NULL,
                quantity INTEGER NOT NULL,
                FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
            )
        ''')

        # === 5. (Опционально) Пересчитываем display_id для всех существующих заказов ===
        cursor.execute("SELECT COUNT(*) FROM orders WHERE display_id IS NULL OR display_id = ''")
        null_count = cursor.fetchone()[0]
        if null_count > 0:
            logger.info(f"Пересчитываем display_id для {null_count} старых заказов...")
            cursor.execute('''
                WITH numbered AS (
                    SELECT 
                        id,
                        user_id,
                        STRFTIME('%Y', created_at) AS year,
                        ROW_NUMBER() OVER (PARTITION BY user_id, STRFTIME('%Y', created_at) ORDER BY id) AS num
                    FROM orders 
                    WHERE created_at IS NOT NULL
                )
                UPDATE orders 
                SET display_id = printf('%s-%04d', year, num)
                FROM numbered 
                WHERE orders.id = numbered.id AND (display_id IS NULL OR display_id = '')
            ''')
            logger.info("display_id восстановлен для старых заказов")

        conn.commit()
        logger.info("init_orders_db: ГОТОВО! display_id — личный, без UNIQUE, всё идеально!")

    except Exception as e:
        logger.error(f"init_orders_db: ОШИБКА — {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

def init_news_db():
    conn = get_conn(DB_NEWS)
    try:
        # Создаём таблицу с 4 фото сразу
        conn.execute('''
            CREATE TABLE IF NOT EXISTS news (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                date TEXT NOT NULL,
                short_desc TEXT,
                full_desc TEXT,
                image1 TEXT,
                image2 TEXT,
                image3 TEXT,
                image4 TEXT,
                category TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Проверяем, какие колонки есть
        cur = conn.execute("PRAGMA table_info(news)")
        columns = {row['name'] for row in cur.fetchall()}

        # Если была старая колонка image_filename — переносим её в image1
        if 'image_filename' in columns and 'image1' not in columns:
            conn.execute("ALTER TABLE news ADD COLUMN image1 TEXT")
            conn.execute("UPDATE news SET image1 = image_filename WHERE image_filename != '' AND image_filename IS NOT NULL")
            logger.info("Перенесены старые фото в image1")

        # Добавляем недостающие image2, image3, image4
        for col in ['image2', 'image3', 'image4']:
            if col not in columns:
                conn.execute(f"ALTER TABLE news ADD COLUMN {col} TEXT")
                logger.info(f"Добавлена колонка {col}")

        # Удаляем старую колонку, если она была
        if 'image_filename' in columns:
            # SQLite не позволяет просто DROP COLUMN, поэтому пересоздаём таблицу
            conn.execute('PRAGMA foreign_keys = OFF')
            conn.execute('BEGIN TRANSACTION')

            conn.execute('''
                CREATE TABLE news_backup (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    date TEXT NOT NULL,
                    short_desc TEXT,
                    full_desc TEXT,
                    image1 TEXT,
                    image2 TEXT,
                    image3 TEXT,
                    image4 TEXT,
                    category TEXT,
                    created_at DATETIME
                )
            ''')

            conn.execute('''
                INSERT INTO news_backup 
                SELECT id, title, date, short_desc, full_desc, 
                       image1, image2, image3, image4, category, created_at 
                FROM news
            ''')

            conn.execute('DROP TABLE news')
            conn.execute('ALTER TABLE news_backup RENAME TO news')
            conn.execute('COMMIT')
            conn.execute('PRAGMA foreign_keys = ON')
            logger.info("Удалена старая колонка image_filename, таблица обновлена")

        # Добавляем category, если нет
        if 'category' not in columns:
            conn.execute("ALTER TABLE news ADD COLUMN category TEXT")

        conn.commit()
        logger.info("БД news обновлена до версии с 4 фото")

    except Exception as e:
        logger.error(f"init_news_db error: {e}", exc_info=True)
        conn.rollback()
    finally:
        conn.close()

def init_services_db():
    conn = get_conn(DB_SERVICES)
    cursor = conn.cursor()
    try:
        cursor.execute("PRAGMA table_info(services)")
        columns = {row['name'] for row in cursor.fetchall()}

        # === 1. Если таблица старая — пересоздаём с новой схемой ===
        if 'image_urls' not in columns or 'sort_order' not in columns:
            logger.info("Мигрируем services.db → новая схема (sort_order + updated_at)")

            if 'services' in [t[0] for t in cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]:
                cursor.execute("ALTER TABLE services RENAME TO services_old")

            cursor.execute('''
                CREATE TABLE services (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    price TEXT NOT NULL,
                    short_desc TEXT NOT NULL,
                    full_desc TEXT NOT NULL,
                    image_urls TEXT DEFAULT '[]',  -- ← Теперь по умолчанию пустой JSON!
                    category TEXT,
                    sort_order INTEGER DEFAULT 999999,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')

            # Восстанавливаем данные из старой таблицы
            if 'services_old' in [t[0] for t in cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]:
                old_cols = {row['name'] for row in cursor.execute("PRAGMA table_info(services_old)").fetchall()}
                select_fields = ['id', 'title', 'price', 'short_desc', 'full_desc']

                if 'image_urls' in old_cols:
                    select_fields.append('image_urls')
                else:
                    select_fields.append("'' as image_urls")
                if 'category' in old_cols:
                    select_fields.append('category')
                else:
                    select_fields.append("NULL as category")
                if 'created_at' in old_cols:
                    select_fields.append('created_at')
                else:
                    select_fields.append("datetime('now') as created_at")

                select_sql = ', '.join(select_fields)
                cursor.execute(f'''
                    INSERT INTO services (id, title, price, short_desc, full_desc, image_urls, category, created_at)
                    SELECT {select_sql} FROM services_old
                ''')
                cursor.execute("DROP TABLE services_old")

            logger.info("Таблица services успешно мигрирована с sort_order и updated_at")

        else:
            # === 2. Частичные миграции (если просто не хватает полей) ===
            if 'sort_order' not in columns:
                logger.info("Добавляем sort_order в services")
                cursor.execute("ALTER TABLE services ADD COLUMN sort_order INTEGER DEFAULT 999999")

            if 'updated_at' not in columns:
                logger.info("Добавляем updated_at в services")
                cursor.execute("ALTER TABLE services ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP")

            if 'category' not in columns:
                logger.info("Добавляем category в services")
                cursor.execute("ALTER TABLE services ADD COLUMN category TEXT")

        # === 3. Миграция старых строк "img1.jpg,img2.jpg" → JSON ["img1.jpg","img2.jpg"] ===
        # (выполнится один раз, если в БД ещё строки через запятую)
        # === 3. ЖЁСТКАЯ МИГРАЦИЯ image_urls → всегда валидный JSON массив ===
        logger.info("Запускаем принудительную очистку image_urls → валидный JSON")
        cursor.execute("SELECT id, image_urls FROM services")
        updated = 0
        for row in cursor.fetchall():
            raw = row['image_urls'] or ''
            raw = raw.strip()

            # Если уже валидный JSON-массив — оставляем
            if raw.startswith('[') and raw.endswith(']'):
                try:
                    test = json.loads(raw)
                    if isinstance(test, list):
                        continue  # уже норм
                except:
                    pass  # битый — починим ниже

            # Всё остальное — принудительно в []
            filenames = []
            if raw and not raw.startswith('['):
                # Пробуем распарсить как старый формат через запятую
                parts = [p.strip() for p in raw.split(',') if p.strip()]
                # Фильтруем только валидные имена файлов
                filenames = [p for p in parts if re.match(r'^[a-zA-Z0-9_-]+\.(jpe?g|png|webp|gif)$', p, re.IGNORECASE)]

            new_json = json.dumps(filenames)
            cursor.execute("UPDATE services SET image_urls = ? WHERE id = ?", (new_json, row['id']))
            updated += 1

        if updated:
            logger.info(f"Очищено/исправлено image_urls в {updated} записях")
            conn.commit()
        else:
            logger.info("image_urls уже в порядке")

        # === 4. Индекс по sort_order ===
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_services_sort ON services(sort_order)")

        # === 5. Тестовые данные (только если пусто) ===
        count = cursor.execute("SELECT COUNT(*) FROM services").fetchone()[0]
        if count == 0:
            test_services = [
                ('Разработка сайта', 'от 50 000 ₽', 'Адаптивный дизайн под ключ', '<p>Полный цикл: от идеи до запуска.</p>', 'web_development'),
                ('SEO-продвижение', 'от 30 000 ₽/мес', 'Вывод в ТОП-10', '<p>Аудит, семантика, контент, ссылки.</p>', 'seo'),
                ('Техподдержка 24/7', 'от 15 000 ₽/мес', 'Мониторинг и защита', '<p>Обновления, бэкапы, DDoS-защита.</p>', 'support'),
                ('Консультация юриста', 'от 5 000 ₽', 'Онлайн-помощь', '<p>Гражданское, семейное, трудовое право.</p>', 'legal_services'),
            ]
            cursor.executemany('''
                INSERT INTO services (title, price, short_desc, full_desc, category, sort_order, image_urls)
                VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM services), '[]')
            ''', test_services)
            logger.info("Добавлены актуальные тестовые услуги")

        conn.commit()
        logger.info("init_services_db: УСПЕШНО! БД готова к работе с JSON в image_urls")

    except Exception as e:
        logger.error(f"init_services_db ФАТАЛЬНАЯ ОШИБКА: {e}", exc_info=True)
        conn.rollback()
    finally:
        conn.close()

def init_feedback_db():
    conn = get_conn(DB_FEEDBACK)
    try:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS feedback (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                phone TEXT,
                message TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()
        logger.info("БД feedback создана с id")
    except Exception as e:
        logger.error(f"init_feedback_db: {e}")
    finally:
        conn.close()

def init_all_dbs():
    logger.info("Инициализация всех БД...")
    init_goods_db()
    init_users_db()
    init_cart_db()
    migrate_cart_if_needed()
    init_cart_services()
    init_reviews_db()
    init_orders_db()
    init_news_db()
    init_services_db()
    init_feedback_db()
    init_guest_cart_db()
    migrate_user_order_numbers()
    logger.info("Все БД инициализированы + заказы + статусы + миграция!")

def get_total_users():
    conn = get_conn(DB_MAIN)
    try:
        return conn.execute('SELECT COUNT(*) FROM users').fetchone()[0]
    except Exception as e:
        logger.error(f"get_total_users: {e}")
        return 0
    finally:
        conn.close()

def parse_price_to_cents(price_str):
    try:
        return int(''.join(filter(str.isdigit, price_str))) * 100
    except:
        return 0

def get_total_reviews():
    conn = get_conn(DB_MAIN)
    try:
        return conn.execute('SELECT COUNT(*) FROM reviews').fetchone()[0]
    except Exception as e:
        logger.error(f"get_total_reviews: {e}")
        return 0
    finally:
        conn.close()


def get_all_feedback():
    conn = get_conn(DB_FEEDBACK)
    try:
        rows = conn.execute('SELECT * FROM feedback ORDER BY created_at DESC').fetchall()
        return [dict(row) for row in rows]
    except Exception as e:
        logger.error(f"get_all_feedback: {e}")
        return []
    finally:
        conn.close()

def delete_feedback(fid):
    conn = get_conn(DB_FEEDBACK)
    try:
        conn.execute('DELETE FROM feedback WHERE id = ?', (int(fid),))
        conn.commit()
        return True
    except Exception as e:
        logger.error(f"delete_feedback: {e}")
        return False
    finally:
        conn.close()

def delete_feedback_batch(ids):
    """Удаляет несколько заявок по списку id"""
    conn = get_conn(DB_FEEDBACK)
    try:
        placeholders = ','.join(['?' for _ in ids])
        conn.execute(f'DELETE FROM feedback WHERE id IN ({placeholders})', ids)
        conn.commit()
        return True
    except Exception as e:
        print("Ошибка удаления:", e)
        conn.rollback()
        return False
    finally:
        conn.close()

# === СЛИЯНИЕ КОРЗИНЫ ПРИ ВХОДЕ ===
# === СЛИЯНИЕ КОРЗИНЫ ПРИ ЛОГИНЕ — РАБОТАЕТ ПО ID, БЕЗОПАСНО, НАДЁЖНО ===
def merge_cart_from_client(user_id, client_cart):
    """
    client_cart = [
        {"id": 5, "type": "product", "quantity": 1},
        {"id": 3, "type": "service", "quantity": 2},
        ...
    ]
    """
    if not client_cart:
        return

    conn_main = get_conn(DB_MAIN)
    conn_serv = get_conn(DB_SERVICES)
    try:
        for item in client_cart:
            item_id = item.get("id")
            item_type = item.get("type", "product")
            quantity = max(1, int(item.get("quantity", 1)))

            if not item_id:
                continue

            if item_type == "product":
                # Проверяем, что товар вообще существует
                exists = conn_main.execute(
                    "SELECT 1 FROM products WHERE id = ?", (item_id,)
                ).fetchone()
                if not exists:
                    logger.warning(f"Гость пытался слить несуществующий товар id={item_id}")
                    continue

                conn_main.execute("""
                    INSERT INTO cart_items (user_id, product_id, quantity)
                    VALUES (?, ?, ?)
                    ON CONFLICT(user_id, product_id) DO UPDATE
                    SET quantity = quantity + excluded.quantity
                """, (user_id, item_id, quantity))

            elif item_type == "service":
                exists = conn_serv.execute(
                    "SELECT 1 FROM services WHERE id = ?", (item_id,)
                ).fetchone()
                if not exists:
                    logger.warning(f"Гость пытался слить несуществующую услугу id={item_id}")
                    continue

                conn_main.execute("""
                    INSERT INTO cart_services (user_id, service_id, quantity)
                    VALUES (?, ?, ?)
                    ON CONFLICT(user_id, service_id) DO UPDATE
                    SET quantity = quantity + excluded.quantity
                """, (user_id, item_id, quantity))

        conn_main.commit()
        logger.info(f"Успешно смёрджена корзина гостя → user_id={user_id}, items={len(client_cart)}")
    except Exception as e:
        logger.error(f"merge_cart_from_client error: {e}", exc_info=True)
        conn_main.rollback()
    finally:
        conn_main.close()
        conn_serv.close()

def migrate_user_order_numbers():
    conn = get_conn(DB_MAIN)
    cursor = conn.cursor()
    try:
        # 1. Добавляем колонку, если её ещё нет
        cursor.execute("PRAGMA table_info(orders)")
        columns = [row['name'] for row in cursor.fetchall()]
        if 'user_order_number' not in columns:
            cursor.execute("ALTER TABLE orders ADD COLUMN user_order_number INTEGER DEFAULT 0")
            logger.info("Добавлена колонка user_order_number")

        # 2. Если в таблице есть заказы — нумеруем их
        cursor.execute("SELECT COUNT(*) FROM orders")
        if cursor.fetchone()[0] == 0:
            logger.info("Таблица orders пуста — нумерация не требуется")
            return

        # (остальной код нумерации без изменений)
        cursor.execute("SELECT DISTINCT user_id FROM orders WHERE user_order_number = 0 OR user_order_number IS NULL")
        user_ids = [row['user_id'] for row in cursor.fetchall()]

        total_updated = 0
        for user_id in user_ids:
            cursor.execute("""
                SELECT id FROM orders 
                WHERE user_id = ? AND (user_order_number = 0 OR user_order_number IS NULL)
                ORDER BY created_at ASC, id ASC
            """, (user_id,))
            order_ids = [row['id'] for row in cursor.fetchall()]

            for number, order_id in enumerate(order_ids, start=1):
                cursor.execute("UPDATE orders SET user_order_number = ? WHERE id = ?", (number, order_id))
                total_updated += 1

        conn.commit()
        logger.info(f"Миграция завершена: обновлено {total_updated} заказов")

    except Exception as e:
        logger.error(f"Ошибка миграции: {e}", exc_info=True)
        conn.rollback()
    finally:
        conn.close()

migrate_user_order_numbers()  

# === РЕГИСТРАЦИЯ РОУТОВ ===
def register_admin_routes(app):
    @app.template_filter('fromjson')
    def fromjson_filter(s):
        try:
            return json.loads(s) if s else []
        except:
            return []

    @app.template_filter('escapejs')
    def escapejs_filter(s):
        return json.dumps(s)
    
    @app.route('/static/uploads/news/<path:filename>')
    def uploaded_news_file(filename):
        if '..' in filename or filename.startswith('/'):
            abort(403)
        upload_folder = os.path.join('static', 'uploads', 'news')
        if not os.path.exists(upload_folder):
            abort(404)
        try:
            return send_from_directory(upload_folder, filename)
        except:
            abort(404)

    @app.route('/static/uploads/<filename>')
    def uploaded_file(filename):
        if '..' in filename or filename.startswith('/') or filename.lower().startswith(('javascript:', 'data:', 'vbscript:')):
            return "Forbidden", 403
        upload_folder = current_app.config.get('UPLOAD_FOLDER')
        if not upload_folder:
            logger.error("UPLOAD_FOLDER не задан")
            return "Ошибка", 500
        os.makedirs(upload_folder, exist_ok=True)
        try:
            return send_from_directory(upload_folder, filename)
        except Exception as e:
            logger.error(f"Файл {filename}: {e}")
            return "Файл не найден", 404

    @app.route('/feedback', methods=['POST'])
    def feedback_submit():
        try:
            data = request.get_json()
            if not data:
                return jsonify({"success": False, "message": "Нет данных"}), 400
            success, message = submit_feedback(data)
            return jsonify({"success": success, "message": message})
        except Exception as e:
            logger.error(f"feedback_submit: {e}")
            return jsonify({"success": False, "message": "Ошибка сервера"}), 500
        


    @app.route('/api/feedback', methods=['POST'])
    def api_submit_feedback():
        # === 1. АВТОРИЗАЦИЯ ===
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Требуется авторизация'}), 401
     

        # === 3. RATE LIMIT (IP + user_id) ===
        ip = request.remote_addr
        if request.headers.get('X-Forwarded-For'):
            ip = request.headers.get('X-Forwarded-For').split(',')[0].strip()
        key = (ip, str(user_id))

        now = time.time()
        last = _feedback_cooldown.get(key)
        if last and now - last < COOLDOWN_SECONDS:
            remaining = int(COOLDOWN_SECONDS - (now - last))
            return jsonify({'error': f'Подождите {remaining} сек.', 'retry_after': remaining}), 429

        # === 4. ДАННЫЕ ===
        data = request.get_json()
        name = data.get('name', '').strip()
        email = data.get('email', '').strip()
        message = data.get('message', '').strip()
        phone = session.get('phone', '')

        if not all([name, email, message]):
            return jsonify({'error': 'Заполните все поля'}), 400
        if len(name) > 100 or len(email) > 100 or len(message) > 2000:
            return jsonify({'error': 'Слишком длинный текст'}), 400

        # === 5. СОХРАНЕНИЕ ===
        try:
            conn = get_conn(DB_FEEDBACK)
            conn.execute(
                'INSERT INTO feedback (name, email, phone, message) VALUES (?, ?, ?, ?)',
                (name, email, phone, message)
            )
            conn.commit()
            conn.close()

            _feedback_cooldown[key] = now
            return jsonify({'success': True, 'message': 'Спасибо! Мы ответим в течение часа'}), 200
        except Exception as e:
            logging.error(f"Feedback error: {e}")
            return jsonify({'error': 'Ошибка сервера'}), 500


    from flask import jsonify, request

    # В database_goods.py — в конце файла
    from flask import jsonify

    @app.route('/api/home_news')
    def api_home_news():
        try:
            print("→ Открываем news.db по пути:", DB_NEWS)

            conn = sqlite3.connect(DB_NEWS)
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()

            # ← ИСПРАВЛЕНО: больше НЕТ image_filename! Берём image1-image4
            cur.execute('''
                SELECT 
                    id, title, date, short_desc, full_desc, 
                    image1, image2, image3, image4,
                    category
                FROM news 
                ORDER BY id DESC 
                LIMIT 12
            ''')
            rows = cur.fetchall()

            news = []
            for row in rows:
                n = dict(row)

                # Собираем все непустые изображения
                images = [
                    img for img in [n.get('image1'), n.get('image2'), 
                                n.get('image3'), n.get('image4')] 
                    if img
                ]

                # Главное изображение (первое) — для карточки
                main_img = images[0] if images else None
                img_url = f"/static/uploads/news/{main_img}" if main_img else "/static/assets/no-image.png"

                news.append({
                    'id': n['id'],
                    'title': n['title'],
                    'date': n['date'],
                    'short_desc': n['short_desc'],
                    'full_desc': n['full_desc'],
                    'image': img_url,                    # ← для карточки
                    'images': [f"/static/uploads/news/{img}" for img in images],  # ← все фото
                    'category': n.get('category') or ''
                })

            conn.close()
            print(f"→ Успешно отдано {len(news)} новостей")
            return jsonify(news)

        except Exception as e:
            print("ОШИБКА /api/home_news:", e)
            import traceback
            traceback.print_exc()
            return jsonify([]), 500

    @app.route('/api/cart/add', methods=['POST'])
    def api_cart_add():
        if 'user_id' not in session:
            return jsonify({'error': 'Not logged in'}), 401

        data = request.get_json() or {}
        user_id = session['user_id']

        product_id = data.get('product_id')
        service_id = data.get('service_id')
        quantity = max(1, int(data.get('quantity', 1) or 1))

        if not product_id and not service_id:
            return jsonify({'error': 'Не указан ID товара или услуги'}), 400

        conn = get_conn(DB_MAIN)
        serv_conn = get_conn(DB_SERVICES)

        try:
            if product_id:
                product_id = int(product_id)

                # ← ПРОВЕРЯЕМ НАЛИЧИЕ И STOCK
                product = conn.execute('SELECT stock, title FROM products WHERE id = ?', (product_id,)).fetchone()
                if not product:
                    return jsonify({'error': 'Товар не найден'}), 404

                current_stock = product['stock']

                # ← ГЛАВНАЯ ПРОВЕРКА
                if current_stock != -1:  # если не бесконечное количество
                    # Сколько уже в корзине
                    existing = conn.execute(
                        'SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?',
                        (user_id, product_id)
                    ).fetchone()
                    in_cart = existing[0] if existing else 0
                    total_wanted = in_cart + quantity

                    if total_wanted > current_stock:
                        return jsonify({
                            'error': f'Недостаточно товара! В наличии только {current_stock} шт.'
                        }), 400

                # Всё ок — добавляем
                conn.execute('''
                    INSERT INTO cart_items (user_id, product_id, quantity)
                    VALUES (?, ?, ?)
                    ON CONFLICT(user_id, product_id) DO UPDATE 
                    SET quantity = quantity + excluded.quantity
                ''', (user_id, product_id, quantity))

            elif service_id:
                # Услуги обычно без лимита — оставляем как было
                service_id = int(service_id)
                exists = serv_conn.execute('SELECT 1 FROM services WHERE id = ?', (service_id,)).fetchone()
                if not exists:
                    return jsonify({'error': 'Услуга не найдена'}), 404

                conn.execute('''
                    INSERT INTO cart_services (user_id, service_id, quantity)
                    VALUES (?, ?, ?)
                    ON CONFLICT(user_id, service_id) DO UPDATE 
                    SET quantity = quantity + excluded.quantity
                ''', (user_id, service_id, quantity))

            conn.commit()
            return jsonify({'success': True})

        except ValueError:
            return jsonify({'error': 'Неверный ID'}), 400
        except Exception as e:
            logger.error(f"cart_add error: {e}")
            conn.rollback()
            return jsonify({'error': 'Ошибка сервера'}), 500
        finally:
            conn.close()
            serv_conn.close()
  

    @app.route('/api/cart/update', methods=['POST'])
    def api_cart_update():
        if 'user_id' not in session:
            return jsonify({'error': 'Not logged in'}), 401

        data = request.get_json() or {}
        user_id = session['user_id']

        product_id = data.get('product_id')
        service_id = data.get('service_id')
        quantity = int(data.get('quantity', 0))

        if quantity < 0:
            quantity = 0

        conn = get_conn(DB_MAIN)

        try:
            if product_id is not None:
                product_id = int(product_id)

                if quantity == 0:
                    conn.execute('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?', (user_id, product_id))
                else:
                    # ← ПРОВЕРКА НАЛИЧИЯ НА СКЛАДЕ
                    product = conn.execute('SELECT stock FROM products WHERE id = ?', (product_id,)).fetchone()
                    if not product:
                        return jsonify({'error': 'Товар не найден'}), 404

                    if product['stock'] != -1 and quantity > product['stock']:
                        return jsonify({
                            'error': f'Нельзя столько! В наличии только {product["stock"]} шт.'
                        }), 400

                    conn.execute('''
                        INSERT INTO cart_items (user_id, product_id, quantity)
                        VALUES (?, ?, ?)
                        ON CONFLICT(user_id, product_id) DO UPDATE SET quantity = excluded.quantity
                    ''', (user_id, product_id, quantity))

            elif service_id is not None:
                service_id = int(service_id)
                if quantity == 0:
                    conn.execute('DELETE FROM cart_services WHERE user_id = ? AND service_id = ?', (user_id, service_id))
                else:
                    conn.execute('''
                        INSERT INTO cart_services (user_id, service_id, quantity)
                        VALUES (?, ?, ?)
                        ON CONFLICT(user_id, service_id) DO UPDATE SET quantity = excluded.quantity
                    ''', (user_id, service_id, quantity))
            else:
                return jsonify({'error': 'Не указан ID'}), 400

            conn.commit()
            return jsonify({'success': True})

        except Exception as e:
            logger.error(f"cart_update error: {e}")
            conn.rollback()
            return jsonify({'error': 'Ошибка'}), 500
        finally:
            conn.close()
    # === КОРЗИНА: ПОЛУЧЕНИЕ ДЛЯ АВТОРИЗОВАННЫХ ===
    @app.route('/api/cart/get')
    def api_cart_get():
        if 'user_id' not in session:
            return jsonify([])

        conn = get_conn(DB_MAIN)
        serv_conn = get_conn(DB_SERVICES)
        items = []

        try:
            user_id = session['user_id']

            rows = conn.execute('''
                SELECT p.id, p.title, p.price, ci.quantity, p.image_filenames, p.stock
                FROM cart_items ci
                JOIN products p ON ci.product_id = p.id
                WHERE ci.user_id = ?
            ''', (user_id,)).fetchall()

            for row in rows:
                imgs = json.loads(row['image_filenames'] or '[]')
                img_url = f"/static/uploads/goods/{imgs[0]}" if imgs else '/static/assets/no-image.png'
                price_cents = int(row['price'])
                items.append({
                    'id': row['id'],
                    'title': row['title'],
                    'price_cents': price_cents,
                    'quantity': row['quantity'],
                    'type': 'product',
                    'image_url': img_url,
                    'max_available': row['stock'] if row['stock'] is not None else -1  # ← ВОТ ЭТО ВСЁ ИСПРАВИЛО!
                })

            # === УСЛУГИ ===
            rows = conn.execute('''
                SELECT cs.service_id, cs.quantity
                FROM cart_services cs
                WHERE cs.user_id = ?
            ''', (user_id,)).fetchall()

            for row in rows:
                service = serv_conn.execute('''
                    SELECT id, title, price, image_urls FROM services WHERE id = ?
                ''', (row['service_id'],)).fetchone()
                if not service:
                    continue

                try:
                    image_urls = json.loads(service['image_urls'] or '[]')
                    if not isinstance(image_urls, list):
                        image_urls = []
                except:
                    image_urls = [u.strip() for u in (service['image_urls'] or '').split(',') if u.strip()]

                img_url = f"/static/uploads/services/{image_urls[0]}" if image_urls else '/static/assets/no-image.png'
                price_cents = parse_price_to_cents(service['price'])  # или int(service['price']) если уже копейки

                items.append({
                    'id': service['id'],
                    'title': service['title'],
                    'price_cents': price_cents,
                    'quantity': row['quantity'],
                    'type': 'service',
                    'image_url': img_url
                })

            return jsonify(items)

        except Exception as e:
            logger.error(f"cart_get error: {e}")
            return jsonify([])
        finally:
            conn.close()
            serv_conn.close()

    @app.route('/api/cart/guest/add', methods=['POST'])
    def api_cart_guest_add():
        guest_id = session.get('guest_id')
        if not guest_id:
            guest_id = str(uuid.uuid4())
            session['guest_id'] = guest_id

        data = request.get_json() or {}
        product_id = data.get('product_id')
        service_id = data.get('service_id')
        quantity = max(1, int(data.get('quantity', 1)))

        conn = get_conn(DB_MAIN)
        try:
            if product_id:
                product_id = int(product_id)
                product = conn.execute('SELECT stock, price FROM products WHERE id = ?', (product_id,)).fetchone()
                if not product:
                    return jsonify({'error': 'Товар не найден'}), 404

                # Считаем текущее количество в гостевой корзине
                current = conn.execute(
                    'SELECT quantity FROM guest_cart_items WHERE guest_id = ? AND product_id = ?',
                    (guest_id, product_id)
                ).fetchone()
                in_cart = current[0] if current else 0
                total = in_cart + quantity

                if product['stock'] != -1 and total > product['stock']:
                    return jsonify({'error': f'В наличии только {product["stock"]} шт.'}), 400

                conn.execute('''
                    INSERT INTO guest_cart_items (guest_id, product_id, quantity)
                    VALUES (?, ?, ?)
                    ON CONFLICT(guest_id, product_id) DO UPDATE 
                    SET quantity = quantity + excluded.quantity
                ''', (guest_id, product_id, quantity))

            elif service_id:
                service_id = int(service_id)
                conn.execute('''
                    INSERT INTO guest_cart_services (guest_id, service_id, quantity)
                    VALUES (?, ?, ?)
                    ON CONFLICT(guest_id, service_id) DO UPDATE 
                    SET quantity = quantity + excluded.quantity
                ''', (guest_id, service_id, quantity))

            conn.commit()
            return jsonify({'success': True, 'guest_id': guest_id})

        except Exception as e:
            logger.error(f"guest add error: {e}")
            conn.rollback()
            return jsonify({'error': 'Ошибка'}), 500
        finally:
            conn.close()

    @app.route('/api/cart/guest/get')
    def api_cart_guest_get():
        guest_id = session.get('guest_id')
        if not guest_id:
            return jsonify([])

        conn = get_conn(DB_MAIN)
        serv_conn = get_conn(DB_SERVICES)
        items = []

        try:
            # ТОВАРЫ
            rows = conn.execute('''
                SELECT p.id, p.title, p.price, gci.quantity, p.image_filenames, p.stock
                FROM guest_cart_items gci
                JOIN products p ON gci.product_id = p.id
                WHERE gci.guest_id = ?
            ''', (guest_id,)).fetchall()

            for row in rows:
                imgs = json.loads(row['image_filenames'] or '[]')
                img_url = f"/static/uploads/goods/{imgs[0]}" if imgs else '/static/assets/no-image.png'
                items.append({
                    'id': row['id'],
                    'title': row['title'],
                    'price_cents': int(row['price']),
                    'quantity': row['quantity'],
                    'type': 'product',
                    'image_url': img_url,
                    'max_available': row['stock'] if row['stock'] is not None else -1
                })

            # УСЛУГИ
            rows = conn.execute('''
                SELECT gcs.service_id, gcs.quantity
                FROM guest_cart_services gcs
                WHERE gcs.guest_id = ?
            ''', (guest_id,)).fetchall()

            for row in rows:
                service = serv_conn.execute('SELECT id, title, price, image_urls FROM services WHERE id = ?', (row['service_id'],)).fetchone()
                if not service:
                    continue

                try:
                    image_urls = json.loads(service['image_urls'] or '[]')
                except:
                    image_urls = [u.strip() for u in (service['image_urls'] or '').split(',') if u.strip()]

                img_url = f"/static/uploads/services/{image_urls[0]}" if image_urls else '/static/assets/no-image.png'

                items.append({
                    'id': service['id'],
                    'title': service['title'],
                    'price_cents': parse_price_to_cents(service['price']),
                    'quantity': row['quantity'],
                    'type': 'service',
                    'image_url': img_url
                })

            return jsonify(items)

        except Exception as e:
            logger.error(f"guest cart get error: {e}")
            return jsonify([])
        finally:
            conn.close()
            serv_conn.close()


    @app.route('/api/cart/guest/update', methods=['POST'])
    def api_cart_guest_update():
        guest_id = session.get('guest_id')
        if not guest_id:
            return jsonify({'error': 'No guest session'}), 401

        data = request.get_json() or {}
        product_id = data.get('product_id')
        service_id = data.get('service_id')
        quantity = int(data.get('quantity', 0))

        if quantity < 0:
            quantity = 0

        conn = get_conn(DB_MAIN)

        try:
            if product_id is not None:
                product_id = int(product_id)

                if quantity == 0:
                    conn.execute('DELETE FROM guest_cart_items WHERE guest_id = ? AND product_id = ?', (guest_id, product_id))
                else:
                    # Проверка остатка
                    product = conn.execute('SELECT stock FROM products WHERE id = ?', (product_id,)).fetchone()
                    if not product:
                        return jsonify({'error': 'Товар не найден'}), 404
                    if product['stock'] != -1 and quantity > product['stock']:
                        return jsonify({'error': f'В наличии только {product["stock"]} шт.'}), 400

                    conn.execute('''
                        INSERT INTO guest_cart_items (guest_id, product_id, quantity)
                        VALUES (?, ?, ?)
                        ON CONFLICT(guest_id, product_id) DO UPDATE SET quantity = excluded.quantity
                    ''', (guest_id, product_id, quantity))

            elif service_id is not None:
                service_id = int(service_id)
                if quantity == 0:
                    conn.execute('DELETE FROM guest_cart_services WHERE guest_id = ? AND service_id = ?', (guest_id, service_id))
                else:
                    conn.execute('''
                        INSERT INTO guest_cart_services (guest_id, service_id, quantity)
                        VALUES (?, ?, ?)
                        ON CONFLICT(guest_id, service_id) DO UPDATE SET quantity = excluded.quantity
                    ''', (guest_id, service_id, quantity))

            else:
                return jsonify({'error': 'Не указан ID товара или услуги'}), 400

            conn.commit()
            return jsonify({'success': True})

        except Exception as e:
            logger.error(f"guest update error: {e}")
            conn.rollback()
            return jsonify({'error': 'Ошибка'}), 500
        finally:
            conn.close()



    @app.route('/api/checkout', methods=['POST'])
    def api_checkout():
        if 'user_id' not in session:
            return jsonify({'error': 'Not logged in'}), 401

        data = request.get_json()
        full_name = data.get('full_name', '').strip()
        phone = data.get('phone', '').strip()
        if not full_name or not phone:
            return jsonify({'error': 'Заполните ФИО и телефон'}), 400

        conn_main = get_conn(DB_MAIN)
        conn_services = get_conn(DB_SERVICES)

        try:
            user_id = session['user_id']
            items = []

            # === Сбор корзины (оставляем как есть) ===
            rows = conn_main.execute('''
                SELECT p.id, p.title, p.price, ci.quantity
                FROM cart_items ci
                JOIN products p ON ci.product_id = p.id
                WHERE ci.user_id = ?
            ''', (user_id,)).fetchall()

            for row in rows:
                items.append({
                    'id': row['id'],
                    'title': row['title'],
                    'price_cents': row['price'],
                    'price_str': f"{row['price']//100}.{row['price']%100:02d} ₽",
                    'quantity': row['quantity'],
                    'type': 'product'
                })

            service_rows = conn_main.execute('''
                SELECT cs.service_id, cs.quantity FROM cart_services cs WHERE cs.user_id = ?
            ''', (user_id,)).fetchall()

            for srow in service_rows:
                service = conn_services.execute('SELECT title, price FROM services WHERE id = ?', (srow['service_id'],)).fetchone()
                if not service: continue
                price_cents = parse_price_to_cents(service['price'])
                items.append({
                    'id': srow['service_id'],
                    'title': service['title'],
                    'price_cents': price_cents,
                    'price_str': service['price'],
                    'quantity': srow['quantity'],
                    'type': 'service'
                })

            if not items:
                return jsonify({'error': 'Корзина пуста'}), 400

            total_cents = sum(item['price_cents'] * item['quantity'] for item in items)

            # === ГЕНЕРАЦИЯ ЛИЧНОГО НОМЕРА ===
            current_year = datetime.now().year

            # Считаем, сколько заказов уже было у этого пользователя в этом году
            last_num_row = conn_main.execute('''
                SELECT COALESCE(MAX(CAST(SUBSTR(display_id, INSTR(display_id, '-') + 1) AS INTEGER)), 0) as num
                FROM orders
                WHERE user_id = ? AND SUBSTR(display_id, 1, 4) = ?
            ''', (user_id, str(current_year))).fetchone()

            next_num = last_num_row['num'] + 1
            raw_display_id = f"{current_year}-{next_num:04d}"        # 2025-0001
            pretty_display_id = f"№{raw_display_id}"                 # №2025-0001

            # === СОЗДАЁМ ЗАКАЗ — ВСТАВЛЯЕМ ТОЛЬКО raw_display_id (БЕЗ №) ===
            cur = conn_main.execute('''
                INSERT INTO orders (
                    user_id, full_name, phone, total_cents, status,
                    display_id, user_order_number
                ) VALUES (?, ?, ?, ?, 'pending', ?, ?)
                RETURNING id
            ''', (user_id, full_name, phone, total_cents, raw_display_id, next_num))

            order_id = cur.fetchone()[0]

            # === Добавляем товары ===
            for item in items:
                conn_main.execute('''
                    INSERT INTO order_items (order_id, item_type, item_id, title, price_cents, quantity)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (order_id, item['type'], item['id'], item['title'], item['price_cents'], item['quantity']))

            # === Очистка корзины ===
            conn_main.execute('DELETE FROM cart_items WHERE user_id = ?', (user_id,))
            conn_main.execute('DELETE FROM cart_services WHERE user_id = ?', (user_id,))
            conn_main.commit()

            return jsonify({
                'success': True,
                'order_id': order_id,
                'display_id': pretty_display_id,
                'raw_display_id': raw_display_id,
                'message': f'Заказ {pretty_display_id} создан!',
                # ← ЭТО ОДНА СТРОЧКА, и всё заработает идеально
                'items': [
                    {
                        'id': item['id'],
                        'type': item['type'],
                        'title': item['title']
                    }
                    for item in items
                ]
            })

        except Exception as e:
            logger.error(f"checkout error: {e}")
            conn_main.rollback()
            return jsonify({'error': 'Ошибка сервера'}), 500
        finally:
            conn_main.close()
            conn_services.close()

    @app.route('/api/order_status_public/<int:order_id>')
    def api_order_status_public(order_id):
        phone = request.args.get('phone')
        if not phone:
            return jsonify({"error": "Phone required"}), 400
        
        conn = get_conn(DB_MAIN)
        try:
            order = conn.execute('''
                SELECT status, cancel_reason, display_id 
                FROM orders 
                WHERE id = ? AND phone = ?
            ''', (order_id, phone)).fetchone()

            if not order:
                return jsonify({"error": "Not found"}), 404
                
            status = order['status']
            label = status_map.get(status, ('Неизвестно', '#9ca3af', '#0b0d12'))

            return jsonify({
                "status": status,
                "label": label[0],
                "display_id": order['display_id'] or f"#{order_id}",  # ← №2025-0001
                "can_cancel": status in ['pending', 'processing'],
                "completed": status in ['completed', 'cancelled'],
                "cancel_reason": order['cancel_reason'] or None
            })
        finally:
            conn.close()

   
    @app.route('/admin_feedback', methods=['GET', 'POST'])
    def admin_feedback():
        # Защита админки
        if not session.get('is_admin'):
            if request.method == 'POST':
                return jsonify({'success': False, 'message': 'Доступ запрещён'}), 403
            flash('Доступ запрещён', 'error')
            return redirect(url_for('index'))

        conn_fb = get_conn(DB_FEEDBACK)

        try:
            # === POST — УДАЛЕНИЕ (только JSON!) ===
            if request.method == 'POST':
                # Теперь принимаем ТОЛЬКО JSON (как отправляет твой JS)
                if not request.is_json:
                    return jsonify({'success': False, 'message': 'Неверный формат данных'}), 400

                data = request.get_json()
                password = data.get('password', '').strip()

                # ПРЯМАЯ ПРОВЕРКА: admin123
                if password != 'admin123':
                    return jsonify({'success': False, 'message': 'Неверный пароль администратора'})

                # Удаление всех
                if data.get('delete_all'):
                    conn_fb.execute('DELETE FROM feedback')
                    conn_fb.commit()
                    return jsonify({'success': True, 'message': 'Все заявки удалены!'})

                # Удаление по списку ID
                ids = data.get('ids', [])
                if not ids or not isinstance(ids, list):
                    return jsonify({'success': False, 'message': 'Не выбрано ни одной заявки'})

                # Защита: превращаем в int
                try:
                    ids = [int(i) for i in ids]
                except:
                    return jsonify({'success': False, 'message': 'Неверный формат ID'})

                placeholders = ','.join('?' for _ in ids)
                conn_fb.execute(f'DELETE FROM feedback WHERE id IN ({placeholders})', ids)
                conn_fb.commit()

                return jsonify({'success': True, 'message': f'Удалено заявок: {len(ids)}'})

            # === GET — обычная страница ===
            page = max(1, request.args.get('page', 1, type=int) or 1)
            per_page = 20
            offset = (page - 1) * per_page

            total_feedback = conn_fb.execute('SELECT COUNT(*) FROM feedback').fetchone()[0]
            total_pages = max(1, (total_feedback + per_page - 1) // per_page)

            rows = conn_fb.execute('''
                SELECT id, name, email, phone, message, created_at
                FROM feedback
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            ''', (per_page, offset)).fetchall()

            feedbacks = [dict(row) for row in rows]

            conn_main = get_conn(DB_MAIN)
            total_users   = conn_main.execute('SELECT COUNT(*) FROM users').fetchone()[0]
            total_orders  = conn_main.execute('SELECT COUNT(*) FROM orders').fetchone()[0]
            total_reviews = conn_main.execute('SELECT COUNT(*) FROM reviews').fetchone()[0]
            conn_main.close()

        except Exception as e:
            logger.error(f"admin_feedback error: {e}")
            if request.method == 'POST':
                return jsonify({'success': False, 'message': 'Ошибка сервера'}), 500
            flash('Ошибка загрузки данных', 'error')
            feedbacks = []
            total_feedback = total_pages = page = 1
            total_users = total_orders = total_reviews = 0

        finally:
            conn_fb.close()

        return render_template(
            'admin_callback.html',
            feedbacks=feedbacks,
            total_feedback=total_feedback,
            total_users=total_users,
            total_orders=total_orders,
            total_reviews=total_reviews,
            page=page,
            total_pages=total_pages
        )

    @app.route('/api/order_status/<int:order_id>')
    def api_order_status(order_id):
        is_admin = request.args.get('admin', '0') == '1'
        if is_admin:
            password = request.args.get('password')
            if password != current_app.config.get('ADMIN_PASSWORD', 'admin123'):
                return jsonify({"error": "Unauthorized"}), 401
        elif 'user_id' not in session:
            return jsonify({"error": "Unauthorized"}), 401

        conn_main = get_conn(DB_MAIN)
        conn_serv = get_conn(DB_SERVICES)  # ← обязательно открываем services.db
        try:
            # 1. Сам заказ
            params = [order_id]
            query = 'SELECT status, cancel_reason, display_id, total_cents FROM orders WHERE id = ?'
            if not is_admin:
                query += ' AND user_id = ?'
                params.append(session['user_id'])

            order = conn_main.execute(query, params).fetchone()
            if not order:
                return jsonify({"error": "Not found"}), 404

            status = order['status']
            label = status_map.get(status, ('Неизвестно', '#9ca3af', '#0b0d12'))[0]

            # 2. Все позиции заказа
            items_raw = conn_main.execute('''
                SELECT item_type, item_id, title, price_cents, quantity
                FROM order_items
                WHERE order_id = ?
                ORDER BY id
            ''', [order_id]).fetchall()

            items = []
            for item in items_raw:
                image_url = None
                item_type = item['item_type']

                if item_type == 'product':
                    prod = conn_main.execute(
                        'SELECT image_filenames FROM products WHERE id = ?',
                        (item['item_id'],)
                    ).fetchone()
                    if prod and prod['image_filenames']:
                        try:
                            imgs = json.loads(prod['image_filenames'])
                            if imgs and isinstance(imgs, list) and imgs[0]:
                                image_url = f"/static/uploads/goods/{imgs[0]}"
                        except:
                            pass

                elif item_type == 'service':
                    serv = conn_serv.execute(
                        'SELECT image_urls FROM services WHERE id = ?',
                        (item['item_id'],)
                    ).fetchone()
                    if serv and serv['image_urls']:
                        try:
                            imgs = json.loads(serv['image_urls'])
                            if imgs and isinstance(imgs, list) and imgs[0]:
                                image_url = f"/static/uploads/services/{imgs[0]}"
                        except:
                            # если JSON битый — пробуем старый формат через запятую
                            imgs = [x.strip() for x in str(serv['image_urls']).split(',') if x.strip()]
                            if imgs:
                                image_url = f"/static/uploads/services/{imgs[0]}"

                # ← Если по какой-то причине нет фото — ставим заглушку
                if not image_url:
                    if item_type == 'service':
                        image_url = "/static/assets/service-placeholder.png"
                    else:
                        image_url = "/static/assets/no-image.png"

                price_str = f"{item['price_cents']/100:,.2f} ₽".replace(',', ' ')

                items.append({
                    "title": item['title'],
                    "quantity": item['quantity'],
                    "price_cents": item['price_cents'],
                    "price_str": price_str,
                    "image_url": image_url,      # ← ВСЕГДА есть URL!
                    "item_type": item_type
                })

            total_str = f"{(order['total_cents'] or 0)/100:,.2f} ₽".replace(',', ' ')

            return jsonify({
                "status": status,
                "label": label,
                "display_id": order['display_id'] or f"№{order_id:04d}",
                "can_cancel": status in ['pending', 'processing'],
                "completed": status in ['completed', 'cancelled'],
                "cancel_reason": order['cancel_reason'],

                "items": items,       # ← с реальными фотками и товаров, и услуг!
                "total_str": total_str
            })

        except Exception as e:
            logger.error(f"order_status error #{order_id}: {e}", exc_info=True)
            return jsonify({"error": "Server error"}), 500
        finally:
            conn_main.close()
            conn_serv.close()

    @app.route('/api/user_archived_orders')
    def user_archived_orders():
        if not session.get('user_id'):
            return jsonify([])

        conn = get_conn(DB_MAIN)
        try:
            rows = conn.execute('''
                SELECT id, status, cancel_reason, display_id, created_at
                FROM orders 
                WHERE user_id = ? AND status IN ('completed', 'cancelled')
                ORDER BY id DESC
            ''', (session['user_id'],)).fetchall()

            orders = []
            for r in rows:
                order_id = r['id']
                status = r['status']

                # === Товары и услуги ===
                items_rows = conn.execute('''
                    SELECT oi.title, oi.quantity, oi.price_cents, oi.item_type, oi.item_id
                    FROM order_items oi
                    WHERE oi.order_id = ?
                ''', (order_id,)).fetchall()

                items = []
                total_cents = 0

                for item in items_rows:
                    price_cents = int(item['price_cents'] or 0)
                    total_cents += price_cents * item['quantity']

                    # === ГЕНЕРАЦИЯ image_url — ГЛАВНОЕ ИСПРАВЛЕНИЕ ===
                    image_url = "/static/assets/no-image.png"

                    if item['item_type'] == 'product':
                        prod = conn.execute('SELECT image_filenames FROM products WHERE id = ?', (item['item_id'],)).fetchone()
                        if prod and prod['image_filenames']:
                            try:
                                imgs = json.loads(prod['image_filenames'])
                                if imgs and isinstance(imgs, list) and imgs:
                                    image_url = f"/static/uploads/goods/{imgs[0]}"
                            except:
                                pass  # если json сломался — оставляем no-image

                    elif item['item_type'] == 'service':
                        serv_conn = get_conn(DB_SERVICES)
                        try:
                            serv = serv_conn.execute('SELECT image_urls FROM services WHERE id = ?', (item['item_id'],)).fetchone()
                            if serv and serv['image_urls']:
                                try:
                                    imgs = json.loads(serv['image_urls'])
                                except:
                                    imgs = [img.strip() for img in serv['image_urls'].split(',') if img.strip()]
                                if imgs and imgs[0]:
                                    image_url = f"/static/uploads/services/{imgs[0]}"
                        finally:
                            serv_conn.close()

                    # === Добавляем ВСЁ нужное для фронта ===
                    items.append({
                        'title': item['title'],
                        'quantity': item['quantity'],
                        'price_str': f"{price_cents // 100}.{price_cents % 100:02d} ₽",
                        'item_type': item['item_type'],      # ← обязательно!
                        'item_id': item['item_id'],          # ← обязательно для "Повторить"
                        'image_url': image_url               # ← теперь всегда правильный путь
                    })

                total_str = f"{total_cents // 100}.{total_cents % 100:02d} ₽"

                orders.append({
                    'id': order_id,
                    'display_id': r['display_id'] or f"#{order_id}",
                    'status': status,
                    'items': items,
                    'total_str': total_str,
                    'created_at': r['created_at'],
                    'cancel_reason': r['cancel_reason'] or ''
                })

            return jsonify(orders)

        except Exception as e:
            logger.error(f"user_archived_orders error: {e}")
            return jsonify([])
        finally:
            conn.close()

    # === АДМИН: СМЕНА СТАТУСА ===
    @app.route('/api/admin/set_status', methods=['POST'])
    def admin_set_status():
        data = request.get_json()
        password = data.get('password')
        if password != current_app.config.get('ADMIN_PASSWORD', 'admin123'):
            return jsonify({"error": "Forbidden"}), 403
        order_id = data.get('order_id')
        status = data.get('status')
        if status not in status_map:
            return jsonify({"error": "Invalid status"}), 400
        conn = get_conn(DB_MAIN)
        try:
            # Списание со склада при переходе в completed
            if status == 'completed':
                items = conn.execute('SELECT item_type, item_id, quantity FROM order_items WHERE order_id = ?', (order_id,)).fetchall()
                for item in items:
                    if item['item_type'] == 'product':
                        p = conn.execute('SELECT stock FROM products WHERE id = ?', (item['item_id'],)).fetchone()
                        if p and p['stock'] >= 0:
                            new_stock = max(0, p['stock'] - item['quantity'])
                            conn.execute('UPDATE products SET stock = ? WHERE id = ?', (new_stock, item['item_id']))
            conn.execute('UPDATE orders SET status = ? WHERE id = ?', (status, order_id))
            conn.commit()
            return jsonify({"success": True})
        except Exception as e:
            logger.error(f"admin_set_status: {e}")
            return jsonify({"error": "Failed"}), 500
        finally:
            conn.close()

    # === АДМИН: ОТМЕНА С ПРИЧИНОЙ ===
    @app.route('/api/admin/cancel_order', methods=['POST'])
    def admin_cancel_order():
        if not is_admin(): return jsonify({"error": "Forbidden"}), 403
        data = request.json
        order_id = data['order_id']
        reason = data['reason'].strip()
        if not reason: return jsonify({"error": "Reason required"}), 400
        conn = get_conn(DB_MAIN)
        try:
            conn.execute('UPDATE orders SET status = ?, cancel_reason = ? WHERE id = ?', ('cancelled', reason, order_id))
            conn.commit()
            return jsonify({"success": True})
        except Exception as e:
            logger.error(e)
            return jsonify({"error": "Failed"}), 500
        finally:
            conn.close()

    # === ОТМЕНА ЗАКАЗА ===
    @app.route('/api/cancel_order', methods=['POST'])
    def api_cancel_order():
        if 'user_id' not in session:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        data = request.json
        order_id = data.get('order_id')
        reason = data.get('reason', '').strip()
        if not reason:
            return jsonify({"success": False, "error": "Укажите причину"}), 400
        conn = get_conn(DB_MAIN)
        try:
            order = conn.execute('SELECT status FROM orders WHERE id = ? AND user_id = ?', (order_id, session['user_id'])).fetchone()
            if not order:
                return jsonify({"success": False, "error": "Заказ не найден"}), 404
            if order['status'] not in ['pending', 'processing']:
                return jsonify({"success": False, "error": "Нельзя отменить"}), 400
            conn.execute('UPDATE orders SET status = ?, cancel_reason = ? WHERE id = ?', ('cancelled', reason, order_id))
            conn.commit()
            return jsonify({"success": True})
        except Exception as e:
            logger.error(f"cancel_order: {e}")
            return jsonify({"success": False, "error": "Ошибка"}), 500
        finally:
            conn.close()

 

    # === АДМИНКА ЗАКАЗОВ ===
    @app.route('/api/admin_orders')
    def api_admin_orders():
        if not session.get('is_admin'):
            return jsonify([]), 403
        conn = get_conn(DB_MAIN)
        try:
            # ← ДОБАВЛЯЕМ global_order_number в SELECT и сортируем по нему
            rows = conn.execute('''
                SELECT o.*, u.phone, o.global_order_number
                FROM orders o
                JOIN users u ON o.user_id = u.id
                ORDER BY o.global_order_number DESC
            ''').fetchall()
            
            result = []
            for row in rows:
                order = dict(row)
                items_list = conn.execute('''
                    SELECT oi.*, p.image_filenames
                    FROM order_items oi
                    LEFT JOIN products p ON oi.item_type = 'product' AND oi.item_id = p.id
                    WHERE oi.order_id = ?
                ''', (order['id'],)).fetchall()
                
                items = []
                for i in items_list:
                    imgs = json.loads(i['image_filenames'] or '[]') if i['item_type'] == 'product' else []
                    img_url = f"/static/uploads/{imgs[0]}" if imgs else '/static/assets/no-image.png'
                    items.append({
                        'title': i['title'],
                        'quantity': i['quantity'],
                        'price_str': f"{i['price_cents']//100}.{i['price_cents']%100:02d} ₽",
                        'image_url': img_url
                    })
                
                total_cents = sum(i['price_cents'] * i['quantity'] for i in items_list)
                status = order.get('status') or 'pending'
                label = status_map.get(status, ('Неизвестно', '#9ca3af', '#0b0d12'))
                
                # ← ВАЖНО: добавляем красивый номер для админа
                order.update({
                    'items': items,
                    'total_str': f"{total_cents // 100}.{total_cents % 100:02d} ₽",
                    'status_label': label,
                    'global_order_number': order['global_order_number'],  # ← явно передаём
                    'display_id': f"№{order['global_order_number']}",     # ← то, что показываем в интерфейсе
                })
                result.append(order)
            
            return jsonify(result)
        except Exception as e:
            logger.error(f"api_admin_orders error: {e}")
            return jsonify([])
        finally:
            conn.close()

    @app.route('/admin_orders', methods=['GET', 'POST'])
    def admin_orders():
        if not session.get('is_admin'):
            flash('Доступ запрещён', 'error')
            return redirect('/')
        conn = get_conn(DB_MAIN)
        orders = []
        try:
            if request.method == 'POST':
                data = request.get_json() or {}
                action = data.get('action')
                password = data.get('password')
                if password != current_app.config.get('ADMIN_PASSWORD', 'admin123'):
                    return jsonify({"success": False, "message": "Неверный пароль"}), 403
                order_id = int(data.get('order_id', 0))
                if action == 'set_status':
                    new_status = data.get('status')
                    if new_status not in status_map:
                        return jsonify({"success": False, "message": "Недопустимый статус"}), 400
                    # Списание со склада при переходе в completed
                    if new_status == 'completed':
                        items = conn.execute('SELECT item_type, item_id, quantity FROM order_items WHERE order_id = ?', (order_id,)).fetchall()
                        for item in items:
                            if item['item_type'] == 'product':
                                p = conn.execute('SELECT stock FROM products WHERE id = ?', (item['item_id'],)).fetchone()
                                if p and p['stock'] >= 0:
                                    new_stock = max(0, p['stock'] - item['quantity'])
                                    conn.execute('UPDATE products SET stock = ? WHERE id = ?', (new_stock, item['item_id']))
                    conn.execute('UPDATE orders SET status = ? WHERE id = ?', (new_status, order_id))
                    flash(f'Статус изменён: {status_map[new_status][0]}', 'success')
                    conn.commit()
                    return jsonify({"success": True})
                elif action == 'cancel_order':
                    reason = data.get('reason', '').strip()
                    if not reason:
                        return jsonify({"success": False, "message": "Укажите причину отмены"}), 400
                    # Возврат на склад
                    items = conn.execute('SELECT item_type, item_id, quantity FROM order_items WHERE order_id = ?', (order_id,)).fetchall()
                    for item in items:
                        if item['item_type'] == 'product':
                            p = conn.execute('SELECT stock FROM products WHERE id = ?', (item['item_id'],)).fetchone()
                            if p and p['stock'] >= 0:
                                conn.execute('UPDATE products SET stock = stock + ? WHERE id = ?', (item['quantity'], item['item_id']))
                    conn.execute('UPDATE orders SET status = ?, cancel_reason = ? WHERE id = ?', ('cancelled', reason, order_id))
                    flash('Заказ отменён', 'success')
                    conn.commit()
                    return jsonify({"success": True})
                elif action == 'delete_order':
                    # Удаляем order_items, затем orders
                    conn.execute('DELETE FROM order_items WHERE order_id = ?', (order_id,))
                    conn.execute('DELETE FROM orders WHERE id = ?', (order_id,))
                    flash('Заказ удалён навсегда', 'success')
                    conn.commit()
                    return jsonify({"success": True})
                return jsonify({"success": False, "message": "Недопустимое действие"}), 400
            # Получаем заказы для GET
            rows = conn.execute('''
                SELECT o.*, u.phone
                FROM orders o
                JOIN users u ON o.user_id = u.id
                ORDER BY o.id DESC
            ''').fetchall()
            for row in rows:
                order = dict(row)
                items_raw = conn.execute('''
                    SELECT oi.*,
                        CASE
                            WHEN oi.item_type = 'product' THEN p.image_filenames
                            WHEN oi.item_type = 'service' THEN '[]'
                        END as image_filenames,
                        CASE
                            WHEN oi.item_type = 'product' THEN p.description
                            ELSE ''
                        END as description
                    FROM order_items oi
                    LEFT JOIN products p ON oi.item_type = 'product' AND oi.item_id = p.id
                    WHERE oi.order_id = ?
                ''', (order['id'],)).fetchall()
                items = []
                for i in items_raw:
                    imgs = json.loads(i['image_filenames'] or '[]')
                    img_url = url_for('uploaded_file', filename=imgs[0]) if imgs else '/static/assets/no-image.png'
                    items.append({
                        'title': i['title'],
                        'quantity': i['quantity'],
                        'price_str': f"{i['price_cents']//100}.{i['price_cents']%100:02d} ₽",
                        'image_url': img_url,
                        'description': i['description'] or 'Нет описания'
                    })
                total_cents = sum(i['price_cents'] * i['quantity'] for i in items_raw)
                status = order.get('status') or 'pending'
                label = status_map.get(status, ('Неизвестно', '#9ca3af', '#0b0d12'))
                order.update({
                    'order_items': items,
                    'total_str': f"{total_cents//100}.{total_cents%100:02d} ₽",
                    'status_label': label,
                    'status': status
                })
                orders.append(order)
        except Exception as e:
            flash(f'Ошибка: {e}', 'error')
            logger.error(f"admin_orders: {e}")
        finally:
            conn.close()

        # ← ИСПРАВЛЕНО: ДВЕ РАЗНЫЕ БД
        conn_main = get_conn(DB_MAIN)
        conn_feedback = get_conn(DB_FEEDBACK)
        try:
            total_users = conn_main.execute('SELECT COUNT(*) FROM users').fetchone()[0]
            total_feedback = conn_feedback.execute('SELECT COUNT(*) FROM feedback').fetchone()[0]
            total_orders = conn_main.execute('SELECT COUNT(*) FROM orders').fetchone()[0]
            total_reviews = conn_main.execute('SELECT COUNT(*) FROM reviews').fetchone()[0]
        finally:
            conn_main.close()
            conn_feedback.close()

        return render_template(
            'admin_orders.html',
            orders=orders,
            total_orders=total_orders,
            status_map=status_map,
            total_users=total_users,
            total_feedback=total_feedback,
            total_reviews=total_reviews
        )


    @app.route('/api/user_orders')
    def api_user_orders():
        if 'user_id' not in session:
            return jsonify([])

        conn = get_conn(DB_MAIN)
        try:
            # Сортируем по id DESC — потому что created_at больше НЕТ!
            rows = conn.execute('''
                SELECT o.*, u.phone
                FROM orders o
                JOIN users u ON o.user_id = u.id
                WHERE o.user_id = ?
                ORDER BY o.id DESC
            ''', (session['user_id'],)).fetchall()

            result = []
            for row in rows:
                order = dict(row)

                # КРАСИВЫЙ НОМЕР ЗАКАЗА
                # У тебя теперь display_id = "2025-0001"
                # Если по какой-то причине его нет — fallback на user_order_number
                display_raw = order.get('display_id') or f"№{order.get('user_order_number', order['id'])}"
                
                # Делаем всегда красивым: №2025-0001
                if not display_raw.startswith('№'):
                    display_raw = f"№{display_raw}"

                # Товары и сумма
                items_rows = conn.execute('''
                    SELECT title, quantity, price_cents, item_type, item_id
                    FROM order_items 
                    WHERE order_id = ?
                ''', (order['id'],)).fetchall()

                total_cents = sum(item['price_cents'] * item['quantity'] for item in items_rows)
                status = order.get('status', 'pending')
                label = status_map.get(status, ('Неизвестно', '#9ca3af', '#0b0d12'))

                # Формируем финальный объект
                order.update({
                    'items': [dict(item) for item in items_rows],
                    'total_str': f"{total_cents // 100}.{total_cents % 100:02d} ₽",
                    'status_label': label[0],
                    'status_color': label[1],
                    'status_text_color': label[2],
                    'cancel_reason': order.get('cancel_reason') or '',
                    'display_id': display_raw,           # ← №2025-0001 — используй это везде на фронте!
                    'pretty_number': display_raw,        # ← можно и так назвать
                })

                result.append(order)

            return jsonify(result)

        except Exception as e:
            logger.error(f"api_user_orders error: {e}")
            return jsonify([])
        finally:
            conn.close()

    @app.route('/api/user_cart/<int:user_id>')
    def api_user_cart(user_id):
        conn_main = get_conn(DB_MAIN)
        conn_serv = get_conn(DB_SERVICES)

        try:
            # === ТОВАРЫ ===
            rows_p = conn_main.execute('''
                SELECT 'product' as type, c.product_id as id, c.quantity, 
                    p.title, p.price, p.image_filenames
                FROM cart_items c 
                JOIN products p ON c.product_id = p.id
                WHERE c.user_id = ?
            ''', (user_id,)).fetchall()

            # === УСЛУГИ ===
            rows_s = []
            try:
                cart_rows = conn_main.execute('''
                    SELECT service_id, quantity FROM cart_services WHERE user_id = ?
                ''', (user_id,)).fetchall()

                if cart_rows:
                    service_ids = [r['service_id'] for r in cart_rows]
                    if service_ids:
                        placeholders = ','.join(['?'] * len(service_ids))
                        services = conn_serv.execute(f'''
                            SELECT id, title, price, image_urls 
                            FROM services 
                            WHERE id IN ({placeholders})
                        ''', service_ids).fetchall()

                        serv_dict = {s['id']: s for s in services}

                        for cr in cart_rows:
                            s = serv_dict.get(cr['service_id'])
                            if s:
                                # ← ПАРСИМ ФОТО УСЛУГИ ПРАВИЛЬНО! ←
                                try:
                                    imgs = json.loads(s['image_urls'] or '[]')
                                except:
                                    imgs = [x.strip() for x in str(s['image_urls']).split(',') if x.strip()]
                                rows_s.append({
                                    'type': 'service',
                                    'id': cr['service_id'],
                                    'quantity': cr['quantity'],
                                    'title': s['title'],
                                    'price': s['price'],
                                    'image_filenames': json.dumps(imgs) if imgs else '[]'
                                })
            except Exception as e:
                logger.warning(f"Услуги в корзине не загрузились (это нормально, если их нет): {e}")

            # === СБОРКА ОТВЕТА ===
            result = []
            for row in rows_p + rows_s:
                try:
                    imgs = json.loads(row['image_filenames'] or '[]')
                except:
                    imgs = []

                if row['type'] == 'product' and imgs:
                    img_url = f"/static/uploads/goods/{imgs[0]}"
                elif row['type'] == 'service' and imgs:
                    img_url = f"/static/uploads/services/{imgs[0]}"
                else:
                    # ← ГАРАНТИРОВАННО РАБОЧАЯ ЗАГЛУШКА ←
                    img_url = "/static/assets/no-image.png"

                # Цена
                if row['type'] == 'service':
                    price_cents = int(''.join(filter(str.isdigit, str(row['price']))) or 0) * 100
                    price_str = str(row['price']).strip()
                else:
                    price_cents = int(row['price'])
                    price_str = f"{price_cents//100}.{price_cents%100:02d} ₽"

                result.append({
                    "type": row['type'],
                    "id": row['id'],
                    "title": escape(row['title']),
                    "price": price_cents,
                    "price_str": price_str,
                    "quantity": row['quantity'],
                    "image_url": img_url          # ← ВСЕГДА валидный URL!
                })

            return jsonify(result)

        except Exception as e:
            logger.error(f"api_user_cart fatal error: {e}")
            return jsonify([])
        finally:
            conn_main.close()
            conn_serv.close()

    @app.route('/admin_users', methods=['GET', 'POST'])
    def admin_users():
        if not session.get('is_admin'):
            flash('Доступ запрещён', 'error')
            return redirect(url_for('admin'))

        admin_password = current_app.config.get('ADMIN_PASSWORD', 'admin123')

        # ← ВСЕ ПЕРЕМЕННЫЕ ОПРЕДЕЛЯЕМ СНАЧАЛА!
        page = 1
        phone = request.args.get('phone', '').strip()
        per_page = 10
        total_users = 0
        total_pages = 1
        users = []
        total_feedback = 0
        total_orders = 0
        total_reviews = 0

        # Безопасно получаем page
        try:
            page = max(1, int(request.args.get('page', 1)))
        except (ValueError, TypeError):
            page = 1  # если пришло 'day' или что-то нечисленное

        offset = (page - 1) * per_page

        conn = get_conn(DB_MAIN)

        try:
            if request.method == 'POST':
                if request.form.get('password') != admin_password:
                    flash('Неверный пароль админа!', 'error')
                    return redirect(url_for('admin_users', page=page, phone=phone))

                action = request.form.get('action')
                try:
                    user_id = int(request.form.get('user_id', 0))
                except ValueError:
                    flash('Неверный ID пользователя', 'error')
                    return redirect(url_for('admin_users', page=page, phone=phone))

                if user_id <= 0 or user_id == session.get('user_id'):
                    flash('Нельзя трогать свой аккаунт или неверный ID!', 'error')
                    return redirect(url_for('admin_users', page=page, phone=phone))

                if action in ['block_user', 'unblock_user']:
                    new_block = 1 if action == 'block_user' else 0
                    conn.execute('UPDATE users SET is_blocked = ? WHERE id = ?', (new_block, user_id))
                    flash(f'Пользователь {"заблокирован" if new_block else "разблокирован"}!', 'success')

                elif action == 'edit_user':
                    is_admin = int(request.form.get('is_admin', 0))
                    conn.execute('UPDATE users SET is_admin = ? WHERE id = ?', (is_admin, user_id))
                    flash(f'Админ-права {"выданы" if is_admin else "сняты"}!', 'success')

                elif action == 'delete_user':
                    conn.execute('DELETE FROM users WHERE id = ?', (user_id,))
                    flash('Аккаунт удалён НАВСЕГДА!', 'success')

                conn.commit()
                return redirect(url_for('admin_users', page=page, phone=phone))

            # === ВЫБОРКА ПОЛЬЗОВАТЕЛЕЙ ===
            where = 'WHERE 1=1'
            params = []
            if phone:
                where += ' AND phone LIKE ?'
                params.append(f'%{phone}%')

            total_users_row = conn.execute(f'SELECT COUNT(*) FROM users {where}', params).fetchone()
            total_users = total_users_row[0] if total_users_row else 0
            total_pages = max(1, (total_users + per_page - 1) // per_page)

            sql = f'''
                SELECT u.*,
                    (SELECT COUNT(*) FROM cart_items ci WHERE ci.user_id = u.id) +
                    (SELECT COUNT(*) FROM cart_services cs WHERE cs.user_id = u.id) AS cart_count
                FROM users u {where}
                ORDER BY u.created_at DESC
                LIMIT ? OFFSET ?
            '''
            params.extend([per_page, offset])
            users = [dict(row) for row in conn.execute(sql, params).fetchall()]

        except Exception as e:
            conn.rollback()
            flash(f'Ошибка БД: {str(e)}', 'error')
            logger.error(f"admin_users error: {e}")
        finally:
            conn.close()

        # Счётчики для сайдбара — отдельно, чтобы не падало всё
        try:
            conn_main = get_conn(DB_MAIN)
            conn_fb = get_conn(DB_FEEDBACK)
            total_feedback = conn_fb.execute('SELECT COUNT(*) FROM feedback').fetchone()[0]
            total_orders = conn_main.execute('SELECT COUNT(*) FROM orders').fetchone()[0]
            total_reviews = conn_main.execute('SELECT COUNT(*) FROM reviews').fetchone()[0]
        except Exception as e:
            logger.error(f"Ошибка загрузки счётчиков: {e}")
        finally:
            if 'conn_main' in locals(): conn_main.close()
            if 'conn_fb' in locals(): conn_fb.close()

        return render_template('admin_users.html',
                            users=users,
                            total_users=total_users,
                            total_feedback=total_feedback or 0,
                            total_orders=total_orders or 0,
                            total_reviews=total_reviews or 0,
                            page=page,
                            total_pages=total_pages,
                            per_page=per_page,
                           phone=phone)


    @app.route('/admin_services', methods=['GET', 'POST'])
    def admin_services():
        if not session.get('is_admin'):
            flash('Доступ запрещён', 'error')
            return redirect(url_for('admin'))

        UPLOAD_FOLDER = os.path.join(current_app.static_folder, 'uploads', 'services')
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        conn = get_conn(DB_SERVICES)
        cursor = conn.cursor()

        try:
            if request.method == 'POST':
                password = request.form.get('password')
                if not password or password != current_app.config.get('ADMIN_PASSWORD', 'admin123'):
                    flash('Неверный пароль!', 'error')
                    return redirect(url_for('admin_services'))

                action = request.form.get('action')

                # ─────── ПЕРЕСОРТИРОВКА ───────
                if action == 'reorder_services':
                    try:
                        order = json.loads(request.form['order'])
                        placeholders = ','.join('?' for _ in order)
                        cursor.execute(f'SELECT id FROM services WHERE id IN ({placeholders})', order)
                        valid_ids = {row['id'] for row in cursor.fetchall()}
                        for sort_order, sid in enumerate(order):
                            if sid in valid_ids:
                                cursor.execute('UPDATE services SET sort_order = ? WHERE id = ?', (sort_order, sid))
                        conn.commit()
                        flash('Порядок услуг сохранён!', 'success')
                    except Exception as e:
                        logger.error(f"Reorder error: {e}")
                        flash('Ошибка сохранения порядка', 'error')
                    return redirect(url_for('admin_services'))

                # ─────── ДОБАВЛЕНИЕ ───────
                if action == 'add':
                    title = request.form['title'].strip()
                    price = request.form['price'].strip()
                    short_desc = request.form['short_desc'].strip()
                    full_desc = request.form.get('full_desc', '').strip()
                    category = request.form.get('category', '').strip() or None

                    image_filenames = []
                    if 'images' in request.files:
                        files = request.files.getlist('images')
                        for file in files[:4]:
                            if file and file.filename:
                                ext = os.path.splitext(file.filename)[1].lower()
                                if ext in {'.jpg', '.jpeg', '.png', '.webp', '.gif'}:
                                    filename = f"{uuid.uuid4().hex}{ext}"
                                    filepath = os.path.join(UPLOAD_FOLDER, filename)
                                    file.save(filepath)
                                    image_filenames.append(filename)

                    # ← ИСПРАВЛЕНО: сохраняем как JSON!
                    cursor.execute('''
                        INSERT INTO services
                        (title, price, short_desc, full_desc, image_urls, category, sort_order, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, 
                            (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM services),
                            datetime('now'))
                    ''', (title, price, short_desc, full_desc, json.dumps(image_filenames), category))
                    conn.commit()
                    flash('Услуга добавлена!', 'success')

                # ─────── РЕДАКТИРОВАНИЕ ───────
                elif action == 'edit':
                    sid = request.form.get('product_id')
                    if not sid:
                        flash('ID услуги не указан', 'error')
                        return redirect(url_for('admin_services'))

                    title = request.form['title'].strip()
                    price = request.form['price'].strip()
                    short_desc = request.form['short_desc'].strip()
                    full_desc = request.form.get('full_desc', '').strip()
                    category = request.form.get('category', '').strip() or None

                    # Текущие фото (теперь JSON!)
                    cursor.execute('SELECT image_urls FROM services WHERE id = ?', (sid,))
                    row = cursor.fetchone()
                    current_filenames = json.loads(row['image_urls'] or '[]') if row else []

                    # Сохраняемые старые
                    keep_images = request.form.getlist('keep_images')
                    final_filenames = [img for img in keep_images if img in current_filenames]

                    # Новые фото
                    if 'images' in request.files:
                        files = request.files.getlist('images')
                        remaining = 4 - len(final_filenames)
                        for file in files[:remaining]:
                            if file and file.filename:
                                ext = os.path.splitext(file.filename)[1].lower()
                                if ext in {'.jpg', '.jpeg', '.png', '.webp', '.gif'}:
                                    filename = f"{uuid.uuid4().hex}{ext}"
                                    filepath = os.path.join(UPLOAD_FOLDER, filename)
                                    file.save(filepath)
                                    final_filenames.append(filename)

                    final_filenames = final_filenames[:4]  # на всякий случай

                    # ← ИСПРАВЛЕНО: сохраняем как JSON!
                    cursor.execute('''
                        UPDATE services SET
                        title=?, price=?, short_desc=?, full_desc=?, image_urls=?, category=?, updated_at=datetime('now')
                        WHERE id=?
                    ''', (title, price, short_desc, full_desc, json.dumps(final_filenames), category, sid))
                    conn.commit()
                    flash('Услуга обновлена!', 'success')

                # ─────── УДАЛЕНИЕ ───────
                # ─────── УДАЛЕНИЕ УСЛУГИ ───────
                elif action == 'delete':
                    service_id = request.form.get('product_id')
                    if not service_id:
                        flash('Не указан ID услуги', 'error')
                        return redirect(url_for('admin_services'))

                    try:
                        # Получаем фото перед удалением
                        cursor.execute("SELECT image_urls FROM services WHERE id = ?", (service_id,))
                        row = cursor.fetchone()

                        if row:
                            try:
                                filenames = json.loads(row['image_urls'] or '[]')
                                for fname in filenames:
                                    if fname:
                                        filepath = os.path.join(UPLOAD_FOLDER, fname)
                                        if os.path.exists(filepath):
                                            os.remove(filepath)
                            except:
                                pass  # если JSON битый — просто пропускаем

                            # Удаляем саму услугу
                            cursor.execute("DELETE FROM services WHERE id = ?", (service_id,))
                            conn.commit()
                            flash('Услуга удалена!', 'success')
                        else:
                            flash('Услуга не найдена', 'error')
                    except Exception as e:
                        logger.error(f"Ошибка удаления услуги {service_id}: {e}")
                        flash('Ошибка при удалении услуги', 'error')

                    return redirect(url_for('admin_services'))


            # ─────── GET ───────
            cursor.execute('''
                SELECT id, title, price, short_desc, full_desc, image_urls, category, sort_order
                FROM services 
                ORDER BY COALESCE(sort_order, 999999) ASC, created_at DESC
            ''')
            rows = cursor.fetchall()

            services = []
            for row in rows:
                # ← ИСПРАВЛЕНО: читаем как JSON!
                filenames = json.loads(row['image_urls'] or '[]')
                urls = [f"/static/uploads/services/{f}" for f in filenames if f]

                services.append({
                    'id': row['id'],
                    'title': row['title'],
                    'price': row['price'],
                    'short_desc': row['short_desc'],
                    'full_desc': row['full_desc'],
                    'image_filenames': filenames,
                    'image_urls': urls,
                    'category': row['category'] or '—'
                })

            total_feedback = globals().get('get_total_feedback', lambda: 0)()
            total_users = globals().get('get_total_users', lambda: 0)()
            total_reviews = globals().get('get_total_reviews', lambda: 0)()
            total_orders = globals().get('get_total_orders', lambda: 0)()

            return render_template('admin_services.html',
                services=services,
                total_feedback=total_feedback,
                total_users=total_users,
                total_reviews=total_reviews,
                total_orders=total_orders
            )

        except Exception as e:
            conn.rollback()
            logger.error(f"admin_services error: {e}", exc_info=True)
            flash('Произошла ошибка', 'error')
            return redirect(url_for('admin_services'))
        finally:
            conn.close()

        
    @app.route('/static/uploads/services/<path:filename>')
    def uploaded_service_file(filename):
        # Защита от ../
        if '..' in filename or filename.startswith('/'):
            abort(403)
        
        upload_folder = os.path.join('static', 'uploads', 'services')
        
        # Проверка существования папки
        if not os.path.exists(upload_folder):
            abort(404)
        
        try:
            return send_from_directory(upload_folder, filename)
        except Exception as e:
            current_app.logger.error(f"Service image error: {filename} - {e}")
            abort(404)

    @app.route('/admin_news', methods=['GET', 'POST'])
    def admin_news():
        if not session.get('is_admin'):
            return jsonify({'success': False, 'error': 'Доступ запрещён'}), 403

        conn_news = get_conn(DB_NEWS)
        conn_main = get_conn(DB_MAIN)
        conn_feedback = get_conn(DB_FEEDBACK)

        NEWS_UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'static', 'uploads', 'news')
        os.makedirs(NEWS_UPLOAD_FOLDER, exist_ok=True)

        try:
            if request.method == 'POST':
                password = request.form.get('password')
                if not password or password != current_app.config.get('ADMIN_PASSWORD', 'admin123'):
                    return jsonify({'success': False, 'error': 'Неверный пароль'}), 403

                action = request.form.get('action')
                title = request.form.get('title', '').strip()
                date = request.form.get('date', '').strip()
                short_desc = request.form.get('short_desc', '').strip()
                full_desc = request.form.get('full_desc', '')
                category = request.form.get('category', '').strip() or None

                # Защита от пустых полей при редактировании
                if action in ('add', 'edit'):
                    if not title:
                        title = "Без названия"
                    if not date:
                        date = datetime.now().strftime('%d %B %Y')
                    if not short_desc:
                        short_desc = "Нет описания"

                # === 1. ЗАГРУЗКА НОВЫХ ФАЙЛОВ ===
                uploaded_images = []
                if 'images' in request.files:
                    for file in request.files.getlist('images'):
                        if not file or not file.filename:
                            continue
                        ext = '.jpg'
                        if file.mimetype:
                            if file.mimetype == 'image/png':
                                ext = '.png'
                            elif file.mimetype == 'image/webp':
                                ext = '.webp'
                            elif file.mimetype == 'image/gif':
                                ext = '.gif'

                        # Проверка магических байтов (на всякий случай)
                        if ext == '.jpg':
                            file.stream.seek(0)
                            header = file.stream.read(12)
                            file.stream.seek(0)
                            if header.startswith(b'\x89PNG'):
                                ext = '.png'
                            elif b'WEBP' in header:
                                ext = '.webp'
                            elif header.startswith(b'GIF8'):
                                ext = '.gif'

                        filename = f"news_{uuid.uuid4().hex}{ext}"
                        file.save(os.path.join(NEWS_UPLOAD_FOLDER, filename))
                        uploaded_images.append(filename)

                # === 2. УДАЛЕНИЕ СТАРЫХ ФОТО (по delete_images) ===
                delete_images = []
                if request.form.get('delete_images'):
                    try:
                        delete_images = json.loads(request.form.get('delete_images'))
                    except:
                        pass

                msg = "Операция выполнена"

                # ─────── ДОБАВЛЕНИЕ ───────
                if action == 'add':
                    images = (uploaded_images + [None] * 4)[:4]
                    conn_news.execute("""INSERT INTO news 
                        (title, date, short_desc, full_desc, image1, image2, image3, image4, category) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (title, date, short_desc, full_desc, *images, category))
                    msg = "Новость добавлена!"

                # ─────── РЕДАКТИРОВАНИЕ ───────
                elif action == 'edit':
                    nid = request.form.get('news_id')
                    if not nid:
                        return jsonify({'success': False, 'error': 'Нет ID новости'})

                    old = conn_news.execute("SELECT image1,image2,image3,image4 FROM news WHERE id=?", (nid,)).fetchone()
                    current_images = []
                    for img in [old['image1'], old['image2'], old['image3'], old['image4']] if old else []:
                        if img and img not in delete_images:
                            current_images.append(img)
                        if img and img in delete_images:
                            try:
                                os.remove(os.path.join(NEWS_UPLOAD_FOLDER, img))
                            except:
                                pass

                    # Восстановление порядка
                    order = json.loads(request.form.get('images_order', '[]'))
                    final_images = []
                    new_idx = 0
                    for marker in order:
                        if marker.startswith('__new_'):
                            if new_idx < len(uploaded_images):
                                final_images.append(uploaded_images[new_idx])
                                new_idx += 1
                        elif marker in current_images:
                            final_images.append(marker)
                    final_images.extend(uploaded_images[new_idx:])
                    final_images = final_images[:4]

                    conn_news.execute("""UPDATE news SET 
                        title=?, date=?, short_desc=?, full_desc=?,
                        image1=?, image2=?, image3=?, image4=?, category=?
                        WHERE id=?""",
                        (title, date, short_desc, full_desc,
                        final_images[0] if len(final_images)>0 else None,
                        final_images[1] if len(final_images)>1 else None,
                        final_images[2] if len(final_images)>2 else None,
                        final_images[3] if len(final_images)>3 else None,
                        category, nid))
                    msg = "Изменения сохранены!"

                # ─────── УДАЛЕНИЕ ───────
                elif action == 'delete':
                    nid = request.form.get('news_id')
                    if not nid:
                        return jsonify({'success': False, 'error': 'Нет ID новости'})

                    row = conn_news.execute("SELECT image1, image2, image3, image4 FROM news WHERE id = ?", (nid,)).fetchone()
                    if row:
                        for img in (row['image1'], row['image2'], row['image3'], row['image4']):
                            if img:
                                try:
                                    os.remove(os.path.join(NEWS_UPLOAD_FOLDER, img))
                                except:
                                    pass

                    conn_news.execute("DELETE FROM news WHERE id = ?", (nid,))
                    msg = "Новость удалена!"

                # ← ОДИН commit И ОДИН return ДЛЯ ВСЕХ ДЕЙСТВИЙ
                conn_news.commit()
                return jsonify({'success': True, 'message': msg})

            # ─────── GET — отображение страницы ───────
            rows = conn_news.execute('SELECT * FROM news ORDER BY created_at DESC').fetchall()
            news = []
            for row in rows:
                n = dict(row)
                images = [n.get(f'image{i}') for i in range(1,5) if n.get(f'image{i}')]
                n['images'] = images
                news.append(n)

            today = datetime.now().strftime('%d %B %Y')
            total_users = conn_main.execute('SELECT COUNT(*) FROM users').fetchone()[0]
            total_feedback = conn_feedback.execute('SELECT COUNT(*) FROM feedback').fetchone()[0]
            total_orders = conn_main.execute('SELECT COUNT(*) FROM orders').fetchone()[0]
            total_reviews = conn_main.execute('SELECT COUNT(*) FROM reviews').fetchone()[0]

            return render_template('admin_news.html',
                                news=news, today=today,
                                total_users=total_users,
                                total_feedback=total_feedback,
                                total_orders=total_orders,
                                total_reviews=total_reviews)

        except Exception as e:
            conn_news.rollback()
            logger.error(f"admin_news error: {e}", exc_info=True)
            # Возвращаем чистый JSON даже при ошибке
            return jsonify({'success': False, 'error': 'Ошибка сервера'}), 200

        finally:
            conn_news.close()
            conn_main.close()
            conn_feedback.close()
    @app.route('/api/categories')
    def api_categories():
        conn = get_conn(DB_MAIN)
        try:
            rows = conn.execute("SELECT DISTINCT category FROM products").fetchall()
            return jsonify([row['category'] for row in rows])
        finally:
            conn.close()

    @app.route('/api/brands')
    def api_brands():
        conn = get_conn(DB_MAIN)
        try:
            rows = conn.execute("SELECT DISTINCT brand FROM products WHERE brand IS NOT NULL").fetchall()
            return jsonify([row['brand'] for row in rows])
        finally:
            conn.close()

    @app.route('/api/products')
    def api_products():
        conn = get_conn(DB_MAIN)
        try:
            query = "SELECT * FROM products WHERE in_stock = 1"
            params = []

            search = request.args.get('search', '').strip()
            if search:
                query += " AND title LIKE ?"
                params.append(f"%{search}%")

            min_price = request.args.get('min_price')
            if min_price:
                try:
                    query += " AND price >= ?"
                    params.append(int(float(min_price) * 100))
                except:
                    pass

            max_price = request.args.get('max_price')
            if max_price:
                try:
                    query += " AND price <= ?"
                    params.append(int(float(max_price) * 100))
                except:
                    pass

            category = request.args.get('category')
            if category and category != 'all':
                query += " AND category = ?"
                params.append(category)

            brands = request.args.getlist('brand')
            if brands:
                query += f" AND brand IN ({','.join('?' * len(brands))})"
                params.extend(brands)

            sort = request.args.get('sort', 'default')
            if sort == 'price-asc':
                query += " ORDER BY price ASC"
            elif sort == 'price-desc':
                query += " ORDER BY price DESC"
            elif sort == 'name':
                query += " ORDER BY title ASC"
            else:
                query += " ORDER BY created_at DESC"

            rows = conn.execute(query, params).fetchall()
            result = []
            for row in rows:
                p = dict(row)
                p['title'] = escape(p['title'])
                p['description'] = escape(p.get('description', '')).replace('\n', '<br>')
                imgs = json.loads(p['image_filenames'] or '[]')
                safe_imgs = [img for img in imgs if isinstance(img, str) and not img.lower().startswith(('javascript:', 'data:'))]
                p['image_urls'] = [f"/static/uploads/goods/{img}" for img in safe_imgs]
                p['price_str'] = f"{p['price']//100}.{p['price']%100:02d} ₽"
                p['placeholder'] = safe_placeholder(p['title'])
                result.append(p)
            return jsonify(result)
        except Exception as e:
            logger.error(f"api_products error: {e}")
            return jsonify([])
        finally:
            conn.close()

    @app.route('/api/product/<int:product_id>')
    def api_product(product_id):
        conn = get_conn(DB_MAIN)
        try:
            # ← ДОБАВЛЯЕМ stock в SELECT!
            row = conn.execute("SELECT *, stock FROM products WHERE id = ?", (product_id,)).fetchone()
            if not row:
                return jsonify({"error": "Товар не найден"}), 404
            
            p = dict(row)
            p['title'] = escape(p['title'])
            p['description'] = escape(p.get('description', '') or '').replace('\n', '<br>')
            
            imgs = json.loads(p['image_filenames'] or '[]')
            safe_imgs = [img for img in imgs if isinstance(img, str) and not img.lower().startswith(('javascript:', 'data:'))]
            p['image_urls'] = [f"/static/uploads/goods/{img}" for img in safe_imgs]
            p['price_str'] = f"{p['price']//100}.{p['price']%100:02d} ₽"

            # ← ВОТ ЭТО ГЛАВНОЕ: возвращаем stock!
            return jsonify({
                "id": p['id'],
                "title": p['title'],
                "price": p['price'],
                "price_str": p['price_str'],
                "description": p['description'],
                "image_urls": p['image_urls'],
                "stock": p['stock'] if p['stock'] is not None else -1  # ← -1 = бесконечно
            })
        except Exception as e:
            logger.error(f"api_product error: {e}")
            return jsonify({"error": "Ошибка"}), 500
        finally:
            conn.close()

    @app.route('/api/home_products')
    def api_home_products():
        conn = get_conn(DB_MAIN)
        try:
            rows = conn.execute("SELECT * FROM products WHERE in_stock = 1 ORDER BY RANDOM() LIMIT 6").fetchall()
            result = []
            for p in rows:
                p_dict = dict(p)
                p_dict['title'] = escape(p_dict['title'])
                imgs = json.loads(p_dict['image_filenames'] or '[]')
                safe_imgs = [img for img in imgs if isinstance(img, str) and not img.lower().startswith(('javascript:', 'data:'))]
                image_urls = [f"/static/uploads/goods/{img}" for img in safe_imgs]
                result.append({
                    'id': p_dict['id'],
                    'title': p_dict['title'],
                    'price_str': f"{p_dict['price']//100}.{p_dict['price']%100:02d} ₽",
                    'description': escape(p_dict.get('description', '') or ''),
                    'image_urls': image_urls,
                    'placeholder': safe_placeholder(p_dict['title'])
                })
            return jsonify(result)
        except Exception as e:
            logger.error(f"api_home_products error: {e}")
            return jsonify([])
        finally:
            conn.close()

    @app.route('/api/home_services')
    def api_home_services():
        conn = get_conn(DB_SERVICES)
        try:
            rows = conn.execute("SELECT * FROM services ORDER BY RANDOM() LIMIT 3").fetchall()
            services = []
            for row in rows:
                s = dict(row)
                s['title'] = escape(s['title'])
                s['short_desc'] = escape(s['short_desc'])
                services.append(s)
            return jsonify(services)
        except Exception as e:
            logger.error(f"api_home_services error: {e}")
            return jsonify([])
        finally:
            conn.close()

    @app.route('/api/all_products')
    def api_all_products():
        conn = get_conn(DB_MAIN)
        try:
            rows = conn.execute("SELECT * FROM products WHERE in_stock = 1").fetchall()
            result = []
            for p in rows:
                p_dict = dict(p)
                p_dict['title'] = escape(p_dict['title'])
                imgs = json.loads(p_dict['image_filenames'] or '[]')
                safe_imgs = [img for img in imgs if isinstance(img, str) and not img.lower().startswith(('javascript:', 'data:'))]
                image_urls = [f"/static/uploads/{img}" for img in safe_imgs]
                result.append({
                    'id': p_dict['id'],
                    'title': p_dict['title'],
                    'price_str': f"{p_dict['price']//100}.{p_dict['price']%100:02d} ₽",
                    'description': escape(p_dict.get('description', '') or ''),
                    'image_urls': image_urls
                })
            return jsonify(result)
        except Exception as e:
            logger.error(f"api_all_products error: {e}")
            return jsonify([])
        finally:
            conn.close()





    @app.route('/api/services')
    def api_services():
        conn = get_conn(DB_SERVICES)
        search = request.args.get('search', '').strip()
        try:
            if search:
                like = f"%{search}%"
                start_like = f"{search}%"
                rows = conn.execute("""
                    SELECT id, title, price, short_desc, image_urls, category
                    FROM services
                    WHERE title LIKE ? OR short_desc LIKE ?
                    ORDER BY 
                        CASE WHEN title LIKE ? THEN 1
                            WHEN short_desc LIKE ? THEN 2 ELSE 3 END,
                        created_at DESC
                    LIMIT 30
                """, (like, like, start_like, start_like)).fetchall()
            else:
                rows = conn.execute("""
                    SELECT id, title, price, short_desc, image_urls, category
                    FROM services
                    ORDER BY sort_order, created_at DESC
                """).fetchall()

            services = []
            for row in rows:
                s = dict(row)
                s['title'] = escape(s['title'])
                s['short_desc'] = escape(s.get('short_desc', '') or '')

                # === ГЛАВНОЕ ИСПРАВЛЕНИЕ: правильно парсим JSON и сохраняем порядок ===
                raw = s.get('image_urls') or '[]'
                try:
                    urls_list = json.loads(raw) if isinstance(raw, str) and raw.strip() else []
                except (json.JSONDecodeError, TypeError):
                    # На случай, если где-то ещё лежит старая строка через запятую
                    urls_list = [u.strip() for u in str(raw).split(',') if u.strip()]

                # Формируем полные URL
                full_urls = []
                for filename in urls_list:
                    filename = str(filename).strip().strip('"\'')
                    if not filename:
                        continue
                    if filename.startswith('http') or filename.startswith('/static'):
                        full_urls.append(filename)
                    else:
                        full_urls.append(f"/static/uploads/services/{filename}")

                s['image_urls'] = full_urls
                s['category'] = s.get('category') or 'legal_services'
                services.append(s)

            return jsonify(services)

        except Exception as e:
            logger.error(f"api_services error: {e}", exc_info=True)
            return jsonify([])
        finally:
            conn.close()

    @app.route('/api/service/<int:service_id>')
    def api_service(service_id):
        conn = get_conn(DB_SERVICES)
        try:
            row = conn.execute("""
                SELECT id, title, price, short_desc, full_desc, image_urls, category 
                FROM services WHERE id = ?
            """, (service_id,)).fetchone()

            if not row:
                return jsonify({"error": "Услуга не найдена"}), 404

            s = dict(row)
            s['title'] = escape(s['title'])
            s['description'] = escape(s.get('full_desc') or '').replace('\n', '<br>')
            s['price_str'] = s['price']

            # === ТОТ ЖЕ ПАРСИНГ JSON С ПОДДЕРЖКОЙ ПОРЯДКА ===
            raw = s.get('image_urls') or '[]'
            try:
                urls_list = json.loads(raw) if isinstance(raw, str) and raw.strip() else []
            except (json.JSONDecodeError, TypeError):
                urls_list = [u.strip() for u in str(raw).split(',') if u.strip()]

            full_urls = []
            for filename in urls_list:
                filename = str(filename).strip().strip('"\'')
                if not filename:
                    continue
                if filename.startswith('http') or filename.startswith('/static'):
                    full_urls.append(filename)
                else:
                    full_urls.append(f"/static/uploads/services/{filename}")

            s['image_urls'] = full_urls
            s['category'] = s.get('category') or 'legal_services'

            # Отзывы (без изменений)
            main_conn = get_conn(DB_MAIN)
            reviews = main_conn.execute(
                "SELECT rating FROM reviews WHERE item_type = 'service' AND item_id = ?",
                (service_id,)
            ).fetchall()
            main_conn.close()
            total = sum(r['rating'] for r in reviews)
            count = len(reviews)
            s['avg_rating'] = round(total / count, 1) if count else 0
            s['review_count'] = count

            return jsonify(s)

        except Exception as e:
            logger.error(f"api_service error: {e}", exc_info=True)
            return jsonify({"error": "Ошибка"}), 500
        finally:
            conn.close()

    @app.route('/api/cart/services')
    def api_cart_services():
        if 'user_id' not in session:
            return jsonify([])
        conn = get_conn(DB_MAIN)
        serv_conn = get_conn(DB_SERVICES)
        items = []
        try:
            rows = conn.execute('''
                SELECT s.title, s.price, cs.quantity, s.image_urls
                FROM cart_services cs
                JOIN services s ON cs.service_id = s.id
                WHERE cs.user_id = ?
            ''', (session['user_id'],)).fetchall()
            for row in rows:
                image_urls = [u.strip() for u in (row['image_urls'] or '').split(',') if u.strip()]
                img_url = image_urls[0] if image_urls else '/static/assets/no-image.png'
                price_cents = parse_price_to_cents(row['price'])
                items.append({
                    'title': row['title'],
                    'price_cents': price_cents,
                    'price_str': row['price'],
                    'quantity': row['quantity'],
                    'type': 'service',
                    'image_url': img_url,
                    'icon': 'la-cogs'
                })
            return jsonify(items)
        except Exception as e:
            logger.error(f"cart_services error: {e}")
            return jsonify([])
        finally:
            conn.close()
            serv_conn.close()

    @app.route('/admin_reviews', methods=['GET', 'POST'])

    def admin_reviews():
        if request.method == 'POST':
            data = request.get_json(force=True) or {}
            if not data:
                return jsonify({'success': False, 'message': 'Нет данных'}), 400

            password = data.get('password')
            if password != current_app.config.get('ADMIN_PASSWORD', 'admin123'):
                return jsonify({'success': False, 'message': 'Неверный пароль'}), 403

            action = data.get('action')
            conn_main = get_conn(DB_MAIN)
            conn_services = get_conn(DB_SERVICES)

            try:
                # === УДАЛЕНИЕ ОТЗЫВА ===
                if action == 'delete_review':
                    rid = data.get('review_id')
                    if not rid or not str(rid).isdigit():
                        return jsonify({'success': False, 'message': 'ID обязателен'}), 400
                    conn_main.execute('DELETE FROM reviews WHERE id = ?', (int(rid),))
                    conn_main.commit()
                    return jsonify({'success': True, 'message': 'Отзыв удалён'})

                # === РЕДАКТИРОВАНИЕ ОТЗЫВА ===
                elif action == 'edit_review':
                    rid = data.get('review_id')
                    rating = data.get('rating')
                    text = data.get('text', '').strip()
                    if not all([rid, rating, text]) or not str(rid).isdigit() or not str(rating).isdigit():
                        return jsonify({'success': False, 'message': 'Неверные данные'}), 400
                    conn_main.execute(
                        'UPDATE reviews SET rating = ?, text = ? WHERE id = ?',
                        (int(rating), text, int(rid))
                    )
                    conn_main.commit()
                    return jsonify({'success': True, 'message': 'Отзыв обновлён'})

                # === СОЗДАНИЕ ОТЗЫВА АДМИНОМ (ГЛАВНОЕ ИСПРАВЛЕНИЕ!) ===
                elif action == 'create_review':
                    item_type = data.get('item_type')
                    item_id = data.get('item_id')
                    rating = data.get('rating')
                    text = data.get('text', '').strip()
                    user_phone = data.get('user_phone', '').strip() or None

                    if item_type not in ('product', 'service') or not item_id or not rating or not text:
                        return jsonify({'success': False, 'message': 'Заполните все поля'}), 400

                    try:
                        rating = int(rating)
                        item_id = int(item_id)
                    except:
                        return jsonify({'success': False, 'message': 'Неверные данные'}), 400

                    # ←←← ПОДТЯГИВАЕМ НАЗВАНИЕ ТОВАРА/УСЛУГИ ←←←
                    item_title = "Без названия"
                    try:
                        if item_type == 'product':
                            row = conn_main.execute('SELECT title FROM products WHERE id = ?', (item_id,)).fetchone()
                        else:  # service
                            row = conn_services.execute('SELECT title FROM services WHERE id = ?', (item_id,)).fetchone()
                        if row and row['title']:
                            item_title = row['title']
                    except Exception as e:
                        logger.warning(f"Не удалось получить название товара/услуги: {e}")

                    # ←←← СОХРАНЯЕМ С ПРАВИЛЬНЫМ item_title ←←←
                    conn_main.execute('''
                        INSERT INTO reviews (user_phone, item_type, item_id, rating, text, item_title, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
                    ''', (user_phone, item_type, item_id, rating, text, item_title))

                    conn_main.commit()
                    return jsonify({'success': True, 'message': 'Отзыв создан'})

                else:
                    return jsonify({'success': False, 'message': 'Неизвестное действие'}), 400

            except Exception as e:
                logger.error(f"Admin review error: {e}")
                conn_main.rollback()
                return jsonify({'success': False, 'message': 'Ошибка сервера'}), 500
            finally:
                conn_main.close()
                conn_services.close()

        # ===================================================================
        # === GET: отображаем страницу с отзывами ===
        # ===================================================================
        conn_main = get_conn(DB_MAIN)
        try:
            reviews = conn_main.execute('''
                SELECT *, 
                    COALESCE(item_title, 'Без названия') AS display_title
                FROM reviews 
                ORDER BY created_at DESC
            ''').fetchall()
            reviews = [dict(row) for row in reviews]
        except Exception as e:
            logger.error(f"admin_reviews GET error: {e}")
            flash('Ошибка загрузки отзывов', 'error')
            reviews = []
        finally:
            conn_main.close()

        # === СТАТИСТИКА ===
        conn_main = get_conn(DB_MAIN)
        conn_feedback = get_conn(DB_FEEDBACK)
        try:
            total_users = conn_main.execute('SELECT COUNT(*) FROM users').fetchone()[0]
            total_feedback = conn_feedback.execute('SELECT COUNT(*) FROM feedback').fetchone()[0]
            total_orders = conn_main.execute('SELECT COUNT(*) FROM orders').fetchone()[0]
            total_reviews = conn_main.execute('SELECT COUNT(*) FROM reviews').fetchone()[0]
        except:
            total_users = total_feedback = total_orders = total_reviews = 0
        finally:
            conn_main.close()
            conn_feedback.close()

        return render_template(
            'admin_reviews.html',
            reviews=reviews,
            total_users=total_users,
            total_feedback=total_feedback,
            total_orders=total_orders,
            total_reviews=total_reviews
        )


    @app.route('/api/review', methods=['POST'])
    def api_review():
        if not session.get('user_id'):
            return jsonify({'error': 'Not logged in'}), 401

        data = request.get_json()
        item_id = data.get('item_id')
        item_type = data.get('item_type')
        rating = data.get('rating')
        text = data.get('text', '').strip()
        title = data.get('title', 'Без названия')
        user_phone = session.get('phone', 'Аноним')

        if item_type not in ('product', 'service') or not item_id or not rating or not text:
            return jsonify({'error': 'Заполните все поля'}), 400

        conn = get_conn(DB_MAIN)
        try:
            # Проверяем, существует ли столбец item_title
            cur = conn.execute("PRAGMA table_info(reviews)")
            columns = [row['name'] for row in cur.fetchall()]

            if 'item_title' in columns:
                conn.execute('''
                    INSERT INTO reviews (user_id, item_type, item_id, rating, text, item_title, user_phone)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (session['user_id'], item_type, item_id, rating, text, title, user_phone))
            else:
                conn.execute('''
                    INSERT INTO reviews (user_id, item_type, item_id, rating, text, user_phone)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (session['user_id'], item_type, item_id, rating, text, user_phone))

            conn.commit()
            return jsonify({'success': True})
        except Exception as e:
            logger.error(f"api_review error: {e}")
            return jsonify({'error': 'Ошибка сервера'}), 500
        finally:
            conn.close()

    
    @app.route('/api/reviews/<int:product_id>', methods=['GET'])
    def api_get_reviews(product_id):
        conn = get_conn(DB_MAIN)
        try:
            query = '''
                SELECT rating, text, created_at, user_phone
                FROM reviews
                WHERE item_type = 'product' AND item_id = ?
                ORDER BY created_at DESC
            '''
            rows = conn.execute(query, (product_id,)).fetchall()

            reviews = []
            total = 0
            for r in rows:
                phone = r['user_phone'] or 'Аноним'
                author = phone if len(phone) <= 10 else phone[:3] + '...' + phone[-2:]
                reviews.append({
                    'author': author,
                    'rating': r['rating'],
                    'text': r['text'] or '',
                    'date': r['created_at']
                })
                total += r['rating']

            avg_rating = round(total / len(reviews), 1) if reviews else 0
            count = len(reviews)

            return jsonify({
                'success': True,
                'product_id': product_id,
                'reviews': reviews,
                'avg_rating': avg_rating,
                'review_count': count
            })

        except Exception as e:
            logger.error(f"api_get_reviews error: {e}")
            return jsonify({'error': 'Server error'}), 500
        finally:
            conn.close()

    @app.route('/api/service_reviews/<int:sid>', methods=['GET'])
    def api_get_service_reviews(sid):
        """Возвращает отзывы + средний рейтинг для УСЛУГИ"""
        conn = get_conn(DB_MAIN)
        try:
            query = '''
                SELECT rating, text, created_at, user_phone
                FROM reviews
                WHERE item_type = 'service' AND item_id = ?
                ORDER BY created_at DESC
            '''
            rows = conn.execute(query, (sid,)).fetchall()

            reviews = []
            total = 0
            for r in rows:
                phone = r['user_phone'] or 'Аноним'
                author = phone[:10] if phone.startswith('+') else phone
                if len(author) > 8:
                    author = author[:3] + '...' + author[-2:]

                reviews.append({
                    'author': author,
                    'rating': r['rating'],
                    'text': r['text'] or '',
                    'date': r['created_at']
                })
                total += r['rating']

            avg_rating = round(total / len(reviews), 1) if reviews else 0
            count = len(reviews)

            return jsonify({
                'success': True,
                'service_id': sid,
                'reviews': reviews,
                'avg_rating': avg_rating,
                'review_count': count
            })

        except Exception as e:
            logger.error(f"api_get_service_reviews error: {e}")
            return jsonify({'error': 'Server error'}), 500
        finally:
            conn.close()


