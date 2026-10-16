@echo off
echo ===================================================
echo   Starting AI-Powered File Organizer (Full Stack)
echo ===================================================
echo Launching FastAPI backend at http://127.0.0.1:8000 ...
start "FileOrganizer - Backend" cmd /c "%~dp0start_backend.bat"

echo Launching React frontend at http://localhost:5173 ...
start "FileOrganizer - Frontend" cmd /c "%~dp0start_frontend.bat"

echo.
echo Both servers are booting up!
echo - Frontend UI:  http://localhost:5173
echo - Backend API:  http://127.0.0.1:8000
echo - Swagger Docs: http://127.0.0.1:8000/docs
echo.
