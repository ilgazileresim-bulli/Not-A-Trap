from __future__ import annotations

import hashlib
import html
import json
import mimetypes
import os
import queue
import re
import secrets
import shutil
import sqlite3
import threading
import time
import traceback
import urllib.parse
from dataclasses import dataclass
from email import policy
from email.parser import BytesParser
from http.cookies import SimpleCookie
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from security import ScanReport, scan_package, validate_manifest_bytes


ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / "public"
DATA = ROOT / "data"
QUARANTINE = ROOT / "uploads" / "quarantine"
APPROVED = ROOT / "uploads" / "approved"
REJECTED = ROOT / "uploads" / "rejected"
DB_PATH = DATA / "community.db"

HOST = os.environ.get("NAT_TRAP_HOST", "127.0.0.1")
PORT = int(os.environ.get("NAT_TRAP_PORT", "8765"))
APPROVAL_DELAY = int(os.environ.get("NAT_TRAP_APPROVAL_DELAY_SECONDS", "86400"))
MAX_UPLOAD = int(os.environ.get("NAT_TRAP_MAX_UPLOAD_BYTES", str(32 * 1024 * 1024)))
ADMIN_KEY = os.environ.get("NAT_TRAP_ADMIN_KEY", "")
PASSWORD_ROUNDS = 4096
SESSION_TTL = 7 * 24 * 60 * 60
GODOT_USER_ROOT = Path(os.environ.get("APPDATA", str(Path.home()))) / "Godot" / "app_userdata" / "NOT A TRAP"
ACCOUNT_PATH = GODOT_USER_ROOT / "not_a_trap_accounts.json"

SCAN_QUEUE: queue.Queue[str] = queue.Queue()
STOP = threading.Event()
RATE_LOCK = threading.Lock()
UPLOAD_EVENTS: dict[str, list[float]] = {}
ACCOUNT_LOCK = threading.RLock()
SESSION_LOCK = threading.RLock()
SESSIONS: dict[str, dict[str, Any]] = {}


@dataclass
class Part:
    name: str
    value: bytes
    filename: str = ""
    content_type: str = "application/octet-stream"


def now() -> int:
    return int(time.time())


def normalize_username(value: str) -> str:
    username = value.strip()
    if not re.fullmatch(r"[A-Za-z0-9_.-]{3,24}", username):
        raise ValueError("Kullanıcı adı 3-24 karakter olmalı; harf, rakam, nokta, tire ve alt çizgi kullanılabilir.")
    return username.casefold()


def validate_password(value: str) -> None:
    if len(value) < 6 or len(value) > 72:
        raise ValueError("Şifre 6-72 karakter arasında olmalı.")
    if value.isspace():
        raise ValueError("Şifre yalnızca boşluklardan oluşamaz.")


def password_digest(password: str, salt: str) -> str:
    value = hashlib.sha256(f"{salt}:{password}".encode("utf-8")).hexdigest()
    for _ in range(PASSWORD_ROUNDS):
        value = hashlib.sha256(f"{value}:{salt}".encode("utf-8")).hexdigest()
    return value


def blank_account_store() -> dict[str, Any]:
    return {"version": 1, "last_user": "", "accounts": {}}


def load_account_store() -> dict[str, Any]:
    with ACCOUNT_LOCK:
        if not ACCOUNT_PATH.is_file():
            return blank_account_store()
        try:
            payload = json.loads(ACCOUNT_PATH.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return blank_account_store()
        if not isinstance(payload, dict) or not isinstance(payload.get("accounts"), dict):
            return blank_account_store()
        payload.setdefault("version", 1)
        payload.setdefault("last_user", "")
        return payload


def save_account_store(payload: dict[str, Any]) -> None:
    with ACCOUNT_LOCK:
        ACCOUNT_PATH.parent.mkdir(parents=True, exist_ok=True)
        temporary = ACCOUNT_PATH.with_suffix(".tmp")
        temporary.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        os.replace(temporary, ACCOUNT_PATH)


def public_player(account: dict[str, Any]) -> dict[str, Any]:
    stats = account.get("stats") if isinstance(account.get("stats"), dict) else {}
    highest = max(0, min(219, int(stats.get("highest_unlocked", 0))))
    completed = max(1, min(220, int(stats.get("completed_levels", highest + 1))))
    deaths = max(0, int(stats.get("deaths", 0)))
    attempts = max(0, int(stats.get("attempts", 0)))
    progress = round(completed / 220 * 100, 1)
    achievements = ["İLK HATA"]
    if highest >= 5:
        achievements.append("İLK PERDE")
    if highest >= 49:
        achievements.append("CREATE AÇILDI")
    if highest >= 119:
        achievements.append("KAOS USTASI")
    if highest >= 219:
        achievements.append("HİÇBİR ŞEYE GÜVENMEDİ")
    if deaths >= 100:
        achievements.append("100 KERE YİNE")
    return {
        "username": str(account.get("username", "OYUNCU")),
        "created_at": int(account.get("created_at", 0)),
        "stats": {
            "stage": max(0, int(stats.get("stage", highest))) + 1,
            "highest_unlocked": highest + 1,
            "completed_levels": completed,
            "progress": progress,
            "deaths": deaths,
            "attempts": attempts,
            "cheat_unlocked": bool(stats.get("cheat_unlocked", False)),
            "last_played": int(stats.get("last_played", 0)),
        },
        "achievements": achievements,
    }


def connect() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH, timeout=15)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("PRAGMA foreign_keys=ON")
    return connection


def init_storage() -> None:
    for folder in (DATA, QUARANTINE, APPROVED, REJECTED):
        folder.mkdir(parents=True, exist_ok=True)
    with connect() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS mods (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                public_id TEXT NOT NULL UNIQUE,
                slug TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                version TEXT NOT NULL,
                author TEXT NOT NULL,
                summary TEXT NOT NULL,
                description TEXT NOT NULL,
                category TEXT NOT NULL,
                game_version TEXT NOT NULL,
                license TEXT NOT NULL,
                tags_json TEXT NOT NULL,
                original_filename TEXT NOT NULL,
                stored_filename TEXT NOT NULL,
                sha256 TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                status TEXT NOT NULL,
                scan_state TEXT NOT NULL,
                scan_summary TEXT NOT NULL,
                scan_details_json TEXT NOT NULL,
                submitted_at INTEGER NOT NULL,
                publish_at INTEGER NOT NULL,
                approved_at INTEGER,
                downloads INTEGER NOT NULL DEFAULT 0,
                featured INTEGER NOT NULL DEFAULT 0,
                official INTEGER NOT NULL DEFAULT 0,
                banner TEXT NOT NULL DEFAULT '',
                owner_token_hash TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_mods_status ON mods(status, approved_at DESC);
            CREATE INDEX IF NOT EXISTS idx_mods_category ON mods(category, status);
            CREATE TABLE IF NOT EXISTS reviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mod_id INTEGER NOT NULL REFERENCES mods(id) ON DELETE CASCADE,
                nickname TEXT NOT NULL,
                rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
                body TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mod_id INTEGER NOT NULL REFERENCES mods(id) ON DELETE CASCADE,
                reason TEXT NOT NULL,
                detail TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'open'
            );
            """
        )
    seed_official_mods()


def slugify(value: str) -> str:
    replacements = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")
    value = value.translate(replacements).lower()
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value[:55] or "isimsiz-mod"


def unique_slug(db: sqlite3.Connection, wanted: str) -> str:
    base = slugify(wanted)
    candidate = base
    suffix = 2
    while db.execute("SELECT 1 FROM mods WHERE slug=?", (candidate,)).fetchone():
        candidate = f"{base[:50]}-{suffix}"
        suffix += 1
    return candidate


def seed_official_mods() -> None:
    with connect() as db:
        if db.execute("SELECT COUNT(*) FROM mods").fetchone()[0]:
            return
        seed_data = [
            {
                "id": "ay-laboratuvari", "name": "Ay Laboratuvarı", "version": "1.4.0",
                "author": "NOT A TRAP STUDIO", "description": "Düşük yerçekimi, daha yüksek zıplama, hava zıplaması ve görünür çıkış rotasıyla erişilebilir bir deney.",
                "category": "ACCESSIBILITY", "tags": ["physics", "accessible", "official"],
                "rules": {"gravity": 0.55, "jump_power": 1.3, "hazard_speed": 0.75, "air_jump": True, "show_route": True},
                "banner": "/assets/hud-preview.png", "featured": 1,
            },
            {
                "id": "ters-dunya", "name": "Ters Dünya", "version": "1.1.0",
                "author": "NOT A TRAP LAB", "description": "Yerçekimi tavana döner. Bildiğin bütün güvenli rotalar bir anda yalan olur.",
                "category": "CHALLENGE", "tags": ["gravity", "hard", "official"],
                "rules": {"reverse_gravity": True, "player_speed": 1.05, "show_velocity": True},
                "banner": "/assets/level-220.png", "featured": 1,
            },
            {
                "id": "hata-ayiklayici", "name": "Hata Ayıklayıcı", "version": "2.0.0",
                "author": "NOT A TRAP STUDIO", "description": "Gizli tetikleri, hitbox'ları, hız vektörünü ve çıkış rotasını görünür kılan yapımcı paketi.",
                "category": "DEBUG", "tags": ["creator", "debug", "official"],
                "rules": {"show_hitboxes": True, "show_triggers": True, "show_route": True, "show_velocity": True},
                "banner": "/assets/create-studio.png", "featured": 0,
            },
        ]
        timestamp = now() - 86400 * 12
        for index, item in enumerate(seed_data):
            manifest = {
                "schema_version": 1,
                "id": item["id"], "name": item["name"], "version": item["version"],
                "author": item["author"], "description": item["description"],
                "category": item["category"], "license": "CC0-1.0",
                "game_version": "2.3+", "tool_version": "5.1.0",
                "priority": 0, "target_levels": "all", "rules": item["rules"],
            }
            payload = json.dumps(manifest, ensure_ascii=False, indent=2).encode("utf-8")
            filename = f"{item['id']}.natmod"
            (APPROVED / filename).write_bytes(payload)
            digest = hashlib.sha256(payload).hexdigest()
            db.execute(
                """INSERT INTO mods
                (public_id,slug,name,version,author,summary,description,category,game_version,license,tags_json,
                 original_filename,stored_filename,sha256,file_size,status,scan_state,scan_summary,scan_details_json,
                 submitted_at,publish_at,approved_at,downloads,featured,official,banner,owner_token_hash)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    f"official-{index + 1}", item["id"], item["name"], item["version"], item["author"],
                    item["description"], item["description"], item["category"], "2.3+", "CC0-1.0",
                    json.dumps(item["tags"], ensure_ascii=False), filename, filename, digest, len(payload),
                    "approved", "clean", "Resmî paket; tüm kontroller geçti.", "[]", timestamp, timestamp,
                    timestamp, (index + 1) * 41, item["featured"], 1, item["banner"], "official",
                ),
            )


def public_mod(row: sqlite3.Row, include_details: bool = False) -> dict[str, Any]:
    data = {
        "slug": row["slug"], "name": row["name"], "version": row["version"], "author": row["author"],
        "summary": row["summary"], "category": row["category"], "game_version": row["game_version"],
        "license": row["license"], "tags": json.loads(row["tags_json"]), "downloads": row["downloads"],
        "featured": bool(row["featured"]), "official": bool(row["official"]), "banner": row["banner"],
        "approved_at": row["approved_at"], "file_size": row["file_size"], "sha256": row["sha256"],
        "download_url": f"/api/download/{row['slug']}",
    }
    if include_details:
        data["description"] = row["description"]
        data["scan_summary"] = row["scan_summary"]
        data["scan_layers"] = json.loads(row["scan_details_json"] or "[]")
    return data


def promote_due_mods() -> int:
    timestamp = now()
    promoted: list[sqlite3.Row] = []
    with connect() as db:
        promoted = db.execute(
            "SELECT * FROM mods WHERE status='quarantine' AND scan_state='clean' AND publish_at<=?", (timestamp,)
        ).fetchall()
        for row in promoted:
            source = QUARANTINE / row["stored_filename"]
            destination = APPROVED / row["stored_filename"]
            if source.exists():
                shutil.move(str(source), str(destination))
            db.execute("UPDATE mods SET status='approved', approved_at=? WHERE id=?", (timestamp, row["id"]))
    return len(promoted)


def scan_worker() -> None:
    while not STOP.is_set():
        try:
            public_id = SCAN_QUEUE.get(timeout=2)
        except queue.Empty:
            promote_due_mods()
            continue
        try:
            with connect() as db:
                row = db.execute("SELECT * FROM mods WHERE public_id=?", (public_id,)).fetchone()
            if not row or row["status"] != "scanning":
                continue
            path = QUARANTINE / row["stored_filename"]
            report = scan_package(path, row["original_filename"])
            target_status = "quarantine" if report.verdict == "clean" else ("review" if report.verdict == "manual_review" else "rejected")
            with connect() as db:
                db.execute(
                    "UPDATE mods SET status=?, scan_state=?, scan_summary=?, scan_details_json=?, sha256=? WHERE id=?",
                    (target_status, report.verdict, report.summary, json.dumps(report.layers, ensure_ascii=False), report.sha256, row["id"]),
                )
            if target_status == "rejected" and path.exists():
                shutil.move(str(path), str(REJECTED / row["stored_filename"]))
            promote_due_mods()
        except Exception:
            traceback.print_exc()
            with connect() as db:
                db.execute(
                    "UPDATE mods SET status='review', scan_state='error', scan_summary=? WHERE public_id=?",
                    ("Tarama işçisi hata verdi; insan incelemesi gerekiyor.", public_id),
                )
        finally:
            SCAN_QUEUE.task_done()


def moderator_worker() -> None:
    while not STOP.is_set():
        try:
            promote_due_mods()
            with connect() as db:
                next_due = db.execute(
                    "SELECT MIN(publish_at) FROM mods WHERE status='quarantine' AND scan_state='clean'"
                ).fetchone()[0]
            wait_seconds = 10.0 if next_due is None else max(0.2, min(10.0, float(next_due) - time.time()))
        except Exception:
            traceback.print_exc()
            wait_seconds = 10.0
        STOP.wait(wait_seconds)


def parse_multipart(handler: BaseHTTPRequestHandler) -> dict[str, Part]:
    content_type = handler.headers.get("Content-Type", "")
    if not content_type.lower().startswith("multipart/form-data"):
        raise ValueError("multipart/form-data gerekli.")
    message = BytesParser(policy=policy.default).parsebytes(f"Content-Type: {content_type}\r\n\r\n".encode("ascii", "ignore"))
    boundary = message.get_boundary()
    if not boundary:
        raise ValueError("Multipart boundary eksik.")
    length = int(handler.headers.get("Content-Length", "0"))
    if length <= 0 or length > MAX_UPLOAD + 1024 * 1024:
        raise ValueError("Yükleme boyutu sınır dışında.")
    body = handler.rfile.read(length)
    delimiter = b"--" + boundary.encode("ascii")
    output: dict[str, Part] = {}
    for raw in body.split(delimiter)[1:-1]:
        if raw.startswith(b"\r\n"):
            raw = raw[2:]
        if raw.endswith(b"\r\n"):
            raw = raw[:-2]
        if not raw or b"\r\n\r\n" not in raw:
            continue
        header_blob, payload = raw.split(b"\r\n\r\n", 1)
        headers = BytesParser(policy=policy.default).parsebytes(header_blob + b"\r\n\r\n")
        name = headers.get_param("name", header="content-disposition") or ""
        filename = headers.get_filename() or ""
        if name:
            output[name] = Part(name, payload, filename, headers.get_content_type())
    return output


def clean_text(part: Part | None, maximum: int, required: bool = True) -> str:
    value = (part.value.decode("utf-8", "replace") if part else "").strip()
    value = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", value)
    if required and not value:
        raise ValueError("Zorunlu alan boş.")
    return value[:maximum]


def upload_allowed(ip: str) -> bool:
    timestamp = time.time()
    with RATE_LOCK:
        recent = [event for event in UPLOAD_EVENTS.get(ip, []) if timestamp - event < 3600]
        if len(recent) >= 6:
            return False
        recent.append(timestamp)
        UPLOAD_EVENTS[ip] = recent
    return True


class Handler(BaseHTTPRequestHandler):
    server_version = "NOT-A-TRAP-HUB/1.0"

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"[{self.log_date_time_string()}] {self.client_address[0]} {fmt % args}")

    def end_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
        )
        super().end_headers()

    def json_response(self, payload: Any, status: int = 200, headers: dict[str, str] | None = None) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        for name, value in (headers or {}).items():
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(raw)

    def read_json(self, limit: int = 64 * 1024) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > limit:
            raise ValueError("İstek boyutu geçersiz.")
        value = json.loads(self.rfile.read(length).decode("utf-8"))
        if not isinstance(value, dict):
            raise ValueError("JSON nesnesi gerekli.")
        return value

    def session(self) -> dict[str, Any] | None:
        cookie = SimpleCookie(self.headers.get("Cookie", ""))
        token = cookie.get("nat_session")
        if token is None:
            return None
        with SESSION_LOCK:
            record = SESSIONS.get(token.value)
            if not record:
                return None
            if now() - int(record.get("created_at", 0)) > SESSION_TTL:
                SESSIONS.pop(token.value, None)
                return None
            record["last_seen"] = now()
            return dict(record)

    def require_session(self) -> dict[str, Any] | None:
        record = self.session()
        if record is None:
            self.json_response({"error": "Bu işlem için giriş yapmalısınız."}, 401)
        return record

    def create_session(self, username_key: str) -> tuple[str, dict[str, Any]]:
        token = secrets.token_urlsafe(32)
        record = {"username_key": username_key, "created_at": now(), "last_seen": now()}
        with SESSION_LOCK:
            SESSIONS[token] = record
        return token, record

    def auth_status(self) -> None:
        session = self.session()
        if session is None:
            return self.json_response({"authenticated": False})
        store = load_account_store()
        account = store["accounts"].get(session["username_key"])
        if not isinstance(account, dict):
            return self.json_response({"authenticated": False})
        self.json_response({"authenticated": True, "player": public_player(account)})

    def player_stats(self) -> None:
        session = self.require_session()
        if session is None:
            return
        store = load_account_store()
        account = store["accounts"].get(session["username_key"])
        if not isinstance(account, dict):
            return self.json_response({"error": "Oyuncu profili bulunamadı."}, 404)
        self.json_response(public_player(account))

    def register_player(self) -> None:
        payload = self.read_json(16 * 1024)
        username = str(payload.get("username", "")).strip()
        password = str(payload.get("password", ""))
        key = normalize_username(username)
        validate_password(password)
        store = load_account_store()
        if key in store["accounts"]:
            return self.json_response({"error": "Bu kullanıcı adı zaten kayıtlı."}, 409)
        salt = secrets.token_hex(16)
        store["accounts"][key] = {
            "username": username,
            "salt": salt,
            "password_hash": password_digest(password, salt),
            "created_at": now(),
            "stats": {"stage": 0, "highest_unlocked": 0, "completed_levels": 1, "deaths": 0, "attempts": 0, "cheat_unlocked": False, "last_played": 0},
        }
        store["last_user"] = key
        save_account_store(store)
        token, _ = self.create_session(key)
        headers = {"Set-Cookie": f"nat_session={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={SESSION_TTL}"}
        self.json_response({"ok": True, "player": public_player(store["accounts"][key])}, 201, headers)

    def login_player(self) -> None:
        payload = self.read_json(16 * 1024)
        username = str(payload.get("username", "")).strip()
        password = str(payload.get("password", ""))
        key = normalize_username(username)
        validate_password(password)
        store = load_account_store()
        account = store["accounts"].get(key)
        if not isinstance(account, dict):
            return self.json_response({"error": "Kullanıcı adı veya şifre yanlış."}, 401)
        expected = str(account.get("password_hash", ""))
        actual = password_digest(password, str(account.get("salt", "")))
        if not secrets.compare_digest(expected, actual):
            return self.json_response({"error": "Kullanıcı adı veya şifre yanlış."}, 401)
        store["last_user"] = key
        save_account_store(store)
        token, _ = self.create_session(key)
        headers = {"Set-Cookie": f"nat_session={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={SESSION_TTL}"}
        self.json_response({"ok": True, "player": public_player(account)}, headers=headers)

    def logout_player(self) -> None:
        cookie = SimpleCookie(self.headers.get("Cookie", ""))
        token = cookie.get("nat_session")
        if token is not None:
            with SESSION_LOCK:
                SESSIONS.pop(token.value, None)
        self.json_response({"ok": True}, headers={"Set-Cookie": "nat_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"})

    def validate_builder_manifest(self) -> None:
        if self.require_session() is None:
            return
        payload = self.read_json(256 * 1024)
        manifest = payload.get("manifest")
        if not isinstance(manifest, dict):
            raise ValueError("manifest alanı bir JSON nesnesi olmalı.")
        normalized, warnings = validate_manifest_bytes(json.dumps(manifest, ensure_ascii=False).encode("utf-8"))
        self.json_response({"ok": True, "manifest": normalized, "warnings": warnings})

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if path == "/api/health":
            with connect() as db:
                counts = {row["status"]: row["count"] for row in db.execute("SELECT status, COUNT(*) count FROM mods GROUP BY status")}
            return self.json_response({"ok": True, "service": "NOT A TRAP HUB", "approval_delay_seconds": APPROVAL_DELAY, "counts": counts})
        if path == "/api/stats":
            with connect() as db:
                row = db.execute("SELECT COUNT(*) mods, COALESCE(SUM(downloads),0) downloads FROM mods WHERE status='approved'").fetchone()
                creators = db.execute("SELECT COUNT(DISTINCT author) FROM mods WHERE status='approved'").fetchone()[0]
            return self.json_response({"mods": row["mods"], "downloads": row["downloads"], "creators": creators, "quarantine_hours": 24})
        if path == "/api/auth/status":
            return self.auth_status()
        if path == "/api/player/stats":
            return self.player_stats()
        if path == "/api/mods":
            return self.get_mods(urllib.parse.parse_qs(parsed.query))
        if path.startswith("/api/mods/"):
            return self.get_mod(path.removeprefix("/api/mods/"))
        if path.startswith("/api/status/"):
            return self.get_status(path.removeprefix("/api/status/"), urllib.parse.parse_qs(parsed.query))
        if path.startswith("/api/download/"):
            return self.download(path.removeprefix("/api/download/"))
        if path == "/api/admin/queue":
            return self.admin_queue()
        self.serve_static(path)

    def do_POST(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        try:
            if path == "/api/auth/register":
                return self.register_player()
            if path == "/api/auth/login":
                return self.login_player()
            if path == "/api/auth/logout":
                return self.logout_player()
            if path == "/api/mod-builder/validate":
                return self.validate_builder_manifest()
            if path == "/api/upload":
                return self.upload()
            if path.startswith("/api/reviews/"):
                return self.add_review(path.removeprefix("/api/reviews/"))
            if path.startswith("/api/report/"):
                return self.add_report(path.removeprefix("/api/report/"))
            if path.startswith("/api/admin/decision/"):
                return self.admin_decision(path.removeprefix("/api/admin/decision/"))
            self.json_response({"error": "Yol bulunamadı."}, 404)
        except (ValueError, json.JSONDecodeError) as exc:
            self.json_response({"error": str(exc)}, 400)
        except Exception:
            traceback.print_exc()
            self.json_response({"error": "Sunucu isteği işlerken hata verdi."}, 500)

    def get_mods(self, query: dict[str, list[str]]) -> None:
        search = query.get("q", [""])[0].strip()[:80]
        category = query.get("category", [""])[0].strip()[:40]
        sort = query.get("sort", ["new"])[0]
        order = {"new": "approved_at DESC", "downloads": "downloads DESC", "name": "name COLLATE NOCASE"}.get(sort, "approved_at DESC")
        where = ["status='approved'"]
        params: list[Any] = []
        if search:
            where.append("(name LIKE ? OR author LIKE ? OR summary LIKE ? OR tags_json LIKE ?)")
            needle = f"%{search}%"
            params.extend([needle] * 4)
        if category:
            where.append("category=?")
            params.append(category)
        with connect() as db:
            rows = db.execute(f"SELECT * FROM mods WHERE {' AND '.join(where)} ORDER BY {order} LIMIT 100", params).fetchall()
        self.json_response({"items": [public_mod(row) for row in rows], "total": len(rows)})

    def get_mod(self, slug: str) -> None:
        with connect() as db:
            row = db.execute("SELECT * FROM mods WHERE slug=? AND status='approved'", (slug,)).fetchone()
            if not row:
                return self.json_response({"error": "Mod bulunamadı."}, 404)
            reviews = db.execute(
                "SELECT nickname,rating,body,created_at FROM reviews WHERE mod_id=? ORDER BY created_at DESC LIMIT 30", (row["id"],)
            ).fetchall()
            rating = db.execute("SELECT COALESCE(AVG(rating),0) avg, COUNT(*) count FROM reviews WHERE mod_id=?", (row["id"],)).fetchone()
        payload = public_mod(row, True)
        payload["rating"] = round(rating["avg"], 1)
        payload["review_count"] = rating["count"]
        payload["reviews"] = [dict(review) for review in reviews]
        self.json_response(payload)

    def get_status(self, public_id: str, query: dict[str, list[str]]) -> None:
        token = query.get("token", [""])[0]
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        promote_due_mods()
        with connect() as db:
            row = db.execute("SELECT * FROM mods WHERE public_id=?", (public_id,)).fetchone()
        if not row or not secrets.compare_digest(token_hash, row["owner_token_hash"]):
            return self.json_response({"error": "Takip kodu geçersiz."}, 404)
        remaining = max(0, row["publish_at"] - now())
        self.json_response({
            "ticket": row["public_id"], "name": row["name"], "status": row["status"], "scan_state": row["scan_state"],
            "summary": row["scan_summary"], "layers": json.loads(row["scan_details_json"] or "[]"),
            "submitted_at": row["submitted_at"], "publish_at": row["publish_at"], "remaining_seconds": remaining,
            "public_url": f"/#mod/{row['slug']}" if row["status"] == "approved" else "",
        })

    def upload(self) -> None:
        ip = self.client_address[0]
        if not upload_allowed(ip):
            return self.json_response({"error": "Saatlik yükleme sınırına ulaştınız."}, 429)
        parts = parse_multipart(self)
        file_part = parts.get("file")
        if not file_part or not file_part.filename:
            raise ValueError("Bir .natmod veya .zip dosyası seçin.")
        if len(file_part.value) > MAX_UPLOAD:
            raise ValueError("Dosya 32 MB sınırını aşıyor.")
        original = Path(file_part.filename).name
        suffix = Path(original).suffix.lower()
        if suffix not in {".natmod", ".zip"}:
            raise ValueError("Yalnızca .natmod veya .zip kabul edilir.")
        name = clean_text(parts.get("name"), 80)
        author = clean_text(parts.get("author"), 60)
        summary = clean_text(parts.get("summary"), 180)
        description = clean_text(parts.get("description"), 4000)
        category = clean_text(parts.get("category"), 40)
        if category not in {"GAMEPLAY", "ACCESSIBILITY", "CHALLENGE", "VISUAL", "DEBUG", "TOTAL CONVERSION"}:
            raise ValueError("Kategori geçersiz.")
        tags = [slugify(tag)[:24] for tag in clean_text(parts.get("tags"), 240, False).split(",") if tag.strip()][:8]
        public_id = secrets.token_urlsafe(12)
        owner_token = secrets.token_urlsafe(28)
        owner_hash = hashlib.sha256(owner_token.encode()).hexdigest()
        stored = public_id.replace("-", "_") + suffix
        destination = QUARANTINE / stored
        destination.write_bytes(file_part.value)
        digest = hashlib.sha256(file_part.value).hexdigest()
        timestamp = now()
        try:
            with connect() as db:
                slug = unique_slug(db, name)
                db.execute(
                    """INSERT INTO mods
                    (public_id,slug,name,version,author,summary,description,category,game_version,license,tags_json,
                     original_filename,stored_filename,sha256,file_size,status,scan_state,scan_summary,scan_details_json,
                     submitted_at,publish_at,downloads,featured,official,banner,owner_token_hash)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (
                        public_id, slug, name, clean_text(parts.get("version"), 32), author, summary, description, category,
                        clean_text(parts.get("game_version"), 32), clean_text(parts.get("license"), 64),
                        json.dumps(tags, ensure_ascii=False), original, stored, digest, len(file_part.value), "scanning", "queued",
                        "Tarama sırasına alındı.", "[]", timestamp, timestamp + APPROVAL_DELAY, 0, 0, 0,
                        "/assets/mod-default.svg", owner_hash,
                    ),
                )
        except Exception:
            destination.unlink(missing_ok=True)
            raise
        SCAN_QUEUE.put(public_id)
        self.json_response({
            "ok": True, "ticket": public_id, "token": owner_token, "status_url": f"/api/status/{public_id}?token={owner_token}",
            "publish_at": timestamp + APPROVAL_DELAY, "message": "Dosya karantinaya alındı. Temizse 24 saat dolunca otomatik yayımlanacak.",
        }, 202)

    def download(self, slug: str) -> None:
        promote_due_mods()
        with connect() as db:
            row = db.execute("SELECT * FROM mods WHERE slug=? AND status='approved'", (slug,)).fetchone()
            if not row:
                return self.json_response({"error": "Dosya henüz indirilebilir değil."}, 404)
            path = APPROVED / row["stored_filename"]
            if not path.is_file():
                return self.json_response({"error": "Paket depoda bulunamadı."}, 410)
            db.execute("UPDATE mods SET downloads=downloads+1 WHERE id=?", (row["id"],))
        filename = re.sub(r"[^A-Za-z0-9._-]", "_", row["original_filename"])
        self.send_response(200)
        self.send_header("Content-Type", "application/octet-stream")
        self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Content-Length", str(path.stat().st_size))
        self.send_header("X-Checksum-SHA256", row["sha256"])
        self.end_headers()
        with path.open("rb") as handle:
            shutil.copyfileobj(handle, self.wfile)

    def add_review(self, slug: str) -> None:
        payload = self.read_json()
        nickname = str(payload.get("nickname", "")).strip()[:40]
        body = str(payload.get("body", "")).strip()[:600]
        rating = int(payload.get("rating", 0))
        if not nickname or not body or rating not in range(1, 6):
            raise ValueError("Rumuz, 1-5 puan ve yorum gerekli.")
        with connect() as db:
            row = db.execute("SELECT id FROM mods WHERE slug=? AND status='approved'", (slug,)).fetchone()
            if not row:
                return self.json_response({"error": "Mod bulunamadı."}, 404)
            db.execute("INSERT INTO reviews(mod_id,nickname,rating,body,created_at) VALUES(?,?,?,?,?)", (row["id"], nickname, rating, body, now()))
        self.json_response({"ok": True}, 201)

    def add_report(self, slug: str) -> None:
        payload = self.read_json()
        reason = str(payload.get("reason", "")).strip()[:80]
        detail = str(payload.get("detail", "")).strip()[:1000]
        if not reason or not detail:
            raise ValueError("Rapor nedeni ve ayrıntı gerekli.")
        with connect() as db:
            row = db.execute("SELECT id FROM mods WHERE slug=? AND status='approved'", (slug,)).fetchone()
            if not row:
                return self.json_response({"error": "Mod bulunamadı."}, 404)
            db.execute("INSERT INTO reports(mod_id,reason,detail,created_at) VALUES(?,?,?,?)", (row["id"], reason, detail, now()))
        self.json_response({"ok": True}, 201)

    def admin_queue(self) -> None:
        if not ADMIN_KEY or not secrets.compare_digest(self.headers.get("X-Admin-Key", ""), ADMIN_KEY):
            return self.json_response({"error": "Yetkisiz."}, 401)
        with connect() as db:
            rows = db.execute("SELECT public_id,name,author,status,scan_state,scan_summary,submitted_at,publish_at FROM mods WHERE status IN ('review','quarantine','scanning') ORDER BY submitted_at").fetchall()
        self.json_response({"items": [dict(row) for row in rows]})

    def admin_decision(self, public_id: str) -> None:
        if not ADMIN_KEY or not secrets.compare_digest(self.headers.get("X-Admin-Key", ""), ADMIN_KEY):
            return self.json_response({"error": "Yetkisiz."}, 401)
        payload = self.read_json()
        decision = payload.get("decision")
        if decision not in {"clean", "reject"}:
            raise ValueError("decision clean veya reject olmalı.")
        with connect() as db:
            row = db.execute("SELECT * FROM mods WHERE public_id=?", (public_id,)).fetchone()
            if not row:
                return self.json_response({"error": "Kayıt bulunamadı."}, 404)
            if decision == "clean":
                db.execute("UPDATE mods SET status='quarantine',scan_state='clean',scan_summary=? WHERE id=?", ("İnsan moderatör temiz olarak onayladı; süre kilidi devam ediyor.", row["id"]))
            else:
                db.execute("UPDATE mods SET status='rejected',scan_state='rejected',scan_summary=? WHERE id=?", ("İnsan moderatör paketi reddetti.", row["id"]))
                source = QUARANTINE / row["stored_filename"]
                if source.exists():
                    shutil.move(str(source), str(REJECTED / row["stored_filename"]))
        promote_due_mods()
        self.json_response({"ok": True})

    def serve_static(self, requested: str) -> None:
        requested = urllib.parse.unquote(requested)
        if requested in {"", "/"} or requested.startswith("/mod/"):
            requested = "/index.html"
        candidate = (PUBLIC / requested.lstrip("/")).resolve()
        if PUBLIC.resolve() not in candidate.parents and candidate != PUBLIC.resolve():
            return self.json_response({"error": "Geçersiz yol."}, 400)
        if not candidate.is_file():
            candidate = PUBLIC / "index.html"
        content = candidate.read_bytes()
        mime = mimetypes.guess_type(candidate.name)[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", mime + ("; charset=utf-8" if mime.startswith("text/") or mime == "application/javascript" else ""))
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "public, max-age=3600" if "/assets/" in requested else "no-cache")
        self.end_headers()
        self.wfile.write(content)


def main() -> None:
    init_storage()
    promote_due_mods()
    threading.Thread(target=scan_worker, name="natmod-scan-worker", daemon=True).start()
    threading.Thread(target=moderator_worker, name="natmod-moderator", daemon=True).start()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print("=" * 70)
    print("NOT A TRAP // COMMUNITY VAULT")
    print(f"Yerel adres : http://{HOST}:{PORT}")
    print(f"Karantina  : {APPROVAL_DELAY} saniye (üretim varsayılanı 24 saat)")
    print("Durdurmak için CTRL+C")
    print("=" * 70)
    try:
        server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        pass
    finally:
        STOP.set()
        server.server_close()


if __name__ == "__main__":
    main()
