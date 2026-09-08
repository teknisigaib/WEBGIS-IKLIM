import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

# Import router dari file routes.py
from routes import router

# Import nama folder dari config biar dinamis
from config import PNG_DIR, GEOJSON_DIR, CSV_DIR, TIF_DIR

app = FastAPI(title="WebGIS BMKG Kaltim API")

# Setting CORS biar Frontend React bisa ngobrol sama Backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================================================
# 📂 SAFETY NET: Bikin folder otomatis kalau belum ada di server
# ==============================================================
os.makedirs(PNG_DIR, exist_ok=True)
os.makedirs(GEOJSON_DIR, exist_ok=True)
os.makedirs(CSV_DIR, exist_ok=True)
os.makedirs(TIF_DIR, exist_ok=True)

# ==============================================================
# 🌐 BUKA AKSES FOLDER STATIS (Biar bisa diakses via URL)
# ==============================================================
app.mount("/static/png", StaticFiles(directory=PNG_DIR), name="static_png")
app.mount("/static/geojson", StaticFiles(directory=GEOJSON_DIR), name="static_geojson")
app.mount("/static/csv", StaticFiles(directory=CSV_DIR), name="static_csv")
app.mount("/static/tif", StaticFiles(directory=TIF_DIR), name="static_tif")

# Sambungin semua endpoint dari routes.py ke aplikasi utama
app.include_router(router)

if __name__ == "__main__":
    # Script untuk jalankan server (jika di-run manual via python main.py)
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)