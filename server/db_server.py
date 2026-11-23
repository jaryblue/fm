#!/usr/bin/env python3
"""
再开一局 2026 - 服务端 SQLite 数据库与静态资源服务 (端口 8080)
提供 /api/saves/<key> 的读写删接口，替代纯前端 localStorage 存储。
"""

import json
import os
import sqlite3
import threading
import time
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB_ROOT = os.path.join(BASE_DIR, "apps", "steam")
DB_PATH = os.path.join(BASE_DIR, "server", "zaikaiyiju.db")
PORT = int(os.environ.get("PORT", "8080"))

DB_LOCK = threading.Lock()


def init_db() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS saves (
                save_key TEXT PRIMARY KEY,
                payload TEXT NOT NULL,
                season_number INTEGER DEFAULT 1,
                current_round INTEGER DEFAULT 1,
                current_tier INTEGER DEFAULT 7,
                club_name TEXT DEFAULT '',
                updated_at INTEGER NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS season_archive (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                save_key TEXT NOT NULL,
                season_number INTEGER NOT NULL,
                club_name TEXT NOT NULL,
                tier INTEGER NOT NULL,
                final_rank INTEGER NOT NULL,
                points INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            )
            """
        )
        conn.commit()


def extract_meta(payload_str: str):
    try:
        obj = json.loads(payload_str)
        season = int(obj.get("seasonNumber", 1))
        rnd = int(obj.get("currentRound", 1))
        tier = int(obj.get("currentTier", 7))
        uid = obj.get("userClubId", "")
        clubs = obj.get("clubs", [])
        cname = ""
        for c in clubs:
            if c.get("id") == uid or c.get("isUser"):
                cname = str(c.get("name", ""))
                break
        return season, rnd, tier, cname
    except Exception:
        return 1, 1, 7, ""


class GameRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _send_json(self, status: int, data: dict) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            self._send_json(HTTPStatus.OK, {"ok": True, "db": "sqlite", "path": DB_PATH})
            return

        if parsed.path.startswith("/api/saves/"):
            key = unquote(parsed.path[len("/api/saves/"):]).strip("/")
            if not key:
                self._send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "missing save key"})
                return
            with DB_LOCK, sqlite3.connect(DB_PATH) as conn:
                row = conn.execute(
                    "SELECT payload, season_number, current_round, current_tier, club_name, updated_at FROM saves WHERE save_key = ?",
                    (key,),
                ).fetchone()
            if not row:
                # 首次使用某个口令时没有存档属于正常状态。
                # 返回 200 + 空 data，避免浏览器把正常的“空档”记录成资源加载错误。
                self._send_json(
                    HTTPStatus.OK,
                    {
                        "ok": True,
                        "key": key,
                        "data": "",
                        "meta": {
                            "seasonNumber": 1,
                            "currentRound": 1,
                            "currentTier": 7,
                            "clubName": "",
                        },
                        "updatedAt": 0,
                    },
                )
                return
            self._send_json(
                HTTPStatus.OK,
                {
                    "ok": True,
                    "key": key,
                    "data": row[0],
                    "meta": {
                        "seasonNumber": row[1],
                        "currentRound": row[2],
                        "currentTier": row[3],
                        "clubName": row[4],
                    },
                    "updatedAt": row[5],
                },
            )
            return

        super().do_GET()

    def do_PUT(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/saves/"):
            self._send_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "unknown endpoint"})
            return
        key = unquote(parsed.path[len("/api/saves/"):]).strip("/")
        if not key:
            self._send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "missing save key"})
            return
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8")
        try:
            body = json.loads(raw)
            payload_str = body["data"] if isinstance(body, dict) and "data" in body else raw
            if not isinstance(payload_str, str):
                payload_str = json.dumps(payload_str, ensure_ascii=False)
        except Exception:
            self._send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "invalid json"})
            return

        now = int(time.time())
        season, rnd, tier, cname = extract_meta(payload_str)
        with DB_LOCK, sqlite3.connect(DB_PATH) as conn:
            conn.execute(
                """
                INSERT INTO saves (save_key, payload, season_number, current_round, current_tier, club_name, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(save_key) DO UPDATE SET
                    payload = excluded.payload,
                    season_number = excluded.season_number,
                    current_round = excluded.current_round,
                    current_tier = excluded.current_tier,
                    club_name = excluded.club_name,
                    updated_at = excluded.updated_at
                """,
                (key, payload_str, season, rnd, tier, cname, now),
            )
            conn.commit()
        self._send_json(HTTPStatus.OK, {"ok": True, "key": key, "updatedAt": now})

    def do_DELETE(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/saves/"):
            self._send_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "unknown endpoint"})
            return
        key = unquote(parsed.path[len("/api/saves/"):]).strip("/")
        with DB_LOCK, sqlite3.connect(DB_PATH) as conn:
            conn.execute("DELETE FROM saves WHERE save_key = ?", (key,))
            conn.commit()
        self._send_json(HTTPStatus.OK, {"ok": True, "key": key})


if __name__ == "__main__":
    init_db()
    server = ThreadingHTTPServer(("0.0.0.0", PORT), GameRequestHandler)
    print(f"[DB Server] SQLite: {DB_PATH}")
    print(f"[DB Server] Serving {WEB_ROOT} on http://localhost:{PORT}")
    server.serve_forever()
