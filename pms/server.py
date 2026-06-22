"""
나의 업무 관리(PMS) 로컬 서버.

- pms 폴더의 정적 파일(index.html 등)을 제공하고,
- 데이터를 같은 폴더의 pms-data.json 파일에 읽고 씁니다.

실행:  python server.py            (브라우저 자동 실행)
       python server.py --no-browser   (브라우저 자동 실행 안 함)
"""
import http.server
import socketserver
import json
import os
import sys
import threading
import webbrowser

PORT = 7777
BASE = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE, "pms-data.json")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # 항상 pms 폴더를 기준으로 정적 파일 제공
        super().__init__(*args, directory=BASE, **kwargs)

    def do_GET(self):
        if self.path.split("?")[0] == "/api/data":
            self._send_data()
            return
        return super().do_GET()

    def do_POST(self):
        if self.path.split("?")[0] == "/api/data":
            self._save_data()
            return
        self.send_error(404)

    def _send_data(self):
        if os.path.exists(DATA_FILE):
            with open(DATA_FILE, "rb") as f:
                body = f.read()
        else:
            body = b"null"  # 저장된 데이터 없음
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _save_data(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        # JSON 형식이 맞을 때만 저장 (잘못된 데이터로 파일이 깨지는 것 방지)
        try:
            json.loads(body.decode("utf-8"))
        except Exception:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"ok":false}')
            return
        # 임시 파일에 쓴 뒤 교체 (저장 도중 중단되어도 기존 파일 보존)
        tmp = DATA_FILE + ".tmp"
        with open(tmp, "wb") as f:
            f.write(body)
        os.replace(tmp, DATA_FILE)
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"ok":true}')

    def log_message(self, *args):
        pass  # 콘솔 로그 끄기 (조용히)


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main():
    httpd = Server(("127.0.0.1", PORT), Handler)
    url = "http://localhost:%d/" % PORT
    print("=" * 48)
    print("  나의 업무 관리(PMS) 서버가 실행 중입니다.")
    print("  주소: " + url)
    print("  데이터 파일: " + DATA_FILE)
    print("")
    print("  ** 이 검은 창을 닫으면 종료됩니다. **")
    print("=" * 48)
    if "--no-browser" not in sys.argv:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n종료합니다.")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
