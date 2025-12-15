# bills.py — бэкенд для /profile/bills (Оплата счетов)
from flask import Blueprint, render_template, session, jsonify, request, current_app
import sqlite3
import logging
from datetime import datetime
from pypdf import PdfReader

logger = logging.getLogger(__name__)
bills_bp = Blueprint('bills', __name__, template_folder='templates')

DB_PATH = 'database.db'

def check_admin_password():
    """Проверяет пароль админа из JSON тела запроса. Возвращает True/False"""
    data = request.get_json(silent=True) or {}
    password = data.get('admin_password') or request.form.get('admin_password')
    
    if password != 'admin123':
        return False
    return True

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# ===============================================
# ИНИЦИАЛИЗАЦИЯ ТАБЛИЦЫ СЧЁТОВ (один раз при старте)
# ===============================================
def init_invoices_table():
    conn = get_conn()
    try:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS invoices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                invoice_number TEXT NOT NULL UNIQUE,
                amount INTEGER NOT NULL,                -- в копейках
                created_at DATE NOT NULL,
                paid_at DATE DEFAULT NULL,
                user_marked_paid BOOLEAN DEFAULT 0,     -- клиент нажал "Я оплатил"
                admin_confirmed BOOLEAN DEFAULT 0, -- админ подтвердил поступление
                requisites TEXT NOT NULL,               -- реквизиты (можно JSON или текст)
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        ''')
        # Индекс для быстрой выборки
        conn.execute('CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id)')
        conn.commit()
        print("Таблица invoices готова")
    except Exception as e:
        print(f"Ошибка создания таблицы invoices: {e}")
    finally:
        conn.close()

# Вызываем при импорте
init_invoices_table()

# ===============================================
# РОУТЫ
# ===============================================

@bills_bp.route('/profile/bills')
def bills_page():
    user_authenticated = 'user_id' in session
    return render_template('bills.html', user_authenticated=user_authenticated)


# Получить список счетов пользователя
@bills_bp.route('/api/invoices', methods=['GET'])
def get_invoices():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    user_id = session['user_id']
    conn = get_conn()
    try:
        rows = conn.execute('''
            SELECT 
                id,
                invoice_number,
                amount,
                created_at,
                user_marked_paid,
                admin_confirmed,
                paid_at
            FROM invoices 
            WHERE user_id = ?
            ORDER BY created_at DESC
        ''', (user_id,)).fetchall()

        pending = []
        paid = []

        for r in rows:
            item = {
                "id": r['id'],
                "number": r['invoice_number'],
                "amount": r['amount'],
                "created_at": r['created_at'],
                "user_marked_paid": bool(r['user_marked_paid']),
                "admin_confirmed": bool(r['admin_confirmed']),
                "paid_at": r['paid_at']
            }

            if r['user_marked_paid'] or r['admin_confirmed']:
                paid.append(item)
            else:
                pending.append(item)

        return jsonify({
            "pending": pending,
            "paid": paid,
            "counts": {"pending": len(pending), "paid": len(paid)}
        })
    finally:
        conn.close()


# Получить данные одного счёта + реквизиты
@bills_bp.route('/api/invoices/<int:invoice_id>', methods=['GET'])
def get_invoice_detail(invoice_id):
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    user_id = session['user_id']
    conn = get_conn()
    try:
        row = conn.execute('''
            SELECT 
                invoice_number,
                amount,
                created_at,
                user_marked_paid,
                admin_confirmed,
                requisites
            FROM invoices 
            WHERE id = ? AND user_id = ?
        ''', (invoice_id, user_id)).fetchone()

        if not row:
            return jsonify({"error": "Счёт не найден"}), 404

        is_paid = bool(row['user_marked_paid'] or row['admin_confirmed'])

        # Здесь будет реальная подгрузка реквизитов из админки
        # Пока — заглушка (можно потом вынести в отдельную таблицу company_requisites)
        requisites_text = row['requisites'] or f'''
Реквизиты для оплаты по счёту №{row['invoice_number']}

Получатель: ООО "Пилигрим"
ИНН: 1234567890    КПП: 123456789
Расчётный счёт: 40702810500000012345
Банк: АО "ТИНЬКОФФ БАНК"
БИК: 044525974
Кор. счёт: 30101810145250000974

Назначение платежа: Оплата по счёту №{row['invoice_number']} от {datetime.strptime(row['created_at'], '%Y-%m-%d').strftime('%d.%m.%Y')}
Сумма к оплате: {row['amount']:,} ₽
        '''.strip()

        return jsonify({
            "title": f"Счёт №{row['invoice_number']} на {row['amount']:,} ₽",
            "requisites": requisites_text,
            "isPaid": is_paid,
            "amount": row['amount']
        })
    finally:
        conn.close()


# Клиент нажал "Я оплатил"
@bills_bp.route('/api/invoices/<int:invoice_id>/mark-paid', methods=['POST'])
def mark_invoice_paid(invoice_id):
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    user_id = session['user_id']
    conn = get_conn()
    try:
        # Сначала проверка на повтор
        current = conn.execute(
            "SELECT user_marked_paid FROM invoices WHERE id = ? AND user_id = ?",
            (invoice_id, user_id)
        ).fetchone()

        if current and current['user_marked_paid']:
            return jsonify({"error": "Счёт уже помечен как оплаченный"}), 400

        # Затем проверка существования
        exists = conn.execute(
            "SELECT 1 FROM invoices WHERE id = ? AND user_id = ?",
            (invoice_id, user_id)
        ).fetchone()

        if not exists:
            return jsonify({"error": "Счёт не найден"}), 404

        conn.execute('''
            UPDATE invoices 
            SET user_marked_paid = 1 
            WHERE id = ?
        ''', (invoice_id,))
        conn.commit()

        logger.info(f"Пользователь {user_id} пометил счёт {invoice_id} как оплаченный")
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Ошибка mark-paid: {e}")
        return jsonify({"error": "Ошибка сервера"}), 500
    finally:
        conn.close()

# Поиск пользователей по телефону (для автокомплита)
@bills_bp.route('/api/admin_search_users')
def admin_search_users():
    if not session.get('is_admin'):
        return jsonify([])

    phone = request.args.get('phone', '')
    if len(phone) < 3:
        return jsonify([])

    conn = get_conn()
    try:
        rows = conn.execute("""\
        SELECT id, phone FROM users 
        WHERE phone LIKE ? 
        ORDER BY phone LIMIT 10
        """, (f'%{phone}%',)).fetchall()

        return jsonify([{'id': r['id'], 'phone': r['phone']} for r in rows])
    finally:
        conn.close()


# Парсинг загруженного файла (txt или pdf)
@bills_bp.route('/api/admin_parse_requisites', methods=['POST'])
def admin_parse_requisites():
    if not session.get('is_admin'):
        return jsonify({"error": "Forbidden"}), 403

    file = request.files.get('file')
    if not file or file.filename == '':
        return jsonify({"error": "Файл не выбран"}), 400

    text = ""
    filename = file.filename.lower()

    try:
        if filename.endswith('.txt'):
            # Читаем из потока, а не через file.read()
            raw_data = file.stream.read()
            text = raw_data.decode('utf-8', errors='replace')  # replace — чтобы не терять символы

        elif filename.endswith('.pdf'):
            file.stream.seek(0)  # на всякий случай возвращаем поток в начало
            reader = PdfReader(file.stream)
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"

        else:
            return jsonify({"error": "Поддерживаются только .txt и .pdf"}), 400

    except Exception as e:
        logger.error(f"Ошибка парсинга файла {filename}: {e}")
        return jsonify({"error": f"Ошибка чтения файла: {str(e)}"}), 500

    return jsonify({"text": text.strip()})

# Создание счёта админом
@bills_bp.route('/api/admin_create_invoice', methods=['POST'])
def admin_create_invoice():
    if not session.get('is_admin'):
        return jsonify({"error": "Forbidden"}), 403



    data = request.get_json()
    user_id = data.get('user_id')
    number = data.get('invoice_number')
    amount_cents = data.get('amount')
    requisites = data.get('requisites')

    if not all([user_id, number, amount_cents, requisites]):
        return jsonify({"error": "Недостаточно данных"}), 400

    conn = get_conn()
    try:
        user_exists = conn.execute("SELECT 1 FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user_exists:
            return jsonify({"error": "Пользователь не найден"}), 400
    
        exists = conn.execute("SELECT 1 FROM invoices WHERE invoice_number = ?", (number,)).fetchone()
        if exists:
            return jsonify({"error": "Счёт с таким номером уже существует"}), 400

        conn.execute('''
            INSERT INTO invoices 
            (user_id, invoice_number, amount, created_at, requisites, user_marked_paid, admin_confirmed)
            VALUES (?, ?, ?, DATE('now'), ?, 0, 0)
        ''', (user_id, number, amount_cents, requisites))
        conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Ошибка создания счёта: {e}")
        return jsonify({"error": "Ошибка БД"}), 500
    finally:
        conn.close()


# Все счета (для админа)
@bills_bp.route('/api/admin_all_invoices')
def admin_all_invoices():
    if not session.get('is_admin'):
        return jsonify([])

    conn = get_conn()
    try:
        rows = conn.execute('''
            SELECT i.*, u.phone 
            FROM invoices i
            JOIN users u ON i.user_id = u.id
            ORDER BY i.created_at DESC
        ''').fetchall()

        return jsonify([{
            "id": r['id'],
            "invoice_number": r['invoice_number'],
            "amount": r['amount'],
            "created_at": r['created_at'],
            "user_marked_paid": bool(r['user_marked_paid']),
            "admin_confirmed": bool(r['admin_confirmed']),
            "phone": r['phone']
        } for r in rows])
    finally:
        conn.close()


# Подтверждение оплаты админом
@bills_bp.route('/api/admin_confirm_invoice/<int:invoice_id>', methods=['POST'])
def admin_confirm_invoice(invoice_id):
    if not session.get('is_admin'):
        return jsonify({"error": "Forbidden"}), 403



    conn = get_conn()
    try:
        conn.execute('''
            UPDATE invoices 
            SET admin_confirmed = 1, paid_at = DATE('now')
            WHERE id = ?
        ''', (invoice_id,))
        conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Ошибка подтверждения оплаты: {e}")
        return jsonify({"error": "Ошибка сервера"}), 500
    finally:
        conn.close()


# Удаление счёта админом
@bills_bp.route('/api/admin_delete_invoice/<int:invoice_id>', methods=['DELETE'])
def admin_delete_invoice(invoice_id):
    if not session.get('is_admin'):
        return jsonify({"error": "Forbidden"}), 403



    conn = get_conn()
    try:
        exists = conn.execute("SELECT 1 FROM invoices WHERE id = ?", (invoice_id,)).fetchone()
        if not exists:
            return jsonify({"error": "Счёт не найден"}), 404

        conn.execute("DELETE FROM invoices WHERE id = ?", (invoice_id,))
        conn.commit()

        logger.info(f"Админ удалил счёт ID={invoice_id}")
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Ошибка удаления счёта {invoice_id}: {e}")
        return jsonify({"error": "Ошибка сервера"}), 500
    finally:
        conn.close()


@bills_bp.route('/api/admin_verify_password', methods=['POST'])
def admin_verify_password():
    if not session.get('is_admin'):
        return jsonify({"success": False, "error": "Forbidden"}), 403

    data = request.get_json()
    password = data.get('password')

    if password == 'admin123':  # ВНИМАНИЕ: в реальном проекте используй хэш!
        return jsonify({"success": True})
    else:
        return jsonify({"success": False, "error": "Неверный пароль"}), 401