# auth_backend.py — ЧИСТАЯ ФИНАЛЬНАЯ ВЕРСИЯ ДЛЯ MTS MARKETOLOG 2025
import sqlite3
import random
import time
import requests
from requests.auth import HTTPBasicAuth

# ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
# ТВОИ РАБОЧИЕ КЛЮЧИ (уже рабочие, не трогай!)
MTS_LOGIN = 'gw_3NoWBWRmfLel'
MTS_PASSWORD = 'KxDuht2v'
# →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

SENDER_NAME = 'MTSM_Test'           # Подтверждённое имя отправителя
CODE_EXPIRY_MINUTES = 5
DB_NAME = 'auth_codes.db'
MTS_API_URL = 'https://omnichannel.mts.ru/http-api/v1/messages'

# ===================== БАЗА ДАННЫХ =====================
def init_auth_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS verification_codes (
            phone TEXT PRIMARY KEY,
            code TEXT NOT NULL,
            expires_at REAL NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

def save_code(phone: str, code: str):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    expiry = time.time() + CODE_EXPIRY_MINUTES * 60
    cursor.execute("REPLACE INTO verification_codes (phone, code, expires_at) VALUES (?, ?, ?)",
                   (phone, code, expiry))
    conn.commit()
    conn.close()

def get_code(phone: str):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM verification_codes WHERE expires_at < ?", (time.time(),))
    conn.commit()
    cursor.execute("SELECT code FROM verification_codes WHERE phone = ?", (phone,))
    result = cursor.fetchone()
    conn.close()
    return result[0] if result else None

def delete_code(phone: str):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM verification_codes WHERE phone = ?", (phone,))
    conn.commit()
    conn.close()

# ===================== ОТПРАВКА SMS =====================
def generate_and_send_code(phone: str) -> tuple[bool, str]:
    code = f"{random.randint(1000, 9999):04d}"
    save_code(phone, code)

    api_number = phone.lstrip('+')

    payload = {
        "messages": [{
            "content": {"short_text": f"Ваш код: {code}. Действует {CODE_EXPIRY_MINUTES} мин."},
            "to": [{"msisdn": api_number}],
            "from": {"sms_address": SENDER_NAME},
            "ttl_sec": 300
        }]
    }

    headers = {'Content-Type': 'application/json; charset=utf-8'}
    auth = HTTPBasicAuth(MTS_LOGIN, MTS_PASSWORD)

    try:
        r = requests.post(MTS_API_URL, json=payload, auth=auth, headers=headers, timeout=15)
        if r.status_code == 200:
            print(f"SMS отправлено на {phone} → код {code}")
            return True, "Код отправлен"
        else:
            error = r.json().get('message', 'Unknown error')
            print(f"MTS ошибка {r.status_code}: {error}")
            return False, f"Ошибка MTS: {error}"
    except Exception as e:
        print(f"Исключение при отправке SMS: {e}")
        return False, "Не удалось отправить SMS"

# ===================== ПРОВЕРКА КОДА =====================
def verify_user_code(phone: str, submitted_code: str) -> tuple[bool, str]:
    stored_code = get_code(phone)
    if stored_code and stored_code == submitted_code.strip():
        delete_code(phone)
        return True, "Код подтвержден."
    if not stored_code:
        return False, "Код не найден или истек срок действия (5 мин.)."
    return False, "Неверный код."