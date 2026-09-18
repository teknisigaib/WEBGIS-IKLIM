import os
import json
from fastapi.responses import JSONResponse
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.openapi.docs import get_swagger_ui_html 
import uvicorn

# Import router dari file routes.py
from routes import router

# Import nama folder dari config biar dinamis
from config import PNG_DIR, GEOJSON_DIR, CSV_DIR, TIF_DIR

# 1. Dokumentasi FULL (admin) dipindah ke /admin-docs biar aman dari publik
app = FastAPI(
    title="WebGIS BMKG Kaltim API",
    docs_url="/admin-docs",
    redoc_url="/admin-redoc",
    openapi_url="/admin-openapi.json"  # <--- TAMBAHAN KRUSIAL INI!
)

# Setting CORS biar Frontend React bisa ngobrol sama Backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Izinkan dari semua domain (termasuk web utama BMKG)
    allow_credentials=True,
    allow_methods=["*"],  # GET, POST, OPTIONS, PUT, DELETE
    allow_headers=["*"],  # Content-Type, x-api-key, Authorization, dll.
    expose_headers=["*"]
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

# ==============================================================
# 📚 ENDPOINT KHUSUS DOKUMENTASI PUBLIK (SWAGGER UI)
# ==============================================================

# 2. Rute untuk menyajikan file JSON mentahnya di /openapi.json (sesuai settingan NPM lu)
@app.get("/openapi.json", include_in_schema=False)
async def get_openapi_endpoint():
    try:
        with open("openapi_bmkg_public.json", "r") as f:
            return JSONResponse(content=json.load(f))
    except FileNotFoundError:
        return {"error": "File openapi_bmkg_public.json tidak ditemukan"}

# 3. Rute untuk menampilkan halaman Swagger UI publik di /docs (sesuai settingan NPM lu)
@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui_html():
    return get_swagger_ui_html(
        openapi_url="/openapi.json",
        title="API Publik WebGIS BMKG Kaltim",
        swagger_favicon_url="https://www.bmkg.go.id/asset/img/favicon.ico",
        swagger_js_url="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js",
        swagger_css_url="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css"
    )

# Sambungin semua endpoint dari routes.py ke aplikasi utama
app.include_router(router)

if __name__ == "__main__":
    # Script untuk jalankan server (jika di-run manual via python main.py)
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)