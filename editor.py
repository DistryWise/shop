# editor.py — ZAZA FINAL EDITION + ПОЛНАЯ ИНТЕГРАЦИЯ С SVG.HTML

import sqlite3
import json
import logging
import os
import base64
import uuid
from flask import Blueprint, jsonify, request

logger = logging.getLogger(__name__)

# === ПУТИ ===
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ZAZA_DB = os.path.join(BASE_DIR, "zaza_editor.db")
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'static', 'uploads', 'banners')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

zaza_editor = Blueprint('zaza_editor', __name__, url_prefix='/api/landing')

# === ИНИЦИАЛИЗАЦИЯ БД ===
def init_zaza_db():
    try:
        conn = sqlite3.connect(ZAZA_DB)
        c = conn.cursor()

        # === ТАБЛИЦА КЛИКОВ ПО ХОТ-СПОТАМ ===
        c.execute('''
            CREATE TABLE IF NOT EXISTS hotspot_clicks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                carousel_type TEXT,
                slide_index INTEGER,
                url TEXT,
                clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                user_agent TEXT
            )
        ''')

        # === СЛАЙДЫ ЛЕНДИНГА (обычные секции) ===
        c.execute('''
            CREATE TABLE IF NOT EXISTS slides (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER,
                slide_number INTEGER,
                background TEXT,
                bg_size TEXT DEFAULT 'cover',
                elements TEXT,
                FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
                UNIQUE(project_id, slide_number)
            )
        ''')

        # === ТАБЛИЦА ПРОЕКТОВ (если ещё нет) ===
        c.execute('''
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # === КАРУСЕЛИ: ФОНЫ (main, services, home) ===
        for table in ['carousel_main', 'carousel_services', 'carousel_home', 'carousel_products1', 'carousel_products2']:
            c.execute(f'''
                CREATE TABLE IF NOT EXISTS {table} (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sort_order INTEGER DEFAULT 0,
                    image TEXT,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')

        # === СЛОИ (текст, картинки, хотспоты) ===
        c.execute('''
            CREATE TABLE IF NOT EXISTS carousel_layers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                carousel_type TEXT,        -- main, services, home
                slide_index INTEGER,
                layer_id TEXT UNIQUE,
                layer_type TEXT,           -- text, image, hotspot
                layer_data TEXT,
                hidden INTEGER DEFAULT 0,
                sort_order INTEGER DEFAULT 0
            )
        ''')

        # === ИНИЦИАЛИЗАЦИЯ ПРОЕКТА ===
        c.execute('SELECT id FROM projects LIMIT 1')
        if not c.fetchone():
            c.execute('INSERT INTO projects (name) VALUES (?)', ('Zaza Landing',))

        fallback = '/static/assets/fallback.jpg'

        # Заполняем карусели fallback'ами, если пустые
        for kind, count in [('main', 3), ('services', 3), ('home', 5), ('products1', 3), ('products2', 3)]:
            table = f'carousel_{kind}'
            c.execute(f'SELECT COUNT(*) FROM {table}')
            if c.fetchone()[0] == 0:
                for i in range(count):
                    c.execute(f'INSERT INTO {table} (sort_order, image) VALUES (?, ?)', (i, fallback))

        conn.commit()
        logger.info("ZAZA DB полностью инициализирована: main (3), services (3), home (5)")
    except Exception as e:
        logger.error(f"ZAZA INIT ERROR: {e}")
        raise
    finally:
        conn.close()

@zaza_editor.route('/click', methods=['DELETE'])
def clear_clicks():
    try:
        conn = sqlite3.connect(ZAZA_DB)
        c = conn.cursor()
        c.execute('DELETE FROM hotspot_clicks')
        conn.commit()
        conn.close()
        return jsonify({"status": "cleared"})
    except:
        return jsonify({"error": "db"}), 500


# === API: СТАТИСТИКА ===
@zaza_editor.route('/stats/<kind>')
def get_stats(kind):
    if kind not in ['main', 'services']:
        return jsonify([]), 400
    try:
        conn = sqlite3.connect(ZAZA_DB)
        c = conn.cursor()
        c.execute('''
            SELECT url, COUNT(*) as clicks, 
                   MAX(clicked_at) as last_click
            FROM hotspot_clicks 
            WHERE carousel_type = ?
            GROUP BY url
            ORDER BY clicks DESC
        ''', (kind,))
        rows = c.fetchall()
        conn.close()
        return jsonify([{"url": r[0], "clicks": r[1], "last": r[2]} for r in rows])
    except Exception as e:
        logger.error(f"STATS ERROR: {e}")
        return jsonify([]), 500

# === API: КЛИК ===
@zaza_editor.route('/click', methods=['POST'])
def track_click():
    try:
        data = request.get_json(force=True)
        kind = data.get('kind')
        slide = data.get('slide')
        url = data.get('url')
        ua = request.headers.get('User-Agent', '')

        if not kind or not url or slide not in [0,1,2]:
            return jsonify({"error": "invalid"}), 400

        conn = sqlite3.connect(ZAZA_DB)
        c = conn.cursor()
        c.execute('''
            INSERT INTO hotspot_clicks 
            (carousel_type, slide_index, url, user_agent) 
            VALUES (?, ?, ?, ?)
        ''', (kind, slide, url, ua))
        conn.commit()
        conn.close()
        return jsonify({"status": "ok"})
    except Exception as e:
        logger.error(f"CLICK ERROR: {e}")
        return jsonify({"error": "db"}), 500

# === ID ПРОЕКТА ===
def get_project_id():
    conn = sqlite3.connect(ZAZA_DB)
    c = conn.cursor()
    c.execute('SELECT id FROM projects LIMIT 1')
    row = c.fetchone()
    conn.close()
    return row[0] if row else None

# === СОХРАНЕНИЕ КАРТИНКИ ===
def save_image_file(data_url):
    if not data_url or not isinstance(data_url, str) or not data_url.startswith('data:image'):
        return '/static/assets/fallback.jpg'
    try:
        header, encoded = data_url.split(',', 1)
        ext = header.split(';')[0].split('/')[-1]
        ext = ext if ext in ['png', 'jpg', 'jpeg', 'gif', 'webp'] else 'png'
        filename = f"banner_{uuid.uuid4().hex}.{ext}"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        with open(filepath, 'wb') as f:
            f.write(base64.b64decode(encoded))
        return f"/static/uploads/banners/{filename}"
    except Exception as e:
        logger.error(f"Image save error: {e}")
        return '/static/assets/fallback.jpg'

# === API: ЛЕНДИНГ ===
@zaza_editor.route('/load', methods=['GET'])
def load():
    try:
        project_id = get_project_id()
        if not project_id:
            return jsonify({"slides": []}), 500

        conn = sqlite3.connect(ZAZA_DB)
        c = conn.cursor()
        c.execute('SELECT slide_number, background, bg_size, elements FROM slides WHERE project_id = ? ORDER BY slide_number', (project_id,))
        rows = c.fetchall()
        conn.close()

        slides = []
        for row in rows:
            slide_num, bg, bg_size, elements_json = row
            elements = json.loads(elements_json) if elements_json else []
            slides.append({
                "slide": slide_num,
                "background": bg or "",
                "bgSize": bg_size,
                "elements": elements
            })

        existing = {s["slide"] for s in slides}
        for i in range(1, 6):
            if i not in existing:
                slides.append({"slide": i, "background": "", "bgSize": "cover", "elements": []})

        return jsonify({"slides": sorted(slides, key=lambda x: x["slide"])})
    except Exception as e:
        logger.error(f"LOAD ERROR: {e}")
        return jsonify({"slides": []}), 500

@zaza_editor.route('/save', methods=['POST'])
def save():
    try:
        data = request.get_json(force=True)
        if not data or 'slides' not in data:
            return jsonify({"success": False}), 400

        project_id = get_project_id()
        if not project_id:
            return jsonify({"success": False}), 500

        conn = sqlite3.connect(ZAZA_DB)
        c = conn.cursor()
        c.execute('DELETE FROM slides WHERE project_id = ?', (project_id,))

        for slide_data in data['slides']:
            slide_num = int(slide_data.get('slide', 1))
            background = str(slide_data.get('background', ''))
            bg_size = str(slide_data.get('bgSize', 'cover'))
            elements = []
            for el in slide_data.get('elements', []):
                if el.get('type') == 'image' and el.get('content', '').startswith('data:image'):
                    el['content'] = save_image_file(el['content'])
                elements.append(el)
            elements_json = json.dumps(elements)

            c.execute('''
                INSERT OR REPLACE INTO slides 
                (project_id, slide_number, background, bg_size, elements)
                VALUES (?, ?, ?, ?, ?)
            ''', (project_id, slide_num, background, bg_size, elements_json))

        c.execute('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', (project_id,))
        conn.commit()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"SAVE ERROR: {e}")
        return jsonify({"success": False}), 500

# === API: КАРУСЕЛИ ===
@zaza_editor.route('/carousel/main')
def api_carousel_main():
    try:
        conn = sqlite3.connect(ZAZA_DB)
        c = conn.cursor()

        c.execute('SELECT image FROM carousel_main ORDER BY sort_order LIMIT 3')
        backgrounds = [row[0] for row in c.fetchall()]

        c.execute('''
            SELECT slide_index, layer_type, layer_data, hidden 
            FROM carousel_layers 
            WHERE carousel_type="main" 
            ORDER BY slide_index, sort_order
        ''')
        layers_data = c.fetchall()

        slides = []
        for i in range(3):
            bg_url = backgrounds[i] if i < len(backgrounds) else '/static/assets/fallback.jpg'
            slide_layers = []
            hotspots = []

            for row in layers_data:
                if row[0] == i:
                    layer_type = row[1]
                    layer_json = row[2]
                    hidden = bool(row[3])
                    layer = json.loads(layer_json)
                    layer['hidden'] = hidden
                    if layer_type == 'hotspot':
                        hotspots.append(layer)
                    else:
                        slide_layers.append(layer)

            slides.append({
                "background": {"url": bg_url, "animation": "fadeIn"},
                "layers": slide_layers,
                "hotspots": hotspots
            })

        conn.close()
        return jsonify(slides)
    except Exception as e:
        logger.error(f"MAIN CAROUSEL ERROR: {e}")
        return jsonify([{"background": {"url": "/static/assets/fallback.jpg"}, "layers": [], "hotspots": []}] * 3)

@zaza_editor.route('/carousel/services')
def api_carousel_services():
    try:
        conn = sqlite3.connect(ZAZA_DB)
        c = conn.cursor()

        c.execute('SELECT image FROM carousel_services ORDER BY sort_order LIMIT 3')
        backgrounds = [row[0] for row in c.fetchall()]

        c.execute('''
            SELECT slide_index, layer_type, layer_data, hidden 
            FROM carousel_layers 
            WHERE carousel_type="services" 
            ORDER BY slide_index, sort_order
        ''')
        layers_data = c.fetchall()

        slides = []
        for i in range(3):
            bg_url = backgrounds[i] if i < len(backgrounds) else '/static/assets/fallback.jpg'
            slide_layers = []
            hotspots = []

            for row in layers_data:
                if row[0] == i:
                    layer_type = row[1]
                    layer_json = row[2]
                    hidden = bool(row[3])
                    layer = json.loads(layer_json)
                    layer['hidden'] = hidden
                    if layer_type == 'hotspot':
                        hotspots.append(layer)
                    else:
                        slide_layers.append(layer)

            slides.append({
                "background": {"url": bg_url, "animation": "fadeIn"},
                "layers": slide_layers,
                "hotspots": hotspots
            })

        conn.close()
        return jsonify(slides)
    except Exception as e:
        logger.error(f"SERVICES CAROUSEL ERROR: {e}")
        return jsonify([{"background": {"url": "/static/assets/fallback.jpg"}, "layers": [], "hotspots": []}] * 3)

# === СОХРАНЕНИЕ КАРУСЕЛЕЙ ===
@zaza_editor.route('/carousel/<kind>', methods=['POST'])
def save_carousel(kind):
    if kind not in ['main', 'services']:
        return jsonify({"error": "invalid kind"}), 400
    table = f"carousel_{kind}"
    try:
        data = request.get_json(force=True)
        if not isinstance(data, list) or len(data) != 3:
            return jsonify({"error": "expected array of 3 slides"}), 400

        conn = sqlite3.connect(ZAZA_DB)
        c = conn.cursor()

        # === ОЧИСТКА ===
        c.execute(f'DELETE FROM {table}')
        c.execute('DELETE FROM carousel_layers WHERE carousel_type = ?', (kind,))

        for i, slide in enumerate(data):
            # === ФОН ===
            bg_data = slide.get('background', {})
            url = bg_data.get('url')
            if url is None:
                url = '/static/assets/fallback.jpg'
            elif isinstance(url, str) and url.startswith('data:image'):
                url = save_image_file(url)
            elif not isinstance(url, str) or not url.startswith('/static/'):
                url = '/static/assets/fallback.jpg'

            c.execute(f'INSERT INTO {table} (sort_order, image) VALUES (?, ?)', (i, url))

            # === СЛОИ: ТЕКСТ, КАРТИНКИ ===
            layers = slide.get('layers', [])
            for j, layer in enumerate(layers):
                layer_id = str(layer.get('id', f'{kind}_s{i}_l{j}'))
                layer_type = layer.get('type', 'text')

                # ← СОХРАНЯЕМ URL В layer.url
                if layer_type == 'image':
                    url = layer.get('url', '')
                    if isinstance(url, str) and url.startswith('data:image'):
                        url = save_image_file(url)
                    layer['url'] = url  # ← ВОТ ГДЕ БЫЛО!

                layer_data = json.dumps(layer)

                # === СТИЛЬ: строка → объект (если нужно) ===
                if isinstance(layer.get('style'), str):
                    style_obj = {}
                    for pair in layer['style'].split(';'):
                        if ':' not in pair: continue
                        k, v = pair.split(':', 1)
                        k = k.strip()
                        # CSS → camelCase
                        parts = k.split('-')
                        camel = parts[0] + ''.join(p.capitalize() for p in parts[1:])
                        style_obj[camel] = v.strip()
                    layer['style'] = style_obj

                layer_data = json.dumps(layer)
                c.execute('''
                    INSERT OR REPLACE INTO carousel_layers 
                    (carousel_type, slide_index, layer_id, layer_type, layer_data, sort_order, hidden)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (kind, i, layer_id, layer_type, layer_data, j, int(layer.get('hidden', False))))
            # === HOTSPOTS ===
            hotspots = slide.get('hotspots', [])
            for j, hotspot in enumerate(hotspots):
                layer_id = str(hotspot.get('id', f'{kind}_s{i}_h{j}'))
                # УБИРАЕМ ВСЕ СТИЛИ, кроме позиционирования
                clean_hotspot = {
                    'id': layer_id,
                    'type': 'hotspot',
                    'x': hotspot.get('x', 0),
                    'y': hotspot.get('y', 0),
                    'w': hotspot.get('w', 10),
                    'h': hotspot.get('h', 10),
                    'url': hotspot.get('url', ''),
                    'hidden': bool(hotspot.get('hidden', False))
                }
                layer_data = json.dumps(clean_hotspot)
                c.execute('''
                    INSERT OR REPLACE INTO carousel_layers 
                    (carousel_type, slide_index, layer_id, layer_type, layer_data, sort_order, hidden)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (kind, i, layer_id, 'hotspot', layer_data, j + 1000, int(clean_hotspot['hidden'])))

        conn.commit()
        conn.close()
        logger.info(f"Карусель {kind} сохранена: 3 слайда")
        return jsonify({"status": "saved"})
    except Exception as e:
        logger.error(f"CAROUSEL SAVE ERROR: {e}")
        return jsonify({"error": str(e)}), 500



# === НОВАЯ КАРУСЕЛЬ: ГЛАВНАЯ СТРАНИЦА (5 слайдов) ===
@zaza_editor.route('/carousel/home')
def api_carousel_home():
    try:
        conn = sqlite3.connect(ZAZA_DB)
        c = conn.cursor()

        c.execute('SELECT image FROM carousel_home ORDER BY sort_order')
        backgrounds = [row[0] for row in c.fetchall()]

        c.execute('''
            SELECT slide_index, layer_type, layer_data, hidden 
            FROM carousel_layers 
            WHERE carousel_type = 'home' 
            ORDER BY slide_index, sort_order
        ''')
        layers_data = c.fetchall()

        slides = []
        for i in range(5):
            bg_url = backgrounds[i] if i < len(backgrounds) else '/static/assets/fallback.jpg'
            slide_layers = []
            hotspots = []

            for row in layers_data:
                if row[0] == i:
                    layer = json.loads(row[2])
                    layer['hidden'] = bool(row[3])
                    if row[1] == 'hotspot':
                        hotspots.append(layer)
                    else:
                        slide_layers.append(layer)

            slides.append({
                "background": {"url": bg_url, "type": "image", "animation": "fadeIn"},
                "layers": slide_layers,
                "hotspots": hotspots
            })

        conn.close()
        return jsonify(slides)
    except Exception as e:
        logger.error(f"HOME CAROUSEL LOAD ERROR: {e}")
        return jsonify([{"background": {"url": "/static/assets/fallback.jpg", "type": "image"}, "layers": [], "hotspots": []}] * 5)


@zaza_editor.route('/carousel/home', methods=['POST'])
def save_carousel_home():
    """Сохраняет карусель главной страницы (5 слайдов) — с сохранением всех картинок на диск!"""
    try:
        data = request.get_json(force=True)
        if not isinstance(data, list) or len(data) != 5:
            return jsonify({"error": "expected array of 5 slides"}), 400

        conn = sqlite3.connect(ZAZA_DB)
        c = conn.cursor()

        # Очищаем старые данные
        c.execute('DELETE FROM carousel_home')
        c.execute('DELETE FROM carousel_layers WHERE carousel_type = ?', ('home',))

        for i, slide in enumerate(data):
            # === ФОН — ГЛАВНОЕ ИСПРАВЛЕНИЕ! ===
            bg_obj = slide.get('background', {})
            url = bg_obj.get('url', '')

            # Если пусто — fallback
            if not url or url in ('null', '', 'undefined'):
                url = '/static/assets/fallback.jpg'
            # Если это data:image — сохраняем на диск!
            elif isinstance(url, str) and url.startswith('data:image'):
                url = save_image_file(url)
            # Если это внешняя ссылка — оставляем как есть (но лучше не надо)
            elif url.startswith('http'):
                url = url  # можно оставить, но лучше загружать на сервер
            # Если уже нормальная ссылка на наш сервер — ок
            elif not url.startswith('/static/'):
                url = '/static/assets/fallback.jpg'

            # Сохраняем фон в таблицу carousel_home
            c.execute('INSERT INTO carousel_home (sort_order, image) VALUES (?, ?)', (i, url))

            # === ОБЫЧНЫЕ СЛОИ (текст, картинки) ===
            for j, layer in enumerate(slide.get('layers', [])):
                layer_id = str(layer.get('id', f'home_s{i}_l{j}'))
                layer_type = layer.get('type', 'text')

                # Если картинка — тоже сохраняем на диск
                if layer_type == 'image':
                    img_url = layer.get('url', '')
                    if isinstance(img_url, str) and img_url.startswith('data:image'):
                        layer['url'] = save_image_file(img_url)

                layer_data = json.dumps(layer)
                c.execute('''
                    INSERT OR REPLACE INTO carousel_layers 
                    (carousel_type, slide_index, layer_id, layer_type, layer_data, sort_order, hidden)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', ('home', i, layer_id, layer_type, layer_data, j, int(layer.get('hidden', False))))

            # === ХОТСПТЫ (без изменений) ===
            for j, hotspot in enumerate(slide.get('hotspots', [])):
                layer_id = str(hotspot.get('id', f'home_s{i}_h{j}'))
                clean = {
                    'id': layer_id,
                    'type': 'hotspot',
                    'x': hotspot.get('x', 0),
                    'y': hotspot.get('y', 0),
                    'w': hotspot.get('w', 10),
                    'h': hotspot.get('h', 10),
                    'url': hotspot.get('url', ''),
                    'hidden': bool(hotspot.get('hidden', False))
                }
                c.execute('''
                    INSERT OR REPLACE INTO carousel_layers 
                    (carousel_type, slide_index, layer_id, layer_type, layer_data, sort_order, hidden)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', ('home', i, layer_id, 'hotspot', json.dumps(clean), j + 1000, int(clean['hidden'])))

        conn.commit()
        conn.close()
        logger.info("Карусель главной (home) сохранена: 5 слайдов — все картинки на диске!")
        return jsonify({"status": "saved"})
    except Exception as e:
        logger.error(f"HOME CAROUSEL SAVE ERROR: {e}")
        return jsonify({"error": str(e)}), 500
    
# =============================================================================
# ДОБАВЛЯЕМ ТОЛЬКО ТОВАРЫ 1 и ТОВАРЫ 2 — без изменений в main/services/home
# =============================================================================

@zaza_editor.route('/carousel/products1')
def load_products1():
    try:
        conn = sqlite3.connect(ZAZA_DB)
        c = conn.cursor()

        # Фоны
        c.execute('SELECT image FROM carousel_products1 ORDER BY sort_order')
        backgrounds = [row[0] for row in c.fetchall()]

        # Слои + хотспоты
        c.execute('''
            SELECT slide_index, layer_type, layer_data, hidden 
            FROM carousel_layers 
            WHERE carousel_type = 'products1' 
            ORDER BY slide_index, sort_order
        ''')
        layers = c.fetchall()

        slides = []
        for i in range(3):
            bg = backgrounds[i] if i < len(backgrounds) else '/static/assets/fallback.jpg'
            slide_layers = []
            hotspots = []

            for slide_idx, ltype, ldata, hidden in layers:
                if slide_idx != i: 
                    continue
                layer = json.loads(ldata)
                layer['hidden'] = bool(hidden)
                if ltype == 'hotspot':
                    hotspots.append(layer)
                else:
                    slide_layers.append(layer)

            slides.append({
                "background": {"url": bg, "animation": "fadeIn"},
                "layers": slide_layers,
                "hotspots": hotspots
            })

        conn.close()
        return jsonify(slides)
    except Exception as e:
        logger.error(f"PRODUCTS1 LOAD ERROR: {e}")
        fallback = {"background": {"url": "/static/assets/fallback.jpg"}, "layers": [], "hotspots": []}
        return jsonify([fallback] * 3)


@zaza_editor.route('/carousel/products2')
def load_products2():
    try:
        conn = sqlite3.connect(ZAZA_DB)
        c = conn.cursor()

        c.execute('SELECT image FROM carousel_products2 ORDER BY sort_order')
        backgrounds = [row[0] for row in c.fetchall()]

        c.execute('''
            SELECT slide_index, layer_type, layer_data, hidden 
            FROM carousel_layers 
            WHERE carousel_type = 'products2' 
            ORDER BY slide_index, sort_order
        ''')
        layers = c.fetchall()

        slides = []
        for i in range(3):
            bg = backgrounds[i] if i < len(backgrounds) else '/static/assets/fallback.jpg'
            slide_layers = []
            hotspots = []

            for slide_idx, ltype, ldata, hidden in layers:
                if slide_idx != i: 
                    continue
                layer = json.loads(ldata)
                layer['hidden'] = bool(hidden)
                if ltype == 'hotspot':
                    hotspots.append(layer)
                else:
                    slide_layers.append(layer)

            slides.append({
                "background": {"url": bg, "animation": "fadeIn"},
                "layers": slide_layers,
                "hotspots": hotspots
            })

        conn.close()
        return jsonify(slides)
    except Exception as e:
        logger.error(f"PRODUCTS2 LOAD ERROR: {e}")
        fallback = {"background": {"url": "/static/assets/fallback.jpg"}, "layers": [], "hotspots": []}
        return jsonify([fallback] * 3)


@zaza_editor.route('/carousel/products1', methods=['POST'])
@zaza_editor.route('/carousel/products2', methods=['POST'])
def save_products():
    kind = request.path.split('/')[-1]  # products1 или products2
    try:
        data = request.get_json(force=True)
        if not isinstance(data, list) or len(data) != 3:
            return jsonify({"error": "expected 3 slides"}), 400

        conn = sqlite3.connect(ZAZA_DB)
        c = conn.cursor()

        table = f"carousel_{kind}"
        c.execute(f'DELETE FROM {table}')
        c.execute('DELETE FROM carousel_layers WHERE carousel_type = ?', (kind,))

        for i, slide in enumerate(data):
            # Фон
            bg_url = slide.get('background', {}).get('url', '')
            bg_obj = slide.get('background') or {}
            bg_url_raw = bg_obj.get('url')

            if not bg_url_raw or bg_url_raw in (None, 'null', ''):
                bg_url = '/static/assets/fallback.jpg'
            elif isinstance(bg_url_raw, str) and bg_url_raw.startswith('data:image'):
                bg_url = save_image_file(bg_url_raw)
            elif isinstance(bg_url_raw, str) and (bg_url_raw.startswith('http') or bg_url_raw.startswith('/static/')):
                bg_url = bg_url_raw
            else:
                bg_url = '/static/assets/fallback.jpg'
            c.execute(f'INSERT INTO {table} (sort_order, image) VALUES (?, ?)', (i, bg_url))

            # Обычные слои
            for j, layer in enumerate(slide.get('layers', [])):
                lid = str(layer.get('id', f'{kind}_s{i}_l{j}'))
                ltype = layer.get('type', 'text')
                if ltype == 'image' and str(layer.get('url', '')).startswith('data:image'):
                    layer['url'] = save_image_file(layer['url'])
                c.execute('''
                    INSERT OR REPLACE INTO carousel_layers
                    (carousel_type, slide_index, layer_id, layer_type, layer_data, sort_order, hidden)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (kind, i, lid, ltype, json.dumps(layer), j, int(layer.get('hidden', False))))

            # Хотспоты
            for j, hs in enumerate(slide.get('hotspots', [])):
                lid = str(hs.get('id', f'{kind}_s{i}_h{j}'))
                clean = {
                    'id': lid, 'type': 'hotspot',
                    'x': hs.get('x', 0), 'y': hs.get('y', 0),
                    'w': hs.get('w', 10), 'h': hs.get('h', 10),
                    'url': hs.get('url', ''),
                    'hidden': bool(hs.get('hidden', False))
                }
                c.execute('''
                    INSERT OR REPLACE INTO carousel_layers
                    (carousel_type, slide_index, layer_id, layer_type, layer_data, sort_order, hidden)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (kind, i, lid, 'hotspot', json.dumps(clean), j + 1000, int(clean['hidden'])))

        conn.commit()
        conn.close()
        logger.info(f"Карусель {kind} сохранена")
        return jsonify({"status": "saved"})
    except Exception as e:
        logger.error(f"{kind.upper()} SAVE ERROR: {e}")
        return jsonify({"error": str(e)}), 500


# === ЗАГРУЗКА ФАЙЛА ===
@zaza_editor.route('/upload', methods=['POST'])
def upload_image():
    if 'image' not in request.files:
        return jsonify({"error": "no file"}), 400
    file = request.files['image']
    if not file.filename:
        return jsonify({"error": "empty"}), 400
    ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else 'png'
    if ext not in ['png', 'jpg', 'jpeg', 'webp', 'gif']:
        ext = 'png'
    filename = f"img_{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)
    return jsonify({"url": f"/static/uploads/banners/{filename}"})

# === СБРОС ===
@zaza_editor.route('/reset', methods=['POST'])
def reset():
    project_id = get_project_id()
    if not project_id:
        return jsonify({"success": False}), 500
    conn = sqlite3.connect(ZAZA_DB)
    c = conn.cursor()
    c.execute('DELETE FROM slides WHERE project_id = ?', (project_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

# === АВТО-ИНИЦИАЛИЗАЦИЯ ===
init_zaza_db()
logger.info("ZAZA EDITOR + ПОЛНЫЕ КАРУСЕЛИ ГОТОВЫ")

__all__ = ['zaza_editor', 'init_zaza_db']