from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import os
from fastapi.responses import FileResponse
from typing import Optional, List, Dict
from pydantic import BaseModel
from backend.data_manager import data_manager

app = FastAPI()

# CORS for production and local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://bhconferencecalendar.netlify.app",
        "https://bhconfcalendar.netlify.app",
        "https://bhconferencecalendar.vercel.app",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "null"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routes
@app.get("/")
async def root():
    return {"status": "ok", "message": "Backend is running"}

@app.get("/api")
@app.get("/api/")
async def api_root():
    return {"status": "ok", "message": "FastAPI Server"}

@app.get("/api/events")
async def get_events():
    return data_manager.get_events()

@app.get("/api/filters")
async def get_filters():
    return data_manager.get_filter_options()

@app.post("/api/admin/upload")
async def upload_excel(file: UploadFile = File(...), passphrase: Optional[str] = None):
    # Basic security check
    # In real app, use header or proper auth.
    # User asked for "Admin access must be restricted (e.g., passphrase...)"
    # We will check a query param or header for simplicity in this MVP proof-of-concept
    # ideally header: X-Admin-Pass
    
    # NOTE: Since this is multipart/form-data, we might accept passphrase as form field or query param
    # For now, let's hardcode a simple check, user can configure later.
    ADMIN_SECRET = "admin123" 
    
    if passphrase != ADMIN_SECRET:
         # Also check header just in case frontend sends it there
         pass # implement if needed, simplifying for now
         if passphrase != ADMIN_SECRET:
             raise HTTPException(status_code=401, detail="Invalid Passphrase")

    content = await file.read()
    result = data_manager.process_excel(content)
    
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    
    return result

@app.get("/api/admin/stats")
async def get_stats(passphrase: str):
    ADMIN_SECRET = "admin123"
    if passphrase != ADMIN_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")
        
    events = data_manager.events
    return {
        "total_events": len(events),
        "topics": len(set(e.get("topic") for e in events)),
        "countries": len(set(e.get("country") for e in events))
    }

@app.post("/api/admin/re-geocode")
async def re_geocode(passphrase: str):
    ADMIN_SECRET = "admin123"
    if passphrase != ADMIN_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    result = data_manager.re_geocode_all()
    return result

class InterestRequest(BaseModel):
    firstName: str
    lastName: str
    username: str
    email: str
    role: str
    city: str
    country: str
    eventId: str
    confirmed: bool
    consent: bool

@app.post("/api/interest")
async def save_interest(request: InterestRequest):
    result = data_manager.save_interest(request.dict())
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result

@app.get("/api/admin/interests")
async def get_interests(passphrase: str):
    ADMIN_SECRET = "admin123"
    if passphrase != ADMIN_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return data_manager.get_interests()

@app.get("/api/admin/download-interests")
async def download_interests(passphrase: str):
    ADMIN_SECRET = "admin123"
    if passphrase != ADMIN_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    file_path = data_manager.get_interests_file()
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="No interest file found yet.")
        
    return FileResponse(file_path, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename="UserInterests.xlsx")


# Serve Frontend
# This must be last to avoid catching API routes
app.mount("/", StaticFiles(directory="frontend", html=True), name="static")
