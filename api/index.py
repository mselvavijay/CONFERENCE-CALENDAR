import os
import sys

# Add the project root to sys.path to ensure backend modules can be imported
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.main import app

# Diagnostic route to confirm the API is reached
@app.get("/api/status")
async def get_status():
    return {"status": "ready", "project": "conference-calendar"}

# Vercel looks for an object named 'app'
app = app
