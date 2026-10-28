@echo off
setlocal
title NOT A TRAP // COMMUNITY VAULT
cd /d "%~dp0"

where python >nul 2>nul
if %errorlevel%==0 (
  echo [OK] Python bulundu.
  echo [WEB] http://127.0.0.1:8765
  start "" "http://127.0.0.1:8765"
  python server.py
  goto :end
)

where py >nul 2>nul
if %errorlevel%==0 (
  echo [OK] Python launcher bulundu.
  echo [WEB] http://127.0.0.1:8765
  start "" "http://127.0.0.1:8765"
  py server.py
  goto :end
)

echo [HATA] Python 3 bulunamadi. https://python.org adresinden Python 3.11+ kurun.
pause

:end
endlocal
