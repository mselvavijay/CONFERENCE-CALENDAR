# api/index.py
import sys
import os

# Ensure the root directory is in the python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.main import app

# This is required for Vercel to find the FastAPI app
app = app
 