import os
import sys

# Add the project root to sys.path so backend/ can be imported correctly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.main import app

# Explicitly expose app for Vercel
app = app
