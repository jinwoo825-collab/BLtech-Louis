@echo off
chcp 65001>nul
title 비엘테크(주) 경영 대시보드
cd /d "%~dp0"
echo.
echo   비엘테크(주) 경영 대시보드를 시작합니다...
echo   (이 검은 창을 닫으면 프로그램이 종료됩니다)
echo.
where python >nul 2>nul
if %errorlevel%==0 (
  python server.py --open
) else (
  py server.py --open
)
echo.
echo   서버가 종료되었습니다. 이 창을 닫아도 됩니다.
pause
