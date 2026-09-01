from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Import router dari file routes.py yang baru kita bikin
from routes import router

app = FastAPI(title="WebGIS BMKG Kaltim API")

# Setting CORS biar Frontend React bisa ngobrol sama Backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Sambungin semua endpoint dari routes.py ke aplikasi utama
app.include_router(router)

if __name__ == "__main__":
    # Script untuk jalankan server (jika di-run manual via python main.py)
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)