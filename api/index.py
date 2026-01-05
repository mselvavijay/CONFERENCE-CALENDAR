# api/index.py
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import os, json
 
# If you need pandas to parse Excel:
# import pandas as pd
 
NETLIFY_ORIGIN = "https://bhconferencecalendar.netlify.app"  # allow your frontend
PROJECT_ROOT = os.path.dirname(os.path.dirname(__file__))
EVENTS_PATH = os.path.join(PROJECT_ROOT, "storage", "events.json")
 
app = FastAPI()
 
# CORS so Netlify frontend can call the Vercel API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[NETLIFY_ORIGIN],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)
 
@app.get("/api")
def api_root():
    return {"status": "ok", "message": "FastAPI on Vercel"}
 
@app.get("/api/events")
def get_events():
    try:
        with open(EVENTS_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return JSONResponse(data)
    except FileNotFoundError:
        return JSONResponse({"error": "events.json not found"}, status_code=404)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
 
@app.post("/api/upload")
async def upload_excel(file: UploadFile = File(...)):
    # Example: if you want to parse Excel in-memory with pandas:
    # bytes_data = await file.read()
    # df = pd.read_excel(io.BytesIO(bytes_data), engine="openpyxl")
    # points = [
    #     {
    #         "title": str(row.get("Title", "")),
    #         "date": str(row.get("Date", "")),
    #         "city": str(row.get("City", "")),
    #         "latitude": float(row.get("Latitude", 0)) if pd.notna(row.get("Latitude")) else None,
    #         "longitude": float(row.get("Longitude", 0)) if pd.notna(row.get("Longitude")) else None,
    #     }
    #     for _, row in df.iterrows()
    # ]
    # return {"count": len(points), "points": points}
 
    # For now, just echo file metadata:
    return {"filename": file.filename, "content_type": file.content_type}
 