@echo off
cd /d "%~dp0"

if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
    echo Installing dependencies...
    venv\Scripts\pip install -r requirements.txt
)

echo Starting Server...
venv\Scripts\uvicorn backend.main:app --reload --host 0.0.0.0 --port 8081
