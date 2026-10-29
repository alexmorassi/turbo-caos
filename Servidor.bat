@echo off
rem Desenvolvimento: servidor local + index.html (ES modules). Para jogar, use o Jogar.bat
cd /d "%~dp0"
start "" http://localhost:8125
where python >nul 2>nul
if %errorlevel%==0 (python server.py 8125) else (py server.py 8125)
pause
