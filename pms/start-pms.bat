@echo off
chcp 65001 >nul
cd /d "%~dp0"
REM Python 경로 (없으면 PATH의 python 사용)
set "PY=C:\Users\ludov\AppData\Local\Programs\Python\Python313\python.exe"
if not exist "%PY%" set "PY=python"
"%PY%" server.py
pause
