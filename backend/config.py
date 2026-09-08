import os
import json
import geopandas as gpd
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv 

# Load semua variabel dari file .env ke dalam sistem
load_dotenv()

# ==========================================
# 1. SETUP FOLDER ARSIP (TETAP SAMA)
# ==========================================
ARCHIVE_DIR = "arsip"
GEOJSON_DIR = os.path.join(ARCHIVE_DIR, "geojson")
PNG_DIR = os.path.join(ARCHIVE_DIR, "png")
CSV_DIR = os.path.join(ARCHIVE_DIR, "csv_raw")
TIF_DIR = os.path.join(ARCHIVE_DIR, "tif") 

for folder in [ARCHIVE_DIR, GEOJSON_DIR, PNG_DIR, CSV_DIR, TIF_DIR]:
    os.makedirs(folder, exist_ok=True)


# ==========================================
# 2. SETUP DATABASE POSTGRESQL + POSTGIS (UPDATE .ENV)
# ==========================================
# Sekarang kita panggil variabelnya pakai os.getenv
DATABASE_URL = os.getenv("DATABASE_URL")

# Kasih pengaman kalau file .env lupa dibikin
if not DATABASE_URL:
    raise ValueError("ENVIRONMENT VARIABLE 'DATABASE_URL' IS NOT SET!")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ==========================================
# 3. LOAD FILE JSON (TETAP SAMA)
# ==========================================
try:
    with open('config_peta.json', 'r') as f: 
        MAP_CONFIGS = json.load(f)
except: 
    MAP_CONFIGS = {}

try:
    with open('kabupaten_config.json', 'r') as f: 
        REGION_DATA = json.load(f)
except: 
    REGION_DATA = []

try:
    boundary_file = gpd.read_file('kaltim.json')
    kaltim_area = boundary_file.geometry.union_all()
except: 
    boundary_file = None
    kaltim_area = None