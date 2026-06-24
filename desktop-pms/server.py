#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
비엘테크(주) 경영 대시보드 - 로컬 서버
- 같은 폴더의 index.html 등 정적 파일을 제공합니다.
- GET  /api/data  : data.json 내용을 돌려줍니다.
- POST /api/data  : 받은 내용을 data.json 파일로 저장합니다(자동 백업 data.bak.json 생성).
데이터는 이 폴더의 data.json 에 '파일'로 저장되므로 브라우저 캐시를 지워도 사라지지 않습니다.
"""
import http.server
import socketserver
import json
import os
import sys
import shutil
import threading
import webbrowser

PORT = 8765
DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(DIR, "data.json")
BAK_FILE = os.path.join(DIR, "data.bak.json")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

    def _json(self, code, body_bytes):
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body_bytes)

    def do_GET(self):
        if self.path.split("?")[0] == "/api/data":
            if os.path.exists(DATA_FILE):
                with open(DATA_FILE, "rb") as f:
                    body = f.read()
            else:
                body = b"{}"
            self._json(200, body)
            return
        return super().do_GET()

    def do_POST(self):
        if self.path.split("?")[0] == "/api/data":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            try:
                json.loads(body.decode("utf-8"))  # 유효한 JSON인지 검증
                # 기존 파일을 백업한 뒤 안전하게(원자적으로) 저장
                if os.path.exists(DATA_FILE):
                    try:
                        shutil.copyfile(DATA_FILE, BAK_FILE)
                    except Exception:
                        pass
                tmp = DATA_FILE + ".tmp"
                with open(tmp, "wb") as f:
                    f.write(body)
                os.replace(tmp, DATA_FILE)
                self._json(200, b'{"ok":true}')
            except Exception:
                self._json(400, b'{"ok":false}')
            return
        self._json(404, b'{"ok":false}')

    def log_message(self, *args):
        pass  # 콘솔 조용히


def main():
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    try:
        httpd = socketserver.ThreadingTCPServer(("127.0.0.1", PORT), Handler)
    except OSError:
        # 이미 실행 중이면 브라우저만 연다
        if "--open" in sys.argv:
            webbrowser.open(f"http://localhost:{PORT}/")
        print("이미 실행 중입니다. 브라우저에서 http://localhost:%d/ 를 여세요." % PORT)
        return

    url = f"http://localhost:{PORT}/"
    print("=" * 52)
    print("  비엘테크(주) 경영 대시보드 실행 중")
    print("  주소:", url)
    print("  데이터 파일:", DATA_FILE)
    print("  이 창을 닫으면 프로그램이 종료됩니다.")
    print("=" * 52)
    if "--open" in sys.argv:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n종료합니다.")


if __name__ == "__main__":
    main()
