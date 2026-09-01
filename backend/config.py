import os
import json
import sqlite3
import geopandas as gpd

# ==========================================
# 1. SETUP FOLDER ARSIP
# ==========================================
ARCHIVE_DIR = "arsip"
GEOJSON_DIR = os.path.join(ARCHIVE_DIR, "geojson")
PNG_DIR = os.path.join(ARCHIVE_DIR, "png")
CSV_DIR = os.path.join(ARCHIVE_DIR, "csv_raw")
TIF_DIR = os.path.join(ARCHIVE_DIR, "tif") 
DB_PATH = os.path.join(ARCHIVE_DIR, "arsip_peta.db") # <-- Ini yang tadi bikin error NameError

for folder in [ARCHIVE_DIR, GEOJSON_DIR, PNG_DIR, CSV_DIR, TIF_DIR]:
    os.makedirs(folder, exist_ok=True)

# ==========================================
# 2. SETUP DATABASE SQLITE
# ==========================================
def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS saved_maps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            period TEXT NOT NULL,
            update_time TEXT,
            sigma REAL,
            power REAL,
            creator TEXT DEFAULT 'TIM FORECASTER',
            filename_base TEXT UNIQUE NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    try: 
        conn.execute('ALTER TABLE saved_maps ADD COLUMN analysis_text TEXT DEFAULT ""')
    except: 
        pass
    conn.commit()
    conn.close()

# Langsung jalankan saat file ini di-import
init_db()

# ==========================================
# 3. LOAD FILE JSON (CONFIG & GEOMETRI)
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
    # union_all() butuh geopandas versi baru
    kaltim_area = boundary_file.geometry.union_all()
except: 
    boundary_file = None
    kaltim_area = None