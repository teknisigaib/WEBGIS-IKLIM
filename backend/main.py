import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.gridspec import GridSpec
import matplotlib.patches as patches
from matplotlib.offsetbox import OffsetImage, AnnotationBbox
from matplotlib.ticker import FuncFormatter
from scipy.spatial.distance import cdist
import geopandas as gpd
from matplotlib.colors import ListedColormap, BoundaryNorm
from scipy.ndimage import gaussian_filter
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
import io
import json
import geojsoncontour
import os
import time
import sqlite3
import re
from datetime import datetime, timezone
from google import genai
from dotenv import load_dotenv

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

ai_client = None
if GEMINI_API_KEY:
    ai_client = genai.Client(api_key=GEMINI_API_KEY)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ARCHIVE_DIR = "arsip"
GEOJSON_DIR = os.path.join(ARCHIVE_DIR, "geojson")
PNG_DIR = os.path.join(ARCHIVE_DIR, "png")
CSV_DIR = os.path.join(ARCHIVE_DIR, "csv_raw")
DB_PATH = os.path.join(ARCHIVE_DIR, "arsip_peta.db")

for folder in [ARCHIVE_DIR, GEOJSON_DIR, PNG_DIR, CSV_DIR]:
    os.makedirs(folder, exist_ok=True)

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

init_db()

try:
    with open('config_peta.json', 'r') as f: MAP_CONFIGS = json.load(f)
except: MAP_CONFIGS = {}
try:
    with open('kabupaten_config.json', 'r') as f: REGION_DATA = json.load(f)
except: REGION_DATA = []
try:
    boundary_file = gpd.read_file('kaltim.json')
    kaltim_area = boundary_file.geometry.union_all()
except: 
    boundary_file = None
    kaltim_area = None

def get_or_calculate_idw(content, sigma, power, col_lon="LON", col_lat="LAT", col_val="VAL"):
    grid_x, grid_y = np.mgrid[113.0:120.0:200j, -3.0:3.2:200j]
    try: 
        df = pd.read_csv(io.BytesIO(content), sep=None, engine='python')
    except: 
        raise HTTPException(status_code=400, detail="Format CSV tidak valid!")
    
    missing_selected = [c for c in [col_lon, col_lat, col_val] if c not in df.columns]
    if missing_selected:
        raise HTTPException(status_code=400, detail=f"Kolom tidak ditemukan: {','.join(missing_selected)}")
    
    df = df[[col_lon, col_lat, col_val]].copy()
    df.columns = ['LON', 'LAT', 'VAL']
    
    for col in ['LON', 'LAT', 'VAL']:
        if df[col].dtype == 'object': df[col] = df[col].astype(str).str.replace(',', '.')
        df[col] = pd.to_numeric(df[col], errors='coerce')
        
    df = df.dropna(subset=['LON', 'LAT', 'VAL'])
    df = df[(df['LON'] >= 113.0) & (df['LON'] <= 120.0) & (df['LAT'] >= -3.0) & (df['LAT'] <= 3.2)]
    x, y, z = df['LON'].values, df['LAT'].values, df['VAL'].values
    
    dist = cdist(np.c_[grid_x.ravel(), grid_y.ravel()], np.c_[x, y])
    dist[dist == 0] = 1e-10
    weights = 1.0 / (dist ** power)
    grid_z = (np.sum(weights * z, axis=1) / np.sum(weights, axis=1)).reshape(grid_x.shape)
    grid_z = gaussian_filter(grid_z, sigma=sigma)
    
    if kaltim_area is not None:
        grid_points = gpd.GeoSeries.from_xy(grid_x.ravel(), grid_y.ravel())
        grid_z[~grid_points.within(kaltim_area).values.reshape(grid_x.shape)] = np.nan
        
    return grid_x, grid_y, grid_z, df

def generate_ai_analysis(grid_x, grid_y, grid_z, category_label, period, update_time, map_config, custom_prompt=""):
    if not ai_client: 
        return "Draft AI Tidak Tersedia: API Key Gemini belum di-setting di file .env."
    
    try:
        gx, gy, gz = grid_x.ravel(), grid_y.ravel(), grid_z.ravel()
        valid_mask = ~np.isnan(gz)
        gx_valid, gy_valid, gz_valid = gx[valid_mask], gy[valid_mask], gz[valid_mask]
        
        if len(gz_valid) == 0:
            return "Tidak ada data spasial yang valid untuk dianalisis."
            
        geometry = gpd.points_from_xy(gx_valid, gy_valid)
        grid_gdf = gpd.GeoDataFrame({'VAL': gz_valid}, geometry=geometry, crs="EPSG:4326")
        
        levels = map_config.get("levels", [])
        labels = map_config.get("labels", [])
        
        range_labels = []
        range_to_cat = {}
        for i in range(len(levels)-1):
            r_text = f"{levels[i]}-{levels[i+1]}" if levels[i+1] < 1000 else f">{levels[i]}"
            range_labels.append(r_text)
            if i < len(labels):
                range_to_cat[r_text] = labels[i]
        
        grid_gdf['RENTANG'] = pd.cut(grid_gdf['VAL'], bins=levels, labels=range_labels, include_lowest=True, ordered=False)
        
        global boundary_file
        try:
            if boundary_file is not None and not boundary_file.empty:
                if boundary_file.crs is None: boundary_file.set_crs("EPSG:4326", inplace=True)
                joined_gdf = gpd.sjoin(grid_gdf, boundary_file, how="left", predicate="within")
                grid_gdf['KABUPATEN'] = joined_gdf['nm_dati2'].fillna("Wilayah Luar")
            else:
                raise ValueError("File Poligon tidak tersedia")
        except Exception as e:
            reg_coords = np.array([[r['lon'], r['lat']] for r in REGION_DATA])
            reg_names = [r['nama'] for r in REGION_DATA]
            if len(reg_coords) > 0:
                distances = cdist(np.c_[gx_valid, gy_valid], reg_coords)
                grid_gdf['KABUPATEN'] = [reg_names[i] for i in np.argmin(distances, axis=1)]
            else:
                grid_gdf['KABUPATEN'] = "Kalimantan Timur"

        satuan = map_config.get("unit", "mm")
        jenis_data = "Prakiraan" if "PRAKIRAAN" in category_label.upper() else "Analisis"
        
        total_kaltim_pixels = len(grid_gdf)
        ringkasan_range = ""
        
        for rentang in range_labels:
            df_rentang = grid_gdf[grid_gdf['RENTANG'] == rentang]
            if df_rentang.empty: continue
            
            pct_global = (len(df_rentang) / total_kaltim_pixels) * 100
            kab_details = []
            
            for kab in df_rentang['KABUPATEN'].unique():
                if kab == "Wilayah Luar": continue 
                
                tot_kab = len(grid_gdf[grid_gdf['KABUPATEN'] == kab])
                if tot_kab == 0: continue
                
                tot_rentang_kab = len(df_rentang[df_rentang['KABUPATEN'] == kab])
                pct_lokal = (tot_rentang_kab / tot_kab) * 100
                
                if pct_lokal >= 80: sebutan = "hampir seluruh"
                elif pct_lokal >= 50: sebutan = "sebagian besar"
                elif pct_lokal >= 15: sebutan = "sebagian"
                else: sebutan = "sebagian kecil"
                    
                nama_daerah = str(kab).replace("Kota ", "")
                kab_details.append(f"{sebutan} wilayah {nama_daerah}")
                
            kat = range_to_cat.get(rentang, "")
            if kab_details:
                detail_teks = ", ".join(kab_details)
                ringkasan_range += f"- {rentang} {satuan} (Kategori {kat}) [Mencakup {pct_global:.1f}% area Kaltim]: Terpantau di {detail_teks}\n"

        prompt = f"""
        Kamu adalah Prakirawan Cuaca (Forecaster) resmi BMKG Provinsi Kalimantan Timur. Buat narasi analisis cuaca (1-2 paragraf) berdasarkan data luasan spasial berikut:
        
        - Jenis Peta: {category_label} (Tipe Data: {jenis_data})
        - Periode: {period}
        - Tanggal Update: {update_time}

        Berikut adalah semua rentang curah hujan yang tercatat beserta porsi wilayah terdampak:
        {ringkasan_range}
        
        Aturan Penulisan (SANGAT PENTING):
        1. Awali kalimat pertama persis seperti ini: "Berdasarkan data peta {category_label} periode {period} dengan pembaruan tanggal {update_time}, secara umum kondisi cuaca di wilayah Provinsi Kalimantan Timur..."
        2. Gunakan gaya bahasa manusiawi, mengalir, dan mudah dipahami publik. HINDARI penggunaan persentase angka.
        3. Gunakan kata penghubung yang netral dan halus.
        4. Gabungkan nama-nama kabupaten yang memiliki kategori/rentang curah hujan yang sama ke dalam satu kalimat yang padu.
        5. Tulis dalam satu atau dua paragraf utuh, tanpa poin-poin/bullet, TANPA BOLD (**), dan TANPA ITALIC (*).
        """
        
        if custom_prompt.strip():
            prompt += f"\n\nINSTRUKSI TAMBAHAN DARI FORECASTER:\n{custom_prompt}\n(SANGAT PENTING: Harap sesuaikan gaya dan isi narasi mengikuti instruksi tambahan ini secara ketat!)"
        
        response = ai_client.models.generate_content(model='gemini-3.1-flash-lite', contents=prompt)
        text_result = response.text.strip()
        
        clean_text = re.sub(r'[*_#]', '', text_result)
        return clean_text
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return f"Gagal menghasilkan analisis AI: {str(e)}"

def clean_and_inject_geojson(geojson_str, map_config, category, period, update_time, creator, analysis_text=""):
    import json
    from datetime import datetime, timezone
    
    geojson_dict = json.loads(geojson_str)
    unit_val = map_config.get("unit", "mm")
    levels = map_config.get("levels", [])
    colors = map_config.get("colors", [])
    labels = map_config.get("labels", [])

    legend_info = []
    for i in range(len(levels)-1):
        v_min, v_max = levels[i], levels[i+1]
        range_txt = f"{v_min} - {v_max}" if v_max < 1000 else f"> {v_min}"
        legend_info.append({
            "min_value": v_min, "max_value": v_max, "range_text": range_txt,
            "color": colors[i] if i < len(colors) else "#cccccc", 
            "category": labels[i] if i < len(labels) else ""
        })

    geojson_dict["metadata"] = {
        "map_type": map_config['title'].upper(),
        "system_category": category,
        "period": period,
        "update_time": update_time,
        "creator": creator,
        "unit": unit_val,
        "province": "Kalimantan Timur",
        "created_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "author": "Stasiun Meteorologi Kelas III Aji Pangeran Tumenggung Pranoto - Samarinda",
        "analysis_text": analysis_text, 
        "legend": legend_info 
    }
    
    for feature in geojson_dict["features"]:
        range_text = feature["properties"].get("title", "")
        val_str = range_text.replace(" ", "")
        
        if "-" in val_str:
            v_min, v_max = float(val_str.split("-")[0]), float(val_str.split("-")[1])
        elif ">" in val_str:
            v_min, v_max = float(val_str.replace(">", "")), 9999.0
        else:
            v_min, v_max = 0.0, 0.0
            
        category_label = ""
        color_hex = "#cccccc" 
        
        for i in range(len(levels)-1):
            if levels[i] == v_min:
                if i < len(labels): category_label = labels[i]
                if i < len(colors): color_hex = colors[i]
                break
                
        feature["properties"] = {
            "min_value": v_min, "max_value": v_max, "range_text": range_text,
            "category": category_label, "fill": color_hex, "fill-opacity": 0.85, 
            "stroke": color_hex, "stroke-width": 0, "stroke-opacity": 1.0
        }
        
    return geojson_dict

# ==============================================================================
# PERBAIKAN ENGINE RENDER MATPLOTLIB: LAYOUT BAKU BMKG (ANTI BERANTAKAN)
# ==============================================================================
def format_lon(x, pos): return f"{int(x)}°0'0\"E"
def format_lat(y, pos): return f"{abs(int(y))}°0'0\"{ 'N' if y>=0 else 'S' }"

# ==============================================================================
# PERBAIKAN ENGINE RENDER MATPLOTLIB: LAYOUT BAKU BMKG (ANTI BERANTAKAN)
# ==============================================================================
def draw_print_layout(grid_x, grid_y, grid_z, map_config, period, update_time, creator):
    levels, colors = map_config["levels"], map_config["colors"]
    labels = map_config.get("labels", [])
    unit = map_config.get("unit", "mm")
    
    fig = plt.figure(figsize=(10.52, 7.44), dpi=150, facecolor='white')
    
    fig.patch.set_linewidth(0)
    fig.add_artist(patches.Rectangle((0, 0), 1, 1, transform=fig.transFigure, facecolor='none', edgecolor='black', linewidth=3, clip_on=False))
    
    gs = GridSpec(1, 2, width_ratios=[2.2, 1], wspace=0.06, left=0.03, right=0.98, top=0.98, bottom=0.02)

    # ----------------------------------------------------
    # PANEL KIRI: AREA PETA
    # ----------------------------------------------------
    ax_map = fig.add_subplot(gs[0])
    ax_map.set_facecolor('#8be1ff') 
    for spine in ax_map.spines.values(): spine.set_linewidth(1)
    
    # --- 1. LAYER DARATAN LUAR NEGERI (Z-Order 1) ---
    try:
        malaysia = gpd.read_file('malaysia.json')
        malaysia.plot(ax=ax_map, color='#808080', edgecolor='none', zorder=1)
    except: pass

    # --- 2. LAYER DARATAN INDONESIA (Z-Order 2) ---
    try: 
        indo = gpd.read_file('indonesia.json')
        indo.plot(ax=ax_map, color='#cccccc', edgecolor='none', zorder=2)
    except: pass
    
    # --- 3. LAYER GRADASI HUJAN (Z-Order 3) ---
    ax_map.contourf(grid_x, grid_y, grid_z, levels=levels, cmap=ListedColormap(colors), norm=BoundaryNorm(levels, len(colors)), antialiased=True, zorder=3)
    
    # --- 4. LAYER BATAS KAB/KOTA KALTIM (Titik Hitam, Z-Order 4) ---
    if boundary_file is not None: 
        boundary_file.boundary.plot(ax=ax_map, color='black', linewidth=1.0, linestyle=':', zorder=4)
        
    # --- 5. LAYER BATAS PROVINSI DARAT (Merah Putus-Putus, Z-Order 5) ---
    try:
        indo.boundary.plot(ax=ax_map, color='red', linewidth=1, linestyle='--', zorder=5)
    except: pass
    if kaltim_area is not None: 
        gpd.GeoSeries([kaltim_area]).boundary.plot(ax=ax_map, color='red', linewidth=1, linestyle='--', zorder=5)

    # --- 6. LAYER GARIS PANTAI (Hitam Tebal Solid, Z-Order 6) ---
    # Pakai .buffer(0) untuk fixing geometry cacat sebelum di-lebur (unary_union)
    try:
        if 'malaysia' in locals():
            malaysia_fix = malaysia.copy()
            malaysia_fix.geometry = malaysia_fix.geometry.buffer(0)
            gpd.GeoSeries([malaysia_fix.unary_union]).boundary.plot(ax=ax_map, color='black', linewidth=2, linestyle='-', zorder=6)
    except: pass

    try:
        if 'indo' in locals():
            indo_fix = indo.copy()
            indo_fix.geometry = indo_fix.geometry.buffer(0)
            gpd.GeoSeries([indo_fix.unary_union]).boundary.plot(ax=ax_map, color='black', linewidth=2, linestyle='-', zorder=6)
    except: pass
    
    # ----------------------------------------------------
    # Teks Label & Koordinat
    # ----------------------------------------------------
    for reg in REGION_DATA: ax_map.text(reg['lon'], reg['lat'], reg['nama'].replace("Kota ", ""), fontsize=6.5, color='black', ha='center', va='center', zorder=7)
    
    ax_map.text(116.5, 2.6, "KALTARA", fontsize=10, fontweight='bold', ha='center', va='center', color='black', zorder=7)
    ax_map.text(114.5, -1.2, "KALTENG", fontsize=10, fontweight='bold', ha='center', va='center', color='black', zorder=7)
    ax_map.text(115.8, -2.5, "KALSEL", fontsize=10, fontweight='bold', ha='center', va='center', color='black', zorder=7)
    
    ax_map.set_xlim(113.8, 119.5)
    ax_map.set_ylim(-2.8, 2.8)
    
    ax_map.xaxis.set_major_formatter(FuncFormatter(format_lon))
    ax_map.yaxis.set_major_formatter(FuncFormatter(format_lat))
    ax_map.set_xticks([114, 116, 118])
    ax_map.set_yticks([-2, 0, 2])
    
    ax_map.tick_params(labelsize=8, direction='in', length=6, pad=5, top=True, bottom=True, left=True, right=True, labeltop=True, labelbottom=True, labelleft=True, labelright=True)
    ax_map.tick_params(axis='y', labelrotation=90)
    
    for x in [114, 116, 118]:
        for y in [-2, 0, 2]:
            ax_map.plot(x, y, marker='+', color='black', markersize=8, lw=1, zorder=7)

    # ----------------------------------------------------
    # PANEL KANAN: TABEL KETERANGAN (SISTEM KAVLING PRESISI)
    # ----------------------------------------------------
    ax_info = fig.add_subplot(gs[1])
    ax_info.axis('off')
    
    # --- KAVLING 1: HEADER (0.72 - 1.0) ---
    ax_info.add_patch(patches.Rectangle((0, 0.72), 1, 0.28, transform=ax_info.transAxes, facecolor='white', ec='black', lw=2))
    
    map_title_upper = map_config['title'].upper()
    
    plt.text(0.5, 0.97, map_title_upper, ha='center', va='center', transform=ax_info.transAxes, fontweight='bold', fontsize=9)
    plt.text(0.5, 0.945, period.upper(), ha='center', va='center', transform=ax_info.transAxes, fontweight='bold', fontsize=9)
    plt.text(0.5, 0.920, "PROVINSI KALIMANTAN TIMUR", ha='center', va='center', transform=ax_info.transAxes, fontweight='bold', fontsize=9)
    plt.text(0.5, 0.900, f"Update : {update_time}", ha='center', va='center', transform=ax_info.transAxes, color='blue', fontweight='bold', fontsize=7)
    
    try: 
        img_logo = plt.imread('logo_bmkg.png')
        ax_info.add_artist(AnnotationBbox(OffsetImage(img_logo, zoom=0.15), (0.5, 0.83), frameon=False, xycoords='axes fraction'))
    except: pass
    
    bmkg_text = "BADAN METEOROLOGI KLIMATOLOGI DAN GEOFISIKA\nSTASIUN METEOROLOGI KELAS II\nAJI PANGERAN TUMENGGUNG PRANOTO\nSAMARINDA - KALIMANTAN TIMUR"
    plt.text(0.5, 0.73, bmkg_text, ha='center', va='bottom', transform=ax_info.transAxes, fontsize=5.5, fontweight='bold', linespacing=1.2)

    # --- KAVLING 2: KETERANGAN WILAYAH (0.58 - 0.71) ---
    ax_info.add_patch(patches.Rectangle((0, 0.58), 1, 0.13, transform=ax_info.transAxes, facecolor='white', ec='black', lw=2))
    plt.text(0.5, 0.675, "KETERANGAN :", ha='center', transform=ax_info.transAxes, fontweight='bold', fontsize=9)
    
    ax_info.plot([0.05, 0.15], [0.63, 0.63], color='red', ls='--', lw=1.5, transform=ax_info.transAxes)
    plt.text(0.18, 0.63, "Batas Provinsi", va='center', transform=ax_info.transAxes, fontsize=8)
    
    ax_info.add_patch(patches.Rectangle((0.05, 0.595), 0.1, 0.025, facecolor='#808080', ec='black', lw=1, transform=ax_info.transAxes))
    plt.text(0.18, 0.605, "Luar Negeri", va='center', transform=ax_info.transAxes, fontsize=8)

    ax_info.add_patch(patches.Rectangle((0.55, 0.62), 0.1, 0.025, facecolor='#cccccc', ec='black', lw=1, transform=ax_info.transAxes))
    plt.text(0.68, 0.63, "Provinsi Lain", va='center', transform=ax_info.transAxes, fontsize=8)
    
    ax_info.plot([0.55, 0.65], [0.605, 0.605], color='black', ls=':', lw=1.5, transform=ax_info.transAxes)
    plt.text(0.68, 0.605, "Batas Kab/Kota", va='center', transform=ax_info.transAxes, fontsize=8)

    # --- KAVLING 3: TABEL LEGENDA (0.20 - 0.57) ---
    box_3_top = 0.57
    box_3_bottom = 0.20 
    
    ax_info.add_patch(patches.Rectangle((0, box_3_bottom), 1, box_3_top - box_3_bottom, transform=ax_info.transAxes, facecolor='white', ec='black', lw=2))
    
    judul_legenda = "SIFAT HUJAN (%) :" if "%" in unit else f"{map_title_upper.split(' ')[-1]} ({unit}) :"
    if "HARI HUJAN" in map_title_upper: judul_legenda = "HARI HUJAN (hari) :"
    
    plt.text(0.5, box_3_top - 0.03, judul_legenda, ha='center', transform=ax_info.transAxes, fontweight='bold', fontsize=9)
    ax_info.plot([0, 1], [box_3_top - 0.05, box_3_top - 0.05], color='black', lw=2, transform=ax_info.transAxes)
    
    num_items = len(colors)
    available_height = (box_3_top - 0.05) - box_3_bottom
    row_h = available_height / num_items
    y_cursor = box_3_top - 0.05
    
    groups = []
    current_label = labels[0] if labels else ""
    start_idx = 0
    for i in range(1, num_items):
        lbl = labels[i] if i < len(labels) else ""
        if lbl != current_label:
            groups.append((start_idx, i-1, current_label))
            current_label = lbl
            start_idx = i
    groups.append((start_idx, num_items-1, current_label))

    for i, color in enumerate(colors):
        y_top = y_cursor
        y_bot = y_cursor - row_h
        
        ax_info.add_patch(patches.Rectangle((0.05, y_bot + (row_h*0.1)), 0.15, row_h*0.8, facecolor=color, ec='black', lw=1, transform=ax_info.transAxes))
        text_range = f"{levels[i]} - {levels[i+1]}" if levels[i+1] < 1000 else f"> {levels[i]}"
        plt.text(0.25, (y_top + y_bot)/2, text_range, va='center', transform=ax_info.transAxes, fontsize=9)
        
        if labels:
            if i < num_items - 1:
                ax_info.plot([0, 0.5], [y_bot, y_bot], color='black', lw=1, transform=ax_info.transAxes)
        else:
            if i < num_items - 1:
                ax_info.plot([0, 1], [y_bot, y_bot], color='black', lw=1, transform=ax_info.transAxes)
        
        y_cursor = y_bot
        
    if labels:
        ax_info.plot([0.5, 0.5], [box_3_top - 0.05, box_3_bottom], color='black', lw=2, transform=ax_info.transAxes)
        for (start_idx, end_idx, label) in groups:
            y_start = (box_3_top - 0.05) - (start_idx * row_h)
            y_end = (box_3_top - 0.05) - ((end_idx + 1) * row_h)
            y_center = (y_start + y_end) / 2
            
            plt.text(0.75, y_center, label.upper(), ha='center', va='center', transform=ax_info.transAxes, fontweight='bold', fontsize=9)
            
            if y_end > box_3_bottom + 0.001:
                ax_info.plot([0.5, 1], [y_end, y_end], color='black', lw=1, transform=ax_info.transAxes)

    # --- KAVLING 4: KOTAK FOOTER (0.0 - 0.19) ---
    ax_info.add_patch(patches.Rectangle((0, 0.0), 1, 0.19, transform=ax_info.transAxes, facecolor='white', ec='black', lw=2))
    
    try: 
        img_compass = plt.imread('mata_angin.png')
        ax_info.add_artist(AnnotationBbox(OffsetImage(img_compass, zoom=0.07), (0.5, 0.145), frameon=False, xycoords='axes fraction'))
    except: pass
    
    scale_y = 0.075
    ax_info.plot([0.1, 0.9], [scale_y, scale_y], color='black', lw=4, transform=ax_info.transAxes)
    for px in [0.1, 0.3, 0.5, 0.7, 0.9]:
        ax_info.plot([px, px], [scale_y-0.01, scale_y+0.01], color='white', lw=1.5, transform=ax_info.transAxes)
    
    plt.text(0.1, scale_y+0.015, "0", ha='center', transform=ax_info.transAxes, fontsize=6)
    plt.text(0.3, scale_y+0.015, "30", ha='center', transform=ax_info.transAxes, fontsize=6)
    plt.text(0.5, scale_y+0.015, "60", ha='center', transform=ax_info.transAxes, fontsize=6)
    plt.text(0.7, scale_y+0.015, "120", ha='center', transform=ax_info.transAxes, fontsize=6)
    plt.text(0.9, scale_y+0.015, "240\nKM", ha='center', transform=ax_info.transAxes, fontsize=6)
    
    ax_info.plot([0, 1], [0.04, 0.04], color='black', lw=1.5, transform=ax_info.transAxes)
    
    if "PREDIKSI" in map_title_upper or "PRAKIRAAN" in map_title_upper:
        sumber_1 = "1. Bidang Analisis Variabilitas Iklim BMKG"
    else:
        sumber_1 = "1. Stasiun Meteorologi APT Pranoto Samarinda"
        
    sumber_text = f"Sumber Data :\n{sumber_1}\n2. Peta Rupa Bumi Indonesia : BIG"
    plt.text(0.5, 0.02, sumber_text, ha='center', va='center', transform=ax_info.transAxes, fontsize=5.5)

    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=300, bbox_inches='tight', pad_inches=0.15, facecolor='white') 
    plt.close(fig)
    buf.seek(0)
    return buf

@app.get("/download-template")
async def download_template():
    return Response("LON,LAT,VAL\n117.15,-0.50,150", media_type="text/csv", headers={"Content-Disposition": "attachment; filename=template_bmkg.csv"})

@app.post("/generate-map")
async def generate_map(file: UploadFile = File(...), sigma: float = Form(2.0), power: float = Form(2.0), category: str = Form(...), period: str = Form(...), update_time: str = Form(...), creator: str = Form("TIM FORECASTER"), col_lon: str = Form("LON"), col_lat: str = Form("LAT"), col_val: str = Form("VAL")):
    if category not in MAP_CONFIGS: raise HTTPException(400, "Invalid Category")
    map_config = MAP_CONFIGS[category]
    
    grid_x, grid_y, grid_z, df_valid = get_or_calculate_idw(await file.read(), sigma, power, col_lon, col_lat, col_val)
    raw_data = df_valid[['LON', 'LAT', 'VAL']].to_dict(orient='records')
    ai_text = generate_ai_analysis(grid_x, grid_y, grid_z, map_config['title'], period, update_time, map_config)
    
    fig, ax = plt.subplots() 
    contour = ax.contourf(grid_x, grid_y, grid_z, levels=map_config["levels"], cmap=ListedColormap(map_config["colors"]), norm=BoundaryNorm(map_config["levels"], len(map_config["colors"])))
    geojson_str = geojsoncontour.contourf_to_geojson(contourf=contour, min_angle_deg=3.0, ndigits=5)
    plt.close(fig)
    
    clean_geojson = clean_and_inject_geojson(geojson_str, map_config, category, period, update_time, creator, ai_text)
    
    return {
        "status": "success", 
        "data": { "geojson": clean_geojson, "legend_config": map_config, "analysis_text": ai_text, "raw_data": raw_data }
    }

@app.post("/regenerate-analysis")
async def regenerate_analysis(file: UploadFile = File(...), sigma: float = Form(2.0), power: float = Form(2.0), category: str = Form(...), period: str = Form(...), update_time: str = Form(...), col_lon: str = Form("LON"), col_lat: str = Form("LAT"), col_val: str = Form("VAL"), custom_prompt: str = Form("")):
    if category not in MAP_CONFIGS: raise HTTPException(400, "Invalid Category")
    map_config = MAP_CONFIGS[category]
    
    grid_x, grid_y, grid_z, _ = get_or_calculate_idw(await file.read(), sigma, power, col_lon, col_lat, col_val)
    ai_text = generate_ai_analysis(grid_x, grid_y, grid_z, map_config['title'], period, update_time, map_config, custom_prompt)
    
    return {"status": "success", "data": {"analysis_text": ai_text}}

@app.post("/preview-print")
async def preview_print(file: UploadFile = File(...), sigma: float = Form(2.0), power: float = Form(2.0), category: str = Form(...), period: str = Form(...), update_time: str = Form(...), creator: str = Form("TIM FORECASTER"), col_lon: str = Form("LON"), col_lat: str = Form("LAT"), col_val: str = Form("VAL")):
    if category not in MAP_CONFIGS: raise HTTPException(400, "Invalid Category")
    
    grid_x, grid_y, grid_z, _ = get_or_calculate_idw(await file.read(), sigma, power, col_lon, col_lat, col_val)
    buf = draw_print_layout(grid_x, grid_y, grid_z, MAP_CONFIGS[category], period, update_time, creator)
    
    return Response(content=buf.getvalue(), media_type="image/png")

@app.post("/save-archive")
async def save_archive(file: UploadFile = File(...), sigma: float = Form(2.0), power: float = Form(2.0), category: str = Form(...), period: str = Form(...), update_time: str = Form(...), creator: str = Form("TIM FORECASTER"), analysis_text: str = Form(""), col_lon: str = Form("LON"), col_lat: str = Form("LAT"), col_val: str = Form("VAL")):
    content = await file.read()
    grid_x, grid_y, grid_z, _ = get_or_calculate_idw(content, sigma, power, col_lon, col_lat, col_val)
    filename_base = f"{category}_{period.replace(' ', '_').upper()}_{int(time.time())}" 
    
    with open(os.path.join(CSV_DIR, f"{filename_base}.csv"), "wb") as f_csv: f_csv.write(content)
    buf = draw_print_layout(grid_x, grid_y, grid_z, MAP_CONFIGS[category], period, update_time, creator)
    with open(os.path.join(PNG_DIR, f"{filename_base}.png"), "wb") as f_png: f_png.write(buf.read())
    
    fig, ax = plt.subplots() 
    contour = ax.contourf(grid_x, grid_y, grid_z, levels=MAP_CONFIGS[category]["levels"], cmap=ListedColormap(MAP_CONFIGS[category]["colors"]), norm=BoundaryNorm(MAP_CONFIGS[category]["levels"], len(MAP_CONFIGS[category]["colors"])))
    geojson_str = geojsoncontour.contourf_to_geojson(contourf=contour, min_angle_deg=3.0, ndigits=5)
    plt.close(fig)
    
    clean_geojson = clean_and_inject_geojson(geojson_str, MAP_CONFIGS[category], category, period, update_time, creator, analysis_text)
    with open(os.path.join(GEOJSON_DIR, f"{filename_base}.json"), "w") as f_json: json.dump(clean_geojson, f_json)

    conn = get_db_connection()
    conn.execute('INSERT INTO saved_maps (title, category, period, update_time, sigma, power, creator, analysis_text, filename_base) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 
                 (MAP_CONFIGS[category]['title'], category, period, update_time, sigma, power, creator, analysis_text, filename_base))
    conn.commit(); conn.close()
    return {"status": "success", "filename": f"{filename_base}.png"}

@app.get("/archives")
async def get_archives():
    conn = get_db_connection()
    maps = conn.execute('SELECT * FROM saved_maps ORDER BY id DESC').fetchall()
    conn.close()
    
    result = []
    for row in maps:
        result.append({
            "id": row["id"],
            "title": row["title"],
            "category": row["category"],
            "period": row["period"],
            "update_time": row["update_time"],
            "creator": row["creator"],
            "filename_base": row["filename_base"],
            "analysis_text": row["analysis_text"] if "analysis_text" in row.keys() else ""
        })
    return {"status": "success", "data": result}

@app.delete("/archives/{item_id}")
async def delete_archive(item_id: int):
    conn = get_db_connection()
    record = conn.execute('SELECT filename_base FROM saved_maps WHERE id = ?', (item_id,)).fetchone()
    if not record: raise HTTPException(404, "Archive not found")
    conn.execute('DELETE FROM saved_maps WHERE id = ?', (item_id,))
    conn.commit(); conn.close()
    for path in [os.path.join(PNG_DIR, f"{record['filename_base']}.png"), os.path.join(GEOJSON_DIR, f"{record['filename_base']}.json"), os.path.join(CSV_DIR, f"{record['filename_base']}.csv")]:
        if os.path.exists(path): os.remove(path)
    return {"status": "success"}

@app.get("/archives/download/{file_type}/{filename_base}")
async def download_archive_file(file_type: str, filename_base: str):
    paths = {"png": (PNG_DIR, "image/png", ".png"), "geojson": (GEOJSON_DIR, "application/json", ".json"), "csv": (CSV_DIR, "text/csv", ".csv")}
    if file_type not in paths: raise HTTPException(400, "Invalid type")
    folder, mime, ext = paths[file_type]
    target = os.path.join(folder, f"{filename_base}{ext}")
    return FileResponse(target, media_type=mime, filename=f"{filename_base}{ext}")

class UpdateAnalysisModel(BaseModel):
    analysis_text: str

@app.put("/archives/{item_id}/analysis")
async def update_archive_analysis(item_id: int, data: UpdateAnalysisModel):
    conn = get_db_connection()
    conn.execute('UPDATE saved_maps SET analysis_text = ? WHERE id = ?', (data.analysis_text, item_id))
    conn.commit()
    conn.close()
    return {"status": "success", "message": "Analisis berhasil diperbarui"}