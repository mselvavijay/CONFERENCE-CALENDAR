# api/main.py
import sys
import os

# Add current directory and parent to sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(BASE_DIR)

from backend.main import app

# Vercel looks for the 'app' variable in this file
app = app
 