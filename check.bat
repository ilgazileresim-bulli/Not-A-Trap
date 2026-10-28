@echo off
setlocal
cd /d "%~dp0"
python -m compileall -q server.py security.py
if errorlevel 1 goto :fail
python -m unittest discover -s tests -v
if errorlevel 1 goto :fail
echo.
echo [OK] Tum kontroller gecti.
goto :end
:fail
echo.
echo [HATA] Kontroller basarisiz.
:end
pause
endlocal
