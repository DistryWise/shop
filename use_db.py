# -*- coding: utf-8 -*-
import sqlite3
from datetime import datetime, timedelta
import uuid
from flask import Blueprint, request, session, jsonify, current_app

DB_PATH = 'visits.db'
users_bp = Blueprint('users', __name__)

# -------------------------------------------------
# Инициализация БД
# -------------------------------------------------
def init_users_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS visits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ip_address TEXT NOT NULL,
            session_token TEXT NOT NULL,
            visit_time TEXT NOT NULL,
            path TEXT NOT NULL DEFAULT "/"
        )
    ''')
    c.execute("PRAGMA table_info(visits)")
    cols = {row[1] for row in c.fetchall()}
    if 'path' not in cols:
        c.execute('ALTER TABLE visits ADD COLUMN path TEXT NOT NULL DEFAULT "/"')

    c.execute('CREATE INDEX IF NOT EXISTS idx_ip_time   ON visits(ip_address, visit_time)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_time     ON visits(visit_time)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_token    ON visits(session_token, visit_time)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_path     ON visits(path)')
    conn.commit()
    conn.close()

# -------------------------------------------------
# Подключение
# -------------------------------------------------
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# -------------------------------------------------
# Трекинг визитов
# -------------------------------------------------
def track_visits(app):
    @app.before_request
    def _():
        if request.path.startswith(('/admin', '/static')):
            return
        ip = request.remote_addr or 'unknown'
        token = session.get('anon_token')
        if not token:
            token = str(uuid.uuid4())
            session['anon_token'] = token
            session.permanent = True
            app.permanent_session_lifetime = timedelta(hours=1)
        path = request.path or '/'

        conn = get_db()
        c = conn.cursor()
        c.execute(
            "INSERT INTO visits (ip_address, session_token, visit_time, path) VALUES (?, ?, ?, ?)",
            (ip, token, datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S'), path)
        )
        conn.commit()
        conn.close()

# -------------------------------------------------
# Очистка
# -------------------------------------------------
@users_bp.route('/api/clear_visits', methods=['POST'])
def clear_visits():
    if request.form.get('password') != current_app.config.get('ADMIN_PASSWORD'):
        return jsonify({'error': 'Invalid password'}), 403
    conn = get_db()
    conn.execute('DELETE FROM visits')
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@users_bp.route('/api/clear_visits_period', methods=['POST'])
def clear_visits_period():
    if request.form.get('password') != current_app.config.get('ADMIN_PASSWORD'):
        return jsonify({'error': 'Invalid password'}), 403
    period = request.form.get('period', 'day')
    deltas = {'day': 1, 'week': 7, 'month': 30, 'year': 365}
    if period not in deltas:
        return jsonify({'error': 'Invalid period'}), 400
    start = datetime.utcnow() - timedelta(days=deltas[period])
    conn = get_db()
    conn.execute('DELETE FROM visits WHERE visit_time >= ?', (start.strftime('%Y-%m-%d %H:%M:%S'),))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# -------------------------------------------------
# Основная статистика — ИСПРАВЛЕНО
# -------------------------------------------------
def get_anon_stats(period='day'):
    conn = get_db()

    # ← ВАЖНО: каждый запрос — в отдельном курсоре
    def scalar(sql, params=()):
        cur = conn.cursor()
        cur.execute(sql, params)
        row = cur.fetchone()
        return int(row[0] or 0) if row else 0

    deltas = {'day': 1, 'week': 7, 'month': 30, 'year': 365}
    if period not in deltas:
        conn.close()
        return {'error': 'Invalid period'}

    now = datetime.utcnow()
    start = now - timedelta(days=deltas[period])
    start_str = start.strftime('%Y-%m-%d %H:%M:%S')

    # ---------- Общие цифры ----------
    total_visits = scalar('SELECT COUNT(DISTINCT session_token) FROM visits WHERE visit_time >= ?', (start_str,))
    unique_visitors = scalar('SELECT COUNT(DISTINCT ip_address) FROM visits WHERE visit_time >= ?', (start_str,))
    current_online = scalar('SELECT COUNT(DISTINCT session_token) FROM visits WHERE visit_time > ?', ((now - timedelta(minutes=15)).strftime('%Y-%m-%d %H:%M:%S'),))

    # ---------- Среднее время ----------
    cur = conn.cursor()
    cur.execute('''
        SELECT session_token,
               MIN(visit_time) AS first,
               MAX(visit_time) AS last
        FROM visits WHERE visit_time >= ? GROUP BY session_token
    ''', (start_str,))
    sessions = cur.fetchall()
    avg_time = 0
    if sessions:
        total_sec = 0
        for s in sessions:
            try:
                first = datetime.strptime(s['first'][:19], '%Y-%m-%d %H:%M:%S')
                last = datetime.strptime(s['last'][:19], '%Y-%m-%d %H:%M:%S')
                total_sec += (last - first).total_seconds()
            except Exception:
                continue
        avg_time = int(total_sec / len(sessions))

    # ---------- Топ-страницы ----------
    cur = conn.cursor()
    cur.execute('''
        SELECT path, COUNT(*) AS views
        FROM visits WHERE visit_time >= ?
        GROUP BY path ORDER BY views DESC LIMIT 10
    ''', (start_str,))
    top_pages = [{'path': r['path'], 'views': r['views']} for r in cur.fetchall()]

    # ---------- Активность по часам ----------
    activity_map = []
    base_hour = now.replace(minute=0, second=0, microsecond=0)
    for h in range(24):
        hour_start = base_hour - timedelta(hours=23 - h)
        if hour_start < start:
            continue
        hour_end = hour_start + timedelta(hours=1)
        s1 = hour_start.strftime('%Y-%m-%d %H:%M:%S')
        s2 = hour_end.strftime('%Y-%m-%d %H:%M:%S')
        count = scalar('SELECT COUNT(DISTINCT session_token) FROM visits WHERE visit_time >= ? AND visit_time < ?', (s1, s2))
        activity_map.append({'hour': hour_start.strftime('%H:00'), 'active_sessions': count})

    # ---------- Графики — ИСПРАВЛЕНО ----------
    visits_data = []
    unique_data = []
    non_unique_data = []

    if period == 'day':
        base_hour = now.replace(minute=0, second=0, microsecond=0)
        for i in range(24):
            hour_start = base_hour - timedelta(hours=23 - i)
            if hour_start >= now or hour_start < start:
                continue
            hour_end = hour_start + timedelta(hours=1)
            s1 = hour_start.strftime('%Y-%m-%d %H:%M:%S')
            s2 = hour_end.strftime('%Y-%m-%d %H:%M:%S')

            non_unique = scalar('SELECT COUNT(*) FROM visits WHERE visit_time >= ? AND visit_time < ?', (s1, s2))
            visits     = scalar('SELECT COUNT(DISTINCT session_token) FROM visits WHERE visit_time >= ? AND visit_time < ?', (s1, s2))
            unique     = scalar('SELECT COUNT(DISTINCT ip_address) FROM visits WHERE visit_time >= ? AND visit_time < ?', (s1, s2))

            label = hour_start.strftime('%H:00')
            visits_data.append({'label': label, 'value': visits})
            unique_data.append({'label': label, 'value': unique})
            non_unique_data.append({'label': label, 'value': non_unique})

        # Текущий (неполный) час
        s1 = base_hour.strftime('%Y-%m-%d %H:%M:%S')
        s2 = (now + timedelta(seconds=1)).strftime('%Y-%m-%d %H:%M:%S')
        label = now.strftime('%H:00') + ' (сейчас)'

        non_unique = scalar('SELECT COUNT(*) FROM visits WHERE visit_time >= ? AND visit_time < ?', (s1, s2))
        visits     = scalar('SELECT COUNT(DISTINCT session_token) FROM visits WHERE visit_time >= ? AND visit_time < ?', (s1, s2))
        unique     = scalar('SELECT COUNT(DISTINCT ip_address) FROM visits WHERE visit_time >= ? AND visit_time < ?', (s1, s2))

        visits_data.append({'label': label, 'value': visits})
        unique_data.append({'label': label, 'value': unique})
        non_unique_data.append({'label': label, 'value': non_unique})

    elif period in ('week', 'month'):
        days_count = 7 if period == 'week' else 30
        for i in range(days_count):
            day_date = now.date() - timedelta(days=days_count - 1 - i)
            if day_date < start.date():
                continue
            s1 = f"{day_date} 00:00:00"
            s2 = f"{day_date + timedelta(days=1)} 00:00:00"
            label = day_date.strftime('%d.%m')

            non_unique = scalar('SELECT COUNT(*) FROM visits WHERE visit_time >= ? AND visit_time < ?', (s1, s2))
            visits     = scalar('SELECT COUNT(DISTINCT session_token) FROM visits WHERE visit_time >= ? AND visit_time < ?', (s1, s2))
            unique     = scalar('SELECT COUNT(DISTINCT ip_address) FROM visits WHERE visit_time >= ? AND visit_time < ?', (s1, s2))

            visits_data.append({'label': label, 'value': visits})
            unique_data.append({'label': label, 'value': unique})
            non_unique_data.append({'label': label, 'value': non_unique})

        # Сегодня (неполный день)
        today = now.date()
        s1 = f"{today} 00:00:00"
        s2 = (now + timedelta(seconds=1)).strftime('%Y-%m-%d %H:%M:%S')
        label = today.strftime('%d.%m') + ' (сегодня)'

        non_unique = scalar('SELECT COUNT(*) FROM visits WHERE visit_time >= ? AND visit_time < ?', (s1, s2))
        visits     = scalar('SELECT COUNT(DISTINCT session_token) FROM visits WHERE visit_time >= ? AND visit_time < ?', (s1, s2))
        unique     = scalar('SELECT COUNT(DISTINCT ip_address) FROM visits WHERE visit_time >= ? AND visit_time < ?', (s1, s2))

        visits_data.append({'label': label, 'value': visits})
        unique_data.append({'label': label, 'value': unique})
        non_unique_data.append({'label': label, 'value': non_unique})

    else:  # year
        items = []
        for offset in range(12):
            m = (now.month - offset - 1) % 12 + 1
            y = now.year if offset < now.month else now.year - 1
            month_start = datetime(y, m, 1)
            if month_start < start:
                continue
            next_m = 1 if m == 12 else m + 1
            next_y = y + 1 if m == 12 else y
            month_end = datetime(next_y, next_m, 1)

            s1 = month_start.strftime('%Y-%m-%d 00:00:00')
            s2 = month_end.strftime('%Y-%m-%d 00:00:00')

            non_unique = scalar('SELECT COUNT(*) FROM visits WHERE visit_time >= ? AND visit_time < ?', (s1, s2))
            visits     = scalar('SELECT COUNT(DISTINCT session_token) FROM visits WHERE visit_time >= ? AND visit_time < ?', (s1, s2))
            unique     = scalar('SELECT COUNT(DISTINCT ip_address) FROM visits WHERE visit_time >= ? AND visit_time < ?', (s1, s2))

            items.append((month_start, month_start.strftime('%b'), visits, unique, non_unique))

        items.sort(key=lambda x: x[0])
        for _, label, v, u, n in items:
            visits_data.append({'label': label, 'value': v})
            unique_data.append({'label': label, 'value': u})
            non_unique_data.append({'label': label, 'value': n})

        # Текущий месяц
        curr_start = datetime(now.year, now.month, 1)
        s1 = curr_start.strftime('%Y-%m-%d 00:00:00')
        s2 = (now + timedelta(seconds=1)).strftime('%Y-%m-%d %H:%M:%S')
        label = now.strftime('%b') + ' (тек.)'

        non_unique = scalar('SELECT COUNT(*) FROM visits WHERE visit_time >= ? AND visit_time < ?', (s1, s2))
        visits     = scalar('SELECT COUNT(DISTINCT session_token) FROM visits WHERE visit_time >= ? AND visit_time < ?', (s1, s2))
        unique     = scalar('SELECT COUNT(DISTINCT ip_address) FROM visits WHERE visit_time >= ? AND visit_time < ?', (s1, s2))

        visits_data.append({'label': label, 'value': visits})
        unique_data.append({'label': label, 'value': unique})
        non_unique_data.append({'label': label, 'value': non_unique})

    conn.close()
    return {
        'total_visits': total_visits,
        'unique_visitors': unique_visitors,
        'current_online': current_online,
        'avg_time_on_site': avg_time,
        'top_pages': top_pages,
        'activity_map': activity_map,
        'visits_data': visits_data,
        'unique_data': unique_data,
        'non_unique_data': non_unique_data,
        'period': period
    }

@users_bp.route('/api/stats')
def api_stats():
    period = request.args.get('period', 'day')
    return jsonify(get_anon_stats(period))